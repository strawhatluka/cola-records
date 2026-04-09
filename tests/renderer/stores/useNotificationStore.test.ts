// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOn = vi.fn((..._args: any[]) => vi.fn());
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: (...args: unknown[]) => mockOn(...args),
    platform: 'win32',
    isDevelopment: true,
  },
}));

const mockToast = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('../../../src/renderer/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  useNotificationStore,
  DEFAULT_PREFERENCES,
} from '../../../src/renderer/stores/useNotificationStore';

// Helper to build a notification input (omits id, timestamp, read, dismissed)
function buildNotificationInput(overrides: Record<string, unknown> = {}) {
  return {
    category: 'github-pr' as const,
    priority: 'low' as const,
    title: 'Test Notification',
    message: 'Test message body',
    dedupeKey: `dedupe-${Date.now()}-${Math.random()}`,
    ...overrides,
  };
}

// Helper to build a full AppNotification (as returned from IPC / stored in state)
function buildFullNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    category: 'github-pr' as const,
    priority: 'low' as const,
    title: 'Stored Notification',
    message: 'Stored message body',
    timestamp: Date.now(),
    read: false,
    dismissed: false,
    dedupeKey: `dedupe-${Date.now()}-${Math.random()}`,
    ...overrides,
  };
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.setState({
      notifications: [],
      preferences: DEFAULT_PREFERENCES,
      unreadCount: 0,
      loading: false,
    });
  });

  // ---------------------------------------------------------------
  // 1. Initial state
  // ---------------------------------------------------------------
  describe('initial state', () => {
    it('has empty notifications array', () => {
      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
    });

    it('has default preferences', () => {
      const state = useNotificationStore.getState();
      expect(state.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('has unreadCount of 0', () => {
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('has loading set to false', () => {
      expect(useNotificationStore.getState().loading).toBe(false);
    });

    it('DEFAULT_PREFERENCES has expected shape', () => {
      expect(DEFAULT_PREFERENCES.enabled).toBe(true);
      expect(DEFAULT_PREFERENCES.toastsEnabled).toBe(true);
      expect(DEFAULT_PREFERENCES.nativeEnabled).toBe(true);
      expect(DEFAULT_PREFERENCES.soundEnabled).toBe(false);
      expect(DEFAULT_PREFERENCES.dndEnabled).toBe(false);
      expect(DEFAULT_PREFERENCES.pollInterval).toBe(5);
      expect(Object.keys(DEFAULT_PREFERENCES.categories)).toHaveLength(6);
      expect(DEFAULT_PREFERENCES.categories['github-pr'].enabled).toBe(true);
      expect(DEFAULT_PREFERENCES.categories['github-issue'].enabled).toBe(true);
      expect(DEFAULT_PREFERENCES.categories['github-ci'].enabled).toBe(true);
      expect(DEFAULT_PREFERENCES.categories['github-release'].enabled).toBe(true);
      expect(DEFAULT_PREFERENCES.categories['github-discussion'].enabled).toBe(true);
      expect(DEFAULT_PREFERENCES.categories['github-security'].enabled).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 2. addNotification - basic add
  // ---------------------------------------------------------------
  describe('addNotification', () => {
    it('adds a notification with auto-generated id, timestamp, read=false, dismissed=false', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'basic-add-1' }));

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);

      const added = notifications[0];
      expect(added.id).toBeDefined();
      expect(added.id).toMatch(/^notif_/);
      expect(added.timestamp).toBeGreaterThan(0);
      expect(added.read).toBe(false);
      expect(added.dismissed).toBe(false);
      expect(added.title).toBe('Test Notification');
      expect(added.message).toBe('Test message body');
      expect(added.category).toBe('github-pr');
      expect(added.priority).toBe('low');
    });

    it('increments unreadCount when adding an unread notification', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'unread-count-1' }));
      expect(useNotificationStore.getState().unreadCount).toBe(1);

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'unread-count-2' }));
      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });

    // ---------------------------------------------------------------
    // 3. addNotification - dedup by dedupeKey
    // ---------------------------------------------------------------
    it('deduplicates notifications with the same dedupeKey', () => {
      mockInvoke.mockResolvedValue(undefined);

      const input = buildNotificationInput({ dedupeKey: 'same-key' });
      useNotificationStore.getState().addNotification(input);
      useNotificationStore.getState().addNotification(input);

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
    });

    it('allows notifications with different dedupeKeys', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'key-a' }));
      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'key-b' }));

      expect(useNotificationStore.getState().notifications).toHaveLength(2);
    });

    // ---------------------------------------------------------------
    // 4. addNotification - respects disabled global enabled
    // ---------------------------------------------------------------
    it('does not add notification when global enabled is false', () => {
      useNotificationStore.setState({
        preferences: { ...DEFAULT_PREFERENCES, enabled: false },
      });

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'disabled-global' }));

      expect(useNotificationStore.getState().notifications).toHaveLength(0);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------
    // 5. addNotification - respects disabled category
    // ---------------------------------------------------------------
    it('does not add notification when category is disabled', () => {
      useNotificationStore.setState({
        preferences: {
          ...DEFAULT_PREFERENCES,
          categories: {
            ...DEFAULT_PREFERENCES.categories,
            'github-release': { enabled: false, toast: true, native: false },
          },
        },
      });

      useNotificationStore
        .getState()
        .addNotification(
          buildNotificationInput({ category: 'github-release', dedupeKey: 'disabled-cat' })
        );

      expect(useNotificationStore.getState().notifications).toHaveLength(0);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('adds notification when a different category is disabled', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore.setState({
        preferences: {
          ...DEFAULT_PREFERENCES,
          categories: {
            ...DEFAULT_PREFERENCES.categories,
            'github-discussion': { enabled: false, toast: true, native: false },
          },
        },
      });

      useNotificationStore
        .getState()
        .addNotification(
          buildNotificationInput({ category: 'github-pr', dedupeKey: 'other-cat-disabled' })
        );

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    // ---------------------------------------------------------------
    // 6. addNotification - fires toast when enabled
    // ---------------------------------------------------------------
    it('fires toast with correct type based on priority when toasts enabled', () => {
      mockInvoke.mockResolvedValue(undefined);

      // low priority => toast.info
      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ priority: 'low', dedupeKey: 'toast-low' }));
      expect(mockToast.info).toHaveBeenCalledWith('Test Notification', {
        description: 'Test message body',
        duration: 4000,
      });

      // medium priority => toast.warning
      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ priority: 'medium', dedupeKey: 'toast-medium' }));
      expect(mockToast.warning).toHaveBeenCalledWith('Test Notification', {
        description: 'Test message body',
        duration: 4000,
      });

      // high priority => toast.error with 8000ms duration
      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ priority: 'high', dedupeKey: 'toast-high' }));
      expect(mockToast.error).toHaveBeenCalledWith('Test Notification', {
        description: 'Test message body',
        duration: 8000,
      });
    });

    it('does not fire toast when toastsEnabled is false', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore.setState({
        preferences: { ...DEFAULT_PREFERENCES, toastsEnabled: false },
      });

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'no-toast' }));

      expect(mockToast.info).not.toHaveBeenCalled();
      expect(mockToast.warning).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('does not fire toast when category toast preference is false', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore.setState({
        preferences: {
          ...DEFAULT_PREFERENCES,
          categories: {
            ...DEFAULT_PREFERENCES.categories,
            'github-release': { enabled: true, toast: false, native: false },
          },
        },
      });

      useNotificationStore
        .getState()
        .addNotification(
          buildNotificationInput({ category: 'github-release', dedupeKey: 'no-cat-toast' })
        );

      // Notification should still be added
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      // But no toast
      expect(mockToast.info).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------
    // 7. addNotification - does NOT fire toast when DND enabled
    // ---------------------------------------------------------------
    it('does not fire toast when DND is enabled', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore.setState({
        preferences: { ...DEFAULT_PREFERENCES, dndEnabled: true },
      });

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'dnd-toast' }));

      // Notification is still added
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      // But no toast fires
      expect(mockToast.info).not.toHaveBeenCalled();
      expect(mockToast.warning).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------
    // 8. addNotification - caps at MAX_IN_MEMORY (300)
    // ---------------------------------------------------------------
    it('caps notifications at 300 (MAX_IN_MEMORY)', () => {
      mockInvoke.mockResolvedValue(undefined);

      // Pre-fill 300 notifications
      const existing = Array.from({ length: 300 }, (_, i) =>
        buildFullNotification({ dedupeKey: `existing-${i}`, id: `notif_existing_${i}` })
      );
      useNotificationStore.setState({
        notifications: existing,
        unreadCount: 300,
      });

      // Add one more
      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'overflow-item', title: 'Overflow' }));

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(300);
      // The newest notification should be first
      expect(notifications[0].title).toBe('Overflow');
    });

    // ---------------------------------------------------------------
    // 9. addNotification - persists via IPC
    // ---------------------------------------------------------------
    it('persists notification via ipc.invoke("notification:add")', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore
        .getState()
        .addNotification(buildNotificationInput({ dedupeKey: 'persist-test' }));

      expect(mockInvoke).toHaveBeenCalledWith(
        'notification:add',
        expect.objectContaining({
          id: expect.stringMatching(/^notif_/),
          category: 'github-pr',
          priority: 'low',
          title: 'Test Notification',
          message: 'Test message body',
          read: false,
          dismissed: false,
          dedupeKey: 'persist-test',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  // ---------------------------------------------------------------
  // 10. markAsRead
  // ---------------------------------------------------------------
  describe('markAsRead', () => {
    it('sets the specified notification to read=true', () => {
      mockInvoke.mockResolvedValue(undefined);

      const n1 = buildFullNotification({ id: 'n1', dedupeKey: 'mr-1' });
      const n2 = buildFullNotification({ id: 'n2', dedupeKey: 'mr-2' });
      useNotificationStore.setState({
        notifications: [n1, n2],
        unreadCount: 2,
      });

      useNotificationStore.getState().markAsRead('n1');

      const { notifications } = useNotificationStore.getState();
      expect(notifications.find((n) => n.id === 'n1')!.read).toBe(true);
      expect(notifications.find((n) => n.id === 'n2')!.read).toBe(false);
    });

    it('decrements unreadCount correctly', () => {
      mockInvoke.mockResolvedValue(undefined);

      const n1 = buildFullNotification({ id: 'n1', dedupeKey: 'mrc-1' });
      const n2 = buildFullNotification({ id: 'n2', dedupeKey: 'mrc-2' });
      useNotificationStore.setState({
        notifications: [n1, n2],
        unreadCount: 2,
      });

      useNotificationStore.getState().markAsRead('n1');
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('calls ipc.invoke("notification:mark-read", id)', () => {
      mockInvoke.mockResolvedValue(undefined);

      const n1 = buildFullNotification({ id: 'mark-read-id', dedupeKey: 'ipc-mr' });
      useNotificationStore.setState({ notifications: [n1], unreadCount: 1 });

      useNotificationStore.getState().markAsRead('mark-read-id');

      expect(mockInvoke).toHaveBeenCalledWith('notification:mark-read', 'mark-read-id');
    });
  });

  // ---------------------------------------------------------------
  // 11. markAllAsRead
  // ---------------------------------------------------------------
  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      mockInvoke.mockResolvedValue(undefined);

      const n1 = buildFullNotification({ id: 'all-1', dedupeKey: 'mar-1' });
      const n2 = buildFullNotification({ id: 'all-2', dedupeKey: 'mar-2' });
      const n3 = buildFullNotification({ id: 'all-3', dedupeKey: 'mar-3' });
      useNotificationStore.setState({
        notifications: [n1, n2, n3],
        unreadCount: 3,
      });

      useNotificationStore.getState().markAllAsRead();

      const { notifications, unreadCount } = useNotificationStore.getState();
      expect(notifications.every((n) => n.read === true)).toBe(true);
      expect(unreadCount).toBe(0);
    });

    it('calls ipc.invoke("notification:mark-all-read")', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore.setState({
        notifications: [buildFullNotification({ dedupeKey: 'mar-ipc' })],
        unreadCount: 1,
      });

      useNotificationStore.getState().markAllAsRead();

      expect(mockInvoke).toHaveBeenCalledWith('notification:mark-all-read');
    });
  });

  // ---------------------------------------------------------------
  // 12. dismiss
  // ---------------------------------------------------------------
  describe('dismiss', () => {
    it('sets dismissed=true on the specified notification', () => {
      mockInvoke.mockResolvedValue(undefined);

      const n1 = buildFullNotification({ id: 'dismiss-1', dedupeKey: 'd-1' });
      const n2 = buildFullNotification({ id: 'dismiss-2', dedupeKey: 'd-2' });
      useNotificationStore.setState({
        notifications: [n1, n2],
        unreadCount: 2,
      });

      useNotificationStore.getState().dismiss('dismiss-1');

      const { notifications } = useNotificationStore.getState();
      expect(notifications.find((n) => n.id === 'dismiss-1')!.dismissed).toBe(true);
      expect(notifications.find((n) => n.id === 'dismiss-2')!.dismissed).toBe(false);
    });

    it('updates unreadCount excluding dismissed notifications', () => {
      mockInvoke.mockResolvedValue(undefined);

      const n1 = buildFullNotification({ id: 'dc-1', dedupeKey: 'dc-1' });
      const n2 = buildFullNotification({ id: 'dc-2', dedupeKey: 'dc-2' });
      useNotificationStore.setState({
        notifications: [n1, n2],
        unreadCount: 2,
      });

      useNotificationStore.getState().dismiss('dc-1');
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('calls ipc.invoke("notification:dismiss", id)', () => {
      mockInvoke.mockResolvedValue(undefined);

      const n1 = buildFullNotification({ id: 'dismiss-ipc', dedupeKey: 'di' });
      useNotificationStore.setState({ notifications: [n1], unreadCount: 1 });

      useNotificationStore.getState().dismiss('dismiss-ipc');

      expect(mockInvoke).toHaveBeenCalledWith('notification:dismiss', 'dismiss-ipc');
    });
  });

  // ---------------------------------------------------------------
  // 13. clearAll
  // ---------------------------------------------------------------
  describe('clearAll', () => {
    it('empties the notifications array and sets unreadCount to 0', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore.setState({
        notifications: [
          buildFullNotification({ dedupeKey: 'ca-1' }),
          buildFullNotification({ dedupeKey: 'ca-2' }),
        ],
        unreadCount: 2,
      });

      useNotificationStore.getState().clearAll();

      const { notifications, unreadCount } = useNotificationStore.getState();
      expect(notifications).toEqual([]);
      expect(unreadCount).toBe(0);
    });

    it('calls ipc.invoke("notification:clear-all")', () => {
      mockInvoke.mockResolvedValue(undefined);

      useNotificationStore.setState({
        notifications: [buildFullNotification({ dedupeKey: 'ca-ipc' })],
        unreadCount: 1,
      });

      useNotificationStore.getState().clearAll();

      expect(mockInvoke).toHaveBeenCalledWith('notification:clear-all');
    });
  });

  // ---------------------------------------------------------------
  // 14. fetchNotifications
  // ---------------------------------------------------------------
  describe('fetchNotifications', () => {
    it('loads notifications from IPC and populates state', async () => {
      const serverNotifications = [
        buildFullNotification({ id: 'srv-1', dedupeKey: 'fn-1', read: false, dismissed: false }),
        buildFullNotification({ id: 'srv-2', dedupeKey: 'fn-2', read: true, dismissed: false }),
        buildFullNotification({ id: 'srv-3', dedupeKey: 'fn-3', read: false, dismissed: true }),
      ];
      mockInvoke.mockResolvedValueOnce(serverNotifications);

      await useNotificationStore.getState().fetchNotifications();

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual(serverNotifications);
      // unreadCount: srv-1 is unread+not-dismissed => 1
      expect(state.unreadCount).toBe(1);
      expect(state.loading).toBe(false);
    });

    it('calls ipc.invoke("notification:get-all", 300, 0)', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await useNotificationStore.getState().fetchNotifications();

      expect(mockInvoke).toHaveBeenCalledWith('notification:get-all', 300, 0);
    });

    it('sets loading=true during fetch and false after', async () => {
      let resolvePromise: (v: unknown) => void;
      const pending = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockInvoke.mockReturnValueOnce(pending);

      const fetchPromise = useNotificationStore.getState().fetchNotifications();
      expect(useNotificationStore.getState().loading).toBe(true);

      resolvePromise!([]);
      await fetchPromise;

      expect(useNotificationStore.getState().loading).toBe(false);
    });

    it('sets loading=false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      await useNotificationStore.getState().fetchNotifications();

      expect(useNotificationStore.getState().loading).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // 15. fetchPreferences
  // ---------------------------------------------------------------
  describe('fetchPreferences', () => {
    it('loads preferences from IPC and updates state', async () => {
      const serverPrefs = {
        ...DEFAULT_PREFERENCES,
        dndEnabled: true,
        pollInterval: 10,
      };
      mockInvoke.mockResolvedValueOnce(serverPrefs);

      await useNotificationStore.getState().fetchPreferences();

      const state = useNotificationStore.getState();
      expect(state.preferences.dndEnabled).toBe(true);
      expect(state.preferences.pollInterval).toBe(10);
    });

    it('calls ipc.invoke("notification:get-preferences")', async () => {
      mockInvoke.mockResolvedValueOnce(DEFAULT_PREFERENCES);

      await useNotificationStore.getState().fetchPreferences();

      expect(mockInvoke).toHaveBeenCalledWith('notification:get-preferences');
    });

    it('keeps existing preferences on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));

      await useNotificationStore.getState().fetchPreferences();

      expect(useNotificationStore.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    });
  });

  // ---------------------------------------------------------------
  // 16. updatePreferences
  // ---------------------------------------------------------------
  describe('updatePreferences', () => {
    it('sends updates to IPC and sets merged result in state', async () => {
      const merged = { ...DEFAULT_PREFERENCES, dndEnabled: true };
      mockInvoke.mockResolvedValueOnce(merged);

      await useNotificationStore.getState().updatePreferences({ dndEnabled: true });

      expect(mockInvoke).toHaveBeenCalledWith('notification:update-preferences', {
        dndEnabled: true,
      });
      expect(useNotificationStore.getState().preferences.dndEnabled).toBe(true);
    });

    it('throws on IPC error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        useNotificationStore.getState().updatePreferences({ enabled: false })
      ).rejects.toThrow('Update failed');
    });

    it('does not change preferences on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Update failed'));

      try {
        await useNotificationStore.getState().updatePreferences({ enabled: false });
      } catch {
        // expected
      }

      expect(useNotificationStore.getState().preferences.enabled).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 17. unreadCount calculation
  // ---------------------------------------------------------------
  describe('unreadCount calculation', () => {
    it('counts only notifications that are not read and not dismissed', () => {
      const notifications = [
        buildFullNotification({ id: 'uc-1', dedupeKey: 'uc-1', read: false, dismissed: false }),
        buildFullNotification({ id: 'uc-2', dedupeKey: 'uc-2', read: true, dismissed: false }),
        buildFullNotification({ id: 'uc-3', dedupeKey: 'uc-3', read: false, dismissed: true }),
        buildFullNotification({ id: 'uc-4', dedupeKey: 'uc-4', read: true, dismissed: true }),
        buildFullNotification({ id: 'uc-5', dedupeKey: 'uc-5', read: false, dismissed: false }),
      ];
      useNotificationStore.setState({ notifications, unreadCount: 2 });

      // Verify that markAsRead recalculates properly
      mockInvoke.mockResolvedValue(undefined);
      useNotificationStore.getState().markAsRead('uc-1');

      // uc-5 is the only remaining unread+not-dismissed
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('unreadCount becomes 0 when all are read', () => {
      mockInvoke.mockResolvedValue(undefined);

      const notifications = [
        buildFullNotification({ id: 'ucz-1', dedupeKey: 'ucz-1', read: false, dismissed: false }),
        buildFullNotification({ id: 'ucz-2', dedupeKey: 'ucz-2', read: false, dismissed: false }),
      ];
      useNotificationStore.setState({ notifications, unreadCount: 2 });

      useNotificationStore.getState().markAllAsRead();
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('unreadCount decrements when a notification is dismissed', () => {
      mockInvoke.mockResolvedValue(undefined);

      const notifications = [
        buildFullNotification({ id: 'ucd-1', dedupeKey: 'ucd-1', read: false, dismissed: false }),
        buildFullNotification({ id: 'ucd-2', dedupeKey: 'ucd-2', read: false, dismissed: false }),
        buildFullNotification({ id: 'ucd-3', dedupeKey: 'ucd-3', read: false, dismissed: false }),
      ];
      useNotificationStore.setState({ notifications, unreadCount: 3 });

      useNotificationStore.getState().dismiss('ucd-2');
      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });
  });

  // ---------------------------------------------------------------
  // _initializeListeners
  // ---------------------------------------------------------------
  describe('_initializeListeners', () => {
    it('subscribes to notification:push and notification:batch IPC events', () => {
      mockInvoke.mockResolvedValue([]);

      useNotificationStore.getState()._initializeListeners();

      expect(mockOn).toHaveBeenCalledWith('notification:push', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('notification:batch', expect.any(Function));
    });

    it('calls fetchNotifications and fetchPreferences on init', () => {
      mockInvoke.mockResolvedValue([]);

      useNotificationStore.getState()._initializeListeners();

      // fetchNotifications calls notification:get-all
      expect(mockInvoke).toHaveBeenCalledWith('notification:get-all', 300, 0);
      // fetchPreferences calls notification:get-preferences
      expect(mockInvoke).toHaveBeenCalledWith('notification:get-preferences');
    });

    it('returns a cleanup function that removes listeners', () => {
      const removePush = vi.fn();
      const removeBatch = vi.fn();
      mockOn.mockReturnValueOnce(removePush).mockReturnValueOnce(removeBatch);
      mockInvoke.mockResolvedValue([]);

      const cleanup = useNotificationStore.getState()._initializeListeners();
      cleanup();

      expect(removePush).toHaveBeenCalled();
      expect(removeBatch).toHaveBeenCalled();
    });

    describe('notification:push handler', () => {
      it('adds a pushed notification to state', () => {
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const pushCall = mockOn.mock.calls.find((call) => call[0] === 'notification:push');
        expect(pushCall).toBeDefined();

        const pushHandler = pushCall![1];
        const pushed = buildFullNotification({
          id: 'pushed-1',
          dedupeKey: 'push-1',
          title: 'Pushed Notification',
        });
        pushHandler(pushed);

        const { notifications } = useNotificationStore.getState();
        expect(notifications.find((n) => n.id === 'pushed-1')).toBeDefined();
        expect(notifications.find((n) => n.id === 'pushed-1')!.title).toBe('Pushed Notification');
      });

      it('fires toast for pushed notification when enabled', () => {
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const pushCall = mockOn.mock.calls.find((call) => call[0] === 'notification:push');
        const pushHandler = pushCall![1];
        const pushed = buildFullNotification({
          id: 'push-toast',
          dedupeKey: 'push-toast',
          priority: 'medium',
          title: 'Medium Alert',
          message: 'Medium alert body',
        });
        pushHandler(pushed);

        expect(mockToast.warning).toHaveBeenCalledWith('Medium Alert', {
          description: 'Medium alert body',
          duration: 4000,
        });
      });

      it('does not add pushed notification when global enabled is false', () => {
        useNotificationStore.setState({
          preferences: { ...DEFAULT_PREFERENCES, enabled: false },
        });
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const pushCall = mockOn.mock.calls.find((call) => call[0] === 'notification:push');
        const pushHandler = pushCall![1];
        pushHandler(buildFullNotification({ id: 'push-disabled', dedupeKey: 'push-dis' }));

        expect(useNotificationStore.getState().notifications).toHaveLength(0);
      });

      it('deduplicates pushed notifications by dedupeKey', () => {
        mockInvoke.mockResolvedValue([]);

        // Pre-populate with existing notification
        const existing = buildFullNotification({ id: 'exist-1', dedupeKey: 'dup-key' });
        useNotificationStore.setState({ notifications: [existing], unreadCount: 1 });

        useNotificationStore.getState()._initializeListeners();

        const pushCall = mockOn.mock.calls.find((call) => call[0] === 'notification:push');
        const pushHandler = pushCall![1];
        pushHandler(buildFullNotification({ id: 'push-dup', dedupeKey: 'dup-key' }));

        expect(useNotificationStore.getState().notifications).toHaveLength(1);
        expect(useNotificationStore.getState().notifications[0].id).toBe('exist-1');
      });
    });

    describe('notification:batch handler', () => {
      it('adds batch of notifications to state', () => {
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const batchCall = mockOn.mock.calls.find((call) => call[0] === 'notification:batch');
        expect(batchCall).toBeDefined();

        const batchHandler = batchCall![1];
        const batch = [
          buildFullNotification({ id: 'batch-1', dedupeKey: 'b-1' }),
          buildFullNotification({ id: 'batch-2', dedupeKey: 'b-2' }),
          buildFullNotification({ id: 'batch-3', dedupeKey: 'b-3' }),
        ];
        batchHandler(batch);

        const { notifications } = useNotificationStore.getState();
        expect(notifications).toHaveLength(3);
      });

      it('deduplicates batch notifications against existing', () => {
        mockInvoke.mockResolvedValue([]);

        const existing = buildFullNotification({ id: 'exist-b', dedupeKey: 'batch-dup' });
        useNotificationStore.setState({ notifications: [existing], unreadCount: 1 });

        useNotificationStore.getState()._initializeListeners();

        const batchCall = mockOn.mock.calls.find((call) => call[0] === 'notification:batch');
        const batchHandler = batchCall![1];
        batchHandler([
          buildFullNotification({ id: 'b-dup', dedupeKey: 'batch-dup' }),
          buildFullNotification({ id: 'b-new', dedupeKey: 'batch-new' }),
        ]);

        const { notifications } = useNotificationStore.getState();
        expect(notifications).toHaveLength(2);
        expect(notifications.map((n) => n.id)).toContain('exist-b');
        expect(notifications.map((n) => n.id)).toContain('b-new');
      });

      it('filters out batch notifications with disabled categories', () => {
        useNotificationStore.setState({
          preferences: {
            ...DEFAULT_PREFERENCES,
            categories: {
              ...DEFAULT_PREFERENCES.categories,
              'github-discussion': { enabled: false, toast: true, native: false },
            },
          },
        });
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const batchCall = mockOn.mock.calls.find((call) => call[0] === 'notification:batch');
        const batchHandler = batchCall![1];
        batchHandler([
          buildFullNotification({ id: 'b-sys', dedupeKey: 'b-sys', category: 'github-discussion' }),
          buildFullNotification({ id: 'b-git', dedupeKey: 'b-git', category: 'git' }),
        ]);

        const { notifications } = useNotificationStore.getState();
        expect(notifications).toHaveLength(1);
        expect(notifications[0].id).toBe('b-git');
      });

      it('does not add any batch notifications when global enabled is false', () => {
        useNotificationStore.setState({
          preferences: { ...DEFAULT_PREFERENCES, enabled: false },
        });
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const batchCall = mockOn.mock.calls.find((call) => call[0] === 'notification:batch');
        const batchHandler = batchCall![1];
        batchHandler([
          buildFullNotification({ id: 'b-dis-1', dedupeKey: 'b-dis-1' }),
          buildFullNotification({ id: 'b-dis-2', dedupeKey: 'b-dis-2' }),
        ]);

        expect(useNotificationStore.getState().notifications).toHaveLength(0);
      });

      it('fires toasts for first 3 batch notifications and summary for rest', () => {
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const batchCall = mockOn.mock.calls.find((call) => call[0] === 'notification:batch');
        const batchHandler = batchCall![1];

        const batch = Array.from({ length: 5 }, (_, i) =>
          buildFullNotification({
            id: `batch-toast-${i}`,
            dedupeKey: `bt-${i}`,
            priority: 'low',
            title: `Batch ${i}`,
            message: `Batch message ${i}`,
          })
        );
        batchHandler(batch);

        // First 3 get individual toasts
        expect(mockToast.info).toHaveBeenCalledTimes(4); // 3 individual + 1 summary
        expect(mockToast.info).toHaveBeenCalledWith('+2 more notifications');
      });

      it('does not fire toasts for batch when DND is enabled', () => {
        useNotificationStore.setState({
          preferences: { ...DEFAULT_PREFERENCES, dndEnabled: true },
        });
        mockInvoke.mockResolvedValue([]);
        useNotificationStore.getState()._initializeListeners();

        const batchCall = mockOn.mock.calls.find((call) => call[0] === 'notification:batch');
        const batchHandler = batchCall![1];
        batchHandler([buildFullNotification({ id: 'b-dnd', dedupeKey: 'b-dnd' })]);

        // Notification added but no toast
        expect(useNotificationStore.getState().notifications).toHaveLength(1);
        expect(mockToast.info).not.toHaveBeenCalled();
      });
    });
  });
});
