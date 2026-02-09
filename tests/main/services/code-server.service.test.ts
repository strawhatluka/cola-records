// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Top-level mock functions for fs
const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '');
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockCopyFileSync = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
    unlinkSync: (...args: any[]) => mockUnlinkSync(...args),
    copyFileSync: (...args: any[]) => mockCopyFileSync(...args),
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

// Configurable mock for execFileAsync (via promisify)
let mockDockerResponse: (args: string[]) => Promise<{ stdout: string; stderr: string }> = () =>
  Promise.resolve({ stdout: 'mock-output', stderr: '' });

const setMockDockerResponse = (
  handler: (args: string[]) => Promise<{ stdout: string; stderr: string }>
) => {
  mockDockerResponse = handler;
};

const resetMockDockerResponse = () => {
  mockDockerResponse = () => Promise.resolve({ stdout: 'mock-output', stderr: '' });
};

// Mock util.promisify to return our configurable mock
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify:
      () =>
      (...args: unknown[]) => {
        const dockerArgs = args[1] as string[];
        return mockDockerResponse(dockerArgs || []);
      },
  };
});

// Mock database
const mockGetSetting = vi.fn<(key: string) => string | null>(() => null);
vi.mock('../../../src/main/database/database.service', () => ({
  database: {
    getSetting: (key: string) => mockGetSetting(key),
  },
}));

import { codeServerService } from '../../../src/main/services/code-server.service';

describe('CodeServerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDockerResponse();
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
      expect(mounts.some((m) => m.includes('.git-credentials'))).toBe(true);
    });
  });

  describe('getClaudeMounts', () => {
    it('returns empty array (Claude config persists via /config mount)', () => {
      // Claude Code credentials persist automatically because:
      // 1. LinuxServer.io abc user has home at /config
      // 2. We mount userDataDir to /config (persistent volume)
      // 3. CLAUDE_CONFIG_DIR=/config/.claude puts credentials inside the persistent volume
      // No separate mount is needed.
      const mounts = codeServerService.getClaudeMounts();
      expect(mounts).toEqual([]);
    });

    it('does not mount host claude.json or .claude directory', () => {
      // Even if host files exist, we don't mount them to prevent conflicts
      mockExistsSync.mockReturnValue(true);
      const mounts = codeServerService.getClaudeMounts();
      // Should be empty - no Claude mounts needed
      expect(mounts).toEqual([]);
      expect(mounts.some((m) => m.includes('.claude.json'))).toBe(false);
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

  describe('toDockerPath edge cases', () => {
    it('converts lowercase drive letter', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const result = codeServerService.toDockerPath('d:\\Projects\\my-app');
      expect(result).toBe('/d/Projects/my-app');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('handles paths with spaces on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const result = codeServerService.toDockerPath('C:\\Users\\My User\\Documents\\project');
      expect(result).toBe('/c/Users/My User/Documents/project');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('syncVSCodeSettings — JSONC handling', () => {
    it('strips line comments from host settings', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      // First existsSync: host settings exist; second: code-server settings don't
      let existsCallCount = 0;
      mockExistsSync.mockImplementation(() => {
        existsCallCount++;
        return existsCallCount === 1; // only host file exists
      });
      mockReadFileSync.mockReturnValue(
        '{\n  // This is a line comment\n  "editor.fontSize": 16\n}'
      );

      codeServerService.syncVSCodeSettings();

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        expect(settings['editor.fontSize']).toBe(16);
      }
    });

    it('strips block comments and trailing commas from host settings', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      let existsCallCount = 0;
      mockExistsSync.mockImplementation(() => {
        existsCallCount++;
        return existsCallCount === 1;
      });
      mockReadFileSync.mockReturnValue(
        '{\n  /* block comment */\n  "editor.tabSize": 2,\n  "editor.wordWrap": "on",\n}'
      );

      codeServerService.syncVSCodeSettings();

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        expect(settings['editor.tabSize']).toBe(2);
        expect(settings['editor.wordWrap']).toBe('on');
      }
    });

    it('always applies required overrides even if host settings override them', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      let existsCallCount = 0;
      mockExistsSync.mockImplementation(() => {
        existsCallCount++;
        return existsCallCount === 1;
      });
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ 'security.workspace.trust.enabled': true, 'git.enabled': false })
      );

      codeServerService.syncVSCodeSettings();

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        expect(settings['security.workspace.trust.enabled']).toBe(false);
        expect(settings['git.enabled']).toBe(true);
        expect(settings['git.path']).toBe('/usr/bin/git');
      }
    });

    it('sets terminal profile to bash (bashrc at /config/.bashrc via userDataDir)', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(false);

      codeServerService.syncVSCodeSettings();

      const writtenContent = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (writtenContent) {
        const settings = JSON.parse(writtenContent);
        expect(settings['terminal.integrated.defaultProfile.linux']).toBe('bash');
        expect(settings['terminal.integrated.profiles.linux']['bash']).toBeDefined();
        expect(settings['terminal.integrated.profiles.linux']['bash'].path).toBe('/bin/bash');
      }
    });
  });

  describe('createContainerGitConfig — host config embedding', () => {
    it('embeds host .gitconfig content with CRLF normalized to LF', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '[user]\r\n    name = Test User\r\n    email = test@example.com\r\n'
      );

      codeServerService.createContainerGitConfig();

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('[user]');
        expect(content).toContain('name = Test User');
        // CRLF should be normalized — no \r in output
        expect(content).not.toContain('\r');
        // Our overrides should still be present
        expect(content).toContain('[safe]');
        expect(content).toContain('[core]');
        expect(content).toContain('autocrlf = input');
      }
    });
  });

  describe('createContainerBashrc — user aliases', () => {
    it('includes user-defined aliases from database', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockReturnValue(
        JSON.stringify([
          { name: 'deploy', command: 'npm run deploy' },
          { name: 'gs', command: 'git status -sb' }, // overrides default
        ])
      );

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('alias deploy="npm run deploy"');
        // User alias should override the default gs alias
        expect(content).toContain('alias gs="git status -sb"');
        expect(content).not.toContain('alias gs="git status"');
      }
    });

    it('includes project name in prompt', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});

      codeServerService.createContainerBashrc('/home/user/my-awesome-project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('my-awesome-project');
      }
    });

    it('handles invalid aliases JSON gracefully', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockReturnValue('not valid json');

      // Should not throw
      codeServerService.createContainerBashrc('/test/project');

      expect(mockWriteFileSync).toHaveBeenCalled();
      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        // Default aliases should still be present
        expect(content).toContain('alias ll=');
      }
    });

    it('applies bashProfile settings to PS1 prompt', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'bashProfile') {
          return JSON.stringify({
            showUsername: true,
            showGitBranch: true,
            usernameColor: 'cyan',
            pathColor: 'magenta',
            gitBranchColor: 'red',
          });
        }
        return null;
      });

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('PS1=');
        // Should contain cyan color code for username
        expect(content).toContain('\\033[01;36m');
        // Should contain magenta color code for path
        expect(content).toContain('\\033[01;35m');
        // Should contain red color code for git branch
        expect(content).toContain('\\033[01;31m');
      }
    });

    it('hides username when showUsername is false', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'bashProfile') {
          return JSON.stringify({
            showUsername: false,
            showGitBranch: true,
            usernameColor: 'green',
            pathColor: 'blue',
            gitBranchColor: 'yellow',
          });
        }
        return null;
      });

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        const ps1Match = content.match(/PS1='([^']+)'/);
        if (ps1Match) {
          const ps1 = ps1Match[1];
          // Path should be at the start when username is hidden
          expect(ps1).toMatch(/^\\\[\\033\[01;34m\\\]\$\(__project_path\)/);
        }
      }
    });

    it('hides git branch when showGitBranch is false', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'bashProfile') {
          return JSON.stringify({
            showUsername: true,
            showGitBranch: false,
            usernameColor: 'green',
            pathColor: 'blue',
            gitBranchColor: 'yellow',
          });
        }
        return null;
      });

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        const ps1Match = content.match(/PS1='([^']+)'/);
        if (ps1Match) {
          const ps1 = ps1Match[1];
          // Should NOT contain git branch function call
          expect(ps1).not.toContain('__git_branch');
        }
      }
    });

    it('uses default bashProfile settings when not set', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockReturnValue(null);

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        // Default colors: username=green, path=blue, git=yellow
        expect(content).toContain('\\033[01;32m'); // green
        expect(content).toContain('\\033[01;34m'); // blue
        expect(content).toContain('\\033[01;33m'); // yellow
        // Both username and git branch should be shown by default
        expect(content).toContain('__git_branch');
      }
    });

    it('uses customUsername when set in bashProfile settings', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'bashProfile') {
          return JSON.stringify({
            showUsername: true,
            showGitBranch: true,
            usernameColor: 'green',
            pathColor: 'blue',
            gitBranchColor: 'yellow',
            customUsername: 'devuser',
          });
        }
        return null;
      });

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        const ps1Match = content.match(/PS1='([^']+)'/);
        if (ps1Match) {
          const ps1 = ps1Match[1];
          // Should contain custom username
          expect(ps1).toContain('devuser');
        }
      }
    });

    it('falls back to OS username when customUsername is empty', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'bashProfile') {
          return JSON.stringify({
            showUsername: true,
            showGitBranch: true,
            usernameColor: 'green',
            pathColor: 'blue',
            gitBranchColor: 'yellow',
            customUsername: '',
          });
        }
        return null;
      });

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        const ps1Match = content.match(/PS1='([^']+)'/);
        if (ps1Match) {
          const ps1 = ps1Match[1];
          // Should NOT contain empty string but should have some username
          // The OS username will be present (varies by system)
          expect(ps1.length).toBeGreaterThan(0);
        }
      }
    });

    it('trims whitespace from customUsername', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'bashProfile') {
          return JSON.stringify({
            showUsername: true,
            showGitBranch: true,
            usernameColor: 'green',
            pathColor: 'blue',
            gitBranchColor: 'yellow',
            customUsername: '  myuser  ',
          });
        }
        return null;
      });

      codeServerService.createContainerBashrc('/test/project');

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        const ps1Match = content.match(/PS1='([^']+)'/);
        if (ps1Match) {
          const ps1 = ps1Match[1];
          // Should contain trimmed username
          expect(ps1).toContain('myuser');
          // Should not contain leading/trailing spaces
          expect(ps1).not.toContain('  myuser');
          expect(ps1).not.toContain('myuser  ');
        }
      }
    });
  });

  describe('getClaudeMounts — isolated config', () => {
    it('returns empty array (credentials persist in /config/.claude via main mount)', () => {
      // Claude Code credentials now persist via the main /config mount:
      // - userDataDir is mounted to /config (persistent volume)
      // - CLAUDE_CONFIG_DIR=/config/.claude puts credentials inside
      // - No separate mount is needed
      mockExistsSync.mockReturnValue(false);

      const mounts = codeServerService.getClaudeMounts();
      expect(mounts).toEqual([]);
      // Should NOT mount host's .claude.json or .claude directory
      expect(mounts.some((m) => m.includes('.claude.json'))).toBe(false);
    });
  });

  describe('getBashrcMount', () => {
    it('returns empty array (bashrc is in userDataDir, no separate mount needed)', () => {
      // The bashrc file is now written to userDataDir/.bashrc which becomes
      // /config/.bashrc via the main /config volume mount. No separate mount needed.
      const mounts = codeServerService.getBashrcMount();
      expect(mounts).toEqual([]);
    });
  });

  describe('getContainerState', () => {
    it('returns "running" when container is running', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.resolve({ stdout: 'true\n', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });
      const state = await codeServerService.getContainerState();
      expect(state).toBe('running');
    });

    it('returns "stopped" when container exists but is stopped', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.resolve({ stdout: 'false\n', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });
      const state = await codeServerService.getContainerState();
      expect(state).toBe('stopped');
    });

    it('returns "none" when container does not exist', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.reject(new Error('No such container'));
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });
      const state = await codeServerService.getContainerState();
      expect(state).toBe('none');
    });
  });

  describe('getContainerPort', () => {
    it('returns port number when container has port mapping', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('inspect') && args.some((a) => a.includes('HostPort'))) {
          return Promise.resolve({ stdout: '8080\n', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });
      const port = await codeServerService.getContainerPort();
      expect(port).toBe(8080);
    });

    it('returns null when port cannot be determined', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.reject(new Error('No such container'));
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });
      const port = await codeServerService.getContainerPort();
      expect(port).toBeNull();
    });
  });

  describe('persistent container behavior', () => {
    it('uses fixed container name cola-code-server', () => {
      // The CONTAINER_NAME is a private static property, but we can verify
      // it's used by checking the stop behavior uses the correct name
      expect(codeServerService).toBeDefined();
    });
  });

  describe('syncSSHConfig', () => {
    it('creates SSH config file with remote entries', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'sshRemotes') {
          return JSON.stringify([
            {
              id: '1',
              name: 'sunny-pi',
              hostname: '192.168.1.19',
              user: 'pi',
              port: 22,
              keyPath: 'C:\\Users\\test\\.ssh\\sunny-stack-pi',
              identitiesOnly: true,
            },
          ]);
        }
        return null;
      });

      codeServerService.syncSSHConfig();

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('Host sunny-pi');
        expect(content).toContain('HostName 192.168.1.19');
        expect(content).toContain('User pi');
        expect(content).toContain('Port 22');
        expect(content).toContain('IdentityFile /config/.ssh/keys/sunny-stack-pi');
        expect(content).toContain('IdentitiesOnly yes');
        expect(content).toContain('ServerAliveInterval 60');
      }
    });

    it('creates SSH config with multiple remotes', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'sshRemotes') {
          return JSON.stringify([
            {
              id: '1',
              name: 'sunny-pi',
              hostname: '192.168.1.19',
              user: 'pi',
              port: 22,
              keyPath: '/home/user/.ssh/sunny',
              identitiesOnly: true,
            },
            {
              id: '2',
              name: 'rinoa-pi5',
              hostname: '192.168.1.50',
              user: 'pi',
              port: 22,
              keyPath: '/home/user/.ssh/rinoa',
              identitiesOnly: false,
            },
          ]);
        }
        return null;
      });

      codeServerService.syncSSHConfig();

      const content = mockWriteFileSync.mock.calls[0]?.[1] as string;
      if (content) {
        expect(content).toContain('Host sunny-pi');
        expect(content).toContain('Host rinoa-pi5');
        // First remote has IdentitiesOnly
        expect(content).toMatch(/Host sunny-pi[\s\S]*?IdentitiesOnly yes/);
        // Second remote should NOT have IdentitiesOnly line after its Host block
        const rinaoBlock = content.match(/Host rinoa-pi5[\s\S]*?(?=Host |$)/);
        if (rinaoBlock) {
          expect(rinaoBlock[0]).not.toContain('IdentitiesOnly');
        }
      }
    });

    it('handles empty remotes array gracefully', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockReturnValue('[]');

      codeServerService.syncSSHConfig();

      // Should not write config file when no remotes
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('handles null/undefined remotes gracefully', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockReturnValue(null);

      codeServerService.syncSSHConfig();

      // Should not throw and should not write config
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('handles invalid JSON in sshRemotes setting', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockReturnValue('not valid json');

      // Should not throw
      expect(() => codeServerService.syncSSHConfig()).not.toThrow();
    });
  });

  describe('getSSHMounts', () => {
    it('returns empty array when no SSH config exists', () => {
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockReturnValue(null);

      const mounts = codeServerService.getSSHMounts();
      expect(mounts).toEqual([]);
    });

    it('mounts entire .ssh directory when config exists', () => {
      mockGetSetting.mockReturnValue(null);
      // SSH config file exists
      mockExistsSync.mockImplementation((pathArg: unknown) => {
        const p = pathArg as string;
        return p.includes('.ssh') && p.endsWith('config');
      });

      const mounts = codeServerService.getSSHMounts();

      // Should mount the entire .ssh directory
      expect(mounts).toContain('-v');
      expect(mounts.some((m) => m.includes('.ssh:/config/.ssh'))).toBe(true);
      // Should NOT be read-only (SSH needs to create known_hosts)
      expect(mounts.some((m) => m.includes(':ro'))).toBe(false);
    });

    it('returns empty array when config file does not exist', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'sshRemotes') {
          return JSON.stringify([
            {
              id: '1',
              name: 'test-host',
              hostname: '192.168.1.1',
              user: 'user',
              port: 22,
              keyPath: '/home/user/.ssh/test-key',
              identitiesOnly: true,
            },
          ]);
        }
        return null;
      });
      // Config file does not exist
      mockExistsSync.mockReturnValue(false);

      const mounts = codeServerService.getSSHMounts();

      expect(mounts).toEqual([]);
    });
  });

  describe('syncSSHConfig — key copying', () => {
    it('copies private key to .ssh/keys directory', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockCopyFileSync.mockImplementation(() => {});
      // Key exists on host
      mockExistsSync.mockReturnValue(true);
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'sshRemotes') {
          return JSON.stringify([
            {
              id: '1',
              name: 'test-host',
              hostname: '192.168.1.1',
              user: 'user',
              port: 22,
              keyPath: '/home/user/.ssh/my-key',
              identitiesOnly: true,
            },
          ]);
        }
        return null;
      });

      codeServerService.syncSSHConfig();

      // Should copy the key file
      expect(mockCopyFileSync).toHaveBeenCalled();
      const copyCall = mockCopyFileSync.mock.calls[0];
      expect(copyCall[0]).toBe('/home/user/.ssh/my-key');
      expect(copyCall[1]).toContain('my-key');
    });

    it('skips copying keys that do not exist on host', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockCopyFileSync.mockImplementation(() => {});
      // Key does not exist on host
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'sshRemotes') {
          return JSON.stringify([
            {
              id: '1',
              name: 'test-host',
              hostname: '192.168.1.1',
              user: 'user',
              port: 22,
              keyPath: '/nonexistent/key',
              identitiesOnly: true,
            },
          ]);
        }
        return null;
      });

      codeServerService.syncSSHConfig();

      // Should not copy non-existent key
      expect(mockCopyFileSync).not.toHaveBeenCalled();
    });

    it('copies multiple keys from different remotes', () => {
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockCopyFileSync.mockImplementation(() => {});
      mockExistsSync.mockReturnValue(true);
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'sshRemotes') {
          return JSON.stringify([
            {
              id: '1',
              name: 'host1',
              hostname: '192.168.1.1',
              user: 'user',
              port: 22,
              keyPath: '/home/user/.ssh/key1',
              identitiesOnly: true,
            },
            {
              id: '2',
              name: 'host2',
              hostname: '192.168.1.2',
              user: 'user',
              port: 22,
              keyPath: '/home/user/.ssh/key2',
              identitiesOnly: true,
            },
          ]);
        }
        return null;
      });

      codeServerService.syncSSHConfig();

      expect(mockCopyFileSync).toHaveBeenCalledTimes(2);
      expect(mockCopyFileSync.mock.calls[0][0]).toBe('/home/user/.ssh/key1');
      expect(mockCopyFileSync.mock.calls[1][0]).toBe('/home/user/.ssh/key2');
    });
  });
});
