import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/DropdownMenu';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Separator } from '../../ui/Separator';
import { useGitStore } from '../../../stores/useGitStore';
import { GitStatusSummary } from './GitStatusSummary';
import { GitQuickActions } from './GitQuickActions';
import { GitCommitDialog } from './GitCommitDialog';

interface GitPanelProps {
  repoPath: string;
}

export function GitPanel({ repoPath }: GitPanelProps) {
  const { status, currentBranch, fetchStatus, fetchBranches } = useGitStore();
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  const modifiedCount = status?.files.length || 0;

  useEffect(() => {
    if (repoPath) {
      fetchStatus(repoPath);
      fetchBranches(repoPath);
    }
  }, [repoPath, fetchStatus, fetchBranches]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <span className="font-mono text-sm">
              {currentBranch || 'main'}
            </span>
            {modifiedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {modifiedCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-80" align="end">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">Repository Status</h3>
              <GitStatusSummary status={status} />
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-sm mb-2">Actions</h3>
              <GitQuickActions
                repoPath={repoPath}
                onCommit={() => setShowCommitDialog(true)}
              />
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <GitCommitDialog
        open={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        repoPath={repoPath}
      />
    </>
  );
}
