import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { FileSystemService } from '../../../src/main/services/filesystem.service';

describe('FileSystemService', () => {
  let service: FileSystemService;

  beforeEach(() => {
    service = new FileSystemService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('path utilities (synchronous)', () => {
    it('getExtension returns file extension', () => {
      expect(service.getExtension('/path/to/file.ts')).toBe('.ts');
      expect(service.getExtension('/path/to/file.test.tsx')).toBe('.tsx');
      expect(service.getExtension('/path/to/noext')).toBe('');
    });

    it('getBaseName returns filename', () => {
      expect(service.getBaseName('/path/to/file.ts')).toBe('file.ts');
      expect(service.getBaseName('/path/to/file.ts', false)).toBe('file');
    });

    it('getDirName returns directory', () => {
      const result = service.getDirName('/path/to/file.ts');
      expect(result).toBe(path.dirname('/path/to/file.ts'));
    });

    it('joinPaths joins paths correctly', () => {
      const result = service.joinPaths('/root', 'sub', 'file.ts');
      expect(result).toBe(path.join('/root', 'sub', 'file.ts'));
    });

    it('normalizePath normalizes slashes', () => {
      const result = service.normalizePath('/root/./sub/../file.ts');
      expect(result).toBe(path.normalize('/root/./sub/../file.ts'));
    });

    it('resolvePath resolves to absolute', () => {
      const result = service.resolvePath('/root', 'sub');
      expect(result).toBe(path.resolve('/root', 'sub'));
    });
  });

  describe('readDirectory', () => {
    it('reads and sorts directory entries', async () => {
      const mockEntries = [
        { name: 'zebra.ts', isDirectory: () => false },
        { name: 'src', isDirectory: () => true },
        { name: 'alpha.ts', isDirectory: () => false },
      ];

      vi.spyOn(fs.promises, 'readdir').mockResolvedValue(mockEntries as any);
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 100,
        mtime: new Date('2026-01-01'),
      } as any);

      const result = await service.readDirectory('/test');

      // Directories first, then files alphabetically
      expect(result[0].name).toBe('src');
      expect(result[0].type).toBe('directory');
      expect(result[1].name).toBe('alpha.ts');
      expect(result[2].name).toBe('zebra.ts');
    });

    it('throws on unreadable directory', async () => {
      vi.spyOn(fs.promises, 'readdir').mockRejectedValue(new Error('ENOENT'));
      await expect(service.readDirectory('/nonexistent')).rejects.toThrow(
        'Failed to read directory'
      );
    });
  });

  describe('readFile', () => {
    it('reads file content and returns FileContent', async () => {
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('hello world');

      const result = await service.readFile('/test/file.ts');
      expect(result.path).toBe('/test/file.ts');
      expect(result.content).toBe('hello world');
      expect(result.encoding).toBe('utf-8');
    });

    it('throws on read error', async () => {
      vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
      await expect(service.readFile('/nonexistent')).rejects.toThrow('Failed to read file');
    });
  });

  describe('writeFile', () => {
    it('creates parent directory and writes file', async () => {
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue();

      await service.writeFile('/test/dir/file.ts', 'content');
      expect(mkdirSpy).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith('/test/dir/file.ts', 'content', 'utf-8');
    });
  });

  describe('deleteFile', () => {
    it('deletes file', async () => {
      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue();
      await service.deleteFile('/test/file.ts');
      expect(unlinkSpy).toHaveBeenCalledWith('/test/file.ts');
    });

    it('throws on delete error', async () => {
      vi.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('ENOENT'));
      await expect(service.deleteFile('/nonexistent')).rejects.toThrow('Failed to delete file');
    });
  });

  describe('exists', () => {
    it('returns true for existing paths', async () => {
      vi.spyOn(fs.promises, 'access').mockResolvedValue();
      expect(await service.exists('/test')).toBe(true);
    });

    it('returns false for missing paths', async () => {
      vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'));
      expect(await service.exists('/nonexistent')).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('returns true for directories', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ isDirectory: () => true } as any);
      expect(await service.isDirectory('/test')).toBe(true);
    });

    it('returns false for files', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ isDirectory: () => false } as any);
      expect(await service.isDirectory('/test/file.ts')).toBe(false);
    });

    it('returns false for nonexistent paths', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'));
      expect(await service.isDirectory('/nonexistent')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns stats', async () => {
      const mockStats = { size: 42, mtime: new Date() };
      vi.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);

      const stats = await service.getStats('/test/file.ts');
      expect(stats.size).toBe(42);
    });

    it('throws on error', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'));
      await expect(service.getStats('/nonexistent')).rejects.toThrow('Failed to get stats');
    });
  });

  describe('createDirectory', () => {
    it('creates directory recursively', async () => {
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
      await service.createDirectory('/test/deep/dir');
      expect(mkdirSpy).toHaveBeenCalledWith('/test/deep/dir', { recursive: true });
    });
  });

  describe('copyFile', () => {
    it('ensures destination dir exists and copies', async () => {
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
      const copySpy = vi.spyOn(fs.promises, 'copyFile').mockResolvedValue();

      await service.copyFile('/src/file.ts', '/dest/file.ts');
      expect(mkdirSpy).toHaveBeenCalled();
      expect(copySpy).toHaveBeenCalledWith('/src/file.ts', '/dest/file.ts');
    });
  });

  describe('moveFile', () => {
    it('ensures destination dir exists and renames', async () => {
      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any);
      const renameSpy = vi.spyOn(fs.promises, 'rename').mockResolvedValue();

      await service.moveFile('/src/file.ts', '/dest/file.ts');
      expect(renameSpy).toHaveBeenCalledWith('/src/file.ts', '/dest/file.ts');
    });
  });
});
