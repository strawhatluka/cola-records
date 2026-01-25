import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/Textarea';
import { Checkbox } from '../../ui/Checkbox';
import { useGitStore } from '../../../stores/useGitStore';

interface GitCommitDialogProps {
  open: boolean;
  onClose: () => void;
  repoPath: string;
}

export function GitCommitDialog({ open, onClose, repoPath }: GitCommitDialogProps) {
  const { status, commit, loading } = useGitStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Get all changed files
  const allFiles = status
    ? status.files.map((f) => f.path).filter((path) => path.trim() !== '')
    : [];

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCommitMessage('');
      setSelectedFiles(new Set());
      setError(null);
    }
  }, [open]);

  const handleCommit = async () => {
    // Validation
    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    if (selectedFiles.size === 0) {
      setError('Select at least one file to commit');
      return;
    }

    try {
      setError(null);
      await commit(repoPath, commitMessage, Array.from(selectedFiles));
      // Success - close dialog
      setCommitMessage('');
      setSelectedFiles(new Set());
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Commit failed');
    }
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === allFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(allFiles));
    }
  };

  const toggleFile = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const getFileStatus = (filePath: string) => {
    if (!status) return '?';
    const file = status.files.find((f) => f.path === filePath);
    if (!file) return '?';
    return file.index || file.working_dir || '?';
  };

  const getStatusColor = (fileStatus: string) => {
    switch (fileStatus) {
      case 'M':
        return 'text-yellow-500';
      case 'A':
        return 'text-green-500';
      case 'D':
        return 'text-red-500';
      case '?':
        return 'text-gray-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusLabel = (fileStatus: string) => {
    switch (fileStatus) {
      case 'M':
        return 'Modified';
      case 'A':
        return 'Added';
      case 'D':
        return 'Deleted';
      case '?':
        return 'Untracked';
      default:
        return 'Unknown';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Commit Message
            </label>
            <Textarea
              placeholder="Describe your changes..."
              value={commitMessage}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCommitMessage(e.target.value)}
              rows={4}
              className="font-mono resize-none"
            />
          </div>

          <div className="border rounded-md">
            <div className="flex items-center justify-between p-3 border-b bg-muted/20">
              <h4 className="font-semibold text-sm">
                Changed Files ({allFiles.length})
              </h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleSelectAll}
                disabled={allFiles.length === 0}
              >
                {selectedFiles.size === allFiles.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {allFiles.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No changed files
                </div>
              ) : (
                allFiles.map((filePath) => {
                  const fileStatus = getFileStatus(filePath);
                  return (
                    <div
                      key={filePath}
                      className="flex items-center gap-3 p-2 hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => toggleFile(filePath)}
                    >
                      <Checkbox
                        checked={selectedFiles.has(filePath)}
                        onCheckedChange={() => toggleFile(filePath)}
                        onClick={(e: MouseEvent) => e.stopPropagation()}
                      />
                      <span
                        className={`text-xs font-semibold w-16 ${getStatusColor(
                          fileStatus
                        )}`}
                      >
                        {getStatusLabel(fileStatus)}
                      </span>
                      <span className="text-sm font-mono flex-1 truncate" title={filePath}>
                        {filePath}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={loading || allFiles.length === 0}>
            {loading ? 'Committing...' : 'Commit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
