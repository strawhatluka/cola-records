import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ipc } from '../../ipc/client';

interface IssueSummary {
  number: number;
  title: string;
  state: string;
  url: string;
  id?: number;
}

interface AddExistingSubIssueModalProps {
  open: boolean;
  owner: string;
  repo: string;
  parentIssueNumber: number;
  onClose: () => void;
  onAdded: () => void;
}

export function AddExistingSubIssueModal({
  open,
  owner,
  repo,
  parentIssueNumber,
  onClose,
  onAdded,
}: AddExistingSubIssueModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);

    ipc.invoke('github:list-issues', owner, repo, 'open')
      .then((result) => {
        if (isMounted.current) {
          // Exclude the parent issue itself
          setIssues(result.filter((i: any) => i.number !== parentIssueNumber));
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });
  }, [open, owner, repo, parentIssueNumber]);

  const filteredIssues = issues.filter((i) =>
    searchQuery.trim() === ''
      ? true
      : i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(i.number).includes(searchQuery)
  );

  const handleSelect = async (issue: IssueSummary) => {
    setAdding(true);
    setError(null);
    try {
      // The sub-issues API needs the issue's database ID, not the number.
      // We need to fetch the issue to get its ID.
      const detail = await ipc.invoke('github:get-issue', owner, repo, issue.number);
      const issueId = parseInt(detail.id, 10);
      await ipc.invoke('github:add-existing-sub-issue', owner, repo, parentIssueNumber, issueId);
      onAdded();
      onClose();
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMounted.current) setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Existing Issue</DialogTitle>
          <DialogDescription>
            Link an existing issue as a sub-issue of #{parentIssueNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues by title or number..."
              className="pl-9"
              disabled={adding}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredIssues.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No issues found</p>
            ) : (
              filteredIssues.map((issue) => (
                <button
                  key={issue.number}
                  onClick={() => handleSelect(issue)}
                  disabled={adding}
                  className="w-full text-left flex items-center gap-2 p-2 rounded-md hover:bg-accent text-xs transition-colors disabled:opacity-50"
                >
                  <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    issue.state === 'open'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {issue.state}
                  </span>
                  <span className="text-muted-foreground shrink-0">#{issue.number}</span>
                  <span className="truncate">{issue.title}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose} disabled={adding}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
