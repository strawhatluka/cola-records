import { GitPullRequest, CircleDot, Workflow, GitBranch, Monitor, Plug, X } from 'lucide-react';
import type { AppNotification, NotificationCategory } from '../../../main/ipc/channels';

interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClick?: (notification: AppNotification) => void;
}

const CATEGORY_ICONS: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  'github-pr': GitPullRequest,
  'github-issue': CircleDot,
  'github-ci': Workflow,
  git: GitBranch,
  system: Monitor,
  integration: Plug,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onClick,
}: NotificationItemProps) {
  const Icon = CATEGORY_ICONS[notification.category] || Monitor;
  const priorityColor = PRIORITY_COLORS[notification.priority] || 'border-l-border';

  return (
    <div
      className={`flex items-start gap-3 p-3 border-l-2 ${priorityColor} hover:bg-accent/50 cursor-pointer transition-colors ${
        !notification.read ? 'bg-accent/20' : ''
      }`}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id);
        onClick?.(notification);
      }}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate ${!notification.read ? 'font-medium' : ''}`}>
            {notification.title}
          </span>
          {!notification.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{notification.message}</p>
        <span className="text-[10px] text-muted-foreground mt-1 block">
          {formatRelativeTime(notification.timestamp)}
        </span>
      </div>
      <button
        type="button"
        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        title="Dismiss"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}
