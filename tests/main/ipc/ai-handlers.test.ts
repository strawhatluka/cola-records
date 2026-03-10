import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  mockComplete: vi.fn(),
  mockTestConnection: vi.fn(),
  mockGetConfig: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services/ai.service', () => ({
  aiService: {
    complete: mocks.mockComplete,
    testConnection: mocks.mockTestConnection,
    getConfig: mocks.mockGetConfig,
  },
}));

import { setupAIHandlers } from '../../../src/main/ipc/handlers/ai.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('ai.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAIHandlers();
  });

  it('registers all 3 handlers', () => {
    expect(mocks.mockHandleIpc).toHaveBeenCalledTimes(3);
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('ai:complete');
    expect(channels).toContain('ai:test-connection');
    expect(channels).toContain('ai:get-config');
  });

  it('ai:complete delegates to aiService.complete with object arg', async () => {
    const mockResult = { text: 'Generated response', tokens: 50 };
    mocks.mockComplete.mockResolvedValue(mockResult);

    const handler = getHandler('ai:complete');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'Write a haiku', 100);

    expect(mocks.mockComplete).toHaveBeenCalledWith({ prompt: 'Write a haiku', maxTokens: 100 });
    expect(result).toBe(mockResult);
  });

  it('ai:test-connection delegates to aiService.testConnection', async () => {
    mocks.mockTestConnection.mockResolvedValue({ success: true, provider: 'openai' });

    const handler = getHandler('ai:test-connection');
    expect(handler).toBeDefined();
    const result = await handler!({});

    expect(mocks.mockTestConnection).toHaveBeenCalled();
    expect(result).toEqual({ success: true, provider: 'openai' });
  });

  it('ai:get-config delegates to aiService.getConfig', async () => {
    const mockConfig = { provider: 'openai', model: 'gpt-4' };
    mocks.mockGetConfig.mockReturnValue(mockConfig);

    const handler = getHandler('ai:get-config');
    expect(handler).toBeDefined();
    const result = await handler!({});

    expect(mocks.mockGetConfig).toHaveBeenCalled();
    expect(result).toBe(mockConfig);
  });
});
