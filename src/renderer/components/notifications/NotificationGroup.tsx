import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AppNotification } from '../../../main/ipc/channels';
import { NotificationItem } from './NotificationItem';

interface NotificationGroupProps {
  groupKey: string;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClick?: (notification: AppNotification) => void;
}

export function NotificationGroup({
  groupKey,
  notifications,
  onMarkRead,
  onDismiss,
  onClick,
}: NotificationGroupProps) {
  const [expanded, setExpanded] = React.useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Show first notification as representative
  const first = notifications[0];
  if (!first) return null;

  if (notifications.length === 1) {
    return (
      <NotificationItem
        notification={first}
        onMarkRead={onMarkRead}
        onDismiss={onDismiss}
        onClick={onClick}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm truncate flex-1">
          {notifications.length} updates on {groupKey}
        </span>
        {unreadCount > 0 && (
          <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
            {unreadCount}
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-l border-border ml-4">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={onMarkRead}
              onDismiss={onDismiss}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
