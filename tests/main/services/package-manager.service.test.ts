// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process — preserve default export to avoid "No default export" error
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { PackageManagerService } from '../../../src/main/services/package-manager.service';
import { execSync } from 'child_process';
import * as fs from 'fs';

const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(fs.existsSync);

describe('PackageManagerService', () => {
  let service: PackageManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PackageManagerService();
  });

  describe('getInitCommand', () => {
    it('returns "npm init -y" for npm', () => {
      expect(service.getInitCommand('npm')).toBe('npm init -y');
    });

    it('returns "yarn init -y" for yarn', () => {
      expect(service.getInitCommand('yarn')).toBe('yarn init -y');
    });

    it('returns "pnpm init" for pnpm', () => {
      expect(service.getInitCommand('pnpm')).toBe('pnpm init');
    });

    it('returns "bun init" for bun', () => {
      expect(service.getInitCommand('bun')).toBe('bun init');
    });

    it('returns "poetry init --no-interaction" for poetry', () => {
      expect(service.getInitCommand('poetry')).toBe('poetry init --no-interaction');
    });

    it('returns "cargo init" for cargo', () => {
      expect(service.getInitCommand('cargo')).toBe('cargo init');
    });

    it('returns "go mod init" for go', () => {
      expect(service.getInitCommand('go')).toBe('go mod init');
    });

    it('returns null for unknown PM', () => {
      expect(service.getInitCommand('unknown')).toBeNull();
    });

    it('returns null for pip', () => {
      expect(service.getInitCommand('pip')).toBeNull();
    });
  });

  describe('getDedupeCommand', () => {
    it('returns "npm dedupe" for npm', () => {
      expect(service.getDedupeCommand('npm')).toBe('npm dedupe');
    });

    it('returns "yarn dedupe" for yarn', () => {
      expect(service.getDedupeCommand('yarn')).toBe('yarn dedupe');
    });

    it('returns "pnpm dedupe" for pnpm', () => {
      expect(service.getDedupeCommand('pnpm')).toBe('pnpm dedupe');
    });

    it('returns null for bun', () => {
      expect(service.getDedupeCommand('bun')).toBeNull();
    });

    it('returns null for non-Node PMs', () => {
      expect(service.getDedupeCommand('cargo')).toBeNull();
      expect(service.getDedupeCommand('go')).toBeNull();
      expect(service.getDedupeCommand('unknown')).toBeNull();
    });
  });

  describe('getLockRefreshCommand', () => {
    it('returns correct command for npm', () => {
      expect(service.getLockRefreshCommand('npm')).toBe('rm -f package-lock.json && npm install');
    });

    it('returns correct command for yarn', () => {
      expect(service.getLockRefreshCommand('yarn')).toBe('rm -f yarn.lock && yarn install');
    });

    it('returns correct command for pnpm', () => {
      expect(service.getLockRefreshCommand('pnpm')).toBe('rm -f pnpm-lock.yaml && pnpm install');
    });

    it('returns correct command for bun', () => {
      expect(service.getLockRefreshCommand('bun')).toBe('rm -f bun.lockb && bun install');
    });

    it('returns null for unknown PM', () => {
      expect(service.getLockRefreshCommand('unknown')).toBeNull();
    });

    it('returns null for PMs without lockfile-based refresh', () => {
      expect(service.getLockRefreshCommand('go')).toBeNull();
      expect(service.getLockRefreshCommand('cargo')).toBeNull();
    });
  });

  describe('getRegistryCommand', () => {
    it('returns "npm config get registry" for npm', () => {
      expect(service.getRegistryCommand('npm')).toBe('npm config get registry');
    });

    it('returns "yarn config get registry" for yarn', () => {
      expect(service.getRegistryCommand('yarn')).toBe('yarn config get registry');
    });

    it('returns "pnpm config get registry" for pnpm', () => {
      expect(service.getRegistryCommand('pnpm')).toBe('pnpm config get registry');
    });

    it('returns "bun pm registry" for bun', () => {
      expect(service.getRegistryCommand('bun')).toBe('bun pm registry');
    });

    it('returns null for non-Node PMs', () => {
      expect(service.getRegistryCommand('cargo')).toBeNull();
      expect(service.getRegistryCommand('unknown')).toBeNull();
    });
  });

  describe('getCommands', () => {
    it('returns all commands for npm', () => {
      const commands = service.getCommands('npm');
      expect(commands).toEqual({
        init: 'npm init -y',
        dedupe: 'npm dedupe',
        lockRefresh: 'rm -f package-lock.json && npm install',
        registry: 'npm config get registry',
      });
    });

    it('returns all commands for yarn', () => {
      const commands = service.getCommands('yarn');
      expect(commands.init).toBe('yarn init -y');
      expect(commands.dedupe).toBe('yarn dedupe');
      expect(commands.lockRefresh).toBe('rm -f yarn.lock && yarn install');
      expect(commands.registry).toBe('yarn config get registry');
    });

    it('returns null commands for unknown PM', () => {
      const commands = service.getCommands('unknown');
      expect(commands.init).toBeNull();
      expect(commands.dedupe).toBeNull();
      expect(commands.lockRefresh).toBeNull();
      expect(commands.registry).toBeNull();
    });
  });

  describe('getInfo', () => {
    it('returns full PM info when everything succeeds', async () => {
      mockExecSync
        .mockReturnValueOnce('10.2.4\n')
        .mockReturnValueOnce('https://registry.npmjs.org/\n');
      mockExistsSync.mockReturnValue(true);

      const info = await service.getInfo('/test/project', 'npm');

      expect(info).toEqual({
        name: 'npm',
        version: '10.2.4',
        lockFile: 'package-lock.json',
        registry: 'https://registry.npmjs.org/',
      });
    });

    it('returns null version when PM is not installed', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });
      mockExistsSync.mockReturnValue(false);

      const info = await service.getInfo('/test/project', 'npm');

      expect(info.name).toBe('npm');
      expect(info.version).toBeNull();
      expect(info.lockFile).toBeNull();
      expect(info.registry).toBeNull();
    });

    it('returns null lockFile when lockfile does not exist', async () => {
      mockExecSync
        .mockReturnValueOnce('10.0.0\n')
        .mockReturnValueOnce('https://registry.npmjs.org/\n');
      mockExistsSync.mockReturnValue(false);

      const info = await service.getInfo('/test/project', 'npm');

      expect(info.lockFile).toBeNull();
    });

    it('handles unknown PM gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const info = await service.getInfo('/test/project', 'unknown');

      expect(info).toEqual({
        name: 'unknown',
        version: null,
        lockFile: null,
        registry: null,
      });
    });

    it('returns info for pnpm with correct lockfile', async () => {
      mockExecSync
        .mockReturnValueOnce('8.15.0\n')
        .mockReturnValueOnce('https://registry.npmjs.org/\n');
      mockExistsSync.mockReturnValue(true);

      const info = await service.getInfo('/test/project', 'pnpm');

      expect(info.name).toBe('pnpm');
      expect(info.version).toBe('8.15.0');
      expect(info.lockFile).toBe('pnpm-lock.yaml');
    });

    it('handles registry lookup failure gracefully', async () => {
      mockExecSync.mockReturnValueOnce('10.0.0\n').mockImplementationOnce(() => {
        throw new Error('registry error');
      });
      mockExistsSync.mockReturnValue(true);

      const info = await service.getInfo('/test/project', 'npm');

      expect(info.version).toBe('10.0.0');
      expect(info.registry).toBeNull();
      expect(info.lockFile).toBe('package-lock.json');
    });
  });
});
