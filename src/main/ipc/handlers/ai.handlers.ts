/**
 * AI IPC Handlers
 *
 * Registers handlers for: ai:complete, ai:test-connection, ai:get-config
 */
import { handleIpc } from '../handlers';
import { aiService } from '../../services/ai.service';

export function setupAIHandlers(): void {
  handleIpc('ai:complete', async (_event, prompt, maxTokens) => {
    return await aiService.complete({ prompt, maxTokens });
  });

  handleIpc('ai:test-connection', async () => {
    return await aiService.testConnection();
  });

  handleIpc('ai:get-config', async () => {
    return aiService.getConfig();
  });
}
