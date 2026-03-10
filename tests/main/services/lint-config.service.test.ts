// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { lintConfigService } from '../../../src/main/services/lint-config.service';

const TEST_DIR = path.join(__dirname, '__lint_config_test_tmp__');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

describe('LintConfigService', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ── detectLinter ──

  describe('detectLinter', () => {
    it('detects eslint from .eslintrc.json for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, '.eslintrc.json'),
        JSON.stringify({ extends: ['eslint:recommended'] })
      );

      const result = await lintConfigService.detectLinter(TEST_DIR, 'node');
      expect(result.linter).toBe('eslint');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('.eslintrc.json');
    });

    it('detects eslint from eslint.config.js (flat config)', async () => {
      await writeFile(path.join(TEST_DIR, 'eslint.config.js'), 'export default []');

      const result = await lintConfigService.detectLinter(TEST_DIR, 'node');
      expect(result.linter).toBe('eslint');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('eslint.config.js');
    });

    it('detects eslint from package.json devDependencies', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { eslint: '^9.0.0' } })
      );

      const result = await lintConfigService.detectLinter(TEST_DIR, 'node');
      expect(result.linter).toBe('eslint');
      expect(result.hasConfig).toBe(false);
    });

    it('detects ruff from ruff.toml for python ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'ruff.toml'), 'line-length = 88\n');

      const result = await lintConfigService.detectLinter(TEST_DIR, 'python');
      expect(result.linter).toBe('ruff');
      expect(result.hasConfig).toBe(true);
    });

    it('detects ruff from pyproject.toml for python ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'pyproject.toml'), '[tool.ruff]\nline-length = 88\n');

      const result = await lintConfigService.detectLinter(TEST_DIR, 'python');
      expect(result.linter).toBe('ruff');
      expect(result.hasConfig).toBe(true);
    });

    it('detects clippy as built-in for rust ecosystem', async () => {
      const result = await lintConfigService.detectLinter(TEST_DIR, 'rust');
      expect(result.linter).toBe('clippy');
      expect(result.hasConfig).toBe(false);
    });

    it('does not detect clippy for non-rust ecosystem', async () => {
      const result = await lintConfigService.detectLinter(TEST_DIR, 'node');
      expect(result.linter).toBeNull();
    });

    it('detects golangci-lint from .golangci.yml for go ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.golangci.yml'), 'linters:\n  enable: []');

      const result = await lintConfigService.detectLinter(TEST_DIR, 'go');
      expect(result.linter).toBe('golangci-lint');
      expect(result.hasConfig).toBe(true);
    });

    it('detects rubocop from .rubocop.yml for ruby ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.rubocop.yml'), 'AllCops:\n  TargetRubyVersion: 3.0');

      const result = await lintConfigService.detectLinter(TEST_DIR, 'ruby');
      expect(result.linter).toBe('rubocop');
      expect(result.hasConfig).toBe(true);
    });

    it('detects phpstan from phpstan.neon for php ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'phpstan.neon'), 'parameters:\n  level: 6');

      const result = await lintConfigService.detectLinter(TEST_DIR, 'php');
      expect(result.linter).toBe('phpstan');
      expect(result.hasConfig).toBe(true);
    });

    it('detects checkstyle from checkstyle.xml for java ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'checkstyle.xml'), '<module name="Checker"/>');

      const result = await lintConfigService.detectLinter(TEST_DIR, 'java');
      expect(result.linter).toBe('checkstyle');
      expect(result.hasConfig).toBe(true);
    });

    it('returns null for empty directory', async () => {
      const result = await lintConfigService.detectLinter(TEST_DIR, 'node');
      expect(result.linter).toBeNull();
      expect(result.hasConfig).toBe(false);
    });

    it('falls back to cross-ecosystem detection', async () => {
      await writeFile(
        path.join(TEST_DIR, '.eslintrc.json'),
        JSON.stringify({ extends: ['eslint:recommended'] })
      );

      const result = await lintConfigService.detectLinter(TEST_DIR, 'python');
      expect(result.linter).toBe('eslint');
      expect(result.hasConfig).toBe(true);
    });
  });

  // ── readConfig ──

  describe('readConfig', () => {
    it('reads ESLint JSON config with structured fields', async () => {
      const configPath = path.join(TEST_DIR, '.eslintrc.json');
      await writeFile(
        configPath,
        JSON.stringify({
          env: { browser: true, node: true },
          extends: ['eslint:recommended'],
          rules: { 'no-console': 'warn' },
          parser: '@typescript-eslint/parser',
          plugins: ['@typescript-eslint'],
          ignorePatterns: ['dist/'],
        })
      );

      const result = await lintConfigService.readConfig(configPath, 'eslint');
      expect(result.linter).toBe('eslint');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg.env).toEqual({ browser: true, node: true });
      expect(cfg.extends).toEqual(['eslint:recommended']);
      expect(cfg.rules).toEqual({ 'no-console': 'warn' });
      expect(cfg.parser).toBe('@typescript-eslint/parser');
      expect(cfg.plugins).toEqual(['@typescript-eslint']);
      expect(cfg.ignorePatterns).toEqual(['dist/']);
    });

    it('returns raw content for JS ESLint config', async () => {
      const configPath = path.join(TEST_DIR, 'eslint.config.js');
      await writeFile(configPath, 'export default []');

      const result = await lintConfigService.readConfig(configPath, 'eslint');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('export default []');
    });

    it('returns raw content for non-eslint linters', async () => {
      const configPath = path.join(TEST_DIR, '.rubocop.yml');
      await writeFile(configPath, 'AllCops:\n  TargetRubyVersion: 3.0');

      const result = await lintConfigService.readConfig(configPath, 'rubocop');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('AllCops:\n  TargetRubyVersion: 3.0');
    });
  });

  // ── writeConfig ──

  describe('writeConfig', () => {
    it('writes ESLint JSON config to .eslintrc.json', async () => {
      const result = await lintConfigService.writeConfig(TEST_DIR, 'eslint', {
        env: { browser: true },
        extends: ['eslint:recommended'],
        rules: { 'no-console': 'warn' },
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(TEST_DIR, '.eslintrc.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.env).toEqual({ browser: true });
      expect(parsed.extends).toEqual(['eslint:recommended']);
      expect(parsed.rules).toEqual({ 'no-console': 'warn' });
    });

    it('writes raw content when _raw key is present', async () => {
      // Create a detectable config file first
      await writeFile(
        path.join(TEST_DIR, '.eslintrc.json'),
        JSON.stringify({ extends: ['eslint:recommended'] })
      );

      const result = await lintConfigService.writeConfig(TEST_DIR, 'eslint', {
        _raw: '// custom eslint config\nexport default []',
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(TEST_DIR, '.eslintrc.json'), 'utf-8');
      expect(content).toBe('// custom eslint config\nexport default []');
    });

    it('returns error for unsupported linter write', async () => {
      const result = await lintConfigService.writeConfig(TEST_DIR, 'clippy', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');
    });
  });

  // ── getPresets ──

  describe('getPresets', () => {
    it('returns ESLint preset for node ecosystem', () => {
      const preset = lintConfigService.getPresets('node', null);
      expect(preset).toHaveProperty('env');
      expect(preset).toHaveProperty('extends');
      expect(preset).toHaveProperty('rules');
    });

    it('returns ESLint preset for explicit eslint linter', () => {
      const preset = lintConfigService.getPresets('node', 'eslint');
      expect(preset).toHaveProperty('env');
      expect(preset).toHaveProperty('parserOptions');
    });

    it('returns ruff preset for ruff linter', () => {
      const preset = lintConfigService.getPresets('python', 'ruff');
      expect(preset).toHaveProperty('line-length', 88);
      expect(preset).toHaveProperty('select', 'E,F,W');
    });

    it('returns ESLint preset for unknown ecosystem', () => {
      const preset = lintConfigService.getPresets('ruby', null);
      expect(preset).toHaveProperty('env');
    });
  });
});
