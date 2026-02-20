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
