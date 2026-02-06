import type { IpcChannels } from '../../main/ipc/channels';

/**
 * Renderer IPC Client
 *
 * Type-safe wrapper around the exposed electronAPI from the preload script
 */

// Extend the Window interface to include our exposed API
declare global {
  interface Window {
    electronAPI: {
      invoke: <K extends keyof IpcChannels>(
        channel: K,
        ...args: Parameters<IpcChannels[K]>
      ) => Promise<ReturnType<IpcChannels[K]>>;
      send: <K extends keyof IpcChannels>(channel: K, ...args: Parameters<IpcChannels[K]>) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
    process: {
      platform: NodeJS.Platform;
      env: {
        NODE_ENV?: string;
      };
    };
  }
}

/**
 * IPC Client class for renderer process
 *
 * Provides a clean API for invoking IPC calls from the renderer
 */
class IpcClient {
  /**
   * Invoke an IPC call (request-response pattern)
   */
  async invoke<K extends keyof IpcChannels>(
    channel: K,
    ...args: Parameters<IpcChannels[K]>
  ): Promise<ReturnType<IpcChannels[K]>> {
    return window.electronAPI.invoke(channel, ...args);
  }

  /**
   * Send an IPC message (one-way)
   */
  send<K extends keyof IpcChannels>(channel: K, ...args: Parameters<IpcChannels[K]>): void {
    window.electronAPI.send(channel, ...args);
  }

  /**
   * Listen for IPC events from main process
   */
  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    return window.electronAPI.on(channel, callback);
  }

  /**
   * Get platform information
   */
  get platform(): NodeJS.Platform {
    return window.process.platform;
  }

  /**
   * Check if running in development mode
   */
  get isDevelopment(): boolean {
    return window.process.env.NODE_ENV === 'development';
  }
}

// Export singleton instance
export const ipc = new IpcClient();
