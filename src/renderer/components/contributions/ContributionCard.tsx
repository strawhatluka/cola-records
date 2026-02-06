import {
  Folder,
  GitBranch,
  Trash2,
  ExternalLink,
  GitFork,
  CheckCircle,
  XCircle,
  GitPullRequest,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusBadge } from './StatusBadge';
import { ipc } from '../../ipc/client';
import type { Contribution } from '../../../main/ipc/channels';
import * as React from 'react';

/**
 * Get PR badge styling based on contribution type and PR status.
 * Matches the PR button color logic from DevelopmentScreen:
 * - Projects: red = has open PRs (needs attention)
 * - Contributions: blue = has open PR (in progress)
 */
function getPRBadgeStyles(contribution: Contribution): {
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (!contribution.prStatus) return { variant: 'outline' };

  if (contribution.prStatus === 'merged') {
    return { variant: 'default' }; // Purple - default theme color
  }

  if (contribution.prStatus === 'closed') {
    return { variant: 'outline' }; // Gray outline
  }

  // prStatus === 'open'
  if (contribution.type === 'project') {
    // Projects: red = has open PRs (needs attention)
    return {
      className: 'bg-red-500 text-white border-red-500 hover:bg-red-500/80',
    };
  }

  // Contributions: blue = has open PR (in progress)
  return {
    className: 'bg-blue-500 text-white border-blue-500 hover:bg-blue-500/80',
  };
}

interface ContributionCardProps {
  contribution: Contribution;
  onDelete: (id: string) => void;
  onOpenProject: (contribution: Contribution) => void;
}

export function ContributionCard({ contribution, onDelete, onOpenProject }: ContributionCardProps) {
  const [syncing, setSyncing] = React.useState(false);
  const [branches, setBranches] = React.useState<string[]>([contribution.branchName]);
  const [loadingBranches, setLoadingBranches] = React.useState(false);
  const repoName = contribution.repositoryUrl
    .split('/')
    .slice(-1)[0]
    .replace(/\.git$/, '');

  // Extract owner/repo from repository URL
  const getRepoInfo = (url: string) => {
    const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(?:\.git)?$/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return url;
  };

  // Fetch all branches for this repository
  React.useEffect(() => {
    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const allBranches = await ipc.invoke('git:get-branches', contribution.localPath);
        setBranches(allBranches);
      } catch {
        // Silently fall back to showing just the current branch if directory doesn't exist
        setBranches([contribution.branchName]);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [contribution.localPath, contribution.branchName]);

  const handleSyncPRStatus = async () => {
    setSyncing(true);
    try {
      await ipc.invoke('contribution:sync-with-github', contribution.id);
      // Trigger a refresh of the contributions list
      window.location.reload();
    } catch {
      alert('Failed to sync PR status. Make sure your GitHub token is valid.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete the contribution for ${repoName}?`)) {
      onDelete(contribution.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{repoName}</CardTitle>
            <CardDescription className="mt-1">
              {getRepoInfo(contribution.repositoryUrl)}
            </CardDescription>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              <StatusBadge status={contribution.status} />

              {/* Fork Status Badge */}
              {contribution.isFork !== undefined && (
                <Badge variant={contribution.isFork ? 'secondary' : 'outline'}>
                  <GitFork className="h-3 w-3 mr-1" />
                  {contribution.isFork ? 'Fork' : 'Not a Fork'}
                </Badge>
              )}

              {/* Remote Validation Badge */}
              {contribution.isFork && contribution.remotesValid !== undefined && (
                <Badge variant={contribution.remotesValid ? 'default' : 'destructive'}>
                  {contribution.remotesValid ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {contribution.remotesValid ? 'Remotes Valid' : 'Remotes Invalid'}
                </Badge>
              )}

              {/* PR Status Badge - color matches PR button logic from DevelopmentScreen */}
              {contribution.prStatus && (
                <Badge
                  variant={getPRBadgeStyles(contribution).variant}
                  className={getPRBadgeStyles(contribution).className}
                >
                  <GitPullRequest className="h-3 w-3 mr-1" />
                  PR #{contribution.prNumber} - {contribution.prStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 text-muted-foreground">
            <GitBranch className="h-4 w-4 mt-1" />
            <div className="flex-1">
              {loadingBranches ? (
                <span className="text-xs">Loading branches...</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {branches.map((branch) => (
                    <code
                      key={branch}
                      className={`bg-muted px-2 py-1 rounded text-xs ${
                        branch === contribution.branchName
                          ? 'bg-primary text-primary-foreground'
                          : ''
                      }`}
                    >
                      {branch}
                    </code>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Folder className="h-4 w-4" />
            <span className="truncate">{contribution.localPath}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenProject(contribution)}
            className="flex-1"
          >
            <Folder className="h-4 w-4 mr-2" />
            Open Project
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ipc.invoke('shell:open-external', contribution.repositoryUrl)}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View on GitHub
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncPRStatus}
            disabled={syncing}
            title="Sync PR status with GitHub"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Created {new Date(contribution.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}
