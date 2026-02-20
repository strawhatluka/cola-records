/**
 * Code Server — Configuration synchronization
 *
 * Standalone functions for syncing host VS Code settings, git config,
 * bash profile, and SSH config into the code-server container.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { database } from '../../database/database.service';
import type { Alias, BashProfileSettings, SSHRemote, TerminalColor } from '../../ipc/channels';
import { getUserDataDir, toDockerPath } from './path-mapper';
import { WORKSPACE_MOUNTS } from './types';

// ── VS Code Settings Sync ────────────────────────────────────────

function getHostVSCodeSettingsPath(): string {
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
    default:
      return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
  }
}

function stripJsonc(text: string): string {
  let result = '';
  let i = 0;
  let inString = false;

  while (i < text.length) {
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

    if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }

    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    result += text[i];
    i++;
  }

  return result.replace(/,\s*([}\]])/g, '$1');
}

export function syncVSCodeSettings(): void {
  const hostSettingsPath = getHostVSCodeSettingsPath();
  const codeServerSettingsDir = path.join(getUserDataDir(), 'User');
  const codeServerSettingsPath = path.join(codeServerSettingsDir, 'settings.json');

  try {
    fs.mkdirSync(codeServerSettingsDir, { recursive: true });

    let hostSettings: Record<string, unknown> = {};
    if (fs.existsSync(hostSettingsPath)) {
      const raw = fs.readFileSync(hostSettingsPath, 'utf-8');
      const cleanJson = stripJsonc(raw);
      hostSettings = JSON.parse(cleanJson);
    }

    let existingSettings: Record<string, unknown> = {};
    if (fs.existsSync(codeServerSettingsPath)) {
      try {
        const raw = fs.readFileSync(codeServerSettingsPath, 'utf-8');
        existingSettings = JSON.parse(raw);
      } catch {
        // Ignore parse errors
      }
    }

    const settings: Record<string, unknown> = {
      ...hostSettings,
      ...existingSettings,
    };

    settings['security.workspace.trust.enabled'] = false;
    settings['git.enabled'] = true;
    settings['git.path'] = '/usr/bin/git';

    settings['terminal.integrated.defaultProfile.linux'] = 'bash';
    settings['terminal.integrated.profiles.linux'] = {
      bash: { path: '/bin/bash' },
    };

    settings['terminal.integrated.smoothScrolling'] = false;
    settings['terminal.integrated.gpuAcceleration'] = 'on';
    settings['terminal.integrated.fastScrollSensitivity'] = 5;
    settings['terminal.integrated.scrollback'] = 1000;

    fs.writeFileSync(codeServerSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch {
    // Settings sync is best-effort
  }
}

// ── Git Config Sync ──────────────────────────────────────────────

export function createContainerGitConfig(): void {
  const gitconfigPath = path.join(getUserDataDir(), 'gitconfig');
  const hostGitconfig = path.join(os.homedir(), '.gitconfig');

  const parts: string[] = [];

  if (fs.existsSync(hostGitconfig)) {
    try {
      const hostContent = fs.readFileSync(hostGitconfig, 'utf-8');
      const normalized = hostContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      parts.push('# --- Host .gitconfig (embedded) ---');
      parts.push(normalized.trimEnd());
      parts.push('');
    } catch {
      // Ignore read errors
    }
  }

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
    fs.mkdirSync(getUserDataDir(), { recursive: true });
    fs.writeFileSync(gitconfigPath, content, 'utf-8');
  } catch {
    // Gitconfig creation is best-effort
  }
}

// ── Bash Profile Sync ────────────────────────────────────────────

function getColorCode(color: TerminalColor): string {
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

function getBashProfileSettings(): BashProfileSettings {
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

export function createContainerBashrc(projectPath: string): void {
  const bashrcPath = path.join(getUserDataDir(), '.bashrc');
  const projectName = path.basename(projectPath);
  const bashProfile = getBashProfileSettings();
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

  const resetCode = '\\033[00m';
  const promptParts: string[] = [];

  if (bashProfile.showUsername) {
    const usernameColor = getColorCode(bashProfile.usernameColor);
    promptParts.push(`\\[${usernameColor}\\]${username}\\[${resetCode}\\] `);
  }

  const pathColor = getColorCode(bashProfile.pathColor);
  promptParts.push(`\\[${pathColor}\\]$(__project_path)\\[${resetCode}\\]`);

  if (bashProfile.showGitBranch) {
    const gitColor = getColorCode(bashProfile.gitBranchColor);
    promptParts.push(
      `\\[${gitColor}\\]$(b=$(__git_branch); [ -n "$b" ] && echo " ($b)")\\[${resetCode}\\]`
    );
  }

  promptParts.push('\\$ ');

  lines.push('# Prompt (configurable via Settings > Bash Profile)');
  lines.push(`PS1='${promptParts.join('')}'`);
  lines.push('');
  lines.push('# Aliases (defaults + user-defined from Settings)');

  const aliasMap = new Map<string, string>([
    ['ll', 'ls -la --color=auto'],
    ['gs', 'git status'],
    ['gd', 'git diff'],
    ['gl', 'git log --oneline -20'],
  ]);

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
    fs.mkdirSync(getUserDataDir(), { recursive: true });
    fs.writeFileSync(bashrcPath, content, 'utf-8');
  } catch {
    // Bashrc creation is best-effort
  }
}

// ── SSH Config Sync ──────────────────────────────────────────────

function getSSHRemotes(): SSHRemote[] {
  try {
    const json = database.getSetting('sshRemotes');
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export function syncSSHConfig(): void {
  const remotes = getSSHRemotes();
  const sshDir = path.join(getUserDataDir(), '.ssh');
  const keysDir = path.join(sshDir, 'keys');
  const configPath = path.join(sshDir, 'config');

  fs.mkdirSync(keysDir, { recursive: true });

  if (remotes.length === 0) {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    return;
  }

  const lines: string[] = ['# Cola Records SSH Config', ''];

  for (const remote of remotes) {
    const keyBasename = remote.keyPath.split(/[/\\]/).pop() || path.basename(remote.keyPath);
    const containerKeyPath = `/config/.ssh/keys/${keyBasename}`;

    if (fs.existsSync(remote.keyPath)) {
      const destKeyPath = path.join(keysDir, keyBasename);
      try {
        fs.copyFileSync(remote.keyPath, destKeyPath);
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

// ── Mount Helpers ────────────────────────────────────────────────

export function getGitMounts(): string[] {
  const mounts: string[] = [];
  const gitCredentials = path.join(os.homedir(), '.git-credentials');

  if (fs.existsSync(gitCredentials)) {
    mounts.push('-v', `${toDockerPath(gitCredentials)}:/config/.git-credentials:ro`);
  }

  return mounts;
}

export function getBashrcMount(): string[] {
  return [];
}

export function getClaudeMounts(): string[] {
  return [];
}

export function getSSHMounts(): string[] {
  const sshDir = path.join(getUserDataDir(), '.ssh');
  const configPath = path.join(sshDir, 'config');

  if (fs.existsSync(configPath)) {
    return ['-v', `${toDockerPath(sshDir)}:/config/.ssh`];
  }

  return [];
}

export function getWorkspaceMounts(): string[] {
  const mounts: string[] = [];

  const contributionsPath = database.getSetting('defaultClonePath');
  const myProjectsPath = database.getSetting('defaultProjectsPath');
  const professionalPath = database.getSetting('defaultProfessionalProjectsPath');

  if (contributionsPath && fs.existsSync(contributionsPath)) {
    mounts.push('-v', `${toDockerPath(contributionsPath)}:${WORKSPACE_MOUNTS.contributions}`);
  }

  if (myProjectsPath && fs.existsSync(myProjectsPath)) {
    mounts.push('-v', `${toDockerPath(myProjectsPath)}:${WORKSPACE_MOUNTS['my-projects']}`);
  }

  if (professionalPath && fs.existsSync(professionalPath)) {
    mounts.push('-v', `${toDockerPath(professionalPath)}:${WORKSPACE_MOUNTS.professional}`);
  }

  return mounts;
}
