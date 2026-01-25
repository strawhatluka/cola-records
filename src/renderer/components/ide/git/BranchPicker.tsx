import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Separator } from '../../ui/Separator';
import { useGitStore } from '../../../stores/useGitStore';
import { cn } from '../../../lib/utils';

interface BranchPickerProps {
  open: boolean;
  onClose: () => void;
  repoPath: string;
}

export function BranchPicker({ open, onClose, repoPath }: BranchPickerProps) {
  const { branches, currentBranch, switchBranch, createBranch, loading } = useGitStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredBranches = branches.filter((branch) =>
    branch.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSwitchBranch = async (branch: string) => {
    if (branch === currentBranch) {
      onClose();
      return;
    }

    try {
      setError(null);
      await switchBranch(repoPath, branch);
      // Success toast would go here
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to switch branch');
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setError('Branch name is required');
      return;
    }

    // Validate branch name (basic validation)
    if (!/^[a-zA-Z0-9/_-]+$/.test(newBranchName)) {
      setError('Invalid branch name. Use only letters, numbers, /, _, and -');
      return;
    }

    if (branches.includes(newBranchName)) {
      setError('Branch already exists');
      return;
    }

    try {
      setError(null);
      await createBranch(repoPath, newBranchName);
      // Success toast would go here
      setNewBranchName('');
      setShowCreateBranch(false);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create branch');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Switch Branch</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search branches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="space-y-1 max-h-96 overflow-y-auto border rounded-md">
            {filteredBranches.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No branches found
              </div>
            ) : (
              filteredBranches.map((branch) => (
                <div
                  key={branch}
                  className={cn(
                    'p-3 cursor-pointer hover:bg-accent transition-colors flex items-center justify-between',
                    branch === currentBranch && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                  onClick={() => handleSwitchBranch(branch)}
                >
                  <span className="font-mono text-sm">{branch}</span>
                  {branch === currentBranch && (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              ))
            )}
          </div>

          <Separator />

          {!showCreateBranch ? (
            <Button onClick={() => setShowCreateBranch(true)} variant="outline" className="w-full">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Branch
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Branch name..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateBranch();
                  } else if (e.key === 'Escape') {
                    setShowCreateBranch(false);
                    setNewBranchName('');
                    setError(null);
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateBranch}
                  disabled={loading || !newBranchName.trim()}
                  className="flex-1"
                >
                  Create
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateBranch(false);
                    setNewBranchName('');
                    setError(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
