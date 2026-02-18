import { useState, useEffect, useCallback, useRef } from 'react';
import { Folder } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';
import { Button } from '../ui/Button';
import { formatRelativeTime, CI_STATUS_DOT_COLORS } from './utils';

interface PipelineData {
  repoName: string;
  workflowName: string;
  conclusion: string;
  createdAt: string;
  htmlUrl: string;
}

interface CICDStatusWidgetProps {
  onOpenProject?: (repoFullName: string) => void;
}

export function CICDStatusWidget({ onOpenProject }: CICDStatusWidgetProps) {
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const isMounted = useRef(true);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoToken(false);

    try {
      let repos: { fullName: string }[];
      try {
        const userRepos = await ipc.invoke('github:list-user-repos');
        repos = userRepos.map((r) => ({ fullName: r.fullName }));
      } catch {
        if (isMounted.current) setNoToken(true);
        return;
      }

      if (repos.length === 0) {
        if (isMounted.current) setPipelines([]);
        return;
      }

      const results = await Promise.allSettled(
        repos.map(async ({ fullName }) => {
          const [owner, repo] = fullName.split('/');
          const runs = await ipc.invoke('github:list-workflow-runs', owner, repo);
          if (!runs || runs.length === 0) return null;
          const latest = runs[0];
          return {
            repoName: fullName,
            workflowName: latest.name,
            conclusion: latest.conclusion || latest.status || 'pending',
            createdAt: latest.createdAt,
            htmlUrl: latest.htmlUrl,
          } as PipelineData;
        })
      );

      if (isMounted.current) {
        const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (rejected.length === results.length) {
          const msg =
            rejected[0].reason instanceof Error
              ? rejected[0].reason.message
              : String(rejected[0].reason);
          if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('auth')) {
            setNoToken(true);
          } else {
            setError(msg);
          }
        } else {
          const data = results
            .filter(
              (r): r is PromiseFulfilledResult<PipelineData> =>
                r.status === 'fulfilled' && r.value !== null
            )
            .map((r) => r.value);
          data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setPipelines(data.slice(0, 10));
        }
      }
    } catch (err) {
      if (isMounted.current) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('auth')) {
          setNoToken(true);
        } else {
          setError(msg);
        }
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchPipelines();
    return () => {
      isMounted.current = false;
    };
  }, [fetchPipelines]);

  return (
    <DashboardWidget
      title="CI/CD Status"
      description="Latest pipeline runs per repo"
      loading={loading}
      error={error}
      onRetry={fetchPipelines}
      noToken={noToken}
      empty={pipelines.length === 0}
      emptyMessage="No CI/CD pipelines found"
    >
      <div className="space-y-3">
        {pipelines.map((p) => (
          <div key={p.repoName} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${CI_STATUS_DOT_COLORS[p.conclusion] || 'bg-muted-foreground'}`}
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{p.repoName}</p>
                <p className="text-xs text-muted-foreground truncate">{p.workflowName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(p.createdAt)}
              </span>
              {onOpenProject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenProject(p.repoName)}
                  title="Open in Cola Records"
                  className="h-7 px-2 text-xs"
                >
                  <Folder className="h-3.5 w-3.5 mr-1" />
                  Open
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardWidget>
  );
}
