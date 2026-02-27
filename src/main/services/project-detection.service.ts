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

/** Hook tool install commands */
const HOOK_INSTALL_COMMANDS: Record<string, string> = {
  husky: 'npx husky init',
  lefthook: 'npx lefthook install',
  'pre-commit': 'pre-commit install',
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
  };
}

function resolveStaticCommands(ecosystem: Ecosystem, pm: PackageManager): ProjectCommands {
  const install = INSTALL_COMMANDS[pm];

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
      };
  }
}

async function detectHookTool(
  directory: string
): Promise<'husky' | 'lefthook' | 'pre-commit' | null> {
  if (await fileExists(path.join(directory, '.husky'))) return 'husky';
  if (await fileExists(path.join(directory, 'lefthook.yml'))) return 'lefthook';
  if (await fileExists(path.join(directory, '.pre-commit-config.yaml'))) return 'pre-commit';
  return null;
}

async function detectTypeChecker(directory: string, ecosystem: Ecosystem): Promise<string | null> {
  if (await fileExists(path.join(directory, 'tsconfig.json'))) return 'tsc';
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

  getHookInstallCommand(hookTool: string | null): string | null {
    if (!hookTool) return null;
    return HOOK_INSTALL_COMMANDS[hookTool] ?? null;
  }
}

export const projectDetectionService = new ProjectDetectionService();
