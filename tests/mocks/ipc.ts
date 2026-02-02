/**
 * IPC Client Mock
 *
 * Mocks the renderer-side IPC client (src/renderer/ipc/client.ts).
 * Usage: vi.mock('../../src/renderer/ipc/client', () => ({ ipc: createMockIpc() }))
 */
import { vi } from 'vitest';

export function createMockIpc() {
  return {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()), // Returns unsubscribe
    platform: 'win32' as NodeJS.Platform,
    isDevelopment: true,
  };
}

/**
 * Helper to type-safely mock specific IPC responses.
 *
 * Example:
 *   const mockIpc = createMockIpc();
 *   mockIpcResponse(mockIpc, 'settings:get', { theme: 'dark', ... });
 */
export function mockIpcResponse(
  mockIpc: ReturnType<typeof createMockIpc>,
  channel: string,
  response: unknown
) {
  mockIpc.invoke.mockImplementation(async (ch: string) => {
    if (ch === channel) return response;
    return undefined;
  });
}

/**
 * Helper to mock multiple IPC channel responses.
 *
 * Example:
 *   mockIpcResponses(mockIpc, {
 *     'settings:get': { theme: 'dark' },
 *     'contribution:get-all': [],
 *   });
 */
export function mockIpcResponses(
  mockIpc: ReturnType<typeof createMockIpc>,
  responses: Record<string, unknown>
) {
  mockIpc.invoke.mockImplementation(async (channel: string) => {
    return responses[channel];
  });
}
