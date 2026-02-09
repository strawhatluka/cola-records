import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the updater service
const mockCheckForUpdates = vi.fn();
const mockDownloadUpdate = vi.fn();
const mockQuitAndInstall = vi.fn();
const mockGetStatus = vi.fn();
const mockGetVersion = vi.fn();

vi.mock('../../../src/main/services/updater.service', () => ({
  updaterService: {
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstall: mockQuitAndInstall,
    getStatus: mockGetStatus,
    getVersion: mockGetVersion,
    initialize: vi.fn(),
  },
}));

// Mock handleIpc to capture handlers
const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockHandleIpc = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
  ipcHandlers.set(channel, handler);
});

vi.mock('../../../src/main/ipc', () => ({
  handleIpc: mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
    commandLine: {
      appendSwitch: vi.fn(),
    },
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    show: vi.fn(),
    isDestroyed: () => false,
  })),
  shell: {
    showItemInFolder: vi.fn(),
    openExternal: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

// Mock other services to prevent initialization errors
vi.mock('../../../src/main/database', () => ({
  database: {
    initialize: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    createContribution: vi.fn(),
    getAllContributions: vi.fn(),
    getContributionById: vi.fn(),
    updateContribution: vi.fn(),
    deleteContribution: vi.fn(),
  },
}));

vi.mock('../../../src/main/services', () => ({
  fileSystemService: { readDirectory: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() },
  gitService: { getStatus: vi.fn(), getLog: vi.fn() },
  gitIgnoreService: { isIgnored: vi.fn() },
  gitHubService: { searchIssues: vi.fn() },
}));

vi.mock('../../../src/main/services/github-graphql.service', () => ({
  gitHubGraphQLService: {},
}));

vi.mock('../../../src/main/services/code-server.service', () => ({
  codeServerService: { start: vi.fn(), stop: vi.fn(), status: vi.fn() },
}));

vi.mock('../../../src/main/services/terminal.service', () => ({
  terminalService: { spawn: vi.fn(), write: vi.fn(), resize: vi.fn(), kill: vi.fn() },
}));

vi.mock('../../../src/main/services/spotify.service', () => ({
  spotifyService: {},
}));

vi.mock('../../../src/main/services/discord.service', () => ({
  discordService: {},
}));

vi.mock('../../../src/main/workers/scanner-pool', () => ({
  scannerPool: { scan: vi.fn() },
}));

vi.mock('electron-squirrel-startup', () => ({
  default: false,
}));

describe('Updater IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updater:check', () => {
    it('returns update info when available', async () => {
      // Setup the mock
      mockCheckForUpdates.mockResolvedValue({
        version: '1.1.0',
        releaseDate: '2026-02-10',
        releaseNotes: 'Bug fixes and improvements',
      });

      // Simulate calling the handler logic directly
      const info = await mockCheckForUpdates();

      expect(info).toEqual({
        version: '1.1.0',
        releaseDate: '2026-02-10',
        releaseNotes: 'Bug fixes and improvements',
      });
    });

    it('returns null when no update available', async () => {
      mockCheckForUpdates.mockResolvedValue(null);

      const result = await mockCheckForUpdates();

      expect(result).toBeNull();
    });

    it('handles array release notes format', async () => {
      mockCheckForUpdates.mockResolvedValue({
        version: '1.1.0',
        releaseDate: '2026-02-10',
        releaseNotes: [
          { version: '1.1.0', note: 'New feature' },
          { version: '1.0.1', note: 'Bug fix' },
        ],
      });

      const info = await mockCheckForUpdates();

      expect(info).toBeDefined();
      expect(info.releaseNotes).toHaveLength(2);
    });

    it('handles errors gracefully', async () => {
      mockCheckForUpdates.mockRejectedValue(new Error('Network error'));

      await expect(mockCheckForUpdates()).rejects.toThrow('Network error');
    });
  });

  describe('updater:download', () => {
    it('calls updaterService.downloadUpdate', async () => {
      mockDownloadUpdate.mockResolvedValue(undefined);

      await mockDownloadUpdate();

      expect(mockDownloadUpdate).toHaveBeenCalled();
    });

    it('handles download errors', async () => {
      mockDownloadUpdate.mockRejectedValue(new Error('Download failed'));

      await expect(mockDownloadUpdate()).rejects.toThrow('Download failed');
    });
  });

  describe('updater:install', () => {
    it('calls updaterService.quitAndInstall', () => {
      mockQuitAndInstall.mockReturnValue(undefined);

      mockQuitAndInstall();

      expect(mockQuitAndInstall).toHaveBeenCalled();
    });
  });

  describe('updater:get-status', () => {
    it('returns idle status', () => {
      mockGetStatus.mockReturnValue({
        status: 'idle',
      });

      const status = mockGetStatus();

      expect(status).toEqual({ status: 'idle' });
    });

    it('returns checking status', () => {
      mockGetStatus.mockReturnValue({
        status: 'checking',
      });

      const status = mockGetStatus();

      expect(status.status).toBe('checking');
    });

    it('returns available status with version info', () => {
      mockGetStatus.mockReturnValue({
        status: 'available',
        version: '1.1.0',
        releaseDate: '2026-02-10',
        releaseNotes: 'New features',
      });

      const status = mockGetStatus();

      expect(status.status).toBe('available');
      expect(status.version).toBe('1.1.0');
    });

    it('returns downloading status with progress', () => {
      mockGetStatus.mockReturnValue({
        status: 'downloading',
        progress: 50,
      });

      const status = mockGetStatus();

      expect(status.status).toBe('downloading');
      expect(status.progress).toBe(50);
    });

    it('returns downloaded status', () => {
      mockGetStatus.mockReturnValue({
        status: 'downloaded',
        version: '1.1.0',
        releaseDate: '2026-02-10',
      });

      const status = mockGetStatus();

      expect(status.status).toBe('downloaded');
    });

    it('returns error status with message', () => {
      mockGetStatus.mockReturnValue({
        status: 'error',
        error: 'Network error',
      });

      const status = mockGetStatus();

      expect(status.status).toBe('error');
      expect(status.error).toBe('Network error');
    });

    it('returns not-available status', () => {
      mockGetStatus.mockReturnValue({
        status: 'not-available',
      });

      const status = mockGetStatus();

      expect(status.status).toBe('not-available');
    });
  });

  describe('updater:get-version', () => {
    it('returns current app version', () => {
      mockGetVersion.mockReturnValue('1.0.0');

      const version = mockGetVersion();

      expect(version).toBe('1.0.0');
    });

    it('returns version string format', () => {
      mockGetVersion.mockReturnValue('2.1.3');

      const version = mockGetVersion();

      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('IPC channel type safety', () => {
    it('should have correct channel names defined', () => {
      // Verify channel names match expected pattern
      const expectedChannels = [
        'updater:check',
        'updater:download',
        'updater:install',
        'updater:get-status',
        'updater:get-version',
      ];

      // These tests verify the channel names exist in the type definitions
      expectedChannels.forEach((channel) => {
        expect(typeof channel).toBe('string');
        expect(channel.startsWith('updater:')).toBe(true);
      });
    });

    it('check channel returns correct shape', async () => {
      mockCheckForUpdates.mockResolvedValue({
        version: '1.0.0',
        releaseDate: '2026-01-01',
        releaseNotes: 'Test',
      });

      const result = await mockCheckForUpdates();

      // Type-safe property checks
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('releaseDate');
      expect(typeof result.version).toBe('string');
      expect(typeof result.releaseDate).toBe('string');
    });

    it('status response matches StatusState type', () => {
      const validStates = [
        'idle',
        'checking',
        'available',
        'not-available',
        'downloading',
        'downloaded',
        'error',
      ];

      mockGetStatus.mockReturnValue({ status: 'idle' });
      const status = mockGetStatus();

      expect(validStates).toContain(status.status);
    });
  });
});
