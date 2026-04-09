import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  mockAddNotification: vi.fn(),
  mockGetNotifications: vi.fn(),
  mockMarkNotificationRead: vi.fn(),
  mockMarkAllNotificationsRead: vi.fn(),
  mockDismissNotification: vi.fn(),
  mockClearAllNotifications: vi.fn(),
  mockGetSetting: vi.fn(),
  mockSetSetting: vi.fn(),
  mockGetUnreadNotificationCount: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    initialize: vi.fn(),
    getSetting: mocks.mockGetSetting,
    setSetting: mocks.mockSetSetting,
    addNotification: mocks.mockAddNotification,
    getNotifications: mocks.mockGetNotifications,
    markNotificationRead: mocks.mockMarkNotificationRead,
    markAllNotificationsRead: mocks.mockMarkAllNotificationsRead,
    dismissNotification: mocks.mockDismissNotification,
    clearAllNotifications: mocks.mockClearAllNotifications,
    getUnreadNotificationCount: mocks.mockGetUnreadNotificationCount,
  },
}));

vi.mock('../../../src/main/services/notification.service', () => ({
  notificationService: {
    markThreadRead: vi.fn().mockResolvedValue(undefined),
  },
}));

import { setupNotificationHandlers } from '../../../src/main/ipc/handlers/notification.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('notification.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotificationHandlers();
  });

  it('registers all 9 handlers', () => {
    expect(mocks.mockHandleIpc).toHaveBeenCalledTimes(9);
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('notification:add');
    expect(channels).toContain('notification:get-all');
    expect(channels).toContain('notification:mark-read');
    expect(channels).toContain('notification:mark-all-read');
    expect(channels).toContain('notification:dismiss');
    expect(channels).toContain('notification:clear-all');
    expect(channels).toContain('notification:get-preferences');
    expect(channels).toContain('notification:update-preferences');
    expect(channels).toContain('notification:get-unread-count');
  });

  it('notification:add delegates to database.addNotification', async () => {
    const notification = { id: 'n1', title: 'Test', category: 'github-pr' };

    const handler = getHandler('notification:add');
    expect(handler).toBeDefined();
    await handler!({}, notification);

    expect(mocks.mockAddNotification).toHaveBeenCalledWith(notification);
  });

  it('notification:get-all delegates to database.getNotifications with defaults', async () => {
    const mockResult = [{ id: 'n1', title: 'Test' }];
    mocks.mockGetNotifications.mockReturnValue(mockResult);

    const handler = getHandler('notification:get-all');
    expect(handler).toBeDefined();
    const result = await handler!({}, undefined, undefined);

    expect(mocks.mockGetNotifications).toHaveBeenCalledWith(300, 0);
    expect(result).toBe(mockResult);
  });

  it('notification:get-all passes custom limit and offset', async () => {
    mocks.mockGetNotifications.mockReturnValue([]);

    const handler = getHandler('notification:get-all');
    await handler!({}, 50, 10);

    expect(mocks.mockGetNotifications).toHaveBeenCalledWith(50, 10);
  });

  it('notification:mark-read delegates to database.markNotificationRead', async () => {
    const handler = getHandler('notification:mark-read');
    expect(handler).toBeDefined();
    await handler!({}, 'n1');

    expect(mocks.mockMarkNotificationRead).toHaveBeenCalledWith('n1');
  });

  it('notification:mark-all-read delegates to database.markAllNotificationsRead', async () => {
    const handler = getHandler('notification:mark-all-read');
    expect(handler).toBeDefined();
    await handler!({});

    expect(mocks.mockMarkAllNotificationsRead).toHaveBeenCalled();
  });

  it('notification:dismiss delegates to database.dismissNotification', async () => {
    const handler = getHandler('notification:dismiss');
    expect(handler).toBeDefined();
    await handler!({}, 'n1');

    expect(mocks.mockDismissNotification).toHaveBeenCalledWith('n1');
  });

  it('notification:clear-all delegates to database.clearAllNotifications', async () => {
    const handler = getHandler('notification:clear-all');
    expect(handler).toBeDefined();
    await handler!({});

    expect(mocks.mockClearAllNotifications).toHaveBeenCalled();
  });

  it('notification:get-unread-count delegates to database.getUnreadNotificationCount', async () => {
    mocks.mockGetUnreadNotificationCount.mockReturnValue(5);

    const handler = getHandler('notification:get-unread-count');
    expect(handler).toBeDefined();
    const result = await handler!({});

    expect(mocks.mockGetUnreadNotificationCount).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  describe('notification:get-preferences', () => {
    it('returns defaults when no setting exists', async () => {
      mocks.mockGetSetting.mockReturnValue(null);

      const handler = getHandler('notification:get-preferences');
      expect(handler).toBeDefined();
      const result = (await handler!({})) as Record<string, unknown>;

      expect(mocks.mockGetSetting).toHaveBeenCalledWith('notificationPreferences');
      expect(result).toEqual(
        expect.objectContaining({
          enabled: true,
          toastsEnabled: true,
          nativeEnabled: true,
          soundEnabled: false,
          dndEnabled: false,
          pollInterval: 5,
        })
      );
    });

    it('merges stored JSON with defaults', async () => {
      mocks.mockGetSetting.mockReturnValue(
        JSON.stringify({ soundEnabled: true, pollInterval: 10 })
      );

      const handler = getHandler('notification:get-preferences');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result).toEqual(
        expect.objectContaining({
          enabled: true,
          soundEnabled: true,
          pollInterval: 10,
        })
      );
    });

    it('returns defaults when stored JSON is invalid', async () => {
      mocks.mockGetSetting.mockReturnValue('not valid json{{{');

      const handler = getHandler('notification:get-preferences');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result).toEqual(
        expect.objectContaining({
          enabled: true,
          soundEnabled: false,
          pollInterval: 5,
        })
      );
    });
  });

  describe('notification:update-preferences', () => {
    it('merges updates with current preferences and saves', async () => {
      mocks.mockGetSetting.mockReturnValue(null);

      const handler = getHandler('notification:update-preferences');
      expect(handler).toBeDefined();
      const result = (await handler!({}, { soundEnabled: true, dndEnabled: true })) as Record<
        string,
        unknown
      >;

      expect(result).toEqual(
        expect.objectContaining({
          enabled: true,
          soundEnabled: true,
          dndEnabled: true,
        })
      );
      expect(mocks.mockSetSetting).toHaveBeenCalledWith(
        'notificationPreferences',
        expect.any(String)
      );
      const savedJson = mocks.mockSetSetting.mock.calls[0][1];
      const savedObj = JSON.parse(savedJson);
      expect(savedObj.soundEnabled).toBe(true);
      expect(savedObj.dndEnabled).toBe(true);
    });

    it('merges nested categories', async () => {
      mocks.mockGetSetting.mockReturnValue(null);

      const handler = getHandler('notification:update-preferences');
      const result = (await handler!(
        {},
        {
          categories: { 'github-pr': { enabled: false, toast: false, native: false } },
        }
      )) as { categories: Record<string, unknown> };

      expect(result.categories['github-pr']).toEqual({
        enabled: false,
        toast: false,
        native: false,
      });
      // Other categories preserved from defaults
      expect(result.categories['github-security']).toEqual({
        enabled: true,
        toast: true,
        native: true,
      });
    });
  });
});
