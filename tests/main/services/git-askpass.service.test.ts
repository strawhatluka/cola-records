import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

// Mock fs
const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockRmSync = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
}));

// Mock database
const mockGetAllSettings = vi.fn();
vi.mock('../../../src/main/database', () => ({
  database: {
    getAllSettings: () => mockGetAllSettings(),
  },
}));

// Mock environment service
const mockEnvGet = vi.fn();
vi.mock('../../../src/main/services/environment.service', () => ({
  env: {
    get: (key: string) => mockEnvGet(key),
  },
}));

// Import after mocks
import { gitAskPassService } from '../../../src/main/services/git-askpass.service';

describe('GitAskPassService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockGetAllSettings.mockReturnValue({});
    mockEnvGet.mockReturnValue(undefined);
  });

  afterEach(() => {
    // Reset service state by cleaning up
    try {
      gitAskPassService.cleanup();
    } catch {
      // Ignore cleanup errors in tests
    }
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('creates askpass directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });

      gitAskPassService.initialize();

      expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('git-askpass'), {
        recursive: true,
      });
    });

    it('does not recreate directory if it already exists', () => {
      // First call for dir check returns true, token file check returns false
      mockExistsSync.mockReturnValue(true);
      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });

      gitAskPassService.initialize();

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('writes platform-specific script on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });

      gitAskPassService.initialize();

      // Should write script file
      const scriptCall = mockWriteFileSync.mock.calls.find((call: unknown[]) =>
        (call[0] as string).endsWith('.bat')
      );
      expect(scriptCall).toBeDefined();
      expect(scriptCall![1]).toContain('@echo off');
      expect(scriptCall![1]).toContain('findstr /i "username"');
      expect(scriptCall![1]).toContain('x-access-token');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('writes platform-specific script on Unix', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });

      gitAskPassService.initialize();

      // Should write script file
      const scriptCall = mockWriteFileSync.mock.calls.find((call: unknown[]) =>
        (call[0] as string).endsWith('.sh')
      );
      expect(scriptCall).toBeDefined();
      expect(scriptCall![1]).toContain('#!/bin/sh');
      expect(scriptCall![1]).toContain('x-access-token');
      expect(scriptCall![1]).toContain('*sername*)');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('writes token file with restricted permissions when token exists', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'my-secret-token' });

      gitAskPassService.initialize();

      const tokenCall = mockWriteFileSync.mock.calls.find((call: unknown[]) =>
        (call[0] as string).includes('git-token.txt')
      );
      expect(tokenCall).toBeDefined();
      expect(tokenCall![1]).toBe('my-secret-token');
      expect(tokenCall![2]).toEqual({ mode: 0o600 });
    });

    it('does not write token file when no token configured', () => {
      mockGetAllSettings.mockReturnValue({});
      mockEnvGet.mockReturnValue(undefined);

      gitAskPassService.initialize();

      const tokenCall = mockWriteFileSync.mock.calls.find((call: unknown[]) =>
        (call[0] as string).includes('git-token.txt')
      );
      expect(tokenCall).toBeUndefined();
    });

    it('reads token from GITHUB_TOKEN env when DB has no token', () => {
      mockGetAllSettings.mockReturnValue({});
      mockEnvGet.mockImplementation((key: string) =>
        key === 'GITHUB_TOKEN' ? 'env-token' : undefined
      );

      gitAskPassService.initialize();

      const tokenCall = mockWriteFileSync.mock.calls.find((call: unknown[]) =>
        (call[0] as string).includes('git-token.txt')
      );
      expect(tokenCall).toBeDefined();
      expect(tokenCall![1]).toBe('env-token');
    });

    it('script content contains no secrets', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'super-secret-token' });

      gitAskPassService.initialize();

      // Find the script write call (not the token file)
      const scriptCall = mockWriteFileSync.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as string).endsWith('.sh') || (call[0] as string).endsWith('.bat')
      );
      expect(scriptCall).toBeDefined();
      expect(scriptCall![1]).not.toContain('super-secret-token');
    });
  });

  describe('getAskPassEnv', () => {
    it('returns GIT_ASKPASS and GIT_TERMINAL_PROMPT when initialized with token', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });
      // Token file exists after initialization
      mockExistsSync.mockReturnValue(false); // dir doesn't exist at first

      gitAskPassService.initialize();

      // After initialization, token file should exist
      mockExistsSync.mockReturnValue(true);

      const env = gitAskPassService.getAskPassEnv();

      expect(env).toHaveProperty('GIT_ASKPASS');
      expect(env).toHaveProperty('GIT_TERMINAL_PROMPT', '0');
      expect(env.GIT_ASKPASS).toContain('git-askpass');
      // Should override credential.helper to prevent GCM from intercepting
      expect(env).toHaveProperty('GIT_CONFIG_COUNT', '1');
      expect(env).toHaveProperty('GIT_CONFIG_KEY_0', 'credential.helper');
      expect(env).toHaveProperty('GIT_CONFIG_VALUE_0', '');
    });

    it('returns empty object when not initialized', () => {
      // Don't call initialize
      gitAskPassService.cleanup(); // Reset state
      const env = gitAskPassService.getAskPassEnv();
      expect(env).toEqual({});
    });

    it('returns empty object when token file does not exist', () => {
      mockGetAllSettings.mockReturnValue({});

      gitAskPassService.initialize();
      // Token file doesn't exist (no token was set)
      mockExistsSync.mockReturnValue(false);

      const env = gitAskPassService.getAskPassEnv();
      expect(env).toEqual({});
    });
  });

  describe('updateToken', () => {
    it('writes new token file when token provided', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'initial-token' });
      gitAskPassService.initialize();
      mockWriteFileSync.mockClear();

      gitAskPassService.updateToken('new-token');

      const tokenCall = mockWriteFileSync.mock.calls.find((call: unknown[]) =>
        (call[0] as string).includes('git-token.txt')
      );
      expect(tokenCall).toBeDefined();
      expect(tokenCall![1]).toBe('new-token');
      expect(tokenCall![2]).toEqual({ mode: 0o600 });
    });

    it('removes token file when null passed', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'initial-token' });
      gitAskPassService.initialize();

      // Token file exists
      mockExistsSync.mockReturnValue(true);

      gitAskPassService.updateToken(null);

      expect(mockUnlinkSync).toHaveBeenCalledWith(expect.stringContaining('git-token.txt'));
    });

    it('does nothing when null passed and token file does not exist', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'initial-token' });
      gitAskPassService.initialize();

      mockExistsSync.mockReturnValue(false);

      gitAskPassService.updateToken(null);

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('does nothing when not initialized', () => {
      gitAskPassService.cleanup();
      mockWriteFileSync.mockClear();

      gitAskPassService.updateToken('token');

      // No token file write (only script writes during init, not after cleanup)
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes askpass directory recursively', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });
      gitAskPassService.initialize();

      mockExistsSync.mockReturnValue(true);

      gitAskPassService.cleanup();

      expect(mockRmSync).toHaveBeenCalledWith(expect.stringContaining('git-askpass'), {
        recursive: true,
        force: true,
      });
    });

    it('does not throw when directory does not exist', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });
      gitAskPassService.initialize();

      mockExistsSync.mockReturnValue(false);

      expect(() => gitAskPassService.cleanup()).not.toThrow();
    });

    it('handles fs errors gracefully', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });
      gitAskPassService.initialize();

      mockExistsSync.mockReturnValue(true);
      mockRmSync.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      expect(() => gitAskPassService.cleanup()).not.toThrow();
    });

    it('resets initialized state so getAskPassEnv returns empty', () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'test-token' });
      gitAskPassService.initialize();

      gitAskPassService.cleanup();

      const env = gitAskPassService.getAskPassEnv();
      expect(env).toEqual({});
    });
  });
});
