import chokidar, { FSWatcher } from 'chokidar';
import { BrowserWindow } from 'electron';
import { sendToRenderer } from '../ipc';

/**
 * File Watcher Service
 *
 * Watches directories for file changes and notifies renderer process
 */
export class FileWatcherService {
  private watchers: Map<string, FSWatcher>;
  private mainWindow: BrowserWindow | null;

  constructor() {
    this.watchers = new Map();
    this.mainWindow = null;
  }

  /**
   * Set the main window reference for sending events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Start watching a directory
   */
  watchDirectory(dirPath: string): void {
    // Don't create duplicate watchers
    if (this.watchers.has(dirPath)) {
      console.log(`Already watching ${dirPath}`);
      return;
    }

    console.log(`Starting to watch ${dirPath}`);

    const watcher = chokidar.watch(dirPath, {
      ignored: [
        /(^|[\/\\])\../, // Ignore dotfiles
        '**/node_modules/**',
        '**/.git/**',
        '**/.vscode/**',
        '**/dist/**',
        '**/build/**',
      ],
      persistent: true,
      ignoreInitial: true, // Don't fire events for initial scan
      awaitWriteFinish: {
        stabilityThreshold: 500, // Wait for file to be stable for 500ms
        pollInterval: 100,
      },
    });

    // File added
    watcher.on('add', (path) => {
      console.log(`File added: ${path}`);
      if (this.mainWindow) {
        sendToRenderer(this.mainWindow, 'fs:file-added', path);
      }
    });

    // File changed
    watcher.on('change', (path) => {
      console.log(`File changed: ${path}`);
      if (this.mainWindow) {
        sendToRenderer(this.mainWindow, 'fs:file-changed', path);
      }
    });

    // File deleted
    watcher.on('unlink', (path) => {
      console.log(`File deleted: ${path}`);
      if (this.mainWindow) {
        sendToRenderer(this.mainWindow, 'fs:file-deleted', path);
      }
    });

    // Directory added
    watcher.on('addDir', (path) => {
      console.log(`Directory added: ${path}`);
      if (this.mainWindow) {
        sendToRenderer(this.mainWindow, 'fs:file-added', path);
      }
    });

    // Directory deleted
    watcher.on('unlinkDir', (path) => {
      console.log(`Directory deleted: ${path}`);
      if (this.mainWindow) {
        sendToRenderer(this.mainWindow, 'fs:file-deleted', path);
      }
    });

    // Error handling
    watcher.on('error', (error) => {
      console.error(`Watcher error for ${dirPath}:`, error);
    });

    // Ready event
    watcher.on('ready', () => {
      console.log(`Watcher ready for ${dirPath}`);
    });

    this.watchers.set(dirPath, watcher);
  }

  /**
   * Stop watching a directory
   */
  async unwatchDirectory(dirPath: string): Promise<void> {
    const watcher = this.watchers.get(dirPath);
    if (watcher) {
      console.log(`Stopping watch for ${dirPath}`);
      await watcher.close();
      this.watchers.delete(dirPath);
    }
  }

  /**
   * Stop all watchers
   */
  async unwatchAll(): Promise<void> {
    console.log('Stopping all file watchers');
    const closePromises = Array.from(this.watchers.values()).map((watcher) =>
      watcher.close()
    );
    await Promise.all(closePromises);
    this.watchers.clear();
  }

  /**
   * Get all watched directories
   */
  getWatchedDirectories(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Check if a directory is being watched
   */
  isWatching(dirPath: string): boolean {
    return this.watchers.has(dirPath);
  }
}

// Export singleton instance
export const fileWatcherService = new FileWatcherService();
