/**
 * Project Scaffold Service
 *
 * Orchestrates project creation using CLI tools and template files
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type { Ecosystem, ScaffoldConfig, ScaffoldResult } from '../ipc/channels/types';
import { getGitignoreTemplate } from './templates/gitignore.templates';
import { getLicenseTemplate } from './templates/license.templates';

const log = createLogger('project-scaffold');
const execFileAsync = promisify(execFile);

interface ScaffoldCommand {
  cmd: string;
  args: string[];
  cwd?: string;
}

function getScaffoldCommand(config: ScaffoldConfig): ScaffoldCommand | null {
  const {
    ecosystem,
    framework,
    projectName,
    projectPath,
    packageManager,
    isMonorepo,
    monorepoTool,
  } = config;
  const parentDir = path.dirname(projectPath);

  if (isMonorepo) {
    return getMonorepoCommand(ecosystem, monorepoTool, projectName, parentDir, packageManager);
  }

  switch (ecosystem) {
    case 'node':
      return getNodeCommand(framework, projectName, parentDir, packageManager);
    case 'python':
      return getPythonCommand(framework, projectName, parentDir, packageManager);
    case 'rust':
      return { cmd: 'cargo', args: ['init', projectPath], cwd: parentDir };
    case 'go':
      return null; // handled specially — mkdir + go mod init
    case 'ruby':
      return getRubyCommand(framework, projectName, parentDir);
    case 'php':
      return getPHPCommand(framework, projectName, parentDir);
    case 'java':
      return getJavaCommand(framework, projectName, parentDir);
    default:
      return null;
  }
}

function getNodeCommand(
  framework: string | undefined,
  name: string,
  cwd: string,
  pm?: string
): ScaffoldCommand | null {
  const runner = pm || 'npm';
  const template =
    framework === 'react' ? 'react-ts' : framework === 'vanilla-ts' ? 'vanilla-ts' : 'vanilla';

  switch (framework) {
    case 'react':
    case 'vanilla-ts':
    case 'vanilla':
      if (runner === 'bun') {
        return { cmd: 'bun', args: ['create', 'vite', name, '--template', template], cwd };
      }
      if (runner === 'pnpm') {
        return { cmd: 'pnpm', args: ['create', 'vite', name, '--template', template], cwd };
      }
      if (runner === 'yarn') {
        return { cmd: 'yarn', args: ['create', 'vite', name, '--template', template], cwd };
      }
      return {
        cmd: 'npm',
        args: ['create', 'vite@latest', name, '--', '--template', template],
        cwd,
      };
    case 'nextjs':
      if (runner === 'bun') {
        return { cmd: 'bun', args: ['create', 'next-app', name, '--ts', '--yes'], cwd };
      }
      if (runner === 'pnpm') {
        return { cmd: 'pnpm', args: ['create', 'next-app', name, '--ts', '--yes'], cwd };
      }
      return {
        cmd: 'npx',
        args: ['create-next-app@latest', name, '--ts', '--use-npm', '--yes'],
        cwd,
      };
    case 'express':
      return null; // mkdir + npm init + install express
    default:
      return { cmd: runner, args: ['init', '-y'], cwd: path.join(cwd, name) };
  }
}

function getPythonCommand(
  _framework: string | undefined,
  name: string,
  cwd: string,
  pm?: string
): ScaffoldCommand | null {
  if (pm === 'uv') {
    return { cmd: 'uv', args: ['init', name], cwd };
  }
  if (pm === 'poetry') {
    return { cmd: 'poetry', args: ['new', name], cwd };
  }
  return null; // mkdir + manual structure
}

function getRubyCommand(
  framework: string | undefined,
  name: string,
  cwd: string
): ScaffoldCommand | null {
  if (framework === 'rails') {
    return { cmd: 'rails', args: ['new', name, '--skip-git'], cwd };
  }
  return { cmd: 'bundler', args: ['gem', name], cwd };
}

function getPHPCommand(
  framework: string | undefined,
  name: string,
  cwd: string
): ScaffoldCommand | null {
  if (framework === 'laravel') {
    return { cmd: 'composer', args: ['create-project', 'laravel/laravel', name], cwd };
  }
  return null;
}

function getJavaCommand(
  framework: string | undefined,
  _name: string,
  _cwd: string
): ScaffoldCommand | null {
  if (framework === 'spring-boot') {
    return null; // Spring Initializr requires web API or manual setup
  }
  return null; // mkdir + manual structure
}

function getMonorepoCommand(
  _ecosystem: Ecosystem,
  tool: string | undefined,
  name: string,
  cwd: string,
  pm?: string
): ScaffoldCommand | null {
  switch (tool) {
    case 'turborepo':
      return {
        cmd: 'npx',
        args: [
          'create-turbo@latest',
          name,
          '--example',
          'basic',
          '--package-manager',
          pm || 'npm',
          '--skip-install',
        ],
        cwd,
      };
    case 'nx':
      return {
        cmd: 'npx',
        args: [
          'create-nx-workspace@latest',
          name,
          '--preset=ts',
          '--nxCloud=skip',
          '--interactive=false',
          '--packageManager',
          pm || 'npm',
          '--skipGit',
        ],
        cwd,
      };
    case 'pnpm-workspaces':
      return null; // manual setup with pnpm-workspace.yaml
    case 'cargo-workspaces':
      return null; // manual Cargo.toml with [workspace]
    case 'go-workspaces':
      return null; // go work init
    case 'uv-workspaces':
      return { cmd: 'uv', args: ['init', '--workspace', name], cwd };
    default:
      return null;
  }
}

async function runCommand(
  cmd: ScaffoldCommand,
  timeout: number = 120000
): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env, npm_config_yes: 'true' };
  try {
    if (process.platform === 'win32') {
      const fullCommand = `${cmd.cmd} ${cmd.args.join(' ')}`;
      return await execFileAsync(fullCommand, [], { cwd: cmd.cwd, timeout, shell: true, env });
    }
    return await execFileAsync(cmd.cmd, cmd.args, { cwd: cmd.cwd, timeout, env });
  } catch (error) {
    throw new Error(`Command '${cmd.cmd} ${cmd.args.join(' ')}' failed: ${error}`);
  }
}

async function createDirectoryStructure(config: ScaffoldConfig): Promise<void> {
  if (!fs.existsSync(config.projectPath)) {
    fs.mkdirSync(config.projectPath, { recursive: true });
  }
}

async function scaffoldGo(config: ScaffoldConfig): Promise<string[]> {
  const files: string[] = [];
  const moduleName = `github.com/user/${config.projectName}`;

  await runCommand({ cmd: 'go', args: ['mod', 'init', moduleName], cwd: config.projectPath });
  files.push('go.mod');

  const mainGo = `package main

import "fmt"

func main() {
\tfmt.Println("Hello, ${config.projectName}!")
}
`;
  fs.writeFileSync(path.join(config.projectPath, 'main.go'), mainGo, 'utf-8');
  files.push('main.go');

  return files;
}

async function scaffoldMonorepoManual(config: ScaffoldConfig): Promise<string[]> {
  const files: string[] = [];

  switch (config.monorepoTool) {
    case 'pnpm-workspaces': {
      const workspaceYaml = `packages:\n  - "packages/*"\n`;
      fs.writeFileSync(
        path.join(config.projectPath, 'pnpm-workspace.yaml'),
        workspaceYaml,
        'utf-8'
      );
      files.push('pnpm-workspace.yaml');

      const pkgJson = JSON.stringify({ name: config.projectName, private: true }, null, 2);
      fs.writeFileSync(path.join(config.projectPath, 'package.json'), pkgJson, 'utf-8');
      files.push('package.json');

      fs.mkdirSync(path.join(config.projectPath, 'packages'), { recursive: true });
      break;
    }
    case 'cargo-workspaces': {
      const cargoToml = `[workspace]\nmembers = ["crates/*"]\nresolver = "2"\n\n[workspace.package]\nedition = "2021"\n`;
      fs.writeFileSync(path.join(config.projectPath, 'Cargo.toml'), cargoToml, 'utf-8');
      files.push('Cargo.toml');

      fs.mkdirSync(path.join(config.projectPath, 'crates'), { recursive: true });
      break;
    }
    case 'go-workspaces': {
      await runCommand({ cmd: 'go', args: ['work', 'init'], cwd: config.projectPath });
      files.push('go.work');

      fs.mkdirSync(path.join(config.projectPath, 'packages'), { recursive: true });
      break;
    }
  }

  return files;
}

function writeExtras(config: ScaffoldConfig): string[] {
  const files: string[] = [];

  if (config.extras.gitignore) {
    const content = getGitignoreTemplate(config.ecosystem);
    fs.writeFileSync(path.join(config.projectPath, '.gitignore'), content, 'utf-8');
    files.push('.gitignore');
  }

  if (config.extras.editorconfig) {
    const content = `root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{py,rs,go,java,rb,php}]
indent_size = 4
`;
    fs.writeFileSync(path.join(config.projectPath, '.editorconfig'), content, 'utf-8');
    files.push('.editorconfig');
  }

  if (config.extras.envFile) {
    const envPath = path.join(config.projectPath, '.env');
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, '# Environment Variables\n', 'utf-8');
      files.push('.env');
    }
  }

  if (config.extras.readme) {
    const content = `# ${config.projectName}\n\nA new ${config.ecosystem} project.\n`;
    fs.writeFileSync(path.join(config.projectPath, 'README.md'), content, 'utf-8');
    files.push('README.md');
  }

  if (config.extras.license) {
    const licenseContent = getLicenseTemplate(
      config.extras.license,
      'Your Name',
      new Date().getFullYear()
    );
    if (licenseContent) {
      fs.writeFileSync(path.join(config.projectPath, 'LICENSE'), licenseContent, 'utf-8');
      files.push('LICENSE');
    }
  }

  return files;
}

export async function scaffold(config: ScaffoldConfig): Promise<ScaffoldResult> {
  const filesCreated: string[] = [];
  const warnings: string[] = [];

  try {
    log.info(`Scaffolding ${config.ecosystem} project: ${config.projectName}`);

    // Run scaffold command
    const cmd = getScaffoldCommand(config);

    if (config.ecosystem === 'go' && !config.isMonorepo) {
      await createDirectoryStructure(config);
      const goFiles = await scaffoldGo(config);
      filesCreated.push(...goFiles);
    } else if (config.isMonorepo && !cmd) {
      await createDirectoryStructure(config);
      const monoFiles = await scaffoldMonorepoManual(config);
      filesCreated.push(...monoFiles);
    } else if (cmd) {
      // CLI scaffold tools (create-nx-workspace, create-turbo, create-vite, etc.)
      // create the directory themselves — do NOT pre-create it
      try {
        await runCommand(cmd);
        filesCreated.push('(scaffold output)');
      } catch (error) {
        // Ensure directory exists for extras even if scaffold failed
        await createDirectoryStructure(config);
        warnings.push(`Scaffold command failed: ${error}. Created directory only.`);
        log.warn(`Scaffold command failed for ${config.projectName}:`, error);
      }
    } else {
      // No scaffold command — create basic structure manually
      await createDirectoryStructure(config);
      if (config.ecosystem === 'node') {
        const pkgJson = JSON.stringify(
          {
            name: config.projectName,
            version: '0.1.0',
            private: true,
            scripts: { test: 'echo "Error: no test specified" && exit 1' },
          },
          null,
          2
        );
        fs.writeFileSync(path.join(config.projectPath, 'package.json'), pkgJson, 'utf-8');
        filesCreated.push('package.json');
      } else if (config.ecosystem === 'python') {
        fs.mkdirSync(path.join(config.projectPath, 'src'), { recursive: true });
        fs.writeFileSync(path.join(config.projectPath, 'src', '__init__.py'), '', 'utf-8');
        filesCreated.push('src/__init__.py');
      }
    }

    // Write extras
    const extraFiles = writeExtras(config);
    filesCreated.push(...extraFiles);

    log.info(`Scaffold complete: ${filesCreated.length} files created`);

    return {
      success: true,
      message: `Project ${config.projectName} scaffolded successfully`,
      filesCreated,
      warnings,
    };
  } catch (error) {
    log.error('Scaffold failed:', error);
    return {
      success: false,
      message: `Scaffold failed: ${error}`,
      filesCreated,
      warnings,
    };
  }
}

export const projectScaffoldService = {
  scaffold,
};
