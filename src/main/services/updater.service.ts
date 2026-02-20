import { autoUpdater, UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater';
import { BrowserWindow, app } from 'electron';
import { env } from './environment.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('Updater');

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

/**
 * Auto-update service using electron-updater
 *
 * Features:
 * - Check for updates on app start (production only)
 * - Show notification when update available
 * - Download in background
 * - Prompt user to install
 */
class UpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private state: UpdateState = { status: 'idle' };
  private updateDownloaded = false;

  /**
   * Initialize the updater service
   */
  initialize(window: BrowserWindow): void {
    this.mainWindow = window;

    // Only enable updates in production
    if (env.development) {
      logger.debug('Skipping initialization in development mode');
      return;
    }

    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Set GitHub as the update provider
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'lukadfagundes',
      repo: 'cola-records',
    });

    // Set up event listeners
    this.setupEventListeners();

    // Check for updates after a short delay (let app initialize first)
    setTimeout(() => {
      this.checkForUpdates().catch((err) => {
        logger.error('Initial update check failed:', err);
      });
    }, 5000);
  }

  /**
   * Set up auto-updater event listeners
   */
  private setupEventListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateState({ status: 'checking' });
      this.sendToRenderer('updater:checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateState({
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: this.extractReleaseNotes(info.releaseNotes),
      });
      this.sendToRenderer('updater:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: this.extractReleaseNotes(info.releaseNotes),
      });
    });

    autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
      this.updateState({ status: 'not-available' });
      this.sendToRenderer('updater:not-available');
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateState({
        status: 'downloading',
        progress: progress.percent,
      });
      this.sendToRenderer('updater:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      this.updateDownloaded = true;
      this.updateState({
        status: 'downloaded',
        version: event.version,
        releaseDate: event.releaseDate,
        releaseNotes: this.extractReleaseNotes(event.releaseNotes),
      });
      this.sendToRenderer('updater:downloaded', {
        version: event.version,
        releaseDate: event.releaseDate,
        releaseNotes: this.extractReleaseNotes(event.releaseNotes),
      });
    });

    autoUpdater.on('error', (error: Error) => {
      this.updateState({
        status: 'error',
        error: error.message,
      });
      this.sendToRenderer('updater:error', { message: error.message });
    });
  }

  /**
   * Extract release notes from various formats
   */
  private extractReleaseNotes(
    notes: string | { version: string; note: string | null }[] | null | undefined
  ): string | undefined {
    if (!notes) return undefined;
    if (typeof notes === 'string') return notes;
    if (Array.isArray(notes)) {
      return notes
        .filter((n) => n.note !== null)
        .map((n) => `${n.version}: ${n.note}`)
        .join('\n');
    }
    return undefined;
  }

  /**
   * Update internal state
   */
  private updateState(partial: Partial<UpdateState>): void {
    this.state = { ...this.state, ...partial };
  }

  /**
   * Send message to renderer process
   */
  private sendToRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (env.development) {
      logger.debug('Skipping update check in development');
      return null;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      return result?.updateInfo ?? null;
    } catch (error) {
      logger.error('Check for updates failed:', error);
      throw error;
    }
  }

  /**
   * Download the available update
   */
  async downloadUpdate(): Promise<void> {
    if (env.development) {
      logger.debug('Skipping download in development');
      return;
    }

    if (this.state.status !== 'available') {
      throw new Error('No update available to download');
    }

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('Download failed:', error);
      throw error;
    }
  }

  /**
   * Quit and install the downloaded update
   */
  quitAndInstall(): void {
    if (!this.updateDownloaded) {
      logger.warn('No update downloaded, cannot install');
      return;
    }

    // Give the app a moment to save state
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 100);
  }

  /**
   * Get current update status
   */
  getStatus(): UpdateState {
    return { ...this.state };
  }

  /**
   * Get current app version
   */
  getVersion(): string {
    return app.getVersion();
  }

  /**
   * Check if an update has been downloaded and is ready to install
   */
  isUpdateReady(): boolean {
    return this.updateDownloaded;
  }
}

// Export singleton instance
export const updaterService = new UpdaterService();
