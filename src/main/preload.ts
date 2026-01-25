import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels } from './ipc/channels';

// Expose protected methods that allow the renderer process to use ipcRenderer
// without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke IPC calls (request-response pattern)
  invoke: <K extends keyof IpcChannels>(
    channel: K,
    ...args: Parameters<IpcChannels[K]>
  ): Promise<ReturnType<IpcChannels[K]>> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // Send IPC calls (one-way message)
  send: <K extends keyof IpcChannels>(
    channel: K,
    ...args: Parameters<IpcChannels[K]>
  ): void => {
    ipcRenderer.send(channel, ...args);
  },

  // Listen for events from main process
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
});

// Expose Node.js process information
contextBridge.exposeInMainWorld('process', {
  platform: process.platform,
  env: {
    NODE_ENV: process.env.NODE_ENV,
  },
});
