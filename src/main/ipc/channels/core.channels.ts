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
  ProjectInfo,
  SetUpActionResult,
  CleanTarget,
  DiskUsageResult,
  Ecosystem,
  EnvScanResult,
  EnvFileInfo,
  EnvSyncResult,
  HookTool,
  HookConfig,
  HooksDetectionResult,
  HooksSetupResult,
  GitHookName,
  HookAction,
  LintStagedConfig,
  LintStagedRule,
  EditorConfigFile,
  EditorConfigSection,
  FormatterType,
  FormatterInfo,
  FormatterConfig,
  PrettierConfig,
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

  // Dev Tools Channels
  'dev-tools:detect-project': (workingDirectory: string) => ProjectInfo;
  'dev-tools:get-install-command': (workingDirectory: string) => string | null;
  'dev-tools:get-typecheck-command': (workingDirectory: string) => string | null;
  'dev-tools:get-git-init-command': () => string;
  'dev-tools:get-hooks-command': (workingDirectory: string) => string | null;
  'dev-tools:setup-env-file': (workingDirectory: string) => SetUpActionResult;
  'dev-tools:get-clean-targets': (workingDirectory: string) => CleanTarget[];
  'dev-tools:disk-usage': (workingDirectory: string) => DiskUsageResult;
  'dev-tools:project-info': (workingDirectory: string) => ProjectInfo;

  // Dev Tools — Env File Management Channels
  'dev-tools:scan-env-variables': (workingDirectory: string, ecosystem: Ecosystem) => EnvScanResult;
  'dev-tools:discover-env-files': (workingDirectory: string) => EnvFileInfo[];
  'dev-tools:create-env-example': (
    workingDirectory: string,
    ecosystem: Ecosystem
  ) => SetUpActionResult;
  'dev-tools:create-env-file': (workingDirectory: string, targetName: string) => SetUpActionResult;
  'dev-tools:read-env-file': (filePath: string) => string;
  'dev-tools:write-env-file': (filePath: string, content: string) => SetUpActionResult;
  'dev-tools:sync-env-files': (workingDirectory: string, ecosystem: Ecosystem) => EnvSyncResult;

  // Dev Tools — Hooks Management Channels
  'dev-tools:detect-hooks': (
    workingDirectory: string,
    ecosystem: Ecosystem
  ) => HooksDetectionResult;
  'dev-tools:setup-hook-tool': (
    workingDirectory: string,
    tool: HookTool,
    ecosystem: Ecosystem
  ) => HooksSetupResult;
  'dev-tools:get-hook-install-cmd': (tool: HookTool) => string;
  'dev-tools:read-hooks-config': (workingDirectory: string, tool: HookTool) => HookConfig;
  'dev-tools:write-hooks-config': (
    workingDirectory: string,
    config: HookConfig
  ) => SetUpActionResult;
  'dev-tools:setup-lint-staged': (
    workingDirectory: string,
    config: LintStagedConfig
  ) => SetUpActionResult;
  'dev-tools:get-hook-presets': (
    ecosystem: Ecosystem,
    tool: HookTool
  ) => Record<GitHookName, HookAction[]>;
  'dev-tools:get-lint-staged-presets': (ecosystem: Ecosystem) => LintStagedRule[];

  // Dev Tools — EditorConfig Management Channels
  'dev-tools:read-editorconfig': (workingDirectory: string) => EditorConfigFile;
  'dev-tools:write-editorconfig': (
    workingDirectory: string,
    config: EditorConfigFile
  ) => SetUpActionResult;
  'dev-tools:create-editorconfig': (
    workingDirectory: string,
    ecosystem: Ecosystem
  ) => SetUpActionResult;
  'dev-tools:delete-editorconfig': (workingDirectory: string) => SetUpActionResult;
  'dev-tools:get-editorconfig-presets': (ecosystem: Ecosystem) => EditorConfigSection[];

  // Dev Tools — Format Config Management Channels
  'dev-tools:detect-formatter': (workingDirectory: string, ecosystem: Ecosystem) => FormatterInfo;
  'dev-tools:read-format-config': (configPath: string, formatter: FormatterType) => FormatterConfig;
  'dev-tools:write-format-config': (
    workingDirectory: string,
    formatter: FormatterType,
    config: PrettierConfig | Record<string, unknown>
  ) => SetUpActionResult;
  'dev-tools:get-format-presets': (
    ecosystem: Ecosystem,
    formatter: FormatterType | null
  ) => PrettierConfig | Record<string, unknown>;
  'dev-tools:create-format-ignore': (
    workingDirectory: string,
    formatter: FormatterType
  ) => SetUpActionResult;
  'dev-tools:read-format-ignore': (workingDirectory: string, formatter: FormatterType) => string;
  'dev-tools:write-format-ignore': (
    workingDirectory: string,
    formatter: FormatterType,
    content: string
  ) => SetUpActionResult;
}
