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

    it('should deduplicate known aliases (python3→python, nodejs→node)', () => {
      vi.stubEnv('PATH', testPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const entries = isWindows
        ? ['python3.exe', 'python.exe', 'nodejs.exe', 'node.exe']
        : ['python3', 'python', 'nodejs', 'node'];
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

      // python3 resolves to 'python', nodejs resolves to 'node'
      // Only the first occurrence should be kept
      expect(allEntryNames.filter((n) => n === 'python')).toHaveLength(1);
      expect(allEntryNames.filter((n) => n === 'node')).toHaveLength(1);
      expect(allEntryNames).not.toContain('python3');
      expect(allEntryNames).not.toContain('nodejs');
    });

    it('should classify code-server paths as System to prevent duplicates', () => {
      const codeServerDir = '/usr/local/lib/code-server/lib/node_modules/.bin';
      vi.stubEnv('PATH', `${testDir}${path.delimiter}${codeServerDir}`);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const systemEntries = isWindows ? ['git.exe'] : ['git'];
      const codeServerEntries = isWindows ? ['node.exe'] : ['node'];
      (vi.mocked(fs.readdirSync) as ReturnType<typeof vi.fn>).mockImplementation((dir: string) => {
        if (String(dir) === testDir) return systemEntries;
        if (String(dir) === codeServerDir) return codeServerEntries;
        return [];
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mode: 0o755,
      } as fs.Stats);

      const groups = cliScannerService.scanCLIs();
      // Code-server dir should be classified as System, not Node.js
      const sources = groups.map((g) => g.source);
      expect(sources).not.toContain('Node.js');
      expect(sources).toContain('System');
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

    it('should handle subcommand help with -h flag first', async () => {
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
      // Should use -h for subcommands (first attempt)
      const firstCallArgs = vi.mocked(childProcess.execFile).mock.calls[0][1] as string[];
      expect(firstCallArgs).toContain('-h');
    });

    it('should return fallback result when all help args fail', async () => {
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
          const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
          const error = new Error('Command failed');
          callback(error, '', '');
          return {} as ReturnType<typeof childProcess.execFile>;
        }
      );

      const result = await cliScannerService.getCLIHelp('/usr/bin/unknown');

      // Error message becomes raw fallback
      expect(result.rawOutput).toContain('Command failed');
      expect(result.subcommands).toEqual([]);
      expect(result.flags).toEqual([]);
    });

    it('should parse flags with angle-bracket arguments (e.g. --flag <value>)', async () => {
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
          const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
          callback(
            null,
            'Usage: claude [options] [command] [prompt]\n\nOptions:\n  --model <model>                   Model for the session\n  -p, --print                       Print response and exit\n  --max-budget-usd <amount>         Max dollar amount\n\nCommands:\n  doctor                            Check auto-updater health\n  install [options] [target]        Install native build\n',
            ''
          );
          return {} as ReturnType<typeof childProcess.execFile>;
        }
      );

      const result = await cliScannerService.getCLIHelp('/usr/bin/claude');

      expect(result.flags.length).toBeGreaterThanOrEqual(2);
      expect(result.flags.some((f) => f.flag.includes('--model'))).toBe(true);
      expect(result.subcommands.length).toBeGreaterThanOrEqual(2);
      expect(result.subcommands.some((s) => s.name === 'doctor')).toBe(true);
    });

    it('should return raw output as fallback when no structured data parsed', async () => {
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
          const callback = cb as (err: Error | null, stdout: string, stderr: string) => void;
          callback(null, 'Some tool v1.0 - A useful tool\nRun with arguments to do things.', '');
          return {} as ReturnType<typeof childProcess.execFile>;
        }
      );

      const result = await cliScannerService.getCLIHelp('/usr/bin/sometool');

      // Even with no structured data, should return raw output
      expect(result.rawOutput).toContain('Some tool v1.0');
      expect(result.description).toBeTruthy();
    });

    it('should return fallback result on timeout for all attempts', async () => {
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

      // Timeout error becomes raw fallback
      expect(result.rawOutput).toContain('TIMEOUT');
      expect(result.subcommands).toEqual([]);
      expect(result.flags).toEqual([]);
    });
  });
});
