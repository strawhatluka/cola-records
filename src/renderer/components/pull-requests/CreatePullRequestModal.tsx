import { useState } from 'react';
import { GitPullRequest } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { ipc } from '../../ipc/client';

interface CreatePullRequestModalProps {
  open: boolean;
  owner: string;
  repo: string;
  defaultHead: string;
  defaultBase?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePullRequestModal({
  open,
  owner,
  repo,
  defaultHead,
  defaultBase = 'main',
  onClose,
  onCreated,
}: CreatePullRequestModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [head, setHead] = useState(defaultHead);
  const [base, setBase] = useState(defaultBase);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !head.trim() || !base.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await ipc.invoke(
        'github:create-pull-request',
        owner,
        repo,
        title.trim(),
        head.trim(),
        base.trim(),
        body.trim()
      );

      setTitle('');
      setBody('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Pull Request</DialogTitle>
          <DialogDescription>
            Submit a pull request to {owner}/{repo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pull request title"
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Head branch</label>
              <Input
                value={head}
                onChange={(e) => setHead(e.target.value)}
                placeholder="your-fork:branch-name"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The branch with your changes
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Base branch</label>
              <Input
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="main"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The branch you want to merge into
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your changes... (Markdown supported)"
              className="min-h-[160px] resize-y"
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || !head.trim() || !base.trim() || submitting}
            >
              <GitPullRequest className="h-4 w-4 mr-2" />
              {submitting ? 'Creating...' : 'Create Pull Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
