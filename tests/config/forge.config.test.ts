import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Forge Configuration Validation Tests
 *
 * These tests verify that the Electron Forge configuration is properly
 * set up for v1 release packaging across all platforms.
 */
describe('Forge Configuration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const forgeConfigPath = path.join(rootDir, 'forge.config.ts');

  describe('forge.config.ts existence', () => {
    it('exists in project root', () => {
      expect(fs.existsSync(forgeConfigPath)).toBe(true);
    });
  });

  describe('forge.config.ts content validation', () => {
    let configContent: string;

    beforeAll(() => {
      configContent = fs.readFileSync(forgeConfigPath, 'utf-8');
    });

    describe('packagerConfig', () => {
      it('has asar enabled', () => {
        expect(configContent).toContain('asar: true');
      });

      it('has icon path configured', () => {
        expect(configContent).toContain("icon: './assets/icons/icon'");
      });

      it('has app name set', () => {
        expect(configContent).toContain("name: 'Cola Records'");
      });

      it('has executable name set', () => {
        expect(configContent).toContain("executableName: 'cola-records'");
      });

      it('has app copyright', () => {
        expect(configContent).toContain('appCopyright');
        expect(configContent).toContain('Luka Fagundes');
      });

      it('has app bundle id for macOS', () => {
        expect(configContent).toContain("appBundleId: 'com.sunnystack.colarecords'");
      });

      it('has macOS app category', () => {
        expect(configContent).toContain('public.app-category.developer-tools');
      });

      it('has win32metadata configured', () => {
        expect(configContent).toContain('win32metadata');
        expect(configContent).toContain("CompanyName: 'Sunny Stack'");
        expect(configContent).toContain("ProductName: 'Cola Records'");
      });
    });

    describe('makers configuration', () => {
      it('has Squirrel maker for Windows', () => {
        expect(configContent).toContain('@electron-forge/maker-squirrel');
      });

      it('has ZIP maker for macOS', () => {
        expect(configContent).toContain('@electron-forge/maker-zip');
      });

      it('has DMG maker for macOS', () => {
        expect(configContent).toContain('@electron-forge/maker-dmg');
      });

      it('has DEB maker for Linux', () => {
        expect(configContent).toContain('@electron-forge/maker-deb');
      });

      it('has RPM maker for Linux', () => {
        expect(configContent).toContain('@electron-forge/maker-rpm');
      });
    });

    describe('Squirrel maker settings', () => {
      it('has setup executable name', () => {
        expect(configContent).toContain("setupExe: 'ColaRecordsSetup.exe'");
      });

      it('has setup icon configured', () => {
        expect(configContent).toContain("setupIcon: './assets/icons/icon.ico'");
      });

      it('has noMsi enabled', () => {
        expect(configContent).toContain('noMsi: true');
      });
    });

    describe('DMG maker settings', () => {
      it('has format set to ULFO', () => {
        expect(configContent).toContain("format: 'ULFO'");
      });

      it('has icon configured', () => {
        expect(configContent).toContain("icon: './assets/icons/icon.icns'");
      });
    });

    describe('DEB/RPM maker settings', () => {
      it('has maintainer configured for DEB', () => {
        expect(configContent).toContain("maintainer: 'Luka Fagundes'");
      });

      it('has Development category', () => {
        expect(configContent).toContain("categories: ['Development']");
      });

      it('has homepage URL', () => {
        expect(configContent).toContain('https://github.com/lukadfagundes/cola-records');
      });
    });

    describe('plugins configuration', () => {
      it('has VitePlugin configured', () => {
        expect(configContent).toContain('VitePlugin');
      });

      it('has main process entry', () => {
        expect(configContent).toContain("entry: 'src/main/index.ts'");
      });

      it('has preload entry', () => {
        expect(configContent).toContain("entry: 'src/main/preload.ts'");
      });

      it('has worker entry', () => {
        expect(configContent).toContain('contribution-scanner.worker.ts');
      });

      it('has renderer configuration', () => {
        expect(configContent).toContain("name: 'main_window'");
      });
    });

    describe('publishers configuration', () => {
      it('has GitHub publisher', () => {
        expect(configContent).toContain('@electron-forge/publisher-github');
      });

      it('has correct repository owner', () => {
        expect(configContent).toContain("owner: 'lukadfagundes'");
      });

      it('has correct repository name', () => {
        expect(configContent).toContain("name: 'cola-records'");
      });

      it('has draft releases enabled', () => {
        expect(configContent).toContain('draft: true');
      });
    });
  });

  describe('type imports', () => {
    let configContent: string;

    beforeAll(() => {
      configContent = fs.readFileSync(forgeConfigPath, 'utf-8');
    });

    it('imports ForgeConfig type', () => {
      expect(configContent).toContain('import type { ForgeConfig }');
    });

    it('imports MakerSquirrelConfig type', () => {
      expect(configContent).toContain('MakerSquirrelConfig');
    });

    it('imports MakerDMGConfig type', () => {
      expect(configContent).toContain('MakerDMGConfig');
    });

    it('imports MakerDebConfig type', () => {
      expect(configContent).toContain('MakerDebConfig');
    });

    it('imports MakerRpmConfig type', () => {
      expect(configContent).toContain('MakerRpmConfig');
    });
  });
});
