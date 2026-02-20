/**
 * Code Server — Docker operations
 *
 * Standalone functions for Docker CLI execution, image management,
 * container lifecycle, health checks, and container stats.
 */
import { app } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { database } from '../../database/database.service';
import type { CodeServerConfig } from '../../ipc/channels';
import type { CodeServerStats } from './types';
import { DEFAULT_CODE_SERVER_CONFIG } from './types';
import { parseMemoryString } from './path-mapper';

const execFileAsync = promisify(execFile);

// ── Docker CLI Execution ─────────────────────────────────────────

export async function dockerExec(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('docker', args, {
    timeout: 120_000,
  });
  return stdout.trim();
}

// ── Config Helpers ───────────────────────────────────────────────

export function getCodeServerConfig(): CodeServerConfig {
  try {
    const raw = database.getSetting('codeServerConfig');
    if (raw) {
      return { ...DEFAULT_CODE_SERVER_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // Malformed JSON — use defaults
  }
  return { ...DEFAULT_CODE_SERVER_CONFIG };
}

/** Default container name for persistence across sessions */
const CONTAINER_NAME_DEFAULT = 'cola-code-server';

export function getContainerName(): string {
  let baseName = CONTAINER_NAME_DEFAULT;
  try {
    const raw = database.getSetting('codeServerConfig');
    if (raw) {
      const config = JSON.parse(raw);
      if (config.containerName && typeof config.containerName === 'string') {
        baseName = config.containerName;
      }
    }
  } catch {
    // Use default on parse error
  }
  return app.isPackaged ? baseName : `${baseName}-dev`;
}

// ── Docker Availability ──────────────────────────────────────────

export async function checkDockerAvailable(autoStart = true): Promise<void> {
  try {
    await dockerExec(['info', '--format', '{{.ServerVersion}}']);
    return;
  } catch {
    // Docker not available yet
  }

  if (!autoStart) {
    throw new Error(
      'Docker Desktop is not running. Auto-start is disabled in Code Server settings.\n\n' +
        'Please start Docker Desktop manually and try again.'
    );
  }

  console.log('[CodeServer] Docker not running, attempting to start Docker Desktop...');
  await launchDockerDesktop();

  const maxAttempts = 30;
  const delay = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await dockerExec(['info', '--format', '{{.ServerVersion}}']);
      console.log(`[CodeServer] Docker became available after ${attempt * 2} seconds`);
      return;
    } catch {
      // Still not ready
    }
  }

  throw new Error(
    'Docker Desktop is not running. Please start Docker Desktop and try again.\n\n' +
      'If Docker is not installed, download it from: https://www.docker.com/products/docker-desktop/'
  );
}

async function launchDockerDesktop(): Promise<void> {
  try {
    switch (process.platform) {
      case 'darwin':
        await execFileAsync('open', ['-a', 'Docker']);
        break;
      case 'win32': {
        const programFiles = process.env.ProgramW6432 || 'C:\\Program Files';
        await execFileAsync(path.join(programFiles, 'Docker', 'Docker', 'Docker Desktop.exe'), []);
        break;
      }
      default:
        await execFileAsync('systemctl', ['--user', 'start', 'docker-desktop']);
        break;
    }
  } catch {
    // Launch attempt is best-effort
  }
}

// ── Health Check ─────────────────────────────────────────────────

export async function waitForReady(port: number, timeoutSeconds?: number): Promise<void> {
  const config = getCodeServerConfig();
  const maxAttempts = timeoutSeconds ?? config.healthCheckTimeout;
  const delay = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        redirect: 'manual',
      });
      if (response.status > 0) {
        return;
      }
    } catch {
      // Connection refused — container not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`code-server did not become ready within ${maxAttempts} seconds`);
}

// ── Container Stats ──────────────────────────────────────────────

export async function getContainerStats(): Promise<CodeServerStats | null> {
  try {
    const containerName = getContainerName();
    const output = await dockerExec([
      'stats',
      '--no-stream',
      '--format',
      '{{json .}}',
      containerName,
    ]);

    if (!output) return null;

    const stats = JSON.parse(output);
    const cpuPercent = parseFloat(String(stats.CPUPerc).replace('%', ''));
    const memPercent = parseFloat(String(stats.MemPerc).replace('%', ''));
    const memParts = String(stats.MemUsage)
      .split('/')
      .map((s: string) => s.trim());

    return {
      cpuPercent: isNaN(cpuPercent) ? 0 : cpuPercent,
      memUsage: memParts[0] || '0B',
      memLimit: memParts[1] || '0B',
      memPercent: isNaN(memPercent) ? 0 : memPercent,
    };
  } catch {
    return null;
  }
}

// ── Container State Inspection ───────────────────────────────────

export async function getContainerState(): Promise<'running' | 'stopped' | 'none'> {
  try {
    const result = await dockerExec([
      'inspect',
      '--format',
      '{{.State.Running}}',
      getContainerName(),
    ]);
    return result.trim() === 'true' ? 'running' : 'stopped';
  } catch {
    return 'none';
  }
}

export async function hasMultiMountConfiguration(): Promise<boolean> {
  try {
    const result = await dockerExec([
      'inspect',
      '--format',
      '{{range .Mounts}}{{.Destination}} {{end}}',
      getContainerName(),
    ]);
    return result.includes('/config/workspaces');
  } catch {
    return false;
  }
}

export async function getContainerPort(): Promise<number | null> {
  try {
    const result = await dockerExec([
      'inspect',
      '--format',
      '{{(index (index .NetworkSettings.Ports "8443/tcp") 0).HostPort}}',
      getContainerName(),
    ]);
    const port = parseInt(result.trim(), 10);
    return isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

export async function getContainerWorkspacePath(): Promise<string | null> {
  try {
    const result = await dockerExec([
      'inspect',
      '--format',
      '{{range .Mounts}}{{if eq .Destination "/config/workspace"}}{{.Source}}{{end}}{{end}}',
      getContainerName(),
    ]);
    const mountPath = result.trim();
    return mountPath || null;
  } catch {
    return null;
  }
}

export async function hasResourceConfigChanged(config: CodeServerConfig): Promise<boolean> {
  try {
    const result = await dockerExec([
      'inspect',
      '--format',
      '{{.HostConfig.NanoCpus}} {{.HostConfig.Memory}} {{.HostConfig.ShmSize}}',
      getContainerName(),
    ]);
    const parts = result.trim().split(/\s+/);
    const containerNanoCpus = parseInt(parts[0], 10) || 0;
    const containerMemory = parseInt(parts[1], 10) || 0;
    const containerShmSize = parseInt(parts[2], 10) || 0;

    const expectedNanoCpus = config.cpuLimit !== null ? config.cpuLimit * 1e9 : 0;
    const expectedMemory = config.memoryLimit !== null ? parseMemoryString(config.memoryLimit) : 0;
    const expectedShmSize = parseMemoryString(config.shmSize);

    if (containerNanoCpus !== expectedNanoCpus) {
      console.log(
        `[CodeServer] CPU config changed: container=${containerNanoCpus} expected=${expectedNanoCpus}`
      );
      return true;
    }
    if (containerMemory !== expectedMemory) {
      console.log(
        `[CodeServer] Memory config changed: container=${containerMemory} expected=${expectedMemory}`
      );
      return true;
    }
    if (containerShmSize !== expectedShmSize) {
      console.log(
        `[CodeServer] SHM config changed: container=${containerShmSize} expected=${expectedShmSize}`
      );
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function removeContainer(): Promise<void> {
  try {
    await dockerExec(['rm', '-f', getContainerName()]);
    console.log('[CodeServer] Removed container for recreation');
  } catch {
    // Container may not exist
  }
}

// ── Extension Management ─────────────────────────────────────────

export async function installExtensions(extensionIds: string[]): Promise<void> {
  const containerName = getContainerName();
  for (const extId of extensionIds) {
    try {
      console.log(`[CodeServer] Installing extension: ${extId}`);
      await dockerExec(['exec', containerName, 'code-server', '--install-extension', extId]);
    } catch (err) {
      console.error(`[CodeServer] Failed to install extension ${extId}:`, err);
    }
  }
}

// ── Image Management ─────────────────────────────────────────────

function getDockerfilePath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(app.getAppPath(), 'docker', 'code-server');
  }
  return path.join(process.resourcesPath, 'docker', 'code-server');
}

export async function ensureImageExists(): Promise<void> {
  const imageName = 'cola-code-server:latest';

  try {
    const images = await dockerExec(['images', '-q', imageName]);
    if (images.trim()) {
      console.log('[CodeServer] Image cola-code-server:latest already exists');
      return;
    }
  } catch {
    // Error checking images - proceed to build
  }

  console.log('[CodeServer] Building cola-code-server image (this may take a few minutes)...');

  const dockerfilePath = getDockerfilePath();

  try {
    const { stdout } = await execFileAsync('docker', ['build', '-t', imageName, dockerfilePath], {
      timeout: 600_000,
    });
    console.log('[CodeServer] Image build output:', stdout);
    console.log('[CodeServer] Image cola-code-server:latest built successfully');
  } catch (err) {
    console.error('[CodeServer] Failed to build image:', err);
    throw new Error(
      'Failed to build cola-code-server Docker image. Please check Docker is running and try again.\n\n' +
        `Dockerfile location: ${dockerfilePath}`
    );
  }
}

// ── SSH Permissions ──────────────────────────────────────────────

export async function fixSSHPermissions(): Promise<void> {
  try {
    await dockerExec([
      'exec',
      getContainerName(),
      'sh',
      '-c',
      'if [ -d /config/.ssh ]; then chown -R abc:abc /config/.ssh && chmod 700 /config/.ssh && chmod 600 /config/.ssh/config 2>/dev/null; chmod 700 /config/.ssh/keys 2>/dev/null; chmod 600 /config/.ssh/keys/* 2>/dev/null; fi',
    ]);
  } catch {
    // SSH permission fix is best-effort
  }
}
