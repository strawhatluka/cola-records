/**
 * Hooks Service
 *
 * Detect, configure, and manage Git hook tools (Husky, pre-commit,
 * Lefthook, simple-git-hooks). Provides a normalized HookConfig model
 * with per-tool read/write, ecosystem-aware presets, lint-staged
 * management, and setup wizard support.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  HookTool,
  GitHookName,
  HookAction,
  HookConfig,
  HooksDetectionResult,
  HooksSetupResult,
  HookToolRecommendation,
  LintStagedConfig,
  LintStagedRule,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('hooks');

const GIT_HOOK_NAMES: GitHookName[] = [
  'pre-commit',
  'commit-msg',
  'pre-push',
  'post-merge',
  'post-checkout',
];

function emptyHooks(): Record<GitHookName, HookAction[]> {
  return {
    'pre-commit': [],
    'commit-msg': [],
    'pre-push': [],
    'post-merge': [],
    'post-checkout': [],
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function makeId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function runCommand(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// ────────────────────────────────────────────────────────────
// Husky read/write — one shell script per hook in .husky/
// ────────────────────────────────────────────────────────────

async function readHusky(directory: string): Promise<Record<GitHookName, HookAction[]>> {
  const hooks = emptyHooks();
  const huskyDir = path.join(directory, '.husky');

  for (const hookName of GIT_HOOK_NAMES) {
    const hookPath = path.join(huskyDir, hookName);
    try {
      const content = await fs.readFile(hookPath, 'utf-8');
      const lines = content.split('\n').filter((l) => {
        const trimmed = l.trim();
        return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('#!/');
      });
      for (const line of lines) {
        hooks[hookName].push({
          id: makeId(),
          label: line.trim(),
          command: line.trim(),
          description: '',
          enabled: true,
        });
      }
    } catch {
      // Hook file doesn't exist — empty
    }
  }

  return hooks;
}

async function writeHusky(
  directory: string,
  hooks: Record<GitHookName, HookAction[]>
): Promise<void> {
  const huskyDir = path.join(directory, '.husky');
  await fs.mkdir(huskyDir, { recursive: true });

  for (const hookName of GIT_HOOK_NAMES) {
    const actions = hooks[hookName].filter((a) => a.enabled);
    const hookPath = path.join(huskyDir, hookName);

    if (actions.length === 0) {
      // Remove empty hook files
      try {
        await fs.unlink(hookPath);
      } catch {
        // Doesn't exist — fine
      }
      continue;
    }

    const lines = ['#!/usr/bin/env sh', ...actions.map((a) => a.command)];
    await fs.writeFile(hookPath, lines.join('\n') + '\n', { mode: 0o755 });
  }
}

// ────────────────────────────────────────────────────────────
// simple-git-hooks read/write — JSON in package.json or .simple-git-hooks.json
// ────────────────────────────────────────────────────────────

async function readSimpleGitHooks(directory: string): Promise<Record<GitHookName, HookAction[]>> {
  const hooks = emptyHooks();

  // Try .simple-git-hooks.json first, then package.json
  let config: Record<string, string> | null = null;

  const jsonPath = path.join(directory, '.simple-git-hooks.json');
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    config = JSON.parse(content) as Record<string, string>;
  } catch {
    // Try package.json
    try {
      const pkgPath = path.join(directory, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as Record<string, unknown>;
      if (pkg['simple-git-hooks'] && typeof pkg['simple-git-hooks'] === 'object') {
        config = pkg['simple-git-hooks'] as Record<string, string>;
      }
    } catch {
      // No config found
    }
  }

  if (!config) return hooks;

  for (const hookName of GIT_HOOK_NAMES) {
    const command = config[hookName];
    if (command && typeof command === 'string') {
      // Split by && for multiple commands
      const commands = command.split('&&').map((c) => c.trim());
      for (const cmd of commands) {
        hooks[hookName].push({
          id: makeId(),
          label: cmd,
          command: cmd,
          description: '',
          enabled: true,
        });
      }
    }
  }

  return hooks;
}

async function writeSimpleGitHooks(
  directory: string,
  hooks: Record<GitHookName, HookAction[]>
): Promise<void> {
  const config: Record<string, string> = {};

  for (const hookName of GIT_HOOK_NAMES) {
    const actions = hooks[hookName].filter((a) => a.enabled);
    if (actions.length > 0) {
      config[hookName] = actions.map((a) => a.command).join(' && ');
    }
  }

  // Write to .simple-git-hooks.json (preferred over package.json mutation)
  const jsonPath = path.join(directory, '.simple-git-hooks.json');
  await fs.writeFile(jsonPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ────────────────────────────────────────────────────────────
// pre-commit read/write — .pre-commit-config.yaml (line-based)
// ────────────────────────────────────────────────────────────

async function readPreCommit(directory: string): Promise<Record<GitHookName, HookAction[]>> {
  const hooks = emptyHooks();
  const configPath = path.join(directory, '.pre-commit-config.yaml');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const lines = content.split('\n');

    let currentId: string | null = null;
    let currentName = '';

    for (const line of lines) {
      const idMatch = line.match(/^\s+-\s+id:\s+(.+)/);
      if (idMatch) {
        currentId = idMatch[1].trim();
        currentName = currentId;
      }

      const nameMatch = line.match(/^\s+name:\s+(.+)/);
      if (nameMatch && currentId) {
        currentName = nameMatch[1].trim();
      }

      const stagesMatch = line.match(/^\s+stages:\s+\[(.+)]/);
      if (stagesMatch && currentId) {
        const stages = stagesMatch[1].split(',').map((s) => s.trim());
        for (const stage of stages) {
          const hookName = stage as GitHookName;
          if (GIT_HOOK_NAMES.includes(hookName)) {
            hooks[hookName].push({
              id: makeId(),
              label: currentName,
              command: currentId,
              description: `pre-commit hook: ${currentId}`,
              enabled: true,
            });
          }
        }
        currentId = null;
        currentName = '';
      }

      // If no stages specified, hooks default to pre-commit
      const nextHookLine = line.match(/^\s+-\s+repo:/);
      if (nextHookLine && currentId) {
        hooks['pre-commit'].push({
          id: makeId(),
          label: currentName,
          command: currentId,
          description: `pre-commit hook: ${currentId}`,
          enabled: true,
        });
        currentId = null;
        currentName = '';
      }
    }

    // Handle last hook if no repo follows
    if (currentId) {
      hooks['pre-commit'].push({
        id: makeId(),
        label: currentName,
        command: currentId,
        description: `pre-commit hook: ${currentId}`,
        enabled: true,
      });
    }
  } catch {
    // No config file
  }

  return hooks;
}

async function writePreCommit(
  directory: string,
  hooks: Record<GitHookName, HookAction[]>
): Promise<void> {
  const configPath = path.join(directory, '.pre-commit-config.yaml');
  const lines: string[] = ['repos:'];

  // Collect all enabled actions across hooks
  const localActions: { hookName: GitHookName; action: HookAction }[] = [];
  for (const hookName of GIT_HOOK_NAMES) {
    for (const action of hooks[hookName]) {
      if (action.enabled) {
        localActions.push({ hookName, action });
      }
    }
  }

  if (localActions.length > 0) {
    lines.push('  - repo: local');
    lines.push('    hooks:');
    for (const { hookName, action } of localActions) {
      lines.push(`      - id: ${action.command}`);
      lines.push(`        name: ${action.label}`);
      lines.push(`        entry: ${action.command}`);
      lines.push('        language: system');
      if (hookName !== 'pre-commit') {
        lines.push(`        stages: [${hookName}]`);
      }
    }
  }

  await fs.writeFile(configPath, lines.join('\n') + '\n', 'utf-8');
}

// ────────────────────────────────────────────────────────────
// Lefthook read/write — lefthook.yml (line-based)
// ────────────────────────────────────────────────────────────

async function readLefthook(directory: string): Promise<Record<GitHookName, HookAction[]>> {
  const hooks = emptyHooks();
  const configPath = path.join(directory, 'lefthook.yml');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const lines = content.split('\n');

    let currentHook: GitHookName | null = null;
    let currentCommandName: string | null = null;

    for (const line of lines) {
      // Top-level hook name (e.g. "pre-commit:")
      const hookMatch = line.match(/^([a-z-]+):$/);
      if (hookMatch && GIT_HOOK_NAMES.includes(hookMatch[1] as GitHookName)) {
        currentHook = hookMatch[1] as GitHookName;
        continue;
      }

      // "commands:" section
      if (line.match(/^\s+commands:/) && currentHook) {
        continue;
      }

      // Named command (e.g. "    lint:")
      const nameMatch = line.match(/^\s{4}(\w[\w-]*):\s*$/);
      if (nameMatch && currentHook) {
        currentCommandName = nameMatch[1];
        continue;
      }

      // "run:" value
      const runMatch = line.match(/^\s{6}run:\s+(.+)/);
      if (runMatch && currentHook && currentCommandName) {
        hooks[currentHook].push({
          id: makeId(),
          label: currentCommandName,
          command: runMatch[1].trim(),
          description: '',
          enabled: true,
        });
        currentCommandName = null;
      }
    }
  } catch {
    // No config file
  }

  return hooks;
}

async function writeLefthook(
  directory: string,
  hooks: Record<GitHookName, HookAction[]>
): Promise<void> {
  const configPath = path.join(directory, 'lefthook.yml');
  const lines: string[] = [];

  for (const hookName of GIT_HOOK_NAMES) {
    const actions = hooks[hookName].filter((a) => a.enabled);
    if (actions.length === 0) continue;

    lines.push(`${hookName}:`);
    lines.push('  commands:');
    for (const action of actions) {
      const safeName = action.label.replace(/[^a-zA-Z0-9_-]/g, '-');
      lines.push(`    ${safeName}:`);
      lines.push(`      run: ${action.command}`);
    }
  }

  await fs.writeFile(configPath, lines.join('\n') + '\n', 'utf-8');
}

// ────────────────────────────────────────────────────────────
// lint-staged read/write (package.json key)
// ────────────────────────────────────────────────────────────

async function readLintStaged(directory: string): Promise<LintStagedConfig | null> {
  try {
    const pkgPath = path.join(directory, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as Record<string, unknown>;
    const lsConfig = pkg['lint-staged'] as Record<string, string | string[]> | undefined;

    if (!lsConfig || typeof lsConfig !== 'object') return null;

    const rules: LintStagedRule[] = [];
    for (const [pattern, commands] of Object.entries(lsConfig)) {
      rules.push({
        id: makeId(),
        pattern,
        commands: Array.isArray(commands) ? commands : [commands],
        enabled: true,
      });
    }

    return { enabled: true, rules };
  } catch {
    return null;
  }
}

async function writeLintStaged(
  directory: string,
  config: LintStagedConfig
): Promise<SetUpActionResult> {
  try {
    const pkgPath = path.join(directory, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as Record<string, unknown>;

    if (!config.enabled || config.rules.length === 0) {
      delete pkg['lint-staged'];
    } else {
      const lsObj: Record<string, string[]> = {};
      for (const rule of config.rules) {
        if (rule.enabled) {
          lsObj[rule.pattern] = rule.commands;
        }
      }
      pkg['lint-staged'] = lsObj;
    }

    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    return { success: true, message: 'Saved lint-staged config' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Failed to save lint-staged: ${msg}` };
  }
}

// ────────────────────────────────────────────────────────────
// Presets
// ────────────────────────────────────────────────────────────

function getNodePresets(): Record<GitHookName, HookAction[]> {
  return {
    'pre-commit': [
      {
        id: makeId(),
        label: 'Run lint-staged',
        command: 'npx lint-staged',
        description: 'Run linters on staged files',
        enabled: true,
      },
      {
        id: makeId(),
        label: 'Run tests',
        command: 'npm test',
        description: 'Run test suite before commit',
        enabled: false,
      },
      {
        id: makeId(),
        label: 'TypeCheck',
        command: 'npx tsc --noEmit',
        description: 'Run TypeScript type checking',
        enabled: false,
      },
      {
        id: makeId(),
        label: 'Run linter',
        command: 'npm run lint',
        description: 'Run ESLint on entire project',
        enabled: false,
      },
      {
        id: makeId(),
        label: 'Check formatting',
        command: 'npm run format:check',
        description: 'Check code formatting',
        enabled: false,
      },
    ],
    'commit-msg': [
      {
        id: makeId(),
        label: 'Commitlint',
        command: 'npx --no -- commitlint --edit $1',
        description: 'Validate commit message format',
        enabled: false,
      },
    ],
    'pre-push': [
      {
        id: makeId(),
        label: 'Run tests',
        command: 'npm test',
        description: 'Run test suite before push',
        enabled: true,
      },
      {
        id: makeId(),
        label: 'Build',
        command: 'npm run build',
        description: 'Verify build succeeds before push',
        enabled: false,
      },
    ],
    'post-merge': [],
    'post-checkout': [],
  };
}

function getPythonPresets(): Record<GitHookName, HookAction[]> {
  return {
    'pre-commit': [
      {
        id: makeId(),
        label: 'Ruff check',
        command: 'ruff check .',
        description: 'Lint Python code',
        enabled: true,
      },
      {
        id: makeId(),
        label: 'Ruff format',
        command: 'ruff format --check .',
        description: 'Check Python formatting',
        enabled: true,
      },
      {
        id: makeId(),
        label: 'Trailing whitespace',
        command: 'trailing-whitespace-fixer',
        description: 'Remove trailing whitespace',
        enabled: true,
      },
    ],
    'commit-msg': [],
    'pre-push': [
      {
        id: makeId(),
        label: 'Run tests',
        command: 'pytest',
        description: 'Run test suite before push',
        enabled: true,
      },
    ],
    'post-merge': [],
    'post-checkout': [],
  };
}

function getRustPresets(): Record<GitHookName, HookAction[]> {
  return {
    'pre-commit': [
      {
        id: makeId(),
        label: 'Format check',
        command: 'cargo fmt --check',
        description: 'Check Rust formatting',
        enabled: true,
      },
      {
        id: makeId(),
        label: 'Clippy',
        command: 'cargo clippy',
        description: 'Run Rust linter',
        enabled: true,
      },
    ],
    'commit-msg': [],
    'pre-push': [
      {
        id: makeId(),
        label: 'Run tests',
        command: 'cargo test',
        description: 'Run test suite before push',
        enabled: true,
      },
    ],
    'post-merge': [],
    'post-checkout': [],
  };
}

function getGoPresets(): Record<GitHookName, HookAction[]> {
  return {
    'pre-commit': [
      {
        id: makeId(),
        label: 'Go vet',
        command: 'go vet ./...',
        description: 'Run Go vet',
        enabled: true,
      },
      {
        id: makeId(),
        label: 'Go test',
        command: 'go test ./...',
        description: 'Run Go tests',
        enabled: true,
      },
    ],
    'commit-msg': [],
    'pre-push': [],
    'post-merge': [],
    'post-checkout': [],
  };
}

function getDefaultPresets(): Record<GitHookName, HookAction[]> {
  return emptyHooks();
}

function getNodeLintStagedPresets(): LintStagedRule[] {
  return [
    {
      id: makeId(),
      pattern: '*.{ts,tsx}',
      commands: ['eslint --fix', 'prettier --write'],
      enabled: true,
    },
    {
      id: makeId(),
      pattern: '*.{js,jsx}',
      commands: ['eslint --fix', 'prettier --write'],
      enabled: true,
    },
    {
      id: makeId(),
      pattern: '*.{css,scss}',
      commands: ['prettier --write'],
      enabled: true,
    },
    {
      id: makeId(),
      pattern: '*.{json,md}',
      commands: ['prettier --write'],
      enabled: true,
    },
  ];
}

// ────────────────────────────────────────────────────────────
// Main service class
// ────────────────────────────────────────────────────────────

class HooksService {
  async detect(directory: string, ecosystem: Ecosystem): Promise<HooksDetectionResult> {
    logger.info(`Detecting hooks in: ${directory}`);

    const detected = await this.detectTool(directory);
    const recommendations = this.getRecommendations(ecosystem);
    const hasLintStaged = (await readLintStaged(directory)) !== null;
    let existingConfig: HookConfig | null = null;

    if (detected) {
      try {
        existingConfig = await this.readConfig(directory, detected);
      } catch {
        logger.warn(`Failed to read config for ${detected}`);
      }
    }

    return { detected, recommendations, ecosystem, hasLintStaged, existingConfig };
  }

  getRecommendations(ecosystem: Ecosystem): HookToolRecommendation[] {
    const recs: HookToolRecommendation[] = [];

    switch (ecosystem) {
      case 'node':
        recs.push({
          tool: 'husky',
          reason: 'Most popular Git hooks tool for Node.js projects',
          supportsLintStaged: true,
        });
        recs.push({
          tool: 'simple-git-hooks',
          reason: 'Zero-dependency alternative, config in package.json',
          supportsLintStaged: true,
        });
        recs.push({
          tool: 'lefthook',
          reason: 'Fast, polyglot hooks manager with built-in glob filtering',
          supportsLintStaged: false,
        });
        break;
      case 'python':
        recs.push({
          tool: 'pre-commit',
          reason: 'Standard Python hooks framework with repo-based hooks',
          supportsLintStaged: false,
        });
        recs.push({
          tool: 'lefthook',
          reason: 'Fast, polyglot hooks manager',
          supportsLintStaged: false,
        });
        break;
      default:
        recs.push({
          tool: 'lefthook',
          reason: 'Fast, polyglot hooks manager for any project',
          supportsLintStaged: false,
        });
        recs.push({
          tool: 'husky',
          reason: 'Popular Git hooks tool (requires Node.js)',
          supportsLintStaged: true,
        });
        break;
    }

    return recs;
  }

  async setupHookTool(
    directory: string,
    tool: HookTool,
    ecosystem: Ecosystem
  ): Promise<HooksSetupResult> {
    logger.info(`Setting up ${tool} in: ${directory}`);

    try {
      // Initialize the hook tool's infrastructure first
      await this.initHookTool(directory, tool);

      // Then write our config files (overwrites any defaults from init)
      const presets = this.getPresetActions(ecosystem, tool);
      const config: HookConfig = {
        hookTool: tool,
        hooks: presets,
        lintStaged: null,
      };

      await this.writeConfig(directory, config);

      // simple-git-hooks needs to run after config is written to install actual git hooks
      if (tool === 'simple-git-hooks') {
        try {
          await runCommand('npx', ['simple-git-hooks'], directory);
        } catch {
          logger.warn(
            'simple-git-hooks not installed yet — user needs to run: npx simple-git-hooks'
          );
        }
      }

      return { success: true, message: `Created ${tool} configuration` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to set up ${tool}: ${msg}`);
      return { success: false, message: `Failed to set up ${tool}: ${msg}` };
    }
  }

  private async initHookTool(directory: string, tool: HookTool): Promise<void> {
    switch (tool) {
      case 'husky': {
        // Set core.hooksPath so Git knows where to find hooks
        const huskyDir = path.join(directory, '.husky');
        await fs.mkdir(huskyDir, { recursive: true });
        await runCommand('git', ['config', 'core.hooksPath', '.husky'], directory);
        // Add prepare script to package.json for persistence across npm install
        await this.addPrepareScript(directory, 'husky');
        break;
      }
      case 'simple-git-hooks':
        // simple-git-hooks needs its config written first, then `npx simple-git-hooks`
        // to install actual git hooks — handled after writeConfig in setupHookTool caller
        break;
      case 'lefthook':
        // lefthook install sets up .git/hooks — try to run it, non-fatal if not installed
        try {
          await runCommand('npx', ['lefthook', 'install'], directory);
        } catch {
          logger.warn('lefthook not installed yet — user needs to run: npx lefthook install');
        }
        break;
      case 'pre-commit':
        // pre-commit install sets up .git/hooks — try to run it, non-fatal if not installed
        try {
          await runCommand('pre-commit', ['install'], directory);
        } catch {
          logger.warn('pre-commit not installed yet — user needs to run: pre-commit install');
        }
        break;
    }
  }

  private async addPrepareScript(directory: string, command: string): Promise<void> {
    const pkgPath = path.join(directory, 'package.json');
    try {
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const scripts = (pkg['scripts'] ?? {}) as Record<string, string>;
      if (!scripts['prepare']) {
        scripts['prepare'] = command;
        pkg['scripts'] = scripts;
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    } catch {
      // No package.json — skip
    }
  }

  getInstallCommand(tool: HookTool): string {
    const commands: Record<HookTool, string> = {
      husky: 'npx husky init',
      lefthook: 'npx lefthook install',
      'pre-commit': 'pre-commit install',
      'simple-git-hooks': 'npx simple-git-hooks',
    };
    return commands[tool];
  }

  async readConfig(directory: string, tool: HookTool): Promise<HookConfig> {
    let hooks: Record<GitHookName, HookAction[]>;

    switch (tool) {
      case 'husky':
        hooks = await readHusky(directory);
        break;
      case 'simple-git-hooks':
        hooks = await readSimpleGitHooks(directory);
        break;
      case 'pre-commit':
        hooks = await readPreCommit(directory);
        break;
      case 'lefthook':
        hooks = await readLefthook(directory);
        break;
    }

    const lintStaged = await readLintStaged(directory);

    return { hookTool: tool, hooks, lintStaged };
  }

  async writeConfig(directory: string, config: HookConfig): Promise<SetUpActionResult> {
    try {
      switch (config.hookTool) {
        case 'husky':
          await writeHusky(directory, config.hooks);
          // Ensure core.hooksPath is set (idempotent)
          try {
            await runCommand('git', ['config', 'core.hooksPath', '.husky'], directory);
          } catch {
            // Not a git repo or git not available — non-fatal
          }
          break;
        case 'simple-git-hooks':
          await writeSimpleGitHooks(directory, config.hooks);
          break;
        case 'pre-commit':
          await writePreCommit(directory, config.hooks);
          break;
        case 'lefthook':
          await writeLefthook(directory, config.hooks);
          break;
      }

      return { success: true, message: `Saved ${config.hookTool} configuration` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write config: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  async setupLintStaged(directory: string, config: LintStagedConfig): Promise<SetUpActionResult> {
    return await writeLintStaged(directory, config);
  }

  getPresetActions(ecosystem: Ecosystem, _tool: HookTool): Record<GitHookName, HookAction[]> {
    switch (ecosystem) {
      case 'node':
        return getNodePresets();
      case 'python':
        return getPythonPresets();
      case 'rust':
        return getRustPresets();
      case 'go':
        return getGoPresets();
      default:
        return getDefaultPresets();
    }
  }

  getLintStagedPresets(ecosystem: Ecosystem): LintStagedRule[] {
    if (ecosystem === 'node') {
      return getNodeLintStagedPresets();
    }
    return [];
  }

  private async detectTool(directory: string): Promise<HookTool | null> {
    if (await fileExists(path.join(directory, '.husky'))) return 'husky';
    if (await fileExists(path.join(directory, 'lefthook.yml'))) return 'lefthook';
    if (await fileExists(path.join(directory, '.pre-commit-config.yaml'))) return 'pre-commit';
    if (await fileExists(path.join(directory, '.simple-git-hooks.json'))) return 'simple-git-hooks';

    try {
      const pkgPath = path.join(directory, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content) as Record<string, unknown>;
      if (pkg['simple-git-hooks']) return 'simple-git-hooks';
    } catch {
      // No package.json
    }

    return null;
  }
}

export const hooksService = new HooksService();
