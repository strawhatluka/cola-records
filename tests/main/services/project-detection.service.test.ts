// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockReadFile: vi.fn(),
  mockStat: vi.fn(),
  mockReaddir: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  access: mocks.mockAccess,
  readFile: mocks.mockReadFile,
  stat: mocks.mockStat,
  readdir: mocks.mockReaddir,
}));

vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { projectDetectionService } from '../../../src/main/services/project-detection.service';

// Helper: make fileExists return true for specific files
function mockFileExists(existingFiles: string[]): void {
  mocks.mockAccess.mockImplementation(async (filePath: string) => {
    if (existingFiles.some((f) => filePath.endsWith(f))) return undefined;
    throw new Error('ENOENT');
  });
}

describe('ProjectDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no files exist
    mocks.mockAccess.mockRejectedValue(new Error('ENOENT'));
    mocks.mockReadFile.mockRejectedValue(new Error('ENOENT'));
    mocks.mockStat.mockRejectedValue(new Error('ENOENT'));
    mocks.mockReaddir.mockResolvedValue([]);
  });

  // ============================================
  // detect() — ecosystem detection
  // ============================================
  describe('detect() — ecosystem detection', () => {
    it('detects node ecosystem from package.json', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('node');
      expect(result.packageManager).toBe('npm');
    });

    it('detects rust ecosystem from Cargo.toml', async () => {
      mockFileExists(['Cargo.toml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('rust');
      expect(result.packageManager).toBe('cargo');
    });

    it('detects python ecosystem from pyproject.toml', async () => {
      mockFileExists(['pyproject.toml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('python');
      expect(result.packageManager).toBe('pip');
    });

    it('detects python ecosystem from requirements.txt', async () => {
      mockFileExists(['requirements.txt']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('python');
      expect(result.packageManager).toBe('pip');
    });

    it('detects go ecosystem from go.mod', async () => {
      mockFileExists(['go.mod']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('go');
      expect(result.packageManager).toBe('go');
    });

    it('detects ruby ecosystem from Gemfile', async () => {
      mockFileExists(['Gemfile']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('ruby');
      expect(result.packageManager).toBe('bundler');
    });

    it('detects php ecosystem from composer.json', async () => {
      mockFileExists(['composer.json']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('php');
      expect(result.packageManager).toBe('composer');
    });

    it('detects java ecosystem from pom.xml', async () => {
      mockFileExists(['pom.xml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('java');
      expect(result.packageManager).toBe('maven');
    });

    it('detects java ecosystem with gradle from build.gradle', async () => {
      mockFileExists(['build.gradle']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('java');
      expect(result.packageManager).toBe('gradle');
    });

    it('returns unknown ecosystem when no manifest found', async () => {
      // No files exist (default mock state)
      const result = await projectDetectionService.detect('/test/project');

      expect(result.ecosystem).toBe('unknown');
      expect(result.packageManager).toBe('unknown');
    });
  });

  // ============================================
  // detect() — Node.js package manager detection
  // ============================================
  describe('detect() — Node PM detection', () => {
    it('detects pnpm from pnpm-lock.yaml', async () => {
      mockFileExists(['package.json', 'pnpm-lock.yaml']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.packageManager).toBe('pnpm');
    });

    it('detects yarn from yarn.lock', async () => {
      mockFileExists(['package.json', 'yarn.lock']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.packageManager).toBe('yarn');
    });

    it('detects bun from bun.lockb', async () => {
      mockFileExists(['package.json', 'bun.lockb']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.packageManager).toBe('bun');
    });

    it('defaults to npm when no lock file found', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.packageManager).toBe('npm');
    });
  });

  // ============================================
  // detect() — Python package manager detection
  // ============================================
  describe('detect() — Python PM detection', () => {
    it('detects poetry from poetry.lock', async () => {
      mockFileExists(['pyproject.toml', 'poetry.lock']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.packageManager).toBe('poetry');
    });

    it('detects uv from uv.lock', async () => {
      mockFileExists(['pyproject.toml', 'uv.lock']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.packageManager).toBe('uv');
    });

    it('defaults to pip when no Python lock file found', async () => {
      mockFileExists(['pyproject.toml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.packageManager).toBe('pip');
    });
  });

  // ============================================
  // detect() — script reading (Node projects)
  // ============================================
  describe('detect() — scripts', () => {
    it('reads scripts from package.json', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue(
        JSON.stringify({
          scripts: {
            test: 'vitest',
            build: 'tsc && vite build',
            lint: 'eslint .',
          },
        })
      );

      const result = await projectDetectionService.detect('/test/project');

      expect(result.scripts).toHaveLength(3);
      expect(result.scripts).toContainEqual({ name: 'test', command: 'vitest' });
      expect(result.scripts).toContainEqual({ name: 'build', command: 'tsc && vite build' });
      expect(result.scripts).toContainEqual({ name: 'lint', command: 'eslint .' });
    });

    it('returns empty scripts when package.json has no scripts', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test-pkg' }));

      const result = await projectDetectionService.detect('/test/project');

      expect(result.scripts).toEqual([]);
    });

    it('returns empty scripts when package.json read fails', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockRejectedValue(new Error('read error'));

      const result = await projectDetectionService.detect('/test/project');

      expect(result.scripts).toEqual([]);
    });

    it('returns empty scripts for non-node ecosystems', async () => {
      mockFileExists(['Cargo.toml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.scripts).toEqual([]);
    });
  });

  // ============================================
  // detect() — Node command resolution
  // ============================================
  describe('detect() — Node command resolution', () => {
    it('resolves npm run commands for scripts', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue(
        JSON.stringify({
          scripts: {
            test: 'vitest',
            build: 'vite build',
            lint: 'eslint .',
            format: 'prettier .',
            'test:coverage': 'vitest --coverage',
            typecheck: 'tsc --noEmit',
          },
        })
      );

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.install).toBe('npm install');
      expect(result.commands.test).toBe('npm test');
      expect(result.commands.build).toBe('npm run build');
      expect(result.commands.lint).toBe('npm run lint');
      expect(result.commands.format).toBe('npm run format');
      expect(result.commands.coverage).toBe('npm run test:coverage');
      expect(result.commands.typecheck).toBe('npm run typecheck');
      expect(result.commands.outdated).toBe('npm outdated');
      expect(result.commands.audit).toBe('npm audit');
    });

    it('resolves pnpm run commands', async () => {
      mockFileExists(['package.json', 'pnpm-lock.yaml']);
      mocks.mockReadFile.mockResolvedValue(
        JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } })
      );

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.install).toBe('pnpm install');
      expect(result.commands.test).toBe('pnpm run test');
      expect(result.commands.build).toBe('pnpm run build');
    });

    it('resolves yarn run commands', async () => {
      mockFileExists(['package.json', 'yarn.lock']);
      mocks.mockReadFile.mockResolvedValue(JSON.stringify({ scripts: { test: 'vitest' } }));

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.install).toBe('yarn install');
      expect(result.commands.test).toBe('yarn run test');
    });

    it('returns null for missing script commands', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue(JSON.stringify({ scripts: {} }));

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.test).toBeNull();
      expect(result.commands.build).toBeNull();
      expect(result.commands.lint).toBeNull();
      expect(result.commands.format).toBeNull();
      expect(result.commands.coverage).toBeNull();
      expect(result.commands.typecheck).toBeNull();
    });

    it('resolves type-check script as typecheck command', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue(
        JSON.stringify({ scripts: { 'type-check': 'tsc --noEmit' } })
      );

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.typecheck).toBe('npm run type-check');
    });
  });

  // ============================================
  // detect() — static commands (non-Node)
  // ============================================
  describe('detect() — static commands', () => {
    it('returns Python commands', async () => {
      mockFileExists(['pyproject.toml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.install).toBe('pip install -e .');
      expect(result.commands.lint).toBe('ruff check .');
      expect(result.commands.format).toBe('ruff format .');
      expect(result.commands.test).toBe('pytest');
      expect(result.commands.coverage).toBe('pytest --cov');
      expect(result.commands.build).toBeNull();
      expect(result.commands.typecheck).toBe('mypy .');
    });

    it('returns Rust commands', async () => {
      mockFileExists(['Cargo.toml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.install).toBe('cargo build');
      expect(result.commands.lint).toBe('cargo clippy');
      expect(result.commands.format).toBe('cargo fmt');
      expect(result.commands.test).toBe('cargo test');
      expect(result.commands.build).toBe('cargo build --release');
      expect(result.commands.typecheck).toBe('cargo check');
      expect(result.commands.clean).toBe('cargo clean');
    });

    it('returns Go commands', async () => {
      mockFileExists(['go.mod']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.install).toBe('go mod download');
      expect(result.commands.lint).toBe('golangci-lint run');
      expect(result.commands.format).toBe('gofmt -w .');
      expect(result.commands.test).toBe('go test ./...');
      expect(result.commands.coverage).toBe('go test -coverprofile=coverage.out ./...');
      expect(result.commands.build).toBe('go build ./...');
      expect(result.commands.typecheck).toBe('go vet ./...');
      expect(result.commands.clean).toBe('go clean -cache');
    });

    it('returns null commands for unknown ecosystem', async () => {
      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.lint).toBeNull();
      expect(result.commands.format).toBeNull();
      expect(result.commands.test).toBeNull();
      expect(result.commands.build).toBeNull();
      expect(result.commands.typecheck).toBeNull();
    });

    it('returns Ruby install command', async () => {
      mockFileExists(['Gemfile']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.commands.install).toBe('bundle install');
      expect(result.commands.outdated).toBe('bundle outdated');
      expect(result.commands.audit).toBe('bundle audit');
    });
  });

  // ============================================
  // detect() — auxiliary flags
  // ============================================
  describe('detect() — auxiliary flags', () => {
    it('detects .git directory', async () => {
      mockFileExists(['package.json', '.git']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hasGit).toBe(true);
    });

    it('detects .env file', async () => {
      mockFileExists(['package.json', '.env']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hasEnv).toBe(true);
    });

    it('detects .env.example file', async () => {
      mockFileExists(['package.json', '.env.example']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hasEnvExample).toBe(true);
    });

    it('detects .editorconfig file', async () => {
      mockFileExists(['package.json', '.editorconfig']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hasEditorConfig).toBe(true);
    });

    it('returns false for missing auxiliary files', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hasGit).toBe(false);
      expect(result.hasEnv).toBe(false);
      expect(result.hasEnvExample).toBe(false);
      expect(result.hasEditorConfig).toBe(false);
    });
  });

  // ============================================
  // detect() — hook tool detection
  // ============================================
  describe('detect() — hook tool detection', () => {
    it('detects husky from .husky directory', async () => {
      mockFileExists(['package.json', '.husky']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hookTool).toBe('husky');
    });

    it('detects lefthook from lefthook.yml', async () => {
      mockFileExists(['package.json', 'lefthook.yml']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hookTool).toBe('lefthook');
    });

    it('detects pre-commit from .pre-commit-config.yaml', async () => {
      mockFileExists(['package.json', '.pre-commit-config.yaml']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hookTool).toBe('pre-commit');
    });

    it('detects simple-git-hooks from .simple-git-hooks.json', async () => {
      mockFileExists(['package.json', '.simple-git-hooks.json']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hookTool).toBe('simple-git-hooks');
    });

    it('detects simple-git-hooks from package.json key', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue(
        JSON.stringify({ 'simple-git-hooks': { 'pre-commit': 'npx lint-staged' } })
      );

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hookTool).toBe('simple-git-hooks');
    });

    it('returns null when no hook tool found', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.hookTool).toBeNull();
    });
  });

  // ============================================
  // detect() — type checker detection
  // ============================================
  describe('detect() — type checker detection', () => {
    it('detects tsc from tsconfig.json in node project', async () => {
      mockFileExists(['package.json', 'tsconfig.json']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.typeChecker).toBe('tsc');
    });

    it('returns null for node project without tsconfig.json', async () => {
      mockFileExists(['package.json']);
      mocks.mockReadFile.mockResolvedValue('{}');

      const result = await projectDetectionService.detect('/test/project');

      expect(result.typeChecker).toBeNull();
    });

    it('returns ecosystem name for non-node with typecheck support', async () => {
      mockFileExists(['Cargo.toml']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.typeChecker).toBe('rust');
    });

    it('returns null for ecosystems without typecheck', async () => {
      mockFileExists(['Gemfile']);

      const result = await projectDetectionService.detect('/test/project');

      expect(result.typeChecker).toBeNull();
    });
  });

  // ============================================
  // Utility methods
  // ============================================
  describe('getInstallCommand', () => {
    it('returns install command for npm', () => {
      expect(projectDetectionService.getInstallCommand('npm')).toBe('npm install');
    });

    it('returns install command for yarn', () => {
      expect(projectDetectionService.getInstallCommand('yarn')).toBe('yarn install');
    });

    it('returns install command for pnpm', () => {
      expect(projectDetectionService.getInstallCommand('pnpm')).toBe('pnpm install');
    });

    it('returns install command for bun', () => {
      expect(projectDetectionService.getInstallCommand('bun')).toBe('bun install');
    });

    it('returns install command for pip', () => {
      expect(projectDetectionService.getInstallCommand('pip')).toBe('pip install -e .');
    });

    it('returns install command for cargo', () => {
      expect(projectDetectionService.getInstallCommand('cargo')).toBe('cargo build');
    });

    it('returns null for unknown', () => {
      expect(projectDetectionService.getInstallCommand('unknown')).toBeNull();
    });
  });

  describe('getTypecheckCommand', () => {
    it('returns typecheck command for node', () => {
      expect(projectDetectionService.getTypecheckCommand('node')).toBe('npx tsc --noEmit');
    });

    it('returns typecheck command for python', () => {
      expect(projectDetectionService.getTypecheckCommand('python')).toBe('mypy .');
    });

    it('returns typecheck command for rust', () => {
      expect(projectDetectionService.getTypecheckCommand('rust')).toBe('cargo check');
    });

    it('returns typecheck command for go', () => {
      expect(projectDetectionService.getTypecheckCommand('go')).toBe('go vet ./...');
    });

    it('returns null for ruby', () => {
      expect(projectDetectionService.getTypecheckCommand('ruby')).toBeNull();
    });

    it('returns null for unknown', () => {
      expect(projectDetectionService.getTypecheckCommand('unknown')).toBeNull();
    });
  });

  describe('getGitInitCommand', () => {
    it('returns git init', () => {
      expect(projectDetectionService.getGitInitCommand()).toBe('git init');
    });
  });

  describe('getHookInstallCommand', () => {
    it('returns husky init command', () => {
      expect(projectDetectionService.getHookInstallCommand('husky')).toBe('npx husky init');
    });

    it('returns lefthook install command', () => {
      expect(projectDetectionService.getHookInstallCommand('lefthook')).toBe(
        'npx lefthook install'
      );
    });

    it('returns pre-commit install command', () => {
      expect(projectDetectionService.getHookInstallCommand('pre-commit')).toBe(
        'pre-commit install'
      );
    });

    it('returns simple-git-hooks command', () => {
      expect(projectDetectionService.getHookInstallCommand('simple-git-hooks')).toBe(
        'npx simple-git-hooks'
      );
    });

    it('returns null when hookTool is null', () => {
      expect(projectDetectionService.getHookInstallCommand(null)).toBeNull();
    });
  });

  // ============================================
  // getCleanTargets
  // ============================================
  describe('getCleanTargets', () => {
    it('returns clean targets for node ecosystem', async () => {
      mocks.mockStat.mockResolvedValue({ isDirectory: () => true });
      mocks.mockReaddir.mockResolvedValue([{ name: 'file1.js', isDirectory: () => false }]);
      mocks.mockStat
        .mockResolvedValueOnce({ isDirectory: () => true }) // dist
        .mockResolvedValueOnce({ isDirectory: () => true, size: 100 }) // file1.js inside dist
        .mockResolvedValueOnce({ isDirectory: () => true }) // node_modules/.cache
        .mockResolvedValueOnce({ isDirectory: () => true, size: 200 }); // file inside cache
      // After the isDirectory calls on dir entries, stat is called for file sizes
      // Let's simplify: all targets exist as directories with files
      mocks.mockStat.mockReset();
      mocks.mockStat.mockImplementation(async () => ({
        isDirectory: () => true,
        size: 1024,
      }));
      mocks.mockReaddir.mockResolvedValue([]);

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'node');

      // Should check dist, node_modules/.cache, .next, .turbo, .nuxt
      expect(targets.length).toBeGreaterThanOrEqual(1);
      expect(targets[0].name).toBe('dist');
    });

    it('returns empty array for ecosystems without clean targets', async () => {
      const targets = await projectDetectionService.getCleanTargets('/test/project', 'rust');

      expect(targets).toEqual([]);
    });

    it('returns empty array for unknown ecosystem', async () => {
      const targets = await projectDetectionService.getCleanTargets('/test/project', 'unknown');

      expect(targets).toEqual([]);
    });

    it('skips non-existent target directories', async () => {
      mocks.mockStat.mockRejectedValue(new Error('ENOENT'));

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'node');

      expect(targets).toEqual([]);
    });

    it('skips targets that are not directories', async () => {
      mocks.mockStat.mockResolvedValue({ isDirectory: () => false, size: 100 });

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'node');

      expect(targets).toEqual([]);
    });

    it('calculates directory size recursively', async () => {
      // First stat call: target exists as directory
      let statCallCount = 0;
      mocks.mockStat.mockImplementation(async () => {
        statCallCount++;
        if (statCallCount === 1) {
          return { isDirectory: () => true }; // target directory
        }
        return { isDirectory: () => false, size: 512 }; // files
      });

      // readdir for the target: one file
      mocks.mockReaddir.mockImplementation(async () => [
        { name: 'bundle.js', isDirectory: () => false },
      ]);

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'node');

      expect(targets.length).toBeGreaterThanOrEqual(1);
      if (targets.length > 0) {
        expect(targets[0].sizeBytes).toBe(512);
      }
    });

    it('calculates size with nested directories', async () => {
      let statCallCount = 0;
      mocks.mockStat.mockImplementation(async () => {
        statCallCount++;
        if (statCallCount === 1) return { isDirectory: () => true }; // dist dir
        if (statCallCount === 2) return { isDirectory: () => false, size: 100 }; // file in subdir
        return { isDirectory: () => false, size: 200 }; // another file
      });

      let readdirCallCount = 0;
      mocks.mockReaddir.mockImplementation(async () => {
        readdirCallCount++;
        if (readdirCallCount === 1) {
          // dist has a subdirectory
          return [{ name: 'sub', isDirectory: () => true }];
        }
        if (readdirCallCount === 2) {
          // sub has a file
          return [{ name: 'data.txt', isDirectory: () => false }];
        }
        return [];
      });

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'node');

      expect(targets.length).toBeGreaterThanOrEqual(1);
    });

    it('handles readdir permission errors gracefully', async () => {
      mocks.mockStat.mockResolvedValue({ isDirectory: () => true });
      mocks.mockReaddir.mockRejectedValue(new Error('EACCES'));

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'node');

      // Should return targets with 0 size (readdir failed)
      expect(targets.length).toBeGreaterThanOrEqual(1);
      expect(targets[0].sizeBytes).toBe(0);
    });

    it('normalizes paths to POSIX format', async () => {
      mocks.mockStat.mockResolvedValue({ isDirectory: () => true });
      mocks.mockReaddir.mockResolvedValue([]);

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'node');

      // All paths should use forward slashes
      for (const target of targets) {
        expect(target.path).not.toContain('\\');
      }
    });

    it('returns java clean targets', async () => {
      mocks.mockStat.mockResolvedValue({ isDirectory: () => true });
      mocks.mockReaddir.mockResolvedValue([]);

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'java');

      // Java has 'target' and 'build' clean targets
      const names = targets.map((t) => t.name);
      expect(names).toContain('target');
      expect(names).toContain('build');
    });

    it('returns python clean targets', async () => {
      mocks.mockStat.mockResolvedValue({ isDirectory: () => true });
      mocks.mockReaddir.mockResolvedValue([]);

      const targets = await projectDetectionService.getCleanTargets('/test/project', 'python');

      const names = targets.map((t) => t.name);
      expect(names).toContain('__pycache__');
      expect(names).toContain('.pytest_cache');
    });
  });
});
