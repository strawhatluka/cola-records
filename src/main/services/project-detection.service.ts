/**
 * Project Detection Service
 *
 * Scans a project directory to detect ecosystem, package manager,
 * available scripts, and tooling configuration. Used by Dev Tools
 * buttons to determine correct commands per ecosystem.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  PackageManager,
  ProjectScript,
  ProjectCommands,
  ProjectInfo,
  CleanTarget,
  HookTool,
} from '../ipc/channels/types';

const logger = createLogger('project-detection');

/** Manifest file → ecosystem mapping */
const MANIFEST_MAP: Record<string, Ecosystem> = {
  'package.json': 'node',
  'Cargo.toml': 'rust',
  'pyproject.toml': 'python',
  'requirements.txt': 'python',
  'go.mod': 'go',
  Gemfile: 'ruby',
  'composer.json': 'php',
  'pom.xml': 'java',
  'build.gradle': 'java',
};

/** Lock file → Node.js package manager mapping */
const NODE_LOCK_MAP: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun',
};

/** Lock file → Python package manager mapping */
const PYTHON_LOCK_MAP: Record<string, PackageManager> = {
  'poetry.lock': 'poetry',
  'uv.lock': 'uv',
};

/** Default package managers per ecosystem */
const DEFAULT_PM: Record<Ecosystem, PackageManager> = {
  node: 'npm',
  python: 'pip',
  rust: 'cargo',
  go: 'go',
  ruby: 'bundler',
  php: 'composer',
  java: 'maven',
  unknown: 'unknown',
};

/** Install commands per package manager */
const INSTALL_COMMANDS: Record<PackageManager, string | null> = {
  npm: 'npm install',
  yarn: 'yarn install',
  pnpm: 'pnpm install',
  bun: 'bun install',
  pip: 'pip install -e .',
  poetry: 'poetry install',
  uv: 'uv sync',
  cargo: 'cargo build',
  go: 'go mod download',
  bundler: 'bundle install',
  composer: 'composer install',
  maven: 'mvn install',
  gradle: 'gradle build',
  unknown: null,
};

/** TypeCheck commands per ecosystem */
const TYPECHECK_COMMANDS: Record<Ecosystem, string | null> = {
  node: 'npx tsc --noEmit',
  python: 'mypy .',
  rust: 'cargo check',
  go: 'go vet ./...',
  ruby: null,
  php: null,
  java: null,
  unknown: null,
};

/** Outdated commands per package manager */
const OUTDATED_COMMANDS: Record<PackageManager, string | null> = {
  npm: 'npm outdated',
  yarn: 'yarn outdated',
  pnpm: 'pnpm outdated',
  bun: 'bun outdated',
  pip: 'pip list --outdated',
  poetry: 'poetry show --outdated',
  uv: 'uv pip list --outdated',
  cargo: 'cargo outdated',
  go: 'go list -u -m all',
  bundler: 'bundle outdated',
  composer: 'composer outdated',
  maven: null,
  gradle: null,
  unknown: null,
};

/** Audit commands per package manager */
const AUDIT_COMMANDS: Record<PackageManager, string | null> = {
  npm: 'npm audit',
  yarn: 'yarn audit',
  pnpm: 'pnpm audit',
  bun: null,
  pip: 'pip-audit',
  poetry: null,
  uv: null,
  cargo: 'cargo audit',
  go: 'govulncheck ./...',
  bundler: 'bundle audit',
  composer: 'composer audit',
  maven: null,
  gradle: null,
  unknown: null,
};

/** Clean target patterns per ecosystem */
const CLEAN_TARGETS: Record<Ecosystem, string[]> = {
  node: ['dist', 'node_modules/.cache', '.next', '.turbo', '.nuxt'],
  python: ['__pycache__', '.pytest_cache', 'dist', 'build', '.mypy_cache'],
  rust: [],
  go: [],
  ruby: ['tmp', 'log'],
  php: ['vendor/cache'],
  java: ['target', 'build'],
  unknown: [],
};

/** Ecosystems that use a clean command instead of directory removal */
const CLEAN_COMMANDS: Partial<Record<Ecosystem, string>> = {
  rust: 'cargo clean',
  go: 'go clean -cache',
};

/** Hook tool install commands */
const HOOK_INSTALL_COMMANDS: Record<HookTool, string> = {
  husky: 'npx husky init',
  lefthook: 'npx lefthook install',
  'pre-commit': 'pre-commit install',
  'simple-git-hooks': 'npx simple-git-hooks',
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectEcosystem(directory: string): Promise<Ecosystem> {
  for (const [manifest, ecosystem] of Object.entries(MANIFEST_MAP)) {
    if (await fileExists(path.join(directory, manifest))) {
      return ecosystem;
    }
  }
  return 'unknown';
}

async function detectPackageManager(
  directory: string,
  ecosystem: Ecosystem
): Promise<PackageManager> {
  if (ecosystem === 'node') {
    for (const [lockFile, pm] of Object.entries(NODE_LOCK_MAP)) {
      if (await fileExists(path.join(directory, lockFile))) {
        return pm;
      }
    }
    return 'npm';
  }

  if (ecosystem === 'python') {
    for (const [lockFile, pm] of Object.entries(PYTHON_LOCK_MAP)) {
      if (await fileExists(path.join(directory, lockFile))) {
        return pm;
      }
    }
    return 'pip';
  }

  if (ecosystem === 'java') {
    if (await fileExists(path.join(directory, 'build.gradle'))) {
      return 'gradle';
    }
    return 'maven';
  }

  return DEFAULT_PM[ecosystem];
}

async function readScripts(directory: string): Promise<ProjectScript[]> {
  try {
    const pkgPath = path.join(directory, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
    if (!pkg.scripts) return [];
    return Object.entries(pkg.scripts).map(([name, command]) => ({ name, command }));
  } catch {
    return [];
  }
}

function resolveNodeCommands(pm: PackageManager, scripts: ProjectScript[]): ProjectCommands {
  const scriptNames = new Set(scripts.map((s) => s.name));
  const run = pm === 'npm' ? 'npm run' : `${pm} run`;
  const testCmd = pm === 'npm' ? 'npm test' : `${pm} run test`;

  return {
    install: INSTALL_COMMANDS[pm],
    lint: scriptNames.has('lint') ? `${run} lint` : null,
    format: scriptNames.has('format') ? `${run} format` : null,
    test: scriptNames.has('test') ? testCmd : null,
    coverage: scriptNames.has('test:coverage') ? `${run} test:coverage` : null,
    build: scriptNames.has('build') ? `${run} build` : null,
    typecheck: scriptNames.has('typecheck')
      ? `${run} typecheck`
      : scriptNames.has('type-check')
        ? `${run} type-check`
        : null,
    outdated: OUTDATED_COMMANDS[pm],
    audit: AUDIT_COMMANDS[pm],
    clean: null,
  };
}

function resolveStaticCommands(ecosystem: Ecosystem, pm: PackageManager): ProjectCommands {
  const install = INSTALL_COMMANDS[pm];
  const outdated = OUTDATED_COMMANDS[pm];
  const audit = AUDIT_COMMANDS[pm];
  const clean = CLEAN_COMMANDS[ecosystem] ?? null;

  switch (ecosystem) {
    case 'python':
      return {
        install,
        lint: 'ruff check .',
        format: 'ruff format .',
        test: 'pytest',
        coverage: 'pytest --cov',
        build: null,
        typecheck: TYPECHECK_COMMANDS.python,
        outdated,
        audit,
        clean,
      };
    case 'rust':
      return {
        install,
        lint: 'cargo clippy',
        format: 'cargo fmt',
        test: 'cargo test',
        coverage: null,
        build: 'cargo build --release',
        typecheck: TYPECHECK_COMMANDS.rust,
        outdated,
        audit,
        clean,
      };
    case 'go':
      return {
        install,
        lint: 'golangci-lint run',
        format: 'gofmt -w .',
        test: 'go test ./...',
        coverage: 'go test -coverprofile=coverage.out ./...',
        build: 'go build ./...',
        typecheck: TYPECHECK_COMMANDS.go,
        outdated,
        audit,
        clean,
      };
    default:
      return {
        install,
        lint: null,
        format: null,
        test: null,
        coverage: null,
        build: null,
        typecheck: null,
        outdated,
        audit,
        clean,
      };
  }
}

async function detectHookTool(directory: string): Promise<HookTool | null> {
  if (await fileExists(path.join(directory, '.husky'))) return 'husky';
  if (await fileExists(path.join(directory, 'lefthook.yml'))) return 'lefthook';
  if (await fileExists(path.join(directory, '.pre-commit-config.yaml'))) return 'pre-commit';

  // simple-git-hooks: check for .simple-git-hooks.json or package.json key
  if (await fileExists(path.join(directory, '.simple-git-hooks.json'))) return 'simple-git-hooks';
  try {
    const pkgPath = path.join(directory, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as Record<string, unknown>;
    if (pkg['simple-git-hooks']) return 'simple-git-hooks';
  } catch {
    // package.json missing or unreadable — skip
  }

  return null;
}

async function detectTypeChecker(directory: string, ecosystem: Ecosystem): Promise<string | null> {
  if (await fileExists(path.join(directory, 'tsconfig.json'))) return 'tsc';
  // Node requires tsconfig.json — don't assume TypeScript is present
  if (ecosystem === 'node') return null;
  return TYPECHECK_COMMANDS[ecosystem] ? ecosystem : null;
}

class ProjectDetectionService {
  async detect(directory: string): Promise<ProjectInfo> {
    logger.info(`Detecting project in: ${directory}`);

    const ecosystem = await detectEcosystem(directory);
    const packageManager = await detectPackageManager(directory, ecosystem);
    const scripts = ecosystem === 'node' ? await readScripts(directory) : [];
    const commands =
      ecosystem === 'node'
        ? resolveNodeCommands(packageManager, scripts)
        : resolveStaticCommands(ecosystem, packageManager);

    const [hasGit, hasEnv, hasEnvExample, hasEditorConfig, hookTool, typeChecker] =
      await Promise.all([
        fileExists(path.join(directory, '.git')),
        fileExists(path.join(directory, '.env')),
        fileExists(path.join(directory, '.env.example')),
        fileExists(path.join(directory, '.editorconfig')),
        detectHookTool(directory),
        detectTypeChecker(directory, ecosystem),
      ]);

    const info: ProjectInfo = {
      ecosystem,
      packageManager,
      scripts,
      commands,
      hasGit,
      hasEnv,
      hasEnvExample,
      hasEditorConfig,
      hookTool,
      typeChecker,
    };

    logger.info(`Detected: ${ecosystem} / ${packageManager}`);
    return info;
  }

  getInstallCommand(pm: PackageManager): string | null {
    return INSTALL_COMMANDS[pm];
  }

  getTypecheckCommand(ecosystem: Ecosystem): string | null {
    return TYPECHECK_COMMANDS[ecosystem];
  }

  getGitInitCommand(): string {
    return 'git init';
  }

  getHookInstallCommand(hookTool: HookTool | null): string | null {
    if (!hookTool) return null;
    return HOOK_INSTALL_COMMANDS[hookTool] ?? null;
  }

  async getCleanTargets(directory: string, ecosystem: Ecosystem): Promise<CleanTarget[]> {
    const patterns = CLEAN_TARGETS[ecosystem];
    if (patterns.length === 0) return [];

    const targets: CleanTarget[] = [];

    for (const pattern of patterns) {
      const targetPath = path.join(directory, pattern);
      try {
        const stat = await fs.stat(targetPath);
        if (stat.isDirectory()) {
          const size = await this.getDirectorySize(targetPath);
          // Normalize to POSIX paths so rm -rf works in Git Bash on Windows
          const posixPath = targetPath.split(path.sep).join('/');
          targets.push({ name: pattern, path: posixPath, sizeBytes: size });
        }
      } catch {
        // Target doesn't exist — skip
      }
    }

    return targets;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(entryPath);
        } else {
          const stat = await fs.stat(entryPath);
          size += stat.size;
        }
      }
    } catch {
      // Permission error or similar — return partial size
    }
    return size;
  }
}

export const projectDetectionService = new ProjectDetectionService();
