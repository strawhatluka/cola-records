/**
 * CodeServerService
 *
 * Manages the lifecycle of a code-server Docker container for embedding
 * VS Code into the Development screen. Handles port allocation, volume
 * mounts, settings sync, git configuration, and container start/stop.
 */

import { app } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { database } from '../database/database.service';
import type { Alias, BashProfileSettings, SSHRemote, TerminalColor } from '../ipc/channels';
const execFileAsync = promisify(execFile);

interface CodeServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
}

interface CodeServerStartResult {
  port: number;
  url: string;
}

/**
 * Cached workspace paths from settings.
 * Used for host-to-container path mapping.
 */
interface WorkspaceBasePaths {
  contributions: string | null;
  myProjects: string | null;
  professional: string | null;
}

class CodeServerService {
  private containerName: string | null = null;
  private port: number | null = null;
  private running = false;
  private starting = false;

  // Multi-project support: track all mounted workspace folders
  private mountedProjects: Set<string> = new Set();

  // Cached workspace base paths for path mapping (set when container created)
  private workspaceBasePaths: WorkspaceBasePaths | null = null;

  // ── Port Management ──────────────────────────────────────────────

  /**
   * Find a free port by binding to port 0 and reading the assigned port.
   */
  async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Failed to get port from server address')));
        }
      });
      server.on('error', reject);
    });
  }

  // ── Persistent Storage Paths ─────────────────────────────────────

  /**
   * Root directory for code-server persistent data.
   * Uses Electron's userData path for cross-platform compatibility.
   */
  getUserDataDir(): string {
    return path.join(app.getPath('userData'), 'code-server');
  }

  /**
   * Directory for persisted VS Code extensions.
   */
  getExtensionsDir(): string {
    return path.join(this.getUserDataDir(), 'extensions');
  }

  // ── Path Utilities ───────────────────────────────────────────────

  /**
   * Convert a Windows path to forward slashes for Docker volume mounts.
   * On non-Windows platforms, returns the path as-is.
   */
  toDockerPath(hostPath: string): string {
    if (process.platform === 'win32') {
      // Convert C:\Users\... to /c/Users/...
      return hostPath
        .replace(/\\/g, '/')
        .replace(/^([A-Za-z]):/, (_match, drive: string) => `/${drive.toLowerCase()}`);
    }
    return hostPath;
  }

  // ── Host Config Sync ─────────────────────────────────────────────

  /**
   * Get the host VS Code settings.json path (cross-platform).
   */
  private getHostVSCodeSettingsPath(): string {
    switch (process.platform) {
      case 'win32':
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
      case 'darwin':
        return path.join(
          os.homedir(),
          'Library',
          'Application Support',
          'Code',
          'User',
          'settings.json'
        );
      default: // linux
        return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
    }
  }

  /**
   * Strip JSONC (JSON with Comments) to valid JSON.
   * Removes line comments, block comments, and trailing commas.
   */
  private stripJsonc(text: string): string {
    let result = '';
    let i = 0;
    let inString = false;

    while (i < text.length) {
      // Handle string literals (skip comment detection inside strings)
      if (text[i] === '"' && (i === 0 || text[i - 1] !== '\\')) {
        inString = !inString;
        result += text[i];
        i++;
        continue;
      }

      if (inString) {
        result += text[i];
        i++;
        continue;
      }

      // Line comment
      if (text[i] === '/' && text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++;
        continue;
      }

      // Block comment
      if (text[i] === '/' && text[i + 1] === '*') {
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i += 2;
        continue;
      }

      result += text[i];
      i++;
    }

    // Remove trailing commas before } or ]
    return result.replace(/,\s*([}\]])/g, '$1');
  }

  /**
   * Copy host VS Code settings.json into the code-server user data directory,
   * then inject required overrides for workspace trust and git.
   * Handles JSONC format (comments + trailing commas) that VS Code uses.
   */
  syncVSCodeSettings(): void {
    const hostSettingsPath = this.getHostVSCodeSettingsPath();
    const codeServerSettingsDir = path.join(this.getUserDataDir(), 'User');
    const codeServerSettingsPath = path.join(codeServerSettingsDir, 'settings.json');

    try {
      fs.mkdirSync(codeServerSettingsDir, { recursive: true });

      // Start with host settings as the base layer
      let hostSettings: Record<string, unknown> = {};
      if (fs.existsSync(hostSettingsPath)) {
        const raw = fs.readFileSync(hostSettingsPath, 'utf-8');
        const cleanJson = this.stripJsonc(raw);
        hostSettings = JSON.parse(cleanJson);
      }
      // No else needed - hostSettings defaults to empty object

      // Load existing code-server settings (preserves theme, font size, etc.
      // changed by the user inside the embedded VS Code)
      let existingSettings: Record<string, unknown> = {};
      if (fs.existsSync(codeServerSettingsPath)) {
        try {
          const raw = fs.readFileSync(codeServerSettingsPath, 'utf-8');
          existingSettings = JSON.parse(raw);
        } catch {
          // Ignore parse errors; use empty settings as fallback
        }
      }

      // Merge: host settings as base, existing code-server settings on top
      // (so user changes inside code-server are preserved), then required overrides last
      const settings: Record<string, unknown> = {
        ...hostSettings,
        ...existingSettings,
      };

      // Required overrides (always applied regardless of user changes)
      settings['security.workspace.trust.enabled'] = false;
      settings['git.enabled'] = true;
      settings['git.path'] = '/usr/bin/git';

      // Terminal profile: use system bash (our bashrc is mounted to /etc/bash.bashrc)
      settings['terminal.integrated.defaultProfile.linux'] = 'bash';
      settings['terminal.integrated.profiles.linux'] = {
        bash: {
          path: '/bin/bash',
        },
      };

      // Terminal performance optimizations
      settings['terminal.integrated.smoothScrolling'] = false;
      settings['terminal.integrated.gpuAcceleration'] = 'on';
      settings['terminal.integrated.fastScrollSensitivity'] = 5;
      settings['terminal.integrated.scrollback'] = 1000; // Reduce from default 10000

      fs.writeFileSync(codeServerSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch {
      // Settings sync is best-effort
    }
  }

  /**
   * Create a gitconfig file in the user data directory that:
   * 1. Embeds the host .gitconfig content (with CRLF normalized to LF)
   * 2. Sets safe.directory = * (trust bind-mounted project)
   * 3. Sets credential.helper = store (use mounted .git-credentials)
   *
   * We embed the host config directly instead of using [include] because
   * git's include parser on Linux silently fails when the included file
   * has Windows CRLF line endings.
   *
   * This file is referenced via GIT_CONFIG_GLOBAL env var in the container.
   */
  createContainerGitConfig(): void {
    const gitconfigPath = path.join(this.getUserDataDir(), 'gitconfig');
    const hostGitconfig = path.join(os.homedir(), '.gitconfig');

    const parts: string[] = [];

    // Embed host gitconfig content directly (normalized to LF)
    if (fs.existsSync(hostGitconfig)) {
      try {
        const hostContent = fs.readFileSync(hostGitconfig, 'utf-8');
        // Normalize CRLF to LF for Linux compatibility
        const normalized = hostContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        parts.push('# --- Host .gitconfig (embedded) ---');
        parts.push(normalized.trimEnd());
        parts.push('');
      } catch {
        // Ignore read errors; proceed without host gitconfig
      }
    }

    // Append our required overrides
    parts.push('# --- Cola Records overrides ---');
    parts.push('[safe]');
    parts.push('    directory = *');
    parts.push('');
    parts.push('[core]');
    parts.push('    autocrlf = input');
    parts.push('');
    parts.push('[credential]');
    parts.push('    helper = store');
    parts.push('');

    const content = parts.join('\n');

    try {
      fs.mkdirSync(this.getUserDataDir(), { recursive: true });
      fs.writeFileSync(gitconfigPath, content, 'utf-8');
    } catch {
      // Gitconfig creation is best-effort
    }
  }

  /**
   * Map terminal color names to ANSI escape codes.
   */
  private getColorCode(color: TerminalColor): string {
    const colorMap: Record<TerminalColor, string> = {
      green: '\\033[01;32m',
      blue: '\\033[01;34m',
      cyan: '\\033[01;36m',
      red: '\\033[01;31m',
      yellow: '\\033[01;33m',
      magenta: '\\033[01;35m',
      white: '\\033[01;37m',
    };
    return colorMap[color] || colorMap.green;
  }

  /**
   * Get bash profile settings from database with sensible defaults.
   */
  private getBashProfileSettings(): BashProfileSettings {
    const defaults: BashProfileSettings = {
      showUsername: true,
      showGitBranch: true,
      usernameColor: 'green',
      pathColor: 'blue',
      gitBranchColor: 'yellow',
    };

    try {
      const settingsJson = database.getSetting('bashProfile');
      if (settingsJson) {
        const parsed = JSON.parse(settingsJson) as Partial<BashProfileSettings>;
        return { ...defaults, ...parsed };
      }
    } catch {
      // Settings loading is best-effort
    }

    return defaults;
  }

  /**
   * Create a .bashrc file for the container terminal.
   * Uses configurable prompt settings from the database.
   * The file is written to userDataDir/.bashrc which becomes /config/.bashrc
   * in the container (the home directory for the 'abc' user).
   */
  createContainerBashrc(projectPath: string): void {
    const bashrcPath = path.join(this.getUserDataDir(), '.bashrc');
    const projectName = path.basename(projectPath);
    const bashProfile = this.getBashProfileSettings();
    // Use custom username if set, otherwise fall back to OS username
    const username = bashProfile.customUsername?.trim() || os.userInfo().username;

    const lines = [
      '# Cola Records container shell profile',
      '',
      '# Node.js, npm, and Python are pre-installed in the Docker image',
      '# and are available in the default PATH (/usr/bin)',
      '',
      '# Git branch helper',
      '__git_branch() {',
      '  git symbolic-ref --short HEAD 2>/dev/null',
      '}',
      '',
      '# Show path relative to project root using actual host folder name',
      `# /config/workspace -> ${projectName}, /config/workspace/src -> ${projectName}/src`,
      '__project_path() {',
      '  local cwd="$PWD"',
      '  local project_root="/config/workspace"',
      `  local project_name="${projectName}"`,
      '  case "$cwd" in',
      '    "$project_root")',
      '      echo "$project_name"',
      '      ;;',
      '    "$project_root/"*)',
      '      echo "$project_name${cwd#$project_root}"',
      '      ;;',
      '    *)',
      '      echo "$cwd"',
      '      ;;',
      '  esac',
      '}',
      '',
    ];

    // Build dynamic PS1 prompt based on settings
    const resetCode = '\\033[00m';
    const promptParts: string[] = [];

    // Username (optional, with configurable color)
    if (bashProfile.showUsername) {
      const usernameColor = this.getColorCode(bashProfile.usernameColor);
      promptParts.push(`\\[${usernameColor}\\]${username}\\[${resetCode}\\] `);
    }

    // Path (always shown, with configurable color)
    const pathColor = this.getColorCode(bashProfile.pathColor);
    promptParts.push(`\\[${pathColor}\\]$(__project_path)\\[${resetCode}\\]`);

    // Git branch (optional, with configurable color)
    if (bashProfile.showGitBranch) {
      const gitColor = this.getColorCode(bashProfile.gitBranchColor);
      promptParts.push(
        `\\[${gitColor}\\]$(b=$(__git_branch); [ -n "$b" ] && echo " ($b)")\\[${resetCode}\\]`
      );
    }

    // Add prompt symbol
    promptParts.push('\\$ ');

    lines.push('# Prompt (configurable via Settings > Bash Profile)');
    lines.push(`PS1='${promptParts.join('')}'`);
    lines.push('');
    lines.push('# Aliases (defaults + user-defined from Settings)');

    // Build alias map: defaults first, then user aliases override by name
    const aliasMap = new Map<string, string>([
      ['ll', 'ls -la --color=auto'],
      ['gs', 'git status'],
      ['gd', 'git diff'],
      ['gl', 'git log --oneline -20'],
    ]);

    // Read user aliases from database
    try {
      const aliasesJson = database.getSetting('aliases');
      if (aliasesJson) {
        const userAliases: Alias[] = JSON.parse(aliasesJson);
        for (const a of userAliases) {
          if (a.name && a.command) {
            aliasMap.set(a.name, a.command);
          }
        }
      }
    } catch {
      // Alias loading is best-effort
    }

    for (const [name, command] of aliasMap) {
      lines.push(`alias ${name}="${command}"`);
    }
    lines.push('');

    const content = lines.join('\n');

    try {
      fs.mkdirSync(this.getUserDataDir(), { recursive: true });
      fs.writeFileSync(bashrcPath, content, 'utf-8');
    } catch {
      // Bashrc creation is best-effort
    }
  }

  /**
   * Build Docker -v arguments for git credentials.
   * Only mounts files that exist on the host.
   * Note: .gitconfig is no longer mounted — its content is embedded directly
   * into the container gitconfig to avoid CRLF line ending issues.
   */
  getGitMounts(): string[] {
    const mounts: string[] = [];
    const gitCredentials = path.join(os.homedir(), '.git-credentials');

    // LinuxServer.io uses 'abc' user with home at /config
    if (fs.existsSync(gitCredentials)) {
      mounts.push('-v', `${this.toDockerPath(gitCredentials)}:/config/.git-credentials:ro`);
    }

    return mounts;
  }

  /**
   * Check if bashrc file exists.
   * The bashrc is written to userDataDir/.bashrc which becomes /config/.bashrc
   * in the container via the main /config volume mount. No separate mount needed.
   */
  getBashrcMount(): string[] {
    // The bashrc file is now inside userDataDir, so it's automatically
    // available at /config/.bashrc through the main /config volume mount.
    // This method is kept for API compatibility but returns empty.
    return [];
  }

  /**
   * Get Docker volume mounts for Claude Code config.
   *
   * Returns empty array because Claude Code credentials persist automatically:
   * 1. LinuxServer.io abc user has home at /config
   * 2. We mount userDataDir to /config (persistent volume)
   * 3. CLAUDE_CONFIG_DIR=/config/.claude puts credentials inside the persistent volume
   *
   * No separate mount is needed - credentials are stored in /config/.claude/.credentials.json
   * which persists because /config is already our persistent userDataDir mount.
   *
   * IMPORTANT: We use /config/.claude (not ~/.claude on host) to prevent conflicts with
   * the host's Claude Code config. Both instances writing to the same file would cause
   * JSON corruption.
   */
  getClaudeMounts(): string[] {
    // No mount needed - credentials persist in /config/.claude via the main /config mount
    return [];
  }

  // ── Multi-Project Workspace Mounts ─────────────────────────────────

  /**
   * Workspace mount configuration for the three user-configured project directories.
   * Maps host paths from settings to container paths.
   */
  private static readonly WORKSPACE_MOUNTS = {
    contributions: '/config/workspaces/contributions',
    'my-projects': '/config/workspaces/my-projects',
    professional: '/config/workspaces/professional',
  } as const;

  /**
   * Load workspace base paths from database settings.
   * Called when creating a container to cache paths for path mapping.
   */
  private loadWorkspaceBasePaths(): WorkspaceBasePaths {
    const paths: WorkspaceBasePaths = {
      contributions: database.getSetting('defaultClonePath') || null,
      myProjects: database.getSetting('defaultProjectsPath') || null,
      professional: database.getSetting('defaultProfessionalProjectsPath') || null,
    };
    this.workspaceBasePaths = paths;
    return paths;
  }

  /**
   * Get the cached workspace base paths.
   * Returns null if container hasn't been started yet.
   */
  getWorkspaceBasePaths(): WorkspaceBasePaths | null {
    return this.workspaceBasePaths;
  }

  /**
   * Determine which workspace category a host path belongs to.
   * @param hostPath - Full host path to a project (e.g., C:\Dev\Contributions\repo-a)
   * @returns The category ('contributions', 'my-projects', 'professional') or null if not found
   */
  getWorkspaceCategory(hostPath: string): 'contributions' | 'my-projects' | 'professional' | null {
    if (!this.workspaceBasePaths) {
      // Try to load paths if not cached
      this.loadWorkspaceBasePaths();
    }

    const paths = this.workspaceBasePaths;
    if (!paths) return null;

    // Normalize path for comparison (forward slashes, lowercase on Windows)
    const normalize = (p: string): string => {
      const normalized = p.replace(/\\/g, '/');
      return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    };

    const normalizedHostPath = normalize(hostPath);

    // Check each category - path must start with the base path
    if (paths.contributions) {
      const base = normalize(paths.contributions);
      if (normalizedHostPath.startsWith(base + '/') || normalizedHostPath === base) {
        return 'contributions';
      }
    }

    if (paths.myProjects) {
      const base = normalize(paths.myProjects);
      if (normalizedHostPath.startsWith(base + '/') || normalizedHostPath === base) {
        return 'my-projects';
      }
    }

    if (paths.professional) {
      const base = normalize(paths.professional);
      if (normalizedHostPath.startsWith(base + '/') || normalizedHostPath === base) {
        return 'professional';
      }
    }

    return null;
  }

  /**
   * Map a host path to its container path.
   * @param hostPath - Full host path to a project (e.g., C:\Dev\Contributions\repo-a)
   * @returns Container path (e.g., /config/workspaces/contributions/repo-a) or null if not mapped
   */
  hostToContainerPath(hostPath: string): string | null {
    const category = this.getWorkspaceCategory(hostPath);
    if (!category || !this.workspaceBasePaths) return null;

    // Get the base path for this category
    const basePath =
      category === 'contributions'
        ? this.workspaceBasePaths.contributions
        : category === 'my-projects'
          ? this.workspaceBasePaths.myProjects
          : this.workspaceBasePaths.professional;

    if (!basePath) return null;

    // Get the relative path from the base
    const normalize = (p: string): string => p.replace(/\\/g, '/');
    const normalizedHostPath = normalize(hostPath);
    const normalizedBasePath = normalize(basePath);

    // Extract relative path (everything after base path)
    let relativePath = '';
    if (normalizedHostPath.length > normalizedBasePath.length) {
      relativePath = normalizedHostPath.slice(normalizedBasePath.length);
      // Ensure it starts with /
      if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
      }
    }

    // Build container path
    const containerBase = CodeServerService.WORKSPACE_MOUNTS[category];
    return containerBase + relativePath;
  }

  /**
   * Get Docker volume mount arguments for all configured workspace directories.
   * Mounts the three user-configured project parent directories:
   * - defaultClonePath → /config/workspaces/contributions
   * - defaultProjectsPath → /config/workspaces/my-projects
   * - defaultProfessionalProjectsPath → /config/workspaces/professional
   *
   * Only includes mounts for directories that are configured and exist.
   * This enables seamless project switching without container recreation.
   *
   * @returns Array of Docker -v arguments for volume mounts
   */
  getWorkspaceMounts(): string[] {
    const mounts: string[] = [];

    // Get the three workspace paths from settings
    const contributionsPath = database.getSetting('defaultClonePath');
    const myProjectsPath = database.getSetting('defaultProjectsPath');
    const professionalPath = database.getSetting('defaultProfessionalProjectsPath');

    // Mount contributions directory (defaultClonePath)
    if (contributionsPath && fs.existsSync(contributionsPath)) {
      mounts.push(
        '-v',
        `${this.toDockerPath(contributionsPath)}:${CodeServerService.WORKSPACE_MOUNTS.contributions}`
      );
    }

    // Mount my-projects directory (defaultProjectsPath)
    if (myProjectsPath && fs.existsSync(myProjectsPath)) {
      mounts.push(
        '-v',
        `${this.toDockerPath(myProjectsPath)}:${CodeServerService.WORKSPACE_MOUNTS['my-projects']}`
      );
    }

    // Mount professional directory (defaultProfessionalProjectsPath)
    if (professionalPath && fs.existsSync(professionalPath)) {
      mounts.push(
        '-v',
        `${this.toDockerPath(professionalPath)}:${CodeServerService.WORKSPACE_MOUNTS.professional}`
      );
    }

    return mounts;
  }

  // ── SSH Config Sync ──────────────────────────────────────────────

  /**
   * Get SSH remotes from database.
   */
  private getSSHRemotes(): SSHRemote[] {
    try {
      const json = database.getSetting('sshRemotes');
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate SSH config file from saved remotes.
   * Creates: {userDataDir}/.ssh/config
   * Also copies private keys into {userDataDir}/.ssh/keys/ with correct permissions.
   *
   * This approach copies keys rather than mounting them because:
   * 1. Mounted files in Docker don't respect chmod (permissions come from host)
   * 2. SSH requires strict 600 permissions on private keys
   * 3. The whole .ssh directory is mounted, so permissions are set correctly inside container
   */
  syncSSHConfig(): void {
    const remotes = this.getSSHRemotes();
    const sshDir = path.join(this.getUserDataDir(), '.ssh');
    const keysDir = path.join(sshDir, 'keys');
    const configPath = path.join(sshDir, 'config');

    // Ensure .ssh and .ssh/keys directories exist
    fs.mkdirSync(keysDir, { recursive: true });

    if (remotes.length === 0) {
      // Remove config if no remotes
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      return;
    }

    const lines: string[] = ['# Cola Records SSH Config', ''];

    for (const remote of remotes) {
      // Handle both Windows and Unix path separators for cross-platform compatibility
      const keyBasename = remote.keyPath.split(/[/\\]/).pop() || path.basename(remote.keyPath);
      const containerKeyPath = `/config/.ssh/keys/${keyBasename}`;

      // Copy the private key to our keys directory (if it exists on host)
      if (fs.existsSync(remote.keyPath)) {
        const destKeyPath = path.join(keysDir, keyBasename);
        try {
          fs.copyFileSync(remote.keyPath, destKeyPath);
          // Note: On Windows, chmod doesn't work, but that's fine because
          // the container runs Linux and will see proper permissions from the mounted volume
        } catch (err) {
          console.error(`[CodeServer] Failed to copy SSH key ${remote.keyPath}:`, err);
        }
      }

      lines.push(`Host ${remote.name}`);
      lines.push(`    HostName ${remote.hostname}`);
      lines.push(`    User ${remote.user}`);
      lines.push(`    Port ${remote.port}`);
      lines.push(`    IdentityFile ${containerKeyPath}`);
      if (remote.identitiesOnly) {
        lines.push('    IdentitiesOnly yes');
      }
      lines.push('    ServerAliveInterval 60');
      lines.push('    ServerAliveCountMax 3');
      lines.push('');
    }

    fs.writeFileSync(configPath, lines.join('\n'), 'utf-8');
  }

  /**
   * Build Docker -v arguments for SSH directory.
   * Mounts the entire .ssh directory (which contains config and copied keys).
   *
   * The .ssh directory is mounted read-write (not read-only) because:
   * 1. SSH may need to create known_hosts file on first connection
   * 2. The abc user needs to be able to manage SSH state
   */
  getSSHMounts(): string[] {
    const sshDir = path.join(this.getUserDataDir(), '.ssh');
    const configPath = path.join(sshDir, 'config');

    // Only mount if SSH config exists (meaning user has configured remotes)
    if (fs.existsSync(configPath)) {
      return ['-v', `${this.toDockerPath(sshDir)}:/config/.ssh`];
    }

    return [];
  }

  /**
   * Fix SSH directory permissions inside the container.
   * Windows mounts files as root, but the abc user needs to own them.
   * SSH requires strict permissions (700 for .ssh, 600 for keys).
   */
  private async fixSSHPermissions(): Promise<void> {
    try {
      // Check if .ssh directory exists in container
      await this.dockerExec([
        'exec',
        CodeServerService.getContainerName(),
        'sh',
        '-c',
        'if [ -d /config/.ssh ]; then chown -R abc:abc /config/.ssh && chmod 700 /config/.ssh && chmod 600 /config/.ssh/config 2>/dev/null; chmod 700 /config/.ssh/keys 2>/dev/null; chmod 600 /config/.ssh/keys/* 2>/dev/null; fi',
      ]);
    } catch {
      // SSH permission fix is best-effort (may not have .ssh directory)
    }
  }

  // ── Docker Operations ────────────────────────────────────────────

  /**
   * Check if Docker is available and running.
   * If Docker is not running, attempts to auto-start Docker Desktop
   * and polls until it becomes available (up to 60 seconds).
   * Throws with a clear message if Docker cannot be started.
   */
  async checkDockerAvailable(): Promise<void> {
    // Quick check — Docker may already be running
    try {
      await this.dockerExec(['info', '--format', '{{.ServerVersion}}']);
      return;
    } catch {
      // Docker not available yet
    }

    // Attempt to auto-start Docker Desktop
    console.log('[CodeServer] Docker not running, attempting to start Docker Desktop...');
    await this.launchDockerDesktop();

    // Poll until Docker responds
    const maxAttempts = 30; // 30 × 2s = 60 seconds
    const delay = 2000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        await this.dockerExec(['info', '--format', '{{.ServerVersion}}']);
        console.log(`[CodeServer] Docker became available after ${attempt * 2} seconds`);
        return;
      } catch {
        // Still not ready
      }
    }

    throw new Error(
      'Docker Desktop is not running. Please start Docker Desktop and try again.\n\n' +
        'If Docker is not installed, download it from: https://www.docker.com/products/docker-desktop/'
    );
  }

  /**
   * Attempt to launch Docker Desktop using platform-specific commands.
   * This is best-effort — failures are silently ignored since the
   * polling loop in checkDockerAvailable() will handle the result.
   */
  private async launchDockerDesktop(): Promise<void> {
    try {
      switch (process.platform) {
        case 'darwin':
          await execFileAsync('open', ['-a', 'Docker']);
          break;
        case 'win32': {
          const programFiles = process.env.ProgramW6432 || 'C:\\Program Files';
          await execFileAsync(
            path.join(programFiles, 'Docker', 'Docker', 'Docker Desktop.exe'),
            []
          );
          break;
        }
        default: // linux
          await execFileAsync('systemctl', ['--user', 'start', 'docker-desktop']);
          break;
      }
    } catch {
      // Launch attempt is best-effort; polling will handle the result
    }
  }

  /**
   * Execute a Docker CLI command and return stdout.
   */
  async dockerExec(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('docker', args, {
      timeout: 120_000, // 2 minute timeout for slow operations like image pull
    });
    return stdout.trim();
  }

  /**
   * Poll the code-server until it responds.
   * LinuxServer.io image takes longer to initialize due to s6-overlay.
   * Retries every second for up to 90 seconds.
   */
  async waitForReady(port: number): Promise<void> {
    const maxAttempts = 90;
    const delay = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Try root endpoint - code-server will redirect to login or workspace
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          redirect: 'manual', // Don't follow redirects, just check for response
        });
        // Any response (200, 302, etc.) means server is ready
        if (response.status > 0) {
          return;
        }
      } catch {
        // Connection refused — container not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw new Error(`code-server did not become ready within ${maxAttempts} seconds`);
  }

  // ── Image Management ─────────────────────────────────────────────

  /**
   * Get the path to the Dockerfile for building the custom image.
   * The Dockerfile is located in the docker/code-server directory.
   */
  private getDockerfilePath(): string {
    // In production, use the app's resource path; in development, use project root
    const isDev = !app.isPackaged;
    if (isDev) {
      return path.join(app.getAppPath(), 'docker', 'code-server');
    }
    // In production, the docker directory is copied to resources
    return path.join(process.resourcesPath, 'docker', 'code-server');
  }

  /**
   * Check if the cola-code-server image exists, build it if not.
   * This ensures the custom image with pre-installed tools is available.
   */
  async ensureImageExists(): Promise<void> {
    const imageName = 'cola-code-server:latest';

    try {
      // Check if image already exists
      const images = await this.dockerExec(['images', '-q', imageName]);
      if (images.trim()) {
        console.log('[CodeServer] Image cola-code-server:latest already exists');
        return;
      }
    } catch {
      // Error checking images - proceed to build
    }

    console.log('[CodeServer] Building cola-code-server image (this may take a few minutes)...');

    // Use native path for docker build (not Docker mount path format)
    const dockerfilePath = this.getDockerfilePath();

    try {
      // Build the image from our Dockerfile with extended timeout
      const { stdout } = await execFileAsync('docker', ['build', '-t', imageName, dockerfilePath], {
        timeout: 600_000, // 10 minute timeout for image build (includes npm installs)
      });
      console.log('[CodeServer] Image build output:', stdout);
      console.log('[CodeServer] Image cola-code-server:latest built successfully');
    } catch (err) {
      console.error('[CodeServer] Failed to build image:', err);
      throw new Error(
        'Failed to build cola-code-server Docker image. Please check Docker is running and try again.\n\n' +
          `Dockerfile location: ${dockerfilePath}`
      );
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /** Base container name for persistence across sessions */
  private static readonly CONTAINER_NAME_BASE = 'cola-code-server';

  /**
   * Get container name based on environment.
   * Development mode uses a separate container to avoid conflicts with production.
   */
  private static getContainerName(): string {
    return app.isPackaged
      ? CodeServerService.CONTAINER_NAME_BASE
      : `${CodeServerService.CONTAINER_NAME_BASE}-dev`;
  }

  /**
   * Check if the persistent container exists (running or stopped).
   * Returns: 'running' | 'stopped' | 'none'
   */
  async getContainerState(): Promise<'running' | 'stopped' | 'none'> {
    try {
      const result = await this.dockerExec([
        'inspect',
        '--format',
        '{{.State.Running}}',
        CodeServerService.getContainerName(),
      ]);
      return result.trim() === 'true' ? 'running' : 'stopped';
    } catch {
      return 'none';
    }
  }

  /**
   * Check if the existing container has the new multi-mount configuration.
   * Returns true if the container has /config/workspaces mounts.
   */
  async hasMultiMountConfiguration(): Promise<boolean> {
    try {
      const result = await this.dockerExec([
        'inspect',
        '--format',
        '{{range .Mounts}}{{.Destination}} {{end}}',
        CodeServerService.getContainerName(),
      ]);
      // Check if any mount points to /config/workspaces
      return result.includes('/config/workspaces');
    } catch {
      return false;
    }
  }

  /**
   * Get the host port mapped to the container's 8443 port.
   */
  async getContainerPort(): Promise<number | null> {
    try {
      const result = await this.dockerExec([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "8443/tcp") 0).HostPort}}',
        CodeServerService.getContainerName(),
      ]);
      const port = parseInt(result.trim(), 10);
      return isNaN(port) ? null : port;
    } catch {
      return null;
    }
  }

  /**
   * Get the workspace path currently mounted in the container.
   * Returns null if container doesn't exist or path can't be determined.
   */
  async getContainerWorkspacePath(): Promise<string | null> {
    try {
      // Get the mount source for /config/workspace
      const result = await this.dockerExec([
        'inspect',
        '--format',
        '{{range .Mounts}}{{if eq .Destination "/config/workspace"}}{{.Source}}{{end}}{{end}}',
        CodeServerService.getContainerName(),
      ]);
      const mountPath = result.trim();
      return mountPath || null;
    } catch {
      return null;
    }
  }

  /**
   * Remove the container to allow recreation with new mounts.
   */
  async removeContainer(): Promise<void> {
    try {
      await this.dockerExec(['rm', '-f', CodeServerService.getContainerName()]);
      console.log('[CodeServer] Removed container for recreation');
    } catch {
      // Container may not exist
    }
  }

  /**
   * Start a code-server Docker container for the given project path.
   *
   * Uses a persistent container that survives app restarts:
   * - If container exists and is stopped → start it
   * - If container exists and is running → reuse it (no workspace comparison)
   * - If container doesn't exist → create it with all workspace mounts
   *
   * The container mounts all three workspace directories at creation.
   * Project switching is handled via URL `?folder=` parameter, not container recreation.
   *
   * This preserves npm packages, extensions, Claude auth, and other state.
   */
  async start(projectPath: string): Promise<CodeServerStartResult> {
    // Guard against concurrent starts (React strict mode double-mount)
    if (this.starting) {
      while (this.starting) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (this.running && this.port) {
        // Return URL with folder parameter for the requested project
        const containerPath = this.hostToContainerPath(projectPath);
        const folderParam = containerPath ? `?folder=${encodeURIComponent(containerPath)}` : '';
        return { port: this.port, url: `http://127.0.0.1:${this.port}/${folderParam}` };
      }
    }

    this.starting = true;

    try {
      // Step 1: Verify Docker
      await this.checkDockerAvailable();

      // Step 2: Ensure our custom image exists (build if needed)
      await this.ensureImageExists();

      // Step 3: Sync settings and create config files
      this.syncVSCodeSettings();
      this.createContainerGitConfig();
      this.createContainerBashrc(projectPath);
      this.syncSSHConfig();

      // Step 4: Ensure config dir exists
      const userDataDir = this.getUserDataDir();
      fs.mkdirSync(userDataDir, { recursive: true });

      // Step 5: Check container state and mount configuration
      let containerState = await this.getContainerState();
      let port: number;

      // If container exists, check if it has the new multi-mount configuration
      if (containerState !== 'none') {
        const hasMultiMount = await this.hasMultiMountConfiguration();
        if (!hasMultiMount) {
          console.log(
            '[CodeServer] Existing container uses old mount config, recreating with multi-mount...'
          );
          await this.removeContainer();
          containerState = 'none';
        }
      }

      if (containerState === 'running') {
        // Container already running with multi-mount - reuse it
        console.log('[CodeServer] Container already running with multi-mount, reusing...');
        // Reload workspace paths in case settings changed
        this.loadWorkspaceBasePaths();
        const existingPort = await this.getContainerPort();
        if (!existingPort) {
          throw new Error('Container is running but could not determine port');
        }
        port = existingPort;
      } else if (containerState === 'stopped') {
        // Container exists but stopped - start it
        console.log('[CodeServer] Starting existing container with multi-mount...');
        // Reload workspace paths in case settings changed
        this.loadWorkspaceBasePaths();
        await this.dockerExec(['start', CodeServerService.getContainerName()]);
        const existingPort = await this.getContainerPort();
        if (!existingPort) {
          throw new Error('Container started but could not determine port');
        }
        port = existingPort;
      } else {
        // Container doesn't exist - create with all workspace mounts
        console.log('[CodeServer] Creating new container with workspace mounts...');
        port = await this.findFreePort();
        await this.createContainer(projectPath, port, userDataDir);
      }

      // Step 6: Wait for health check
      await this.waitForReady(port);

      // Step 7: Fix SSH permissions (Windows mounts files as root)
      await this.fixSSHPermissions();

      // Store state
      this.containerName = CodeServerService.getContainerName();
      this.port = port;
      this.running = true;

      // Track this project as mounted (multi-project support)
      this.mountedProjects.add(projectPath);

      // Build URL with folder parameter for the specific project
      const containerPath = this.hostToContainerPath(projectPath);
      const folderParam = containerPath ? `?folder=${encodeURIComponent(containerPath)}` : '';
      const url = `http://127.0.0.1:${port}/${folderParam}`;

      return { port, url };
    } finally {
      this.starting = false;
    }
  }

  /**
   * Create a new persistent container with the given configuration.
   * Mounts all three workspace directories (contributions, my-projects, professional)
   * at container creation time for seamless project switching.
   */
  private async createContainer(
    _projectPath: string,
    port: number,
    userDataDir: string
  ): Promise<void> {
    // Load and cache workspace base paths for path mapping
    this.loadWorkspaceBasePaths();

    const gitMounts = this.getGitMounts();
    const workspaceMounts = this.getWorkspaceMounts();

    // Get initial folder path for VS Code (first project opened)
    const initialContainerPath = this.hostToContainerPath(_projectPath);
    const defaultWorkspace = initialContainerPath || '/config/workspaces';

    const args = [
      'run',
      '-d',
      '--name',
      CodeServerService.getContainerName(),
      // LinuxServer.io code-server uses port 8443 internally
      '-p',
      `127.0.0.1:${port}:8443`,
      // Performance: allocate pseudo-TTY for better terminal responsiveness
      '-t',
      // Performance: increase shared memory for better IPC (default 64MB is too small)
      '--shm-size=256m',
      // LinuxServer.io config persistence (includes code-server data, extensions, etc.)
      '-v',
      `${this.toDockerPath(userDataDir)}:/config`,
      // Multi-project workspace mounts (contributions, my-projects, professional)
      ...workspaceMounts,
      // Git mounts (conditionally included)
      ...gitMounts,
      // Bashrc mount (our configurable shell profile to /config/.bashrc for abc user)
      ...this.getBashrcMount(),
      // Claude Code config mount (isolated from host to prevent JSON corruption)
      ...this.getClaudeMounts(),
      // SSH config and keys mount (for terminal SSH access)
      ...this.getSSHMounts(),
      // LinuxServer.io required environment variables
      '-e',
      `PUID=${process.getuid?.() ?? 1000}`,
      '-e',
      `PGID=${process.getgid?.() ?? 1000}`,
      '-e',
      'TZ=UTC',
      // Disable password authentication
      '-e',
      'PASSWORD=',
      // Set default workspace to the initial project folder
      '-e',
      `DEFAULT_WORKSPACE=${defaultWorkspace}`,
      // Claude Code config directory - stored in /config/.claude which persists
      // because /config is our persistent userDataDir mount. Isolated from host's
      // ~/.claude to prevent JSON corruption from concurrent writes.
      '-e',
      'CLAUDE_CONFIG_DIR=/config/.claude',
      // Git config env var (LinuxServer uses 'abc' user, not 'coder')
      '-e',
      'GIT_CONFIG_GLOBAL=/config/gitconfig',
      // Custom image with Node.js, npm, Python, Claude Code pre-installed
      'cola-code-server:latest',
    ];

    await this.dockerExec(args);
  }

  /**
   * Stop the code-server container.
   * The container is stopped but NOT removed, preserving all state
   * (installed packages, extensions, Claude auth, etc.) for next session.
   *
   * For multi-project support, this clears all mounted projects.
   * Use removeWorkspace() to close individual projects.
   */
  async stop(): Promise<void> {
    try {
      const state = await this.getContainerState();
      if (state === 'running') {
        console.log('[CodeServer] Stopping container (preserving state)...');
        await this.dockerExec(['stop', '-t', '5', CodeServerService.getContainerName()]);
      }
    } catch {
      // Container may not exist or already stopped - that's fine
    }

    this.containerName = null;
    this.port = null;
    this.running = false;

    // Clear all mounted projects (multi-project support)
    this.mountedProjects.clear();
  }

  /**
   * Get the current status of the code-server container.
   */
  getStatus(): CodeServerStatus {
    return {
      running: this.running,
      port: this.port,
      url: this.port ? `http://127.0.0.1:${this.port}` : null,
    };
  }

  // ── Multi-Project Workspace Management ───────────────────────────

  /**
   * Add a workspace folder to the running container.
   * Returns the URL with ?folder= parameter for the project.
   *
   * With multi-mount architecture, projects are already accessible via the
   * three workspace mounts. This method just tracks and returns the URL.
   *
   * Note: The container must already be running. Call start() first if needed.
   *
   * @returns URL with folder parameter pointing to the project
   */
  async addWorkspace(projectPath: string): Promise<string> {
    if (!this.running || !this.port) {
      throw new Error('Container is not running. Call start() first.');
    }

    // Track the project (may already be tracked, that's fine)
    if (!this.mountedProjects.has(projectPath)) {
      this.mountedProjects.add(projectPath);
      console.log(
        `[CodeServer] Added workspace: ${projectPath} (${this.mountedProjects.size} projects)`
      );
    } else {
      console.log(`[CodeServer] Workspace already tracked: ${projectPath}`);
    }

    // Return URL with folder parameter
    const containerPath = this.hostToContainerPath(projectPath);
    const folderParam = containerPath ? `?folder=${encodeURIComponent(containerPath)}` : '';
    return `http://127.0.0.1:${this.port}/${folderParam}`;
  }

  /**
   * Remove a workspace folder from tracking.
   * When the last workspace is removed, returns shouldStop=true so caller can stop container.
   *
   * @returns Object with shouldStop boolean indicating if container should be stopped
   */
  async removeWorkspace(projectPath: string): Promise<{ shouldStop: boolean }> {
    if (!this.mountedProjects.has(projectPath)) {
      console.log(`[CodeServer] Workspace not found: ${projectPath}`);
      return { shouldStop: this.mountedProjects.size === 0 };
    }

    this.mountedProjects.delete(projectPath);
    console.log(
      `[CodeServer] Removed workspace: ${projectPath} (${this.mountedProjects.size} remaining)`
    );

    // Return shouldStop if no more projects are mounted
    return { shouldStop: this.mountedProjects.size === 0 };
  }

  /**
   * Get all currently mounted project paths.
   */
  getMountedProjects(): string[] {
    return Array.from(this.mountedProjects);
  }

  /**
   * Get the current container name (used by ExtensionSyncService).
   */
  getContainerName(): string | null {
    return this.containerName;
  }
}

export const codeServerService = new CodeServerService();
