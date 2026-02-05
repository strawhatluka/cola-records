/**
 * DevelopmentScreen
 *
 * Embeds a full VS Code instance via code-server running in Docker.
 * State machine: idle → starting → running → error
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ipc } from '../ipc/client';
import type { Contribution } from '../../main/ipc/channels';
import { PullRequestDetailModal } from '../components/pull-requests/PullRequestDetailModal';
import { CreatePullRequestModal } from '../components/pull-requests/CreatePullRequestModal';
import { DevelopmentIssueDetailModal } from '../components/issues/DevelopmentIssueDetailModal';
import { CreateIssueModal } from '../components/issues/CreateIssueModal';

type ScreenState = 'idle' | 'starting' | 'running' | 'error';

interface DevelopmentScreenProps {
  contribution: Contribution;
  onNavigateBack: () => void;
}

type ToolDropdown = 'issues' | 'remotes' | 'pull-requests' | 'tools' | null;

interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

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

export function extractOwnerRepo(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export function DevelopmentScreen({ contribution, onNavigateBack }: DevelopmentScreenProps) {
  const [state, setState] = useState<ScreenState>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<ToolDropdown>(null);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [remotesLoading, setRemotesLoading] = useState(false);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [prsLoading, setPrsLoading] = useState(false);
  const [prsError, setPrsError] = useState<string | null>(null);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const webviewRef = useRef<HTMLWebViewElement>(null);
  const isMounted = useRef(true);
  const hasStarted = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch remotes on mount (needed for PR creation fork detection)
  useEffect(() => {
    if (!contribution.localPath) return;
    setRemotesLoading(true);
    ipc.invoke('git:get-remotes', contribution.localPath)
      .then((result) => {
        if (isMounted.current) setRemotes(result);
      })
      .catch(() => {
        if (isMounted.current) setRemotes([]);
      })
      .finally(() => {
        if (isMounted.current) setRemotesLoading(false);
      });
  }, [contribution.localPath]);

  // Fetch authenticated user on mount
  useEffect(() => {
    ipc.invoke('github:get-authenticated-user')
      .then((user) => {
        if (isMounted.current) setGithubUsername(user.login);
      })
      .catch(() => {
        // Auth user fetch is best-effort
      });
  }, []);

  const fetchPullRequests = useCallback(() => {
    const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
    if (!targetUrl) return;

    const parsed = extractOwnerRepo(targetUrl);
    if (!parsed) return;

    setPrsLoading(true);
    setPrsError(null);
    ipc.invoke('github:list-pull-requests', parsed.owner, parsed.repo, 'all')
      .then((result) => {
        if (isMounted.current) setPullRequests(result);
      })
      .catch((err) => {
        if (isMounted.current) {
          setPrsError(err instanceof Error ? err.message : String(err));
          setPullRequests([]);
        }
      })
      .finally(() => {
        if (isMounted.current) setPrsLoading(false);
      });
  }, [contribution.upstreamUrl, contribution.repositoryUrl]);

  // Fetch pull requests eagerly on mount (for button color) and refresh on dropdown open
  useEffect(() => {
    // Skip if we already have PRs and the dropdown isn't open
    if (pullRequests.length > 0 && activeDropdown !== 'pull-requests') return;

    fetchPullRequests();
  }, [activeDropdown, fetchPullRequests]);

  // Fetch all branches on mount (for issue-button color logic)
  useEffect(() => {
    if (!contribution.localPath) return;
    ipc.invoke('git:get-branches', contribution.localPath)
      .then((result) => {
        if (isMounted.current) setBranches(result);
      })
      .catch(() => {
        // Branch fetch is best-effort
      });
  }, [contribution.localPath]);

  // Check if any of the user's open PRs have a response awaiting action (for orange indicator)
  useEffect(() => {
    if (contribution.type === 'project' || !githubUsername || pullRequests.length === 0) {
      setAwaitingResponse(false);
      return;
    }

    const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
    if (!targetUrl) return;
    const parsed = extractOwnerRepo(targetUrl);
    if (!parsed) return;

    const myOpenPRs = pullRequests.filter(
      (pr) => !pr.merged && pr.state === 'open' && pr.author === githubUsername
    );
    if (myOpenPRs.length === 0) {
      setAwaitingResponse(false);
      return;
    }

    // For each of user's open PRs, check if the latest activity is from someone else
    Promise.all(
      myOpenPRs.map(async (pr) => {
        const [comments, reviews] = await Promise.all([
          ipc.invoke('github:list-pr-comments', parsed.owner, parsed.repo, pr.number),
          ipc.invoke('github:list-pr-reviews', parsed.owner, parsed.repo, pr.number),
        ]);

        // Combine all activity and find the latest from user and from others
        const allActivity = [
          ...comments.map((c: any) => ({ author: c.author, date: new Date(c.updatedAt || c.createdAt).getTime() })),
          ...reviews.map((r: any) => ({ author: r.author, date: new Date(r.submittedAt).getTime() })),
        ];

        const latestFromOther = allActivity
          .filter((a) => a.author !== githubUsername)
          .reduce((max, a) => Math.max(max, a.date), 0);

        const latestFromUser = allActivity
          .filter((a) => a.author === githubUsername)
          .reduce((max, a) => Math.max(max, a.date), 0);

        return latestFromOther > latestFromUser;
      })
    )
      .then((results) => {
        if (isMounted.current) setAwaitingResponse(results.some(Boolean));
      })
      .catch(() => {
        // PR response check is best-effort
      });
  }, [pullRequests, githubUsername, contribution.type, contribution.upstreamUrl, contribution.repositoryUrl]);

  // Reusable function to fetch issues
  const fetchIssues = useCallback(() => {
    const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
    if (!targetUrl) return;

    const parsed = extractOwnerRepo(targetUrl);
    if (!parsed) return;

    setIssuesLoading(true);
    setIssuesError(null);
    ipc.invoke('github:list-issues', parsed.owner, parsed.repo, 'open')
      .then((result) => {
        if (isMounted.current) setIssues(result);
      })
      .catch((err) => {
        if (isMounted.current) {
          setIssuesError(err instanceof Error ? err.message : String(err));
          setIssues([]);
        }
      })
      .finally(() => {
        if (isMounted.current) setIssuesLoading(false);
      });
  }, [contribution.upstreamUrl, contribution.repositoryUrl]);

  // Fetch issues eagerly on mount and refresh when the dropdown opens
  useEffect(() => {
    // Skip if we already have issues and the dropdown isn't open (avoid re-fetch on every render)
    if (issues.length > 0 && activeDropdown !== 'issues') return;

    fetchIssues();
  }, [activeDropdown, fetchIssues]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  const toggleDropdown = (name: ToolDropdown) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const startCodeServer = useCallback(async () => {
    setState('starting');
    setError(null);

    try {
      const result = await ipc.invoke('code-server:start', contribution.localPath);
      if (isMounted.current) {
        setUrl(result.url);
        setState('running');
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    }
  }, [contribution.localPath]);

  const stopAndGoBack = useCallback(async () => {
    try {
      await ipc.invoke('code-server:stop');
    } catch {
      // Stop failure is non-critical — navigating away anyway
    }
    onNavigateBack();
  }, [onNavigateBack]);

  // Auto-start on mount (guarded against React strict mode double-mount)
  useEffect(() => {
    isMounted.current = true;

    if (!hasStarted.current) {
      hasStarted.current = true;
      startCodeServer();
    }

    return () => {
      isMounted.current = false;
      // Cleanup: stop container on unmount
      ipc.invoke('code-server:stop').catch(() => {
        // Cleanup stop failure is non-critical
      });
    };
  }, [startCodeServer]);

  // ── Idle State ───────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Initializing...
      </div>
    );
  }

  // ── Starting State ───────────────────────────────────────────────
  if (state === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Starting VS Code...</p>
        <p className="text-muted-foreground text-xs">
          First launch may be slower while Docker pulls the image.
        </p>
        <button
          onClick={stopAndGoBack}
          className="mt-4 px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 max-w-md mx-auto text-center">
        <div className="text-destructive text-lg font-medium">Failed to start VS Code</div>
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{error}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={startCodeServer}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onNavigateBack}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Running State ────────────────────────────────────────────────

  // Issues button color priority:
  // Green: no open issues on the repo
  // Yellow: open issues exist AND at least one has a branch matching its number
  // Red: open issues exist but NONE have a branch matching their number
  const openIssues = issues.filter((i) => i.state === 'open');
  const hasBranchedIssue = openIssues.length > 0 && openIssues.some((i) =>
    branches.some((b) => new RegExp(`\\b${i.number}\\b`).test(b))
  );
  const issueButtonColor: 'red' | 'yellow' | 'green' =
    openIssues.length === 0 ? 'green'
    : hasBranchedIssue ? 'yellow'
    : 'red';

  // PR button color logic — differs between contributions and projects
  const openPRs = pullRequests.filter((pr) => !pr.merged && pr.state === 'open');
  const prButtonColor: 'red' | 'orange' | 'blue' | 'green' | null = (() => {
    if (contribution.type === 'project') {
      // Projects: green = no open PRs, red = any open PRs
      return openPRs.length === 0 ? 'green' : 'red';
    }
    // Contributions: null = no user PRs, orange = awaiting response, blue = has open PR
    const myOpenPRs = githubUsername
      ? openPRs.filter((pr) => pr.author === githubUsername)
      : [];
    if (myOpenPRs.length === 0) return null;
    if (awaitingResponse) return 'orange';
    return 'blue';
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium truncate max-w-md">
            {contribution.repositoryUrl
              ? contribution.repositoryUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
              : 'Unknown Issue'}
          </span>
          <span className="text-xs text-muted-foreground">
            {contribution.localPath}
          </span>
        </div>
        <div className="flex gap-2" ref={dropdownRef}>
          {(['issues', 'remotes', 'pull-requests', 'tools'] as const).map((name) => (
            <div key={name} className="relative">
              <button
                onClick={() => toggleDropdown(name)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  name === 'issues' && issueButtonColor === 'red'
                    ? activeDropdown === name
                      ? 'border-red-500 bg-red-500 text-white'
                      : 'border-red-500 bg-red-500 text-white hover:bg-red-500/80'
                  : name === 'issues' && issueButtonColor === 'yellow'
                    ? activeDropdown === name
                      ? 'border-yellow-500 bg-yellow-500 text-white'
                      : 'border-yellow-500 bg-yellow-500 text-white hover:bg-yellow-500/80'
                  : name === 'issues' && issueButtonColor === 'green'
                    ? activeDropdown === name
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-green-500 bg-green-500 text-white hover:bg-green-500/80'
                    : name === 'remotes' && contribution.remotesValid
                    ? activeDropdown === name
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-primary bg-primary text-primary-foreground hover:bg-primary/80'
                    : name === 'pull-requests' && prButtonColor === 'red'
                    ? activeDropdown === name
                      ? 'border-red-500 bg-red-500 text-white'
                      : 'border-red-500 bg-red-500 text-white hover:bg-red-500/80'
                  : name === 'pull-requests' && prButtonColor === 'orange'
                    ? activeDropdown === name
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-orange-500 bg-orange-500 text-white hover:bg-orange-500/80'
                  : name === 'pull-requests' && prButtonColor === 'blue'
                    ? activeDropdown === name
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-500/80'
                  : name === 'pull-requests' && prButtonColor === 'green'
                    ? activeDropdown === name
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-green-500 bg-green-500 text-white hover:bg-green-500/80'
                      : activeDropdown === name
                        ? 'border-primary bg-accent'
                        : 'border-border hover:bg-accent'
                }`}
              >
                {name === 'pull-requests' ? 'Pull Requests' : name.charAt(0).toUpperCase() + name.slice(1)}
              </button>
              {activeDropdown === name && name === 'remotes' && (
                <div className="absolute right-0 top-full mt-1 w-80 rounded-md border border-border bg-popover p-4 shadow-lg z-50">
                  <p className="text-sm font-medium mb-3">Remotes</p>
                  {remotesLoading ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : remotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No remotes configured</p>
                  ) : (
                    <div className="space-y-3">
                      {remotes.map((remote) => (
                        <div key={remote.name} className="text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{remote.name}</span>
                            {remote.name === 'origin' && (
                              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                                origin
                              </span>
                            )}
                            {remote.name === 'upstream' && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-medium">
                                upstream
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground break-all pl-2">
                            <span className="text-muted-foreground/60">fetch:</span> {remote.fetchUrl}
                          </div>
                          {remote.pushUrl && remote.pushUrl !== remote.fetchUrl && (
                            <div className="text-muted-foreground break-all pl-2">
                              <span className="text-muted-foreground/60">push:</span> {remote.pushUrl}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeDropdown === name && name === 'pull-requests' && (
                <div className="absolute right-0 top-full mt-1 w-96 rounded-md border border-border bg-popover p-4 shadow-lg z-50 max-h-80 overflow-y-auto styled-scroll">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Pull Requests</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowCreatePR(true); setActiveDropdown(null); }}
                      className="px-2 py-1 text-xs rounded-md border border-border hover:bg-accent transition-colors"
                    >
                      + New PR
                    </button>
                  </div>
                  {prsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : prsError ? (
                    <p className="text-xs text-destructive">{prsError}</p>
                  ) : pullRequests.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No pull requests found</p>
                  ) : (
                    <div className="space-y-2">
                      {[...pullRequests]
                        .sort((a, b) => {
                          // Sort user's own PRs to the top
                          const aIsMine = githubUsername && a.author === githubUsername;
                          const bIsMine = githubUsername && b.author === githubUsername;
                          if (aIsMine && !bIsMine) return -1;
                          if (!aIsMine && bIsMine) return 1;
                          return 0;
                        })
                        .map((pr) => {
                        const status = pr.merged ? 'merged' : pr.state;
                        const isMine = githubUsername && pr.author === githubUsername;
                        return (
                          <div
                            key={pr.number}
                            onClick={() => { setSelectedPR(pr); setActiveDropdown(null); }}
                            className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer text-xs"
                          >
                            <span className={`mt-0.5 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              status === 'merged'
                                ? 'bg-primary/10 text-primary'
                                : status === 'open'
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-muted text-muted-foreground'
                            }`}>
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
              )}
              {activeDropdown === name && name === 'issues' && (
                <div className="absolute right-0 top-full mt-1 w-96 rounded-md border border-border bg-popover p-4 shadow-lg z-50 max-h-80 overflow-y-auto styled-scroll">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Issues</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowCreateIssue(true); setActiveDropdown(null); }}
                      className="px-2 py-1 text-xs rounded-md border border-border hover:bg-accent transition-colors"
                    >
                      + New Issue
                    </button>
                  </div>
                  {issuesLoading ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : issuesError ? (
                    <p className="text-xs text-destructive">{issuesError}</p>
                  ) : issues.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No issues found</p>
                  ) : (
                    <div className="space-y-2">
                      {[...issues]
                        .sort((a, b) => {
                          // Sort branched issues to the top
                          const aBranched = branches.some((br) => new RegExp(`\\b${a.number}\\b`).test(br));
                          const bBranched = branches.some((br) => new RegExp(`\\b${b.number}\\b`).test(br));
                          if (aBranched && !bBranched) return -1;
                          if (!aBranched && bBranched) return 1;
                          return 0; // Keep original order within each group
                        })
                        .map((issue) => {
                        const branchMatches = branches.some((br) => new RegExp(`\\b${issue.number}\\b`).test(br));
                        return (
                          <div
                            key={issue.number}
                            onClick={() => { setSelectedIssue(issue); setActiveDropdown(null); }}
                            className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer text-xs"
                          >
                            <span className={`mt-0.5 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              issue.state === 'open'
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {issue.state}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm truncate">{issue.title}</span>
                                <span className="text-muted-foreground shrink-0">#{issue.number}</span>
                                {branchMatches && (
                                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-medium">
                                    branched
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
              )}
              {activeDropdown === name && name === 'tools' && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-border bg-popover p-4 shadow-lg z-50">
                  <p className="text-sm font-medium mb-1">Tools</p>
                  <p className="text-xs text-muted-foreground">Under construction</p>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={stopAndGoBack}
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            Stop & Back
          </button>
        </div>
      </div>

      {/* VS Code webview */}
      <webview
        ref={webviewRef}
        src={url!}
        style={{ flex: 1, width: '100%', height: '100%' }}
        // @ts-expect-error - webview attributes not in React types
        allowpopups="true"
      />

      {/* PR Detail Modal */}
      {selectedPR && (() => {
        const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
        const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;
        return parsed ? (
          <PullRequestDetailModal
            pr={selectedPR}
            owner={parsed.owner}
            repo={parsed.repo}
            githubUsername={githubUsername}
            onClose={() => setSelectedPR(null)}
          />
        ) : null;
      })()}

      {/* Issue Detail Modal */}
      {selectedIssue && (() => {
        const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
        const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;
        const branchMatches = branches.some((br) => new RegExp(`\\b${selectedIssue.number}\\b`).test(br));
        return parsed ? (
          <DevelopmentIssueDetailModal
            issue={selectedIssue}
            owner={parsed.owner}
            repo={parsed.repo}
            localPath={contribution.localPath}
            isBranched={branchMatches}
            githubUsername={githubUsername}
            onClose={() => { setSelectedIssue(null); fetchIssues(); }}
          />
        ) : null;
      })()}

      {/* Create Issue Modal */}
      {showCreateIssue && (() => {
        const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
        const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;
        return parsed ? (
          <CreateIssueModal
            open={showCreateIssue}
            owner={parsed.owner}
            repo={parsed.repo}
            onClose={() => setShowCreateIssue(false)}
            onCreated={() => fetchIssues()}
          />
        ) : null;
      })()}

      {/* Create PR Modal */}
      {showCreatePR && (() => {
        const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
        const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;
        return parsed ? (
          <CreatePullRequestModal
            open={showCreatePR}
            owner={parsed.owner}
            repo={parsed.repo}
            localPath={contribution.localPath}
            branches={branches}
            remotes={remotes}
            defaultBranchName={contribution.branchName}
            onClose={() => setShowCreatePR(false)}
            onCreated={() => fetchPullRequests()}
          />
        ) : null;
      })()}
    </div>
  );
}
