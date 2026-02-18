// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Track appendSwitch calls in order
const appendSwitchCalls: string[] = [];
const readyCallbacks: (() => void)[] = [];
const mockQuit = vi.fn();

// Mock electron module
vi.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch: (flag: string) => {
        appendSwitchCalls.push(flag);
      },
    },
    on: (event: string, cb: () => void) => {
      if (event === 'ready') {
        readyCallbacks.push(cb);
      }
    },
    quit: mockQuit,
    getPath: () => '/mock/path',
    setPath: vi.fn(),
    isPackaged: false,
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    webContents: { openDevTools: vi.fn() },
  })),
  shell: {
    showItemInFolder: vi.fn(),
    openExternal: vi.fn(),
  },
}));

// Mock all the services that are imported by index.ts
vi.mock('../../src/main/ipc', () => ({
  handleIpc: vi.fn(),
  removeAllIpcHandlers: vi.fn(),
}));

vi.mock('../../src/main/database', () => ({
  database: {
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    getAllSettings: vi.fn().mockReturnValue({}),
    setSetting: vi.fn(),
    createContribution: vi.fn(),
    getAllContributions: vi.fn().mockReturnValue([]),
    getContributionById: vi.fn(),
    updateContribution: vi.fn(),
    deleteContribution: vi.fn(),
    getContributionsByType: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../src/main/services', () => ({
  fileSystemService: {},
  gitService: {},
  gitIgnoreService: {},
  gitHubService: {},
}));

vi.mock('../../src/main/services/github-graphql.service', () => ({
  gitHubGraphQLService: { resetClient: vi.fn() },
}));

vi.mock('../../src/main/services/code-server.service', () => ({
  codeServerService: { stop: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../src/main/services/spotify.service', () => ({
  spotifyService: { cleanup: vi.fn() },
}));

vi.mock('../../src/main/services/discord.service', () => ({
  discordService: { cleanup: vi.fn() },
}));

vi.mock('../../src/main/workers/scanner-pool', () => ({
  scannerPool: { terminate: vi.fn() },
}));

// Mock electron-squirrel-startup
vi.mock('electron-squirrel-startup', () => ({ default: false }));

describe('Electron GPU Configuration', () => {
  beforeEach(() => {
    // Clear call tracking
    appendSwitchCalls.length = 0;
    readyCallbacks.length = 0;
    mockQuit.mockClear();

    // Reset module cache to re-run module initialization
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sets enable-gpu-rasterization flag', async () => {
    // Import the main module to trigger flag setting
    await import('../../src/main/index');

    expect(appendSwitchCalls).toContain('enable-gpu-rasterization');
  }, 30000);

  it('sets enable-zero-copy flag', async () => {
    await import('../../src/main/index');

    expect(appendSwitchCalls).toContain('enable-zero-copy');
  }, 30000);

  it('sets ignore-gpu-blocklist flag', async () => {
    await import('../../src/main/index');

    expect(appendSwitchCalls).toContain('ignore-gpu-blocklist');
  }, 30000);

  it('sets GPU flags BEFORE app.on("ready") is registered', async () => {
    // The GPU flags must be set before app.ready handlers fire
    // By the time we import, the flags should already be in appendSwitchCalls

    await import('../../src/main/index');

    // All three GPU flags should be set
    expect(appendSwitchCalls).toContain('enable-gpu-rasterization');
    expect(appendSwitchCalls).toContain('enable-zero-copy');
    expect(appendSwitchCalls).toContain('ignore-gpu-blocklist');

    // The flags should be the first three calls (set at module load time)
    expect(appendSwitchCalls.slice(0, 3)).toEqual([
      'enable-gpu-rasterization',
      'enable-zero-copy',
      'ignore-gpu-blocklist',
    ]);
  }, 30000);
});
