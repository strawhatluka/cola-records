// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    create: () => ({
      scope: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }),
  },
}));

// Mock child_process — preserve default export to avoid "No default export" error
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

// Mock fs
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { cliScannerService } from '../../../src/main/services/cli-scanner.service';

const isWindows = process.platform === 'win32';
const testDir = isWindows ? 'C:\\Windows\\System32' : '/usr/bin';
const testPath = isWindows
  ? `C:\\Windows\\System32;C:\\Program Files\\nodejs`
  : '/usr/bin:/usr/local/bin';

describe('CLIScannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PATH', testPath);
  });

  describe('scanCLIs', () => {
    it('should scan PATH directories for executables', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const entries = isWindows ? ['git.exe', 'node.exe', 'cmd.exe'] : ['git', 'node', 'ls'];
      (vi.mocked(fs.readdirSync) as ReturnType<typeof vi.fn>).mockImplementation((dir: string) => {
        if (String(dir) === testDir) {
          return entries;
        }
        return [];
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as fs.Stats);

      const groups = cliScannerService.scanCLIs();

      expect(groups.length).toBeGreaterThanOrEqual(1);
      // Find any group that has entries
      const hasEntries = groups.some((g) => g.entries.length > 0);
      expect(hasEntries).toBe(true);
    });

    it('should return empty array when PATH is empty', () => {
      vi.stubEnv('PATH', '');
      const groups = cliScannerService.scanCLIs();
      expect(groups).toEqual([]);
    });

    it('should handle directory read errors', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const groups = cliScannerService.scanCLIs();
      expect(groups).toEqual([]);
    });

    it('should filter by ecosystem when provided', () => {
      // System dir: /usr/bin (Linux) or C:\Windows\System32 (Windows) → classifies as 'System'
      // Other dir: classifies as 'Other' → core-tool filtered
      // Python dir: classifies as 'Python' → excluded for 'node' ecosystem
      const otherDir = isWindows ? 'C:\\CustomTools' : '/opt/other';
      const pythonDir = isWindows ? 'C:\\Python310\\Scripts' : '/opt/python/bin';
      const filterPath = [testDir, otherDir, pythonDir].join(path.delimiter);
      vi.stubEnv('PATH', filterPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const gitEntry = isWindows ? 'git.exe' : 'git';
      const nodeEntry = isWindows ? 'node.exe' : 'node';
      const obscureEntry = isWindows ? 'obscure-tool.exe' : 'obscure-tool';
      const pipEntry = isWindows ? 'pip.exe' : 'pip';
      const flaskEntry = isWindows ? 'flask.exe' : 'flask';
      (vi.mocked(fs.readdirSync) as ReturnType<typeof vi.fn>).mockImplementation((dir: string) => {
        const d = String(dir);
        if (d === testDir) return [gitEntry, nodeEntry];
        if (d === otherDir) return [obscureEntry];
        if (d === pythonDir) return [pipEntry, flaskEntry];
        return [];
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as fs.Stats);

      const groups = cliScannerService.scanCLIs('node');
      const allEntryNames = groups.flatMap((g) => g.entries.map((e) => e.name));

      // System tools in relevant ecosystem groups should be included
      expect(allEntryNames).toContain('git');
      expect(allEntryNames).toContain('node');
      // Non-core tool from 'Other' group should be excluded
      expect(allEntryNames).not.toContain('obscure-tool');
      // Python-specific tools should be excluded for 'node' ecosystem
      expect(allEntryNames).not.toContain('pip');
      expect(allEntryNames).not.toContain('flask');
    });

    it('should include all tools when no ecosystem is provided', () => {
      vi.stubEnv('PATH', testPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const entries = isWindows ? ['git.exe', 'obscure-tool.exe'] : ['git', 'obscure-tool'];
      (vi.mocked(fs.readdirSync) as ReturnType<typeof vi.fn>).mockImplementation((dir: string) => {
        if (String(dir) === testDir) return entries;
        return [];
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as fs.Stats);

      const groups = cliScannerService.scanCLIs();
      const allEntryNames = groups.flatMap((g) => g.entries.map((e) => e.name));

      expect(allEntryNames).toContain('git');
      expect(allEntryNames).toContain('obscure-tool');
    });
  });

  describe('getCLIHelp', () => {
    it('should parse help output into structured result', async () => {
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
          const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
          callback(
            null,
            'usage: git [--version] [--help]\n\nThese are common Git commands:\n\n   clone      Clone a repository\n   init       Create an empty Git repository\n',
            ''
          );
          return {} as ReturnType<typeof childProcess.execFile>;
        }
      );

      const result = await cliScannerService.getCLIHelp('/usr/bin/git');

      expect(result.rawOutput).toContain('git');
      expect(result.usage).toBeDefined();
    });

    it('should handle subcommand help', async () => {
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
          const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
          callback(
            null,
            'usage: git clone [<options>] <repository>\n\n    -v, --verbose         be more verbose\n    -q, --quiet           be more quiet\n',
            ''
          );
          return {} as ReturnType<typeof childProcess.execFile>;
        }
      );

      const result = await cliScannerService.getCLIHelp('/usr/bin/git', 'clone');

      expect(result.rawOutput).toContain('clone');
    });

    it('should handle command that fails --help', async () => {
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
          const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
          const error = new Error('Command failed');
          callback(error, '', '');
          return {} as ReturnType<typeof childProcess.execFile>;
        }
      );

      const result = await cliScannerService.getCLIHelp('/usr/bin/unknown');

      // rawOutput falls back to error.message when stdout/stderr are empty
      expect(result.rawOutput).toContain('Command failed');
      expect(result.description).toBeDefined();
    });

    it('should handle timeout', async () => {
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
          const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
          const err = new Error('TIMEOUT') as NodeJS.ErrnoException;
          err.code = 'ETIMEDOUT';
          callback(err, '', '');
          return {} as ReturnType<typeof childProcess.execFile>;
        }
      );

      const result = await cliScannerService.getCLIHelp('/usr/bin/slow-cmd');

      // rawOutput falls back to error.message when stdout/stderr are empty
      expect(result.rawOutput).toContain('TIMEOUT');
    });
  });
});
