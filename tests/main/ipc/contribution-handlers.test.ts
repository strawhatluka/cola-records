import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist all mock functions referenced inside vi.mock factories
const mocks = vi.hoisted(() => ({
  mockGetAllContributions: vi.fn(),
  mockCreateContribution: vi.fn(),
  mockUpdateContribution: vi.fn(),
  mockScanDirectory: vi.fn(),
  mockHandleIpc: vi.fn(),
  // fs mocks for contribution:delete handler
  mockExistsSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockChmodSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockRmdirSync: vi.fn(),
  // github-rest.service mocks for contribution:sync-with-github handler
  mockCheckPRStatus: vi.fn(),
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

vi.mock('fs', () => ({
  existsSync: mocks.mockExistsSync,
  rmSync: mocks.mockRmSync,
  readdirSync: mocks.mockReaddirSync,
  chmodSync: mocks.mockChmodSync,
  unlinkSync: mocks.mockUnlinkSync,
  rmdirSync: mocks.mockRmdirSync,
}));

vi.mock('../../../src/main/services/github-rest.service', () => ({
  gitHubRestService: {
    checkPRStatus: mocks.mockCheckPRStatus,
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
import { database } from '../../../src/main/database';

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
      repositoryUrl: 'https://github.com/strawhatluka/my-project.git',
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
      repositoryUrl: 'https://github.com/strawhatluka/my-project.git',
      remotesValid: true,
    };
    mocks.mockUpdateContribution.mockReturnValue(updatedContribution);

    const handler = getHandler('contribution:scan-directory');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/home/user/projects');

    expect(mocks.mockUpdateContribution).toHaveBeenCalledWith(
      'test-id-1',
      expect.objectContaining({
        repositoryUrl: 'https://github.com/strawhatluka/my-project.git',
      })
    );

    expect((result as (typeof updatedContribution)[])[0].repositoryUrl).toBe(
      'https://github.com/strawhatluka/my-project.git'
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
      repositoryUrl: 'https://github.com/strawhatluka/new-project.git',
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
        repositoryUrl: 'https://github.com/strawhatluka/new-project.git',
      }),
      scannedResult.createdAt
    );
    expect(mocks.mockUpdateContribution).not.toHaveBeenCalled();
  });

  it('passes all expected fields in the update call', async () => {
    mocks.mockGetAllContributions.mockReturnValue([{ ...baseContribution }]);

    const scannedResult = {
      localPath: '/home/user/projects/my-project',
      repositoryUrl: 'https://github.com/strawhatluka/my-project.git',
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
      repositoryUrl: 'https://github.com/strawhatluka/my-project.git',
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

describe('contribution.handlers - delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupContributionHandlers();
  });

  it('deletes contribution from database when contribution does not exist', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue(undefined as never);

    // Act
    const handler = getHandler('contribution:delete');
    expect(handler).toBeDefined();
    await handler!({}, 'non-existent-id');

    // Assert
    expect(database.getContributionById).toHaveBeenCalledWith('non-existent-id');
    expect(mocks.mockExistsSync).not.toHaveBeenCalled();
    expect(database.deleteContribution).toHaveBeenCalledWith('non-existent-id');
  });

  it('deletes contribution without fs cleanup when localPath does not exist on disk', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue({ ...baseContribution } as never);
    mocks.mockExistsSync.mockReturnValue(false);

    // Act
    const handler = getHandler('contribution:delete');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert
    expect(database.getContributionById).toHaveBeenCalledWith('test-id-1');
    expect(mocks.mockExistsSync).toHaveBeenCalledWith(baseContribution.localPath);
    expect(mocks.mockRmSync).not.toHaveBeenCalled();
    expect(database.deleteContribution).toHaveBeenCalledWith('test-id-1');
  });

  it('deletes directory with rmSync when localPath exists on disk', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue({ ...baseContribution } as never);
    mocks.mockExistsSync.mockReturnValue(true);
    mocks.mockRmSync.mockReturnValue(undefined);

    // Act
    const handler = getHandler('contribution:delete');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert
    expect(mocks.mockRmSync).toHaveBeenCalledWith(baseContribution.localPath, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    expect(database.deleteContribution).toHaveBeenCalledWith('test-id-1');
  });

  it('falls back to manual recursive deletion when rmSync throws', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue({ ...baseContribution } as never);

    // existsSync: first call for localPath check (true), second for deleteRecursive entry (true)
    mocks.mockExistsSync.mockReturnValue(true);
    mocks.mockRmSync.mockImplementation(() => {
      throw new Error('EBUSY: resource busy');
    });

    // Simulate directory with one file entry
    const fileEntry = {
      name: 'README.md',
      isDirectory: () => false,
    };
    mocks.mockReaddirSync.mockReturnValue([fileEntry]);
    mocks.mockChmodSync.mockReturnValue(undefined);
    mocks.mockUnlinkSync.mockReturnValue(undefined);
    mocks.mockRmdirSync.mockReturnValue(undefined);

    // Act
    const handler = getHandler('contribution:delete');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert - rmSync was attempted and failed
    expect(mocks.mockRmSync).toHaveBeenCalled();
    // Assert - fallback manual deletion ran
    expect(mocks.mockReaddirSync).toHaveBeenCalledWith(baseContribution.localPath, {
      withFileTypes: true,
    });
    expect(mocks.mockChmodSync).toHaveBeenCalled();
    expect(mocks.mockUnlinkSync).toHaveBeenCalled();
    expect(mocks.mockRmdirSync).toHaveBeenCalledWith(baseContribution.localPath);
    expect(database.deleteContribution).toHaveBeenCalledWith('test-id-1');
  });

  it('handles recursive directory structure in manual deletion fallback', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue({ ...baseContribution } as never);
    mocks.mockExistsSync.mockReturnValue(true);
    mocks.mockRmSync.mockImplementation(() => {
      throw new Error('EPERM: operation not permitted');
    });

    const subDirEntry = {
      name: 'subdir',
      isDirectory: () => true,
    };
    const fileEntry = {
      name: 'file.txt',
      isDirectory: () => false,
    };
    // First call: root directory has a subdirectory
    // Second call: subdirectory has a file
    mocks.mockReaddirSync.mockReturnValueOnce([subDirEntry]).mockReturnValueOnce([fileEntry]);
    mocks.mockChmodSync.mockReturnValue(undefined);
    mocks.mockUnlinkSync.mockReturnValue(undefined);
    mocks.mockRmdirSync.mockReturnValue(undefined);

    // Act
    const handler = getHandler('contribution:delete');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert - readdirSync called for root and subdirectory
    expect(mocks.mockReaddirSync).toHaveBeenCalledTimes(2);
    // Assert - rmdirSync called for subdirectory and root
    expect(mocks.mockRmdirSync).toHaveBeenCalledTimes(2);
    expect(database.deleteContribution).toHaveBeenCalledWith('test-id-1');
  });

  it('proceeds with unlink even when chmodSync throws in manual deletion', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue({ ...baseContribution } as never);
    mocks.mockExistsSync.mockReturnValue(true);
    mocks.mockRmSync.mockImplementation(() => {
      throw new Error('EBUSY');
    });

    const fileEntry = {
      name: 'readonly-file.txt',
      isDirectory: () => false,
    };
    mocks.mockReaddirSync.mockReturnValue([fileEntry]);
    mocks.mockChmodSync.mockImplementation(() => {
      throw new Error('EPERM: chmod not supported');
    });
    mocks.mockUnlinkSync.mockReturnValue(undefined);
    mocks.mockRmdirSync.mockReturnValue(undefined);

    // Act
    const handler = getHandler('contribution:delete');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert - chmodSync was attempted
    expect(mocks.mockChmodSync).toHaveBeenCalled();
    // Assert - unlinkSync still called despite chmod failure
    expect(mocks.mockUnlinkSync).toHaveBeenCalled();
    expect(database.deleteContribution).toHaveBeenCalledWith('test-id-1');
  });

  it('skips manual deletion when deleteRecursive finds path no longer exists', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue({ ...baseContribution } as never);

    // First existsSync returns true (initial check), second returns false (deleteRecursive check)
    mocks.mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    mocks.mockRmSync.mockImplementation(() => {
      throw new Error('EBUSY');
    });

    // Act
    const handler = getHandler('contribution:delete');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert - manual deletion functions not called since path no longer exists
    expect(mocks.mockReaddirSync).not.toHaveBeenCalled();
    expect(mocks.mockRmdirSync).not.toHaveBeenCalled();
    expect(database.deleteContribution).toHaveBeenCalledWith('test-id-1');
  });
});

describe('contribution.handlers - sync-with-github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupContributionHandlers();
  });

  it('throws error when contribution is not found', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue(undefined as never);

    // Act & Assert
    const handler = getHandler('contribution:sync-with-github');
    expect(handler).toBeDefined();
    await expect(handler!({}, 'missing-id')).rejects.toThrow('Contribution not found: missing-id');
  });

  it('throws error when repository URL does not match GitHub pattern', async () => {
    // Arrange
    vi.mocked(database.getContributionById).mockReturnValue({
      ...baseContribution,
      repositoryUrl: 'https://gitlab.com/user/repo',
    } as never);

    // Act & Assert
    const handler = getHandler('contribution:sync-with-github');
    expect(handler).toBeDefined();
    await expect(handler!({}, 'test-id-1')).rejects.toThrow(
      'Invalid repository URL: https://gitlab.com/user/repo'
    );
  });

  it('syncs PR status and updates contribution with PR details', async () => {
    // Arrange
    const contribution = {
      ...baseContribution,
      repositoryUrl: 'https://github.com/strawhatluka/my-project.git',
      branchName: 'feat/issue-42-auth',
    };
    vi.mocked(database.getContributionById).mockReturnValue(contribution as never);

    const prStatus = {
      number: 10,
      url: 'https://github.com/strawhatluka/my-project/pull/10',
      status: 'open' as const,
    };
    mocks.mockCheckPRStatus.mockResolvedValue(prStatus);

    const updatedContribution = {
      ...contribution,
      prUrl: prStatus.url,
      prNumber: prStatus.number,
      prStatus: prStatus.status,
    };
    mocks.mockUpdateContribution.mockReturnValue(updatedContribution);

    // Act
    const handler = getHandler('contribution:sync-with-github');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'test-id-1');

    // Assert
    expect(mocks.mockCheckPRStatus).toHaveBeenCalledWith(
      'strawhatluka',
      'my-project',
      'feat/issue-42-auth'
    );
    expect(mocks.mockUpdateContribution).toHaveBeenCalledWith('test-id-1', {
      prUrl: prStatus.url,
      prNumber: prStatus.number,
      prStatus: prStatus.status,
    });
    expect(result).toEqual(updatedContribution);
  });

  it('updates contribution with undefined PR details when no PR found', async () => {
    // Arrange
    const contribution = {
      ...baseContribution,
      repositoryUrl: 'https://github.com/strawhatluka/my-project',
      branchName: 'main',
    };
    vi.mocked(database.getContributionById).mockReturnValue(contribution as never);
    mocks.mockCheckPRStatus.mockResolvedValue(null);
    mocks.mockUpdateContribution.mockReturnValue({
      ...contribution,
      prUrl: undefined,
      prNumber: undefined,
      prStatus: undefined,
    });

    // Act
    const handler = getHandler('contribution:sync-with-github');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert
    expect(mocks.mockUpdateContribution).toHaveBeenCalledWith('test-id-1', {
      prUrl: undefined,
      prNumber: undefined,
      prStatus: undefined,
    });
  });

  it('correctly parses owner and repo from URL without .git suffix', async () => {
    // Arrange
    const contribution = {
      ...baseContribution,
      repositoryUrl: 'https://github.com/some-org/some-repo',
      branchName: 'develop',
    };
    vi.mocked(database.getContributionById).mockReturnValue(contribution as never);
    mocks.mockCheckPRStatus.mockResolvedValue(null);
    mocks.mockUpdateContribution.mockReturnValue(contribution);

    // Act
    const handler = getHandler('contribution:sync-with-github');
    expect(handler).toBeDefined();
    await handler!({}, 'test-id-1');

    // Assert
    expect(mocks.mockCheckPRStatus).toHaveBeenCalledWith('some-org', 'some-repo', 'develop');
  });
});

describe('contribution.handlers - project:scan-directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupContributionHandlers();
  });

  it('creates new project contribution when no existing match found', async () => {
    // Arrange
    vi.mocked(database.getContributionsByType).mockReturnValue([] as never);

    const scannedResult = {
      localPath: '/home/user/projects/new-project',
      repositoryUrl: 'https://github.com/strawhatluka/new-project.git',
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

    const createdProject = {
      ...baseContribution,
      type: 'project',
      repositoryUrl: scannedResult.repositoryUrl,
      localPath: scannedResult.localPath,
    };
    mocks.mockCreateContribution.mockReturnValue(createdProject);

    // Act
    const handler = getHandler('project:scan-directory');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/home/user/projects');

    // Assert
    expect(database.getContributionsByType).toHaveBeenCalledWith('project');
    expect(mocks.mockCreateContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'project',
        repositoryUrl: scannedResult.repositoryUrl,
        localPath: scannedResult.localPath,
        issueNumber: 0,
        issueTitle: '',
        branchName: 'main',
        status: 'in_progress',
      }),
      scannedResult.createdAt
    );
    expect(result).toEqual([createdProject]);
  });

  it('updates existing project when localPath matches', async () => {
    // Arrange
    const existingProject = {
      ...baseContribution,
      id: 'project-1',
      type: 'project',
      localPath: '/home/user/projects/existing-project',
    };
    vi.mocked(database.getContributionsByType).mockReturnValue([existingProject] as never);

    const scannedResult = {
      localPath: '/home/user/projects/existing-project',
      repositoryUrl: 'https://github.com/strawhatluka/existing-project.git',
      branchName: 'feat/new-branch',
      isFork: true,
      remotesValid: true,
      upstreamUrl: 'https://github.com/upstream/existing-project.git',
      issueNumber: 7,
      issueTitle: 'Some issue',
      prUrl: 'https://github.com/upstream/existing-project/pull/3',
      prNumber: 3,
      prStatus: 'open',
      createdAt: new Date('2026-01-15'),
    };
    mocks.mockScanDirectory.mockResolvedValue([scannedResult]);

    const updatedProject = { ...existingProject, ...scannedResult };
    mocks.mockUpdateContribution.mockReturnValue(updatedProject);

    // Act
    const handler = getHandler('project:scan-directory');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/home/user/projects');

    // Assert
    expect(mocks.mockUpdateContribution).toHaveBeenCalledWith('project-1', {
      repositoryUrl: scannedResult.repositoryUrl,
      branchName: scannedResult.branchName,
      issueNumber: 7,
      isFork: true,
      remotesValid: true,
      upstreamUrl: scannedResult.upstreamUrl,
      prUrl: scannedResult.prUrl,
      prNumber: 3,
      prStatus: 'open',
      createdAt: scannedResult.createdAt,
    });
    expect(mocks.mockCreateContribution).not.toHaveBeenCalled();
    expect(result).toEqual([updatedProject]);
  });

  it('uses empty string for issueTitle when undefined', async () => {
    // Arrange
    vi.mocked(database.getContributionsByType).mockReturnValue([] as never);

    const scannedResult = {
      localPath: '/home/user/projects/no-title-project',
      repositoryUrl: 'https://github.com/strawhatluka/no-title-project.git',
      branchName: 'main',
      isFork: false,
      remotesValid: false,
      upstreamUrl: undefined,
      issueNumber: undefined,
      issueTitle: undefined,
      prUrl: undefined,
      prNumber: undefined,
      prStatus: undefined,
      createdAt: new Date('2026-03-01'),
    };
    mocks.mockScanDirectory.mockResolvedValue([scannedResult]);
    mocks.mockCreateContribution.mockReturnValue({ ...baseContribution, type: 'project' });

    // Act
    const handler = getHandler('project:scan-directory');
    expect(handler).toBeDefined();
    await handler!({}, '/home/user/projects');

    // Assert - issueTitle should be '' (not 'Unknown Issue' like contribution:scan-directory)
    expect(mocks.mockCreateContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        issueTitle: '',
        issueNumber: 0,
      }),
      scannedResult.createdAt
    );
  });

  it('uses zero for issueNumber when undefined', async () => {
    // Arrange
    vi.mocked(database.getContributionsByType).mockReturnValue([] as never);

    const scannedResult = {
      localPath: '/home/user/projects/no-issue-project',
      repositoryUrl: 'https://github.com/strawhatluka/no-issue-project.git',
      branchName: 'develop',
      isFork: false,
      remotesValid: true,
      upstreamUrl: undefined,
      issueNumber: undefined,
      issueTitle: 'Has a title',
      prUrl: undefined,
      prNumber: undefined,
      prStatus: undefined,
      createdAt: new Date('2026-03-01'),
    };
    mocks.mockScanDirectory.mockResolvedValue([scannedResult]);
    mocks.mockCreateContribution.mockReturnValue({ ...baseContribution, type: 'project' });

    // Act
    const handler = getHandler('project:scan-directory');
    expect(handler).toBeDefined();
    await handler!({}, '/home/user/projects');

    // Assert - issueNumber should be 0 (fallback from undefined via ||)
    expect(mocks.mockCreateContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        issueNumber: 0,
        issueTitle: 'Has a title',
      }),
      scannedResult.createdAt
    );
  });

  it('returns empty array when no directories are scanned', async () => {
    // Arrange
    vi.mocked(database.getContributionsByType).mockReturnValue([] as never);
    mocks.mockScanDirectory.mockResolvedValue([]);

    // Act
    const handler = getHandler('project:scan-directory');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/home/user/projects');

    // Assert
    expect(result).toEqual([]);
    expect(mocks.mockCreateContribution).not.toHaveBeenCalled();
    expect(mocks.mockUpdateContribution).not.toHaveBeenCalled();
  });
});
