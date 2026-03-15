/**
 * Code Server — Path mapping and port utilities
 *
 * Standalone functions for port allocation, Docker path conversion,
 * persistent storage paths, and host-to-container path mapping.
 */
import { app } from 'electron';
import * as net from 'net';
import * as path from 'path';
import { database } from '../../database/database.service';
import type { WorkspaceBasePaths } from './types';
import { WORKSPACE_MOUNTS } from './types';

// ── Port Management ──────────────────────────────────────────────

export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Failed to get port from server address')));
      }
    });
    server.on('error', reject);
  });
}

/**
 * Validate that a port is truly available for binding.
 * This double-checks availability after findFreePort() to handle race conditions.
 */
export async function validatePortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find a free port with retry logic to handle Windows Hyper-V port conflicts
 * and race conditions between port discovery and Docker binding.
 */
export async function findFreePortWithRetry(
  maxRetries = 5,
  excludePorts: number[] = []
): Promise<number> {
  const attemptedPorts: number[] = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const port = await findFreePort();

    if (excludePorts.includes(port) || attemptedPorts.includes(port)) {
      continue;
    }

    attemptedPorts.push(port);

    // Double-check port is still available (handles race conditions)
    const isAvailable = await validatePortAvailable(port);
    if (isAvailable) {
      return port;
    }

    // Small delay before retry to allow port release
    await new Promise((r) => setTimeout(r, 100));
  }

  throw new Error(
    `Failed to find available port after ${maxRetries} attempts. ` +
      'This may be caused by Windows Hyper-V port reservations or another process. ' +
      'Try restarting Docker Desktop or run: netsh interface ipv4 show excludedportrange protocol=tcp'
  );
}

// ── Persistent Storage Paths ─────────────────────────────────────

export function getUserDataDir(): string {
  return path.join(app.getPath('userData'), 'code-server');
}

export function getExtensionsDir(): string {
  return path.join(getUserDataDir(), 'extensions');
}

// ── Docker Path Conversion ───────────────────────────────────────

export function toDockerPath(hostPath: string): string {
  if (process.platform === 'win32') {
    return hostPath
      .replace(/\\/g, '/')
      .replace(/^([A-Za-z]):/, (_match, drive: string) => `/${drive.toLowerCase()}`);
  }
  return hostPath;
}

// ── Workspace Path Mapping ───────────────────────────────────────

export function loadWorkspaceBasePaths(): WorkspaceBasePaths {
  return {
    contributions: database.getSetting('defaultClonePath') || null,
    myProjects: database.getSetting('defaultProjectsPath') || null,
    professional: database.getSetting('defaultProfessionalProjectsPath') || null,
  };
}

export function getWorkspaceCategory(
  hostPath: string,
  paths: WorkspaceBasePaths
): 'contributions' | 'my-projects' | 'professional' | null {
  const normalize = (p: string): string => {
    const normalized = p.replace(/\\/g, '/');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  };

  const normalizedHostPath = normalize(hostPath);

  if (paths.contributions) {
    const base = normalize(paths.contributions);
    if (normalizedHostPath.startsWith(base + '/') || normalizedHostPath === base) {
      return 'contributions';
    }
  }

  if (paths.myProjects) {
    const base = normalize(paths.myProjects);
    if (normalizedHostPath.startsWith(base + '/') || normalizedHostPath === base) {
      return 'my-projects';
    }
  }

  if (paths.professional) {
    const base = normalize(paths.professional);
    if (normalizedHostPath.startsWith(base + '/') || normalizedHostPath === base) {
      return 'professional';
    }
  }

  return null;
}

export function hostToContainerPath(
  hostPath: string,
  workspaceBasePaths: WorkspaceBasePaths
): string | null {
  const category = getWorkspaceCategory(hostPath, workspaceBasePaths);
  if (!category) return null;

  const basePath =
    category === 'contributions'
      ? workspaceBasePaths.contributions
      : category === 'my-projects'
        ? workspaceBasePaths.myProjects
        : workspaceBasePaths.professional;

  if (!basePath) return null;

  const normalize = (p: string): string => p.replace(/\\/g, '/');
  const normalizedHostPath = normalize(hostPath);
  const normalizedBasePath = normalize(basePath);

  let relativePath = '';
  if (normalizedHostPath.length > normalizedBasePath.length) {
    relativePath = normalizedHostPath.slice(normalizedBasePath.length);
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath;
    }
  }

  const containerBase = WORKSPACE_MOUNTS[category];
  return containerBase + relativePath;
}

// ── Memory Parsing ───────────────────────────────────────────────

export function parseMemoryString(mem: string): number {
  const match = mem.match(/^(\d+(?:\.\d+)?)\s*([bkmg]?)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'k':
      return Math.round(value * 1024);
    case 'm':
      return Math.round(value * 1024 * 1024);
    case 'g':
      return Math.round(value * 1024 * 1024 * 1024);
    case 'b':
    case '':
      return Math.round(value);
    default:
      return Math.round(value);
  }
}
