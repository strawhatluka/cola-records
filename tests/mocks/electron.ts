/**
 * Electron Module Mocks
 *
 * Provides mock implementations for Electron modules used in main process tests.
 * These mocks are used via vi.mock('electron', ...) in individual test files.
 */
import { vi } from 'vitest';

export const mockApp = {
  getPath: vi.fn((name: string) => {
    if (name === 'userData') return '/mock/user-data';
    if (name === 'home') return '/mock/home';
    if (name === 'exe') return '/mock/exe/path';
    return `/mock/${name}`;
  }),
  getVersion: vi.fn(() => '1.0.0'),
  quit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  isReady: vi.fn(() => true),
  whenReady: vi.fn(() => Promise.resolve()),
  isPackaged: false,
  commandLine: {
    appendSwitch: vi.fn(),
  },
};

export const mockBrowserWindow = {
  getAllWindows: vi.fn(() => []),
  webContents: {
    send: vi.fn(),
  },
};

export const mockIpcMain = {
  handle: vi.fn(),
  removeHandler: vi.fn(),
  on: vi.fn(),
};

export const mockDialog = {
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showMessageBox: vi.fn(),
};

export const mockShell = {
  openExternal: vi.fn(),
  openPath: vi.fn(),
};

export const mockSafeStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
  decryptString: vi.fn((buffer: Buffer) => buffer.toString().replace('encrypted:', '')),
};

/**
 * Create the full Electron mock object for vi.mock('electron', ...)
 */
export function createElectronMock() {
  return {
    app: mockApp,
    BrowserWindow: vi.fn(() => mockBrowserWindow),
    ipcMain: mockIpcMain,
    dialog: mockDialog,
    shell: mockShell,
    safeStorage: mockSafeStorage,
    contextBridge: {
      exposeInMainWorld: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  };
}

/**
 * Create mock for electron-updater autoUpdater
 */
export function createAutoUpdaterMock() {
  return {
    autoUpdater: {
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
      on: vi.fn(),
      autoDownload: false,
      autoInstallOnAppQuit: true,
    },
  };
}
