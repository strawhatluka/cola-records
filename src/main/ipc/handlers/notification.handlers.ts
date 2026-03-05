/**
 * Notification IPC Handlers
 *
 * Registers handlers for: notification:*
 */
import { handleIpc } from '../handlers';
import { database } from '../../database';
import type { NotificationPreferences } from '../channels';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  toastsEnabled: true,
  nativeEnabled: true,
  soundEnabled: false,
  dndEnabled: false,
  pollInterval: 5,
  categories: {
    'github-pr': { enabled: true, toast: true, native: true },
    'github-issue': { enabled: true, toast: true, native: true },
    'github-ci': { enabled: true, toast: true, native: true },
    git: { enabled: true, toast: true, native: false },
    system: { enabled: true, toast: true, native: false },
    integration: { enabled: true, toast: true, native: false },
  },
};

function getPreferences(): NotificationPreferences {
  const json = database.getSetting('notificationPreferences');
  if (json) {
    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(json) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }
  return DEFAULT_PREFERENCES;
}

export function setupNotificationHandlers(): void {
  handleIpc('notification:add', async (_event, notification) => {
    database.addNotification(notification);
  });

  handleIpc('notification:get-all', async (_event, limit, offset) => {
    return database.getNotifications(limit ?? 300, offset ?? 0);
  });

  handleIpc('notification:mark-read', async (_event, id) => {
    database.markNotificationRead(id);
  });

  handleIpc('notification:mark-all-read', async () => {
    database.markAllNotificationsRead();
  });

  handleIpc('notification:dismiss', async (_event, id) => {
    database.dismissNotification(id);
  });

  handleIpc('notification:clear-all', async () => {
    database.clearAllNotifications();
  });

  handleIpc('notification:get-preferences', async () => {
    return getPreferences();
  });

  handleIpc('notification:update-preferences', async (_event, updates) => {
    const current = getPreferences();
    const merged: NotificationPreferences = {
      ...current,
      ...updates,
      categories: {
        ...current.categories,
        ...(updates.categories || {}),
      },
    };
    database.setSetting('notificationPreferences', JSON.stringify(merged));
    return merged;
  });

  handleIpc('notification:get-unread-count', async () => {
    return database.getUnreadNotificationCount();
  });
}
