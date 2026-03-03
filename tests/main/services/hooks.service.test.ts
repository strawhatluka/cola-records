// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { hooksService } from '../../../src/main/services/hooks.service';
import type { HookConfig, GitHookName, HookAction } from '../../../src/main/ipc/channels/types';

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFile: vi.fn(
      (_cmd: string, _args: string[], _opts: unknown, cb: (...args: unknown[]) => void) => {
        cb(null, '', '');
      }
    ),
  };
});

const TEST_DIR = path.join(__dirname, '__hooks_test_tmp__');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

describe('HooksService', () => {
  beforeEach(async () => {
    await ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ── Detection ──

  describe('detect', () => {
    it('detects Husky when .husky directory exists', async () => {
      await ensureDir(path.join(TEST_DIR, '.husky'));
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.detected).toBe('husky');
    });

    it('detects Lefthook when lefthook.yml exists', async () => {
      await writeFile(path.join(TEST_DIR, 'lefthook.yml'), 'pre-commit:\n  commands:\n');
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.detected).toBe('lefthook');
    });

    it('detects pre-commit when .pre-commit-config.yaml exists', async () => {
      await writeFile(path.join(TEST_DIR, '.pre-commit-config.yaml'), 'repos:\n');
      const result = await hooksService.detect(TEST_DIR, 'python');
      expect(result.detected).toBe('pre-commit');
    });

    it('detects simple-git-hooks from .simple-git-hooks.json', async () => {
      await writeFile(
        path.join(TEST_DIR, '.simple-git-hooks.json'),
        JSON.stringify({ 'pre-commit': 'npx lint-staged' })
      );
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.detected).toBe('simple-git-hooks');
    });

    it('detects simple-git-hooks from package.json key', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({
          name: 'test',
          'simple-git-hooks': { 'pre-commit': 'npx lint-staged' },
        })
      );
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.detected).toBe('simple-git-hooks');
    });

    it('returns null when no hook tool is found', async () => {
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.detected).toBeNull();
    });

    it('includes recommendations based on ecosystem', async () => {
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].tool).toBe('husky');
    });

    it('returns Python-specific recommendations', async () => {
      const result = await hooksService.detect(TEST_DIR, 'python');
      expect(result.recommendations[0].tool).toBe('pre-commit');
    });

    it('detects lint-staged presence', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({
          name: 'test',
          'lint-staged': { '*.ts': ['eslint --fix'] },
        })
      );
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.hasLintStaged).toBe(true);
    });

    it('reads existing config when tool is detected', async () => {
      await ensureDir(path.join(TEST_DIR, '.husky'));
      await writeFile(path.join(TEST_DIR, '.husky', 'pre-commit'), 'npx lint-staged\n');
      const result = await hooksService.detect(TEST_DIR, 'node');
      expect(result.existingConfig).not.toBeNull();
      expect(result.existingConfig!.hooks['pre-commit'].length).toBe(1);
      expect(result.existingConfig!.hooks['pre-commit'][0].command).toBe('npx lint-staged');
    });
  });

  // ── Husky read/write ──

  describe('Husky read/write', () => {
    it('reads hook actions from .husky/ files', async () => {
      await ensureDir(path.join(TEST_DIR, '.husky'));
      await writeFile(
        path.join(TEST_DIR, '.husky', 'pre-commit'),
        '#!/usr/bin/env sh\nnpx lint-staged\nnpm test\n'
      );
      const config = await hooksService.readConfig(TEST_DIR, 'husky');
      expect(config.hooks['pre-commit']).toHaveLength(2);
      expect(config.hooks['pre-commit'][0].command).toBe('npx lint-staged');
      expect(config.hooks['pre-commit'][1].command).toBe('npm test');
    });

    it('writes hook actions to .husky/ files', async () => {
      await ensureDir(path.join(TEST_DIR, '.husky'));
      const config: HookConfig = {
        hookTool: 'husky',
        hooks: makeHooks('pre-commit', [{ command: 'npx lint-staged', label: 'lint-staged' }]),
        lintStaged: null,
      };
      await hooksService.writeConfig(TEST_DIR, config);
      const content = await readFile(path.join(TEST_DIR, '.husky', 'pre-commit'));
      expect(content).toContain('npx lint-staged');
    });

    it('removes hook file when all actions disabled', async () => {
      await ensureDir(path.join(TEST_DIR, '.husky'));
      await writeFile(path.join(TEST_DIR, '.husky', 'pre-commit'), 'npx lint-staged\n');
      const config: HookConfig = {
        hookTool: 'husky',
        hooks: makeHooks('pre-commit', [
          { command: 'npx lint-staged', label: 'lint-staged', enabled: false },
        ]),
        lintStaged: null,
      };
      await hooksService.writeConfig(TEST_DIR, config);
      const exists = await fs
        .access(path.join(TEST_DIR, '.husky', 'pre-commit'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });

  // ── simple-git-hooks read/write ──

  describe('simple-git-hooks read/write', () => {
    it('reads hooks from .simple-git-hooks.json', async () => {
      await writeFile(
        path.join(TEST_DIR, '.simple-git-hooks.json'),
        JSON.stringify({
          'pre-commit': 'npx lint-staged',
          'pre-push': 'npm test && npm run build',
        })
      );
      const config = await hooksService.readConfig(TEST_DIR, 'simple-git-hooks');
      expect(config.hooks['pre-commit']).toHaveLength(1);
      expect(config.hooks['pre-push']).toHaveLength(2);
    });

    it('writes hooks to .simple-git-hooks.json', async () => {
      const config: HookConfig = {
        hookTool: 'simple-git-hooks',
        hooks: makeHooks('pre-commit', [{ command: 'npx lint-staged', label: 'lint-staged' }]),
        lintStaged: null,
      };
      await hooksService.writeConfig(TEST_DIR, config);
      const content = JSON.parse(await readFile(path.join(TEST_DIR, '.simple-git-hooks.json')));
      expect(content['pre-commit']).toBe('npx lint-staged');
    });

    it('joins multiple actions with && for simple-git-hooks', async () => {
      const config: HookConfig = {
        hookTool: 'simple-git-hooks',
        hooks: makeHooks('pre-commit', [
          { command: 'npx lint-staged', label: 'lint-staged' },
          { command: 'npm test', label: 'test' },
        ]),
        lintStaged: null,
      };
      await hooksService.writeConfig(TEST_DIR, config);
      const content = JSON.parse(await readFile(path.join(TEST_DIR, '.simple-git-hooks.json')));
      expect(content['pre-commit']).toBe('npx lint-staged && npm test');
    });
  });

  // ── Lefthook read/write ──

  describe('Lefthook read/write', () => {
    it('reads commands from lefthook.yml', async () => {
      await writeFile(
        path.join(TEST_DIR, 'lefthook.yml'),
        'pre-commit:\n  commands:\n    lint:\n      run: npx eslint .\n    format:\n      run: npx prettier --check .\n'
      );
      const config = await hooksService.readConfig(TEST_DIR, 'lefthook');
      expect(config.hooks['pre-commit']).toHaveLength(2);
      expect(config.hooks['pre-commit'][0].command).toBe('npx eslint .');
    });

    it('writes commands to lefthook.yml', async () => {
      const config: HookConfig = {
        hookTool: 'lefthook',
        hooks: makeHooks('pre-push', [{ command: 'npm test', label: 'test' }]),
        lintStaged: null,
      };
      await hooksService.writeConfig(TEST_DIR, config);
      const content = await readFile(path.join(TEST_DIR, 'lefthook.yml'));
      expect(content).toContain('pre-push:');
      expect(content).toContain('run: npm test');
    });
  });

  // ── pre-commit read/write ──

  describe('pre-commit read/write', () => {
    it('writes local hooks to .pre-commit-config.yaml', async () => {
      const config: HookConfig = {
        hookTool: 'pre-commit',
        hooks: makeHooks('pre-commit', [{ command: 'ruff check .', label: 'Ruff check' }]),
        lintStaged: null,
      };
      await hooksService.writeConfig(TEST_DIR, config);
      const content = await readFile(path.join(TEST_DIR, '.pre-commit-config.yaml'));
      expect(content).toContain('repos:');
      expect(content).toContain('id: ruff check .');
      expect(content).toContain('language: system');
    });

    it('adds stages for non-pre-commit hooks', async () => {
      const config: HookConfig = {
        hookTool: 'pre-commit',
        hooks: makeHooks('pre-push', [{ command: 'pytest', label: 'Run tests' }]),
        lintStaged: null,
      };
      await hooksService.writeConfig(TEST_DIR, config);
      const content = await readFile(path.join(TEST_DIR, '.pre-commit-config.yaml'));
      expect(content).toContain('stages: [pre-push]');
    });
  });

  // ── lint-staged ──

  describe('lint-staged', () => {
    it('reads lint-staged config from package.json', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({
          name: 'test',
          'lint-staged': {
            '*.ts': ['eslint --fix', 'prettier --write'],
            '*.css': 'prettier --write',
          },
        })
      );
      const config = await hooksService.readConfig(TEST_DIR, 'husky');
      expect(config.lintStaged).not.toBeNull();
      expect(config.lintStaged!.rules).toHaveLength(2);
      expect(config.lintStaged!.rules[0].pattern).toBe('*.ts');
      expect(config.lintStaged!.rules[0].commands).toEqual(['eslint --fix', 'prettier --write']);
    });

    it('writes lint-staged config to package.json', async () => {
      await writeFile(path.join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }));
      const result = await hooksService.setupLintStaged(TEST_DIR, {
        enabled: true,
        rules: [{ id: '1', pattern: '*.ts', commands: ['eslint --fix'], enabled: true }],
      });
      expect(result.success).toBe(true);
      const content = JSON.parse(await readFile(path.join(TEST_DIR, 'package.json')));
      expect(content['lint-staged']['*.ts']).toEqual(['eslint --fix']);
    });

    it('removes lint-staged from package.json when disabled', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({
          name: 'test',
          'lint-staged': { '*.ts': ['eslint'] },
        })
      );
      await hooksService.setupLintStaged(TEST_DIR, { enabled: false, rules: [] });
      const content = JSON.parse(await readFile(path.join(TEST_DIR, 'package.json')));
      expect(content['lint-staged']).toBeUndefined();
    });
  });

  // ── Presets ──

  describe('presets', () => {
    it('returns Node.js presets with lint-staged and npm scripts', () => {
      const presets = hooksService.getPresetActions('node', 'husky');
      expect(presets['pre-commit'].length).toBeGreaterThan(0);
      expect(presets['pre-commit'].some((a) => a.command === 'npx lint-staged')).toBe(true);
      expect(presets['pre-commit'].some((a) => a.command === 'npm test')).toBe(true);
      expect(presets['pre-commit'].some((a) => a.command === 'npx tsc --noEmit')).toBe(true);
    });

    it('returns Python presets with ruff', () => {
      const presets = hooksService.getPresetActions('python', 'pre-commit');
      expect(presets['pre-commit'].some((a) => a.command.includes('ruff'))).toBe(true);
    });

    it('returns Rust presets with cargo', () => {
      const presets = hooksService.getPresetActions('rust', 'lefthook');
      expect(presets['pre-commit'].some((a) => a.command.includes('cargo fmt'))).toBe(true);
    });

    it('returns Go presets with go vet', () => {
      const presets = hooksService.getPresetActions('go', 'lefthook');
      expect(presets['pre-commit'].some((a) => a.command.includes('go vet'))).toBe(true);
    });

    it('returns Node pre-push hooks disabled by default', () => {
      const presets = hooksService.getPresetActions('node', 'husky');
      expect(presets['pre-push'].length).toBeGreaterThan(0);
      for (const action of presets['pre-push']) {
        expect(action.enabled).toBe(false);
      }
    });

    it('returns Python pre-push hooks disabled by default', () => {
      const presets = hooksService.getPresetActions('python', 'pre-commit');
      expect(presets['pre-push'].length).toBeGreaterThan(0);
      for (const action of presets['pre-push']) {
        expect(action.enabled).toBe(false);
      }
    });

    it('returns Rust pre-push hooks disabled by default', () => {
      const presets = hooksService.getPresetActions('rust', 'lefthook');
      expect(presets['pre-push'].length).toBeGreaterThan(0);
      for (const action of presets['pre-push']) {
        expect(action.enabled).toBe(false);
      }
    });

    it('returns empty presets for unknown ecosystem', () => {
      const presets = hooksService.getPresetActions('unknown', 'husky');
      for (const hookName of Object.keys(presets) as GitHookName[]) {
        expect(presets[hookName]).toEqual([]);
      }
    });

    it('returns Node.js lint-staged presets', () => {
      const presets = hooksService.getLintStagedPresets('node');
      expect(presets.length).toBe(4);
      expect(presets[0].pattern).toBe('*.{ts,tsx}');
    });

    it('returns empty lint-staged presets for non-Node ecosystems', () => {
      expect(hooksService.getLintStagedPresets('python')).toEqual([]);
    });
  });

  // ── Setup ──

  describe('setupHookTool', () => {
    it('creates Husky config with ecosystem presets and sets core.hooksPath', async () => {
      await ensureDir(TEST_DIR);
      const result = await hooksService.setupHookTool(TEST_DIR, 'husky', 'node');
      expect(result.success).toBe(true);
      expect(result.message).toContain('husky');

      // Verify files were created
      const content = await readFile(path.join(TEST_DIR, '.husky', 'pre-commit'));
      expect(content).toContain('npx lint-staged');

      // Verify git config core.hooksPath was called
      expect(execFile).toHaveBeenCalledWith(
        'git',
        ['config', 'core.hooksPath', '.husky'],
        expect.objectContaining({ cwd: TEST_DIR }),
        expect.any(Function)
      );
    });

    it('adds prepare script to package.json for Husky', async () => {
      await writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', scripts: {} })
      );
      await hooksService.setupHookTool(TEST_DIR, 'husky', 'node');
      const pkg = JSON.parse(await readFile(path.join(TEST_DIR, 'package.json')));
      expect(pkg.scripts.prepare).toBe('husky');
    });

    it('creates Lefthook config with ecosystem presets', async () => {
      const result = await hooksService.setupHookTool(TEST_DIR, 'lefthook', 'rust');
      expect(result.success).toBe(true);
      const content = await readFile(path.join(TEST_DIR, 'lefthook.yml'));
      expect(content).toContain('cargo fmt');
    });

    it('returns install command for each tool', () => {
      expect(hooksService.getInstallCommand('husky')).toBe('npx husky init');
      expect(hooksService.getInstallCommand('lefthook')).toBe('npx lefthook install');
      expect(hooksService.getInstallCommand('pre-commit')).toBe('pre-commit install');
      expect(hooksService.getInstallCommand('simple-git-hooks')).toBe('npx simple-git-hooks');
    });
  });

  // ── Recommendations ──

  describe('getRecommendations', () => {
    it('recommends Husky first for Node.js', () => {
      const recs = hooksService.getRecommendations('node');
      expect(recs[0].tool).toBe('husky');
      expect(recs[0].supportsLintStaged).toBe(true);
    });

    it('recommends pre-commit first for Python', () => {
      const recs = hooksService.getRecommendations('python');
      expect(recs[0].tool).toBe('pre-commit');
    });

    it('recommends Lefthook first for other ecosystems', () => {
      const recs = hooksService.getRecommendations('rust');
      expect(recs[0].tool).toBe('lefthook');
    });
  });
});

// ── Helpers ──

function makeHooks(
  hookName: GitHookName,
  actions: Array<{ command: string; label: string; enabled?: boolean }>
): Record<GitHookName, HookAction[]> {
  const hooks: Record<GitHookName, HookAction[]> = {
    'pre-commit': [],
    'commit-msg': [],
    'pre-push': [],
    'post-merge': [],
    'post-checkout': [],
  };

  hooks[hookName] = actions.map((a) => ({
    id: 'test-id',
    label: a.label,
    command: a.command,
    description: '',
    enabled: a.enabled !== false,
  }));

  return hooks;
}
