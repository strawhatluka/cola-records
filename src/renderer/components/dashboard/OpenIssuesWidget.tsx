import { useState, useEffect, useCallback, useRef } from 'react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';
import { formatRelativeTime } from './utils';

interface IssueData {
  number: number;
  title: string;
  repoName: string;
  labels: string[];
  createdAt: string;
}

export function OpenIssuesWidget() {
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const isMounted = useRef(true);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoToken(false);

    try {
      let username: string;
      try {
        const user = await ipc.invoke('github:get-authenticated-user');
        username = user.login;
      } catch {
        if (isMounted.current) setNoToken(true);
        return;
      }

      const searchResult = await ipc.invoke(
        'github:search-issues-and-prs',
        `assignee:${username} type:issue is:open`
      );

      if (isMounted.current) {
        setIssues(
          searchResult.items.slice(0, 10).map((item) => ({
            number: item.number,
            title: item.title,
            repoName: item.repoFullName,
            labels: item.labels,
            createdAt: item.createdAt,
          }))
        );
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchIssues();
    return () => {
      isMounted.current = false;
    };
  }, [fetchIssues]);

  return (
    <DashboardWidget
      title="Open Issues"
      description="Issues assigned to you across GitHub"
      loading={loading}
      error={error}
      onRetry={fetchIssues}
      noToken={noToken}
      empty={issues.length === 0}
      emptyMessage="No assigned issues found"
    >
      <div className="space-y-3">
        {issues.map((issue) => (
          <div
            key={`${issue.repoName}-${issue.number}`}
            className="flex items-start justify-between gap-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{issue.title}</p>
              <p className="text-xs text-muted-foreground">
                {issue.repoName} #{issue.number}
              </p>
              {issue.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {issue.labels.slice(0, 3).map((label) => (
                    <span key={label} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeTime(issue.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </DashboardWidget>
  );
}
