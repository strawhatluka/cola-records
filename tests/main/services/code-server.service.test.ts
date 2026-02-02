import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as net from 'net';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

// Mock child_process
const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock util.promisify to return our mock
vi.mock('util', () => ({
  promisify: () => (...args: unknown[]) => {
    // Return a promise from our mock
    const dockerArgs = args[1] as string[];
    return Promise.resolve({ stdout: `mock-output-${dockerArgs?.[0] || ''}`, stderr: '' });
  },
}));

// Mock database
vi.mock('../../../src/main/database/database.service', () => ({
  database: {
    getSetting: vi.fn(() => null),
  },
}));

// We need to re-import after mocks are set up
// But since code-server.service uses promisify at module level,
// let's test the pure methods directly

import { codeServerService } from '../../../src/main/services/code-server.service';

describe('CodeServerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toDockerPath', () => {
    it('converts Windows paths to Docker format', () => {
      // Save original platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const result = codeServerService.toDockerPath('C:\\Users\\test\\project');
      expect(result).toBe('/c/Users/test/project');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('returns path as-is on non-Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const result = codeServerService.toDockerPath('/home/user/project');
      expect(result).toBe('/home/user/project');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('getUserDataDir', () => {
    it('returns path under userData', () => {
      const dir = codeServerService.getUserDataDir();
      expect(dir).toContain('code-server');
    });
  });

  describe('getExtensionsDir', () => {
    it('returns path under userData/code-server/extensions', () => {
      const dir = codeServerService.getExtensionsDir();
      expect(dir).toContain('extensions');
      expect(dir).toContain('code-server');
    });
  });

  describe('getStatus', () => {
    it('returns initial status as not running', () => {
      const status = codeServerService.getStatus();
      expect(status.running).toBe(false);
      expect(status.port).toBeNull();
      expect(status.url).toBeNull();
    });
  });

  describe('getContainerName', () => {
    it('returns null when no container is running', () => {
      expect(codeServerService.getContainerName()).toBeNull();
    });
  });

  describe('findFreePort', () => {
    it('finds an available port', async () => {
      const port = await codeServerService.findFreePort();
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
    });
  });

  describe('syncVSCodeSettings', () => {
    it('creates settings directory and writes merged settings', () => {
      const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      codeServerService.syncVSCodeSettings();

      expect(mkdirSpy).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalled();

      // Verify required overrides are in the written settings
      const writtenContent = writeSpy.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        expect(settings['security.workspace.trust.enabled']).toBe(false);
        expect(settings['git.enabled']).toBe(true);
      }
    });

    it('merges existing code-server settings on top of host settings', () => {
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      let callCount = 0;
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Host settings
          return JSON.stringify({ 'editor.fontSize': 14, 'workbench.colorTheme': 'One Dark' });
        }
        // Existing code-server settings (user changed theme inside)
        return JSON.stringify({ 'workbench.colorTheme': 'Monokai', 'editor.tabSize': 4 });
      });

      codeServerService.syncVSCodeSettings();

      const writtenContent = writeSpy.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        // Existing code-server theme should override host
        expect(settings['workbench.colorTheme']).toBe('Monokai');
        // Host setting preserved
        expect(settings['editor.fontSize']).toBe(14);
        // Code-server setting preserved
        expect(settings['editor.tabSize']).toBe(4);
      }
    });
  });

  describe('createContainerGitConfig', () => {
    it('creates gitconfig with safe directory and credential helper', () => {
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      codeServerService.createContainerGitConfig();

      expect(writeSpy).toHaveBeenCalled();
      const content = writeSpy.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('[safe]');
        expect(content).toContain('directory = *');
        expect(content).toContain('[credential]');
        expect(content).toContain('helper = store');
      }
    });
  });

  describe('createContainerBashrc', () => {
    it('creates bashrc with default aliases', () => {
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      codeServerService.createContainerBashrc('/test/project');

      const content = writeSpy.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('alias ll=');
        expect(content).toContain('alias gs=');
        expect(content).toContain('alias gd=');
        expect(content).toContain('alias gl=');
        expect(content).toContain('__git_branch');
      }
    });
  });

  describe('getGitMounts', () => {
    it('returns empty when no credentials file', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mounts = codeServerService.getGitMounts();
      expect(mounts).toEqual([]);
    });

    it('returns mount args when credentials exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const mounts = codeServerService.getGitMounts();
      expect(mounts).toContain('-v');
      expect(mounts.some(m => m.includes('.git-credentials'))).toBe(true);
    });
  });

  describe('getClaudeMounts', () => {
    it('returns empty when no Claude files exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mounts = codeServerService.getClaudeMounts();
      expect(mounts).toEqual([]);
    });

    it('mounts claude.json and .claude dir when they exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const mounts = codeServerService.getClaudeMounts();
      expect(mounts.some(m => m.includes('.claude.json'))).toBe(true);
      expect(mounts.some(m => m.includes('.claude'))).toBe(true);
    });
  });

  describe('stop', () => {
    it('handles stop when no container is running', async () => {
      // Should not throw
      await codeServerService.stop();
    });
  });
});
