/**
 * IPC Handler Composer
 *
 * Imports all domain-specific handler setup functions and
 * composes them into a single setupIpcHandlers() entry point.
 */
import { setupGitHubHandlers } from './github.handlers';
import { setupCoreHandlers } from './core.handlers';
import { setupContributionHandlers } from './contribution.handlers';
import { setupSettingsHandlers } from './settings.handlers';
import { setupIntegrationHandlers } from './integrations.handlers';
import { setupDevToolsHandlers } from './dev-tools.handlers';
import { setupAIHandlers } from './ai.handlers';
import { setupWorkflowHandlers } from './workflow.handlers';

export function setupIpcHandlers(): void {
  setupGitHubHandlers();
  setupCoreHandlers();
  setupContributionHandlers();
  setupSettingsHandlers();
  setupIntegrationHandlers();
  setupDevToolsHandlers();
  setupAIHandlers();
  setupWorkflowHandlers();
}
