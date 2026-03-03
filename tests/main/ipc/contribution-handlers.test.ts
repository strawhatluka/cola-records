import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist all mock functions referenced inside vi.mock factories
const mocks = vi.hoisted(() => ({
  mockGetAllContributions: vi.fn(),
  mockCreateContribution: vi.fn(),
  mockUpdateContribution: vi.fn(),
  mockScanDirectory: vi.fn(),
  mockHandleIpc: vi.fn(),
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    initialize: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    createContribution: mocks.mockCreateContribution,
    getAllContributions: mocks.mockGetAllContributions,
    getContributionById: vi.fn(),
    getContributionsByType: vi.fn().mockReturnValue([]),
    updateContribution: mocks.mockUpdateContribution,
    deleteContribution: vi.fn(),
    getDevScripts: vi.fn(),
    saveDevScript: vi.fn(),
    deleteDevScript: vi.fn(),
  },
}));

// Must mock the direct file path (not the barrel) — contribution.handlers.ts
// imports from '../handlers' which resolves to src/main/ipc/handlers.ts
vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services/contribution-scanner.service', () => ({
  contributionScannerService: {
    scanDirectory: mocks.mockScanDirectory,
  },
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    getPath: () => '/mock/path',
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
    commandLine: { appendSwitch: vi.fn() },
  },
  BrowserWindow: vi.fn(),
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

import { setupContributionHandlers } from '../../../src/main/ipc/handlers/contribution.handlers';

/** Extract a captured handler by channel name from mockHandleIpc calls */
function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

const baseContribution = {
  id: 'test-id-1',
  repositoryUrl: 'https://github.com/unknown/my-project',
  localPath: '/home/user/projects/my-project',
  issueNumber: 0,
  issueTitle: 'Unknown Issue',
  branchName: 'main',
  status: 'in_progress' as const,
  isFork: false,
  remotesValid: false,
  upstreamUrl: undefined,
  prUrl: undefined,
  prNumber: undefined,
  prStatus: undefined,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  type: 'contribution',
};

describe('contribution.handlers - scan-directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupContributionHandlers();
  });

  it('updates repositoryUrl when rescan detects a real remote URL', async () => {
    mocks.mockGetAllContributions.mockReturnValue([{ ...baseContribution }]);

    const scannedResult = {
      localPath: '/home/user/projects/my-project',
      repositoryUrl: 'https://github.com/lukadfagundes/my-project.git',
      branchName: 'main',
      isFork: false,
      remotesValid: true,
      upstreamUrl: undefined,
      issueNumber: undefined,
      issueTitle: undefined,
      prUrl: undefined,
      prNumber: undefined,
      prStatus: undefined,
      createdAt: new Date('2026-01-01'),
    };
    mocks.mockScanDirectory.mockResolvedValue([scannedResult]);

    const updatedContribution = {
      ...baseContribution,
      repositoryUrl: 'https://github.com/lukadfagundes/my-project.git',
      remotesValid: true,
    };
    mocks.mockUpdateContribution.mockReturnValue(updatedContribution);

    const handler = getHandler('contribution:scan-directory');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/home/user/projects');

    expect(mocks.mockUpdateContribution).toHaveBeenCalledWith(
      'test-id-1',
      expect.objectContaining({
        repositoryUrl: 'https://github.com/lukadfagundes/my-project.git',
      })
    );

    expect((result as (typeof updatedContribution)[])[0].repositoryUrl).toBe(
      'https://github.com/lukadfagundes/my-project.git'
    );
  });

  it('updates branchName when rescan detects a different branch', async () => {
    mocks.mockGetAllContributions.mockReturnValue([{ ...baseContribution }]);

    const scannedResult = {
      localPath: '/home/user/projects/my-project',
      repositoryUrl: 'https://github.com/unknown/my-project',
      branchName: 'feat/issue-42-new-feature',
      isFork: false,
      remotesValid: false,
      upstreamUrl: undefined,
      issueNumber: 42,
      issueTitle: undefined,
      prUrl: undefined,
      prNumber: undefined,
      prStatus: undefined,
      createdAt: new Date('2026-01-01'),
    };
    mocks.mockScanDirectory.mockResolvedValue([scannedResult]);
    mocks.mockUpdateContribution.mockReturnValue({
      ...baseContribution,
      branchName: 'feat/issue-42-new-feature',
      issueNumber: 42,
    });

    const handler = getHandler('contribution:scan-directory');
    expect(handler).toBeDefined();
    await handler!({}, '/home/user/projects');

    expect(mocks.mockUpdateContribution).toHaveBeenCalledWith(
      'test-id-1',
      expect.objectContaining({
        branchName: 'feat/issue-42-new-feature',
        issueNumber: 42,
      })
    );
  });

  it('creates new contribution when no existing match found', async () => {
    mocks.mockGetAllContributions.mockReturnValue([]);

    const scannedResult = {
      localPath: '/home/user/projects/new-project',
      repositoryUrl: 'https://github.com/lukadfagundes/new-project.git',
      branchName: 'main',
      isFork: false,
      remotesValid: true,
      upstreamUrl: undefined,
      issueNumber: undefined,
      issueTitle: undefined,
      prUrl: undefined,
      prNumber: undefined,
      prStatus: undefined,
      createdAt: new Date('2026-02-01'),
    };
    mocks.mockScanDirectory.mockResolvedValue([scannedResult]);
    mocks.mockCreateContribution.mockReturnValue({
      ...baseContribution,
      repositoryUrl: scannedResult.repositoryUrl,
    });

    const handler = getHandler('contribution:scan-directory');
    expect(handler).toBeDefined();
    await handler!({}, '/home/user/projects');

    expect(mocks.mockCreateContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: 'https://github.com/lukadfagundes/new-project.git',
      }),
      scannedResult.createdAt
    );
    expect(mocks.mockUpdateContribution).not.toHaveBeenCalled();
  });

  it('passes all expected fields in the update call', async () => {
    mocks.mockGetAllContributions.mockReturnValue([{ ...baseContribution }]);

    const scannedResult = {
      localPath: '/home/user/projects/my-project',
      repositoryUrl: 'https://github.com/lukadfagundes/my-project.git',
      branchName: 'feat/issue-5-auth',
      isFork: true,
      remotesValid: true,
      upstreamUrl: 'https://github.com/upstream-org/my-project.git',
      issueNumber: 5,
      issueTitle: undefined,
      prUrl: 'https://github.com/upstream-org/my-project/pull/10',
      prNumber: 10,
      prStatus: 'open',
      createdAt: new Date('2026-01-01'),
    };
    mocks.mockScanDirectory.mockResolvedValue([scannedResult]);
    mocks.mockUpdateContribution.mockReturnValue({ ...baseContribution, ...scannedResult });

    const handler = getHandler('contribution:scan-directory');
    expect(handler).toBeDefined();
    await handler!({}, '/home/user/projects');

    expect(mocks.mockUpdateContribution).toHaveBeenCalledWith('test-id-1', {
      repositoryUrl: 'https://github.com/lukadfagundes/my-project.git',
      branchName: 'feat/issue-5-auth',
      issueNumber: 5,
      isFork: true,
      remotesValid: true,
      upstreamUrl: 'https://github.com/upstream-org/my-project.git',
      prUrl: 'https://github.com/upstream-org/my-project/pull/10',
      prNumber: 10,
      prStatus: 'open',
      createdAt: scannedResult.createdAt,
    });
  });
});
