import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Mock fs/promises
const mockAccess = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockCopyFile = vi.fn();
const mockReaddir = vi.fn();
vi.mock('fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  copyFile: (...args: unknown[]) => mockCopyFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock env-scanner service
const mockScan = vi.fn();
vi.mock('../../../src/main/services/env-scanner.service', () => ({
  envScannerService: {
    scan: (...args: unknown[]) => mockScan(...args),
  },
}));

import { envFileService } from '../../../src/main/services/env-file.service';

describe('EnvFileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
  });

  describe('discoverEnvFiles', () => {
    it('finds .env files in root directory', async () => {
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === '/test/project') {
          return Promise.resolve([
            { name: '.env', isFile: () => true, isDirectory: () => false },
            { name: '.env.example', isFile: () => true, isDirectory: () => false },
            { name: 'package.json', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      mockReadFile.mockResolvedValue('KEY=value\n');

      const files = await envFileService.discoverEnvFiles('/test/project');
      expect(files).toHaveLength(2);
      expect(files.find((f) => f.name === '.env')).toBeDefined();
      expect(files.find((f) => f.name === '.env.example')).toBeDefined();
    });

    it('marks .env.example files as isExample', async () => {
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === '/test/project') {
          return Promise.resolve([
            { name: '.env.example', isFile: () => true, isDirectory: () => false },
            { name: '.env.local', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      mockReadFile.mockResolvedValue('');

      const files = await envFileService.discoverEnvFiles('/test/project');
      expect(files.find((f) => f.name === '.env.example')?.isExample).toBe(true);
      expect(files.find((f) => f.name === '.env.local')?.isExample).toBe(false);
    });

    it('discovers nested .env files', async () => {
      const pkgsDir = path.join('/test/project', 'packages');
      const apiDir = path.join(pkgsDir, 'api');
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === '/test/project') {
          return Promise.resolve([
            { name: 'packages', isFile: () => false, isDirectory: () => true },
            { name: '.env', isFile: () => true, isDirectory: () => false },
          ]);
        }
        if (dir === pkgsDir) {
          return Promise.resolve([{ name: 'api', isFile: () => false, isDirectory: () => true }]);
        }
        if (dir === apiDir) {
          return Promise.resolve([{ name: '.env', isFile: () => true, isDirectory: () => false }]);
        }
        return Promise.resolve([]);
      });

      mockReadFile.mockResolvedValue('KEY=value\n');

      const files = await envFileService.discoverEnvFiles('/test/project');
      expect(files).toHaveLength(2);
    });

    it('skips node_modules and .git directories', async () => {
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === '/test/project') {
          return Promise.resolve([
            { name: 'node_modules', isFile: () => false, isDirectory: () => true },
            { name: '.git', isFile: () => false, isDirectory: () => true },
            { name: '.env', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      mockReadFile.mockResolvedValue('KEY=value\n');

      const files = await envFileService.discoverEnvFiles('/test/project');
      expect(files).toHaveLength(1);
    });
  });

  describe('createEnvExample', () => {
    it('groups variables by service provider in output', async () => {
      mockScan.mockResolvedValue({
        variables: [
          {
            name: 'DISCORD_TOKEN',
            category: 'credential',
            service: 'Discord',
            comment: 'Sensitive credential — keep secret',
            sourceFile: 'bot.ts',
            lineNumber: 5,
            sourceFiles: [{ file: 'bot.ts', line: 5 }],
          },
          {
            name: 'DATABASE_URL',
            category: 'url',
            service: 'Database',
            comment: 'URL or endpoint address',
            sourceFile: 'db.ts',
            lineNumber: 3,
            sourceFiles: [
              { file: 'db.ts', line: 3 },
              { file: 'config.ts', line: 10 },
            ],
          },
        ],
        filesScanned: 10,
        scanDurationMs: 50,
      });

      const result = await envFileService.createEnvExample('/test/project', 'node');
      expect(result.success).toBe(true);
      expect(result.message).toContain('2 variables');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      const content = mockWriteFile.mock.calls[0][1] as string;
      expect(content).toContain('DISCORD_TOKEN=');
      expect(content).toContain('DATABASE_URL=');
      expect(content).toContain('# Database');
      expect(content).toContain('# Discord');
    });

    it('shows all source file locations in comments', async () => {
      mockScan.mockResolvedValue({
        variables: [
          {
            name: 'API_KEY',
            category: 'credential',
            service: 'General',
            comment: 'Sensitive credential — keep secret',
            sourceFile: 'auth.ts',
            lineNumber: 10,
            sourceFiles: [
              { file: 'auth.ts', line: 10 },
              { file: 'middleware.ts', line: 42 },
            ],
          },
        ],
        filesScanned: 5,
        scanDurationMs: 20,
      });

      const result = await envFileService.createEnvExample('/test/project', 'node');
      expect(result.success).toBe(true);

      const content = mockWriteFile.mock.calls[0][1] as string;
      expect(content).toContain('auth.ts:10, middleware.ts:42');
    });

    it('creates minimal file when no variables found', async () => {
      mockScan.mockResolvedValue({
        variables: [],
        filesScanned: 5,
        scanDurationMs: 20,
      });

      const result = await envFileService.createEnvExample('/test/project', 'node');
      expect(result.success).toBe(true);
      expect(result.message).toContain('no variables detected');
    });

    it('handles write errors', async () => {
      mockScan.mockResolvedValue({
        variables: [
          {
            name: 'VAR',
            category: 'general',
            service: 'General',
            comment: 'test',
            sourceFile: 'a.ts',
            lineNumber: 1,
            sourceFiles: [{ file: 'a.ts', line: 1 }],
          },
        ],
        filesScanned: 1,
        scanDurationMs: 10,
      });
      mockWriteFile.mockRejectedValue(new Error('Permission denied'));

      const result = await envFileService.createEnvExample('/test/project', 'node');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed');
    });
  });

  describe('createEnvFile', () => {
    it('copies from .env.example when it exists', async () => {
      mockAccess.mockImplementation((p: string) => {
        if (p.endsWith('.env')) return Promise.reject(new Error('ENOENT'));
        if (p.endsWith('.env.example')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await envFileService.createEnvFile('/test/project', '.env');
      expect(result.success).toBe(true);
      expect(result.message).toContain('from .env.example');
      expect(mockCopyFile).toHaveBeenCalledTimes(1);
    });

    it('creates empty file when no .env.example exists', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await envFileService.createEnvFile('/test/project', '.env');
      expect(result.success).toBe(true);
      expect(result.message).toContain('empty');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('syncs existing file from .env.example when target already exists', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('.env.example')) {
          return Promise.resolve('# Header\nKEY_A=\nKEY_B=\n');
        }
        // Existing .env has KEY_A set but is missing KEY_B
        return Promise.resolve('KEY_A=secret\n');
      });

      const result = await envFileService.createEnvFile('/test/project', '.env');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Synced');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = mockWriteFile.mock.calls[0][1] as string;
      expect(written).toContain('# Header');
      expect(written).toContain('KEY_A=secret');
      expect(written).toContain('KEY_B=');
    });

    it('reports in sync when existing file already matches template', async () => {
      mockAccess.mockResolvedValue(undefined);
      const content = '# Header\nKEY=val\n';
      mockReadFile.mockResolvedValue(content);

      const result = await envFileService.createEnvFile('/test/project', '.env');
      expect(result.success).toBe(true);
      expect(result.message).toContain('already in sync');
    });

    it('reports no .env.example when target exists but example is missing', async () => {
      mockAccess.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('.env.example'))
          return Promise.reject(new Error('ENOENT'));
        return Promise.resolve();
      });

      const result = await envFileService.createEnvFile('/test/project', '.env');
      expect(result.success).toBe(true);
      expect(result.message).toContain('no .env.example to sync from');
    });

    it('creates custom-named env files', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await envFileService.createEnvFile('/test/project', '.env.staging');
      expect(result.success).toBe(true);
      expect(result.message).toContain('.env.staging');
    });
  });

  describe('readEnvFile', () => {
    it('reads file content as string', async () => {
      mockReadFile.mockResolvedValue('KEY=value\nSECRET=123\n');

      const content = await envFileService.readEnvFile('/test/.env');
      expect(content).toBe('KEY=value\nSECRET=123\n');
    });
  });

  describe('writeEnvFile', () => {
    it('writes content to file', async () => {
      const result = await envFileService.writeEnvFile('/test/.env', 'NEW_KEY=new_value\n');
      expect(result.success).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith('/test/.env', 'NEW_KEY=new_value\n', 'utf-8');
    });

    it('handles write errors', async () => {
      mockWriteFile.mockRejectedValue(new Error('EACCES'));

      const result = await envFileService.writeEnvFile('/test/.env', 'content');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save');
    });
  });

  describe('syncEnvFiles', () => {
    it('creates .env.example when it does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      mockScan.mockResolvedValue({
        variables: [
          {
            name: 'APP_KEY',
            category: 'credential',
            service: 'General',
            comment: 'Secret',
            sourceFile: 'a.ts',
            lineNumber: 1,
            sourceFiles: [{ file: 'a.ts', line: 1 }],
          },
        ],
        filesScanned: 1,
        scanDurationMs: 10,
      });
      mockReadFile.mockResolvedValue('# Environment Variables\n\nAPP_KEY=\n');
      mockReaddir.mockResolvedValue([
        { name: '.env.example', isFile: () => true, isDirectory: () => false },
      ]);

      const result = await envFileService.syncEnvFiles('/test/project', 'node');
      expect(result.newVariablesFound).toBe(1);
    });

    it('appends new variables to existing .env.example', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockScan.mockResolvedValue({
        variables: [
          {
            name: 'EXISTING_KEY',
            category: 'general',
            service: 'General',
            comment: 'test',
            sourceFile: 'a.ts',
            lineNumber: 1,
            sourceFiles: [{ file: 'a.ts', line: 1 }],
          },
          {
            name: 'NEW_KEY',
            category: 'general',
            service: 'General',
            comment: 'test',
            sourceFile: 'b.ts',
            lineNumber: 2,
            sourceFiles: [{ file: 'b.ts', line: 2 }],
          },
        ],
        filesScanned: 2,
        scanDurationMs: 15,
      });

      // Existing .env.example has only EXISTING_KEY
      mockReadFile.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('.env.example')) {
          return Promise.resolve('EXISTING_KEY=val\n');
        }
        return Promise.resolve('');
      });
      mockReaddir.mockResolvedValue([
        { name: '.env.example', isFile: () => true, isDirectory: () => false },
      ]);

      const result = await envFileService.syncEnvFiles('/test/project', 'node');
      expect(result.newVariablesFound).toBe(1);
      expect(result.filesUpdated).toContain('.env.example');
    });

    it('rebuilds sibling files using .env.example as structural template', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockScan.mockResolvedValue({
        variables: [],
        filesScanned: 0,
        scanDurationMs: 5,
      });

      const exampleContent = [
        '# Environment Variables',
        '',
        '# ====================',
        '# Database',
        '# ====================',
        '',
        '# URL or endpoint address',
        'DATABASE_URL=',
        '',
        '# ====================',
        '# Auth',
        '# ====================',
        '',
        '# Sensitive credential',
        'AUTH_SECRET=',
        '',
      ].join('\n');

      // Sibling .env has DATABASE_URL set but is missing AUTH_SECRET and has no comments
      const siblingContent = 'DATABASE_URL=postgres://localhost:5432/mydb\n';

      mockReadFile.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('.env.example')) {
          return Promise.resolve(exampleContent);
        }
        return Promise.resolve(siblingContent);
      });

      mockReaddir.mockResolvedValue([
        { name: '.env.example', isFile: () => true, isDirectory: () => false },
        { name: '.env', isFile: () => true, isDirectory: () => false },
      ]);

      const result = await envFileService.syncEnvFiles('/test/project', 'node');
      expect(result.filesUpdated).toContain('.env');

      // Verify the rebuilt content preserves value and mirrors structure
      const writtenContent = mockWriteFile.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          (call[0] as string).endsWith('.env') &&
          !(call[0] as string).endsWith('.env.example')
      );
      expect(writtenContent).toBeDefined();
      const rebuilt = writtenContent![1] as string;
      expect(rebuilt).toContain('# ====================');
      expect(rebuilt).toContain('# Database');
      expect(rebuilt).toContain('# Auth');
      expect(rebuilt).toContain('DATABASE_URL=postgres://localhost:5432/mydb');
      expect(rebuilt).toContain('AUTH_SECRET=');
    });

    it('preserves existing values while matching template order', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockScan.mockResolvedValue({
        variables: [],
        filesScanned: 0,
        scanDurationMs: 5,
      });

      // Template has KEY_B before KEY_A
      const exampleContent = '# Header\nKEY_B=\nKEY_A=\n';
      // Sibling has KEY_A before KEY_B with values
      const siblingContent = 'KEY_A=alpha\nKEY_B=bravo\n';

      mockReadFile.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('.env.example')) {
          return Promise.resolve(exampleContent);
        }
        return Promise.resolve(siblingContent);
      });

      mockReaddir.mockResolvedValue([
        { name: '.env.example', isFile: () => true, isDirectory: () => false },
        { name: '.env', isFile: () => true, isDirectory: () => false },
      ]);

      const result = await envFileService.syncEnvFiles('/test/project', 'node');
      expect(result.filesUpdated).toContain('.env');

      const writtenContent = mockWriteFile.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          (call[0] as string).endsWith('.env') &&
          !(call[0] as string).endsWith('.env.example')
      );
      const rebuilt = writtenContent![1] as string;
      // Order should match template: KEY_B before KEY_A
      const keyBIndex = rebuilt.indexOf('KEY_B=bravo');
      const keyAIndex = rebuilt.indexOf('KEY_A=alpha');
      expect(keyBIndex).toBeLessThan(keyAIndex);
    });

    it('returns all-in-sync message when nothing to do', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockScan.mockResolvedValue({
        variables: [],
        filesScanned: 0,
        scanDurationMs: 5,
      });

      // Identical content means no rebuild needed
      mockReadFile.mockResolvedValue('KEY=val\n');
      mockReaddir.mockResolvedValue([
        { name: '.env.example', isFile: () => true, isDirectory: () => false },
        { name: '.env', isFile: () => true, isDirectory: () => false },
      ]);

      const result = await envFileService.syncEnvFiles('/test/project', 'node');
      expect(result.message).toContain('in sync');
    });
  });
});
