import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Mock fs/promises
const mockStat = vi.fn();
const mockReaddir = vi.fn();
vi.mock('fs/promises', () => ({
  stat: (...args: unknown[]) => mockStat(...args),
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

import { diskUsageService } from '../../../src/main/services/disk-usage.service';

describe('DiskUsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty entries when no scan directories exist', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));

    const result = await diskUsageService.scan('/test/project');
    expect(result.entries).toEqual([]);
    expect(result.totalBytes).toBe(0);
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('reports existing directories with their sizes', async () => {
    const nodeModulesPath = path.join('/test/project', 'node_modules');

    mockStat.mockImplementation((p: string) => {
      if (p === nodeModulesPath) {
        return Promise.resolve({ isDirectory: () => true, size: 0 });
      }
      // All other scan directories don't exist
      return Promise.reject(new Error('ENOENT'));
    });

    // When readdir is called for node_modules, return one file
    mockReaddir.mockImplementation((p: string) => {
      if (p === nodeModulesPath) {
        return Promise.resolve([{ name: 'package.json', isDirectory: () => false }]);
      }
      return Promise.resolve([]);
    });

    // stat for the file inside node_modules
    const originalStat = mockStat.getMockImplementation()!;
    mockStat.mockImplementation((p: string) => {
      if (p === path.join(nodeModulesPath, 'package.json')) {
        return Promise.resolve({ isDirectory: () => false, size: 1024 });
      }
      return originalStat(p);
    });

    const result = await diskUsageService.scan('/test/project');
    const nodeEntry = result.entries.find((e) => e.name === 'node_modules');
    expect(nodeEntry).toBeDefined();
    expect(nodeEntry!.exists).toBe(true);
    expect(nodeEntry!.sizeBytes).toBe(1024);
    expect(result.totalBytes).toBe(1024);
  });

  it('skips non-directory stat results', async () => {
    const distPath = path.join('/test/project', 'dist');

    mockStat.mockImplementation((p: string) => {
      if (p === distPath) {
        return Promise.resolve({ isDirectory: () => false, size: 500 });
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await diskUsageService.scan('/test/project');
    expect(result.entries.find((e) => e.name === 'dist')).toBeUndefined();
  });

  it('handles readdir errors gracefully', async () => {
    const gitPath = path.join('/test/project', '.git');

    mockStat.mockImplementation((p: string) => {
      if (p === gitPath) {
        return Promise.resolve({ isDirectory: () => true, size: 0 });
      }
      return Promise.reject(new Error('ENOENT'));
    });

    mockReaddir.mockRejectedValue(new Error('Permission denied'));

    const result = await diskUsageService.scan('/test/project');
    const gitEntry = result.entries.find((e) => e.name === '.git');
    expect(gitEntry).toBeDefined();
    expect(gitEntry!.sizeBytes).toBe(0);
  });

  it('reports scan duration in milliseconds', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));

    const result = await diskUsageService.scan('/test/project');
    expect(typeof result.scanDurationMs).toBe('number');
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('calculates total across multiple directories', async () => {
    const distPath = path.join('/test/project', 'dist');
    const buildPath = path.join('/test/project', 'build');

    mockStat.mockImplementation((p: string) => {
      if (p === distPath) return Promise.resolve({ isDirectory: () => true, size: 0 });
      if (p === buildPath) return Promise.resolve({ isDirectory: () => true, size: 0 });
      if (p === path.join(distPath, 'a.js'))
        return Promise.resolve({ isDirectory: () => false, size: 2000 });
      if (p === path.join(buildPath, 'b.js'))
        return Promise.resolve({ isDirectory: () => false, size: 3000 });
      return Promise.reject(new Error('ENOENT'));
    });

    mockReaddir.mockImplementation((p: string) => {
      if (p === distPath) return Promise.resolve([{ name: 'a.js', isDirectory: () => false }]);
      if (p === buildPath) return Promise.resolve([{ name: 'b.js', isDirectory: () => false }]);
      return Promise.resolve([]);
    });

    const result = await diskUsageService.scan('/test/project');
    expect(result.totalBytes).toBe(5000);
    expect(result.entries.length).toBe(2);
  });

  it('recurses into subdirectories', async () => {
    const distPath = path.join('/test/project', 'dist');
    const subDir = path.join(distPath, 'chunks');
    const filePath = path.join(subDir, 'chunk.js');

    mockStat.mockImplementation((p: string) => {
      if (p === distPath) return Promise.resolve({ isDirectory: () => true, size: 0 });
      if (p === filePath) return Promise.resolve({ isDirectory: () => false, size: 4096 });
      return Promise.reject(new Error('ENOENT'));
    });

    mockReaddir.mockImplementation((p: string) => {
      if (p === distPath) return Promise.resolve([{ name: 'chunks', isDirectory: () => true }]);
      if (p === subDir) return Promise.resolve([{ name: 'chunk.js', isDirectory: () => false }]);
      return Promise.resolve([]);
    });

    const result = await diskUsageService.scan('/test/project');
    const distEntry = result.entries.find((e) => e.name === 'dist');
    expect(distEntry).toBeDefined();
    expect(distEntry!.sizeBytes).toBe(4096);
  });

  it('only returns entries that exist', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));

    const result = await diskUsageService.scan('/test/project');
    expect(result.entries.every((e) => e.exists)).toBe(true);
    expect(result.entries.length).toBe(0);
  });
});
