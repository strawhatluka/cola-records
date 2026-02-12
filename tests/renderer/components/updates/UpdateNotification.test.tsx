import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateNotification } from '../../../../src/renderer/components/updates/UpdateNotification';
import { useUpdaterStore } from '../../../../src/renderer/stores/useUpdaterStore';

// Mock the store
vi.mock('../../../../src/renderer/stores/useUpdaterStore');
const mockUseUpdaterStore = vi.mocked(useUpdaterStore);

describe('UpdateNotification', () => {
  const defaultMockState = {
    status: 'idle' as const,
    updateInfo: null,
    downloadProgress: null,
    error: null,
    dismissed: false,
    appVersion: '1.0.0',
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    skipVersion: vi.fn(),
    remindLater: vi.fn(),
    reset: vi.fn(),
    _initializeListeners: vi.fn(() => vi.fn()),
    clearSkippedVersion: vi.fn(),
    _setStatus: vi.fn(),
    _setUpdateInfo: vi.fn(),
    _setProgress: vi.fn(),
    _setError: vi.fn(),
    _loadSkippedVersion: vi.fn(),
    skippedVersion: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdaterStore.mockReturnValue(defaultMockState);
  });

  describe('dialog visibility', () => {
    it('does not render dialog when status is idle', () => {
      render(<UpdateNotification />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not render dialog when status is checking', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'checking',
      });
      render(<UpdateNotification />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not render dialog when status is not-available', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'not-available',
      });
      render(<UpdateNotification />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not render dialog when dismissed', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'available',
        dismissed: true,
      });
      render(<UpdateNotification />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders dialog when update is available', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'available',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
      });
      render(<UpdateNotification />);
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('renders dialog when downloading', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloading',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
      });
      render(<UpdateNotification />);
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('renders dialog when downloaded', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloaded',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
      });
      render(<UpdateNotification />);
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('renders dialog when error', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'error',
        error: 'Something went wrong',
      });
      render(<UpdateNotification />);
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });

  describe('available state', () => {
    beforeEach(() => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'available',
        updateInfo: {
          version: '1.0.1',
          releaseDate: '2026-02-12',
          releaseNotes: 'Bug fixes and improvements',
        },
      });
    });

    it('shows update available title', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Update Available')).toBeDefined();
    });

    it('shows version badges', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('1.0.0')).toBeDefined(); // current version
      expect(screen.getByText('1.0.1')).toBeDefined(); // new version
    });

    it('shows release notes', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Bug fixes and improvements')).toBeDefined();
    });

    it('shows Download & Install button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Download & Install')).toBeDefined();
    });

    it('shows Remind Me Later button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Remind Me Later')).toBeDefined();
    });

    it('shows Skip This Version button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Skip This Version')).toBeDefined();
    });

    it('calls downloadUpdate when Download & Install clicked', () => {
      const downloadUpdate = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'available',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        downloadUpdate,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Download & Install'));
      expect(downloadUpdate).toHaveBeenCalled();
    });

    it('calls remindLater when Remind Me Later clicked', () => {
      const remindLater = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'available',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        remindLater,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Remind Me Later'));
      expect(remindLater).toHaveBeenCalled();
    });

    it('calls skipVersion when Skip This Version clicked', () => {
      const skipVersion = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'available',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        skipVersion,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Skip This Version'));
      expect(skipVersion).toHaveBeenCalledWith('1.0.1');
    });
  });

  describe('downloading state', () => {
    beforeEach(() => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloading',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        downloadProgress: {
          percent: 50,
          bytesPerSecond: 1048576, // 1 MB/s
          transferred: 5242880, // 5 MB
          total: 10485760, // 10 MB
        },
      });
    });

    it('shows downloading title', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Downloading Update')).toBeDefined();
    });

    it('shows download progress percentage', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('50.0%')).toBeDefined();
    });

    it('shows transferred/total bytes', () => {
      render(<UpdateNotification />);
      expect(screen.getByText(/5 MB/)).toBeDefined();
      expect(screen.getByText(/10 MB/)).toBeDefined();
    });

    it('shows download speed', () => {
      render(<UpdateNotification />);
      expect(screen.getByText(/1 MB\/s/)).toBeDefined();
    });

    it('shows Download in Background button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Download in Background')).toBeDefined();
    });

    it('calls remindLater when Download in Background clicked', () => {
      const remindLater = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloading',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        downloadProgress: { percent: 50, bytesPerSecond: 1024, transferred: 500, total: 1000 },
        remindLater,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Download in Background'));
      expect(remindLater).toHaveBeenCalled();
    });
  });

  describe('downloaded state', () => {
    beforeEach(() => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloaded',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
      });
    });

    it('shows ready to install title', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Ready to Install')).toBeDefined();
    });

    it('shows restart message', () => {
      render(<UpdateNotification />);
      expect(
        screen.getByText('The application will restart to complete the installation.')
      ).toBeDefined();
    });

    it('shows Restart & Install button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Restart & Install')).toBeDefined();
    });

    it('shows Install Later button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Install Later')).toBeDefined();
    });

    it('calls installUpdate when Restart & Install clicked', () => {
      const installUpdate = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloaded',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        installUpdate,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Restart & Install'));
      expect(installUpdate).toHaveBeenCalled();
    });

    it('calls remindLater when Install Later clicked', () => {
      const remindLater = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloaded',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        remindLater,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Install Later'));
      expect(remindLater).toHaveBeenCalled();
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'error',
        error: 'Network connection failed',
      });
    });

    it('shows error title', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Update Error')).toBeDefined();
    });

    it('shows error message', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Network connection failed')).toBeDefined();
    });

    it('shows Retry button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Retry')).toBeDefined();
    });

    it('shows Dismiss button', () => {
      render(<UpdateNotification />);
      expect(screen.getByText('Dismiss')).toBeDefined();
    });

    it('calls reset and checkForUpdates when Retry clicked', () => {
      const reset = vi.fn();
      const checkForUpdates = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'error',
        error: 'Network error',
        reset,
        checkForUpdates,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Retry'));
      expect(reset).toHaveBeenCalled();
      expect(checkForUpdates).toHaveBeenCalled();
    });

    it('calls remindLater when Dismiss clicked', () => {
      const remindLater = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'error',
        error: 'Network error',
        remindLater,
      });
      render(<UpdateNotification />);

      fireEvent.click(screen.getByText('Dismiss'));
      expect(remindLater).toHaveBeenCalled();
    });
  });

  describe('dialog close behavior', () => {
    it('calls remindLater when dialog is closed', () => {
      const remindLater = vi.fn();
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'available',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        remindLater,
      });
      render(<UpdateNotification />);

      // Find and click the close button (X)
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      expect(remindLater).toHaveBeenCalled();
    });
  });

  describe('initialization', () => {
    it('calls _initializeListeners on mount', () => {
      const cleanup = vi.fn();
      const _initializeListeners = vi.fn(() => cleanup);
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        _initializeListeners,
      });

      const { unmount } = render(<UpdateNotification />);
      expect(_initializeListeners).toHaveBeenCalled();

      unmount();
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('byte formatting', () => {
    it('formats bytes correctly', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloading',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        downloadProgress: {
          percent: 25,
          bytesPerSecond: 512, // 512 B/s
          transferred: 256000, // ~250 KB
          total: 1024000, // ~1000 KB
        },
      });
      render(<UpdateNotification />);
      expect(screen.getByText(/250 KB/)).toBeDefined();
      expect(screen.getByText(/512 B\/s/)).toBeDefined();
    });

    it('handles zero bytes', () => {
      mockUseUpdaterStore.mockReturnValue({
        ...defaultMockState,
        status: 'downloading',
        updateInfo: { version: '1.0.1', releaseDate: '2026-02-12' },
        downloadProgress: {
          percent: 0,
          bytesPerSecond: 0,
          transferred: 0,
          total: 1000,
        },
      });
      render(<UpdateNotification />);
      expect(screen.getByText('0.0%')).toBeDefined();
    });
  });
});
