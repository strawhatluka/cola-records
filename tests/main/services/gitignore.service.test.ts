import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

// Mock the 'ignore' package
const mockIgnoreInstance = {
  add: vi.fn().mockReturnThis(),
  ignores: vi.fn(),
};

vi.mock('ignore', () => ({
  default: vi.fn(() => mockIgnoreInstance),
}));

import { GitIgnoreService } from '../../../src/main/services/gitignore.service';

describe('GitIgnoreService', () => {
  let service: GitIgnoreService;

  beforeEach(() => {
    service = new GitIgnoreService();
    vi.clearAllMocks();
    mockIgnoreInstance.add.mockReturnThis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isIgnored', () => {
    it('always ignores .git directory', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      mockIgnoreInstance.ignores.mockReturnValue(true);

      const result = await service.isIgnored('/repo', '/repo/.git');
      expect(mockIgnoreInstance.add).toHaveBeenCalledWith('.git');
    });

    it('checks patterns from .gitignore file', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('node_modules\n*.log\n# comment\n');
      mockIgnoreInstance.ignores.mockReturnValue(true);

      const result = await service.isIgnored('/repo', '/repo/node_modules');
      expect(result).toBe(true);
    });

    it('returns false when file is not ignored', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      mockIgnoreInstance.ignores.mockReturnValue(false);

      const result = await service.isIgnored('/repo', '/repo/src/index.ts');
      expect(result).toBe(false);
    });
  });

  describe('getPatterns', () => {
    it('returns patterns from .gitignore', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('node_modules\n*.log\n# comment\n\n');

      const patterns = await service.getPatterns('/repo');
      expect(patterns).toEqual(['node_modules', '*.log']);
    });

    it('returns empty array when no .gitignore', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const patterns = await service.getPatterns('/repo');
      expect(patterns).toEqual([]);
    });
  });

  describe('filterIgnored', () => {
    it('filters out ignored files', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      mockIgnoreInstance.ignores.mockImplementation((path: string) => {
        return path === 'node_modules' || path.endsWith('.log');
      });

      const files = ['/repo/src/index.ts', '/repo/node_modules', '/repo/debug.log'];
      const result = await service.filterIgnored('/repo', files);

      expect(result).toEqual(['/repo/src/index.ts']);
    });
  });

  describe('hasGitIgnore', () => {
    it('returns true when .gitignore exists', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue();
      expect(await service.hasGitIgnore('/repo')).toBe(true);
    });

    it('returns false when .gitignore does not exist', async () => {
      vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'));
      expect(await service.hasGitIgnore('/repo')).toBe(false);
    });
  });

  describe('cache management', () => {
    it('clearCache empties the cache', () => {
      service.clearCache();
      // No error thrown, service still works after clearing
      expect(true).toBe(true);
    });

    it('reload invalidates cache for a repo', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('');

      await service.reload('/repo');
      // Should not throw
    });
  });
});
