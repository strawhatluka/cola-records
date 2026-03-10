// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { buildConfigService } from '../../../src/main/services/build-config.service';

const TEST_DIR = path.join(__dirname, '__build_config_test_tmp__');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

describe('BuildConfigService', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ── detectBuildTool ──

  describe('detectBuildTool', () => {
    it('detects vite from vite.config.ts for node ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'vite.config.ts'), 'export default defineConfig({})');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('vite');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('vite.config.ts');
    });

    it('detects vite from vite.config.json for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'vite.config.json'),
        JSON.stringify({ build: { outDir: 'dist' } })
      );

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('vite');
      expect(result.hasConfig).toBe(true);
      expect(result.configPath).toContain('vite.config.json');
    });

    it('detects webpack from webpack.config.js for node ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'webpack.config.js'), 'module.exports = {}');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('webpack');
      expect(result.hasConfig).toBe(true);
    });

    it('detects rollup from rollup.config.js for node ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'rollup.config.js'), 'export default {}');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('rollup');
      expect(result.hasConfig).toBe(true);
    });

    it('detects esbuild from package.json devDependencies', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { esbuild: '^0.20.0' } })
      );

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('esbuild');
      expect(result.hasConfig).toBe(false);
    });

    it('detects tsc from tsconfig.build.json for node ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'tsconfig.build.json'),
        JSON.stringify({ compilerOptions: { outDir: 'dist' } })
      );

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('tsc');
      expect(result.hasConfig).toBe(true);
    });

    it('detects parcel from .parcelrc for node ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, '.parcelrc'), '{}');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('parcel');
      expect(result.hasConfig).toBe(true);
    });

    it('detects setuptools from setup.py for python ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'setup.py'),
        'from setuptools import setup\nsetup(name="test")'
      );

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'python');
      expect(result.buildTool).toBe('setuptools');
      expect(result.hasConfig).toBe(true);
    });

    it('detects poetry-build from pyproject.toml for python ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'pyproject.toml'),
        '[tool.poetry]\nname = "test"\nversion = "1.0.0"\n'
      );

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'python');
      expect(result.buildTool).toBe('poetry-build');
      expect(result.hasConfig).toBe(true);
    });

    it('detects go-build as built-in for go ecosystem', async () => {
      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'go');
      expect(result.buildTool).toBe('go-build');
      expect(result.hasConfig).toBe(false);
    });

    it('does not detect go-build for non-go ecosystem', async () => {
      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBeNull();
    });

    it('detects cargo-build from Cargo.toml for rust ecosystem', async () => {
      await writeFile(
        path.join(TEST_DIR, 'Cargo.toml'),
        '[package]\nname = "test"\nversion = "0.1.0"\n'
      );

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'rust');
      expect(result.buildTool).toBe('cargo-build');
      expect(result.hasConfig).toBe(true);
    });

    it('detects gradle from build.gradle for java ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'build.gradle'), 'apply plugin: "java"');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'java');
      expect(result.buildTool).toBe('gradle');
      expect(result.hasConfig).toBe(true);
    });

    it('detects maven from pom.xml for java ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'pom.xml'), '<project></project>');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'java');
      expect(result.buildTool).toBe('maven');
      expect(result.hasConfig).toBe(true);
    });

    it('detects composer from composer.json for php ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'composer.json'), JSON.stringify({ name: 'test/pkg' }));

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'php');
      expect(result.buildTool).toBe('composer');
      expect(result.hasConfig).toBe(true);
    });

    it('detects bundler from Gemfile for ruby ecosystem', async () => {
      await writeFile(path.join(TEST_DIR, 'Gemfile'), "gem 'rails'");

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'ruby');
      expect(result.buildTool).toBe('bundler');
      expect(result.hasConfig).toBe(true);
    });

    it('returns null for empty directory', async () => {
      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBeNull();
      expect(result.hasConfig).toBe(false);
    });

    it('prefers vite over webpack when both exist', async () => {
      await writeFile(path.join(TEST_DIR, 'vite.config.ts'), 'export default {}');
      await writeFile(path.join(TEST_DIR, 'webpack.config.js'), 'module.exports = {}');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'node');
      expect(result.buildTool).toBe('vite');
    });

    it('falls back to cross-ecosystem detection', async () => {
      await writeFile(path.join(TEST_DIR, 'vite.config.ts'), 'export default {}');

      const result = await buildConfigService.detectBuildTool(TEST_DIR, 'python');
      expect(result.buildTool).toBe('vite');
      expect(result.hasConfig).toBe(true);
    });
  });

  // ── readConfig ──

  describe('readConfig', () => {
    it('reads vite JSON config with build block', async () => {
      const configPath = path.join(TEST_DIR, 'vite.config.json');
      await writeFile(
        configPath,
        JSON.stringify({
          build: {
            outDir: 'dist',
            target: 'es2020',
            sourcemap: true,
            minify: 'esbuild',
            cssMinify: true,
            manifest: false,
            emptyOutDir: true,
            assetsInlineLimit: 4096,
            chunkSizeWarningLimit: 500,
          },
        })
      );

      const result = await buildConfigService.readConfig(configPath, 'vite');
      expect(result.buildTool).toBe('vite');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg.outDir).toBe('dist');
      expect(cfg.target).toBe('es2020');
      expect(cfg.sourcemap).toBe(true);
      expect(cfg.minify).toBe('esbuild');
      expect(cfg.cssMinify).toBe(true);
      expect(cfg.emptyOutDir).toBe(true);
      expect(cfg.assetsInlineLimit).toBe(4096);
      expect(cfg.chunkSizeWarningLimit).toBe(500);
    });

    it('returns raw content for TS/JS vite config', async () => {
      const configPath = path.join(TEST_DIR, 'vite.config.ts');
      await writeFile(configPath, 'export default defineConfig({})');

      const result = await buildConfigService.readConfig(configPath, 'vite');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('export default defineConfig({})');
    });

    it('returns raw content for webpack config', async () => {
      const configPath = path.join(TEST_DIR, 'webpack.config.js');
      await writeFile(configPath, 'module.exports = { output: { path: "dist" } }');

      const result = await buildConfigService.readConfig(configPath, 'webpack');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('module.exports = { output: { path: "dist" } }');
    });

    it('returns raw content for Cargo.toml', async () => {
      const configPath = path.join(TEST_DIR, 'Cargo.toml');
      await writeFile(configPath, '[package]\nname = "test"\n');

      const result = await buildConfigService.readConfig(configPath, 'cargo-build');
      const cfg = result.config as Record<string, unknown>;
      expect(cfg._raw).toBe('[package]\nname = "test"\n');
    });
  });

  // ── writeConfig ──

  describe('writeConfig', () => {
    it('writes vite build config to vite.config.json', async () => {
      const result = await buildConfigService.writeConfig(TEST_DIR, 'vite', {
        outDir: 'build',
        target: 'es2022',
        sourcemap: true,
        minify: 'terser',
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(TEST_DIR, 'vite.config.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.build.outDir).toBe('build');
      expect(parsed.build.target).toBe('es2022');
      expect(parsed.build.sourcemap).toBe(true);
      expect(parsed.build.minify).toBe('terser');
    });

    it('merges vite build into existing vite.config.json', async () => {
      await writeFile(
        path.join(TEST_DIR, 'vite.config.json'),
        JSON.stringify({ plugins: ['react'], server: { port: 3000 } })
      );

      const result = await buildConfigService.writeConfig(TEST_DIR, 'vite', {
        outDir: 'dist',
        minify: 'esbuild',
      });

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(TEST_DIR, 'vite.config.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.plugins).toEqual(['react']);
      expect(parsed.server.port).toBe(3000);
      expect(parsed.build.outDir).toBe('dist');
    });

    it('returns error for unsupported build tool', async () => {
      const result = await buildConfigService.writeConfig(TEST_DIR, 'webpack', {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');
    });
  });

  // ── getPresets ──

  describe('getPresets', () => {
    it('returns vite preset for node ecosystem', () => {
      const preset = buildConfigService.getPresets('node', null);
      expect(preset).toHaveProperty('outDir', 'dist');
      expect(preset).toHaveProperty('target', 'es2020');
      expect(preset).toHaveProperty('minify', 'esbuild');
    });

    it('returns vite preset for explicit vite build tool', () => {
      const preset = buildConfigService.getPresets('node', 'vite');
      expect(preset).toHaveProperty('outDir', 'dist');
      expect(preset).toHaveProperty('emptyOutDir', true);
    });

    it('returns vite preset for unknown ecosystem', () => {
      const preset = buildConfigService.getPresets('ruby', 'bundler');
      expect(preset).toHaveProperty('outDir', 'dist');
    });
  });
});
