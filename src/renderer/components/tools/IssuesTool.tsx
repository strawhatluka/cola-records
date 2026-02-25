/**
 * IssuesTool
 *
 * Issues list/detail/create tool for the Tool Box panel.
 * Renders issues inline with list → detail → create navigation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { DevelopmentIssueDetailModal } from '../issues/DevelopmentIssueDetailModal';
import { CreateIssueModal } from '../issues/CreateIssueModal';
import { ipc } from '../../ipc/client';
import { extractOwnerRepo } from '../../screens/DevelopmentScreen';
import type { Contribution, SubIssue } from '../../../main/ipc/channels';

interface Issue {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  author: string;
  authorAvatarUrl: string;
}

type IssuesView = 'list' | 'detail' | 'create';

interface IssuesToolProps {
  contribution: Contribution;
  branches: string[];
  githubUsername: string;
  onRefreshBranches?: () => void;
}

export function IssuesTool({
  contribution,
  branches,
  githubUsername,
  onRefreshBranches,
}: IssuesToolProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<IssuesView>('list');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [parentIssueContext, setParentIssueContext] = useState<{
    number: number;
    title: string;
  } | null>(null);
  const [inheritedBranchedNumbers, setInheritedBranchedNumbers] = useState<Set<number>>(new Set());
  const [primaryIssueNumbers, setPrimaryIssueNumbers] = useState<Set<number>>(new Set());
  const isMounted = useRef(true);

  const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
  const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;

  const isBranchedByNumber = useCallback(
    (issueNumber: number) => branches.some((br) => new RegExp(`\\b${issueNumber}\\b`).test(br)),
    [branches]
  );

  const fetchIssues = useCallback(() => {
    if (!parsed) return;

    setLoading(true);
    setError(null);
    ipc
      .invoke('github:list-issues', parsed.owner, parsed.repo, 'open')
      .then((result) => {
        if (isMounted.current) {
          setIssues(result);
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : String(err));
          setIssues([]);
        }
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });
  }, [parsed?.owner, parsed?.repo]);

  useEffect(() => {
    isMounted.current = true;
    fetchIssues();
    return () => {
      isMounted.current = false;
    };
  }, [fetchIssues]);

  // Fetch sub-issues for branched issues to build inherited + primary sets
  useEffect(() => {
    if (!parsed || issues.length === 0) {
      setInheritedBranchedNumbers(new Set());
      setPrimaryIssueNumbers(new Set());
      return;
    }

    const branchedIssues = issues.filter((i) => isBranchedByNumber(i.number));
    if (branchedIssues.length === 0) {
      setInheritedBranchedNumbers(new Set());
      setPrimaryIssueNumbers(new Set());
      return;
    }

    let cancelled = false;

    Promise.all(
      branchedIssues.map((i) =>
        ipc
          .invoke('github:list-sub-issues', parsed.owner, parsed.repo, i.number)
          .catch((): SubIssue[] => [])
          .then((subs) => ({ parentNumber: i.number, subs }))
      )
    ).then((results) => {
      if (cancelled) return;
      const inherited = new Set<number>();
      const primary = new Set<number>();
      for (const { parentNumber, subs } of results) {
        if (subs.length > 0) {
          primary.add(parentNumber);
          for (const sub of subs) {
            inherited.add(sub.number);
          }
        }
      }
      setInheritedBranchedNumbers(inherited);
      setPrimaryIssueNumbers(primary);
    });

    return () => {
      cancelled = true;
    };
  }, [issues, parsed?.owner, parsed?.repo, isBranchedByNumber]);

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue);
    setParentIssueContext(null);
    setView('detail');
  };

  const handleNavigateToIssue = (
    issueNumber: number,
    parentContext?: { number: number; title: string }
  ) => {
    // Check if the issue is already in our list
    const found = issues.find((i) => i.number === issueNumber);
    if (found) {
      setSelectedIssue(found);
    } else {
      // Create a stub issue object for navigation — the detail modal fetches full data
      setSelectedIssue({
        number: issueNumber,
        title: '',
        body: '',
        url: '',
        state: 'open',
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        author: '',
        authorAvatarUrl: '',
      });
    }
    setParentIssueContext(parentContext ?? null);
    setView('detail');
  };

  const handleBack = () => {
    setSelectedIssue(null);
    setParentIssueContext(null);
    setView('list');
  };

  const handleDetailClose = () => {
    setSelectedIssue(null);
    setParentIssueContext(null);
    setView('list');
    fetchIssues();
    onRefreshBranches?.();
  };

  const handleCreateClose = () => {
    setView('list');
  };

  const handleIssueCreated = () => {
    fetchIssues();
    setView('list');
  };

  // Detail view
  if (view === 'detail' && selectedIssue && parsed) {
    const directBranch = isBranchedByNumber(selectedIssue.number);
    const inherited = inheritedBranchedNumbers.has(selectedIssue.number);
    const badgeType = directBranch
      ? primaryIssueNumbers.has(selectedIssue.number)
        ? ('Primary' as const)
        : ('branched' as const)
      : inherited
        ? ('Secondary' as const)
        : undefined;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium truncate">
            #{selectedIssue.number} {selectedIssue.title}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <DevelopmentIssueDetailModal
            issue={selectedIssue}
            owner={parsed.owner}
            repo={parsed.repo}
            localPath={contribution.localPath}
            branchBadge={badgeType}
            githubUsername={githubUsername}
            onClose={handleDetailClose}
            inline
            onNavigateToIssue={handleNavigateToIssue}
            parentIssue={parentIssueContext ?? undefined}
            branches={branches}
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
          <span className="text-sm font-medium">New Issue</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CreateIssueModal
            open={true}
            owner={parsed.owner}
            repo={parsed.repo}
            onClose={handleCreateClose}
            onCreated={handleIssueCreated}
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
          <span className="text-sm font-medium">Issues</span>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          No GitHub repository linked to this project
        </p>
      </div>
    );
  }

  // List view
  const sortedIssues = [...issues].sort((a, b) => {
    const aBranched = isBranchedByNumber(a.number) || inheritedBranchedNumbers.has(a.number);
    const bBranched = isBranchedByNumber(b.number) || inheritedBranchedNumbers.has(b.number);
    if (aBranched && !bBranched) return -1;
    if (!aBranched && bBranched) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Issues</span>
          {!loading && <span className="text-xs text-muted-foreground">({issues.length})</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={fetchIssues} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView('create')} disabled={!parsed}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Issue
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto styled-scroll">
        {loading && issues.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchIssues}>
              Retry
            </Button>
          </div>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No issues found</p>
        ) : (
          <div className="divide-y divide-border">
            {sortedIssues.map((issue) => {
              const directBranch = isBranchedByNumber(issue.number);
              const isPrimary = directBranch && primaryIssueNumbers.has(issue.number);
              const inherited = !directBranch && inheritedBranchedNumbers.has(issue.number);
              return (
                <div
                  key={issue.number}
                  onClick={() => handleIssueClick(issue)}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 cursor-pointer text-xs"
                >
                  <span
                    className={`mt-0.5 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      issue.state === 'open'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {issue.state}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">{issue.title}</span>
                      <span className="text-muted-foreground shrink-0">#{issue.number}</span>
                      {directBranch && (
                        <span
                          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isPrimary
                              ? 'bg-purple-500/10 text-purple-400'
                              : 'bg-blue-500/10 text-blue-500'
                          }`}
                        >
                          {isPrimary ? 'Primary' : 'branched'}
                        </span>
                      )}
                      {inherited && (
                        <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[10px] font-medium">
                          Secondary
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {issue.author}
                      {issue.labels.length > 0 && (
                        <span> &middot; {issue.labels.slice(0, 3).join(', ')}</span>
                      )}
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
