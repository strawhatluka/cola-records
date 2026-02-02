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
import type { Alias } from '../ipc/channels';
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
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
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
        console.log('[code-server] Loaded host VS Code settings');
      } else {
        console.log('[code-server] No host VS Code settings found, using defaults');
      }

      // Load existing code-server settings (preserves theme, font size, etc.
      // changed by the user inside the embedded VS Code)
      let existingSettings: Record<string, unknown> = {};
      if (fs.existsSync(codeServerSettingsPath)) {
        try {
          const raw = fs.readFileSync(codeServerSettingsPath, 'utf-8');
          existingSettings = JSON.parse(raw);
          console.log('[code-server] Loaded existing code-server settings');
        } catch {
          console.warn('[code-server] Could not parse existing settings, starting fresh');
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

      // Terminal profile: use our custom bashrc
      settings['terminal.integrated.defaultProfile.linux'] = 'cola-bash';
      settings['terminal.integrated.profiles.linux'] = {
        'cola-bash': {
          path: '/bin/bash',
          args: ['--rcfile', '/home/coder/.local/share/code-server/bashrc'],
        },
      };

      fs.writeFileSync(codeServerSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      console.log('[code-server] Wrote merged settings (host + existing + overrides)');
    } catch (error) {
      console.error('[code-server] Failed to sync VS Code settings:', error);
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
        console.log('[code-server] Embedded host .gitconfig content');
      } catch (error) {
        console.error('[code-server] Failed to read host .gitconfig:', error);
      }
    } else {
      console.log('[code-server] No host .gitconfig found, skipping embed');
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
      console.log('[code-server] Created container gitconfig at:', gitconfigPath);
    } catch (error) {
      console.error('[code-server] Failed to create container gitconfig:', error);
    }
  }

  /**
   * Create a .bashrc file for the container terminal.
   * Uses the host OS username in the prompt and shows the git branch.
   */
  createContainerBashrc(projectPath: string): void {
    const bashrcPath = path.join(this.getUserDataDir(), 'bashrc');
    const username = os.userInfo().username;
    const projectName = path.basename(projectPath);

    const lines = [
      '# Cola Records container shell profile',
      '',
      '# Git branch helper',
      '__git_branch() {',
      '  git symbolic-ref --short HEAD 2>/dev/null',
      '}',
      '',
      '# Show path relative to project root using actual host folder name',
      `# /home/coder/project -> ${projectName}, /home/coder/project/src -> ${projectName}/src`,
      '__project_path() {',
      '  local cwd="$PWD"',
      '  local project_root="/home/coder/project"',
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
      '# Prompt: username project-name/subdir (branch)$',
      `PS1='\\[\\033[01;32m\\]${username}\\[\\033[00m\\] \\[\\033[01;34m\\]$(__project_path)\\[\\033[00m\\]\\[\\033[33m\\]$(b=$(__git_branch); [ -n "$b" ] && echo " ($b)")\\[\\033[00m\\]\\$ '`,
      '',
      '# Aliases (defaults + user-defined from Settings)',
    ];

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
        console.log(`[code-server] Loaded ${userAliases.length} user aliases from settings`);
      }
    } catch (error) {
      console.error('[code-server] Failed to read user aliases:', error);
    }

    for (const [name, command] of aliasMap) {
      lines.push(`alias ${name}="${command}"`);
    }
    lines.push('');

    const content = lines.join('\n');

    try {
      fs.mkdirSync(this.getUserDataDir(), { recursive: true });
      fs.writeFileSync(bashrcPath, content, 'utf-8');
      console.log(`[code-server] Created container bashrc for user: ${username}`);
    } catch (error) {
      console.error('[code-server] Failed to create container bashrc:', error);
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

    if (fs.existsSync(gitCredentials)) {
      mounts.push('-v', `${this.toDockerPath(gitCredentials)}:/home/coder/.git-credentials:ro`);
    } else {
      console.log('[code-server] No host .git-credentials found, git push/pull will prompt for auth');
    }

    return mounts;
  }

  // ── Docker Operations ────────────────────────────────────────────

  /**
   * Check if Docker is available and running.
   * Throws with a clear message if not.
   */
  async checkDockerAvailable(): Promise<void> {
    try {
      await this.dockerExec(['info', '--format', '{{.ServerVersion}}']);
      console.log('[code-server] Docker is available');
    } catch (error) {
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
    console.log('[code-server] docker', args.join(' '));
    const { stdout } = await execFileAsync('docker', args, {
      timeout: 120_000, // 2 minute timeout for slow operations like image pull
    });
    return stdout.trim();
  }

  /**
   * Poll the code-server /healthz endpoint until it returns 200.
   * Retries every second for up to 60 seconds.
   */
  async waitForReady(port: number): Promise<void> {
    const maxAttempts = 60;
    const delay = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (response.ok) {
          console.log(`[code-server] Ready after ${attempt} attempt(s)`);
          return;
        }
      } catch {
        // Connection refused — container not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error(`code-server did not become ready within ${maxAttempts} seconds`);
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /**
   * Start a code-server Docker container for the given project path.
   *
   * 1. Check Docker is available
   * 2. Find a free port
   * 3. Sync VS Code settings from host
   * 4. Create container gitconfig
   * 5. Ensure persistent storage dirs exist
   * 6. Launch container with volume mounts
   * 7. Wait for health check
   * 8. Return port and URL
   */
  async start(projectPath: string): Promise<CodeServerStartResult> {
    // Guard against concurrent starts (React strict mode double-mount)
    if (this.starting) {
      console.log('[code-server] Start already in progress, waiting...');
      // Wait for the in-progress start to finish
      while (this.starting) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (this.running && this.port) {
        return { port: this.port, url: `http://127.0.0.1:${this.port}` };
      }
    }

    if (this.running) {
      await this.stop();
    }

    this.starting = true;

    try {
      // Step 1: Verify Docker
      await this.checkDockerAvailable();

      // Step 2: Find free port
      const port = await this.findFreePort();
      const containerName = `cola-code-server-${port}`;

      console.log(`[code-server] Starting on port ${port} for project: ${projectPath}`);

      // Step 3: Sync settings
      this.syncVSCodeSettings();

      // Step 4: Create gitconfig and bashrc
      this.createContainerGitConfig();
      this.createContainerBashrc(projectPath);

      // Step 5: Ensure dirs exist
      const userDataDir = this.getUserDataDir();
      const extensionsDir = this.getExtensionsDir();
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.mkdirSync(extensionsDir, { recursive: true });

      // Step 6: Build Docker run args
      const gitMounts = this.getGitMounts();
      const args = [
        'run', '--rm', '-d',
        '--name', containerName,
        '-p', `127.0.0.1:${port}:8080`,
        // Project directory (read-write)
        '-v', `${this.toDockerPath(projectPath)}:/home/coder/project`,
        // User data persistence (settings, auth tokens, etc.)
        '-v', `${this.toDockerPath(userDataDir)}:/home/coder/.local/share/code-server`,
        // Extensions persistence (separate mount to avoid overlap)
        '-v', `${this.toDockerPath(extensionsDir)}:/home/coder/extensions`,
        // Git mounts (conditionally included)
        ...gitMounts,
        // Git config env var
        '-e', 'GIT_CONFIG_GLOBAL=/home/coder/.local/share/code-server/gitconfig',
        // Shell profile
        '-e', 'BASH_ENV=/home/coder/.local/share/code-server/bashrc',
        // Image
        'codercom/code-server:latest',
        // code-server args
        '--auth', 'none',
        '--bind-addr', '0.0.0.0:8080',
        '--disable-telemetry',
        '--disable-update-check',
        '--extensions-dir', '/home/coder/extensions',
        '/home/coder/project',
      ];

      await this.dockerExec(args);

      // Step 7: Wait for health check
      await this.waitForReady(port);

      // Store state
      this.containerName = containerName;
      this.port = port;
      this.running = true;

      const url = `http://127.0.0.1:${port}`;
      console.log(`[code-server] Running at ${url}`);

      return { port, url };
    } finally {
      this.starting = false;
    }
  }

  /**
   * Stop the running code-server container.
   * Attempts graceful stop, falls back to force remove.
   */
  async stop(): Promise<void> {
    if (!this.containerName) {
      console.log('[code-server] No container to stop');
      this.running = false;
      return;
    }

    const name = this.containerName;
    console.log(`[code-server] Stopping container: ${name}`);

    try {
      await this.dockerExec(['stop', '-t', '5', name]);
      console.log(`[code-server] Container stopped: ${name}`);
    } catch (error) {
      console.error(`[code-server] Graceful stop failed, force removing: ${name}`);
      try {
        await this.dockerExec(['rm', '-f', name]);
      } catch (rmError) {
        console.error('[code-server] Force remove also failed:', rmError);
      }
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
