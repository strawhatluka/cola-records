/**
 * AI Service
 *
 * Multi-provider AI abstraction layer. Supports Gemini (primary),
 * Anthropic, OpenAI, and Ollama via native fetch. Single-shot
 * completions only — no streaming, no conversation history.
 */
import log from 'electron-log';
import { database } from '../database';
import type {
  AIConfig,
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from '../ipc/channels/types';

const logger = log.create({ logId: 'AIService' }).scope('ai');

export class AIService {
  getConfig(): AIConfig | null {
    const raw = database.getSetting('aiConfig');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AIConfig;
    } catch {
      return null;
    }
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const config = this.getConfig();
    if (!config) {
      logger.warn('complete: AI not configured');
      throw new Error('AI not configured. Go to Settings > AI to set up a provider.');
    }
    if (!config.apiKey && config.provider !== 'ollama') {
      logger.warn('complete: API key not set for provider=%s', config.provider);
      throw new Error('API key not set. Go to Settings > AI to add your API key.');
    }
    if (!config.model) {
      logger.warn('complete: model not set for provider=%s', config.provider);
      throw new Error('Model not set. Go to Settings > AI to select a model.');
    }

    const promptPreview = request.prompt.slice(0, 120).replace(/\n/g, ' ');
    logger.info(
      'complete: provider=%s, model=%s, maxTokens=%d, promptLen=%d, preview="%s…"',
      config.provider,
      config.model,
      request.maxTokens ?? 8192,
      request.prompt.length,
      promptPreview
    );

    const start = Date.now();

    let response: AICompletionResponse;
    switch (config.provider) {
      case 'gemini':
        response = await this.completeGemini(config, request);
        break;
      case 'anthropic':
        response = await this.completeAnthropic(config, request);
        break;
      case 'openai':
        response = await this.completeOpenAI(config, request);
        break;
      case 'ollama':
        response = await this.completeOllama(config, request);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${config.provider as string}`);
    }

    const elapsed = Date.now() - start;
    logger.info(
      'complete: done in %dms, responseLen=%d, tokens=%d, model=%s',
      elapsed,
      response.content.length,
      response.tokensUsed,
      response.model
    );

    return response;
  }

  async testConnection(): Promise<{ success: boolean; message: string; model: string }> {
    const config = this.getConfig();
    if (!config) {
      return { success: false, message: 'AI not configured', model: '' };
    }

    try {
      const response = await this.complete({
        prompt: 'Respond with exactly: "Connection successful"',
        maxTokens: 20,
        temperature: 0,
      });
      return {
        success: true,
        message: `Connected to ${config.provider} (${response.model})`,
        model: response.model,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        model: config.model,
      };
    }
  }

  private async completeGemini(
    config: AIConfig,
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 8192,
          temperature: request.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        'Gemini API error: status=%d, body=%s',
        response.status,
        errorBody.slice(0, 300)
      );
      throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0;

    if (!content) {
      logger.warn(
        'Gemini: empty content returned, finishReason=%s',
        data.candidates?.[0]?.finishReason
      );
    }

    return { content, tokensUsed, model: config.model };
  }

  private async completeAnthropic(
    config: AIConfig,
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const url = 'https://api.anthropic.com/v1/messages';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: request.maxTokens ?? 8192,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        'Anthropic API error: status=%d, body=%s',
        response.status,
        errorBody.slice(0, 300)
      );
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text ?? '';
    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    if (!content) {
      logger.warn('Anthropic: empty content returned, stop_reason=%s', data.stop_reason);
    }

    return { content, tokensUsed, model: data.model ?? config.model };
  }

  private async completeOpenAI(
    config: AIConfig,
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const url = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: request.maxTokens ?? 8192,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        'OpenAI API error: status=%d, body=%s',
        response.status,
        errorBody.slice(0, 300)
      );
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const tokensUsed = data.usage?.total_tokens ?? 0;

    if (!content) {
      logger.warn(
        'OpenAI: empty content returned, finish_reason=%s',
        data.choices?.[0]?.finish_reason
      );
    }

    return { content, tokensUsed, model: data.model ?? config.model };
  }

  private async completeOllama(
    config: AIConfig,
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const url = `${baseUrl}/api/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: request.prompt,
        stream: false,
        options: {
          num_predict: request.maxTokens ?? 8192,
          temperature: request.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        'Ollama API error: status=%d, body=%s',
        response.status,
        errorBody.slice(0, 300)
      );
      throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.response ?? '';
    const tokensUsed = (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0);

    if (!content) {
      logger.warn('Ollama: empty content returned, done=%s', data.done);
    }

    return { content, tokensUsed, model: config.model };
  }
}

export const aiService = new AIService();

export const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  ollama: [],
};
