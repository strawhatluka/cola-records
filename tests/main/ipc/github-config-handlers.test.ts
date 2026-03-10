import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  mockScan: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockCreateFromTemplate: vi.fn(),
  mockListTemplates: vi.fn(),
  mockListIssueTemplates: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services/github-config.service', () => ({
  githubConfigService: {
    scan: mocks.mockScan,
    readFile: mocks.mockReadFile,
    writeFile: mocks.mockWriteFile,
    deleteFile: mocks.mockDeleteFile,
    createFromTemplate: mocks.mockCreateFromTemplate,
    listTemplates: mocks.mockListTemplates,
    listIssueTemplates: mocks.mockListIssueTemplates,
  },
}));

import { setupGitHubConfigHandlers } from '../../../src/main/ipc/handlers/github-config.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('github-config.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGitHubConfigHandlers();
  });

  it('registers all 7 handlers', () => {
    expect(mocks.mockHandleIpc).toHaveBeenCalledTimes(7);
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('github-config:scan');
    expect(channels).toContain('github-config:read-file');
    expect(channels).toContain('github-config:write-file');
    expect(channels).toContain('github-config:delete-file');
    expect(channels).toContain('github-config:create-from-template');
    expect(channels).toContain('github-config:list-templates');
    expect(channels).toContain('github-config:list-issue-templates');
  });

  it('github-config:scan delegates to githubConfigService.scan', async () => {
    const mockResult = [{ id: 'pr-template', exists: true }];
    mocks.mockScan.mockResolvedValue(mockResult);

    const handler = getHandler('github-config:scan');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/test/project');

    expect(mocks.mockScan).toHaveBeenCalledWith('/test/project');
    expect(result).toBe(mockResult);
  });

  it('github-config:read-file delegates to githubConfigService.readFile', async () => {
    mocks.mockReadFile.mockResolvedValue('file content');

    const handler = getHandler('github-config:read-file');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/test/project', 'PULL_REQUEST_TEMPLATE.md');

    expect(mocks.mockReadFile).toHaveBeenCalledWith('/test/project', 'PULL_REQUEST_TEMPLATE.md');
    expect(result).toBe('file content');
  });

  it('github-config:write-file delegates to githubConfigService.writeFile', async () => {
    mocks.mockWriteFile.mockResolvedValue({ success: true });

    const handler = getHandler('github-config:write-file');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/test/project', 'CODEOWNERS', '* @team');

    expect(mocks.mockWriteFile).toHaveBeenCalledWith('/test/project', 'CODEOWNERS', '* @team');
    expect(result).toEqual({ success: true });
  });

  it('github-config:delete-file delegates to githubConfigService.deleteFile', async () => {
    mocks.mockDeleteFile.mockResolvedValue({ success: true, message: 'Deleted' });

    const handler = getHandler('github-config:delete-file');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/test/project', 'PULL_REQUEST_TEMPLATE.md');

    expect(mocks.mockDeleteFile).toHaveBeenCalledWith('/test/project', 'PULL_REQUEST_TEMPLATE.md');
    expect(result).toEqual({ success: true, message: 'Deleted' });
  });

  it('github-config:create-from-template delegates to githubConfigService.createFromTemplate', async () => {
    mocks.mockCreateFromTemplate.mockResolvedValue({ success: true, message: 'Created' });

    const handler = getHandler('github-config:create-from-template');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/test/project', 'pr-template', 'default');

    expect(mocks.mockCreateFromTemplate).toHaveBeenCalledWith(
      '/test/project',
      'pr-template',
      'default'
    );
    expect(result).toEqual({ success: true, message: 'Created' });
  });

  it('github-config:list-templates delegates to githubConfigService.listTemplates', async () => {
    const mockTemplates = [{ id: 'default', label: 'Default' }];
    mocks.mockListTemplates.mockReturnValue(mockTemplates);

    const handler = getHandler('github-config:list-templates');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'pr-template');

    expect(mocks.mockListTemplates).toHaveBeenCalledWith('pr-template');
    expect(result).toBe(mockTemplates);
  });

  it('github-config:list-issue-templates delegates to githubConfigService.listIssueTemplates', async () => {
    const mockTemplates = [{ name: 'Bug Report', content: '...' }];
    mocks.mockListIssueTemplates.mockResolvedValue(mockTemplates);

    const handler = getHandler('github-config:list-issue-templates');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/test/project');

    expect(mocks.mockListIssueTemplates).toHaveBeenCalledWith('/test/project');
    expect(result).toBe(mockTemplates);
  });
});
