import { create } from 'zustand';
import { toast } from 'sonner';
import { ipc } from '../ipc/client';
import { createLogger } from '../utils/logger';
import type {
  AppNotification,
  NotificationCategory,
  NotificationPreferences,
  NotificationPriority,
} from '../../main/ipc/channels';

const logger = createLogger('NotificationStore');

const MAX_IN_MEMORY = 300;

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

interface NotificationState {
  notifications: AppNotification[];
  preferences: NotificationPreferences;
  unreadCount: number;
  loading: boolean;

  // Actions
  addNotification: (
    notification: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'dismissed'>
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  fetchNotifications: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  _initializeListeners: () => () => void;
}

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function priorityToToastType(
  priority: NotificationPriority
): 'success' | 'info' | 'warning' | 'error' {
  switch (priority) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  preferences: DEFAULT_PREFERENCES,
  unreadCount: 0,
  loading: false,

  addNotification: (partial) => {
    const { preferences, notifications } = get();

    // Check if notifications are globally enabled
    if (!preferences.enabled) return;

    // Check category preference
    const categoryPref = preferences.categories[partial.category];
    if (categoryPref && !categoryPref.enabled) return;

    // Dedup check
    if (partial.dedupeKey && notifications.some((n) => n.dedupeKey === partial.dedupeKey)) {
      return;
    }

    const notification: AppNotification = {
      ...partial,
      id: generateId(),
      timestamp: Date.now(),
      read: false,
      dismissed: false,
    };

    // Add to store (cap at MAX_IN_MEMORY)
    set((state) => {
      const updated = [notification, ...state.notifications].slice(0, MAX_IN_MEMORY);
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read && !n.dismissed).length,
      };
    });

    // Fire toast if enabled and not DND
    if (
      preferences.toastsEnabled &&
      !preferences.dndEnabled &&
      (!categoryPref || categoryPref.toast)
    ) {
      const toastType = priorityToToastType(notification.priority);
      toast[toastType](notification.title, {
        description: notification.message,
        duration: notification.priority === 'high' ? 8000 : 4000,
      });
    }

    // Play sound if enabled and not DND
    if (preferences.soundEnabled && !preferences.dndEnabled) {
      try {
        const audio = new Audio('notification.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Audio play failed (e.g., no user interaction yet)
        });
      } catch {
        // Audio not available
      }
    }

    // Persist to DB (fire-and-forget)
    ipc.invoke('notification:add', notification).catch(() => {});

    logger.info(`Notification added: [${notification.category}] ${notification.title}`);
  },

  markAsRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read && !n.dismissed).length,
      };
    });
    ipc.invoke('notification:mark-read', id).catch(() => {});
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    ipc.invoke('notification:mark-all-read').catch(() => {});
  },

  dismiss: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) => (n.id === id ? { ...n, dismissed: true } : n));
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read && !n.dismissed).length,
      };
    });
    ipc.invoke('notification:dismiss', id).catch(() => {});
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
    ipc.invoke('notification:clear-all').catch(() => {});
  },

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const notifications = await ipc.invoke('notification:get-all', MAX_IN_MEMORY, 0);
      set({
        notifications,
        unreadCount: notifications.filter((n: AppNotification) => !n.read && !n.dismissed).length,
        loading: false,
      });
    } catch (error) {
      logger.error('Failed to fetch notifications:', error);
      set({ loading: false });
    }
  },

  fetchPreferences: async () => {
    try {
      const preferences = await ipc.invoke('notification:get-preferences');
      set({ preferences });
    } catch (error) {
      logger.error('Failed to fetch notification preferences:', error);
    }
  },

  updatePreferences: async (updates) => {
    try {
      const merged = await ipc.invoke('notification:update-preferences', updates);
      set({ preferences: merged });
    } catch (error) {
      logger.error('Failed to update notification preferences:', error);
      throw error;
    }
  },

  _initializeListeners: () => {
    // Listen for notifications pushed from main process
    const removePush = ipc.on('notification:push', (...args: unknown[]) => {
      const notification = args[0] as AppNotification;
      const { preferences, notifications } = get();

      if (!preferences.enabled) return;

      const categoryPref = preferences.categories[notification.category];
      if (categoryPref && !categoryPref.enabled) return;

      // Dedup check
      if (
        notification.dedupeKey &&
        notifications.some((n) => n.dedupeKey === notification.dedupeKey)
      ) {
        return;
      }

      // Add to store
      set((state) => {
        const updated = [notification, ...state.notifications].slice(0, MAX_IN_MEMORY);
        return {
          notifications: updated,
          unreadCount: updated.filter((n) => !n.read && !n.dismissed).length,
        };
      });

      // Fire toast
      if (
        preferences.toastsEnabled &&
        !preferences.dndEnabled &&
        (!categoryPref || categoryPref.toast)
      ) {
        const toastType = priorityToToastType(notification.priority);
        toast[toastType](notification.title, {
          description: notification.message,
          duration: notification.priority === 'high' ? 8000 : 4000,
        });
      }

      // Play sound
      if (preferences.soundEnabled && !preferences.dndEnabled) {
        try {
          const audio = new Audio('notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {
          // Audio not available
        }
      }
    });

    // Listen for batch notifications
    const removeBatch = ipc.on('notification:batch', (...args: unknown[]) => {
      const incoming = args[0] as AppNotification[];
      const { preferences, notifications } = get();

      if (!preferences.enabled) return;

      const existingKeys = new Set(notifications.map((n) => n.dedupeKey).filter(Boolean));
      const newNotifications = incoming.filter((n) => {
        const categoryPref = preferences.categories[n.category];
        if (categoryPref && !categoryPref.enabled) return false;
        if (n.dedupeKey && existingKeys.has(n.dedupeKey)) return false;
        return true;
      });

      if (newNotifications.length === 0) return;

      set((state) => {
        const updated = [...newNotifications, ...state.notifications].slice(0, MAX_IN_MEMORY);
        return {
          notifications: updated,
          unreadCount: updated.filter((n) => !n.read && !n.dismissed).length,
        };
      });

      // Toast for first few
      if (preferences.toastsEnabled && !preferences.dndEnabled) {
        const toShow = newNotifications.slice(0, 3);
        for (const n of toShow) {
          const categoryPref = preferences.categories[n.category];
          if (!categoryPref || categoryPref.toast) {
            toast[priorityToToastType(n.priority)](n.title, {
              description: n.message,
              duration: n.priority === 'high' ? 8000 : 4000,
            });
          }
        }
        if (newNotifications.length > 3) {
          toast.info(`+${newNotifications.length - 3} more notifications`);
        }
      }

      // Sound once for batch
      if (preferences.soundEnabled && !preferences.dndEnabled) {
        try {
          const audio = new Audio('notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {
          // Audio not available
        }
      }
    });

    // Fetch initial data
    get().fetchNotifications();
    get().fetchPreferences();

    return () => {
      removePush();
      removeBatch();
    };
  },
}));

// Export default preferences for use in other components
export { DEFAULT_PREFERENCES };
export type { NotificationCategory, NotificationPriority };
