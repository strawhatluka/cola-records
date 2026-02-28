// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { formatConfigService } from '../../../src/main/services/format-config.service';

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const TEST_DIR = path.join(__dirname, '__format_config_test_tmp__');

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

describe('FormatConfigService', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ── detectFormatter ──

  describe('detectFormatter', () => {
    it('detects .prettierrc.json for node ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.prettierrc.json'), '{ "semi": true }');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'node');
      expect(result.formatter).toBe('prettier');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('.prettierrc.json');
    });

    it('detects .prettierrc (no extension) for node ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.prettierrc'), '{ "singleQuote": true }');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'node');
      expect(result.formatter).toBe('prettier');
      expect(result.hasConfig).toBe(true);
    });

    it('detects prettier key in package.json', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', prettier: { semi: true } })
      );

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'node');
      expect(result.formatter).toBe('prettier');
      expect(result.configPath).toContain('package.json');
    });

    it('detects ruff.toml for python ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'ruff.toml'), 'line-length = 88\n');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'python');
      expect(result.formatter).toBe('ruff');
      expect(result.hasConfig).toBe(true);
    });

    it('detects [tool.ruff] in pyproject.toml for python', async () => {
      await writeFile(path.join(TEST_DIR, 'pyproject.toml'), '[tool.ruff]\nline-length = 88\n');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'python');
      expect(result.formatter).toBe('ruff');
      expect(result.configPath).toContain('pyproject.toml');
    });

    it('detects [tool.black] in pyproject.toml for python', async () => {
      await writeFile(path.join(TEST_DIR, 'pyproject.toml'), '[tool.black]\nline-length = 88\n');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'python');
      expect(result.formatter).toBe('black');
    });

    it('detects rustfmt.toml for rust ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'rustfmt.toml'), 'max_width = 100\n');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'rust');
      expect(result.formatter).toBe('rustfmt');
      expect(result.hasConfig).toBe(true);
    });

    it('detects gofmt for go ecosystem (no config needed)', async () => {
      const result = await formatConfigService.detectFormatter(TEST_DIR, 'go');
      expect(result.formatter).toBe('gofmt');
      expect(result.hasConfig).toBe(false);
      expect(result.configPath).toBeNull();
    });

    it('detects .rubocop.yml for ruby ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.rubocop.yml'), 'AllCops:\n  NewCops: enable\n');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'ruby');
      expect(result.formatter).toBe('rubocop');
      expect(result.hasConfig).toBe(true);
    });

    it('returns null when no formatter is detected', async () => {
      const result = await formatConfigService.detectFormatter(TEST_DIR, 'node');
      expect(result.formatter).toBeNull();
      expect(result.hasConfig).toBe(false);
    });

    it('falls back to cross-ecosystem detection', async () => {
      // Place a prettier config but detect as python ecosystem
      await writeFile(path.join(TEST_DIR, '.prettierrc.json'), '{ "semi": true }');

      const result = await formatConfigService.detectFormatter(TEST_DIR, 'python');
      expect(result.formatter).toBe('prettier');
    });
  });

  // ── readConfig ──

  describe('readConfig', () => {
    it('reads and parses a Prettier JSON config', async () => {
      const configPath = path.join(TEST_DIR, '.prettierrc.json');
      await writeFile(
        configPath,
        JSON.stringify({
          semi: true,
          singleQuote: true,
          printWidth: 100,
          tabWidth: 2,
          trailingComma: 'es5',
          arrowParens: 'always',
        })
      );

      const result = await formatConfigService.readConfig(configPath, 'prettier');
      expect(result.formatter).toBe('prettier');
      expect(result.config).toEqual({
        semi: true,
        singleQuote: true,
        printWidth: 100,
        tabWidth: 2,
        trailingComma: 'es5',
        arrowParens: 'always',
      });
    });

    it('reads prettier config from package.json', async () => {
      const configPath = path.join(TEST_DIR, 'package.json');
      await writeFile(
        configPath,
        JSON.stringify({
          name: 'test',
          prettier: { semi: false, singleQuote: true },
        })
      );

      const result = await formatConfigService.readConfig(configPath, 'prettier');
      expect(result.config).toEqual({ semi: false, singleQuote: true });
    });

    it('reads a simple TOML config for ruff', async () => {
      const configPath = path.join(TEST_DIR, 'ruff.toml');
      await writeFile(configPath, ['line-length = 88', 'indent-width = 4', ''].join('\n'));

      const result = await formatConfigService.readConfig(configPath, 'ruff');
      expect(result.formatter).toBe('ruff');
      expect(result.config).toEqual({
        'line-length': 88,
        'indent-width': 4,
      });
    });

    it('reads a simple TOML config for rustfmt', async () => {
      const configPath = path.join(TEST_DIR, 'rustfmt.toml');
      await writeFile(
        configPath,
        ['max_width = 100', 'tab_spaces = 4', 'edition = "2021"'].join('\n')
      );

      const result = await formatConfigService.readConfig(configPath, 'rustfmt');
      expect(result.config).toEqual({
        max_width: 100,
        tab_spaces: 4,
        edition: '2021',
      });
    });

    it('returns raw content for unsupported formatters', async () => {
      const configPath = path.join(TEST_DIR, '.rubocop.yml');
      await writeFile(configPath, 'AllCops:\n  NewCops: enable\n');

      const result = await formatConfigService.readConfig(configPath, 'rubocop');
      expect(result.config).toHaveProperty('_raw');
    });
  });

  // ── writeConfig ──

  describe('writeConfig', () => {
    it('writes Prettier config as JSON', async () => {
      const config = {
        semi: true,
        singleQuote: true,
        printWidth: 100,
      };

      const result = await formatConfigService.writeConfig(TEST_DIR, 'prettier', config);
      expect(result.success).toBe(true);
      expect(result.message).toContain('.prettierrc.json');

      const content = await readFile(path.join(TEST_DIR, '.prettierrc.json'));
      const parsed = JSON.parse(content);
      expect(parsed.semi).toBe(true);
      expect(parsed.printWidth).toBe(100);
    });

    it('writes ruff config as TOML', async () => {
      const config = { 'line-length': 88, 'indent-width': 4 };

      const result = await formatConfigService.writeConfig(TEST_DIR, 'ruff', config);
      expect(result.success).toBe(true);

      const content = await readFile(path.join(TEST_DIR, 'ruff.toml'));
      expect(content).toContain('line-length = 88');
      expect(content).toContain('indent-width = 4');
    });

    it('writes rustfmt config as TOML', async () => {
      const config = { max_width: 100, edition: '2021' };

      const result = await formatConfigService.writeConfig(TEST_DIR, 'rustfmt', config);
      expect(result.success).toBe(true);

      const content = await readFile(path.join(TEST_DIR, 'rustfmt.toml'));
      expect(content).toContain('max_width = 100');
      expect(content).toContain('edition = "2021"');
    });

    it('returns error for unsupported formatters', async () => {
      const result = await formatConfigService.writeConfig(TEST_DIR, 'gofmt', {});
      expect(result.success).toBe(false);
    });
  });

  // ── getPresets ──

  describe('getPresets', () => {
    it('returns Prettier preset for node ecosystem', () => {
      const preset = formatConfigService.getPresets('node', 'prettier');
      expect(preset).toHaveProperty('semi');
      expect(preset).toHaveProperty('singleQuote');
      expect(preset).toHaveProperty('printWidth');
      expect((preset as Record<string, unknown>).tabWidth).toBe(2);
    });

    it('returns ruff preset for ruff formatter', () => {
      const preset = formatConfigService.getPresets('python', 'ruff');
      expect(preset).toHaveProperty('line-length');
    });

    it('returns black preset for black formatter', () => {
      const preset = formatConfigService.getPresets('python', 'black');
      expect(preset).toHaveProperty('line-length');
    });

    it('returns rustfmt preset for rust formatter', () => {
      const preset = formatConfigService.getPresets('rust', 'rustfmt');
      expect(preset).toHaveProperty('max_width');
    });

    it('defaults to Prettier preset for unknown formatter in node', () => {
      const preset = formatConfigService.getPresets('node', null);
      expect(preset).toHaveProperty('semi');
    });

    it('defaults to Prettier preset for unknown ecosystem', () => {
      const preset = formatConfigService.getPresets('unknown', null);
      expect(preset).toHaveProperty('semi');
    });
  });

  // ── createIgnoreFile ──

  describe('createIgnoreFile', () => {
    it('creates .prettierignore with default content', async () => {
      const result = await formatConfigService.createIgnoreFile(TEST_DIR, 'prettier');
      expect(result.success).toBe(true);
      expect(result.message).toContain('.prettierignore');

      const content = await readFile(path.join(TEST_DIR, '.prettierignore'));
      expect(content).toContain('node_modules/');
      expect(content).toContain('dist/');
    });

    it('returns error when .prettierignore already exists', async () => {
      await writeFile(path.join(TEST_DIR, '.prettierignore'), '# existing\n');
      const result = await formatConfigService.createIgnoreFile(TEST_DIR, 'prettier');
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('creates .ruff_ignore for ruff formatter', async () => {
      const result = await formatConfigService.createIgnoreFile(TEST_DIR, 'ruff');
      expect(result.success).toBe(true);

      const content = await readFile(path.join(TEST_DIR, '.ruff_ignore'));
      expect(content).toContain('__pycache__/');
    });

    it('returns error for unsupported formatter ignore', async () => {
      const result = await formatConfigService.createIgnoreFile(TEST_DIR, 'gofmt');
      expect(result.success).toBe(false);
    });
  });

  // ── readIgnoreFile ──

  describe('readIgnoreFile', () => {
    it('reads .prettierignore content', async () => {
      await writeFile(path.join(TEST_DIR, '.prettierignore'), 'node_modules/\ndist/\n');

      const content = await formatConfigService.readIgnoreFile(TEST_DIR, 'prettier');
      expect(content).toContain('node_modules/');
      expect(content).toContain('dist/');
    });

    it('reads .ruff_ignore content', async () => {
      await writeFile(path.join(TEST_DIR, '.ruff_ignore'), '__pycache__/\n.venv/\n');

      const content = await formatConfigService.readIgnoreFile(TEST_DIR, 'ruff');
      expect(content).toContain('__pycache__/');
    });

    it('returns empty string when ignore file does not exist', async () => {
      const content = await formatConfigService.readIgnoreFile(TEST_DIR, 'prettier');
      expect(content).toBe('');
    });

    it('returns empty string for unsupported formatter', async () => {
      const content = await formatConfigService.readIgnoreFile(TEST_DIR, 'gofmt');
      expect(content).toBe('');
    });
  });

  // ── writeIgnoreFile ──

  describe('writeIgnoreFile', () => {
    it('writes .prettierignore content', async () => {
      const content = 'node_modules/\ndist/\nbuild/\n';
      const result = await formatConfigService.writeIgnoreFile(TEST_DIR, 'prettier', content);
      expect(result.success).toBe(true);

      const written = await readFile(path.join(TEST_DIR, '.prettierignore'));
      expect(written).toBe(content);
    });

    it('writes .ruff_ignore content', async () => {
      const content = '__pycache__/\n';
      const result = await formatConfigService.writeIgnoreFile(TEST_DIR, 'ruff', content);
      expect(result.success).toBe(true);

      const written = await readFile(path.join(TEST_DIR, '.ruff_ignore'));
      expect(written).toBe(content);
    });

    it('returns error for unsupported formatter', async () => {
      const result = await formatConfigService.writeIgnoreFile(TEST_DIR, 'gofmt', '');
      expect(result.success).toBe(false);
    });

    it('overwrites existing ignore file', async () => {
      await writeFile(path.join(TEST_DIR, '.prettierignore'), 'old content');
      const result = await formatConfigService.writeIgnoreFile(
        TEST_DIR,
        'prettier',
        'new content\n'
      );
      expect(result.success).toBe(true);

      const written = await readFile(path.join(TEST_DIR, '.prettierignore'));
      expect(written).toBe('new content\n');
    });
  });
});
