/**
 * CLI Detection Service
 *
 * Detects installed CLI tools and their versions for project scaffolding
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../utils/logger';
import type { Ecosystem, ToolDetectionResult, ToolInstallResult } from '../ipc/channels/types';

const log = createLogger('cli-detection');
const execFileAsync = promisify(execFile);

const ECOSYSTEM_TOOLS: Record<string, { tools: string[]; required: string[] }> = {
  node: {
    tools: ['node', 'npm', 'npx', 'yarn', 'pnpm', 'bun'],
    required: ['node', 'npm'],
  },
  python: {
    tools: ['python3', 'python', 'pip', 'pip3', 'poetry', 'uv'],
    required: ['python3', 'pip'],
  },
  rust: {
    tools: ['rustc', 'cargo'],
    required: ['rustc', 'cargo'],
  },
  go: {
    tools: ['go'],
    required: ['go'],
  },
  ruby: {
    tools: ['ruby', 'bundler', 'rails', 'gem'],
    required: ['ruby'],
  },
  php: {
    tools: ['php', 'composer'],
    required: ['php', 'composer'],
  },
  java: {
    tools: ['java', 'javac', 'mvn', 'gradle'],
    required: ['java'],
  },
};

const MONOREPO_TOOLS: Record<string, string[]> = {
  turborepo: ['turbo'],
  nx: ['nx'],
  'pnpm-workspaces': ['pnpm'],
  'cargo-workspaces': ['cargo'],
  'go-workspaces': ['go'],
  'uv-workspaces': ['uv'],
};

const TOOL_INSTALL_COMMANDS: Record<string, { cmd: string; args: string[] }> = {
  bun: { cmd: 'npm', args: ['install', '-g', 'bun'] },
  pnpm: { cmd: 'npm', args: ['install', '-g', 'pnpm'] },
  yarn: { cmd: 'npm', args: ['install', '-g', 'yarn'] },
  uv: { cmd: 'pip', args: ['install', 'uv'] },
  poetry: { cmd: 'pip', args: ['install', 'poetry'] },
  turbo: { cmd: 'npm', args: ['install', '-g', 'turbo'] },
  nx: { cmd: 'npm', args: ['install', '-g', 'nx'] },
};

function getWhichCommand(): string {
  return process.platform === 'win32' ? 'where' : 'which';
}

function execShellSafe(
  cmd: string,
  args: string[],
  opts: { timeout?: number; cwd?: string } = {}
): ReturnType<typeof execFileAsync> {
  if (process.platform === 'win32') {
    const fullCommand = `${cmd} ${args.join(' ')}`;
    return execFileAsync(fullCommand, [], { ...opts, shell: true });
  }
  return execFileAsync(cmd, args, opts);
}

export async function detectTool(name: string): Promise<ToolDetectionResult> {
  const whichCmd = getWhichCommand();
  try {
    const { stdout } = await execShellSafe(whichCmd, [name], { timeout: 5000 });
    const toolPath = String(stdout).trim().split('\n')[0];

    let version: string | undefined;
    try {
      const { stdout: versionOut } = await execShellSafe(name, ['--version'], { timeout: 5000 });
      const match = String(versionOut)
        .trim()
        .match(/(\d+\.\d+[\d.]*)/);
      version = match ? match[1] : undefined;
    } catch {
      // Version detection is best-effort
    }

    return { name, installed: true, version, path: toolPath, required: false };
  } catch {
    return { name, installed: false, required: false };
  }
}

export function getInstallCommand(toolName: string): string | null {
  const info = TOOL_INSTALL_COMMANDS[toolName];
  if (!info) return null;
  return `${info.cmd} ${info.args.join(' ')}`;
}

export async function installTool(toolName: string): Promise<ToolInstallResult> {
  const installInfo = TOOL_INSTALL_COMMANDS[toolName];
  if (!installInfo) {
    return { success: false, message: `No install command known for '${toolName}'` };
  }

  log.info(`Installing tool: ${toolName}`, {
    cmd: `${installInfo.cmd} ${installInfo.args.join(' ')}`,
  });

  try {
    await execShellSafe(installInfo.cmd, installInfo.args, { timeout: 120000 });

    const result = await detectTool(toolName);
    if (result.installed) {
      log.info(`Tool installed successfully: ${toolName}`, { version: result.version });
      return {
        success: true,
        message: `${toolName} installed successfully`,
        version: result.version,
      };
    }

    return {
      success: false,
      message: `Install command ran but ${toolName} was not detected on PATH. You may need to restart the application.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error(`Failed to install ${toolName}:`, msg);
    return { success: false, message: `Install failed: ${msg}` };
  }
}

export async function detectEcosystemTools(
  ecosystem: Ecosystem,
  isMonorepo: boolean = false,
  monorepoTool?: string
): Promise<ToolDetectionResult[]> {
  const config = ECOSYSTEM_TOOLS[ecosystem];
  if (!config) {
    log.warn(`Unknown ecosystem: ${ecosystem}`);
    return [];
  }

  const toolNames = [...config.tools];

  if (isMonorepo && monorepoTool && MONOREPO_TOOLS[monorepoTool]) {
    for (const t of MONOREPO_TOOLS[monorepoTool]) {
      if (!toolNames.includes(t)) {
        toolNames.push(t);
      }
    }
  }

  const results = await Promise.all(toolNames.map((t) => detectTool(t)));

  for (const result of results) {
    result.required = config.required.includes(result.name);
  }

  return results;
}

export const cliDetectionService = {
  detectTool,
  detectEcosystemTools,
  installTool,
  getInstallCommand,
};
