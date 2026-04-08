import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Package.json Configuration Validation Tests
 *
 * These tests verify that package.json is properly configured
 * for v1 release with correct metadata and scripts.
 */
describe('Package.json Configuration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  let packageJson: Record<string, unknown>;

  beforeAll(() => {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  });

  describe('file existence', () => {
    it('exists in project root', () => {
      expect(fs.existsSync(packageJsonPath)).toBe(true);
    });

    it('is valid JSON', () => {
      expect(packageJson).toBeDefined();
      expect(typeof packageJson).toBe('object');
    });
  });

  describe('basic metadata', () => {
    it('has name field', () => {
      expect(packageJson.name).toBe('cola-records');
    });

    it('has productName field', () => {
      expect(packageJson.productName).toBe('Cola Records');
    });

    it('has version field', () => {
      expect(packageJson.version).toBeDefined();
      expect(typeof packageJson.version).toBe('string');
    });

    it('has valid semver version', () => {
      const version = packageJson.version as string;
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('has description field', () => {
      expect(packageJson.description).toBeDefined();
      expect(typeof packageJson.description).toBe('string');
    });

    it('has license field set to MIT', () => {
      expect(packageJson.license).toBe('MIT');
    });
  });

  describe('author information', () => {
    it('has author field', () => {
      expect(packageJson.author).toBeDefined();
    });

    it('has author name', () => {
      const author = packageJson.author as { name?: string };
      expect(author.name).toBe('Luka Fagundes');
    });

    it('has author email', () => {
      const author = packageJson.author as { email?: string };
      expect(author.email).toBe('luka@sunny-stack.com');
    });
  });

  describe('main entry point', () => {
    it('has main field pointing to Vite build output', () => {
      expect(packageJson.main).toBe('.vite/build/index.js');
    });
  });

  describe('required scripts', () => {
    const scripts = () => packageJson.scripts as Record<string, string>;

    it('has start script', () => {
      expect(scripts().start).toBeDefined();
    });

    it('has build:win script', () => {
      expect(scripts()['build:win']).toBe('electron-forge make --platform win32');
    });

    it('has build:mac script', () => {
      expect(scripts()['build:mac']).toBe('electron-forge make --platform darwin');
    });

    it('has build:linux script', () => {
      expect(scripts()['build:linux']).toBe('electron-forge make --platform linux');
    });

    it('has release script', () => {
      expect(scripts().release).toBe('electron-forge publish');
    });

    it('has release:draft script', () => {
      expect(scripts()['release:draft']).toBe('electron-forge publish --dry-run');
    });

    it('has postinstall script for electron-rebuild', () => {
      expect(scripts().postinstall).toBe('electron-rebuild');
    });

    it('has test script', () => {
      expect(scripts().test).toBeDefined();
    });

    it('has lint script', () => {
      expect(scripts().lint).toBeDefined();
    });

    it('has typecheck script', () => {
      expect(scripts().typecheck).toBeDefined();
    });
  });

  describe('required dependencies', () => {
    const deps = () => packageJson.dependencies as Record<string, string>;

    it('has electron-updater dependency', () => {
      expect(deps()['electron-updater']).toBeDefined();
    });
  });

  describe('required devDependencies', () => {
    const devDeps = () => packageJson.devDependencies as Record<string, string>;

    it('has electron dependency', () => {
      expect(devDeps().electron).toBeDefined();
    });

    it('has @electron-forge/cli dependency', () => {
      expect(devDeps()['@electron-forge/cli']).toBeDefined();
    });

    it('has @electron-forge/plugin-vite dependency', () => {
      expect(devDeps()['@electron-forge/plugin-vite']).toBeDefined();
    });

    it('has @electron-forge/maker-squirrel dependency', () => {
      expect(devDeps()['@electron-forge/maker-squirrel']).toBeDefined();
    });

    it('has @electron-forge/maker-zip dependency', () => {
      expect(devDeps()['@electron-forge/maker-zip']).toBeDefined();
    });

    it('has @electron-forge/maker-dmg dependency', () => {
      expect(devDeps()['@electron-forge/maker-dmg']).toBeDefined();
    });

    it('has @electron-forge/maker-deb dependency', () => {
      expect(devDeps()['@electron-forge/maker-deb']).toBeDefined();
    });

    it('has @electron-forge/maker-rpm dependency', () => {
      expect(devDeps()['@electron-forge/maker-rpm']).toBeDefined();
    });

    it('has @electron-forge/publisher-github dependency', () => {
      expect(devDeps()['@electron-forge/publisher-github']).toBeDefined();
    });

    it('has typescript dependency', () => {
      expect(devDeps().typescript).toBeDefined();
    });

    it('has vitest dependency', () => {
      expect(devDeps().vitest).toBeDefined();
    });

    it('has eslint dependency', () => {
      expect(devDeps().eslint).toBeDefined();
    });
  });

  describe('repository information', () => {
    it('has repository field', () => {
      expect(packageJson.repository).toBeDefined();
    });

    it('has correct repository url', () => {
      const repo = packageJson.repository as { url?: string };
      expect(repo.url).toContain('github.com/strawhatluka/cola-records');
    });
  });

  describe('keywords', () => {
    it('has keywords array', () => {
      expect(Array.isArray(packageJson.keywords)).toBe(true);
    });

    it('has keywords array (can be empty)', () => {
      const keywords = packageJson.keywords as string[];
      // Keywords are optional, just verify it's an array
      expect(Array.isArray(keywords)).toBe(true);
    });
  });

  describe('engines (optional but recommended)', () => {
    it('has engines.node specified if engines exists', () => {
      if (packageJson.engines) {
        const engines = packageJson.engines as { node?: string };
        expect(engines.node).toBeDefined();
      }
    });
  });
});
