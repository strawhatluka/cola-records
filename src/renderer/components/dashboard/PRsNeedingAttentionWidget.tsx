import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Clock, CircleDot, Folder } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';
import { Button } from '../ui/Button';
import { CI_STATUS_DOT_COLORS } from './utils';

interface PRData {
  title: string;
  prNumber: number;
  repoName: string;
  reviewState: 'approved' | 'changes_requested' | 'pending';
  ciStatus: 'success' | 'failure' | 'pending';
}

interface PRsNeedingAttentionWidgetProps {
  onOpenProject?: (repoFullName: string) => void;
}

export function PRsNeedingAttentionWidget({ onOpenProject }: PRsNeedingAttentionWidgetProps) {
  const [prs, setPrs] = useState<PRData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const isMounted = useRef(true);

  const fetchPRData = useCallback(async () => {
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
        `involves:${username} type:pr is:open`
      );

      const items = searchResult.items.slice(0, 10);
      if (items.length === 0) {
        if (isMounted.current) {
          setPrs([]);
        }
        return;
      }

      const results = await Promise.allSettled(
        items.map(async (item) => {
          const [owner, repo] = item.repoFullName.split('/');

          const [reviewsResult, ciResult] = await Promise.allSettled([
            ipc.invoke('github:list-pr-reviews', owner, repo, item.number),
            ipc
              .invoke('github:get-pull-request', owner, repo, item.number)
              .then((pr) => ipc.invoke('github:get-pr-check-status', owner, repo, pr.headSha)),
          ]);

          const reviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value : [];
          const ci = ciResult.status === 'fulfilled' ? ciResult.value : null;

          let reviewState: PRData['reviewState'] = 'pending';
          if (reviews.length > 0) {
            const hasChangesRequested = reviews.some(
              (r: { state: string }) => r.state === 'CHANGES_REQUESTED'
            );
            const hasApproval = reviews.some((r: { state: string }) => r.state === 'APPROVED');
            if (hasChangesRequested) reviewState = 'changes_requested';
            else if (hasApproval) reviewState = 'approved';
          }

          let ciStatus: PRData['ciStatus'] = 'pending';
          if (ci) {
            if (ci.state === 'success') ciStatus = 'success';
            else if (ci.state === 'failure') ciStatus = 'failure';
          }

          return {
            title: item.title,
            prNumber: item.number,
            repoName: item.repoFullName,
            reviewState,
            ciStatus,
          } as PRData;
        })
      );

      if (isMounted.current) {
        const prData = results
          .filter(
            (r): r is PromiseFulfilledResult<PRData> => r.status === 'fulfilled' && r.value !== null
          )
          .map((r) => r.value);
        setPrs(prData);
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
    fetchPRData();
    return () => {
      isMounted.current = false;
    };
  }, [fetchPRData]);

  const ReviewIcon = ({ state }: { state: PRData['reviewState'] }) => {
    switch (state) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'changes_requested':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-400" />;
    }
  };

  return (
    <DashboardWidget
      title="PRs Needing Attention"
      description="Review and CI status for PRs you're involved in"
      loading={loading}
      error={error}
      onRetry={fetchPRData}
      noToken={noToken}
      empty={prs.length === 0}
      emptyMessage="No open PRs needing attention"
    >
      <div className="space-y-3">
        {prs.map((pr) => (
          <div key={pr.prNumber} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{pr.title}</p>
              <p className="text-xs text-muted-foreground">
                {pr.repoName} #{pr.prNumber}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ReviewIcon state={pr.reviewState} />
              <CircleDot
                className={`h-4 w-4 ${CI_STATUS_DOT_COLORS[pr.ciStatus] || 'text-muted-foreground'}`}
              />
              {onOpenProject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenProject(pr.repoName)}
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
