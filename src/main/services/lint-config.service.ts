/**
 * Lint Config Service
 *
 * Detect project linters, read/write config files, and provide
 * ecosystem presets. Supports 7 linters across 7 ecosystems.
 * Rich GUI for ESLint (env, extends, rules, parser, plugins, ignorePatterns).
 * Generic textarea fallback for all other linters.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  LinterType,
  LinterInfo,
  LintConfig,
  ESLintConfig,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('lint-config');

// ────────────────────────────────────────────────────────────
// Detection
// ────────────────────────────────────────────────────────────

interface DetectionEntry {
  linter: LinterType;
  files: string[];
  packageJsonDep?: string;
  pyprojectSection?: string;
}

const DETECTION_MAP: Record<string, DetectionEntry[]> = {
  node: [
    {
      linter: 'eslint',
      files: [
        'eslint.config.js',
        'eslint.config.mjs',
        'eslint.config.cjs',
        'eslint.config.ts',
        'eslint.config.mts',
        'eslint.config.cts',
        '.eslintrc.json',
        '.eslintrc.js',
        '.eslintrc.cjs',
        '.eslintrc.yml',
        '.eslintrc.yaml',
        '.eslintrc',
      ],
      packageJsonDep: 'eslint',
    },
  ],
  python: [
    {
      linter: 'ruff',
      files: ['ruff.toml'],
      pyprojectSection: '[tool.ruff]',
    },
  ],
  rust: [
    {
      linter: 'clippy',
      files: [],
    },
  ],
  go: [
    {
      linter: 'golangci-lint',
      files: ['.golangci.yml', '.golangci.yaml', '.golangci.json', '.golangci.toml'],
    },
  ],
  ruby: [
    {
      linter: 'rubocop',
      files: ['.rubocop.yml'],
    },
  ],
  php: [
    {
      linter: 'phpstan',
      files: ['phpstan.neon', 'phpstan.neon.dist', 'phpstan.dist.neon'],
    },
  ],
  java: [
    {
      linter: 'checkstyle',
      files: ['checkstyle.xml'],
    },
  ],
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectInEcosystem(
  directory: string,
  entries: DetectionEntry[],
  isTargetEcosystem: boolean = false
): Promise<LinterInfo> {
  for (const entry of entries) {
    // Built-in tools (clippy) — only when target ecosystem
    if (entry.files.length === 0 && !entry.packageJsonDep && !entry.pyprojectSection) {
      if (isTargetEcosystem) {
        return { linter: entry.linter, configPath: null, hasConfig: false };
      }
      continue;
    }

    // Check config files
    for (const file of entry.files) {
      const fullPath = path.join(directory, file);
      if (await fileExists(fullPath)) {
        return { linter: entry.linter, configPath: fullPath, hasConfig: true };
      }
    }

    // Check package.json devDependencies
    if (entry.packageJsonDep) {
      const pkgPath = path.join(directory, 'package.json');
      if (await fileExists(pkgPath)) {
        try {
          const pkgContent = await fs.readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          const devDeps = pkg.devDependencies ?? {};
          const deps = pkg.dependencies ?? {};
          if (devDeps[entry.packageJsonDep] || deps[entry.packageJsonDep]) {
            return { linter: entry.linter, configPath: null, hasConfig: false };
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Check pyproject.toml sections (Python)
    if (entry.pyprojectSection) {
      const pyprojectPath = path.join(directory, 'pyproject.toml');
      if (await fileExists(pyprojectPath)) {
        try {
          const content = await fs.readFile(pyprojectPath, 'utf-8');
          if (content.includes(entry.pyprojectSection)) {
            return { linter: entry.linter, configPath: pyprojectPath, hasConfig: true };
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  return { linter: null, configPath: null, hasConfig: false };
}

// ────────────────────────────────────────────────────────────
// Config read/write
// ────────────────────────────────────────────────────────────

function parseESLintJson(content: string): ESLintConfig {
  const raw = JSON.parse(content);
  const config: ESLintConfig = {};

  if (raw.env && typeof raw.env === 'object') config.env = raw.env;
  if (Array.isArray(raw.extends)) config.extends = raw.extends;
  if (raw.rules && typeof raw.rules === 'object') config.rules = raw.rules;
  if (typeof raw.parser === 'string') config.parser = raw.parser;
  if (raw.parserOptions && typeof raw.parserOptions === 'object')
    config.parserOptions = raw.parserOptions;
  if (Array.isArray(raw.plugins)) config.plugins = raw.plugins;
  if (Array.isArray(raw.ignorePatterns)) config.ignorePatterns = raw.ignorePatterns;

  return config;
}

// ────────────────────────────────────────────────────────────
// Presets
// ────────────────────────────────────────────────────────────

function getESLintPreset(): ESLintConfig {
  return {
    env: { browser: true, es2021: true, node: true },
    extends: ['eslint:recommended'],
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
    },
  };
}

function getRuffLintPreset(): Record<string, unknown> {
  return {
    'line-length': 88,
    select: 'E,F,W',
    ignore: 'E501',
  };
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

class LintConfigService {
  async detectLinter(directory: string, ecosystem: Ecosystem): Promise<LinterInfo> {
    // Try ecosystem-specific detection first
    const entries = DETECTION_MAP[ecosystem];
    if (entries) {
      const result = await detectInEcosystem(directory, entries, true);
      if (result.linter) return result;
    }

    // Fall back: check all known config files across all ecosystems
    for (const [eco, ecoEntries] of Object.entries(DETECTION_MAP)) {
      if (eco === ecosystem) continue;
      const result = await detectInEcosystem(directory, ecoEntries, false);
      if (result.linter) return result;
    }

    return { linter: null, configPath: null, hasConfig: false };
  }

  async readConfig(configPath: string, linter: LinterType): Promise<LintConfig> {
    const content = await fs.readFile(configPath, 'utf-8');

    if (linter === 'eslint') {
      // Try parsing as JSON (.eslintrc.json, .eslintrc)
      try {
        const parsed = parseESLintJson(content);
        return { linter, config: parsed, configPath };
      } catch {
        // JS/TS config — return raw for generic editor
        return { linter, config: { _raw: content }, configPath };
      }
    }

    // Generic fallback — return raw content
    return { linter, config: { _raw: content }, configPath };
  }

  async writeConfig(
    directory: string,
    linter: LinterType,
    config: ESLintConfig | Record<string, unknown>
  ): Promise<SetUpActionResult> {
    try {
      // Handle raw content passthrough (generic editor)
      if ('_raw' in config && typeof config._raw === 'string') {
        const info = await this.detectLinter(directory, 'node');
        if (info.configPath) {
          await fs.writeFile(info.configPath, config._raw, 'utf-8');
          logger.info(`Wrote raw lint config to: ${info.configPath}`);
          return { success: true, message: `Saved ${path.basename(info.configPath)}` };
        }
        return { success: false, message: 'No config file found to write to' };
      }

      if (linter === 'eslint') {
        const configPath = path.join(directory, '.eslintrc.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        logger.info(`Wrote .eslintrc.json to: ${directory}`);
        return { success: true, message: 'Saved .eslintrc.json' };
      }

      if (linter === 'ruff') {
        const configPath = path.join(directory, 'ruff.toml');

        // Read existing content and append/update lint section
        let existingContent = '';
        if (await fileExists(configPath)) {
          existingContent = await fs.readFile(configPath, 'utf-8');
        }

        // Simple approach: write the lint rules as TOML
        const lines: string[] = [];
        if (existingContent && !existingContent.includes('[lint]')) {
          lines.push(existingContent.trimEnd());
          lines.push('');
        }
        lines.push('[lint]');
        for (const [key, value] of Object.entries(config)) {
          if (value === undefined) continue;
          if (typeof value === 'string') {
            lines.push(`${key} = "${value}"`);
          } else {
            lines.push(`${key} = ${String(value)}`);
          }
        }
        lines.push('');

        await fs.writeFile(configPath, lines.join('\n'), 'utf-8');
        logger.info(`Wrote ruff lint config to: ${directory}`);
        return { success: true, message: 'Saved ruff.toml lint config' };
      }

      return { success: false, message: `Write not supported for ${linter}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write ${linter} config: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  getPresets(
    ecosystem: Ecosystem,
    linter: LinterType | null
  ): ESLintConfig | Record<string, unknown> {
    if (linter === 'eslint' || (!linter && ecosystem === 'node')) {
      return getESLintPreset();
    }
    if (linter === 'ruff') return getRuffLintPreset();

    // Default to ESLint presets for unknown
    return getESLintPreset();
  }
}

export const lintConfigService = new LintConfigService();
