import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  mockGenerateChangelog: vi.fn(),
  mockGenerateCommitMessage: vi.fn(),
  mockApplyChangelog: vi.fn(),
  mockDetectVersions: vi.fn(),
  mockBumpVersion: vi.fn(),
  mockUpdateVersion: vi.fn(),
  mockScanCLIs: vi.fn(),
  mockGetCLIHelp: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services/workflow.service', () => ({
  workflowService: {
    generateChangelog: mocks.mockGenerateChangelog,
    generateCommitMessage: mocks.mockGenerateCommitMessage,
    applyChangelog: mocks.mockApplyChangelog,
  },
}));

vi.mock('../../../src/main/services/version.service', () => ({
  versionService: {
    detectVersions: mocks.mockDetectVersions,
    bumpVersion: mocks.mockBumpVersion,
    updateVersion: mocks.mockUpdateVersion,
  },
}));

vi.mock('../../../src/main/services/cli-scanner.service', () => ({
  cliScannerService: {
    scanCLIs: mocks.mockScanCLIs,
    getCLIHelp: mocks.mockGetCLIHelp,
  },
}));

import { setupWorkflowHandlers } from '../../../src/main/ipc/handlers/workflow.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('workflow.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupWorkflowHandlers();
  });

  it('registers all 8 handlers', () => {
    expect(mocks.mockHandleIpc).toHaveBeenCalledTimes(8);
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('workflow:generate-changelog');
    expect(channels).toContain('workflow:generate-commit-message');
    expect(channels).toContain('workflow:apply-changelog');
    expect(channels).toContain('workflow:detect-versions');
    expect(channels).toContain('workflow:bump-version');
    expect(channels).toContain('workflow:update-version');
    expect(channels).toContain('workflow:scan-clis');
    expect(channels).toContain('workflow:get-cli-help');
  });

  it('workflow:generate-changelog delegates to workflowService', async () => {
    const mockResult = '## Changelog\n- Fixed bug';
    mocks.mockGenerateChangelog.mockResolvedValue(mockResult);

    const handler = getHandler('workflow:generate-changelog');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/repo', 42, 'fix/issue-42');

    expect(mocks.mockGenerateChangelog).toHaveBeenCalledWith('/repo', 42, 'fix/issue-42');
    expect(result).toBe(mockResult);
  });

  it('workflow:generate-commit-message delegates to workflowService', async () => {
    const mockResult = 'fix: resolve issue #42';
    mocks.mockGenerateCommitMessage.mockResolvedValue(mockResult);

    const handler = getHandler('workflow:generate-commit-message');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/repo', 42, 'fix/issue-42');

    expect(mocks.mockGenerateCommitMessage).toHaveBeenCalledWith('/repo', 42, 'fix/issue-42');
    expect(result).toBe(mockResult);
  });

  it('workflow:apply-changelog delegates to workflowService', async () => {
    mocks.mockApplyChangelog.mockResolvedValue(undefined);
    const entry = { version: '1.0.1', changes: 'Bug fix' };

    const handler = getHandler('workflow:apply-changelog');
    expect(handler).toBeDefined();
    await handler!({}, '/repo', entry);

    expect(mocks.mockApplyChangelog).toHaveBeenCalledWith('/repo', entry);
  });

  it('workflow:detect-versions delegates to versionService', async () => {
    const mockResult = [{ file: 'package.json', version: '1.0.0' }];
    mocks.mockDetectVersions.mockReturnValue(mockResult);

    const handler = getHandler('workflow:detect-versions');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/repo');

    expect(mocks.mockDetectVersions).toHaveBeenCalledWith('/repo');
    expect(result).toBe(mockResult);
  });

  it('workflow:bump-version delegates to versionService', async () => {
    mocks.mockBumpVersion.mockReturnValue('1.1.0');

    const handler = getHandler('workflow:bump-version');
    expect(handler).toBeDefined();
    const result = await handler!({}, '1.0.0', 'minor');

    expect(mocks.mockBumpVersion).toHaveBeenCalledWith('1.0.0', 'minor');
    expect(result).toBe('1.1.0');
  });

  it('workflow:update-version delegates to versionService', async () => {
    const files = ['package.json', 'version.ts'];
    mocks.mockUpdateVersion.mockReturnValue({ updated: 2 });

    const handler = getHandler('workflow:update-version');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/repo', '2.0.0', files);

    expect(mocks.mockUpdateVersion).toHaveBeenCalledWith('/repo', '2.0.0', files);
    expect(result).toEqual({ updated: 2 });
  });

  it('workflow:scan-clis delegates to cliScannerService', async () => {
    const mockResult = [{ name: 'npm', version: '10.0.0' }];
    mocks.mockScanCLIs.mockReturnValue(mockResult);

    const handler = getHandler('workflow:scan-clis');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'node');

    expect(mocks.mockScanCLIs).toHaveBeenCalledWith('node');
    expect(result).toBe(mockResult);
  });

  it('workflow:get-cli-help delegates to cliScannerService', async () => {
    mocks.mockGetCLIHelp.mockResolvedValue('Usage: npm install [package]');

    const handler = getHandler('workflow:get-cli-help');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/usr/bin/npm', 'install');

    expect(mocks.mockGetCLIHelp).toHaveBeenCalledWith('/usr/bin/npm', 'install');
    expect(result).toBe('Usage: npm install [package]');
  });
});
