/**
 * Core IPC channel definitions
 *
 * Covers: echo, fs, contribution, project, settings, dialog, shell,
 * code-server, terminal, dev-scripts, docs, updater
 */
import type {
  FileNode,
  FileContent,
  Contribution,
  AppSettings,
  SSHRemote,
  ShellType,
  TerminalSession,
  DevScript,
  DocsCategory,
} from './types';

export interface CoreChannels {
  // Echo test channel
  echo: (message: string) => string;

  // File System Channels
  'fs:read-directory': (path: string) => FileNode[];
  'fs:read-file': (path: string) => FileContent;
  'fs:write-file': (path: string, content: string) => void;
  'fs:delete-file': (path: string) => void;
  'fs:delete-directory': (path: string) => void;
  'fs:rename-file': (oldPath: string, newPath: string) => void;
  'fs:reveal-in-explorer': (path: string) => void;
  'fs:directory-exists': (path: string) => boolean;

  // Contribution Channels
  'contribution:create': (
    data: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt'>
  ) => Contribution;
  'contribution:get-all': () => Contribution[];
  'contribution:get-by-id': (id: string) => Contribution | null;
  'contribution:update': (id: string, data: Partial<Contribution>) => Contribution;
  'contribution:delete': (id: string) => void;
  'contribution:scan-directory': (directoryPath: string) => Contribution[];
  'contribution:sync-with-github': (contributionId: string) => Contribution;

  // Project Channels
  'project:scan-directory': (directoryPath: string) => Contribution[];

  // Settings Channels
  'settings:get': () => AppSettings;
  'settings:update': (settings: Partial<AppSettings>) => AppSettings;

  // Dialog Channels
  'dialog:open-directory': () => string | null;

  // Shell Channels
  'shell:execute': (command: string) => void;
  'shell:open-external': (url: string) => void;
  'shell:launch-app': (appName: string) => void;

  // Code Server Channels
  'code-server:start': (projectPath: string) => { port: number; url: string };
  'code-server:stop': () => void;
  'code-server:status': () => { running: boolean; port: number | null; url: string | null };
  'code-server:add-workspace': (projectPath: string) => string;
  'code-server:remove-workspace': (projectPath: string) => { shouldStop: boolean };
  'code-server:get-mounted-projects': () => string[];
  'code-server:get-stats': () => {
    cpuPercent: number;
    memUsage: string;
    memLimit: string;
    memPercent: number;
  } | null;

  // SSH Remotes Channels
  'settings:get-ssh-remotes': () => SSHRemote[];
  'settings:save-ssh-remotes': (remotes: SSHRemote[]) => void;

  // Terminal Channels
  'terminal:spawn': (shellType: ShellType, workingDirectory: string) => TerminalSession;
  'terminal:write': (terminalId: string, data: string) => void;
  'terminal:resize': (terminalId: string, cols: number, rows: number) => void;
  'terminal:kill': (terminalId: string) => void;
  'terminal:get-buffer': (terminalId: string) => string | null;

  // Dev Scripts Channels
  'dev-scripts:get-all': (projectPath: string) => DevScript[];
  'dev-scripts:save': (script: DevScript) => void;
  'dev-scripts:delete': (id: string) => void;

  // Documentation Channels
  'docs:get-structure': () => DocsCategory[];

  // Updater Channels
  'updater:check': () => {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
  } | null;
  'updater:download': () => void;
  'updater:install': () => void;
  'updater:get-status': () => {
    status:
      | 'idle'
      | 'checking'
      | 'available'
      | 'not-available'
      | 'downloading'
      | 'downloaded'
      | 'error';
    version?: string;
    releaseDate?: string;
    releaseNotes?: string;
    progress?: number;
    error?: string;
  };
  'updater:get-version': () => string;
}
