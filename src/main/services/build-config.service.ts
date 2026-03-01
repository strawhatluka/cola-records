/**
 * Build Config Service
 *
 * Detect project build tools, read/write config files, and provide
 * ecosystem presets. Supports 14 build tools across 7 ecosystems.
 * Rich GUI for Vite (outDir, target, sourcemap, minify, cssMinify,
 * manifest, emptyOutDir, assetsInlineLimit, chunkSizeWarningLimit).
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  BuildToolType,
  BuildToolInfo,
  BuildConfig,
  ViteBuildConfig,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('build-config');

// ────────────────────────────────────────────────────────────
// Detection
// ────────────────────────────────────────────────────────────

interface DetectionEntry {
  buildTool: BuildToolType;
  files: string[];
  packageJsonDep?: string;
  pyprojectSection?: string;
}

const DETECTION_MAP: Record<string, DetectionEntry[]> = {
  node: [
    {
      buildTool: 'vite',
      files: [
        'vite.config.ts',
        'vite.config.js',
        'vite.config.mts',
        'vite.config.mjs',
        'vite.config.json',
      ],
      packageJsonDep: 'vite',
    },
    {
      buildTool: 'webpack',
      files: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.cjs', 'webpack.config.mjs'],
      packageJsonDep: 'webpack',
    },
    {
      buildTool: 'rollup',
      files: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs', 'rollup.config.cjs'],
      packageJsonDep: 'rollup',
    },
    {
      buildTool: 'esbuild',
      files: ['esbuild.config.js', 'esbuild.config.ts', 'esbuild.config.mjs'],
      packageJsonDep: 'esbuild',
    },
    {
      buildTool: 'tsc',
      files: ['tsconfig.build.json'],
    },
    {
      buildTool: 'parcel',
      files: ['.parcelrc'],
      packageJsonDep: 'parcel',
    },
  ],
  python: [
    {
      buildTool: 'setuptools',
      files: ['setup.py', 'setup.cfg'],
    },
    {
      buildTool: 'poetry-build',
      files: [],
      pyprojectSection: '[tool.poetry',
    },
  ],
  go: [
    {
      buildTool: 'go-build',
      files: [],
    },
  ],
  rust: [
    {
      buildTool: 'cargo-build',
      files: ['Cargo.toml'],
    },
  ],
  ruby: [
    {
      buildTool: 'bundler',
      files: ['Gemfile'],
    },
  ],
  php: [
    {
      buildTool: 'composer',
      files: ['composer.json'],
    },
  ],
  java: [
    {
      buildTool: 'gradle',
      files: ['build.gradle', 'build.gradle.kts'],
    },
    {
      buildTool: 'maven',
      files: ['pom.xml'],
    },
  ],
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectInEcosystem(
  directory: string,
  entries: DetectionEntry[],
  isTargetEcosystem: boolean = false
): Promise<BuildToolInfo> {
  for (const entry of entries) {
    // Built-in tools (go-build) — only when target ecosystem
    if (entry.files.length === 0 && !entry.packageJsonDep && !entry.pyprojectSection) {
      if (isTargetEcosystem) {
        return {
          buildTool: entry.buildTool,
          configPath: null,
          hasConfig: false,
        };
      }
      continue;
    }

    // Check config files
    for (const file of entry.files) {
      const fullPath = path.join(directory, file);
      if (await fileExists(fullPath)) {
        return {
          buildTool: entry.buildTool,
          configPath: fullPath,
          hasConfig: true,
        };
      }
    }

    // Check package.json devDependencies
    if (entry.packageJsonDep) {
      const pkgPath = path.join(directory, 'package.json');
      if (await fileExists(pkgPath)) {
        try {
          const pkgContent = await fs.readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          const devDeps = pkg.devDependencies ?? {};
          const deps = pkg.dependencies ?? {};
          if (devDeps[entry.packageJsonDep] || deps[entry.packageJsonDep]) {
            return {
              buildTool: entry.buildTool,
              configPath: null,
              hasConfig: false,
            };
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Check pyproject.toml sections (Python)
    if (entry.pyprojectSection) {
      const pyprojectPath = path.join(directory, 'pyproject.toml');
      if (await fileExists(pyprojectPath)) {
        try {
          const content = await fs.readFile(pyprojectPath, 'utf-8');
          if (content.includes(entry.pyprojectSection)) {
            return {
              buildTool: entry.buildTool,
              configPath: pyprojectPath,
              hasConfig: true,
            };
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  return {
    buildTool: null,
    configPath: null,
    hasConfig: false,
  };
}

// ────────────────────────────────────────────────────────────
// Config read/write
// ────────────────────────────────────────────────────────────

function parseViteBuild(raw: Record<string, unknown>): ViteBuildConfig {
  const config: ViteBuildConfig = {};

  const build = (raw.build ?? raw) as Record<string, unknown>;

  if (typeof build.outDir === 'string') config.outDir = build.outDir;
  if (typeof build.target === 'string') config.target = build.target;
  if (
    typeof build.sourcemap === 'boolean' ||
    build.sourcemap === 'inline' ||
    build.sourcemap === 'hidden'
  )
    config.sourcemap = build.sourcemap as boolean | 'inline' | 'hidden';
  if (typeof build.minify === 'boolean' || build.minify === 'terser' || build.minify === 'esbuild')
    config.minify = build.minify as boolean | 'terser' | 'esbuild';
  if (typeof build.cssMinify === 'boolean') config.cssMinify = build.cssMinify;
  if (typeof build.manifest === 'boolean') config.manifest = build.manifest;
  if (typeof build.emptyOutDir === 'boolean') config.emptyOutDir = build.emptyOutDir;
  if (typeof build.assetsInlineLimit === 'number')
    config.assetsInlineLimit = build.assetsInlineLimit;
  if (typeof build.chunkSizeWarningLimit === 'number')
    config.chunkSizeWarningLimit = build.chunkSizeWarningLimit;

  return config;
}

function viteBuildToJson(config: ViteBuildConfig): Record<string, unknown> {
  const build: Record<string, unknown> = {};

  if (config.outDir !== undefined) build.outDir = config.outDir;
  if (config.target !== undefined) build.target = config.target;
  if (config.sourcemap !== undefined) build.sourcemap = config.sourcemap;
  if (config.minify !== undefined) build.minify = config.minify;
  if (config.cssMinify !== undefined) build.cssMinify = config.cssMinify;
  if (config.manifest !== undefined) build.manifest = config.manifest;
  if (config.emptyOutDir !== undefined) build.emptyOutDir = config.emptyOutDir;
  if (config.assetsInlineLimit !== undefined) build.assetsInlineLimit = config.assetsInlineLimit;
  if (config.chunkSizeWarningLimit !== undefined)
    build.chunkSizeWarningLimit = config.chunkSizeWarningLimit;

  return { build };
}

// ────────────────────────────────────────────────────────────
// Presets
// ────────────────────────────────────────────────────────────

function getVitePreset(): ViteBuildConfig {
  return {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
    manifest: false,
    emptyOutDir: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 500,
  };
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

class BuildConfigService {
  async detectBuildTool(directory: string, ecosystem: Ecosystem): Promise<BuildToolInfo> {
    // Try ecosystem-specific detection first
    const entries = DETECTION_MAP[ecosystem];
    if (entries) {
      const result = await detectInEcosystem(directory, entries, true);
      if (result.buildTool) return result;
    }

    // Fall back: check all known config files across all ecosystems
    for (const [eco, ecoEntries] of Object.entries(DETECTION_MAP)) {
      if (eco === ecosystem) continue;
      const result = await detectInEcosystem(directory, ecoEntries, false);
      if (result.buildTool) return result;
    }

    return {
      buildTool: null,
      configPath: null,
      hasConfig: false,
    };
  }

  async readConfig(configPath: string, buildTool: BuildToolType): Promise<BuildConfig> {
    const content = await fs.readFile(configPath, 'utf-8');

    if (buildTool === 'vite') {
      // Try parsing as JSON (vite.config.json)
      try {
        const raw = JSON.parse(content);
        return {
          buildTool,
          config: parseViteBuild(raw),
          configPath,
        };
      } catch {
        // TS/JS config — return raw for generic editor
        return {
          buildTool,
          config: { _raw: content },
          configPath,
        };
      }
    }

    // Generic fallback — return raw content
    return {
      buildTool,
      config: { _raw: content },
      configPath,
    };
  }

  async writeConfig(
    directory: string,
    buildTool: BuildToolType,
    config: ViteBuildConfig | Record<string, unknown>
  ): Promise<SetUpActionResult> {
    try {
      if (buildTool === 'vite') {
        const configPath = path.join(directory, 'vite.config.json');

        // Read existing config to merge build into it
        let existing: Record<string, unknown> = {};
        if (await fileExists(configPath)) {
          try {
            const raw = await fs.readFile(configPath, 'utf-8');
            existing = JSON.parse(raw);
          } catch {
            // Start fresh if parse fails
          }
        }

        const buildJson = viteBuildToJson(config as ViteBuildConfig);
        const merged = {
          ...existing,
          build: (buildJson as Record<string, unknown>).build,
        };

        await fs.writeFile(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
        logger.info(`Wrote build config to vite.config.json in: ${directory}`);
        return { success: true, message: 'Saved build config' };
      }

      return { success: false, message: `Write not supported for ${buildTool}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write build config: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  getPresets(
    ecosystem: Ecosystem,
    buildTool: BuildToolType | null
  ): ViteBuildConfig | Record<string, unknown> {
    if (buildTool === 'vite' || (!buildTool && ecosystem === 'node')) {
      return getVitePreset();
    }

    // Default to Vite presets for unknown
    return getVitePreset();
  }
}

export const buildConfigService = new BuildConfigService();
