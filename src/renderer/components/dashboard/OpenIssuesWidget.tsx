import { useState, useEffect, useCallback, useRef } from 'react';
import { Folder } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';
import { Button } from '../ui/Button';
import { formatRelativeTime } from './utils';

interface IssueData {
  number: number;
  title: string;
  repoName: string;
  labels: string[];
  createdAt: string;
}

interface OpenIssuesWidgetProps {
  onOpenProject?: (repoFullName: string) => void;
}

export function OpenIssuesWidget({ onOpenProject }: OpenIssuesWidgetProps) {
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

      const [assignedResult, authoredResult] = await Promise.allSettled([
        ipc.invoke('github:search-issues-and-prs', `assignee:${username} type:issue is:open`),
        ipc.invoke('github:search-issues-and-prs', `author:${username} type:issue is:open`),
      ]);

      const assignedItems = assignedResult.status === 'fulfilled' ? assignedResult.value.items : [];
      const authoredItems = authoredResult.status === 'fulfilled' ? authoredResult.value.items : [];

      // Merge and deduplicate by repoFullName + number
      const seen = new Set<string>();
      const merged: IssueData[] = [];
      for (const item of [...assignedItems, ...authoredItems]) {
        const key = `${item.repoFullName}#${item.number}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push({
            number: item.number,
            title: item.title,
            repoName: item.repoFullName,
            labels: item.labels,
            createdAt: item.createdAt,
          });
        }
      }

      // Sort by createdAt descending (newest first), limit to 10
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (isMounted.current) {
        setIssues(merged.slice(0, 10));
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
      description="Issues you're assigned to or authored across GitHub"
      loading={loading}
      error={error}
      onRetry={fetchIssues}
      noToken={noToken}
      empty={issues.length === 0}
      emptyMessage="No open issues found"
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
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(issue.createdAt)}
              </span>
              {onOpenProject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenProject(issue.repoName)}
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
