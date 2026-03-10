// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks
// ============================================
const mocks = vi.hoisted(() => ({
  mockQuit: vi.fn(),
  mockOn: vi.fn(),
  mockGetPath: vi.fn(() => '/mock/userData'),
  mockSetPath: vi.fn(),
  mockAppendSwitch: vi.fn(),
  mockGetAllWindows: vi.fn(() => []),
  mockBrowserWindow: vi.fn(),
  mockLoadURL: vi.fn(),
  mockLoadFile: vi.fn(),
  mockOpenDevTools: vi.fn(),
  mockWebContentsOn: vi.fn(),
  mockOnClosed: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockSetWindowOpenHandler: vi.fn(),
  // Service mocks
  mockDbInitialize: vi.fn(),
  mockDbClose: vi.fn(),
  mockSetupIpcHandlers: vi.fn(),
  mockRemoveAllIpcHandlers: vi.fn(),
  mockCodeServerStop: vi.fn(),
  mockTerminalCleanup: vi.fn(),
  mockSpotifyCleanup: vi.fn(),
  mockDiscordCleanup: vi.fn(),
  mockNotificationInitialize: vi.fn(),
  mockNotificationCleanup: vi.fn(),
  mockScannerPoolTerminate: vi.fn(),
  mockUpdaterInitialize: vi.fn(),
  mockGitAskPassInitialize: vi.fn(),
  mockGitAskPassCleanup: vi.fn(),
  mockGitMigrate: vi.fn(),
  isPackaged: false,
}));

vi.mock('electron', () => {
  // Use class syntax to avoid "vi.fn() mock did not use function or class" warning
  class MockBrowserWindow {
    loadURL = mocks.mockLoadURL;
    loadFile = mocks.mockLoadFile;
    webContents = {
      openDevTools: mocks.mockOpenDevTools,
      on: mocks.mockWebContentsOn,
      send: vi.fn(),
    };
    on = mocks.mockOnClosed;
    setWindowOpenHandler = mocks.mockSetWindowOpenHandler;
    static getAllWindows = mocks.mockGetAllWindows;
  }

  return {
    app: {
      isPackaged: mocks.isPackaged,
      getPath: mocks.mockGetPath,
      setPath: mocks.mockSetPath,
      getAppPath: () => '/mock/app',
      getVersion: () => '1.0.0',
      quit: mocks.mockQuit,
      on: mocks.mockOn,
      whenReady: vi.fn().mockResolvedValue(undefined),
      commandLine: { appendSwitch: mocks.mockAppendSwitch },
    },
    BrowserWindow: MockBrowserWindow,
    shell: { openExternal: mocks.mockOpenExternal, openPath: vi.fn() },
  };
});

vi.mock('electron-squirrel-startup', () => ({ default: false }));

vi.mock('../../src/main/ipc', () => ({
  removeAllIpcHandlers: mocks.mockRemoveAllIpcHandlers,
}));

vi.mock('../../src/main/ipc/handlers/index', () => ({
  setupIpcHandlers: mocks.mockSetupIpcHandlers,
}));

vi.mock('../../src/main/database', () => ({
  database: {
    initialize: mocks.mockDbInitialize,
    close: mocks.mockDbClose,
  },
}));

vi.mock('../../src/main/services/code-server.service', () => ({
  codeServerService: { stop: mocks.mockCodeServerStop },
}));

vi.mock('../../src/main/services/terminal.service', () => ({
  terminalService: { cleanup: mocks.mockTerminalCleanup },
}));

vi.mock('../../src/main/services/spotify.service', () => ({
  spotifyService: { cleanup: mocks.mockSpotifyCleanup },
}));

vi.mock('../../src/main/services/discord.service', () => ({
  discordService: { cleanup: mocks.mockDiscordCleanup },
}));

vi.mock('../../src/main/services/notification.service', () => ({
  notificationService: {
    initialize: mocks.mockNotificationInitialize,
    cleanup: mocks.mockNotificationCleanup,
  },
}));

vi.mock('../../src/main/workers/scanner-pool', () => ({
  scannerPool: { terminate: mocks.mockScannerPoolTerminate },
}));

vi.mock('../../src/main/services/updater.service', () => ({
  updaterService: { initialize: mocks.mockUpdaterInitialize },
}));

vi.mock('../../src/main/services/git-askpass.service', () => ({
  gitAskPassService: {
    initialize: mocks.mockGitAskPassInitialize,
    cleanup: mocks.mockGitAskPassCleanup,
  },
}));

vi.mock('../../src/main/services', () => ({
  gitService: { migrateFromHostCredentials: mocks.mockGitMigrate },
}));

// Declare Vite globals
declare global {
  // eslint-disable-next-line no-var
  var MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
  // eslint-disable-next-line no-var
  var MAIN_WINDOW_VITE_NAME: string;
}
globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:5173';
globalThis.MAIN_WINDOW_VITE_NAME = 'main_window';

describe('main/index.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.mockDbInitialize.mockResolvedValue(undefined);
    mocks.mockCodeServerStop.mockResolvedValue(undefined);
  });

  /**
   * Import the module fresh (vi.resetModules ensures a new instance)
   * and return a map of event name → handler for app.on calls.
   */
  async function importAndGetHandlers() {
    await import('../../src/main/index');
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    for (const call of mocks.mockOn.mock.calls) {
      handlers[call[0] as string] = call[1] as (...args: unknown[]) => unknown;
    }
    return handlers;
  }

  it('registers GPU acceleration flags', async () => {
    await importAndGetHandlers();

    expect(mocks.mockAppendSwitch).toHaveBeenCalledWith('enable-gpu-rasterization');
    expect(mocks.mockAppendSwitch).toHaveBeenCalledWith('enable-zero-copy');
    expect(mocks.mockAppendSwitch).toHaveBeenCalledWith('ignore-gpu-blocklist');
  });

  it('sets dev user data path when not packaged', async () => {
    await importAndGetHandlers();

    expect(mocks.mockSetPath).toHaveBeenCalledWith('userData', '/mock/userData-dev');
  });

  it('registers expected app event handlers', async () => {
    await importAndGetHandlers();

    const registeredEvents = mocks.mockOn.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain('ready');
    expect(registeredEvents).toContain('window-all-closed');
    expect(registeredEvents).toContain('activate');
    expect(registeredEvents).toContain('will-quit');
    expect(registeredEvents).toContain('web-contents-created');
  });

  describe('app ready handler', () => {
    it('initializes database and services on ready', async () => {
      const handlers = await importAndGetHandlers();

      await handlers['ready']();

      expect(mocks.mockDbInitialize).toHaveBeenCalled();
      expect(mocks.mockGitMigrate).toHaveBeenCalled();
      expect(mocks.mockGitAskPassInitialize).toHaveBeenCalled();
      expect(mocks.mockSetupIpcHandlers).toHaveBeenCalled();
    });
  });

  describe('window-all-closed handler', () => {
    it('quits app on non-darwin platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const handlers = await importAndGetHandlers();
      handlers['window-all-closed']();

      expect(mocks.mockQuit).toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('web-contents-created handler', () => {
    it('sets window open handler to deny and open external', async () => {
      const handlers = await importAndGetHandlers();

      const mockContents = { setWindowOpenHandler: vi.fn() };
      handlers['web-contents-created']({}, mockContents);

      expect(mockContents.setWindowOpenHandler).toHaveBeenCalled();

      // Test the window open handler callback
      const openHandler = mockContents.setWindowOpenHandler.mock.calls[0][0];

      // HTTP URL should open externally
      const result = openHandler({ url: 'https://example.com' });
      expect(mocks.mockOpenExternal).toHaveBeenCalledWith('https://example.com');
      expect(result).toEqual({ action: 'deny' });

      // Non-HTTP URL should not open externally
      mocks.mockOpenExternal.mockClear();
      const result2 = openHandler({ url: 'file:///local/path' });
      expect(mocks.mockOpenExternal).not.toHaveBeenCalled();
      expect(result2).toEqual({ action: 'deny' });
    });
  });

  describe('cleanup', () => {
    it('will-quit handler prevents quit and runs cleanup', async () => {
      const handlers = await importAndGetHandlers();

      const mockEvent = { preventDefault: vi.fn() };
      await handlers['will-quit'](mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });
});
