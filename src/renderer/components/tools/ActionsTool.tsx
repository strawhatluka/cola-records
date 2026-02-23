/**
 * ActionsTool
 *
 * GitHub Actions workflow runs tool for the Tool Box panel.
 * Renders workflow runs inline with list → run detail → job logs navigation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import { extractOwnerRepo } from '../../screens/DevelopmentScreen';
import type { Contribution } from '../../../main/ipc/channels';

interface WorkflowRun {
  id: number;
  name: string;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  headBranch: string;
  headSha: string;
  event: string;
  runNumber: number;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  actor: string;
  actorAvatarUrl: string;
}

interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string;
  runnerName: string | null;
  labels: string[];
  steps: {
    name: string;
    status: string;
    conclusion: string | null;
    number: number;
  }[];
}

type ActionsView = 'list' | 'run-detail' | 'job-logs';

interface ActionsToolProps {
  contribution: Contribution;
}

function getStatusBadgeClass(status: string, conclusion: string | null): string {
  if (conclusion === 'success') return 'bg-green-500/10 text-green-500';
  if (conclusion === 'failure') return 'bg-red-500/10 text-red-500';
  if (status === 'in_progress' || status === 'queued') return 'bg-yellow-500/10 text-yellow-500';
  if (conclusion === 'cancelled' || conclusion === 'skipped')
    return 'bg-muted text-muted-foreground';
  if (status === 'completed' && !conclusion) return 'bg-muted text-muted-foreground';
  return 'bg-muted text-muted-foreground';
}

function getStatusLabel(status: string, conclusion: string | null): string {
  if (conclusion) return conclusion;
  return status;
}

function getStepDot(conclusion: string | null): string {
  if (conclusion === 'success') return 'bg-green-500';
  if (conclusion === 'failure') return 'bg-red-500';
  if (conclusion === 'skipped') return 'bg-muted-foreground';
  return 'bg-yellow-500';
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function ActionsTool({ contribution }: ActionsToolProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ActionsView>('list');
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<WorkflowJob | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
  const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;

  const fetchRuns = useCallback(() => {
    if (!parsed) return;

    setLoading(true);
    setError(null);
    ipc
      .invoke('github:list-workflow-runs', parsed.owner, parsed.repo)
      .then((result) => {
        if (isMounted.current) {
          setRuns(result);
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : String(err));
          setRuns([]);
        }
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });
  }, [parsed?.owner, parsed?.repo]);

  useEffect(() => {
    isMounted.current = true;
    fetchRuns();
    return () => {
      isMounted.current = false;
    };
  }, [fetchRuns]);

  const handleRunClick = (run: WorkflowRun) => {
    setSelectedRun(run);
    setView('run-detail');
    // Fetch jobs for this run
    if (!parsed) return;
    setJobsLoading(true);
    setJobsError(null);
    ipc
      .invoke('github:list-workflow-run-jobs', parsed.owner, parsed.repo, run.id)
      .then((result) => {
        if (isMounted.current) {
          setJobs(result);
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setJobsError(err instanceof Error ? err.message : String(err));
          setJobs([]);
        }
      })
      .finally(() => {
        if (isMounted.current) setJobsLoading(false);
      });
  };

  const handleJobClick = (job: WorkflowJob) => {
    setSelectedJob(job);
    setView('job-logs');
    // Fetch logs for this job
    if (!parsed) return;
    setLogsLoading(true);
    setLogsError(null);
    ipc
      .invoke('github:get-job-logs', parsed.owner, parsed.repo, job.id)
      .then((result) => {
        if (isMounted.current) {
          // Truncate to last 500 lines if needed
          const lines = result.split('\n');
          if (lines.length > 500) {
            setLogs(`... (truncated ${lines.length - 500} lines)\n` + lines.slice(-500).join('\n'));
          } else {
            setLogs(result);
          }
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setLogsError(err instanceof Error ? err.message : String(err));
          setLogs('');
        }
      })
      .finally(() => {
        if (isMounted.current) setLogsLoading(false);
      });
  };

  const handleBackToList = () => {
    setSelectedRun(null);
    setJobs([]);
    setView('list');
  };

  const handleBackToRunDetail = () => {
    setSelectedJob(null);
    setLogs('');
    setView('run-detail');
  };

  const handleOpenExternal = (url: string) => {
    ipc.invoke('shell:open-external', url);
  };

  // Job Logs View
  if (view === 'job-logs' && selectedJob) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={handleBackToRunDetail}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium truncate">{selectedJob.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => handleOpenExternal(selectedJob.htmlUrl)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            GitHub
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto styled-scroll p-3">
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          ) : logsError ? (
            <div className="text-center py-4">
              <p className="text-sm text-destructive">{logsError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => handleJobClick(selectedJob)}
              >
                Retry
              </Button>
            </div>
          ) : (
            <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {logs || 'No logs available'}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // Run Detail View
  if (view === 'run-detail' && selectedRun) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium truncate">{selectedRun.displayTitle}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => handleOpenExternal(selectedRun.htmlUrl)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            GitHub
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto styled-scroll">
          {/* Run Summary */}
          <div className="px-3 py-3 border-b border-border space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusBadgeClass(selectedRun.status, selectedRun.conclusion)}`}
              >
                {getStatusLabel(selectedRun.status, selectedRun.conclusion)}
              </span>
              <span className="text-xs text-muted-foreground">#{selectedRun.runNumber}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>
                Workflow: <span className="text-foreground">{selectedRun.name}</span>
              </div>
              <div>
                Branch: <span className="text-foreground">{selectedRun.headBranch}</span>
              </div>
              <div>
                Event: <span className="text-foreground">{selectedRun.event}</span>
              </div>
              <div>
                Triggered by: <span className="text-foreground">{selectedRun.actor}</span>
              </div>
              <div>
                SHA:{' '}
                <span className="text-foreground font-mono">{selectedRun.headSha.slice(0, 7)}</span>
              </div>
            </div>
          </div>

          {/* Jobs List */}
          <div className="px-3 py-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Jobs</div>
            {jobsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              </div>
            ) : jobsError ? (
              <div className="text-center py-4">
                <p className="text-sm text-destructive">{jobsError}</p>
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No jobs found</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div key={job.id}>
                    <div
                      onClick={() => handleJobClick(job)}
                      className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 cursor-pointer"
                    >
                      <span
                        className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusBadgeClass(job.status, job.conclusion)}`}
                      >
                        {getStatusLabel(job.status, job.conclusion)}
                      </span>
                      <span className="text-sm flex-1 truncate">{job.name}</span>
                      {job.startedAt && job.completedAt && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDuration(job.startedAt, job.completedAt)}
                        </span>
                      )}
                    </div>
                    {/* Steps */}
                    {job.steps.length > 0 && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {job.steps.map((step) => (
                          <div
                            key={step.number}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${getStepDot(step.conclusion)}`}
                            />
                            <span className="truncate">{step.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No GitHub repository linked
  if (!parsed) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2 border-b border-border shrink-0">
          <span className="text-sm font-medium">Actions</span>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          No GitHub repository linked to this project
        </p>
      </div>
    );
  }

  // List View
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Actions</span>
          {!loading && <span className="text-xs text-muted-foreground">({runs.length})</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchRuns} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto styled-scroll">
        {loading && runs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchRuns}>
              Retry
            </Button>
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No workflow runs found</p>
        ) : (
          <div className="divide-y divide-border">
            {runs.map((run) => (
              <div
                key={run.id}
                onClick={() => handleRunClick(run)}
                className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 cursor-pointer text-xs"
              >
                <span
                  className={`mt-0.5 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusBadgeClass(run.status, run.conclusion)}`}
                >
                  {getStatusLabel(run.status, run.conclusion)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground truncate">{run.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">{run.displayTitle}</span>
                    <span className="text-muted-foreground shrink-0">#{run.runNumber}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {run.headBranch} &middot; {run.event} &middot; {run.actor} &middot;{' '}
                    {formatRelativeTime(run.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
