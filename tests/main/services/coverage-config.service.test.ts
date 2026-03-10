// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
  },
}));

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { coverageConfigService } from '../../../src/main/services/coverage-config.service';

const TEST_DIR = path.join(__dirname, '__coverage_config_test_tmp__');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

describe('CoverageConfigService', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ── detectCoverage ──

  describe('detectCoverage', () => {
    it('detects v8 from vitest.config.ts for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'vitest.config.ts'),
        'export default defineConfig({ test: { coverage: { provider: "v8" } } })'
      );

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBe('v8');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('vitest.config.ts');
    });

    it('detects v8 from vitest.config.json for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'vitest.config.json'),
        JSON.stringify({ test: { coverage: { provider: 'v8' } } })
      );

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBe('v8');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('vitest.config.json');
    });

    it('detects istanbul from jest.config.js for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'jest.config.js'),
        'module.exports = { collectCoverage: true }'
      );

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBe('istanbul');
      expect(result.hasConfig).toBe(true);
    });

    it('detects nyc from .nycrc for node ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.nycrc'), '{ "reporter": ["text", "html"] }');

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBe('nyc');
      expect(result.hasConfig).toBe(true);
    });

    it('detects vitest from package.json devDependencies', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { vitest: '^1.0.0' } })
      );

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBe('v8');
      expect(result.hasConfig).toBe(false);
    });

    it('detects coverage-py from .coveragerc for python ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.coveragerc'), '[run]\nsource = .\n');

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'python');
      expect(result.provider).toBe('coverage-py');
      expect(result.hasConfig).toBe(true);
    });

    it('detects coverage-py from pyproject.toml for python ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'pyproject.toml'),
        '[tool.coverage.run]\nsource = ["src"]\n'
      );

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'python');
      expect(result.provider).toBe('coverage-py');
      expect(result.hasConfig).toBe(true);
    });

    it('detects go-cover as built-in for go ecosystem', async () => {
      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'go');
      expect(result.provider).toBe('go-cover');
      expect(result.hasConfig).toBe(false);
    });

    it('does not detect go-cover for non-go ecosystem', async () => {
      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBeNull();
    });

    it('detects tarpaulin as built-in for rust ecosystem', async () => {
      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'rust');
      expect(result.provider).toBe('tarpaulin');
      expect(result.hasConfig).toBe(false);
    });

    it('detects phpunit from phpunit.xml for php ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'phpunit.xml'), '<phpunit></phpunit>');

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'php');
      expect(result.provider).toBe('phpunit');
      expect(result.hasConfig).toBe(true);
    });

    it('detects simplecov from Gemfile for ruby ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'Gemfile'), "gem 'simplecov', require: false\n");

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'ruby');
      expect(result.provider).toBe('simplecov');
      expect(result.hasConfig).toBe(true);
    });

    it('detects jacoco as built-in for java ecosystem', async () => {
      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'java');
      expect(result.provider).toBe('jacoco');
      expect(result.hasConfig).toBe(false);
    });

    it('returns null for empty directory', async () => {
      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBeNull();
      expect(result.hasConfig).toBe(false);
    });

    it('finds report path when coverage/index.html exists', async () => {
      await writeFile(path.join(TEST_DIR, 'vitest.config.ts'), 'export default {}');
      await writeFile(path.join(TEST_DIR, 'coverage', 'index.html'), '<html></html>');

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.reportPath).toContain(path.join('coverage', 'index.html'));
    });

    it('returns null reportPath when no report exists', async () => {
      await writeFile(path.join(TEST_DIR, 'vitest.config.ts'), 'export default {}');

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.reportPath).toBeNull();
    });

    it('prefers vitest over jest when both exist', async () => {
      await writeFile(path.join(TEST_DIR, 'vitest.config.ts'), 'export default {}');
      await writeFile(path.join(TEST_DIR, 'jest.config.js'), 'module.exports = {}');

      const result = await coverageConfigService.detectCoverage(TEST_DIR, 'node');
      expect(result.provider).toBe('v8');
    });
  });

  // ── readConfig ──

  describe('readConfig', () => {
    it('reads vitest JSON config with coverage block', async () => {
      const configPath = path.join(TEST_DIR, 'vitest.config.json');
      await writeFile(
        configPath,
        JSON.stringify({
          test: {
            coverage: {
              provider: 'v8',
              thresholds: { statements: 80, branches: 70 },
              reporter: ['text', 'html'],
              all: true,
            },
          },
        })
      );

      const result = await coverageConfigService.readConfig(configPath, 'v8');
      expect(result.provider).toBe('v8');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg.provider).toBe('v8');
      expect(cfg.statements).toBe(80);
      expect(cfg.branches).toBe(70);
      expect(cfg.reporters).toEqual(['text', 'html']);
      expect(cfg.all).toBe(true);
    });

    it('returns raw content for TS/JS vitest config', async () => {
      const configPath = path.join(TEST_DIR, 'vitest.config.ts');
      await writeFile(configPath, 'export default defineConfig({})');

      const result = await coverageConfigService.readConfig(configPath, 'v8');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('export default defineConfig({})');
    });

    it('returns raw content for nyc config', async () => {
      const configPath = path.join(TEST_DIR, '.nycrc');
      await writeFile(configPath, '{ "reporter": ["text"] }');

      const result = await coverageConfigService.readConfig(configPath, 'nyc');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('{ "reporter": ["text"] }');
    });

    it('returns raw content for .coveragerc', async () => {
      const configPath = path.join(TEST_DIR, '.coveragerc');
      await writeFile(configPath, '[run]\nsource = .\n');

      const result = await coverageConfigService.readConfig(configPath, 'coverage-py');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('[run]\nsource = .\n');
    });
  });

  // ── writeConfig ──

  describe('writeConfig', () => {
    it('writes v8 coverage config to vitest.config.json', async () => {
      const result = await coverageConfigService.writeConfig(TEST_DIR, 'v8', {
        provider: 'v8',
        statements: 90,
        branches: 85,
        reporters: ['text', 'html'],
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(TEST_DIR, 'vitest.config.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.test.coverage.provider).toBe('v8');
      expect(parsed.test.coverage.thresholds.statements).toBe(90);
    });

    it('merges v8 coverage into existing vitest.config.json', async () => {
      await writeFile(
        path.join(TEST_DIR, 'vitest.config.json'),
        JSON.stringify({ test: { environment: 'jsdom', globals: true } })
      );

      const result = await coverageConfigService.writeConfig(TEST_DIR, 'v8', {
        provider: 'v8',
        statements: 80,
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(TEST_DIR, 'vitest.config.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.test.environment).toBe('jsdom');
      expect(parsed.test.globals).toBe(true);
      expect(parsed.test.coverage.provider).toBe('v8');
    });

    it('writes istanbul coverage config to jest.config.json', async () => {
      const result = await coverageConfigService.writeConfig(TEST_DIR, 'istanbul', {
        provider: 'istanbul',
        statements: 80,
        reporters: ['text', 'lcov'],
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(TEST_DIR, 'jest.config.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.collectCoverage).toBe(true);
      expect(parsed.coverageProvider).toBe('istanbul');
      expect(parsed.coverageThreshold.global.statements).toBe(80);
    });

    it('returns error for unsupported provider', async () => {
      const result = await coverageConfigService.writeConfig(TEST_DIR, 'nyc', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');
    });
  });

  // ── getPresets ──

  describe('getPresets', () => {
    it('returns v8 preset for node ecosystem', () => {
      const preset = coverageConfigService.getPresets('node', null);
      expect(preset).toHaveProperty('provider', 'v8');
      expect(preset).toHaveProperty('statements', 80);
      expect(preset).toHaveProperty('reporters');
    });

    it('returns v8 preset for explicit v8 provider', () => {
      const preset = coverageConfigService.getPresets('node', 'v8');
      expect(preset).toHaveProperty('provider', 'v8');
    });

    it('returns istanbul preset for explicit istanbul provider', () => {
      const preset = coverageConfigService.getPresets('node', 'istanbul');
      expect(preset).toHaveProperty('provider', 'istanbul');
    });

    it('returns v8 preset for unknown ecosystem', () => {
      const preset = coverageConfigService.getPresets('ruby', 'go-cover');
      expect(preset).toHaveProperty('provider', 'v8');
    });
  });

  // ── openReport ──

  describe('openReport', () => {
    it('calls shell.openPath with the report path', async () => {
      const { shell } = await import('electron');
      const result = await coverageConfigService.openReport('/fake/coverage/index.html');
      expect(result.success).toBe(true);
      expect(shell.openPath).toHaveBeenCalledWith('/fake/coverage/index.html');
    });
  });
});
