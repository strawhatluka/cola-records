import * as React from 'react';
import {
  GitBranch,
  GitCommit,
  AlertTriangle,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  User,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import type { BranchInfo } from '../../../main/ipc/channels';

interface BranchDetailModalProps {
  branchName: string;
  localPath: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function BranchDetailModal({
  branchName,
  localPath,
  onClose,
  onDeleted,
}: BranchDetailModalProps) {
  const [branchInfo, setBranchInfo] = React.useState<BranchInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchBranchInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const info = await ipc.invoke('git:get-branch-info', localPath, branchName);
        setBranchInfo(info);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchBranchInfo();
  }, [localPath, branchName]);

  const handleDelete = async (force: boolean) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await ipc.invoke('git:delete-branch', localPath, branchName, force);
      onDeleted();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // If it's an unmerged branch error and we haven't tried force yet, suggest force delete
      if (!force && errorMsg.includes('not fully merged')) {
        setDeleteError('Branch is not fully merged. Would you like to force delete it?');
      } else {
        setDeleteError(errorMsg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = branchInfo && !branchInfo.isCurrent && !branchInfo.isProtected;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <GitBranch className="h-6 w-6 text-primary mt-0.5" />
            <div className="flex-1">
              <DialogTitle className="text-xl">{branchName}</DialogTitle>
              <DialogDescription className="mt-1">Branch details and statistics</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {branchInfo && !loading && (
          <div className="space-y-6">
            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              {branchInfo.isCurrent && (
                <Badge variant="default" className="bg-green-500 text-white">
                  Current Branch
                </Badge>
              )}
              {branchInfo.isProtected && (
                <Badge variant="secondary">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Protected
                </Badge>
              )}
            </div>

            {/* Branch Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-muted/50 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <GitCommit className="h-4 w-4" />
                  <span>Commits</span>
                </div>
                <div className="text-2xl font-semibold">{branchInfo.commitCount}</div>
              </div>
              <div className="p-4 rounded-md bg-muted/50 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <ArrowUp className="h-4 w-4 text-green-500" />
                  <ArrowDown className="h-4 w-4 text-red-500" />
                  <span>Ahead / Behind</span>
                </div>
                <div className="text-2xl font-semibold">
                  <span className="text-green-500">+{branchInfo.ahead}</span>
                  {' / '}
                  <span className="text-red-500">-{branchInfo.behind}</span>
                </div>
              </div>
            </div>

            {/* Last Commit */}
            <div className="p-4 rounded-md bg-muted/50 border border-border">
              <div className="text-sm font-medium mb-3">Last Commit</div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <GitCommit className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">
                      {branchInfo.lastCommit.hash.slice(0, 7)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {branchInfo.lastCommit.message}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{branchInfo.lastCommit.author}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(branchInfo.lastCommit.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delete Section */}
            {!showDeleteConfirm ? (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!canDelete}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Branch
                </Button>
                {!canDelete && branchInfo.isCurrent && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Cannot delete the currently checked out branch
                  </p>
                )}
                {!canDelete && branchInfo.isProtected && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Cannot delete protected branches (main, master, dev, develop)
                  </p>
                )}
              </div>
            ) : (
              <div className="pt-4 border-t border-border space-y-4">
                <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Are you sure you want to delete &ldquo;{branchName}&rdquo;?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This action cannot be undone. The branch will be permanently removed.
                      </p>
                    </div>
                  </div>
                </div>

                {deleteError && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  {deleteError?.includes('force delete') ? (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(true)}
                      disabled={deleting}
                      className="flex-1"
                    >
                      {deleting ? 'Deleting...' : 'Force Delete'}
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(false)}
                      disabled={deleting}
                      className="flex-1"
                    >
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
