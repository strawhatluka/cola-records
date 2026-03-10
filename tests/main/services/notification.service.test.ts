// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetAllSettings: vi.fn(),
  mockGetSetting: vi.fn(),
  mockAddNotification: vi.fn(),
  mockPurgeOldNotifications: vi.fn(),
  mockListNotifications: vi.fn(),
  mockIsSupported: vi.fn(() => true),
  mockShow: vi.fn(),
  mockIsFocused: vi.fn(() => true),
  mockIsDestroyed: vi.fn(() => false),
  mockWebContentsSend: vi.fn(),
}));

// Use real class syntax to avoid "vi.fn() mock did not use 'function' or 'class'" warning
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  Notification: class MockNotification {
    static isSupported = mocks.mockIsSupported;
    show = mocks.mockShow;
    constructor() {
      // intentionally empty
    }
  },
}));

vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    activity = { listNotificationsForAuthenticatedUser: mocks.mockListNotifications };
  },
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    getAllSettings: mocks.mockGetAllSettings,
    getSetting: mocks.mockGetSetting,
    setSetting: vi.fn(),
    addNotification: mocks.mockAddNotification,
    purgeOldNotifications: mocks.mockPurgeOldNotifications,
  },
}));

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { notificationService } from '../../../src/main/services/notification.service';

function createMockWindow() {
  return {
    isFocused: mocks.mockIsFocused,
    isDestroyed: mocks.mockIsDestroyed,
    webContents: {
      send: mocks.mockWebContentsSend,
    },
  } as unknown as Electron.BrowserWindow;
}

function makeGitHubEvent(
  overrides: Partial<{
    id: string;
    reason: string;
    subjectType: string;
    subjectTitle: string;
    repoName: string;
    updatedAt: string;
  }> = {}
) {
  return {
    id: overrides.id ?? 'evt-1',
    reason: overrides.reason ?? 'subscribed',
    subject: {
      title: overrides.subjectTitle ?? 'Test Subject',
      type: overrides.subjectType ?? 'PullRequest',
      url: 'https://api.github.com/repos/org/repo/pulls/1',
    },
    repository: { full_name: overrides.repoName ?? 'org/repo' },
    updated_at: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
  };
}

/**
 * Initialize and trigger the first poll.
 * Uses vi.advanceTimersByTimeAsync which properly handles async callbacks
 * unlike vi.advanceTimersByTime + manual promise flushing.
 */
async function initializeAndPoll(win: Electron.BrowserWindow) {
  notificationService.initialize(win);
  // advanceTimersByTimeAsync advances the 10s setTimeout AND awaits the async poll()
  await vi.advanceTimersByTimeAsync(10_000);
}

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset cached Octokit client so tests don't leak state across each other
    notificationService.resetClient();
    mocks.mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });
    mocks.mockGetSetting.mockReturnValue(null); // default prefs
    mocks.mockListNotifications.mockResolvedValue({ data: [] });
    mocks.mockIsFocused.mockReturnValue(true);
    mocks.mockIsDestroyed.mockReturnValue(false);
  });

  afterEach(() => {
    notificationService.cleanup();
    vi.useRealTimers();
  });

  // ============================================
  // Singleton + basic methods
  // ============================================
  it('exports a singleton instance', () => {
    expect(notificationService).toBeDefined();
    expect(typeof notificationService.initialize).toBe('function');
    expect(typeof notificationService.cleanup).toBe('function');
    expect(typeof notificationService.resetClient).toBe('function');
  });

  it('cleanup() clears timer and window reference', () => {
    const win = createMockWindow();
    notificationService.initialize(win);
    notificationService.cleanup();

    // Should not throw on double cleanup
    expect(() => notificationService.cleanup()).not.toThrow();
  });

  it('resetClient() clears cached Octokit client', () => {
    expect(() => notificationService.resetClient()).not.toThrow();
  });

  // ============================================
  // initialize()
  // ============================================
  describe('initialize', () => {
    it('calls autoPurge on startup', () => {
      const win = createMockWindow();
      notificationService.initialize(win);

      expect(mocks.mockPurgeOldNotifications).toHaveBeenCalledWith(30);
    });

    it('starts polling after 10s delay', async () => {
      const win = createMockWindow();
      notificationService.initialize(win);

      // Polling hasn't started yet
      expect(mocks.mockListNotifications).not.toHaveBeenCalled();

      // Advance 10 seconds to trigger setTimeout → startPolling → poll()
      await vi.advanceTimersByTimeAsync(10_000);

      expect(mocks.mockListNotifications).toHaveBeenCalledTimes(1);
    });

    it('does not start polling if notifications are disabled', async () => {
      mocks.mockGetSetting.mockReturnValue(JSON.stringify({ enabled: false }));

      const win = createMockWindow();
      notificationService.initialize(win);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mocks.mockListNotifications).not.toHaveBeenCalled();
    });

    it('uses custom poll interval from preferences', async () => {
      mocks.mockGetSetting.mockReturnValue(JSON.stringify({ enabled: true, pollInterval: 10 }));

      const win = createMockWindow();
      notificationService.initialize(win);

      await vi.advanceTimersByTimeAsync(10_000); // initial delay → startPolling
      expect(mocks.mockListNotifications).toHaveBeenCalledTimes(1);

      // Advance by 10 minutes (custom interval)
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      expect(mocks.mockListNotifications).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // poll() — GitHub notification processing
  // ============================================
  describe('poll', () => {
    it('skips poll when no GitHub token', async () => {
      mocks.mockGetAllSettings.mockReturnValue({});

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockListNotifications).not.toHaveBeenCalled();
    });

    it('processes PullRequest notifications', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'PullRequest', reason: 'review_requested' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockAddNotification).toHaveBeenCalledTimes(1);
      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.category).toBe('github-pr');
      expect(notification.priority).toBe('high');
      expect(notification.title).toBe('Review Requested');
    });

    it('maps PR mention to medium priority', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'PullRequest', reason: 'mention' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.category).toBe('github-pr');
      expect(notification.priority).toBe('medium');
      expect(notification.title).toBe('Mentioned in PR');
    });

    it('maps generic PR activity to low priority', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'PullRequest', reason: 'subscribed' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.title).toBe('PR Activity');
      expect(notification.priority).toBe('low');
    });

    it('processes Issue notifications with assign reason', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'Issue', reason: 'assign' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.category).toBe('github-issue');
      expect(notification.priority).toBe('medium');
      expect(notification.title).toBe('Issue Assigned');
    });

    it('processes Issue mention notifications', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'Issue', reason: 'mention' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.title).toBe('Mentioned in Issue');
      expect(notification.priority).toBe('medium');
    });

    it('processes generic Issue activity', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'Issue', reason: 'subscribed' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.title).toBe('Issue Activity');
      expect(notification.priority).toBe('low');
    });

    it('processes CheckSuite notifications', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'CheckSuite' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.category).toBe('github-ci');
      expect(notification.priority).toBe('medium');
      expect(notification.title).toBe('CI Update');
    });

    it('handles unknown subject types as default notification', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'Release' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.title).toBe('GitHub Notification');
    });

    it('includes correct notification fields', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [
          makeGitHubEvent({
            id: 'evt-42',
            subjectTitle: 'Fix auth bug',
            repoName: 'org/my-app',
            updatedAt: '2026-03-01T12:00:00Z',
          }),
        ],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.message).toContain('Fix auth bug');
      expect(notification.message).toContain('org/my-app');
      expect(notification.read).toBe(false);
      expect(notification.dismissed).toBe(false);
      expect(notification.dedupeKey).toBe('github-evt-42');
      expect(notification.groupKey).toBe('org/my-app/PullRequest');
      expect(notification.id).toMatch(/^notif_/);
    });

    it('sets actionScreen to contributions for PR events', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'PullRequest' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.actionScreen).toBe('contributions');
    });

    it('sets actionScreen to issues for non-PR events', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'Issue' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      const notification = mocks.mockAddNotification.mock.calls[0][0];
      expect(notification.actionScreen).toBe('issues');
    });

    it('skips notifications with disabled category', async () => {
      mocks.mockGetSetting.mockReturnValue(
        JSON.stringify({
          enabled: true,
          categories: {
            'github-pr': { enabled: false, toast: false, native: false },
          },
        })
      );

      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'PullRequest' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockAddNotification).not.toHaveBeenCalled();
    });

    it('sends batch to renderer when notifications exist', async () => {
      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ id: 'evt-1' }), makeGitHubEvent({ id: 'evt-2' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockWebContentsSend).toHaveBeenCalledWith(
        'notification:batch',
        expect.arrayContaining([
          expect.objectContaining({ dedupeKey: 'github-evt-1' }),
          expect.objectContaining({ dedupeKey: 'github-evt-2' }),
        ])
      );
    });

    it('does not send to renderer when window is destroyed', async () => {
      mocks.mockIsDestroyed.mockReturnValue(true);

      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent()],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockWebContentsSend).not.toHaveBeenCalled();
    });

    it('does not send batch when no events returned', async () => {
      mocks.mockListNotifications.mockResolvedValue({ data: [] });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockWebContentsSend).not.toHaveBeenCalled();
    });

    it('does not send batch when events is null', async () => {
      mocks.mockListNotifications.mockResolvedValue({ data: null });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockWebContentsSend).not.toHaveBeenCalled();
    });

    it('handles poll errors gracefully', async () => {
      mocks.mockListNotifications.mockRejectedValue(new Error('Network error'));

      const win = createMockWindow();
      await initializeAndPoll(win);

      // Should not crash
      expect(mocks.mockAddNotification).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Native notifications
  // ============================================
  describe('native notifications', () => {
    it('shows native notification when window is unfocused', async () => {
      mocks.mockIsFocused.mockReturnValue(false);
      mocks.mockGetSetting.mockReturnValue(
        JSON.stringify({
          enabled: true,
          nativeEnabled: true,
          dndEnabled: false,
          categories: {
            'github-pr': { enabled: true, toast: true, native: true },
          },
        })
      );

      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'PullRequest' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockShow).toHaveBeenCalled();
    });

    it('does not show native notification when window is focused', async () => {
      mocks.mockIsFocused.mockReturnValue(true);

      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent()],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockShow).not.toHaveBeenCalled();
    });

    it('does not show native notification when DND is enabled', async () => {
      mocks.mockIsFocused.mockReturnValue(false);
      mocks.mockGetSetting.mockReturnValue(
        JSON.stringify({
          enabled: true,
          nativeEnabled: true,
          dndEnabled: true,
        })
      );

      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent()],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockShow).not.toHaveBeenCalled();
    });

    it('does not show native notification when native is disabled for category', async () => {
      mocks.mockIsFocused.mockReturnValue(false);
      mocks.mockGetSetting.mockReturnValue(
        JSON.stringify({
          enabled: true,
          nativeEnabled: true,
          dndEnabled: false,
          categories: {
            'github-pr': { enabled: true, toast: true, native: false },
          },
        })
      );

      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent({ subjectType: 'PullRequest' })],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockShow).not.toHaveBeenCalled();
    });

    it('does not show native notification when Notification.isSupported() is false', async () => {
      mocks.mockIsFocused.mockReturnValue(false);
      mocks.mockIsSupported.mockReturnValue(false);

      mocks.mockListNotifications.mockResolvedValue({
        data: [makeGitHubEvent()],
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockShow).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // autoPurge
  // ============================================
  describe('autoPurge', () => {
    it('handles purge errors gracefully', () => {
      mocks.mockPurgeOldNotifications.mockImplementation(() => {
        throw new Error('DB not ready');
      });

      const win = createMockWindow();
      // Should not throw
      expect(() => notificationService.initialize(win)).not.toThrow();
    });
  });

  // ============================================
  // getPreferences
  // ============================================
  describe('preferences', () => {
    it('uses default preferences when no setting stored', async () => {
      mocks.mockGetSetting.mockReturnValue(null);

      const win = createMockWindow();
      await initializeAndPoll(win);

      // Poll should be called (enabled by default)
      expect(mocks.mockListNotifications).toHaveBeenCalled();
    });

    it('handles invalid JSON in preferences gracefully', async () => {
      mocks.mockGetSetting.mockReturnValue('not valid json{{{');

      const win = createMockWindow();
      await initializeAndPoll(win);

      // Should fall back to defaults (enabled: true) and poll
      expect(mocks.mockListNotifications).toHaveBeenCalled();
    });
  });

  // ============================================
  // getClient
  // ============================================
  describe('getClient', () => {
    it('returns null when no token available', async () => {
      mocks.mockGetAllSettings.mockReturnValue({});

      const win = createMockWindow();
      await initializeAndPoll(win);

      // Poll should not call listNotifications (no client)
      expect(mocks.mockListNotifications).not.toHaveBeenCalled();
    });

    it('handles getAllSettings error gracefully', async () => {
      mocks.mockGetAllSettings.mockImplementation(() => {
        throw new Error('DB error');
      });

      const win = createMockWindow();
      await initializeAndPoll(win);

      expect(mocks.mockListNotifications).not.toHaveBeenCalled();
    });

    it('caches client across polls', async () => {
      const win = createMockWindow();
      await initializeAndPoll(win);

      // First poll creates client
      expect(mocks.mockListNotifications).toHaveBeenCalledTimes(1);

      // Advance to next poll interval (5 min default)
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(mocks.mockListNotifications).toHaveBeenCalledTimes(2);

      // getAllSettings should only be called once (client cached)
      expect(mocks.mockGetAllSettings).toHaveBeenCalledTimes(1);
    });
  });
});
