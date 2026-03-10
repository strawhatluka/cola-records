// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { editorconfigService } from '../../../src/main/services/editorconfig.service';

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const TEST_DIR = path.join(__dirname, '__editorconfig_test_tmp__');

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

describe('EditorConfigService', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ── readConfig ──

  describe('readConfig', () => {
    it('parses a standard .editorconfig file', async () => {
      await writeFile(
        path.join(TEST_DIR, '.editorconfig'),
        [
          '# EditorConfig',
          'root = true',
          '',
          '[*]',
          'indent_style = space',
          'indent_size = 2',
          'end_of_line = lf',
          'charset = utf-8',
          'trim_trailing_whitespace = true',
          'insert_final_newline = true',
          '',
          '[*.md]',
          'trim_trailing_whitespace = false',
          '',
        ].join('\n')
      );

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.root).toBe(true);
      expect(config.sections).toHaveLength(2);
      expect(config.sections[0].glob).toBe('*');
      expect(config.sections[0].properties.indent_style).toBe('space');
      expect(config.sections[0].properties.indent_size).toBe(2);
      expect(config.sections[0].properties.trim_trailing_whitespace).toBe(true);
      expect(config.sections[1].glob).toBe('*.md');
      expect(config.sections[1].properties.trim_trailing_whitespace).toBe(false);
    });

    it('returns empty config when file does not exist', async () => {
      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.root).toBe(true);
      expect(config.sections).toHaveLength(0);
    });

    it('parses max_line_length as number', async () => {
      await writeFile(
        path.join(TEST_DIR, '.editorconfig'),
        ['root = true', '', '[*]', 'max_line_length = 120'].join('\n')
      );

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.sections[0].properties.max_line_length).toBe(120);
    });

    it('parses max_line_length = off as string', async () => {
      await writeFile(
        path.join(TEST_DIR, '.editorconfig'),
        ['root = true', '', '[*]', 'max_line_length = off'].join('\n')
      );

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.sections[0].properties.max_line_length).toBe('off');
    });

    it('handles tab_width property', async () => {
      await writeFile(
        path.join(TEST_DIR, '.editorconfig'),
        ['root = true', '', '[*]', 'indent_style = tab', 'tab_width = 4'].join('\n')
      );

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.sections[0].properties.indent_style).toBe('tab');
      expect(config.sections[0].properties.tab_width).toBe(4);
    });

    it('handles root = false', async () => {
      await writeFile(
        path.join(TEST_DIR, '.editorconfig'),
        ['root = false', '', '[*]', 'indent_size = 4'].join('\n')
      );

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.root).toBe(false);
    });

    it('skips comment lines (# and ;)', async () => {
      await writeFile(
        path.join(TEST_DIR, '.editorconfig'),
        [
          '# Comment',
          '; Another comment',
          'root = true',
          '',
          '[*]',
          '# property comment',
          'indent_size = 2',
        ].join('\n')
      );

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.root).toBe(true);
      expect(config.sections).toHaveLength(1);
      expect(config.sections[0].properties.indent_size).toBe(2);
    });

    it('handles multiple sections with complex globs', async () => {
      await writeFile(
        path.join(TEST_DIR, '.editorconfig'),
        [
          'root = true',
          '',
          '[*]',
          'indent_size = 2',
          '',
          '[*.{py,pyx}]',
          'indent_size = 4',
          '',
          '[Makefile]',
          'indent_style = tab',
        ].join('\n')
      );

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.sections).toHaveLength(3);
      expect(config.sections[1].glob).toBe('*.{py,pyx}');
      expect(config.sections[1].properties.indent_size).toBe(4);
      expect(config.sections[2].glob).toBe('Makefile');
      expect(config.sections[2].properties.indent_style).toBe('tab');
    });
  });

  // ── writeConfig ──

  describe('writeConfig', () => {
    it('writes config in correct INI format', async () => {
      const config = {
        root: true,
        sections: [
          {
            glob: '*',
            properties: {
              indent_style: 'space' as const,
              indent_size: 2,
              end_of_line: 'lf' as const,
              charset: 'utf-8' as const,
              trim_trailing_whitespace: true,
              insert_final_newline: true,
            },
          },
          {
            glob: '*.md',
            properties: {
              trim_trailing_whitespace: false,
            },
          },
        ],
      };

      const result = await editorconfigService.writeConfig(TEST_DIR, config);
      expect(result.success).toBe(true);

      const content = await readFile(path.join(TEST_DIR, '.editorconfig'));
      expect(content).toContain('root = true');
      expect(content).toContain('[*]');
      expect(content).toContain('indent_style = space');
      expect(content).toContain('indent_size = 2');
      expect(content).toContain('[*.md]');
      expect(content).toContain('trim_trailing_whitespace = false');
    });

    it('omits undefined properties (sparse config)', async () => {
      const config = {
        root: true,
        sections: [
          {
            glob: '*',
            properties: {
              indent_size: 4,
            },
          },
        ],
      };

      const result = await editorconfigService.writeConfig(TEST_DIR, config);
      expect(result.success).toBe(true);

      const content = await readFile(path.join(TEST_DIR, '.editorconfig'));
      expect(content).toContain('indent_size = 4');
      expect(content).not.toContain('indent_style');
      expect(content).not.toContain('end_of_line');
    });

    it('round-trips a config correctly', async () => {
      const original = {
        root: true,
        sections: [
          {
            glob: '*',
            properties: {
              indent_style: 'space' as const,
              indent_size: 2,
              end_of_line: 'lf' as const,
              charset: 'utf-8' as const,
              trim_trailing_whitespace: true,
              insert_final_newline: true,
            },
          },
        ],
      };

      await editorconfigService.writeConfig(TEST_DIR, original);
      const parsed = await editorconfigService.readConfig(TEST_DIR);

      expect(parsed.root).toBe(original.root);
      expect(parsed.sections).toHaveLength(1);
      expect(parsed.sections[0].properties).toEqual(original.sections[0].properties);
    });
  });

  // ── createDefault ──

  describe('createDefault', () => {
    it('creates .editorconfig with node preset', async () => {
      const result = await editorconfigService.createDefault(TEST_DIR, 'node');
      expect(result.success).toBe(true);
      expect(result.message).toContain('node');

      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.root).toBe(true);
      expect(config.sections.length).toBeGreaterThanOrEqual(1);
      expect(config.sections[0].properties.indent_style).toBe('space');
      expect(config.sections[0].properties.indent_size).toBe(2);
    });

    it('returns error when file already exists', async () => {
      await writeFile(path.join(TEST_DIR, '.editorconfig'), 'root = true\n');
      const result = await editorconfigService.createDefault(TEST_DIR, 'node');
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('creates python preset with indent_size 4', async () => {
      await editorconfigService.createDefault(TEST_DIR, 'python');
      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.sections[0].properties.indent_size).toBe(4);
    });

    it('creates go preset with tab indent', async () => {
      await editorconfigService.createDefault(TEST_DIR, 'go');
      const config = await editorconfigService.readConfig(TEST_DIR);
      expect(config.sections[0].properties.indent_style).toBe('tab');
      expect(config.sections[0].properties.tab_width).toBe(4);
    });
  });

  // ── deleteConfig ──

  describe('deleteConfig', () => {
    it('deletes existing .editorconfig', async () => {
      await writeFile(path.join(TEST_DIR, '.editorconfig'), 'root = true\n');
      const result = await editorconfigService.deleteConfig(TEST_DIR);
      expect(result.success).toBe(true);

      const exists = await fs
        .access(path.join(TEST_DIR, '.editorconfig'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('returns error when file does not exist', async () => {
      const result = await editorconfigService.deleteConfig(TEST_DIR);
      expect(result.success).toBe(false);
    });
  });

  // ── getPresets ──

  describe('getPresets', () => {
    it('returns presets for all 7 ecosystems', () => {
      const ecosystems: Array<'node' | 'python' | 'rust' | 'go' | 'ruby' | 'php' | 'java'> = [
        'node',
        'python',
        'rust',
        'go',
        'ruby',
        'php',
        'java',
      ];

      for (const eco of ecosystems) {
        const sections = editorconfigService.getPresets(eco);
        expect(sections.length).toBeGreaterThanOrEqual(1);
        expect(sections[0].glob).toBe('*');
      }
    });

    it('returns default preset for unknown ecosystem', () => {
      const sections = editorconfigService.getPresets('unknown');
      expect(sections.length).toBeGreaterThanOrEqual(1);
      expect(sections[0].properties.indent_style).toBe('space');
    });

    it('node preset has markdown section with trim_trailing_whitespace=false', () => {
      const sections = editorconfigService.getPresets('node');
      const mdSection = sections.find((s) => s.glob === '*.md');
      expect(mdSection).toBeDefined();
      expect(mdSection!.properties.trim_trailing_whitespace).toBe(false);
    });
  });
});
