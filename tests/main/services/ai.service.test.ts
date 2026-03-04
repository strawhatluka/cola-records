import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    create: () => ({
      scope: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }),
  },
}));

// Mock database - matches actual import path in ai.service.ts: import { database } from '../database'
const mockGetSetting = vi.fn();
vi.mock('../../../src/main/database', () => ({
  database: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { aiService, DEFAULT_MODELS } from '../../../src/main/services/ai.service';

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_MODELS', () => {
    it('should have models for all providers', () => {
      expect(DEFAULT_MODELS.gemini).toContain('gemini-2.5-flash');
      expect(DEFAULT_MODELS.anthropic).toContain('claude-sonnet-4-5-20250929');
      expect(DEFAULT_MODELS.openai).toContain('gpt-4o');
      expect(DEFAULT_MODELS.ollama).toEqual([]);
    });
  });

  describe('getConfig', () => {
    it('should return null when no config is stored', () => {
      mockGetSetting.mockReturnValue(null);
      const config = aiService.getConfig();
      expect(config).toBeNull();
    });

    it('should return parsed config when stored', () => {
      const storedConfig = {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      };
      mockGetSetting.mockReturnValue(JSON.stringify(storedConfig));
      const config = aiService.getConfig();
      expect(config).toEqual(storedConfig);
    });

    it('should return null when config parsing fails', () => {
      mockGetSetting.mockReturnValue('invalid-json');
      const config = aiService.getConfig();
      expect(config).toBeNull();
    });
  });

  describe('complete', () => {
    it('should throw when AI is not configured', async () => {
      mockGetSetting.mockReturnValue(null);
      await expect(aiService.complete({ prompt: 'test' })).rejects.toThrow('AI not configured');
    });

    it('should call Gemini API correctly', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
        })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Generated content' }] } }],
            usageMetadata: { totalTokenCount: 42 },
          }),
      });

      const result = await aiService.complete({ prompt: 'test prompt' });

      expect(result.content).toBe('Generated content');
      expect(result.tokensUsed).toBe(42);
      expect(result.model).toBe('gemini-2.5-flash');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should call Anthropic API correctly', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'anthropic',
          apiKey: 'sk-ant-test',
          model: 'claude-sonnet-4-5-20250929',
        })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: 'Claude response' }],
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
      });

      const result = await aiService.complete({ prompt: 'test' });

      expect(result.content).toBe('Claude response');
      expect(result.tokensUsed).toBe(30);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'sk-ant-test',
          }),
        })
      );
    });

    it('should call OpenAI API correctly', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o',
        })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'GPT response' } }],
            usage: { total_tokens: 50 },
          }),
      });

      const result = await aiService.complete({ prompt: 'test' });

      expect(result.content).toBe('GPT response');
      expect(result.tokensUsed).toBe(50);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test',
          }),
        })
      );
    });

    it('should call Ollama API correctly', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'ollama',
          apiKey: '',
          model: 'llama3',
          baseUrl: 'http://localhost:11434',
        })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response: 'Ollama response',
            eval_count: 100,
          }),
      });

      const result = await aiService.complete({ prompt: 'test' });

      expect(result.content).toBe('Ollama response');
      expect(result.tokensUsed).toBe(100);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.any(Object)
      );
    });

    it('should throw on API error response', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'gemini',
          apiKey: 'bad-key',
          model: 'gemini-2.5-flash',
        })
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(aiService.complete({ prompt: 'test' })).rejects.toThrow();
    });

    it('should throw on fetch error', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
        })
      );

      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(aiService.complete({ prompt: 'test' })).rejects.toThrow('Network error');
    });
  });

  describe('testConnection', () => {
    it('should return success for valid config', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
        })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
            usageMetadata: { totalTokenCount: 5 },
          }),
      });

      const result = await aiService.testConnection();

      expect(result.success).toBe(true);
      expect(result.model).toBe('gemini-2.5-flash');
    });

    it('should return failure when not configured', async () => {
      mockGetSetting.mockReturnValue(null);
      const result = await aiService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('should return failure on connection error', async () => {
      mockGetSetting.mockReturnValue(
        JSON.stringify({
          provider: 'gemini',
          apiKey: 'bad-key',
          model: 'gemini-2.5-flash',
        })
      );

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await aiService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });
  });
});
