// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { testConfigService } from '../../../src/main/services/test-config.service';

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const TEST_DIR = path.join(__dirname, '__test_config_test_tmp__');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

describe('TestConfigService', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ── detectTestFramework ──

  describe('detectTestFramework', () => {
    it('detects vitest.config.ts for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'vitest.config.ts'),
        'export default defineConfig({ test: {} })'
      );

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('vitest');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('vitest.config.ts');
      expect(result.coverageCommand).toBe('npx vitest run --coverage');
      expect(result.watchCommand).toBe('npx vitest --watch');
    });

    it('detects vitest.config.json for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'vitest.config.json'),
        JSON.stringify({ test: { environment: 'jsdom' } })
      );

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('vitest');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('vitest.config.json');
    });

    it('detects vitest from package.json devDependencies', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { vitest: '^1.0.0' } })
      );

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('vitest');
      expect(result.hasConfig).toBe(false);
    });

    it('detects jest.config.js for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'jest.config.js'),
        'module.exports = { testEnvironment: "jsdom" }'
      );

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('jest');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('jest.config.js');
    });

    it('detects jest key in package.json', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', jest: { testEnvironment: 'jsdom' } })
      );

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('jest');
      expect(result.configPath).toContain('package.json');
    });

    it('detects jest from package.json devDependencies when no config file', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { jest: '^29.0.0' } })
      );

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('jest');
      expect(result.hasConfig).toBe(false);
    });

    it('detects mocha from .mocharc.yml', async () => {
      await writeFile(path.join(TEST_DIR, '.mocharc.yml'), 'timeout: 5000\n');

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('mocha');
      expect(result.hasConfig).toBe(true);
    });

    it('detects pytest from pytest.ini', async () => {
      await writeFile(path.join(TEST_DIR, 'pytest.ini'), '[pytest]\ntestpaths = tests\n');

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'python');
      expect(result.framework).toBe('pytest');
      expect(result.hasConfig).toBe(true);
      expect(result.coverageCommand).toBe('pytest --cov');
    });

    it('detects [tool.pytest in pyproject.toml', async () => {
      await writeFile(
        path.join(TEST_DIR, 'pyproject.toml'),
        '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n'
      );

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'python');
      expect(result.framework).toBe('pytest');
      expect(result.configPath).toContain('pyproject.toml');
    });

    it('detects go-test for go ecosystem (built-in)', async () => {
      const result = await testConfigService.detectTestFramework(TEST_DIR, 'go');
      expect(result.framework).toBe('go-test');
      expect(result.hasConfig).toBe(false);
      expect(result.configPath).toBeNull();
      expect(result.coverageCommand).toBe('go test -cover ./...');
    });

    it('detects cargo-test for rust ecosystem (built-in)', async () => {
      const result = await testConfigService.detectTestFramework(TEST_DIR, 'rust');
      expect(result.framework).toBe('cargo-test');
      expect(result.hasConfig).toBe(false);
      expect(result.watchCommand).toBe('cargo watch -x test');
    });

    it('detects .rspec for ruby ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.rspec'), '--format documentation\n');

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'ruby');
      expect(result.framework).toBe('rspec');
      expect(result.hasConfig).toBe(true);
    });

    it('detects phpunit.xml for php ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'phpunit.xml'), '<?xml version="1.0"?>\n<phpunit/>\n');

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'php');
      expect(result.framework).toBe('phpunit');
      expect(result.hasConfig).toBe(true);
    });

    it('detects junit for java ecosystem (built-in)', async () => {
      const result = await testConfigService.detectTestFramework(TEST_DIR, 'java');
      expect(result.framework).toBe('junit');
      expect(result.hasConfig).toBe(false);
    });

    it('returns null when no framework is detected', async () => {
      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBeNull();
      expect(result.hasConfig).toBe(false);
      expect(result.coverageCommand).toBeNull();
      expect(result.watchCommand).toBeNull();
    });

    it('falls back to cross-ecosystem detection', async () => {
      await writeFile(path.join(TEST_DIR, 'vitest.config.ts'), 'export default defineConfig({})');

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'python');
      expect(result.framework).toBe('vitest');
    });

    it('prioritizes vitest over jest when both exist', async () => {
      await writeFile(path.join(TEST_DIR, 'vitest.config.ts'), 'export default {}');
      await writeFile(path.join(TEST_DIR, 'jest.config.js'), 'module.exports = {}');

      const result = await testConfigService.detectTestFramework(TEST_DIR, 'node');
      expect(result.framework).toBe('vitest');
    });
  });

  // ── readConfig ──

  describe('readConfig', () => {
    it('reads and parses a Vitest JSON config', async () => {
      const configPath = path.join(TEST_DIR, 'vitest.config.json');
      await writeFile(
        configPath,
        JSON.stringify({
          test: {
            environment: 'jsdom',
            globals: true,
            testTimeout: 5000,
            coverage: {
              provider: 'v8',
              thresholds: {
                statements: 80,
                branches: 70,
                functions: 75,
                lines: 80,
              },
            },
          },
        })
      );

      const result = await testConfigService.readConfig(configPath, 'vitest');
      expect(result.framework).toBe('vitest');
      expect(result.config).toEqual({
        environment: 'jsdom',
        globals: true,
        testTimeout: 5000,
        coverageProvider: 'v8',
        coverageStatements: 80,
        coverageBranches: 70,
        coverageFunctions: 75,
        coverageLines: 80,
      });
    });

    it('returns raw content for TS vitest config', async () => {
      const configPath = path.join(TEST_DIR, 'vitest.config.ts');
      await writeFile(configPath, 'export default defineConfig({ test: {} })');

      const result = await testConfigService.readConfig(configPath, 'vitest');
      expect(result.config).toHaveProperty('_raw');
    });

    it('reads jest config from package.json', async () => {
      const configPath = path.join(TEST_DIR, 'package.json');
      await writeFile(
        configPath,
        JSON.stringify({
          name: 'test',
          jest: {
            testEnvironment: 'jsdom',
            collectCoverage: true,
            coverageProvider: 'v8',
          },
        })
      );

      const result = await testConfigService.readConfig(configPath, 'jest');
      expect(result.framework).toBe('jest');
      expect(result.config).toEqual({
        testEnvironment: 'jsdom',
        collectCoverage: true,
        coverageProvider: 'v8',
      });
    });

    it('reads jest.config.json directly', async () => {
      const configPath = path.join(TEST_DIR, 'jest.config.json');
      await writeFile(
        configPath,
        JSON.stringify({ testEnvironment: 'node', collectCoverage: false })
      );

      const result = await testConfigService.readConfig(configPath, 'jest');
      expect(result.config).toEqual({
        testEnvironment: 'node',
        collectCoverage: false,
      });
    });

    it('returns raw content for JS jest config', async () => {
      const configPath = path.join(TEST_DIR, 'jest.config.js');
      await writeFile(configPath, 'module.exports = { testEnvironment: "jsdom" }');

      const result = await testConfigService.readConfig(configPath, 'jest');
      expect(result.config).toHaveProperty('_raw');
    });

    it('returns raw content for generic framework', async () => {
      const configPath = path.join(TEST_DIR, 'pytest.ini');
      await writeFile(configPath, '[pytest]\ntestpaths = tests\n');

      const result = await testConfigService.readConfig(configPath, 'pytest');
      expect(result.config).toHaveProperty('_raw');
    });
  });

  // ── writeConfig ──

  describe('writeConfig', () => {
    it('writes Vitest config as JSON', async () => {
      const config = {
        environment: 'jsdom' as const,
        globals: true,
        coverageProvider: 'v8' as const,
        coverageStatements: 80,
        coverageBranches: 70,
        coverageFunctions: 75,
        coverageLines: 80,
        testTimeout: 5000,
      };

      const result = await testConfigService.writeConfig(TEST_DIR, 'vitest', config);
      expect(result.success).toBe(true);
      expect(result.message).toContain('vitest.config.json');

      const content = await readFile(path.join(TEST_DIR, 'vitest.config.json'));
      const parsed = JSON.parse(content);
      expect(parsed.test.environment).toBe('jsdom');
      expect(parsed.test.globals).toBe(true);
      expect(parsed.test.coverage.provider).toBe('v8');
      expect(parsed.test.coverage.thresholds.statements).toBe(80);
    });

    it('writes Jest config as JSON', async () => {
      const config = {
        testEnvironment: 'jsdom' as const,
        collectCoverage: true,
        coverageProvider: 'v8' as const,
      };

      const result = await testConfigService.writeConfig(TEST_DIR, 'jest', config);
      expect(result.success).toBe(true);
      expect(result.message).toContain('jest.config.json');

      const content = await readFile(path.join(TEST_DIR, 'jest.config.json'));
      const parsed = JSON.parse(content);
      expect(parsed.testEnvironment).toBe('jsdom');
      expect(parsed.collectCoverage).toBe(true);
    });

    it('returns error for unsupported framework', async () => {
      const result = await testConfigService.writeConfig(TEST_DIR, 'go-test', {});
      expect(result.success).toBe(false);
    });

    it('handles write failure gracefully', async () => {
      const result = await testConfigService.writeConfig(
        '/nonexistent/path/that/does/not/exist',
        'vitest',
        { environment: 'jsdom' }
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save');
    });
  });

  // ── getPresets ──

  describe('getPresets', () => {
    it('returns Vitest preset for node ecosystem', () => {
      const preset = testConfigService.getPresets('node', 'vitest');
      expect(preset).toHaveProperty('environment');
      expect(preset).toHaveProperty('globals');
      expect(preset).toHaveProperty('coverageProvider');
      expect(preset).toHaveProperty('coverageStatements');
      expect(preset).toHaveProperty('testTimeout');
      expect((preset as Record<string, unknown>).environment).toBe('jsdom');
    });

    it('returns Jest preset for jest framework', () => {
      const preset = testConfigService.getPresets('node', 'jest');
      expect(preset).toHaveProperty('testEnvironment');
      expect(preset).toHaveProperty('collectCoverage');
      expect(preset).toHaveProperty('coverageProvider');
      expect((preset as Record<string, unknown>).testEnvironment).toBe('jsdom');
    });

    it('defaults to Vitest preset for node with null framework', () => {
      const preset = testConfigService.getPresets('node', null);
      expect(preset).toHaveProperty('environment');
      expect(preset).toHaveProperty('globals');
    });

    it('defaults to Vitest preset for unknown ecosystem', () => {
      const preset = testConfigService.getPresets('unknown', null);
      expect(preset).toHaveProperty('environment');
    });
  });
});
