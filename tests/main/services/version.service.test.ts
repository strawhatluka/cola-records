import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock fs — must match actual import: import * as fs from 'fs'
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { versionService } from '../../../src/main/services/version.service';

describe('VersionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bumpVersion', () => {
    it('should bump patch version', () => {
      expect(versionService.bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    });

    it('should bump minor version and reset patch', () => {
      expect(versionService.bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
    });

    it('should bump major version and reset minor and patch', () => {
      expect(versionService.bumpVersion('1.2.3', 'major')).toBe('2.0.0');
    });

    it('should handle version 0.0.0', () => {
      expect(versionService.bumpVersion('0.0.0', 'patch')).toBe('0.0.1');
      expect(versionService.bumpVersion('0.0.0', 'minor')).toBe('0.1.0');
      expect(versionService.bumpVersion('0.0.0', 'major')).toBe('1.0.0');
    });

    it('should handle single-digit versions', () => {
      expect(versionService.bumpVersion('1.0.0', 'patch')).toBe('1.0.1');
    });
  });

  describe('detectVersions', () => {
    it('should detect package.json version', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('package.json') && !String(filePath).includes('lock');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '2.1.0' }));

      const versions = versionService.detectVersions('/test/repo');

      expect(versions.length).toBeGreaterThanOrEqual(1);
      const pkgVersion = versions.find((v) => v.relativePath === 'package.json');
      expect(pkgVersion).toBeDefined();
      expect(pkgVersion!.currentVersion).toBe('2.1.0');
      expect(pkgVersion!.packageManager).toBe('npm');
    });

    it('should detect Cargo.toml version', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('Cargo.toml');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('[package]\nname = "myapp"\nversion = "0.5.2"\n');

      const versions = versionService.detectVersions('/test/repo');

      const cargoVersion = versions.find((v) => v.relativePath === 'Cargo.toml');
      expect(cargoVersion).toBeDefined();
      expect(cargoVersion!.currentVersion).toBe('0.5.2');
      expect(cargoVersion!.packageManager).toBe('cargo');
    });

    it('should return empty array when no version files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const versions = versionService.detectVersions('/test/repo');

      expect(versions).toEqual([]);
    });
  });

  describe('updateVersion', () => {
    it('should update package.json version', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: 'myapp', version: '1.0.0' }, null, 2)
      );

      const result = versionService.updateVersion('/test/repo', '1.1.0', ['package.json']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'package.json'),
        expect.stringContaining('"1.1.0"')
      );
    });

    it('should update multiple files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (String(filePath).includes('package.json')) {
          return JSON.stringify({ version: '1.0.0' }, null, 2);
        }
        return JSON.stringify({ version: '1.0.0' }, null, 2);
      });

      const result = versionService.updateVersion('/test/repo', '2.0.0', [
        'package.json',
        'package-lock.json',
      ]);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should handle write errors', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = versionService.updateVersion('/test/repo', '1.1.0', ['package.json']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
    });
  });
});
