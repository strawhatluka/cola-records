import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type { IpcChannels } from './channels';

/**
 * Type-safe IPC handler wrapper
 *
 * Registers an IPC handler with type safety for both parameters and return type
 */
export function handleIpc<K extends keyof IpcChannels>(
  channel: K,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<IpcChannels[K]>
  ) => Promise<ReturnType<IpcChannels[K]>> | ReturnType<IpcChannels[K]>
): void {
  ipcMain.handle(channel, handler as any);
}

/**
 * Remove an IPC handler
 */
export function removeIpcHandler(channel: keyof IpcChannels): void {
  ipcMain.removeHandler(channel);
}

/**
 * Remove all IPC handlers
 */
export function removeAllIpcHandlers(): void {
  // Get all channels from IpcChannels interface
  const channels: (keyof IpcChannels)[] = [
    'echo',
    'fs:read-directory',
    'fs:read-file',
    'fs:write-file',
    'fs:delete-file',
    'fs:watch-directory',
    'fs:unwatch-directory',
    'git:status',
    'git:log',
    'git:add',
    'git:commit',
    'git:push',
    'git:pull',
    'git:clone',
    'git:checkout',
    'git:create-branch',
    'github:search-issues',
    'github:get-repository',
    'github:validate-token',
    'contribution:create',
    'contribution:get-all',
    'contribution:get-by-id',
    'contribution:update',
    'contribution:delete',
    'settings:get',
    'settings:update',
    'gitignore:is-ignored',
    'gitignore:get-patterns',
    'terminal:spawn',
    'terminal:write',
    'terminal:resize',
    'terminal:kill',
  ];

  channels.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}

/**
 * Send event to all renderer windows
 */
export function sendToRenderer(
  window: Electron.BrowserWindow,
  channel: string,
  ...args: any[]
): void {
  window.webContents.send(channel, ...args);
}
