// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  Notification: {
    isSupported: vi.fn(() => true),
  },
}));

// Mock Octokit
const mockListNotifications = vi.fn().mockResolvedValue({ data: [] });
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    activity: { listNotificationsForAuthenticatedUser: mockListNotifications },
  })),
}));

// Mock database
vi.mock('../../../src/main/database', () => ({
  database: {
    getAllSettings: vi.fn(() => ({ githubToken: 'test-token' })),
    getSetting: vi.fn(() => null),
    setSetting: vi.fn(),
    addNotification: vi.fn(),
    purgeOldNotifications: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { notificationService } from '../../../src/main/services/notification.service';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    notificationService.cleanup();
    vi.useRealTimers();
  });

  it('notificationService is exported as singleton', () => {
    expect(notificationService).toBeDefined();
    expect(typeof notificationService.cleanup).toBe('function');
    expect(typeof notificationService.resetClient).toBe('function');
  });

  it('cleanup() can be called without error', () => {
    expect(() => notificationService.cleanup()).not.toThrow();
  });

  it('resetClient() can be called without error', () => {
    expect(() => notificationService.resetClient()).not.toThrow();
  });
});
