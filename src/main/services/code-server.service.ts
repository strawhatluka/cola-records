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
import type { Alias, BashProfileSettings, TerminalColor } from '../ipc/channels';
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

class CodeServerService {
  private containerName: string | null = null;
  private port: number | null = null;
  private running = false;
  private starting = false;

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

  /**
   * Directory for isolated Claude Code configuration.
   * Uses a separate directory within code-server user data to prevent
   * conflicts with the host's Claude Code config (~/.claude.json).
   * Both instances writing to the same file causes JSON corruption.
   */
  getClaudeConfigDir(): string {
    return path.join(this.getUserDataDir(), 'claude-config');
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
   */
  createContainerBashrc(projectPath: string): void {
    const bashrcPath = path.join(this.getUserDataDir(), 'bashrc');
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
   * Build Docker -v arguments for the bashrc file.
   * Mounts our generated bashrc to /etc/bash.bashrc which VS Code terminal uses.
   */
  getBashrcMount(): string[] {
    const bashrcPath = path.join(this.getUserDataDir(), 'bashrc');

    // Only mount if the bashrc file exists
    if (fs.existsSync(bashrcPath)) {
      return ['-v', `${this.toDockerPath(bashrcPath)}:/etc/bash.bashrc:ro`];
    }

    return [];
  }

  /**
   * Build Docker -v arguments for Claude Code config.
   * Uses an isolated directory within code-server user data to prevent
   * conflicts with the host's Claude Code config.
   *
   * IMPORTANT: We do NOT mount the host's ~/.claude.json or ~/.claude/ because
   * both the host and container Claude Code instances would write to the same
   * files concurrently, causing JSON corruption.
   *
   * Instead, we mount a separate persistent directory and set CLAUDE_CONFIG_DIR
   * env var to point to it. The container's Claude Code will need to be
   * authenticated separately (one-time setup).
   */
  getClaudeMounts(): string[] {
    const claudeConfigDir = this.getClaudeConfigDir();

    // Ensure the isolated Claude config directory exists
    fs.mkdirSync(claudeConfigDir, { recursive: true });

    // Mount the isolated config directory (LinuxServer.io uses /config as home)
    return ['-v', `${this.toDockerPath(claudeConfigDir)}:/home/abc/.claude-config`];
  }

  // ── Docker Operations ────────────────────────────────────────────

  /**
   * Check if Docker is available and running.
   * Throws with a clear message if not.
   */
  async checkDockerAvailable(): Promise<void> {
    try {
      await this.dockerExec(['info', '--format', '{{.ServerVersion}}']);
    } catch {
      throw new Error(
        'Docker Desktop is not running. Please start Docker Desktop and try again.\n\n' +
          'If Docker is not installed, download it from: https://www.docker.com/products/docker-desktop/'
      );
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

  /** Fixed container name for persistence across sessions */
  private static readonly CONTAINER_NAME = 'cola-code-server';

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
        CodeServerService.CONTAINER_NAME,
      ]);
      return result.trim() === 'true' ? 'running' : 'stopped';
    } catch {
      return 'none';
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
        CodeServerService.CONTAINER_NAME,
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
        CodeServerService.CONTAINER_NAME,
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
      await this.dockerExec(['rm', '-f', CodeServerService.CONTAINER_NAME]);
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
   * - If container exists and is running → reuse it
   * - If container doesn't exist → create it
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
        return { port: this.port, url: `http://127.0.0.1:${this.port}` };
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

      // Step 4: Ensure config dir exists
      const userDataDir = this.getUserDataDir();
      fs.mkdirSync(userDataDir, { recursive: true });

      // Step 5: Check container state and workspace path
      let containerState = await this.getContainerState();
      let port: number;

      // If container exists, check if it's mounting the correct project
      if (containerState !== 'none') {
        const currentWorkspace = await this.getContainerWorkspacePath();
        const requestedWorkspace = this.toDockerPath(projectPath);

        // Normalize paths for comparison (Docker returns forward slashes)
        const normalizedCurrent = currentWorkspace?.toLowerCase().replace(/\\/g, '/');
        const normalizedRequested = requestedWorkspace.toLowerCase().replace(/\\/g, '/');

        if (normalizedCurrent !== normalizedRequested) {
          console.log(
            `[CodeServer] Project changed: ${normalizedCurrent} → ${normalizedRequested}`
          );
          console.log('[CodeServer] Recreating container with new workspace...');
          await this.removeContainer();
          containerState = 'none';
        }
      }

      if (containerState === 'running') {
        // Container already running with correct project - get its port
        console.log('[CodeServer] Container already running, reusing...');
        const existingPort = await this.getContainerPort();
        if (!existingPort) {
          throw new Error('Container is running but could not determine port');
        }
        port = existingPort;
      } else if (containerState === 'stopped') {
        // Container exists but stopped with correct project - start it
        console.log('[CodeServer] Starting existing container...');
        await this.dockerExec(['start', CodeServerService.CONTAINER_NAME]);
        const existingPort = await this.getContainerPort();
        if (!existingPort) {
          throw new Error('Container started but could not determine port');
        }
        port = existingPort;
      } else {
        // Container doesn't exist or was removed - create it
        console.log('[CodeServer] Creating new container...');
        port = await this.findFreePort();
        await this.createContainer(projectPath, port, userDataDir);
      }

      // Step 6: Wait for health check
      await this.waitForReady(port);

      // Store state
      this.containerName = CodeServerService.CONTAINER_NAME;
      this.port = port;
      this.running = true;

      const url = `http://127.0.0.1:${port}`;
      return { port, url };
    } finally {
      this.starting = false;
    }
  }

  /**
   * Create a new persistent container with the given configuration.
   */
  private async createContainer(
    projectPath: string,
    port: number,
    userDataDir: string
  ): Promise<void> {
    const gitMounts = this.getGitMounts();
    const args = [
      'run',
      '-d',
      '--name',
      CodeServerService.CONTAINER_NAME,
      // LinuxServer.io code-server uses port 8443 internally
      '-p',
      `127.0.0.1:${port}:8443`,
      // Performance: allocate pseudo-TTY for better terminal responsiveness
      '-t',
      // Performance: increase shared memory for better IPC (default 64MB is too small)
      '--shm-size=256m',
      // Project directory (read-write) - mounted as DEFAULT_WORKSPACE
      '-v',
      `${this.toDockerPath(projectPath)}:/config/workspace`,
      // LinuxServer.io config persistence (includes code-server data, extensions, etc.)
      '-v',
      `${this.toDockerPath(userDataDir)}:/config`,
      // Git mounts (conditionally included)
      ...gitMounts,
      // Bashrc mount (our configurable shell profile to /etc/bash.bashrc)
      ...this.getBashrcMount(),
      // Claude Code config mount (isolated from host to prevent JSON corruption)
      ...this.getClaudeMounts(),
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
      // Set default workspace to mounted project
      '-e',
      'DEFAULT_WORKSPACE=/config/workspace',
      // Claude Code config directory (isolated from host's ~/.claude.json)
      '-e',
      'CLAUDE_CONFIG_DIR=/home/abc/.claude-config',
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
   */
  async stop(): Promise<void> {
    try {
      const state = await this.getContainerState();
      if (state === 'running') {
        console.log('[CodeServer] Stopping container (preserving state)...');
        await this.dockerExec(['stop', '-t', '5', CodeServerService.CONTAINER_NAME]);
      }
    } catch {
      // Container may not exist or already stopped - that's fine
    }

    this.containerName = null;
    this.port = null;
    this.running = false;
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

  /**
   * Get the current container name (used by ExtensionSyncService).
   */
  getContainerName(): string | null {
    return this.containerName;
  }
}

export const codeServerService = new CodeServerService();
