import { create } from 'zustand';
import { ipc } from '../ipc/client';

/**
 * Update status states
 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

/**
 * Information about an available update
 */
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/**
 * Updater store state interface
 */
interface UpdaterState {
  // State
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  error: string | null;
  skippedVersion: string | null;
  dismissed: boolean;
  appVersion: string;

  // Actions
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
  skipVersion: (version: string) => void;
  remindLater: () => void;
  clearSkippedVersion: () => void;
  reset: () => void;

  // Internal actions (for IPC event handlers)
  _setStatus: (status: UpdateStatus) => void;
  _setUpdateInfo: (info: UpdateInfo | null) => void;
  _setProgress: (progress: DownloadProgress | null) => void;
  _setError: (error: string | null) => void;
  _loadSkippedVersion: () => void;
  _initializeListeners: () => () => void;
}

// LocalStorage key for skipped version
const SKIPPED_VERSION_KEY = 'cola-records:skipped-update-version';

/**
 * Updater store for managing application update state
 *
 * Handles:
 * - Checking for updates
 * - Downloading updates
 * - Installing updates
 * - Skipping specific versions
 * - Remind me later functionality
 */
export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  // Initial state
  status: 'idle',
  updateInfo: null,
  downloadProgress: null,
  error: null,
  skippedVersion: null,
  dismissed: false,
  appVersion: '',

  /**
   * Check for available updates
   */
  checkForUpdates: async () => {
    const { skippedVersion } = get();

    set({ status: 'checking', error: null, dismissed: false });

    try {
      const result = await ipc.invoke('updater:check');

      if (result) {
        // Check if this version should be skipped
        if (skippedVersion && result.version === skippedVersion) {
          set({ status: 'not-available', updateInfo: null });
          return;
        }

        set({
          status: 'available',
          updateInfo: {
            version: result.version,
            releaseDate: result.releaseDate,
            releaseNotes: result.releaseNotes,
          },
        });
      } else {
        set({ status: 'not-available', updateInfo: null });
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check for updates',
      });
    }
  },

  /**
   * Download the available update
   */
  downloadUpdate: async () => {
    const { status } = get();

    if (status !== 'available') {
      console.warn('[UpdaterStore] Cannot download - no update available');
      return;
    }

    set({ status: 'downloading', downloadProgress: null, error: null });

    try {
      await ipc.invoke('updater:download');
      // Status will be updated via IPC events (updater:progress, updater:downloaded)
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to download update',
        downloadProgress: null,
      });
    }
  },

  /**
   * Quit and install the downloaded update
   */
  installUpdate: () => {
    const { status } = get();

    if (status !== 'downloaded') {
      console.warn('[UpdaterStore] Cannot install - update not downloaded');
      return;
    }

    // This will quit the app and install the update
    ipc.invoke('updater:install');
  },

  /**
   * Skip this version and don't show notification again
   */
  skipVersion: (version: string) => {
    localStorage.setItem(SKIPPED_VERSION_KEY, version);
    set({
      skippedVersion: version,
      dismissed: true,
      status: 'idle',
      updateInfo: null,
    });
  },

  /**
   * Dismiss the notification for this session only
   */
  remindLater: () => {
    set({ dismissed: true });
  },

  /**
   * Clear the skipped version (show notifications for all versions again)
   */
  clearSkippedVersion: () => {
    localStorage.removeItem(SKIPPED_VERSION_KEY);
    set({ skippedVersion: null });
  },

  /**
   * Reset the store to initial state
   */
  reset: () => {
    set({
      status: 'idle',
      updateInfo: null,
      downloadProgress: null,
      error: null,
      dismissed: false,
    });
  },

  // Internal actions for IPC event handlers
  _setStatus: (status) => set({ status }),
  _setUpdateInfo: (info) => set({ updateInfo: info }),
  _setProgress: (progress) => set({ downloadProgress: progress }),
  _setError: (error) => set({ error, status: 'error' }),

  /**
   * Load skipped version from localStorage
   */
  _loadSkippedVersion: () => {
    const skippedVersion = localStorage.getItem(SKIPPED_VERSION_KEY);
    if (skippedVersion) {
      set({ skippedVersion });
    }
  },

  /**
   * Initialize IPC event listeners for update events from main process
   * Returns a cleanup function to remove listeners
   */
  _initializeListeners: () => {
    const { _setStatus, _setProgress, _setError } = get();

    // Listen for checking event
    const removeChecking = ipc.on('updater:checking', () => {
      _setStatus('checking');
    });

    // Listen for update available event
    const removeAvailable = ipc.on('updater:available', (...args: unknown[]) => {
      const info = args[0] as UpdateInfo;

      // Check if this version should be skipped
      const currentSkipped = get().skippedVersion;
      if (currentSkipped && info.version === currentSkipped) {
        _setStatus('not-available');
        return;
      }

      set({
        status: 'available',
        updateInfo: info,
        dismissed: false,
      });
    });

    // Listen for no update available event
    const removeNotAvailable = ipc.on('updater:not-available', () => {
      _setStatus('not-available');
    });

    // Listen for download progress event
    const removeProgress = ipc.on('updater:progress', (...args: unknown[]) => {
      const progress = args[0] as DownloadProgress;
      _setProgress(progress);
    });

    // Listen for update downloaded event
    const removeDownloaded = ipc.on('updater:downloaded', (...args: unknown[]) => {
      const info = args[0] as UpdateInfo;
      set({
        status: 'downloaded',
        updateInfo: info,
        downloadProgress: null,
      });
    });

    // Listen for error event
    const removeError = ipc.on('updater:error', (...args: unknown[]) => {
      const error = args[0] as { message: string };
      _setError(error.message);
    });

    // Load app version
    ipc.invoke('updater:get-version').then((version) => {
      set({ appVersion: version });
    });

    // Load skipped version from localStorage
    get()._loadSkippedVersion();

    // Return cleanup function
    return () => {
      removeChecking();
      removeAvailable();
      removeNotAvailable();
      removeProgress();
      removeDownloaded();
      removeError();
    };
  },
}));
