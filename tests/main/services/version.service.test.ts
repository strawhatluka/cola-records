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
    vi.resetAllMocks();
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

    it('should detect pyproject.toml version', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('pyproject.toml');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('[project]\nversion = "1.2.3"');

      const versions = versionService.detectVersions('/test/repo');

      const pyVersion = versions.find((v) => v.relativePath === 'pyproject.toml');
      expect(pyVersion).toBeDefined();
      expect(pyVersion!.currentVersion).toBe('1.2.3');
      expect(pyVersion!.packageManager).toBe('pip');
    });

    it('should detect setup.py version', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('setup.py');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('setup(name="app", version=\'2.0.0\')');

      const versions = versionService.detectVersions('/test/repo');

      const setupVersion = versions.find((v) => v.relativePath === 'setup.py');
      expect(setupVersion).toBeDefined();
      expect(setupVersion!.currentVersion).toBe('2.0.0');
      expect(setupVersion!.packageManager).toBe('pip');
    });

    it('should detect build.gradle version', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('build.gradle');
      });
      vi.mocked(fs.readFileSync).mockReturnValue("version = '3.1.0'");

      const versions = versionService.detectVersions('/test/repo');

      const gradleVersion = versions.find((v) => v.relativePath === 'build.gradle');
      expect(gradleVersion).toBeDefined();
      expect(gradleVersion!.currentVersion).toBe('3.1.0');
      expect(gradleVersion!.packageManager).toBe('gradle');
    });

    it('should detect pom.xml version', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('pom.xml');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('<project><version>4.0.0</version></project>');

      const versions = versionService.detectVersions('/test/repo');

      const pomVersion = versions.find((v) => v.relativePath === 'pom.xml');
      expect(pomVersion).toBeDefined();
      expect(pomVersion!.currentVersion).toBe('4.0.0');
      expect(pomVersion!.packageManager).toBe('maven');
    });

    it('should return null for invalid package.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('package.json') && !String(filePath).includes('lock');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('{not valid json');

      const versions = versionService.detectVersions('/test/repo');

      const pkgVersion = versions.find((v) => v.relativePath === 'package.json');
      expect(pkgVersion).toBeUndefined();
    });

    it('should return null for pyproject.toml without version', () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return String(filePath).endsWith('pyproject.toml');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('[project]\nname = "app"');

      const versions = versionService.detectVersions('/test/repo');

      const pyVersion = versions.find((v) => v.relativePath === 'pyproject.toml');
      expect(pyVersion).toBeUndefined();
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

    it('should update Cargo.toml version', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('[package]\nname = "myapp"\nversion = "0.5.2"\n');

      const result = versionService.updateVersion('/test/repo', '1.0.0', ['Cargo.toml']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'Cargo.toml'),
        expect.stringContaining('"1.0.0"')
      );
    });

    it('should update pyproject.toml version', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('[project]\nversion = "1.0.0"\n');

      const result = versionService.updateVersion('/test/repo', '2.0.0', ['pyproject.toml']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'pyproject.toml'),
        expect.stringContaining('"2.0.0"')
      );
    });

    it('should update setup.py version', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('setup(name="app", version=\'1.0.0\')');

      const result = versionService.updateVersion('/test/repo', '2.0.0', ['setup.py']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'setup.py'),
        expect.stringContaining("'2.0.0'")
      );
    });

    it('should update build.gradle version', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("version = '1.0.0'");

      const result = versionService.updateVersion('/test/repo', '2.0.0', ['build.gradle']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'build.gradle'),
        expect.stringContaining("'2.0.0'")
      );
    });

    it('should update pom.xml version', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('<project><version>1.0.0</version></project>');

      const result = versionService.updateVersion('/test/repo', '2.0.0', ['pom.xml']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'pom.xml'),
        expect.stringContaining('2.0.0')
      );
    });

    it('should return unchanged content for unknown file type', () => {
      const originalContent = 'some random content version 1.0.0';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(originalContent);

      const result = versionService.updateVersion('/test/repo', '2.0.0', ['unknown.txt']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'unknown.txt'),
        originalContent
      );
    });

    it('should handle invalid JSON in package.json during replace', () => {
      const brokenJson = '{broken';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(brokenJson);

      const result = versionService.updateVersion('/test/repo', '2.0.0', ['package.json']);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/repo', 'package.json'),
        brokenJson
      );
    });
  });
});
