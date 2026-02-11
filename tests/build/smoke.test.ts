import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Build Smoke Tests
 *
 * These tests verify that essential build files and directories exist
 * and are properly configured for the v1 release build process.
 */
describe('Build Configuration Smoke Tests', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('essential project files', () => {
    it('has package.json', () => {
      expect(fs.existsSync(path.join(rootDir, 'package.json'))).toBe(true);
    });

    it('has forge.config.ts', () => {
      expect(fs.existsSync(path.join(rootDir, 'forge.config.ts'))).toBe(true);
    });

    it('has tsconfig.json', () => {
      expect(fs.existsSync(path.join(rootDir, 'tsconfig.json'))).toBe(true);
    });

    it('has vite.config.ts', () => {
      expect(fs.existsSync(path.join(rootDir, 'vite.config.ts'))).toBe(true);
    });

    it('has vite.main.config.ts', () => {
      expect(fs.existsSync(path.join(rootDir, 'vite.main.config.ts'))).toBe(true);
    });

    it('has vite.preload.config.ts', () => {
      expect(fs.existsSync(path.join(rootDir, 'vite.preload.config.ts'))).toBe(true);
    });

    it('has LICENSE file', () => {
      expect(fs.existsSync(path.join(rootDir, 'LICENSE'))).toBe(true);
    });

    it('has README.md', () => {
      expect(fs.existsSync(path.join(rootDir, 'README.md'))).toBe(true);
    });

    it('has CHANGELOG.md', () => {
      expect(fs.existsSync(path.join(rootDir, 'CHANGELOG.md'))).toBe(true);
    });
  });

  describe('source directory structure', () => {
    it('has src directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'src'))).toBe(true);
    });

    it('has src/main directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'src', 'main'))).toBe(true);
    });

    it('has src/renderer directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'src', 'renderer'))).toBe(true);
    });

    it('has main entry point (src/main/index.ts)', () => {
      expect(fs.existsSync(path.join(rootDir, 'src', 'main', 'index.ts'))).toBe(true);
    });

    it('has preload script (src/main/preload.ts)', () => {
      expect(fs.existsSync(path.join(rootDir, 'src', 'main', 'preload.ts'))).toBe(true);
    });

    it('has renderer entry point (src/renderer/index.tsx)', () => {
      expect(fs.existsSync(path.join(rootDir, 'src', 'renderer', 'index.tsx'))).toBe(true);
    });
  });

  describe('services directory', () => {
    it('has services directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'src', 'main', 'services'))).toBe(true);
    });

    it('has updater service', () => {
      expect(
        fs.existsSync(path.join(rootDir, 'src', 'main', 'services', 'updater.service.ts'))
      ).toBe(true);
    });

    it('has environment service', () => {
      expect(
        fs.existsSync(path.join(rootDir, 'src', 'main', 'services', 'environment.service.ts'))
      ).toBe(true);
    });
  });

  describe('assets directory', () => {
    it('has assets directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'assets'))).toBe(true);
    });

    it('has assets/icons directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'assets', 'icons'))).toBe(true);
    });

    it('has assets README', () => {
      expect(fs.existsSync(path.join(rootDir, 'assets', 'README.md'))).toBe(true);
    });
  });

  describe('IPC channels', () => {
    it('has IPC channels file', () => {
      expect(fs.existsSync(path.join(rootDir, 'src', 'main', 'ipc', 'channels.ts'))).toBe(true);
    });

    it('IPC channels contain updater channels', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src', 'main', 'ipc', 'channels.ts'),
        'utf-8'
      );
      expect(content).toContain("'updater:check'");
      expect(content).toContain("'updater:download'");
      expect(content).toContain("'updater:install'");
      expect(content).toContain("'updater:get-status'");
      expect(content).toContain("'updater:get-version'");
    });

    it('IPC channels contain updater events', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src', 'main', 'ipc', 'channels.ts'),
        'utf-8'
      );
      expect(content).toContain("'updater:checking'");
      expect(content).toContain("'updater:available'");
      expect(content).toContain("'updater:progress'");
      expect(content).toContain("'updater:downloaded'");
      expect(content).toContain("'updater:error'");
    });
  });

  describe('tests directory', () => {
    it('has tests directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'tests'))).toBe(true);
    });

    it('has tests/main directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'tests', 'main'))).toBe(true);
    });

    it('has tests/renderer directory', () => {
      expect(fs.existsSync(path.join(rootDir, 'tests', 'renderer'))).toBe(true);
    });
  });

  describe('documentation files content', () => {
    it('LICENSE contains MIT license', () => {
      const content = fs.readFileSync(path.join(rootDir, 'LICENSE'), 'utf-8');
      expect(content).toContain('MIT License');
      expect(content).toContain('Luka Fagundes');
    });

    it('README contains installation instructions', () => {
      const content = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');
      expect(content).toContain('Installation');
      expect(content).toContain('Windows');
      expect(content).toContain('macOS');
      expect(content).toContain('Linux');
    });

    it('README contains auto-update section', () => {
      const content = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');
      expect(content).toContain('Auto-Updates');
    });

    it('CHANGELOG contains Unreleased section', () => {
      const content = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf-8');
      expect(content).toContain('[Unreleased]');
    });
  });

  describe('updater service content', () => {
    it('updater service exports updaterService', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src', 'main', 'services', 'updater.service.ts'),
        'utf-8'
      );
      expect(content).toContain('export const updaterService');
    });

    it('updater service uses electron-updater', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src', 'main', 'services', 'updater.service.ts'),
        'utf-8'
      );
      expect(content).toContain("from 'electron-updater'");
    });

    it('updater service has checkForUpdates method', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src', 'main', 'services', 'updater.service.ts'),
        'utf-8'
      );
      expect(content).toContain('checkForUpdates');
    });

    it('updater service has downloadUpdate method', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src', 'main', 'services', 'updater.service.ts'),
        'utf-8'
      );
      expect(content).toContain('downloadUpdate');
    });

    it('updater service has quitAndInstall method', () => {
      const content = fs.readFileSync(
        path.join(rootDir, 'src', 'main', 'services', 'updater.service.ts'),
        'utf-8'
      );
      expect(content).toContain('quitAndInstall');
    });
  });

  describe('main index integration', () => {
    it('main index imports updaterService', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src', 'main', 'index.ts'), 'utf-8');
      expect(content).toContain('import { updaterService }');
    });

    it('main index has updater IPC handlers', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src', 'main', 'index.ts'), 'utf-8');
      expect(content).toContain("handleIpc('updater:check'");
      expect(content).toContain("handleIpc('updater:download'");
      expect(content).toContain("handleIpc('updater:install'");
      expect(content).toContain("handleIpc('updater:get-status'");
      expect(content).toContain("handleIpc('updater:get-version'");
    });
  });
});
