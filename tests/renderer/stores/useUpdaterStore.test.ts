import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// Mock the IPC client module
const mockInvoke = vi.fn();
const mockOn = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: (...args: unknown[]) => mockOn(...args),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Import after mocking
import { useUpdaterStore } from '../../../src/renderer/stores/useUpdaterStore';

describe('useUpdaterStore', () => {
  beforeEach(() => {
    // Reset store to defaults
    useUpdaterStore.setState({
      status: 'idle',
      updateInfo: null,
      downloadProgress: null,
      error: null,
      skippedVersion: null,
      dismissed: false,
      appVersion: '',
    });
    mockInvoke.mockReset();
    mockOn.mockReset();
    localStorageMock.clear();
    // Default mockOn to return a cleanup function
    mockOn.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useUpdaterStore.getState();
      expect(state.status).toBe('idle');
      expect(state.updateInfo).toBeNull();
      expect(state.downloadProgress).toBeNull();
      expect(state.error).toBeNull();
      expect(state.skippedVersion).toBeNull();
      expect(state.dismissed).toBe(false);
      expect(state.appVersion).toBe('');
    });
  });

  describe('checkForUpdates', () => {
    it('sets status to checking and then available when update found', async () => {
      const updateInfo = {
        version: '1.0.1',
        releaseDate: '2026-02-12',
        releaseNotes: 'Bug fixes',
      };
      mockInvoke.mockResolvedValueOnce(updateInfo);

      await act(async () => {
        await useUpdaterStore.getState().checkForUpdates();
      });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('available');
      expect(state.updateInfo).toEqual(updateInfo);
      expect(state.dismissed).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('updater:check');
    });

    it('sets status to not-available when no update', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      await act(async () => {
        await useUpdaterStore.getState().checkForUpdates();
      });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('not-available');
      expect(state.updateInfo).toBeNull();
    });

    it('skips version that was marked as skipped', async () => {
      const updateInfo = {
        version: '1.0.1',
        releaseDate: '2026-02-12',
        releaseNotes: 'Bug fixes',
      };
      mockInvoke.mockResolvedValueOnce(updateInfo);

      // Set skipped version before checking
      useUpdaterStore.setState({ skippedVersion: '1.0.1' });

      await act(async () => {
        await useUpdaterStore.getState().checkForUpdates();
      });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('not-available');
      expect(state.updateInfo).toBeNull();
    });

    it('shows update if version is different from skipped', async () => {
      const updateInfo = {
        version: '1.0.2',
        releaseDate: '2026-02-12',
        releaseNotes: 'New features',
      };
      mockInvoke.mockResolvedValueOnce(updateInfo);

      // Set different skipped version
      useUpdaterStore.setState({ skippedVersion: '1.0.1' });

      await act(async () => {
        await useUpdaterStore.getState().checkForUpdates();
      });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('available');
      expect(state.updateInfo?.version).toBe('1.0.2');
    });

    it('handles errors and sets error state', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await useUpdaterStore.getState().checkForUpdates();
      });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Network error');
    });

    it('clears dismissed state when checking', async () => {
      useUpdaterStore.setState({ dismissed: true });
      mockInvoke.mockResolvedValueOnce(null);

      await act(async () => {
        await useUpdaterStore.getState().checkForUpdates();
      });

      expect(useUpdaterStore.getState().dismissed).toBe(false);
    });
  });

  describe('downloadUpdate', () => {
    it('sets status to downloading when update is available', async () => {
      useUpdaterStore.setState({ status: 'available' });
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useUpdaterStore.getState().downloadUpdate();
      });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('downloading');
      expect(state.downloadProgress).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith('updater:download');
    });

    it('does nothing if no update is available', async () => {
      useUpdaterStore.setState({ status: 'idle' });

      await act(async () => {
        await useUpdaterStore.getState().downloadUpdate();
      });

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(useUpdaterStore.getState().status).toBe('idle');
    });

    it('handles download errors', async () => {
      useUpdaterStore.setState({ status: 'available' });
      mockInvoke.mockRejectedValueOnce(new Error('Download failed'));

      await act(async () => {
        await useUpdaterStore.getState().downloadUpdate();
      });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Download failed');
      expect(state.downloadProgress).toBeNull();
    });
  });

  describe('installUpdate', () => {
    it('calls install IPC when update is downloaded', () => {
      useUpdaterStore.setState({ status: 'downloaded' });

      useUpdaterStore.getState().installUpdate();

      expect(mockInvoke).toHaveBeenCalledWith('updater:install');
    });

    it('does nothing if update is not downloaded', () => {
      useUpdaterStore.setState({ status: 'available' });

      useUpdaterStore.getState().installUpdate();

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('skipVersion', () => {
    it('stores skipped version in localStorage and dismisses', () => {
      const version = '1.0.1';
      useUpdaterStore.setState({
        status: 'available',
        updateInfo: { version, releaseDate: '2026-02-12' },
      });

      useUpdaterStore.getState().skipVersion(version);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cola-records:skipped-update-version',
        version
      );

      const state = useUpdaterStore.getState();
      expect(state.skippedVersion).toBe(version);
      expect(state.dismissed).toBe(true);
      expect(state.status).toBe('idle');
      expect(state.updateInfo).toBeNull();
    });
  });

  describe('remindLater', () => {
    it('sets dismissed to true without changing other state', () => {
      useUpdaterStore.setState({
        status: 'available',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        dismissed: false,
      });

      useUpdaterStore.getState().remindLater();

      const state = useUpdaterStore.getState();
      expect(state.dismissed).toBe(true);
      expect(state.status).toBe('available');
      expect(state.updateInfo).not.toBeNull();
    });
  });

  describe('clearSkippedVersion', () => {
    it('removes skipped version from localStorage and state', () => {
      useUpdaterStore.setState({ skippedVersion: '1.0.1' });
      localStorageMock.store['cola-records:skipped-update-version'] = '1.0.1';

      useUpdaterStore.getState().clearSkippedVersion();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'cola-records:skipped-update-version'
      );
      expect(useUpdaterStore.getState().skippedVersion).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state preserving skippedVersion', () => {
      useUpdaterStore.setState({
        status: 'error',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        downloadProgress: { percent: 50, bytesPerSecond: 1000, transferred: 500, total: 1000 },
        error: 'Some error',
        dismissed: true,
        skippedVersion: '1.0.0',
      });

      useUpdaterStore.getState().reset();

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('idle');
      expect(state.updateInfo).toBeNull();
      expect(state.downloadProgress).toBeNull();
      expect(state.error).toBeNull();
      expect(state.dismissed).toBe(false);
      // skippedVersion should NOT be reset
      expect(state.skippedVersion).toBe('1.0.0');
    });
  });

  describe('_initializeListeners', () => {
    it('registers IPC event listeners', () => {
      mockInvoke.mockResolvedValueOnce('1.0.0'); // For get-version

      useUpdaterStore.getState()._initializeListeners();

      expect(mockOn).toHaveBeenCalledWith('updater:checking', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('updater:available', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('updater:not-available', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('updater:progress', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('updater:downloaded', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('updater:error', expect.any(Function));
    });

    it('loads app version from IPC', async () => {
      mockInvoke.mockResolvedValueOnce('1.0.0');

      useUpdaterStore.getState()._initializeListeners();

      // Wait for the promise to resolve
      await vi.waitFor(() => {
        expect(useUpdaterStore.getState().appVersion).toBe('1.0.0');
      });

      expect(mockInvoke).toHaveBeenCalledWith('updater:get-version');
    });

    it('loads skipped version from localStorage', () => {
      localStorageMock.store['cola-records:skipped-update-version'] = '0.9.0';
      mockInvoke.mockResolvedValueOnce('1.0.0');

      useUpdaterStore.getState()._initializeListeners();

      expect(useUpdaterStore.getState().skippedVersion).toBe('0.9.0');
    });

    it('returns cleanup function that removes listeners', () => {
      const mockRemoveChecking = vi.fn();
      const mockRemoveAvailable = vi.fn();
      const mockRemoveNotAvailable = vi.fn();
      const mockRemoveProgress = vi.fn();
      const mockRemoveDownloaded = vi.fn();
      const mockRemoveError = vi.fn();

      mockOn
        .mockReturnValueOnce(mockRemoveChecking)
        .mockReturnValueOnce(mockRemoveAvailable)
        .mockReturnValueOnce(mockRemoveNotAvailable)
        .mockReturnValueOnce(mockRemoveProgress)
        .mockReturnValueOnce(mockRemoveDownloaded)
        .mockReturnValueOnce(mockRemoveError);
      mockInvoke.mockResolvedValueOnce('1.0.0');

      const cleanup = useUpdaterStore.getState()._initializeListeners();
      cleanup();

      expect(mockRemoveChecking).toHaveBeenCalled();
      expect(mockRemoveAvailable).toHaveBeenCalled();
      expect(mockRemoveNotAvailable).toHaveBeenCalled();
      expect(mockRemoveProgress).toHaveBeenCalled();
      expect(mockRemoveDownloaded).toHaveBeenCalled();
      expect(mockRemoveError).toHaveBeenCalled();
    });
  });

  describe('IPC event handlers', () => {
    it('handles updater:checking event', () => {
      mockInvoke.mockResolvedValueOnce('1.0.0');
      useUpdaterStore.getState()._initializeListeners();

      // Find the checking handler
      const checkingCall = mockOn.mock.calls.find((call) => call[0] === 'updater:checking');
      expect(checkingCall).toBeDefined();

      // Call the handler
      checkingCall![1]();

      expect(useUpdaterStore.getState().status).toBe('checking');
    });

    it('handles updater:available event', () => {
      mockInvoke.mockResolvedValueOnce('1.0.0');
      useUpdaterStore.getState()._initializeListeners();

      const availableCall = mockOn.mock.calls.find((call) => call[0] === 'updater:available');
      expect(availableCall).toBeDefined();

      const updateInfo = { version: '1.0.1', releaseDate: '2026-02-12', releaseNotes: 'New stuff' };
      availableCall![1](updateInfo);

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('available');
      expect(state.updateInfo).toEqual(updateInfo);
      expect(state.dismissed).toBe(false);
    });

    it('handles updater:available event with skipped version', () => {
      useUpdaterStore.setState({ skippedVersion: '1.0.1' });
      mockInvoke.mockResolvedValueOnce('1.0.0');
      useUpdaterStore.getState()._initializeListeners();

      const availableCall = mockOn.mock.calls.find((call) => call[0] === 'updater:available');
      const updateInfo = { version: '1.0.1', releaseDate: '2026-02-12' };
      availableCall![1](updateInfo);

      expect(useUpdaterStore.getState().status).toBe('not-available');
    });

    it('handles updater:not-available event', () => {
      mockInvoke.mockResolvedValueOnce('1.0.0');
      useUpdaterStore.getState()._initializeListeners();

      const notAvailableCall = mockOn.mock.calls.find(
        (call) => call[0] === 'updater:not-available'
      );
      notAvailableCall![1]();

      expect(useUpdaterStore.getState().status).toBe('not-available');
    });

    it('handles updater:progress event', () => {
      mockInvoke.mockResolvedValueOnce('1.0.0');
      useUpdaterStore.getState()._initializeListeners();

      const progressCall = mockOn.mock.calls.find((call) => call[0] === 'updater:progress');
      const progress = {
        percent: 50,
        bytesPerSecond: 1024000,
        transferred: 5000000,
        total: 10000000,
      };
      progressCall![1](progress);

      expect(useUpdaterStore.getState().downloadProgress).toEqual(progress);
    });

    it('handles updater:downloaded event', () => {
      mockInvoke.mockResolvedValueOnce('1.0.0');
      useUpdaterStore.getState()._initializeListeners();

      const downloadedCall = mockOn.mock.calls.find((call) => call[0] === 'updater:downloaded');
      const updateInfo = { version: '1.0.1', releaseDate: '2026-02-12' };
      downloadedCall![1](updateInfo);

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('downloaded');
      expect(state.updateInfo).toEqual(updateInfo);
      expect(state.downloadProgress).toBeNull();
    });

    it('handles updater:error event', () => {
      mockInvoke.mockResolvedValueOnce('1.0.0');
      useUpdaterStore.getState()._initializeListeners();

      const errorCall = mockOn.mock.calls.find((call) => call[0] === 'updater:error');
      errorCall![1]({ message: 'Update failed' });

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Update failed');
    });
  });

  describe('internal setters', () => {
    it('_setStatus updates status', () => {
      useUpdaterStore.getState()._setStatus('downloading');
      expect(useUpdaterStore.getState().status).toBe('downloading');
    });

    it('_setUpdateInfo updates updateInfo', () => {
      const info = { version: '1.0.1', releaseDate: '2026-02-12' };
      useUpdaterStore.getState()._setUpdateInfo(info);
      expect(useUpdaterStore.getState().updateInfo).toEqual(info);
    });

    it('_setProgress updates downloadProgress', () => {
      const progress = {
        percent: 75,
        bytesPerSecond: 2048000,
        transferred: 7500000,
        total: 10000000,
      };
      useUpdaterStore.getState()._setProgress(progress);
      expect(useUpdaterStore.getState().downloadProgress).toEqual(progress);
    });

    it('_setError updates error and sets status to error', () => {
      useUpdaterStore.getState()._setError('Something went wrong');
      const state = useUpdaterStore.getState();
      expect(state.error).toBe('Something went wrong');
      expect(state.status).toBe('error');
    });
  });
});
