import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipc } from '@renderer/ipc/client';

describe('IPC Client', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should have access to electronAPI', () => {
    expect(window.electronAPI).toBeDefined();
    expect(window.electronAPI.invoke).toBeDefined();
    expect(window.electronAPI.send).toBeDefined();
    expect(window.electronAPI.on).toBeDefined();
  });

  it('should invoke IPC calls', async () => {
    const mockInvoke = vi.fn().mockResolvedValue('test response');
    window.electronAPI.invoke = mockInvoke;

    const result = await ipc.invoke('echo', 'test message');

    expect(mockInvoke).toHaveBeenCalledWith('echo', 'test message');
    expect(result).toBe('test response');
  });

  it('should send IPC messages', () => {
    const mockSend = vi.fn();
    window.electronAPI.send = mockSend;

    ipc.send('echo', 'test message');

    expect(mockSend).toHaveBeenCalledWith('echo', 'test message');
  });

  it('should register event listeners', () => {
    const mockOn = vi.fn().mockReturnValue(() => {});
    window.electronAPI.on = mockOn;

    const callback = vi.fn();
    const unsubscribe = ipc.on('test-event', callback);

    expect(mockOn).toHaveBeenCalledWith('test-event', callback);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should get platform information', () => {
    expect(ipc.platform).toBeDefined();
    expect(typeof ipc.platform).toBe('string');
  });

  it('should check development mode', () => {
    expect(typeof ipc.isDevelopment).toBe('boolean');
  });
});
