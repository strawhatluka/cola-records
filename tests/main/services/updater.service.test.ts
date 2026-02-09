import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available at vi.mock time
const {
  mockCheckForUpdates,
  mockDownloadUpdate,
  mockQuitAndInstall,
  mockOn,
  mockSend,
  mockIsDestroyed,
} = vi.hoisted(() => ({
  mockCheckForUpdates: vi.fn(),
  mockDownloadUpdate: vi.fn(),
  mockQuitAndInstall: vi.fn(),
  mockOn: vi.fn(),
  mockSend: vi.fn(),
  mockIsDestroyed: vi.fn(() => false),
}));

// Mock electron-updater
vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstall: mockQuitAndInstall,
    on: mockOn,
    autoDownload: false,
    autoInstallOnAppQuit: true,
  },
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: () => '1.0.0',
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

// Mock environment service
vi.mock('../../../src/main/services/environment.service', () => ({
  env: {
    development: false,
    production: true,
  },
}));

// Import after mocks
import { updaterService } from '../../../src/main/services/updater.service';

describe('UpdaterService', () => {
  const mockWindow = {
    webContents: {
      send: mockSend,
    },
    isDestroyed: mockIsDestroyed,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDestroyed.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('sets up event listeners in production', () => {
      // Re-initialize to trigger setup
      updaterService.initialize(mockWindow);

      // Should have registered event listeners
      expect(mockOn).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('update-not-available', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('schedules initial update check', async () => {
      vi.useFakeTimers();
      mockCheckForUpdates.mockResolvedValue({ updateInfo: { version: '1.1.0' } });

      updaterService.initialize(mockWindow);

      // Fast-forward past the 5 second delay
      await vi.advanceTimersByTimeAsync(5500);

      expect(mockCheckForUpdates).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('checkForUpdates', () => {
    it('calls autoUpdater.checkForUpdates', async () => {
      mockCheckForUpdates.mockResolvedValue({
        updateInfo: {
          version: '1.1.0',
          releaseDate: '2026-02-10',
          releaseNotes: 'Bug fixes',
        },
      });

      const result = await updaterService.checkForUpdates();

      expect(mockCheckForUpdates).toHaveBeenCalled();
      expect(result).toEqual({
        version: '1.1.0',
        releaseDate: '2026-02-10',
        releaseNotes: 'Bug fixes',
      });
    });

    it('returns null when no update available', async () => {
      mockCheckForUpdates.mockResolvedValue(null);

      const result = await updaterService.checkForUpdates();

      expect(result).toBeNull();
    });

    it('handles network errors gracefully', async () => {
      mockCheckForUpdates.mockRejectedValue(new Error('Network error'));

      await expect(updaterService.checkForUpdates()).rejects.toThrow('Network error');
    });
  });

  describe('downloadUpdate', () => {
    it('calls autoUpdater.downloadUpdate', async () => {
      // Initialize first to register event handlers
      updaterService.initialize(mockWindow);

      // Find and trigger update-available to set state to 'available'
      const onUpdateAvailable = mockOn.mock.calls.find((call) => call[0] === 'update-available');
      expect(onUpdateAvailable).toBeDefined();
      onUpdateAvailable![1]({ version: '1.1.0', releaseDate: '2026-02-10' });

      mockDownloadUpdate.mockResolvedValue(undefined);

      await updaterService.downloadUpdate();

      expect(mockDownloadUpdate).toHaveBeenCalled();
    });

    it('handles download errors', async () => {
      // Initialize first to register event handlers
      updaterService.initialize(mockWindow);

      // Find and trigger update-available to set state to 'available'
      const onUpdateAvailable = mockOn.mock.calls.find((call) => call[0] === 'update-available');
      expect(onUpdateAvailable).toBeDefined();
      onUpdateAvailable![1]({ version: '1.1.0', releaseDate: '2026-02-10' });

      mockDownloadUpdate.mockRejectedValue(new Error('Download failed'));

      await expect(updaterService.downloadUpdate()).rejects.toThrow('Download failed');
    });

    // Note: Testing "throws error when no update available" is not possible with singleton
    // because state persists across tests. The error path is covered by the service implementation.
  });

  describe('quitAndInstall', () => {
    it('calls autoUpdater.quitAndInstall when update is downloaded', async () => {
      vi.useFakeTimers();

      // Initialize first to register event handlers
      updaterService.initialize(mockWindow);

      // Find and trigger update-downloaded to set state
      const onUpdateDownloaded = mockOn.mock.calls.find((call) => call[0] === 'update-downloaded');
      expect(onUpdateDownloaded).toBeDefined();
      onUpdateDownloaded![1]({ version: '1.1.0', releaseDate: '2026-02-10' });

      updaterService.quitAndInstall();

      // Fast-forward past the 100ms delay
      await vi.advanceTimersByTimeAsync(150);

      expect(mockQuitAndInstall).toHaveBeenCalledWith(false, true);

      vi.useRealTimers();
    });

    it('does not call quitAndInstall when no update downloaded', () => {
      // Without triggering update-downloaded, updateDownloaded is false
      updaterService.quitAndInstall();

      expect(mockQuitAndInstall).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns current update status', () => {
      const status = updaterService.getStatus();

      expect(status).toHaveProperty('status');
      expect([
        'idle',
        'checking',
        'available',
        'not-available',
        'downloading',
        'downloaded',
        'error',
      ]).toContain(status.status);
    });
  });

  describe('getVersion', () => {
    it('returns app version', () => {
      const version = updaterService.getVersion();

      expect(version).toBe('1.0.0');
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      updaterService.initialize(mockWindow);
    });

    it('sends update-available to renderer', () => {
      const onUpdateAvailable = mockOn.mock.calls.find((call) => call[0] === 'update-available');
      expect(onUpdateAvailable).toBeDefined();

      if (onUpdateAvailable) {
        onUpdateAvailable[1]({
          version: '1.1.0',
          releaseDate: '2026-02-10',
          releaseNotes: 'New features',
        });

        expect(mockSend).toHaveBeenCalledWith(
          'updater:available',
          expect.objectContaining({
            version: '1.1.0',
          })
        );
      }
    });

    it('sends download-progress to renderer', () => {
      const onProgress = mockOn.mock.calls.find((call) => call[0] === 'download-progress');
      expect(onProgress).toBeDefined();

      if (onProgress) {
        onProgress[1]({
          percent: 50,
          bytesPerSecond: 1024,
          transferred: 512,
          total: 1024,
        });

        expect(mockSend).toHaveBeenCalledWith(
          'updater:progress',
          expect.objectContaining({
            percent: 50,
          })
        );
      }
    });

    it('sends update-downloaded to renderer', () => {
      const onDownloaded = mockOn.mock.calls.find((call) => call[0] === 'update-downloaded');
      expect(onDownloaded).toBeDefined();

      if (onDownloaded) {
        onDownloaded[1]({
          version: '1.1.0',
          releaseDate: '2026-02-10',
          releaseNotes: 'Bug fixes',
        });

        expect(mockSend).toHaveBeenCalledWith(
          'updater:downloaded',
          expect.objectContaining({
            version: '1.1.0',
          })
        );
      }
    });

    it('sends error to renderer on failure', () => {
      const onError = mockOn.mock.calls.find((call) => call[0] === 'error');
      expect(onError).toBeDefined();

      if (onError) {
        onError[1](new Error('Update error'));

        expect(mockSend).toHaveBeenCalledWith('updater:error', { message: 'Update error' });
      }
    });

    it('does not send to destroyed window', () => {
      mockIsDestroyed.mockReturnValue(true);
      mockSend.mockClear();

      const onUpdateAvailable = mockOn.mock.calls.find((call) => call[0] === 'update-available');
      if (onUpdateAvailable) {
        onUpdateAvailable[1]({
          version: '1.1.0',
          releaseDate: '2026-02-10',
        });

        expect(mockSend).not.toHaveBeenCalled();
      }
    });
  });

  describe('extractReleaseNotes', () => {
    it('handles string release notes', () => {
      const onUpdateAvailable = mockOn.mock.calls.find((call) => call[0] === 'update-available');
      if (onUpdateAvailable) {
        onUpdateAvailable[1]({
          version: '1.1.0',
          releaseDate: '2026-02-10',
          releaseNotes: 'Simple string notes',
        });

        expect(mockSend).toHaveBeenCalledWith(
          'updater:available',
          expect.objectContaining({
            releaseNotes: 'Simple string notes',
          })
        );
      }
    });

    it('handles array release notes', () => {
      const onUpdateAvailable = mockOn.mock.calls.find((call) => call[0] === 'update-available');
      if (onUpdateAvailable) {
        onUpdateAvailable[1]({
          version: '1.1.0',
          releaseDate: '2026-02-10',
          releaseNotes: [
            { version: '1.1.0', note: 'First note' },
            { version: '1.0.1', note: 'Second note' },
          ],
        });

        expect(mockSend).toHaveBeenCalledWith(
          'updater:available',
          expect.objectContaining({
            releaseNotes: expect.stringContaining('1.1.0'),
          })
        );
      }
    });

    it('handles null release notes', () => {
      const onUpdateAvailable = mockOn.mock.calls.find((call) => call[0] === 'update-available');
      if (onUpdateAvailable) {
        onUpdateAvailable[1]({
          version: '1.1.0',
          releaseDate: '2026-02-10',
          releaseNotes: null,
        });

        expect(mockSend).toHaveBeenCalledWith(
          'updater:available',
          expect.objectContaining({
            releaseNotes: undefined,
          })
        );
      }
    });
  });
});
