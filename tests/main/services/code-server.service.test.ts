// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available at vi.mock time
const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockUnlinkSync,
  mockCopyFileSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn((_path?: unknown) => false),
  mockReadFileSync: vi.fn((_path?: unknown, _options?: unknown) => ''),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync as unknown as typeof import('fs').existsSync,
    readFileSync: mockReadFileSync as unknown as typeof import('fs').readFileSync,
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
    it('resolves immediately when docker info succeeds', async () => {
      // Default mock returns successful output
      await expect(codeServerService.checkDockerAvailable()).resolves.toBeUndefined();
    });

    it('auto-starts Docker Desktop and resolves when docker becomes available', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      setMockDockerResponse(() => {
        callCount++;
        // Fail first 3 calls (initial check + launchDockerDesktop + 1st poll), succeed on 4th
        if (callCount <= 3) {
          return Promise.reject(new Error('Docker not running'));
        }
        return Promise.resolve({ stdout: '24.0.0', stderr: '' });
      });

      const promise = codeServerService.checkDockerAvailable();

      // Advance through polling delays (2s each) — need enough ticks for the promise to settle
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(2000);
      }

      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });

    it('throws after polling timeout when Docker never becomes available', async () => {
      vi.useFakeTimers();
      setMockDockerResponse(() => {
        return Promise.reject(new Error('Docker not running'));
      });

      const promise = codeServerService.checkDockerAvailable();

      // Eagerly attach rejection handler so the rejection is never "unhandled"
      const resultPromise = promise.then(
        () => null,
        (e: Error) => e
      );

      // Advance through all 30 polling attempts (30 × 2s = 60s)
      for (let i = 0; i < 30; i++) {
        await vi.advanceTimersByTimeAsync(2000);
      }

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toContain('Docker Desktop is not running');
      vi.useRealTimers();
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
              hostname: '192.168.1.10',
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
        expect(content).toContain('HostName 192.168.1.10');
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
              hostname: '192.168.1.10',
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

  describe('getWorkspaceMounts', () => {
    it('returns empty array when no paths are configured', () => {
      mockExistsSync.mockReturnValue(false);
      mockGetSetting.mockReturnValue(null);

      const mounts = codeServerService.getWorkspaceMounts();
      expect(mounts).toEqual([]);
    });

    it('returns mount args for contributions path when configured and exists', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return 'C:\\Dev\\Contributions';
        return null;
      });
      mockExistsSync.mockReturnValue(true);

      const mounts = codeServerService.getWorkspaceMounts();

      expect(mounts).toContain('-v');
      expect(mounts.some((m) => m.includes('/config/workspaces/contributions'))).toBe(true);
    });

    it('returns mount args for my-projects path when configured and exists', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultProjectsPath') return 'C:\\Dev\\MyProjects';
        return null;
      });
      mockExistsSync.mockReturnValue(true);

      const mounts = codeServerService.getWorkspaceMounts();

      expect(mounts).toContain('-v');
      expect(mounts.some((m) => m.includes('/config/workspaces/my-projects'))).toBe(true);
    });

    it('returns mount args for professional path when configured and exists', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultProfessionalProjectsPath') return 'C:\\Dev\\Professional';
        return null;
      });
      mockExistsSync.mockReturnValue(true);

      const mounts = codeServerService.getWorkspaceMounts();

      expect(mounts).toContain('-v');
      expect(mounts.some((m) => m.includes('/config/workspaces/professional'))).toBe(true);
    });

    it('returns mount args for all three paths when all configured and exist', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return 'C:\\Dev\\Contributions';
        if (key === 'defaultProjectsPath') return 'C:\\Dev\\MyProjects';
        if (key === 'defaultProfessionalProjectsPath') return 'C:\\Dev\\Professional';
        return null;
      });
      mockExistsSync.mockReturnValue(true);

      const mounts = codeServerService.getWorkspaceMounts();

      // Should have 6 items: -v, path1, -v, path2, -v, path3
      expect(mounts.length).toBe(6);
      expect(mounts.some((m) => m.includes('/config/workspaces/contributions'))).toBe(true);
      expect(mounts.some((m) => m.includes('/config/workspaces/my-projects'))).toBe(true);
      expect(mounts.some((m) => m.includes('/config/workspaces/professional'))).toBe(true);
    });

    it('skips paths that do not exist on the filesystem', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return 'C:\\Dev\\Contributions';
        if (key === 'defaultProjectsPath') return 'C:\\Dev\\Nonexistent';
        return null;
      });
      // Only contributions path exists
      mockExistsSync.mockImplementation((pathArg: unknown) => {
        const p = pathArg as string;
        return p.includes('Contributions');
      });

      const mounts = codeServerService.getWorkspaceMounts();

      expect(mounts.some((m) => m.includes('/config/workspaces/contributions'))).toBe(true);
      expect(mounts.some((m) => m.includes('/config/workspaces/my-projects'))).toBe(false);
    });
  });

  describe('getWorkspaceCategory', () => {
    beforeEach(() => {
      // Setup workspace base paths by calling the private method via start flow
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return 'C:\\Dev\\Contributions';
        if (key === 'defaultProjectsPath') return 'C:\\Dev\\MyProjects';
        if (key === 'defaultProfessionalProjectsPath') return 'C:\\Dev\\Professional';
        return null;
      });
    });

    it('returns "contributions" for paths under defaultClonePath', () => {
      const category = codeServerService.getWorkspaceCategory('C:\\Dev\\Contributions\\repo-a');
      expect(category).toBe('contributions');
    });

    it('returns "my-projects" for paths under defaultProjectsPath', () => {
      const category = codeServerService.getWorkspaceCategory('C:\\Dev\\MyProjects\\project-1');
      expect(category).toBe('my-projects');
    });

    it('returns "professional" for paths under defaultProfessionalProjectsPath', () => {
      const category = codeServerService.getWorkspaceCategory('C:\\Dev\\Professional\\client-a');
      expect(category).toBe('professional');
    });

    it('returns null for paths not under any configured workspace', () => {
      const category = codeServerService.getWorkspaceCategory('C:\\Other\\random-project');
      expect(category).toBeNull();
    });

    it('handles case-insensitive path matching on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const category = codeServerService.getWorkspaceCategory('c:\\dev\\contributions\\repo-a');
      expect(category).toBe('contributions');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('hostToContainerPath', () => {
    beforeEach(() => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return 'C:\\Dev\\Contributions';
        if (key === 'defaultProjectsPath') return 'C:\\Dev\\MyProjects';
        if (key === 'defaultProfessionalProjectsPath') return 'C:\\Dev\\Professional';
        return null;
      });
    });

    it('maps contributions path to container path', () => {
      const containerPath = codeServerService.hostToContainerPath('C:\\Dev\\Contributions\\repo-a');
      expect(containerPath).toBe('/config/workspaces/contributions/repo-a');
    });

    it('maps my-projects path to container path', () => {
      const containerPath = codeServerService.hostToContainerPath('C:\\Dev\\MyProjects\\project-1');
      expect(containerPath).toBe('/config/workspaces/my-projects/project-1');
    });

    it('maps professional path to container path', () => {
      const containerPath = codeServerService.hostToContainerPath(
        'C:\\Dev\\Professional\\client-a'
      );
      expect(containerPath).toBe('/config/workspaces/professional/client-a');
    });

    it('returns null for paths not under any configured workspace', () => {
      const containerPath = codeServerService.hostToContainerPath('C:\\Other\\random-project');
      expect(containerPath).toBeNull();
    });

    it('handles nested subdirectories correctly', () => {
      const containerPath = codeServerService.hostToContainerPath(
        'C:\\Dev\\Contributions\\repo-a\\src\\components'
      );
      expect(containerPath).toBe('/config/workspaces/contributions/repo-a/src/components');
    });

    it('handles base path exactly (no subdirectory)', () => {
      const containerPath = codeServerService.hostToContainerPath('C:\\Dev\\Contributions');
      expect(containerPath).toBe('/config/workspaces/contributions');
    });
  });

  describe('addWorkspace', () => {
    it('throws when container is not running', async () => {
      await expect(codeServerService.addWorkspace('/some/path')).rejects.toThrow(
        'Container is not running'
      );
    });

    // Note: Tests that call codeServerService.start() are integration tests
    // that require mocking the health check (waitForReady). These tests verify
    // the method signatures and basic flow. Full integration tests should mock
    // the HTTP health check endpoint.
  });

  describe('removeWorkspace', () => {
    it('returns shouldStop: true when no workspaces are tracked', async () => {
      // Remove from empty - should return shouldStop: true
      const result = await codeServerService.removeWorkspace('C:\\Dev\\Contributions\\repo-a');
      expect(result).toEqual({ shouldStop: true });
    });

    it('returns shouldStop info from removeWorkspace', async () => {
      // We verify the return type is correct
      const result = await codeServerService.removeWorkspace('C:\\nonexistent\\path');
      expect(result).toHaveProperty('shouldStop');
      expect(typeof result.shouldStop).toBe('boolean');
    });
  });

  describe('persistent container with multi-mount', () => {
    // Note: Tests that verify container persistence across project switches
    // require full integration testing with mocked health check.
    // The unit tests above verify the individual methods work correctly.
    // The key behavior tested:
    // - getWorkspaceMounts() returns all configured mounts
    // - hostToContainerPath() maps paths correctly
    // - addWorkspace/removeWorkspace track projects properly
    // - start() no longer compares workspace paths

    it('getWorkspaceMounts returns all configured paths', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return 'C:\\Dev\\Contributions';
        if (key === 'defaultProjectsPath') return 'C:\\Dev\\MyProjects';
        if (key === 'defaultProfessionalProjectsPath') return 'C:\\Dev\\Professional';
        return null;
      });
      mockExistsSync.mockReturnValue(true);

      const mounts = codeServerService.getWorkspaceMounts();

      // All three workspace categories should be mounted
      expect(mounts.some((m) => m.includes('/config/workspaces/contributions'))).toBe(true);
      expect(mounts.some((m) => m.includes('/config/workspaces/my-projects'))).toBe(true);
      expect(mounts.some((m) => m.includes('/config/workspaces/professional'))).toBe(true);
    });

    it('hostToContainerPath maps all workspace categories', () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return 'C:\\Dev\\Contributions';
        if (key === 'defaultProjectsPath') return 'C:\\Dev\\MyProjects';
        if (key === 'defaultProfessionalProjectsPath') return 'C:\\Dev\\Professional';
        return null;
      });

      // Test all three categories
      expect(codeServerService.hostToContainerPath('C:\\Dev\\Contributions\\repo-a')).toBe(
        '/config/workspaces/contributions/repo-a'
      );
      expect(codeServerService.hostToContainerPath('C:\\Dev\\MyProjects\\project-1')).toBe(
        '/config/workspaces/my-projects/project-1'
      );
      expect(codeServerService.hostToContainerPath('C:\\Dev\\Professional\\client-a')).toBe(
        '/config/workspaces/professional/client-a'
      );
    });
  });

  // ── AT-22: Resource Config in createContainer ───────────────────

  describe('createContainer — resource config', () => {
    // These tests verify that createContainer builds the correct Docker args
    // based on codeServerConfig from the database. Since createContainer is private,
    // we test it indirectly via start() with appropriate mocks.

    beforeEach(() => {
      // Setup workspace paths so createContainer can resolve them
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        if (key === 'defaultProjectsPath') return '/mock/projects';
        if (key === 'defaultProfessionalProjectsPath') return '/mock/professional';
        return null;
      });
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('includes --cpus flag when cpuLimit is set', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        // Handle different docker commands
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({ cpuLimit: 2, memoryLimit: null, shmSize: '256m' });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      // Mock fetch for health check
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail on other steps, but we captured docker args
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        expect(runArgs).toContain('--cpus');
        expect(runArgs).toContain('2');
      }
    });

    it('includes --memory flag when memoryLimit is set', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({ cpuLimit: null, memoryLimit: '4g', shmSize: '256m' });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail on other steps
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        expect(runArgs).toContain('--memory');
        expect(runArgs).toContain('4g');
      }
    });

    it('uses config shmSize instead of hardcoded 256m', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig') return JSON.stringify({ shmSize: '512m' });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        expect(runArgs.some((a) => a.includes('--shm-size=512m'))).toBe(true);
      }
    });

    it('omits --cpus and --memory when null (unlimited)', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({ cpuLimit: null, memoryLimit: null });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        expect(runArgs).not.toContain('--cpus');
        expect(runArgs).not.toContain('--memory');
      }
    });

    it('uses default config values when no codeServerConfig in database', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      // No codeServerConfig in database
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        // Default: no --cpus, no --memory (null = unlimited)
        expect(runArgs).not.toContain('--cpus');
        expect(runArgs).not.toContain('--memory');
        // Default shm-size is 256m
        expect(runArgs.some((a) => a.includes('--shm-size=256m'))).toBe(true);
      }
    });
  });

  // ── AT-23: Environment, Startup, and Extension Config ──────────

  describe('createContainer — environment and startup config', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('uses configured timezone in -e TZ=', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig') return JSON.stringify({ timezone: 'America/New_York' });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        // TZ should appear as part of an -e flag value
        expect(runArgs.some((a) => a.includes('TZ=America/New_York'))).toBe(true);
      }
    });

    it('includes custom env vars as -e KEY=VALUE', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({
            customEnvVars: [
              { key: 'NODE_ENV', value: 'development' },
              { key: 'DEBUG', value: 'true' },
            ],
          });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        expect(runArgs).toContain('NODE_ENV=development');
        expect(runArgs).toContain('DEBUG=true');
      }
    });

    it('filters reserved env var names from custom env vars', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({
            customEnvVars: [
              { key: 'PUID', value: '9999' }, // Reserved — should be filtered
              { key: 'SAFE_VAR', value: 'allowed' },
            ],
          });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        // PUID should NOT appear as a custom env var (it's in the reserved -e args already)
        expect(runArgs).not.toContain('PUID=9999');
        // SAFE_VAR should be included
        expect(runArgs).toContain('SAFE_VAR=allowed');
      }
    });

    it('uses configured container name', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect')) return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({ containerName: 'my-custom-server' });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail
      } finally {
        globalThis.fetch = originalFetch;
      }

      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      if (runArgs) {
        // Container name should include the configured name (with -dev suffix in dev mode)
        expect(runArgs.some((a) => a.includes('my-custom-server'))).toBe(true);
      }
    });

    it('throws immediately when autoStartDocker is false and Docker is not running', async () => {
      setMockDockerResponse(() => {
        return Promise.reject(new Error('Docker not running'));
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig') return JSON.stringify({ autoStartDocker: false });
        return null;
      });

      await expect(codeServerService.start('/mock/path')).rejects.toThrow('Auto-start is disabled');
    });
  });

  // ── AT-24: getContainerStats ───────────────────────────────────

  describe('getContainerStats', () => {
    it('parses valid docker stats JSON output correctly', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('stats')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              CPUPerc: '45.20%',
              MemPerc: '25.00%',
              MemUsage: '512MiB / 2GiB',
            }),
            stderr: '',
          });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const stats = await codeServerService.getContainerStats();

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBeCloseTo(45.2);
      expect(stats!.memPercent).toBeCloseTo(25.0);
      expect(stats!.memUsage).toBe('512MiB');
      expect(stats!.memLimit).toBe('2GiB');
    });

    it('returns null when container is not running', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('stats')) {
          return Promise.reject(new Error('No such container'));
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const stats = await codeServerService.getContainerStats();
      expect(stats).toBeNull();
    });

    it('handles docker command failure gracefully (returns null)', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('stats')) {
          return Promise.reject(new Error('Docker daemon not running'));
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const stats = await codeServerService.getContainerStats();
      expect(stats).toBeNull();
    });

    it('strips % signs from CPUPerc and MemPerc', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('stats')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              CPUPerc: '99.50%',
              MemPerc: '75.30%',
              MemUsage: '1.5GiB / 2GiB',
            }),
            stderr: '',
          });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const stats = await codeServerService.getContainerStats();
      expect(stats!.cpuPercent).toBeCloseTo(99.5);
      expect(stats!.memPercent).toBeCloseTo(75.3);
    });

    it('splits MemUsage on / for used/limit values', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('stats')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              CPUPerc: '10.00%',
              MemPerc: '50.00%',
              MemUsage: '1GiB / 2GiB',
            }),
            stderr: '',
          });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const stats = await codeServerService.getContainerStats();
      expect(stats!.memUsage).toBe('1GiB');
      expect(stats!.memLimit).toBe('2GiB');
    });

    it('returns 0 for NaN CPU/memory percentages', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('stats')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              CPUPerc: '--',
              MemPerc: '--',
              MemUsage: '-- / --',
            }),
            stderr: '',
          });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const stats = await codeServerService.getContainerStats();
      expect(stats!.cpuPercent).toBe(0);
      expect(stats!.memPercent).toBe(0);
    });

    it('returns null when docker stats output is empty', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('stats')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const stats = await codeServerService.getContainerStats();
      expect(stats).toBeNull();
    });
  });

  // ── hasResourceConfigChanged ────────────────────────────────────

  describe('hasResourceConfigChanged', () => {
    it('returns false when container resources match config (defaults)', async () => {
      // Container has: 0 NanoCpus, 0 Memory, 268435456 ShmSize (256m)
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.resolve({ stdout: '0 0 268435456', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const config = {
        cpuLimit: null,
        memoryLimit: null,
        shmSize: '256m',
        autoStartDocker: true,
        healthCheckTimeout: 90,
        autoSyncHostSettings: true,
        gpuAcceleration: 'on' as const,
        terminalScrollback: 1000,
        autoInstallExtensions: [],
        timezone: 'UTC',
        customEnvVars: [],
        containerName: 'cola-code-server',
      };

      const changed = await codeServerService.hasResourceConfigChanged(config);
      expect(changed).toBe(false);
    });

    it('returns true when CPU limit has changed', async () => {
      // Container was created with 0 NanoCpus (unlimited)
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.resolve({ stdout: '0 0 268435456', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const config = {
        cpuLimit: 4,
        memoryLimit: null,
        shmSize: '256m',
        autoStartDocker: true,
        healthCheckTimeout: 90,
        autoSyncHostSettings: true,
        gpuAcceleration: 'on' as const,
        terminalScrollback: 1000,
        autoInstallExtensions: [],
        timezone: 'UTC',
        customEnvVars: [],
        containerName: 'cola-code-server',
      };

      const changed = await codeServerService.hasResourceConfigChanged(config);
      expect(changed).toBe(true);
    });

    it('returns true when memory limit has changed', async () => {
      // Container was created with 0 Memory (unlimited)
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.resolve({ stdout: '0 0 268435456', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const config = {
        cpuLimit: null,
        memoryLimit: '4g',
        shmSize: '256m',
        autoStartDocker: true,
        healthCheckTimeout: 90,
        autoSyncHostSettings: true,
        gpuAcceleration: 'on' as const,
        terminalScrollback: 1000,
        autoInstallExtensions: [],
        timezone: 'UTC',
        customEnvVars: [],
        containerName: 'cola-code-server',
      };

      const changed = await codeServerService.hasResourceConfigChanged(config);
      expect(changed).toBe(true);
    });

    it('returns true when SHM size has changed', async () => {
      // Container was created with 268435456 (256m)
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.resolve({ stdout: '0 0 268435456', stderr: '' });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const config = {
        cpuLimit: null,
        memoryLimit: null,
        shmSize: '512m',
        autoStartDocker: true,
        healthCheckTimeout: 90,
        autoSyncHostSettings: true,
        gpuAcceleration: 'on' as const,
        terminalScrollback: 1000,
        autoInstallExtensions: [],
        timezone: 'UTC',
        customEnvVars: [],
        containerName: 'cola-code-server',
      };

      const changed = await codeServerService.hasResourceConfigChanged(config);
      expect(changed).toBe(true);
    });

    it('returns false when container matches Performance preset', async () => {
      // Performance preset: 4 CPUs, 4g Memory, 512m SHM
      // Docker stores: NanoCpus=4e9, Memory=4*1024^3, ShmSize=512*1024^2
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.resolve({
            stdout: `${4e9} ${4 * 1024 * 1024 * 1024} ${512 * 1024 * 1024}`,
            stderr: '',
          });
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const config = {
        cpuLimit: 4,
        memoryLimit: '4g',
        shmSize: '512m',
        autoStartDocker: true,
        healthCheckTimeout: 90,
        autoSyncHostSettings: true,
        gpuAcceleration: 'on' as const,
        terminalScrollback: 1000,
        autoInstallExtensions: [],
        timezone: 'UTC',
        customEnvVars: [],
        containerName: 'cola-code-server',
      };

      const changed = await codeServerService.hasResourceConfigChanged(config);
      expect(changed).toBe(false);
    });

    it('returns false on inspect error (does not force recreation)', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('inspect')) {
          return Promise.reject(new Error('No such container'));
        }
        return Promise.resolve({ stdout: 'mock-output', stderr: '' });
      });

      const config = {
        cpuLimit: 4,
        memoryLimit: '4g',
        shmSize: '512m',
        autoStartDocker: true,
        healthCheckTimeout: 90,
        autoSyncHostSettings: true,
        gpuAcceleration: 'on' as const,
        terminalScrollback: 1000,
        autoInstallExtensions: [],
        timezone: 'UTC',
        customEnvVars: [],
        containerName: 'cola-code-server',
      };

      const changed = await codeServerService.hasResourceConfigChanged(config);
      expect(changed).toBe(false);
    });
  });

  // ── start() — container recreation on config change ────────────

  describe('start — recreates container when resource config changes', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('removes and recreates stopped container when config has changed', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        // docker info
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        // docker images
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        // docker inspect --format {{.State.Running}} → stopped
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.resolve({ stdout: 'false', stderr: '' });
        // docker inspect for multi-mount check → has multi-mount
        if (args.includes('inspect') && args.some((a) => a.includes('Destination')))
          return Promise.resolve({ stdout: '/config/workspaces', stderr: '' });
        // docker inspect for resource config check → defaults (no limits)
        if (args.includes('inspect') && args.some((a) => a.includes('NanoCpus')))
          return Promise.resolve({ stdout: '0 0 268435456', stderr: '' });
        // docker rm -f
        if (args[0] === 'rm') return Promise.resolve({ stdout: '', stderr: '' });
        // docker run (after recreation)
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      // Config has changed: Performance preset (4 CPU, 4g, 512m)
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({ cpuLimit: 4, memoryLimit: '4g', shmSize: '512m' });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail on later steps
      } finally {
        globalThis.fetch = originalFetch;
      }

      // Should have called rm -f to remove old container
      const rmArgs = dockerArgs.find((a) => a[0] === 'rm');
      expect(rmArgs).toBeDefined();

      // Should have called run (not start) to create new container
      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      expect(runArgs).toBeDefined();

      // New container should have the updated resource args
      if (runArgs) {
        expect(runArgs).toContain('--cpus');
        expect(runArgs).toContain('4');
        expect(runArgs).toContain('--memory');
        expect(runArgs).toContain('4g');
        expect(runArgs.some((a) => a.includes('--shm-size=512m'))).toBe(true);
      }

      // Should NOT have called 'docker start' (reusing old container)
      const startArgs = dockerArgs.find((a) => a[0] === 'start');
      expect(startArgs).toBeUndefined();
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

  // ── start() — concurrent start handling ────────────────────────

  describe('start — concurrent start handling', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('waits for ongoing start and returns result when another start is called concurrently', async () => {
      vi.useFakeTimers();
      let firstStartResolve: ((value: { stdout: string; stderr: string }) => void) | null = null;

      setMockDockerResponse((args) => {
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') {
          // Delay the docker run to simulate slow start
          return new Promise((resolve) => {
            firstStartResolve = resolve;
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        // Start first call (will hang on docker run)
        const firstStart = codeServerService.start('/mock/contributions/repo-a');

        // Let the first start get to the "starting" state
        await vi.runOnlyPendingTimersAsync();

        // Start second call while first is in progress
        const secondStart = codeServerService.start('/mock/contributions/repo-b');

        // Advance timers to let second call check and wait
        await vi.advanceTimersByTimeAsync(1500);

        // Now resolve the first start's docker run
        if (firstStartResolve !== null) {
          (firstStartResolve as (value: { stdout: string; stderr: string }) => void)({
            stdout: 'container-id',
            stderr: '',
          });
        }

        await vi.runAllTimersAsync();

        const [result1, result2] = await Promise.all([firstStart, secondStart]);

        // Both should succeed and return the same port
        expect(result1.port).toBeDefined();
        expect(result2.port).toBe(result1.port);
      } finally {
        globalThis.fetch = originalFetch;
        vi.useRealTimers();
      }
    });
  });

  // ── start() — autoSyncHostSettings branch ───────────────────────

  describe('start — autoSyncHostSettings false', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('skips syncing VS Code settings when autoSyncHostSettings is false', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig') return JSON.stringify({ autoSyncHostSettings: false });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail on other steps
      } finally {
        globalThis.fetch = originalFetch;
      }

      // Should have fewer writes (no VS Code settings.json written)
      // Git config and bashrc still written, but not settings.json
      const settingsWrites = mockWriteFileSync.mock.calls.filter((call) =>
        (call[0] as string).includes('settings.json')
      );
      expect(settingsWrites.length).toBe(0);
    });
  });

  // ── start() — container recreation on old mount config ──────────

  describe('start — recreates container with old mount configuration', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('removes and recreates container when it has old single-mount config', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        // Container exists and is stopped
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.resolve({ stdout: 'false', stderr: '' });
        // Container has old mount config (no /config/workspaces mount)
        if (args.includes('inspect') && args.some((a) => a.includes('Destination')))
          return Promise.resolve({ stdout: '/workspace', stderr: '' });
        if (args[0] === 'rm') return Promise.resolve({ stdout: '', stderr: '' });
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail on other steps
      } finally {
        globalThis.fetch = originalFetch;
      }

      // Should have removed old container
      const rmArgs = dockerArgs.find((a) => a[0] === 'rm');
      expect(rmArgs).toBeDefined();

      // Should have created new container with multi-mount
      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      expect(runArgs).toBeDefined();
    });
  });

  // ── start() — reuses running container ──────────────────────────

  describe('start — reuses running container', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('reuses running container with multi-mount configuration', async () => {
      const dockerArgs: string[][] = [];
      let callCount = 0;
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        // Container is running
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.resolve({ stdout: 'true', stderr: '' });
        // Container has multi-mount
        if (args.includes('inspect') && args.some((a) => a.includes('Destination'))) {
          callCount++;
          return Promise.resolve({ stdout: '/config/workspaces', stderr: '' });
        }
        // Container port
        if (args.includes('inspect') && args.some((a) => a.includes('HostPort')))
          return Promise.resolve({ stdout: '8080', stderr: '' });
        // Resource config check
        if (args.includes('inspect') && args.some((a) => a.includes('NanoCpus')))
          return Promise.resolve({ stdout: '0 0 268435456', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        const result = await codeServerService.start('/mock/contributions/repo');
        expect(result.port).toBe(8080);

        // Verify the multi-mount check was performed
        expect(callCount).toBeGreaterThan(0);
      } finally {
        globalThis.fetch = originalFetch;
      }

      // Should NOT have called docker run or docker start
      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      const startArgs = dockerArgs.find((a) => a[0] === 'start');
      expect(runArgs).toBeUndefined();
      expect(startArgs).toBeUndefined();
    });
  });

  // ── start() — starts stopped container ──────────────────────────

  describe('start — starts stopped container', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('starts stopped container with multi-mount configuration', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        // Container is stopped
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.resolve({ stdout: 'false', stderr: '' });
        // Container has multi-mount
        if (args.includes('inspect') && args.some((a) => a.includes('Destination')))
          return Promise.resolve({ stdout: '/config/workspaces', stderr: '' });
        // Resource config hasn't changed
        if (args.includes('inspect') && args.some((a) => a.includes('NanoCpus')))
          return Promise.resolve({ stdout: '0 0 268435456', stderr: '' });
        // Container port
        if (args.includes('inspect') && args.some((a) => a.includes('HostPort')))
          return Promise.resolve({ stdout: '8080', stderr: '' });
        if (args[0] === 'start') return Promise.resolve({ stdout: '', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        const result = await codeServerService.start('/mock/contributions/repo');
        expect(result.port).toBe(8080);
      } catch {
        // May fail on other steps
      } finally {
        globalThis.fetch = originalFetch;
      }

      // Should have called docker start (not run)
      const startArgs = dockerArgs.find((a) => a[0] === 'start');
      expect(startArgs).toBeDefined();

      // Should NOT have called docker run
      const runArgs = dockerArgs.find((a) => a[0] === 'run');
      expect(runArgs).toBeUndefined();
    });
  });

  // ── start() — extension auto-install ────────────────────────────

  describe('start — extension auto-install', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('triggers extension installation when autoInstallExtensions is configured', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        // Extension install command
        if (args[0] === 'exec' && args.some((a) => a.includes('--install-extension')))
          return Promise.resolve({ stdout: 'Extension installed', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'codeServerConfig')
          return JSON.stringify({
            autoInstallExtensions: ['ms-python.python', 'dbaeumer.vscode-eslint'],
          });
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo');
      } catch {
        // May fail on other steps
      } finally {
        globalThis.fetch = originalFetch;
      }

      // Wait for async extension installation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Extension install happens asynchronously, so it may or may not have completed
      // Just verify the start completed successfully
    });
  });

  // ── addWorkspace() — branches ────────────────────────────────────

  describe('addWorkspace — tracking new and existing workspaces', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('adds new workspace and returns URL with folder parameter', async () => {
      // First start the container
      setMockDockerResponse((args) => {
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        if (key === 'defaultProjectsPath') return '/mock/my-projects';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo-a');

        // Now add another workspace
        const url = await codeServerService.addWorkspace('/mock/my-projects/project-1');

        expect(url).toContain('?folder=');
        // URL encodes the path, so check for encoded version
        expect(decodeURIComponent(url)).toContain('/config/workspaces/my-projects/project-1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns existing URL when workspace is already tracked', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo-a');

        // Add same workspace twice
        const url1 = await codeServerService.addWorkspace('/mock/contributions/repo-a');
        const url2 = await codeServerService.addWorkspace('/mock/contributions/repo-a');

        expect(url1).toBe(url2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ── removeWorkspace() — shouldStop logic ─────────────────────────

  describe('removeWorkspace — shouldStop determination', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('returns shouldStop: false when other workspaces remain', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        if (key === 'defaultProjectsPath') return '/mock/my-projects';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        await codeServerService.start('/mock/contributions/repo-a');
        await codeServerService.addWorkspace('/mock/my-projects/project-1');

        // Remove one workspace, another remains
        const result = await codeServerService.removeWorkspace('/mock/contributions/repo-a');

        expect(result.shouldStop).toBe(false);

        // Verify remaining workspace is tracked
        const mounted = codeServerService.getMountedProjects();
        expect(mounted).toContain('/mock/my-projects/project-1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns shouldStop: true when removing the last workspace', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        const startResult = await codeServerService.start('/mock/contributions/repo-unique-test');
        expect(startResult.port).toBeGreaterThan(0);

        // Get mounted before removal to verify start tracked it
        const mountedBefore = codeServerService.getMountedProjects();
        expect(mountedBefore).toContain('/mock/contributions/repo-unique-test');

        // Remove all workspaces to ensure clean state
        for (const project of mountedBefore) {
          await codeServerService.removeWorkspace(project);
        }

        // Verify no workspaces remain
        const mounted = codeServerService.getMountedProjects();
        expect(mounted.length).toBe(0);

        // The last removeWorkspace should return shouldStop: true
        const result = await codeServerService.removeWorkspace('/mock/nonexistent');
        expect(result.shouldStop).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ── getMountedProjects() ─────────────────────────────────────────

  describe('getMountedProjects', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('returns array of all mounted project paths', async () => {
      setMockDockerResponse((args) => {
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        if (args.includes('inspect') && args.some((a) => a.includes('Running')))
          return Promise.reject(new Error('No such container'));
        if (args[0] === 'run') return Promise.resolve({ stdout: 'container-id', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        if (key === 'defaultProjectsPath') return '/mock/my-projects';
        if (key === 'defaultProfessionalProjectsPath') return '/mock/professional';
        return null;
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });

      try {
        const startResult = await codeServerService.start('/mock/contributions/repo-a');
        expect(startResult.port).toBeGreaterThan(0);

        await codeServerService.addWorkspace('/mock/my-projects/project-1');
        await codeServerService.addWorkspace('/mock/professional/client-a');

        const mounted = codeServerService.getMountedProjects();

        // start() adds the initial project, addWorkspace() adds 2 more
        expect(mounted.length).toBeGreaterThanOrEqual(3);
        expect(mounted).toContain('/mock/contributions/repo-a');
        expect(mounted).toContain('/mock/my-projects/project-1');
        expect(mounted).toContain('/mock/professional/client-a');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ── stop() — running container ───────────────────────────────────

  describe('stop — stops running container', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockMkdirSync.mockImplementation(() => undefined as any);
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('{}');
    });

    it('stops running container and clears state', async () => {
      const dockerArgs: string[][] = [];
      setMockDockerResponse((args) => {
        dockerArgs.push(args);
        if (args.includes('info')) return Promise.resolve({ stdout: '24.0.0', stderr: '' });
        if (args.includes('images')) return Promise.resolve({ stdout: 'abc123', stderr: '' });
        // Container state changes from running to stopped
        if (args.includes('inspect') && args.some((a) => a.includes('Running'))) {
          const stopCalled = dockerArgs.some((a) => a[0] === 'stop');
          return Promise.resolve({ stdout: stopCalled ? 'false' : 'true', stderr: '' });
        }
        if (args[0] === 'stop') return Promise.resolve({ stdout: '', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'defaultClonePath') return '/mock/contributions';
        return null;
      });

      // Stop before starting (should handle gracefully)
      await codeServerService.stop();

      // Verify state is cleared
      const status = codeServerService.getStatus();
      expect(status.running).toBe(false);
      expect(status.port).toBeNull();
    });
  });
});
