/**
 * PackageManagerService
 *
 * Provides package-manager-specific command resolution and metadata retrieval.
 * Supports npm, yarn, pnpm, and bun for the Node ecosystem.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { PackageManager } from '../ipc/channels/types';

export interface PMInfo {
  name: string;
  version: string | null;
  lockFile: string | null;
  registry: string | null;
}

const LOCKFILE_MAP: Partial<Record<PackageManager, string>> = {
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
  bun: 'bun.lockb',
  pip: 'requirements.txt',
  poetry: 'poetry.lock',
  uv: 'uv.lock',
  cargo: 'Cargo.lock',
  go: 'go.sum',
  bundler: 'Gemfile.lock',
  composer: 'composer.lock',
  maven: 'pom.xml',
  gradle: 'gradle.lockfile',
};

export class PackageManagerService {
  getInitCommand(pm: PackageManager): string | null {
    switch (pm) {
      case 'npm':
        return 'npm init -y';
      case 'yarn':
        return 'yarn init -y';
      case 'pnpm':
        return 'pnpm init';
      case 'bun':
        return 'bun init';
      case 'poetry':
        return 'poetry init --no-interaction';
      case 'cargo':
        return 'cargo init';
      case 'go':
        return 'go mod init';
      default:
        return null;
    }
  }

  getDedupeCommand(pm: PackageManager): string | null {
    switch (pm) {
      case 'npm':
        return 'npm dedupe';
      case 'yarn':
        return 'yarn dedupe';
      case 'pnpm':
        return 'pnpm dedupe';
      default:
        return null;
    }
  }

  getLockRefreshCommand(pm: PackageManager): string | null {
    const lockfile = LOCKFILE_MAP[pm];
    if (!lockfile) return null;

    switch (pm) {
      case 'npm':
        return 'rm -f package-lock.json && npm install';
      case 'yarn':
        return 'rm -f yarn.lock && yarn install';
      case 'pnpm':
        return 'rm -f pnpm-lock.yaml && pnpm install';
      case 'bun':
        return 'rm -f bun.lockb && bun install';
      default:
        return null;
    }
  }

  getRegistryCommand(pm: PackageManager): string | null {
    switch (pm) {
      case 'npm':
        return 'npm config get registry';
      case 'yarn':
        return 'yarn config get registry';
      case 'pnpm':
        return 'pnpm config get registry';
      case 'bun':
        return 'bun pm registry';
      default:
        return null;
    }
  }

  getCommands(pm: PackageManager): Record<string, string | null> {
    return {
      init: this.getInitCommand(pm),
      dedupe: this.getDedupeCommand(pm),
      lockRefresh: this.getLockRefreshCommand(pm),
      registry: this.getRegistryCommand(pm),
    };
  }

  async getInfo(workingDirectory: string, pm: PackageManager): Promise<PMInfo> {
    let version: string | null = null;
    let registry: string | null = null;

    // Get PM version
    try {
      version = execSync(`${pm} --version`, {
        cwd: workingDirectory,
        timeout: 5000,
        encoding: 'utf-8',
      }).trim();
    } catch {
      // PM not installed or not available
    }

    // Get registry (Node PMs only)
    const registryCmd = this.getRegistryCommand(pm);
    if (registryCmd) {
      try {
        registry = execSync(registryCmd, {
          cwd: workingDirectory,
          timeout: 5000,
          encoding: 'utf-8',
        }).trim();
      } catch {
        // Registry lookup failed
      }
    }

    // Find lockfile
    const lockFileName = LOCKFILE_MAP[pm] ?? null;
    let lockFile: string | null = null;
    if (lockFileName) {
      const lockPath = path.join(workingDirectory, lockFileName);
      if (fs.existsSync(lockPath)) {
        lockFile = lockFileName;
      }
    }

    return {
      name: pm,
      version,
      lockFile,
      registry,
    };
  }
}

export const packageManagerService = new PackageManagerService();
