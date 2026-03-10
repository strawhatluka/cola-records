import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockRemoveHandler: vi.fn(),
  mockWebContentsSend: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.mockHandle,
    removeHandler: mocks.mockRemoveHandler,
  },
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    getPath: () => '/mock/path',
    getAppPath: () => '/mock/app',
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
    commandLine: { appendSwitch: vi.fn() },
  },
  BrowserWindow: vi.fn(),
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
}));

import {
  handleIpc,
  removeIpcHandler,
  removeAllIpcHandlers,
  sendToRenderer,
} from '../../../src/main/ipc/handlers';

describe('handlers.ts wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleIpc', () => {
    it('registers a handler via ipcMain.handle', () => {
      const handler = vi.fn();
      handleIpc('echo' as never, handler as never);
      expect(mocks.mockHandle).toHaveBeenCalledWith('echo', handler);
    });
  });

  describe('removeIpcHandler', () => {
    it('removes a handler via ipcMain.removeHandler', () => {
      removeIpcHandler('echo');
      expect(mocks.mockRemoveHandler).toHaveBeenCalledWith('echo');
    });
  });

  describe('removeAllIpcHandlers', () => {
    it('removes all registered channel handlers', () => {
      removeAllIpcHandlers();
      // Should have called removeHandler for every channel in the list
      expect(mocks.mockRemoveHandler.mock.calls.length).toBeGreaterThan(100);
      // Spot check some channels
      const removed = mocks.mockRemoveHandler.mock.calls.map((c: unknown[]) => c[0]);
      expect(removed).toContain('echo');
      expect(removed).toContain('git:status');
      expect(removed).toContain('github:get-authenticated-user');
      expect(removed).toContain('spotify:is-connected');
      expect(removed).toContain('discord:is-connected');
      expect(removed).toContain('settings:get');
      expect(removed).toContain('dev-tools:detect-project');
      expect(removed).toContain('notification:get-preferences');
    });
  });

  describe('sendToRenderer', () => {
    it('sends event to window webContents', () => {
      const mockWindow = {
        webContents: {
          send: mocks.mockWebContentsSend,
        },
      } as unknown as Electron.BrowserWindow;

      sendToRenderer(mockWindow, 'test-event', 'arg1', 'arg2');
      expect(mocks.mockWebContentsSend).toHaveBeenCalledWith('test-event', 'arg1', 'arg2');
    });
  });
});
