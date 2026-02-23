import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
const mockSend = vi.fn();
const mockGetAllWindows = vi.fn();
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows(),
  },
}));

// Mock uuid - return different UUIDs for each call
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `mock-uuid-${++uuidCounter}`,
}));

// Mock os
vi.mock('os', () => ({
  homedir: () => '/mock/home',
}));

// Mock git-askpass service
const mockGetAskPassEnv = vi.fn();
vi.mock('../../../src/main/services/git-askpass.service', () => ({
  gitAskPassService: {
    getAskPassEnv: () => mockGetAskPassEnv(),
  },
}));

// Mock node-pty
const mockWrite = vi.fn();
const mockResize = vi.fn();
const mockKill = vi.fn();
const mockOnData = vi.fn();
const mockOnExit = vi.fn();

const createMockPtyInstance = () => ({
  write: mockWrite,
  resize: mockResize,
  kill: mockKill,
  onData: mockOnData,
  onExit: mockOnExit,
});

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => createMockPtyInstance()),
}));

// Import after mocks
import { terminalService } from '../../../src/main/services/terminal.service';
import * as pty from 'node-pty';

describe('TerminalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    // Reset terminal service state by killing all sessions
    terminalService.cleanup();

    // Setup default window mock
    mockGetAllWindows.mockReturnValue([{ webContents: { send: mockSend } }]);

    // Default askpass env
    mockGetAskPassEnv.mockReturnValue({
      GIT_ASKPASS: '/mock/path/git-askpass.sh',
      GIT_TERMINAL_PROMPT: '0',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    terminalService.cleanup();
  });

  describe('spawn', () => {
    it('spawns a git-bash terminal on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const session = terminalService.spawn('git-bash', '/test/dir');

      expect(session.id).toBe('mock-uuid-1');
      expect(session.shellType).toBe('git-bash');
      // The shell path depends on whether Git Bash is installed - accept either full path or fallback
      const spawnCall = vi.mocked(pty.spawn).mock.calls[0];
      expect(
        spawnCall[0] === 'C:\\Program Files\\Git\\bin\\bash.exe' ||
          spawnCall[0] === 'C:\\Program Files (x86)\\Git\\bin\\bash.exe' ||
          spawnCall[0] === 'bash.exe'
      ).toBe(true);
      expect(spawnCall[1]).toEqual(['--login', '-i']);
      expect(spawnCall[2]).toMatchObject({
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: '/test/dir',
      });

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('spawns a PowerShell terminal on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      vi.mocked(pty.spawn).mockClear();

      const session = terminalService.spawn('powershell', '/test/dir');

      expect(session.shellType).toBe('powershell');
      expect(pty.spawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoLogo'],
        expect.objectContaining({
          cwd: '/test/dir',
        })
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('spawns a CMD terminal on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      vi.mocked(pty.spawn).mockClear();

      const session = terminalService.spawn('cmd', '/test/dir');

      expect(session.shellType).toBe('cmd');
      expect(pty.spawn).toHaveBeenCalledWith(
        'cmd.exe',
        [],
        expect.objectContaining({
          cwd: '/test/dir',
        })
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('spawns zsh on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      terminalService.cleanup();
      vi.mocked(pty.spawn).mockClear();

      terminalService.spawn('git-bash', '/test/dir');

      expect(pty.spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        [],
        expect.objectContaining({ cwd: '/test/dir' })
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('spawns bash on Linux', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      terminalService.cleanup();
      vi.mocked(pty.spawn).mockClear();

      terminalService.spawn('git-bash', '/test/dir');

      expect(pty.spawn).toHaveBeenCalledWith(
        '/bin/bash',
        [],
        expect.objectContaining({ cwd: '/test/dir' })
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('includes GIT_ASKPASS env vars in PTY spawn', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      vi.mocked(pty.spawn).mockClear();

      terminalService.spawn('git-bash', '/test/dir');

      const spawnCall = vi.mocked(pty.spawn).mock.calls[0];
      const env = spawnCall[2]?.env as Record<string, string>;
      expect(env.GIT_ASKPASS).toBe('/mock/path/git-askpass.sh');
      expect(env.GIT_TERMINAL_PROMPT).toBe('0');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('preserves existing env vars alongside askpass env', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      vi.mocked(pty.spawn).mockClear();

      terminalService.spawn('git-bash', '/test/dir');

      const spawnCall = vi.mocked(pty.spawn).mock.calls[0];
      const env = spawnCall[2]?.env as Record<string, string>;
      // TERM should still be set
      expect(env.TERM).toBe('xterm-256color');
      // process.env vars should be present too
      expect(env.PATH).toBeDefined();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('works without askpass env when no token configured', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mockGetAskPassEnv.mockReturnValue({});

      terminalService.cleanup();
      vi.mocked(pty.spawn).mockClear();

      terminalService.spawn('git-bash', '/test/dir');

      const spawnCall = vi.mocked(pty.spawn).mock.calls[0];
      const env = spawnCall[2]?.env as Record<string, string>;
      expect(env.GIT_ASKPASS).toBeUndefined();
      expect(env.GIT_TERMINAL_PROMPT).toBeUndefined();
      expect(env.TERM).toBe('xterm-256color');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('registers onData callback that forwards to renderer', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      const session = terminalService.spawn('git-bash', '/test/dir');

      expect(mockOnData).toHaveBeenCalled();
      const onDataCallback = mockOnData.mock.calls[0][0];

      onDataCallback('test output');

      expect(mockSend).toHaveBeenCalledWith('terminal:data', session.id, 'test output');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('registers onExit callback that forwards to renderer and cleans up', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      const session = terminalService.spawn('git-bash', '/test/dir');

      expect(terminalService.getSessionCount()).toBe(1);

      expect(mockOnExit).toHaveBeenCalled();
      const onExitCallback = mockOnExit.mock.calls[0][0];

      onExitCallback({ exitCode: 0 });

      expect(mockSend).toHaveBeenCalledWith('terminal:exit', session.id, 0);
      expect(terminalService.getSessionCount()).toBe(0);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('handles missing window gracefully on data', () => {
      mockGetAllWindows.mockReturnValue([]);

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      terminalService.spawn('git-bash', '/test/dir');

      const onDataCallback = mockOnData.mock.calls[0][0];

      expect(() => onDataCallback('test')).not.toThrow();
      expect(mockSend).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('handles missing window gracefully on exit', () => {
      mockGetAllWindows.mockReturnValue([]);

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      terminalService.spawn('git-bash', '/test/dir');

      const onExitCallback = mockOnExit.mock.calls[0][0];

      expect(() => onExitCallback({ exitCode: 1 })).not.toThrow();
      expect(mockSend).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('write', () => {
    it('writes data to existing session', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      const session = terminalService.spawn('git-bash', '/test/dir');

      terminalService.write(session.id, 'ls -la\n');

      expect(mockWrite).toHaveBeenCalledWith('ls -la\n');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('does nothing for non-existent session', () => {
      terminalService.write('non-existent-id', 'test');

      expect(mockWrite).not.toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('resizes existing session', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      const session = terminalService.spawn('git-bash', '/test/dir');

      terminalService.resize(session.id, 120, 40);

      expect(mockResize).toHaveBeenCalledWith(120, 40);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('does nothing for non-existent session', () => {
      terminalService.resize('non-existent-id', 80, 24);

      expect(mockResize).not.toHaveBeenCalled();
    });
  });

  describe('kill', () => {
    it('kills existing session and removes from map', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      const session = terminalService.spawn('git-bash', '/test/dir');

      expect(terminalService.getSessionCount()).toBe(1);

      terminalService.kill(session.id);

      expect(mockKill).toHaveBeenCalled();
      expect(terminalService.getSessionCount()).toBe(0);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('does nothing for non-existent session', () => {
      const initialCount = terminalService.getSessionCount();
      terminalService.kill('non-existent-id');

      expect(mockKill).not.toHaveBeenCalled();
      expect(terminalService.getSessionCount()).toBe(initialCount);
    });
  });

  describe('cleanup', () => {
    it('handles errors during cleanup gracefully', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      mockKill.mockClear();
      mockKill.mockImplementationOnce(() => {
        throw new Error('Process already dead');
      });

      terminalService.spawn('git-bash', '/test/dir');

      expect(() => terminalService.cleanup()).not.toThrow();
      expect(terminalService.getSessionCount()).toBe(0);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('getSessionCount', () => {
    it('returns zero after cleanup', () => {
      terminalService.cleanup();
      expect(terminalService.getSessionCount()).toBe(0);
    });

    it('returns one after spawning', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      terminalService.cleanup();
      terminalService.spawn('git-bash', '/test/dir');
      expect(terminalService.getSessionCount()).toBe(1);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
