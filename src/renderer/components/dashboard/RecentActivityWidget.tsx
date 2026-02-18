import { useState, useEffect, useCallback, useRef } from 'react';
import { GitCommit, GitPullRequest, CircleDot, Tag, GitBranch } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';
import { formatRelativeTime } from './utils';

interface EventData {
  id: string;
  type: string;
  repoName: string;
  createdAt: string;
  description: string;
}

function formatEvent(event: {
  type: string;
  repoName: string;
  action: string;
  commitCount: number;
  prTitle: string;
  prNumber: number | null;
  issueTitle: string;
  issueNumber: number | null;
  refType: string;
  ref: string;
}): string {
  switch (event.type) {
    case 'PushEvent':
      return `Pushed ${event.commitCount} commit${event.commitCount !== 1 ? 's' : ''}`;
    case 'PullRequestEvent':
      return `${capitalize(event.action)} PR #${event.prNumber}`;
    case 'IssuesEvent':
      return `${capitalize(event.action)} issue #${event.issueNumber}`;
    case 'CreateEvent':
      return `Created ${event.refType}${event.ref ? ` ${event.ref}` : ''}`;
    case 'DeleteEvent':
      return `Deleted ${event.refType}${event.ref ? ` ${event.ref}` : ''}`;
    case 'WatchEvent':
      return 'Starred repo';
    case 'ForkEvent':
      return 'Forked repo';
    case 'IssueCommentEvent':
      return `Commented on #${event.issueNumber}`;
    case 'PullRequestReviewEvent':
      return `Reviewed PR #${event.prNumber}`;
    case 'ReleaseEvent':
      return `${capitalize(event.action)} release`;
    default:
      return event.type.replace(/Event$/, '');
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'PushEvent':
      return <GitCommit className="h-3.5 w-3.5 text-green-400 shrink-0" />;
    case 'PullRequestEvent':
    case 'PullRequestReviewEvent':
      return <GitPullRequest className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
    case 'CreateEvent':
    case 'DeleteEvent':
      return <GitBranch className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case 'ReleaseEvent':
      return <Tag className="h-3.5 w-3.5 text-yellow-400 shrink-0" />;
    default:
      return <CircleDot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

export function RecentActivityWidget() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const isMounted = useRef(true);

  const fetchEvents = useCallback(async () => {
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

      const rawEvents = await ipc.invoke('github:list-user-events', username, 30);

      if (isMounted.current) {
        setEvents(
          rawEvents.slice(0, 10).map((event) => ({
            id: event.id,
            type: event.type,
            repoName: event.repoName,
            createdAt: event.createdAt,
            description: formatEvent(event),
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
    fetchEvents();
    return () => {
      isMounted.current = false;
    };
  }, [fetchEvents]);

  return (
    <DashboardWidget
      title="Recent Activity"
      description="Your latest GitHub events"
      loading={loading}
      error={error}
      onRetry={fetchEvents}
      noToken={noToken}
      empty={events.length === 0}
      emptyMessage="No recent activity"
    >
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <EventIcon type={event.type} />
              <div className="min-w-0">
                <p className="truncate">{event.description}</p>
                <p className="text-xs text-muted-foreground truncate">{event.repoName}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeTime(event.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </DashboardWidget>
  );
}
