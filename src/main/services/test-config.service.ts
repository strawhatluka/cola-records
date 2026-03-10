/**
 * Test Config Service
 *
 * Detect project test frameworks, read/write config files (JSON for
 * Vitest/Jest, generic for others), and provide ecosystem presets.
 * No external parsing dependencies.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  TestFrameworkType,
  TestFrameworkInfo,
  TestFrameworkConfig,
  VitestConfig,
  JestConfig,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('test-config');

// ────────────────────────────────────────────────────────────
// Detection
// ────────────────────────────────────────────────────────────

interface DetectionEntry {
  framework: TestFrameworkType;
  files: string[];
  packageJsonKey?: string;
  packageJsonDep?: string;
  pyprojectSection?: string;
  coverageCommand: string | null;
  watchCommand: string | null;
}

const DETECTION_MAP: Record<string, DetectionEntry[]> = {
  node: [
    {
      framework: 'vitest',
      files: [
        'vitest.config.ts',
        'vitest.config.js',
        'vitest.config.mts',
        'vitest.config.mjs',
        'vitest.config.json',
      ],
      packageJsonDep: 'vitest',
      coverageCommand: 'npx vitest run --coverage',
      watchCommand: 'npx vitest --watch',
    },
    {
      framework: 'jest',
      files: [
        'jest.config.js',
        'jest.config.ts',
        'jest.config.cjs',
        'jest.config.mjs',
        'jest.config.json',
      ],
      packageJsonKey: 'jest',
      packageJsonDep: 'jest',
      coverageCommand: 'npx jest --coverage',
      watchCommand: 'npx jest --watch',
    },
    {
      framework: 'mocha',
      files: ['.mocharc.yml', '.mocharc.yaml', '.mocharc.json', '.mocharc.js', '.mocharc.cjs'],
      packageJsonDep: 'mocha',
      coverageCommand: null,
      watchCommand: 'npx mocha --watch',
    },
  ],
  python: [
    {
      framework: 'pytest',
      files: ['pytest.ini', 'conftest.py'],
      pyprojectSection: '[tool.pytest',
      coverageCommand: 'pytest --cov',
      watchCommand: null,
    },
  ],
  go: [
    {
      framework: 'go-test',
      files: [],
      coverageCommand: 'go test -cover ./...',
      watchCommand: null,
    },
  ],
  rust: [
    {
      framework: 'cargo-test',
      files: [],
      coverageCommand: null,
      watchCommand: 'cargo watch -x test',
    },
  ],
  ruby: [
    {
      framework: 'rspec',
      files: ['.rspec'],
      coverageCommand: null,
      watchCommand: null,
    },
  ],
  php: [
    {
      framework: 'phpunit',
      files: ['phpunit.xml', 'phpunit.xml.dist'],
      coverageCommand: 'vendor/bin/phpunit --coverage-text',
      watchCommand: null,
    },
  ],
  java: [
    {
      framework: 'junit',
      files: [],
      coverageCommand: null,
      watchCommand: null,
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
): Promise<TestFrameworkInfo> {
  for (const entry of entries) {
    // Built-in test tools (go-test, cargo-test, junit) — only when target ecosystem
    if (entry.files.length === 0 && !entry.packageJsonDep && !entry.packageJsonKey) {
      if (isTargetEcosystem) {
        return {
          framework: entry.framework,
          configPath: null,
          hasConfig: false,
          coverageCommand: entry.coverageCommand,
          watchCommand: entry.watchCommand,
        };
      }
      continue;
    }

    // Check config files
    for (const file of entry.files) {
      const fullPath = path.join(directory, file);
      if (await fileExists(fullPath)) {
        return {
          framework: entry.framework,
          configPath: fullPath,
          hasConfig: true,
          coverageCommand: entry.coverageCommand,
          watchCommand: entry.watchCommand,
        };
      }
    }

    // Check package.json "jest" key
    if (entry.packageJsonKey) {
      const pkgPath = path.join(directory, 'package.json');
      if (await fileExists(pkgPath)) {
        try {
          const pkgContent = await fs.readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          if (pkg[entry.packageJsonKey]) {
            return {
              framework: entry.framework,
              configPath: pkgPath,
              hasConfig: true,
              coverageCommand: entry.coverageCommand,
              watchCommand: entry.watchCommand,
            };
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Check package.json devDependencies for framework
    if (entry.packageJsonDep) {
      const pkgPath = path.join(directory, 'package.json');
      if (await fileExists(pkgPath)) {
        try {
          const pkgContent = await fs.readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          const devDeps = pkg.devDependencies ?? {};
          const deps = pkg.dependencies ?? {};
          if (devDeps[entry.packageJsonDep] || deps[entry.packageJsonDep]) {
            return {
              framework: entry.framework,
              configPath: null,
              hasConfig: false,
              coverageCommand: entry.coverageCommand,
              watchCommand: entry.watchCommand,
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
            return {
              framework: entry.framework,
              configPath: pyprojectPath,
              hasConfig: true,
              coverageCommand: entry.coverageCommand,
              watchCommand: entry.watchCommand,
            };
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  return {
    framework: null,
    configPath: null,
    hasConfig: false,
    coverageCommand: null,
    watchCommand: null,
  };
}

// ────────────────────────────────────────────────────────────
// Config read/write
// ────────────────────────────────────────────────────────────

function parseVitestJson(raw: Record<string, unknown>): VitestConfig {
  const config: VitestConfig = {};

  const test = (raw.test ?? raw) as Record<string, unknown>;

  if (typeof test.environment === 'string')
    config.environment = test.environment as VitestConfig['environment'];
  if (typeof test.globals === 'boolean') config.globals = test.globals;
  if (typeof test.testTimeout === 'number') config.testTimeout = test.testTimeout;

  // Coverage block
  const coverage = test.coverage as Record<string, unknown> | undefined;
  if (coverage) {
    if (typeof coverage.provider === 'string')
      config.coverageProvider = coverage.provider as 'v8' | 'istanbul';
    const thresholds = coverage.thresholds as Record<string, unknown> | undefined;
    if (thresholds) {
      if (typeof thresholds.statements === 'number')
        config.coverageStatements = thresholds.statements;
      if (typeof thresholds.branches === 'number') config.coverageBranches = thresholds.branches;
      if (typeof thresholds.functions === 'number') config.coverageFunctions = thresholds.functions;
      if (typeof thresholds.lines === 'number') config.coverageLines = thresholds.lines;
    }
  }

  return config;
}

function parseJestJson(raw: Record<string, unknown>): JestConfig {
  const config: JestConfig = {};

  if (typeof raw.testEnvironment === 'string')
    config.testEnvironment = raw.testEnvironment as 'jsdom' | 'node';
  if (typeof raw.collectCoverage === 'boolean') config.collectCoverage = raw.collectCoverage;
  if (typeof raw.coverageProvider === 'string')
    config.coverageProvider = raw.coverageProvider as 'v8' | 'babel';

  return config;
}

function vitestConfigToJson(config: VitestConfig): Record<string, unknown> {
  const test: Record<string, unknown> = {};

  if (config.environment !== undefined) test.environment = config.environment;
  if (config.globals !== undefined) test.globals = config.globals;
  if (config.testTimeout !== undefined) test.testTimeout = config.testTimeout;

  const coverage: Record<string, unknown> = {};
  if (config.coverageProvider !== undefined) coverage.provider = config.coverageProvider;

  const thresholds: Record<string, unknown> = {};
  if (config.coverageStatements !== undefined) thresholds.statements = config.coverageStatements;
  if (config.coverageBranches !== undefined) thresholds.branches = config.coverageBranches;
  if (config.coverageFunctions !== undefined) thresholds.functions = config.coverageFunctions;
  if (config.coverageLines !== undefined) thresholds.lines = config.coverageLines;

  if (Object.keys(thresholds).length > 0) coverage.thresholds = thresholds;
  if (Object.keys(coverage).length > 0) test.coverage = coverage;

  return { test };
}

function jestConfigToJson(config: JestConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (config.testEnvironment !== undefined) result.testEnvironment = config.testEnvironment;
  if (config.collectCoverage !== undefined) result.collectCoverage = config.collectCoverage;
  if (config.coverageProvider !== undefined) result.coverageProvider = config.coverageProvider;
  return result;
}

// ────────────────────────────────────────────────────────────
// Presets
// ────────────────────────────────────────────────────────────

function getVitestPreset(): VitestConfig {
  return {
    environment: 'jsdom',
    globals: true,
    coverageProvider: 'v8',
    coverageStatements: 80,
    coverageBranches: 80,
    coverageFunctions: 80,
    coverageLines: 80,
    testTimeout: 5000,
  };
}

function getJestPreset(): JestConfig {
  return {
    testEnvironment: 'jsdom',
    collectCoverage: true,
    coverageProvider: 'v8',
  };
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

class TestConfigService {
  async detectTestFramework(directory: string, ecosystem: Ecosystem): Promise<TestFrameworkInfo> {
    // Try ecosystem-specific detection first
    const entries = DETECTION_MAP[ecosystem];
    if (entries) {
      const result = await detectInEcosystem(directory, entries, true);
      if (result.framework) return result;
    }

    // Fall back: check all known config files across all ecosystems
    for (const [eco, ecoEntries] of Object.entries(DETECTION_MAP)) {
      if (eco === ecosystem) continue;
      const result = await detectInEcosystem(directory, ecoEntries, false);
      if (result.framework) return result;
    }

    return {
      framework: null,
      configPath: null,
      hasConfig: false,
      coverageCommand: null,
      watchCommand: null,
    };
  }

  async readConfig(configPath: string, framework: TestFrameworkType): Promise<TestFrameworkConfig> {
    const content = await fs.readFile(configPath, 'utf-8');

    if (framework === 'vitest') {
      // Try parsing as JSON (vitest.config.json or extracted)
      try {
        const raw = JSON.parse(content);
        return {
          framework,
          config: parseVitestJson(raw),
          configPath,
        };
      } catch {
        // TS/JS config — return raw for generic editor
        return {
          framework,
          config: { _raw: content },
          configPath,
        };
      }
    }

    if (framework === 'jest') {
      const basename = path.basename(configPath);
      if (basename === 'package.json') {
        const pkg = JSON.parse(content);
        return {
          framework,
          config: parseJestJson(pkg.jest ?? {}),
          configPath,
        };
      }

      // JSON config files
      if (basename.endsWith('.json')) {
        const raw = JSON.parse(content);
        return {
          framework,
          config: parseJestJson(raw),
          configPath,
        };
      }

      // JS/TS config — return raw for generic editor
      return {
        framework,
        config: { _raw: content },
        configPath,
      };
    }

    // Generic fallback — return raw content
    return {
      framework,
      config: { _raw: content },
      configPath,
    };
  }

  async writeConfig(
    directory: string,
    framework: TestFrameworkType,
    config: VitestConfig | JestConfig | Record<string, unknown>
  ): Promise<SetUpActionResult> {
    try {
      if (framework === 'vitest') {
        const configPath = path.join(directory, 'vitest.config.json');
        const json = vitestConfigToJson(config as VitestConfig);
        await fs.writeFile(configPath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
        logger.info(`Wrote vitest.config.json to: ${directory}`);
        return { success: true, message: 'Saved vitest.config.json' };
      }

      if (framework === 'jest') {
        const configPath = path.join(directory, 'jest.config.json');
        const json = jestConfigToJson(config as JestConfig);
        await fs.writeFile(configPath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
        logger.info(`Wrote jest.config.json to: ${directory}`);
        return { success: true, message: 'Saved jest.config.json' };
      }

      return { success: false, message: `Write not supported for ${framework}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write ${framework} config: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  getPresets(
    ecosystem: Ecosystem,
    framework: TestFrameworkType | null
  ): VitestConfig | JestConfig | Record<string, unknown> {
    if (framework === 'vitest' || (!framework && ecosystem === 'node')) {
      return getVitestPreset();
    }
    if (framework === 'jest') return getJestPreset();

    // Default to Vitest presets for unknown
    return getVitestPreset();
  }
}

export const testConfigService = new TestConfigService();
