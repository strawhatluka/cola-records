import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  mockDetectEcosystemTools: vi.fn(),
  mockDetectTool: vi.fn(),
  mockInstallTool: vi.fn(),
  mockScaffold: vi.fn(),
  mockScaffoldDatabase: vi.fn(),
  mockGetORMOptions: vi.fn(),
  mockCreateRepository: vi.fn(),
  mockGitInit: vi.fn(),
  mockGitCreateBranch: vi.fn(),
  mockGitAdd: vi.fn(),
  mockGitCommit: vi.fn(),
  mockGitAddRemote: vi.fn(),
  mockGitPush: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services/cli-detection.service', () => ({
  cliDetectionService: {
    detectEcosystemTools: mocks.mockDetectEcosystemTools,
    detectTool: mocks.mockDetectTool,
    installTool: mocks.mockInstallTool,
  },
}));

vi.mock('../../../src/main/services/project-scaffold.service', () => ({
  projectScaffoldService: {
    scaffold: mocks.mockScaffold,
  },
}));

vi.mock('../../../src/main/services/database-scaffold.service', () => ({
  databaseScaffoldService: {
    scaffoldDatabase: mocks.mockScaffoldDatabase,
    getORMOptions: mocks.mockGetORMOptions,
  },
}));

vi.mock('../../../src/main/services/github-rest.service', () => ({
  gitHubRestService: {
    createRepository: mocks.mockCreateRepository,
  },
}));

vi.mock('../../../src/main/services', () => ({
  gitService: {
    init: mocks.mockGitInit,
    createBranch: mocks.mockGitCreateBranch,
    add: mocks.mockGitAdd,
    commit: mocks.mockGitCommit,
    addRemote: mocks.mockGitAddRemote,
    push: mocks.mockGitPush,
  },
}));

import { setupProjectHandlers } from '../../../src/main/ipc/handlers/project.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('project.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProjectHandlers();
  });

  it('registers all 8 handlers', () => {
    expect(mocks.mockHandleIpc).toHaveBeenCalledTimes(8);
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('project:check-cli-tools');
    expect(channels).toContain('project:validate-package-manager');
    expect(channels).toContain('project:install-tool');
    expect(channels).toContain('project:scaffold');
    expect(channels).toContain('project:scaffold-database');
    expect(channels).toContain('project:get-orm-options');
    expect(channels).toContain('project:create-github-repo');
    expect(channels).toContain('project:initialize-git');
  });

  it('project:check-cli-tools delegates to cliDetectionService.detectEcosystemTools', async () => {
    const mockResult = [{ name: 'node', installed: true }];
    mocks.mockDetectEcosystemTools.mockResolvedValue(mockResult);

    const handler = getHandler('project:check-cli-tools');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'node', true, 'turborepo');

    expect(mocks.mockDetectEcosystemTools).toHaveBeenCalledWith('node', true, 'turborepo');
    expect(result).toBe(mockResult);
  });

  it('project:validate-package-manager delegates to cliDetectionService.detectTool', async () => {
    const mockResult = { name: 'bun', installed: true, version: '1.0.0' };
    mocks.mockDetectTool.mockResolvedValue(mockResult);

    const handler = getHandler('project:validate-package-manager');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'node', 'bun');

    expect(mocks.mockDetectTool).toHaveBeenCalledWith('bun');
    expect(result).toBe(mockResult);
  });

  it('project:install-tool delegates to cliDetectionService.installTool', async () => {
    const mockResult = { success: true, message: 'Installed', version: '1.0.0' };
    mocks.mockInstallTool.mockResolvedValue(mockResult);

    const handler = getHandler('project:install-tool');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'bun');

    expect(mocks.mockInstallTool).toHaveBeenCalledWith('bun');
    expect(result).toBe(mockResult);
  });

  it('project:scaffold delegates to projectScaffoldService.scaffold', async () => {
    const config = { name: 'my-project', ecosystem: 'node' };
    const mockResult = { success: true };
    mocks.mockScaffold.mockResolvedValue(mockResult);

    const handler = getHandler('project:scaffold');
    expect(handler).toBeDefined();
    const result = await handler!({}, config);

    expect(mocks.mockScaffold).toHaveBeenCalledWith(config);
    expect(result).toBe(mockResult);
  });

  it('project:scaffold-database delegates to databaseScaffoldService.scaffoldDatabase', async () => {
    const config = { engine: 'postgres', orm: 'prisma' };
    const mockResult = { success: true };
    mocks.mockScaffoldDatabase.mockResolvedValue(mockResult);

    const handler = getHandler('project:scaffold-database');
    expect(handler).toBeDefined();
    const result = await handler!({}, config);

    expect(mocks.mockScaffoldDatabase).toHaveBeenCalledWith(config);
    expect(result).toBe(mockResult);
  });

  it('project:get-orm-options delegates to databaseScaffoldService.getORMOptions', async () => {
    const mockResult = ['prisma', 'drizzle', 'typeorm'];
    mocks.mockGetORMOptions.mockResolvedValue(mockResult);

    const handler = getHandler('project:get-orm-options');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'node', 'postgres');

    expect(mocks.mockGetORMOptions).toHaveBeenCalledWith('node', 'postgres');
    expect(result).toBe(mockResult);
  });

  it('project:create-github-repo delegates to gitHubRestService.createRepository', async () => {
    const options = { private: true, description: 'My project' };
    const mockResult = { url: 'https://github.com/user/my-project' };
    mocks.mockCreateRepository.mockResolvedValue(mockResult);

    const handler = getHandler('project:create-github-repo');
    expect(handler).toBeDefined();
    const result = await handler!({}, 'my-project', options);

    expect(mocks.mockCreateRepository).toHaveBeenCalledWith('my-project', options);
    expect(result).toBe(mockResult);
  });

  describe('project:initialize-git', () => {
    it('initializes git without remote when remoteUrl is not provided', async () => {
      mocks.mockGitInit.mockResolvedValue(undefined);
      mocks.mockGitCreateBranch.mockResolvedValue(undefined);
      mocks.mockGitAdd.mockResolvedValue(undefined);
      mocks.mockGitCommit.mockResolvedValue(undefined);

      const handler = getHandler('project:initialize-git');
      expect(handler).toBeDefined();
      await handler!({}, '/my/project', undefined, undefined);

      expect(mocks.mockGitInit).toHaveBeenCalledWith('/my/project');
      expect(mocks.mockGitCreateBranch).toHaveBeenCalledWith('/my/project', 'main');
      expect(mocks.mockGitAdd).toHaveBeenCalledWith('/my/project', ['.']);
      expect(mocks.mockGitCommit).toHaveBeenCalledWith('/my/project', 'Initial commit');
      expect(mocks.mockGitCreateBranch).toHaveBeenCalledWith('/my/project', 'dev');
      expect(mocks.mockGitAddRemote).not.toHaveBeenCalled();
      expect(mocks.mockGitPush).not.toHaveBeenCalled();
    });

    it('adds remote and pushes when remoteUrl is provided', async () => {
      mocks.mockGitInit.mockResolvedValue(undefined);
      mocks.mockGitCreateBranch.mockResolvedValue(undefined);
      mocks.mockGitAdd.mockResolvedValue(undefined);
      mocks.mockGitCommit.mockResolvedValue(undefined);
      mocks.mockGitAddRemote.mockResolvedValue(undefined);
      mocks.mockGitPush.mockResolvedValue(undefined);

      const handler = getHandler('project:initialize-git');
      await handler!({}, '/my/project', 'upstream', 'https://github.com/org/repo.git');

      expect(mocks.mockGitAddRemote).toHaveBeenCalledWith(
        '/my/project',
        'upstream',
        'https://github.com/org/repo.git'
      );
      expect(mocks.mockGitPush).toHaveBeenCalledWith('/my/project', 'upstream', 'main');
      expect(mocks.mockGitPush).toHaveBeenCalledWith('/my/project', 'upstream', 'dev');
    });

    it('defaults remoteName to origin when not provided', async () => {
      mocks.mockGitInit.mockResolvedValue(undefined);
      mocks.mockGitCreateBranch.mockResolvedValue(undefined);
      mocks.mockGitAdd.mockResolvedValue(undefined);
      mocks.mockGitCommit.mockResolvedValue(undefined);
      mocks.mockGitAddRemote.mockResolvedValue(undefined);
      mocks.mockGitPush.mockResolvedValue(undefined);

      const handler = getHandler('project:initialize-git');
      await handler!({}, '/my/project', undefined, 'https://github.com/org/repo.git');

      expect(mocks.mockGitAddRemote).toHaveBeenCalledWith(
        '/my/project',
        'origin',
        'https://github.com/org/repo.git'
      );
      expect(mocks.mockGitPush).toHaveBeenCalledWith('/my/project', 'origin', 'main');
      expect(mocks.mockGitPush).toHaveBeenCalledWith('/my/project', 'origin', 'dev');
    });
  });
});
