/**
 * IPC Event Channels
 *
 * One-way events sent from main to renderer
 */
import type { AppNotification } from './types';

export interface IpcEvents {
  'git:status-changed': (repoPath: string) => void;
  'terminal:data': (terminalId: string, data: string) => void;
  'terminal:exit': (terminalId: string, exitCode: number) => void;

  // Updater Events (main -> renderer)
  'updater:checking': () => void;
  'updater:available': (info: {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
  }) => void;
  'updater:not-available': () => void;
  'updater:progress': (progress: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  }) => void;
  'updater:downloaded': (info: {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
  }) => void;
  'updater:error': (error: { message: string }) => void;

  // Notification Events (main -> renderer)
  'notification:push': (notification: AppNotification) => void;
  'notification:batch': (notifications: AppNotification[]) => void;
}
