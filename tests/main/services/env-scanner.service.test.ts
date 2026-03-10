import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Mock fs/promises
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { envScannerService } from '../../../src/main/services/env-scanner.service';

describe('EnvScannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result when directory has no source files', async () => {
    mockReaddir.mockResolvedValue([]);
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toEqual([]);
    expect(result.filesScanned).toBe(0);
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('detects process.env.VAR_NAME references in Node files', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'index.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('index.ts')) {
        return Promise.resolve('const token = process.env.GITHUB_TOKEN;\n');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('GITHUB_TOKEN');
    expect(result.variables[0].category).toBe('credential');
    expect(result.variables[0].sourceFile).toBe('index.ts');
    expect(result.variables[0].lineNumber).toBe(1);
    expect(result.variables[0].service).toBe('GitHub');
    expect(result.variables[0].sourceFiles).toEqual([{ file: 'index.ts', line: 1 }]);
    expect(result.filesScanned).toBe(1);
  });

  it('detects bracket notation process.env references', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'config.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('config.ts')) {
        return Promise.resolve('const url = process.env["API_URL"];\n');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('API_URL');
    expect(result.variables[0].category).toBe('url');
  });

  it('detects Python os.environ references', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([{ name: 'app.py', isFile: () => true, isDirectory: () => false }]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('app.py')) {
        return Promise.resolve(
          'db_url = os.environ["DATABASE_URL"]\nport = os.getenv("APP_PORT")\n'
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'python');
    expect(result.variables).toHaveLength(2);
    expect(result.variables.find((v) => v.name === 'DATABASE_URL')).toBeDefined();
    expect(result.variables.find((v) => v.name === 'APP_PORT')).toBeDefined();
  });

  it('detects Go os.Getenv references', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([{ name: 'main.go', isFile: () => true, isDirectory: () => false }]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('main.go')) {
        return Promise.resolve('token := os.Getenv("SECRET_KEY")\n');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'go');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('SECRET_KEY');
    expect(result.variables[0].category).toBe('credential');
  });

  it('tracks all source file occurrences (not just first)', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'a.ts', isFile: () => true, isDirectory: () => false },
          { name: 'b.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && (p.endsWith('a.ts') || p.endsWith('b.ts'))) {
        return Promise.resolve('const val = process.env.MY_VAR;\n');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].sourceFile).toBe('a.ts');
    expect(result.variables[0].sourceFiles).toHaveLength(2);
    expect(result.variables[0].sourceFiles[0]).toEqual({ file: 'a.ts', line: 1 });
    expect(result.variables[0].sourceFiles[1]).toEqual({ file: 'b.ts', line: 1 });
    expect(result.filesScanned).toBe(2);
  });

  it('skips node_modules and .git directories', async () => {
    const srcDir = path.join('/test/project', 'src');
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'node_modules', isFile: () => false, isDirectory: () => true },
          { name: '.git', isFile: () => false, isDirectory: () => true },
          { name: 'src', isFile: () => false, isDirectory: () => true },
        ]);
      }
      if (dir === srcDir) {
        return Promise.resolve([{ name: 'app.ts', isFile: () => true, isDirectory: () => false }]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('app.ts')) {
        return Promise.resolve('const x = process.env.TEST_VAR;\n');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.filesScanned).toBe(1);
    expect(result.variables).toHaveLength(1);
  });

  it('categorizes variables by name pattern', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'config.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('config.ts')) {
        return Promise.resolve(
          [
            'process.env.API_TOKEN',
            'process.env.DATABASE_URL',
            'process.env.APP_PORT',
            'process.env.MAX_RETRIES',
            'process.env.APP_NAME',
          ].join('\n')
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables.find((v) => v.name === 'API_TOKEN')?.category).toBe('credential');
    expect(result.variables.find((v) => v.name === 'DATABASE_URL')?.category).toBe('url');
    expect(result.variables.find((v) => v.name === 'APP_PORT')?.category).toBe('network');
    expect(result.variables.find((v) => v.name === 'MAX_RETRIES')?.category).toBe('config');
    expect(result.variables.find((v) => v.name === 'APP_NAME')?.category).toBe('general');
  });

  it('skips non-matching file extensions for ecosystem', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'readme.md', isFile: () => true, isDirectory: () => false },
          { name: 'data.json', isFile: () => true, isDirectory: () => false },
          { name: 'app.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('app.ts')) {
        return Promise.resolve('process.env.MY_VAR');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.filesScanned).toBe(1);
  });

  it('handles readdir errors gracefully', async () => {
    mockReaddir.mockRejectedValue(new Error('Permission denied'));
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toEqual([]);
    expect(result.filesScanned).toBe(0);
  });

  it('handles unreadable files gracefully', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'secret.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockRejectedValue(new Error('EACCES'));

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toEqual([]);
    expect(result.filesScanned).toBe(0);
  });

  it('reports correct line numbers', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([{ name: 'app.ts', isFile: () => true, isDirectory: () => false }]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('app.ts')) {
        return Promise.resolve('const a = 1;\nconst b = 2;\nconst c = process.env.FOUND_VAR;\n');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables[0].lineNumber).toBe(3);
  });

  it('filters platform-injected variables (VERCEL, NODE_ENV, CI, etc.)', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([{ name: 'app.ts', isFile: () => true, isDirectory: () => false }]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('app.ts')) {
        return Promise.resolve(
          [
            'process.env.VERCEL',
            'process.env.VERCEL_ENV',
            'process.env.NODE_ENV',
            'process.env.CI',
            'process.env.VERCEL_GIT_COMMIT_SHA',
            'process.env.MY_APP_SECRET',
          ].join('\n')
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('MY_APP_SECRET');
  });

  it('detects service provider from variable name prefix', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'config.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('config.ts')) {
        return Promise.resolve(
          [
            'process.env.DISCORD_TOKEN',
            'process.env.GITHUB_TOKEN',
            'process.env.STRIPE_SECRET_KEY',
            'process.env.NEXTAUTH_SECRET',
            'process.env.AWS_ACCESS_KEY',
            'process.env.SOME_GENERAL_VAR',
          ].join('\n')
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables.find((v) => v.name === 'DISCORD_TOKEN')?.service).toBe('Discord');
    expect(result.variables.find((v) => v.name === 'GITHUB_TOKEN')?.service).toBe('GitHub');
    expect(result.variables.find((v) => v.name === 'STRIPE_SECRET_KEY')?.service).toBe('Stripe');
    expect(result.variables.find((v) => v.name === 'NEXTAUTH_SECRET')?.service).toBe('NextAuth');
    expect(result.variables.find((v) => v.name === 'AWS_ACCESS_KEY')?.service).toBe('AWS');
    expect(result.variables.find((v) => v.name === 'SOME_GENERAL_VAR')?.service).toBe('General');
  });

  it('uses functional group fallback for non-service variables', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([
          { name: 'config.ts', isFile: () => true, isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('config.ts')) {
        return Promise.resolve(
          [
            'process.env.LOG_LEVEL',
            'process.env.DEBUG',
            'process.env.ADMIN_EMAIL',
            'process.env.BOT_API_URL',
            'process.env.CRONJOB_API_KEY',
            'process.env.DEPLOYMENT_MODE',
            'process.env.APP_NAME',
            'process.env.CACHE_TTL',
            'process.env.WEBHOOK_TIMEOUT',
            'process.env.RANDOM_THING',
          ].join('\n')
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables.find((v) => v.name === 'LOG_LEVEL')?.service).toBe('Logging & Debug');
    expect(result.variables.find((v) => v.name === 'DEBUG')?.service).toBe('Logging & Debug');
    expect(result.variables.find((v) => v.name === 'ADMIN_EMAIL')?.service).toBe('Admin');
    expect(result.variables.find((v) => v.name === 'BOT_API_URL')?.service).toBe('Bot');
    expect(result.variables.find((v) => v.name === 'CRONJOB_API_KEY')?.service).toBe(
      'Scheduled Tasks'
    );
    expect(result.variables.find((v) => v.name === 'DEPLOYMENT_MODE')?.service).toBe('Deployment');
    expect(result.variables.find((v) => v.name === 'APP_NAME')?.service).toBe('Application');
    expect(result.variables.find((v) => v.name === 'CACHE_TTL')?.service).toBe('Cache');
    expect(result.variables.find((v) => v.name === 'WEBHOOK_TIMEOUT')?.service).toBe('Webhooks');
    expect(result.variables.find((v) => v.name === 'RANDOM_THING')?.service).toBe('General');
  });

  it('scans docker-compose.yml for ${VAR} references', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('docker-compose.yml')) {
        return Promise.resolve(
          'services:\n  db:\n    environment:\n      POSTGRES_USER: ${POSTGRES_USER:-admin}\n      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}\n'
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toHaveLength(2);
    expect(result.variables.find((v) => v.name === 'POSTGRES_USER')).toBeDefined();
    expect(result.variables.find((v) => v.name === 'POSTGRES_PASSWORD')).toBeDefined();
    expect(result.variables.find((v) => v.name === 'POSTGRES_USER')?.service).toBe('PostgreSQL');
    expect(result.variables.find((v) => v.name === 'POSTGRES_USER')?.sourceFiles[0].file).toBe(
      'docker-compose.yml'
    );
  });

  it('merges Docker vars with source code vars into single entry', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir === '/test/project') {
        return Promise.resolve([{ name: 'db.ts', isFile: () => true, isDirectory: () => false }]);
      }
      return Promise.resolve([]);
    });

    mockReadFile.mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('db.ts')) {
        return Promise.resolve('const url = process.env.DATABASE_URL;\n');
      }
      if (typeof p === 'string' && p.endsWith('docker-compose.yml')) {
        return Promise.resolve('    url: ${DATABASE_URL}\n');
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await envScannerService.scan('/test/project', 'node');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('DATABASE_URL');
    expect(result.variables[0].sourceFiles).toHaveLength(2);
    expect(result.variables[0].sourceFiles[0].file).toBe('db.ts');
    expect(result.variables[0].sourceFiles[1].file).toBe('docker-compose.yml');
  });
});
