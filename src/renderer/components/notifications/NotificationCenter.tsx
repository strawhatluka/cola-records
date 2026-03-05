import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Bell, BellOff, Check, Trash2 } from 'lucide-react';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { NotificationItem } from './NotificationItem';
import { NotificationGroup } from './NotificationGroup';
import type { AppNotification, NotificationCategory } from '../../../main/ipc/channels';

type FilterTab = 'all' | 'unread' | NotificationCategory;

interface NotificationCenterProps {
  onNavigate?: (screen: string, context?: string) => void;
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { notifications, preferences, unreadCount, markAsRead, markAllAsRead, dismiss, clearAll } =
    useNotificationStore();

  const [filter, setFilter] = React.useState<FilterTab>('all');

  const activeNotifications = notifications.filter((n) => !n.dismissed);

  const filtered = React.useMemo(() => {
    switch (filter) {
      case 'all':
        return activeNotifications;
      case 'unread':
        return activeNotifications.filter((n) => !n.read);
      default:
        return activeNotifications.filter((n) => n.category === filter);
    }
  }, [activeNotifications, filter]);

  // Group notifications by groupKey
  const grouped = React.useMemo(() => {
    const groups = new Map<string, AppNotification[]>();
    const ungrouped: AppNotification[] = [];

    for (const n of filtered) {
      if (n.groupKey) {
        const existing = groups.get(n.groupKey) || [];
        existing.push(n);
        groups.set(n.groupKey, existing);
      } else {
        ungrouped.push(n);
      }
    }

    return { groups, ungrouped };
  }, [filtered]);

  const handleClick = (notification: AppNotification) => {
    if (notification.actionScreen && onNavigate) {
      onNavigate(notification.actionScreen, notification.actionContext);
    }
  };

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
  ];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
          title={preferences.dndEnabled ? 'Notifications (Do Not Disturb)' : 'Notifications'}
        >
          {preferences.dndEnabled ? (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[380px] rounded-lg border bg-background shadow-lg"
          sideOffset={8}
          align="end"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 border-b px-3 py-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
                {tab.id === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto styled-scroll">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <>
                {/* Render grouped notifications */}
                {Array.from(grouped.groups.entries()).map(([key, items]) => (
                  <NotificationGroup
                    key={key}
                    groupKey={key}
                    notifications={items}
                    onMarkRead={markAsRead}
                    onDismiss={dismiss}
                    onClick={handleClick}
                  />
                ))}
                {/* Render ungrouped notifications */}
                {grouped.ungrouped.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={markAsRead}
                    onDismiss={dismiss}
                    onClick={handleClick}
                  />
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          {activeNotifications.length > 0 && (
            <div className="flex items-center justify-center border-t px-4 py-2">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={clearAll}
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
