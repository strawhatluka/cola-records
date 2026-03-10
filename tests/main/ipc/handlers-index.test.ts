import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSetupGitHubHandlers: vi.fn(),
  mockSetupCoreHandlers: vi.fn(),
  mockSetupContributionHandlers: vi.fn(),
  mockSetupSettingsHandlers: vi.fn(),
  mockSetupIntegrationHandlers: vi.fn(),
  mockSetupDevToolsHandlers: vi.fn(),
  mockSetupAIHandlers: vi.fn(),
  mockSetupWorkflowHandlers: vi.fn(),
  mockSetupNotificationHandlers: vi.fn(),
  mockSetupGitHubConfigHandlers: vi.fn(),
  mockSetupProjectHandlers: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers/github.handlers', () => ({
  setupGitHubHandlers: mocks.mockSetupGitHubHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/core.handlers', () => ({
  setupCoreHandlers: mocks.mockSetupCoreHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/contribution.handlers', () => ({
  setupContributionHandlers: mocks.mockSetupContributionHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/settings.handlers', () => ({
  setupSettingsHandlers: mocks.mockSetupSettingsHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/integrations.handlers', () => ({
  setupIntegrationHandlers: mocks.mockSetupIntegrationHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/dev-tools.handlers', () => ({
  setupDevToolsHandlers: mocks.mockSetupDevToolsHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/ai.handlers', () => ({
  setupAIHandlers: mocks.mockSetupAIHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/workflow.handlers', () => ({
  setupWorkflowHandlers: mocks.mockSetupWorkflowHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/notification.handlers', () => ({
  setupNotificationHandlers: mocks.mockSetupNotificationHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/github-config.handlers', () => ({
  setupGitHubConfigHandlers: mocks.mockSetupGitHubConfigHandlers,
}));
vi.mock('../../../src/main/ipc/handlers/project.handlers', () => ({
  setupProjectHandlers: mocks.mockSetupProjectHandlers,
}));

import { setupIpcHandlers } from '../../../src/main/ipc/handlers/index';

describe('handlers/index - setupIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls all 11 handler setup functions', () => {
    setupIpcHandlers();

    expect(mocks.mockSetupGitHubHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupCoreHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupContributionHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupSettingsHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupIntegrationHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupDevToolsHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupAIHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupWorkflowHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupNotificationHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupGitHubConfigHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetupProjectHandlers).toHaveBeenCalledTimes(1);
  });
});
