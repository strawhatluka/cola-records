// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

vi.mock('fs/promises');

import {
  PackageConfigService,
  packageConfigService,
} from '../../../src/main/services/package-config.service';

const WORK_DIR = '/test/project';

describe('PackageConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfigFileName', () => {
    it('returns package.json for node', () => {
      expect(packageConfigService.getConfigFileName('node')).toBe('package.json');
    });

    it('returns composer.json for php', () => {
      expect(packageConfigService.getConfigFileName('php')).toBe('composer.json');
    });

    it('returns pyproject.toml for python', () => {
      expect(packageConfigService.getConfigFileName('python')).toBe('pyproject.toml');
    });

    it('returns Cargo.toml for rust', () => {
      expect(packageConfigService.getConfigFileName('rust')).toBe('Cargo.toml');
    });

    it('returns go.mod for go', () => {
      expect(packageConfigService.getConfigFileName('go')).toBe('go.mod');
    });

    it('returns Gemfile for ruby', () => {
      expect(packageConfigService.getConfigFileName('ruby')).toBe('Gemfile');
    });

    it('returns pom.xml for java', () => {
      expect(packageConfigService.getConfigFileName('java')).toBe('pom.xml');
    });

    it('returns package.json for unknown', () => {
      expect(packageConfigService.getConfigFileName('unknown')).toBe('package.json');
    });
  });

  describe('read', () => {
    it('reads and parses JSON for node ecosystem with 2-space indent', async () => {
      const jsonContent = '{\n  "name": "test-pkg",\n  "version": "1.0.0"\n}';
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const result = await packageConfigService.read(WORK_DIR, 'node');

      expect(fs.readFile).toHaveBeenCalledWith(path.join(WORK_DIR, 'package.json'), 'utf-8');
      expect(result).not.toBeNull();
      expect(result!.ecosystem).toBe('node');
      expect(result!.fileName).toBe('package.json');
      expect(result!.structured).toEqual({ name: 'test-pkg', version: '1.0.0' });
      expect(result!.raw).toBe(jsonContent);
      expect(result!.indent).toBe(2);
    });

    it('reads and parses JSON for php ecosystem', async () => {
      const jsonContent = '{\n  "name": "vendor/pkg"\n}';
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const result = await packageConfigService.read(WORK_DIR, 'php');

      expect(fs.readFile).toHaveBeenCalledWith(path.join(WORK_DIR, 'composer.json'), 'utf-8');
      expect(result!.structured).toEqual({ name: 'vendor/pkg' });
    });

    it('detects 4-space indent', async () => {
      const jsonContent = '{\n    "name": "test"\n}';
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const result = await packageConfigService.read(WORK_DIR, 'node');
      expect(result!.indent).toBe(4);
    });

    it('detects tab indent', async () => {
      const jsonContent = '{\n\t"name": "test"\n}';
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const result = await packageConfigService.read(WORK_DIR, 'node');
      expect(result!.indent).toBe('\t');
    });

    it('defaults to indent 2 when no indentation found', async () => {
      const jsonContent = '{"name":"test"}';
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const result = await packageConfigService.read(WORK_DIR, 'node');
      expect(result!.indent).toBe(2);
    });

    it('reads raw text for python (no parsing)', async () => {
      const tomlContent = '[tool.poetry]\nname = "my-project"\nversion = "0.1.0"';
      vi.mocked(fs.readFile).mockResolvedValue(tomlContent);

      const result = await packageConfigService.read(WORK_DIR, 'python');

      expect(fs.readFile).toHaveBeenCalledWith(path.join(WORK_DIR, 'pyproject.toml'), 'utf-8');
      expect(result!.ecosystem).toBe('python');
      expect(result!.structured).toBeNull();
      expect(result!.raw).toBe(tomlContent);
    });

    it('reads raw text for rust', async () => {
      const tomlContent = '[package]\nname = "my-crate"';
      vi.mocked(fs.readFile).mockResolvedValue(tomlContent);

      const result = await packageConfigService.read(WORK_DIR, 'rust');

      expect(result!.fileName).toBe('Cargo.toml');
      expect(result!.structured).toBeNull();
      expect(result!.raw).toBe(tomlContent);
    });

    it('reads raw text for go', async () => {
      const goModContent = 'module example.com/my-module\n\ngo 1.21';
      vi.mocked(fs.readFile).mockResolvedValue(goModContent);

      const result = await packageConfigService.read(WORK_DIR, 'go');

      expect(result!.fileName).toBe('go.mod');
      expect(result!.structured).toBeNull();
      expect(result!.raw).toBe(goModContent);
    });

    it('returns null when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await packageConfigService.read(WORK_DIR, 'node');
      expect(result).toBeNull();
    });

    it('falls back to raw-only when JSON is malformed', async () => {
      const badJson = '{ name: "unquoted" }';
      vi.mocked(fs.readFile).mockResolvedValue(badJson);

      const result = await packageConfigService.read(WORK_DIR, 'node');

      expect(result!.structured).toBeNull();
      expect(result!.raw).toBe(badJson);
    });
  });

  describe('write', () => {
    it('writes JSON with preserved indent for node ecosystem', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      const data = {
        ecosystem: 'node' as const,
        fileName: 'package.json',
        structured: { name: 'test-pkg', version: '1.0.0' },
        raw: '',
        indent: 2 as string | number,
      };

      const result = await packageConfigService.write(WORK_DIR, 'node', data);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(WORK_DIR, 'package.json'),
        JSON.stringify(data.structured, null, 2) + '\n',
        'utf-8'
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('package.json saved');
    });

    it('writes JSON with 4-space indent when indent is 4', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      const data = {
        ecosystem: 'node' as const,
        fileName: 'package.json',
        structured: { name: 'test' },
        raw: '',
        indent: 4 as string | number,
      };

      await packageConfigService.write(WORK_DIR, 'node', data);

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toBe(JSON.stringify(data.structured, null, 4) + '\n');
    });

    it('writes JSON with tab indent', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      const data = {
        ecosystem: 'php' as const,
        fileName: 'composer.json',
        structured: { name: 'vendor/pkg' },
        raw: '',
        indent: '\t' as string | number,
      };

      await packageConfigService.write(WORK_DIR, 'php', data);

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toBe(JSON.stringify(data.structured, null, '\t') + '\n');
    });

    it('writes raw text for non-JSON ecosystems', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      const data = {
        ecosystem: 'python' as const,
        fileName: 'pyproject.toml',
        structured: null,
        raw: '[tool.poetry]\nname = "my-project"',
        indent: 2 as string | number,
      };

      const result = await packageConfigService.write(WORK_DIR, 'python', data);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(WORK_DIR, 'pyproject.toml'),
        data.raw,
        'utf-8'
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('pyproject.toml saved');
    });

    it('writes raw text when structured is null even for node', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();

      const data = {
        ecosystem: 'node' as const,
        fileName: 'package.json',
        structured: null,
        raw: '{"name":"raw"}',
        indent: 2 as string | number,
      };

      await packageConfigService.write(WORK_DIR, 'node', data);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(WORK_DIR, 'package.json'),
        data.raw,
        'utf-8'
      );
    });

    it('returns failure when write errors', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const data = {
        ecosystem: 'node' as const,
        fileName: 'package.json',
        structured: { name: 'test' },
        raw: '',
        indent: 2 as string | number,
      };

      const result = await packageConfigService.write(WORK_DIR, 'node', data);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Permission denied');
    });

    it('returns generic failure for non-Error throw', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue('something');

      const data = {
        ecosystem: 'node' as const,
        fileName: 'package.json',
        structured: { name: 'test' },
        raw: '',
        indent: 2 as string | number,
      };

      const result = await packageConfigService.write(WORK_DIR, 'node', data);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Write failed');
    });
  });

  it('exports a singleton instance', () => {
    expect(packageConfigService).toBeInstanceOf(PackageConfigService);
  });
});
