/**
 * Coverage Config Service
 *
 * Detect project coverage providers, read/write config files, scan for
 * coverage reports, and provide ecosystem presets. Coverage config is
 * often embedded in test runner configs (vitest.config.*, jest.config.*).
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { shell } from 'electron';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  CoverageProviderType,
  CoverageProviderInfo,
  CoverageConfig,
  VitestCoverageConfig,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('coverage-config');

// ────────────────────────────────────────────────────────────
// Detection
// ────────────────────────────────────────────────────────────

interface DetectionEntry {
  provider: CoverageProviderType;
  files: string[];
  packageJsonDep?: string;
  pyprojectSection?: string;
  coverageCommand: string | null;
}

const DETECTION_MAP: Record<string, DetectionEntry[]> = {
  node: [
    {
      provider: 'v8',
      files: [
        'vitest.config.ts',
        'vitest.config.js',
        'vitest.config.mts',
        'vitest.config.mjs',
        'vitest.config.json',
      ],
      packageJsonDep: 'vitest',
      coverageCommand: 'npx vitest run --coverage',
    },
    {
      provider: 'istanbul',
      files: [
        'jest.config.js',
        'jest.config.ts',
        'jest.config.cjs',
        'jest.config.mjs',
        'jest.config.json',
      ],
      packageJsonDep: 'jest',
      coverageCommand: 'npx jest --coverage',
    },
    {
      provider: 'nyc',
      files: ['.nycrc', '.nycrc.json', '.nycrc.yml', '.nycrc.yaml', 'nyc.config.js'],
      packageJsonDep: 'nyc',
      coverageCommand: 'npx nyc npm test',
    },
  ],
  python: [
    {
      provider: 'coverage-py',
      files: ['.coveragerc'],
      pyprojectSection: '[tool.coverage',
      coverageCommand: 'coverage run -m pytest && coverage report',
    },
  ],
  go: [
    {
      provider: 'go-cover',
      files: [],
      coverageCommand: 'go test -cover ./...',
    },
  ],
  ruby: [
    {
      provider: 'simplecov',
      files: [],
      packageJsonDep: undefined,
      coverageCommand: null,
    },
  ],
  rust: [
    {
      provider: 'tarpaulin',
      files: [],
      coverageCommand: 'cargo tarpaulin',
    },
  ],
  php: [
    {
      provider: 'phpunit',
      files: ['phpunit.xml', 'phpunit.xml.dist'],
      coverageCommand: 'vendor/bin/phpunit --coverage-text',
    },
  ],
  java: [
    {
      provider: 'jacoco',
      files: [],
      coverageCommand: null,
    },
  ],
};

const REPORT_PATHS = [
  'coverage/index.html',
  'coverage/lcov-report/index.html',
  'htmlcov/index.html',
  'coverage-report/index.html',
  'cover/index.html',
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findCoverageReport(directory: string): Promise<string | null> {
  for (const reportPath of REPORT_PATHS) {
    const fullPath = path.join(directory, reportPath);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

async function detectInEcosystem(
  directory: string,
  entries: DetectionEntry[],
  isTargetEcosystem: boolean = false
): Promise<CoverageProviderInfo> {
  for (const entry of entries) {
    // Ruby simplecov — check Gemfile (before built-in check since it also has files: [])
    if (entry.provider === 'simplecov') {
      const gemfilePath = path.join(directory, 'Gemfile');
      if (await fileExists(gemfilePath)) {
        try {
          const content = await fs.readFile(gemfilePath, 'utf-8');
          if (content.includes('simplecov')) {
            const reportPath = await findCoverageReport(directory);
            return {
              provider: 'simplecov',
              configPath: gemfilePath,
              hasConfig: true,
              reportPath,
            };
          }
        } catch {
          // Ignore read errors
        }
      }
      continue;
    }

    // Built-in tools (go-cover, tarpaulin, jacoco) — only when target ecosystem
    if (entry.files.length === 0 && !entry.packageJsonDep) {
      if (isTargetEcosystem) {
        const reportPath = await findCoverageReport(directory);
        return {
          provider: entry.provider,
          configPath: null,
          hasConfig: false,
          reportPath,
        };
      }
      continue;
    }

    // Check config files
    for (const file of entry.files) {
      const fullPath = path.join(directory, file);
      if (await fileExists(fullPath)) {
        const reportPath = await findCoverageReport(directory);
        return {
          provider: entry.provider,
          configPath: fullPath,
          hasConfig: true,
          reportPath,
        };
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
            const reportPath = await findCoverageReport(directory);
            return {
              provider: entry.provider,
              configPath: null,
              hasConfig: false,
              reportPath,
            };
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
            const reportPath = await findCoverageReport(directory);
            return {
              provider: entry.provider,
              configPath: pyprojectPath,
              hasConfig: true,
              reportPath,
            };
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  return {
    provider: null,
    configPath: null,
    hasConfig: false,
    reportPath: null,
  };
}

// ────────────────────────────────────────────────────────────
// Config read/write
// ────────────────────────────────────────────────────────────

function parseVitestCoverage(raw: Record<string, unknown>): VitestCoverageConfig {
  const config: VitestCoverageConfig = {};

  const test = (raw.test ?? raw) as Record<string, unknown>;
  const coverage = (test.coverage ?? test) as Record<string, unknown>;

  if (typeof coverage.provider === 'string')
    config.provider = coverage.provider as 'v8' | 'istanbul';
  if (typeof coverage.all === 'boolean') config.all = coverage.all;
  if (typeof coverage.cleanOnRerun === 'boolean') config.cleanOnRerun = coverage.cleanOnRerun;
  if (typeof coverage.reportsDirectory === 'string')
    config.reportsDirectory = coverage.reportsDirectory;

  if (Array.isArray(coverage.include)) config.include = coverage.include as string[];
  if (Array.isArray(coverage.exclude)) config.exclude = coverage.exclude as string[];
  if (Array.isArray(coverage.reporter)) config.reporters = coverage.reporter as string[];

  const thresholds = coverage.thresholds as Record<string, unknown> | undefined;
  if (thresholds) {
    if (typeof thresholds.statements === 'number') config.statements = thresholds.statements;
    if (typeof thresholds.branches === 'number') config.branches = thresholds.branches;
    if (typeof thresholds.functions === 'number') config.functions = thresholds.functions;
    if (typeof thresholds.lines === 'number') config.lines = thresholds.lines;
  }

  return config;
}

function vitestCoverageToJson(config: VitestCoverageConfig): Record<string, unknown> {
  const coverage: Record<string, unknown> = {};

  if (config.provider !== undefined) coverage.provider = config.provider;
  if (config.all !== undefined) coverage.all = config.all;
  if (config.cleanOnRerun !== undefined) coverage.cleanOnRerun = config.cleanOnRerun;
  if (config.reportsDirectory !== undefined) coverage.reportsDirectory = config.reportsDirectory;
  if (config.include !== undefined) coverage.include = config.include;
  if (config.exclude !== undefined) coverage.exclude = config.exclude;
  if (config.reporters !== undefined) coverage.reporter = config.reporters;

  const thresholds: Record<string, unknown> = {};
  if (config.statements !== undefined) thresholds.statements = config.statements;
  if (config.branches !== undefined) thresholds.branches = config.branches;
  if (config.functions !== undefined) thresholds.functions = config.functions;
  if (config.lines !== undefined) thresholds.lines = config.lines;
  if (Object.keys(thresholds).length > 0) coverage.thresholds = thresholds;

  return { test: { coverage } };
}

// ────────────────────────────────────────────────────────────
// Presets
// ────────────────────────────────────────────────────────────

function getV8Preset(): VitestCoverageConfig {
  return {
    provider: 'v8',
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
    reporters: ['text', 'html', 'lcov'],
    reportsDirectory: './coverage',
    all: false,
    cleanOnRerun: true,
  };
}

function getIstanbulPreset(): VitestCoverageConfig {
  return {
    provider: 'istanbul',
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
    reporters: ['text', 'html', 'lcov'],
    reportsDirectory: './coverage',
    all: false,
    cleanOnRerun: true,
  };
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

class CoverageConfigService {
  async detectCoverage(directory: string, ecosystem: Ecosystem): Promise<CoverageProviderInfo> {
    // Try ecosystem-specific detection first
    const entries = DETECTION_MAP[ecosystem];
    if (entries) {
      const result = await detectInEcosystem(directory, entries, true);
      if (result.provider) return result;
    }

    // Fall back: check all known config files across all ecosystems
    for (const [eco, ecoEntries] of Object.entries(DETECTION_MAP)) {
      if (eco === ecosystem) continue;
      const result = await detectInEcosystem(directory, ecoEntries, false);
      if (result.provider) return result;
    }

    return {
      provider: null,
      configPath: null,
      hasConfig: false,
      reportPath: null,
    };
  }

  async readConfig(configPath: string, provider: CoverageProviderType): Promise<CoverageConfig> {
    const content = await fs.readFile(configPath, 'utf-8');

    if (provider === 'v8' || provider === 'istanbul') {
      // Try parsing as JSON (vitest.config.json, jest.config.json)
      try {
        const raw = JSON.parse(content);
        return {
          provider,
          config: parseVitestCoverage(raw),
          configPath,
        };
      } catch {
        // TS/JS config — return raw for generic editor
        return {
          provider,
          config: { _raw: content },
          configPath,
        };
      }
    }

    // Generic fallback — return raw content
    return {
      provider,
      config: { _raw: content },
      configPath,
    };
  }

  async writeConfig(
    directory: string,
    provider: CoverageProviderType,
    config: VitestCoverageConfig | Record<string, unknown>
  ): Promise<SetUpActionResult> {
    try {
      if (provider === 'v8') {
        const configPath = path.join(directory, 'vitest.config.json');

        // Read existing config to merge coverage into it
        let existing: Record<string, unknown> = {};
        if (await fileExists(configPath)) {
          try {
            const raw = await fs.readFile(configPath, 'utf-8');
            existing = JSON.parse(raw);
          } catch {
            // Start fresh if parse fails
          }
        }

        const coverageJson = vitestCoverageToJson(config as VitestCoverageConfig);
        const test = (existing.test ?? {}) as Record<string, unknown>;
        const merged = {
          ...existing,
          test: { ...test, coverage: (coverageJson.test as Record<string, unknown>).coverage },
        };

        await fs.writeFile(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
        logger.info(`Wrote coverage config to vitest.config.json in: ${directory}`);
        return { success: true, message: 'Saved coverage config' };
      }

      if (provider === 'istanbul') {
        const configPath = path.join(directory, 'jest.config.json');

        let existing: Record<string, unknown> = {};
        if (await fileExists(configPath)) {
          try {
            const raw = await fs.readFile(configPath, 'utf-8');
            existing = JSON.parse(raw);
          } catch {
            // Start fresh
          }
        }

        const coverageCfg = config as VitestCoverageConfig;
        const merged: Record<string, unknown> = { ...existing };
        if (coverageCfg.provider !== undefined) merged.coverageProvider = coverageCfg.provider;
        merged.collectCoverage = true;
        if (coverageCfg.reporters !== undefined) merged.coverageReporters = coverageCfg.reporters;
        if (coverageCfg.reportsDirectory !== undefined)
          merged.coverageDirectory = coverageCfg.reportsDirectory;

        const thresholds: Record<string, unknown> = {};
        if (coverageCfg.statements !== undefined) thresholds.statements = coverageCfg.statements;
        if (coverageCfg.branches !== undefined) thresholds.branches = coverageCfg.branches;
        if (coverageCfg.functions !== undefined) thresholds.functions = coverageCfg.functions;
        if (coverageCfg.lines !== undefined) thresholds.lines = coverageCfg.lines;
        if (Object.keys(thresholds).length > 0) merged.coverageThreshold = { global: thresholds };

        await fs.writeFile(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
        logger.info(`Wrote coverage config to jest.config.json in: ${directory}`);
        return { success: true, message: 'Saved coverage config' };
      }

      return { success: false, message: `Write not supported for ${provider}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write coverage config: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  getPresets(
    ecosystem: Ecosystem,
    provider: CoverageProviderType | null
  ): VitestCoverageConfig | Record<string, unknown> {
    if (provider === 'v8' || (!provider && ecosystem === 'node')) {
      return getV8Preset();
    }
    if (provider === 'istanbul') return getIstanbulPreset();

    // Default to v8 presets for unknown
    return getV8Preset();
  }

  async openReport(reportPath: string): Promise<SetUpActionResult> {
    try {
      await shell.openPath(reportPath);
      logger.info(`Opened coverage report: ${reportPath}`);
      return { success: true, message: 'Opened coverage report' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to open coverage report: ${msg}`);
      return { success: false, message: `Failed to open: ${msg}` };
    }
  }
}

export const coverageConfigService = new CoverageConfigService();
