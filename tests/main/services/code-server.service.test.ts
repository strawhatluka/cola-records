// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Top-level mock functions for fs
const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '');
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  };
});

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

// Mock child_process with proper default export
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

// Mock util.promisify to return our mock
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: () => (...args: unknown[]) => {
      const dockerArgs = args[1] as string[];
      return Promise.resolve({ stdout: `mock-output-${dockerArgs?.[0] || ''}`, stderr: '' });
    },
  };
});

// Mock database
vi.mock('../../../src/main/database/database.service', () => ({
  database: {
    getSetting: vi.fn(() => null),
  },
}));

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
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(false);

      codeServerService.syncVSCodeSettings();

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        expect(settings['security.workspace.trust.enabled']).toBe(false);
        expect(settings['git.enabled']).toBe(true);
      }
    });

    it('merges existing code-server settings on top of host settings', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(true);

      let callCount = 0;
      mockReadFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return JSON.stringify({ 'editor.fontSize': 14, 'workbench.colorTheme': 'One Dark' });
        }
        return JSON.stringify({ 'workbench.colorTheme': 'Monokai', 'editor.tabSize': 4 });
      });

      codeServerService.syncVSCodeSettings();

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        expect(settings['workbench.colorTheme']).toBe('Monokai');
        expect(settings['editor.fontSize']).toBe(14);
        expect(settings['editor.tabSize']).toBe(4);
      }
    });
  });

  describe('createContainerGitConfig', () => {
    it('creates gitconfig with safe directory and credential helper', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(false);

      codeServerService.createContainerGitConfig();

      expect(mockWriteFileSync).toHaveBeenCalled();
      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
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
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
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
      mockExistsSync.mockReturnValue(false);
      const mounts = codeServerService.getGitMounts();
      expect(mounts).toEqual([]);
    });

    it('returns mount args when credentials exist', () => {
      mockExistsSync.mockReturnValue(true);
      const mounts = codeServerService.getGitMounts();
      expect(mounts).toContain('-v');
      expect(mounts.some(m => m.includes('.git-credentials'))).toBe(true);
    });
  });

  describe('getClaudeMounts', () => {
    it('returns empty when no Claude files exist', () => {
      mockExistsSync.mockReturnValue(false);
      const mounts = codeServerService.getClaudeMounts();
      expect(mounts).toEqual([]);
    });

    it('mounts claude.json and .claude dir when they exist', () => {
      mockExistsSync.mockReturnValue(true);
      const mounts = codeServerService.getClaudeMounts();
      expect(mounts.some(m => m.includes('.claude.json'))).toBe(true);
      expect(mounts.some(m => m.includes('.claude'))).toBe(true);
    });
  });

  describe('stop', () => {
    it('handles stop when no container is running', async () => {
      await codeServerService.stop();
    });
  });

  describe('checkDockerAvailable', () => {
    it('resolves when docker info succeeds', async () => {
      // Default mock returns successful output
      await expect(codeServerService.checkDockerAvailable()).resolves.toBeUndefined();
    });
  });

  describe('dockerExec', () => {
    it('returns trimmed stdout from docker command', async () => {
      const result = await codeServerService.dockerExec(['info']);
      expect(typeof result).toBe('string');
      expect(result).toContain('mock-output');
    });
  });
});
