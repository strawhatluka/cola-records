/**
 * PullRequestsTool
 *
 * Pull requests list/detail/create tool for the Tool Box panel.
 * Renders pull requests inline with list → detail → create navigation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { PullRequestDetailModal } from '../pull-requests/PullRequestDetailModal';
import { CreatePullRequestModal } from '../pull-requests/CreatePullRequestModal';
import { ipc } from '../../ipc/client';
import { extractOwnerRepo } from '../../screens/DevelopmentScreen';
import type { Contribution } from '../../../main/ipc/channels';

interface PullRequest {
  number: number;
  title: string;
  url: string;
  state: string;
  merged: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  headBranch: string;
}

interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

type PRView = 'list' | 'detail' | 'create';

interface PullRequestsToolProps {
  contribution: Contribution;
  branches: string[];
  remotes: GitRemote[];
  githubUsername: string;
  onRefreshBranches?: () => void;
}

export function PullRequestsTool({
  contribution,
  branches,
  remotes,
  githubUsername,
  onRefreshBranches,
}: PullRequestsToolProps) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<PRView>('list');
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const isMounted = useRef(true);

  const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
  const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;

  const fetchPullRequests = useCallback(() => {
    if (!parsed) return;

    setLoading(true);
    setError(null);
    ipc
      .invoke('github:list-pull-requests', parsed.owner, parsed.repo, 'all')
      .then((result) => {
        if (isMounted.current) {
          setPullRequests(result);
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : String(err));
          setPullRequests([]);
        }
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });
  }, [parsed?.owner, parsed?.repo]);

  useEffect(() => {
    isMounted.current = true;
    fetchPullRequests();
    return () => {
      isMounted.current = false;
    };
  }, [fetchPullRequests]);

  const handlePRClick = (pr: PullRequest) => {
    setSelectedPR(pr);
    setView('detail');
  };

  const handleBack = () => {
    setSelectedPR(null);
    setView('list');
  };

  const handleDetailClose = () => {
    setSelectedPR(null);
    setView('list');
    fetchPullRequests();
    onRefreshBranches?.();
  };

  const handleCreateClose = () => {
    setView('list');
  };

  const handlePRCreated = () => {
    fetchPullRequests();
    setView('list');
  };

  // Detail view
  if (view === 'detail' && selectedPR && parsed) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium truncate">
            #{selectedPR.number} {selectedPR.title}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <PullRequestDetailModal
            pr={selectedPR}
            owner={parsed.owner}
            repo={parsed.repo}
            githubUsername={githubUsername}
            onClose={handleDetailClose}
            onRefresh={fetchPullRequests}
            canWrite={contribution.type === 'project'}
            inline
          />
        </div>
      </div>
    );
  }

  // Create view
  if (view === 'create' && parsed) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={handleCreateClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">New Pull Request</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CreatePullRequestModal
            open={true}
            owner={parsed.owner}
            repo={parsed.repo}
            localPath={contribution.localPath}
            branches={branches}
            remotes={remotes}
            defaultBranchName={contribution.branchName}
            onClose={handleCreateClose}
            onCreated={handlePRCreated}
            inline
          />
        </div>
      </div>
    );
  }

  // No GitHub repository linked
  if (!parsed) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2 border-b border-border shrink-0">
          <span className="text-sm font-medium">Pull Requests</span>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          No GitHub repository linked to this project
        </p>
      </div>
    );
  }

  // List view — sort user's PRs to the top
  const sortedPRs = [...pullRequests].sort((a, b) => {
    const aIsMine = githubUsername && a.author === githubUsername;
    const bIsMine = githubUsername && b.author === githubUsername;
    if (aIsMine && !bIsMine) return -1;
    if (!aIsMine && bIsMine) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Pull Requests</span>
          {!loading && (
            <span className="text-xs text-muted-foreground">({pullRequests.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={fetchPullRequests} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView('create')} disabled={!parsed}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New PR
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto styled-scroll">
        {loading && pullRequests.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchPullRequests}>
              Retry
            </Button>
          </div>
        ) : pullRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No pull requests found</p>
        ) : (
          <div className="divide-y divide-border">
            {sortedPRs.map((pr) => {
              const status = pr.merged ? 'merged' : pr.state;
              const isMine = githubUsername && pr.author === githubUsername;
              return (
                <div
                  key={pr.number}
                  onClick={() => handlePRClick(pr)}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 cursor-pointer text-xs"
                >
                  <span
                    className={`mt-0.5 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      status === 'merged'
                        ? 'bg-primary/10 text-primary'
                        : status === 'open'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">{pr.title}</span>
                      <span className="text-muted-foreground shrink-0">#{pr.number}</span>
                      {isMine && (
                        <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-medium">
                          submitted
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {pr.headBranch} &middot; {pr.author}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
