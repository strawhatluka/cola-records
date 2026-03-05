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
  onSwitched: () => void;
}

export function BranchDetailModal({
  branchName,
  localPath,
  onClose,
  onDeleted,
  onSwitched,
}: BranchDetailModalProps) {
  const [branchInfo, setBranchInfo] = React.useState<BranchInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [switching, setSwitching] = React.useState(false);

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

  const handleSwitch = async () => {
    setSwitching(true);
    setError(null);
    try {
      await ipc.invoke('git:checkout', localPath, branchName);
      onSwitched();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwitching(false);
    }
  };

  const canDelete = branchInfo && !branchInfo.isCurrent && !branchInfo.isProtected;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <div className="flex items-start gap-2.5">
            <GitBranch className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base break-all">{branchName}</DialogTitle>
              <DialogDescription>Branch details and statistics</DialogDescription>
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
          <div className="space-y-4 min-w-0">
            {/* Status Badges */}
            {(branchInfo.isCurrent || branchInfo.isProtected) && (
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
            )}

            {/* Branch Stats */}
            <div className="grid grid-cols-2 gap-3 min-w-0">
              <div className="p-3 rounded-md bg-muted/50 border border-border min-w-0">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <GitCommit className="h-3.5 w-3.5 shrink-0" />
                  <span>Commits</span>
                </div>
                <div className="text-xl font-semibold">{branchInfo.commitCount}</div>
              </div>
              <div className="p-3 rounded-md bg-muted/50 border border-border min-w-0">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <ArrowUp className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <ArrowDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span>Ahead / Behind</span>
                </div>
                <div className="text-xl font-semibold">
                  <span className="text-green-500">+{branchInfo.ahead}</span>
                  {' / '}
                  <span className="text-red-500">-{branchInfo.behind}</span>
                </div>
              </div>
            </div>

            {/* Last Commit */}
            <div className="p-3 rounded-md bg-muted/50 border border-border min-w-0 overflow-hidden">
              <div className="text-xs font-medium text-muted-foreground mb-2">Last Commit</div>
              <div className="flex items-start gap-2 min-w-0">
                <GitCommit className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {branchInfo.lastCommit.hash.slice(0, 7)}
                    </span>
                    <span className="text-sm truncate">{branchInfo.lastCommit.message}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{branchInfo.lastCommit.author}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {new Date(branchInfo.lastCommit.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Section */}
            {!showDeleteConfirm ? (
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSwitch}
                  disabled={branchInfo.isCurrent || switching}
                >
                  <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                  {switching ? 'Switching...' : 'Switch Branch'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!canDelete}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete Branch
                </Button>
              </div>
            ) : (
              <div className="pt-3 border-t border-border space-y-3">
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Delete &ldquo;{branchName}&rdquo;?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                {deleteError && (
                  <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-sm">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  {deleteError?.includes('force delete') ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(true)}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Force Delete'}
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(false)}
                      disabled={deleting}
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
