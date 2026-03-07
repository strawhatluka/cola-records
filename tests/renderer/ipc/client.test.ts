import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('IpcClient', () => {
  const mockInvoke = vi.fn();
  const mockSend = vi.fn();
  const mockOn = vi.fn(() => vi.fn());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup window.electronAPI and window.process
    Object.defineProperty(globalThis, 'window', {
      value: {
        electronAPI: {
          invoke: mockInvoke,
          send: mockSend,
          on: mockOn,
        },
        process: {
          platform: 'linux',
          env: {
            NODE_ENV: 'development',
          },
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('invoke delegates to window.electronAPI.invoke', async () => {
    mockInvoke.mockResolvedValue([]);

    const { ipc } = await import('../../../src/renderer/ipc/client');
    const result = await ipc.invoke('contribution:get-all');

    expect(mockInvoke).toHaveBeenCalledWith('contribution:get-all');
    expect(result).toEqual([]);
  });

  it('send delegates to window.electronAPI.send', async () => {
    const { ipc } = await import('../../../src/renderer/ipc/client');
    // send uses the same signature, cast to test delegation
    (ipc as any).send('test-channel', 'data');

    expect(mockSend).toHaveBeenCalledWith('test-channel', 'data');
  });

  it('on delegates to window.electronAPI.on', async () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    mockOn.mockReturnValue(unsubscribe);

    const { ipc } = await import('../../../src/renderer/ipc/client');
    const result = ipc.on('test-channel', callback);

    expect(mockOn).toHaveBeenCalledWith('test-channel', callback);
    expect(result).toBe(unsubscribe);
  });

  it('platform returns window.process.platform', async () => {
    const { ipc } = await import('../../../src/renderer/ipc/client');
    expect(ipc.platform).toBe('linux');
  });

  it('isDevelopment returns true when NODE_ENV is development', async () => {
    const { ipc } = await import('../../../src/renderer/ipc/client');
    expect(ipc.isDevelopment).toBe(true);
  });

  it('isDevelopment returns false when NODE_ENV is production', async () => {
    (globalThis as any).window.process.env.NODE_ENV = 'production';
    const { ipc } = await import('../../../src/renderer/ipc/client');
    expect(ipc.isDevelopment).toBe(false);
  });
});
