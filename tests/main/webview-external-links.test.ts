// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Track app.on registrations and shell.openExternal calls
type AppEventCallback = (...args: unknown[]) => void;
const appOnCalls: Array<{ event: string; callback: AppEventCallback }> = [];
const mockOpenExternal = vi.fn();

vi.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch: vi.fn(),
    },
    on: (event: string, cb: AppEventCallback) => {
      appOnCalls.push({ event, callback: cb });
    },
    quit: vi.fn(),
    getPath: () => '/mock/path',
    setPath: vi.fn(),
    isPackaged: false,
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    webContents: {
      openDevTools: vi.fn(),
      on: vi.fn(),
    },
  })),
  shell: {
    openExternal: mockOpenExternal,
  },
}));

// Mock all services imported by index.ts
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

vi.mock('electron-squirrel-startup', () => ({ default: false }));

describe('Webview external link handling', () => {
  beforeEach(() => {
    appOnCalls.length = 0;
    mockOpenExternal.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers web-contents-created handler on app', async () => {
    await import('../../src/main/index');

    const handler = appOnCalls.find((c) => c.event === 'web-contents-created');
    expect(handler).toBeDefined();
  }, 30000);

  it('calls shell.openExternal for https URLs', async () => {
    await import('../../src/main/index');

    const handler = appOnCalls.find((c) => c.event === 'web-contents-created');
    expect(handler).toBeDefined();

    // Simulate webContents creation — the handler calls setWindowOpenHandler on the contents
    let windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;
    const mockContents = {
      setWindowOpenHandler: (fn: (details: { url: string }) => { action: string }) => {
        windowOpenHandler = fn;
      },
    };

    handler!.callback({}, mockContents);
    expect(windowOpenHandler).toBeDefined();

    windowOpenHandler!({ url: 'https://github.com/some/repo' });
    expect(mockOpenExternal).toHaveBeenCalledWith('https://github.com/some/repo');
  }, 30000);

  it('calls shell.openExternal for http URLs', async () => {
    await import('../../src/main/index');

    const handler = appOnCalls.find((c) => c.event === 'web-contents-created');
    let windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;
    const mockContents = {
      setWindowOpenHandler: (fn: (details: { url: string }) => { action: string }) => {
        windowOpenHandler = fn;
      },
    };

    handler!.callback({}, mockContents);
    windowOpenHandler!({ url: 'http://example.com' });
    expect(mockOpenExternal).toHaveBeenCalledWith('http://example.com');
  }, 30000);

  it('denies all new window requests', async () => {
    await import('../../src/main/index');

    const handler = appOnCalls.find((c) => c.event === 'web-contents-created');
    let windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;
    const mockContents = {
      setWindowOpenHandler: (fn: (details: { url: string }) => { action: string }) => {
        windowOpenHandler = fn;
      },
    };

    handler!.callback({}, mockContents);

    // All URLs should return deny
    expect(windowOpenHandler!({ url: 'https://github.com' })).toEqual({ action: 'deny' });
    expect(windowOpenHandler!({ url: 'http://example.com' })).toEqual({ action: 'deny' });
    expect(windowOpenHandler!({ url: 'file:///etc/passwd' })).toEqual({ action: 'deny' });
  }, 30000);

  it('does not call shell.openExternal for non-http protocols', async () => {
    await import('../../src/main/index');

    const handler = appOnCalls.find((c) => c.event === 'web-contents-created');
    let windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;
    const mockContents = {
      setWindowOpenHandler: (fn: (details: { url: string }) => { action: string }) => {
        windowOpenHandler = fn;
      },
    };

    handler!.callback({}, mockContents);

    windowOpenHandler!({ url: 'file:///etc/passwd' });
    expect(mockOpenExternal).not.toHaveBeenCalled();

    windowOpenHandler!({ url: 'javascript:alert(1)' });
    expect(mockOpenExternal).not.toHaveBeenCalled();

    windowOpenHandler!({ url: 'data:text/html,<h1>test</h1>' });
    expect(mockOpenExternal).not.toHaveBeenCalled();
  }, 30000);
});
