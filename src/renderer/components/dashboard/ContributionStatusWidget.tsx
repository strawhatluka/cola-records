import { useState, useEffect, useCallback, useRef } from 'react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';

interface MetricCard {
  label: string;
  count: number;
  colorClass: string;
}

export function ContributionStatusWidget() {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const isMounted = useRef(true);

  const fetchMetrics = useCallback(async () => {
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

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

      const results = await Promise.allSettled([
        ipc.invoke('github:search-issues-and-prs', `author:${username} type:pr is:open`),
        ipc.invoke(
          'github:search-issues-and-prs',
          `author:${username} type:pr is:merged merged:>${dateStr}`
        ),
        ipc.invoke('github:search-issues-and-prs', `assignee:${username} type:issue is:open`),
        ipc.invoke(
          'github:search-issues-and-prs',
          `author:${username} type:issue is:closed closed:>${dateStr}`
        ),
      ]);

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
          return;
        }

        const getCount = (index: number) => {
          const r = results[index];
          return r.status === 'fulfilled' ? r.value.totalCount : 0;
        };

        setMetrics([
          { label: 'Open PRs', count: getCount(0), colorClass: 'bg-blue-500/20 text-blue-400' },
          {
            label: 'Merged PRs (30d)',
            count: getCount(1),
            colorClass: 'bg-green-500/20 text-green-400',
          },
          {
            label: 'Open Issues',
            count: getCount(2),
            colorClass: 'bg-yellow-500/20 text-yellow-400',
          },
          {
            label: 'Closed Issues (30d)',
            count: getCount(3),
            colorClass: 'bg-purple-500/20 text-purple-400',
          },
        ]);
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
    fetchMetrics();
    return () => {
      isMounted.current = false;
    };
  }, [fetchMetrics]);

  return (
    <DashboardWidget
      title="Contribution Status"
      description="Your GitHub activity at a glance"
      loading={loading}
      error={error}
      onRetry={fetchMetrics}
      noToken={noToken}
      empty={metrics.length === 0}
      emptyMessage="No contribution data available"
    >
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex flex-col items-center rounded-md border p-3">
            <span className="text-2xl font-bold">{metric.count}</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${metric.colorClass}`}
            >
              {metric.label}
            </span>
          </div>
        ))}
      </div>
    </DashboardWidget>
  );
}
