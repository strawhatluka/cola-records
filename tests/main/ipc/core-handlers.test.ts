import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  // fileSystemService
  mockReadDirectory: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockMoveFile: vi.fn(),
  // gitService
  mockGetStatus: vi.fn(),
  mockGetLog: vi.fn(),
  mockAdd: vi.fn(),
  mockCommit: vi.fn(),
  mockPush: vi.fn(),
  mockPull: vi.fn(),
  mockClone: vi.fn(),
  mockCheckout: vi.fn(),
  mockCreateBranch: vi.fn(),
  mockGetBranches: vi.fn(),
  mockGetRemoteBranches: vi.fn(),
  mockGetCurrentBranch: vi.fn(),
  mockCompareBranches: vi.fn(),
  mockDeleteBranch: vi.fn(),
  mockGetBranchInfo: vi.fn(),
  mockAddRemote: vi.fn(),
  mockGetRemotes: vi.fn(),
  mockGetDiff: vi.fn(),
  mockGetDiffStaged: vi.fn(),
  mockTag: vi.fn(),
  mockPushTags: vi.fn(),
  // gitIgnoreService
  mockIsIgnored: vi.fn(),
  mockGetPatterns: vi.fn(),
  // electron shell
  mockShowItemInFolder: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockOpenPath: vi.fn(),
  // electron dialog
  mockShowOpenDialog: vi.fn(),
  // fs
  mockExistsSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  // child_process
  mockExec: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services', () => ({
  fileSystemService: {
    readDirectory: mocks.mockReadDirectory,
    readFile: mocks.mockReadFile,
    writeFile: mocks.mockWriteFile,
    deleteFile: mocks.mockDeleteFile,
    moveFile: mocks.mockMoveFile,
  },
  gitService: {
    getStatus: mocks.mockGetStatus,
    getLog: mocks.mockGetLog,
    add: mocks.mockAdd,
    commit: mocks.mockCommit,
    push: mocks.mockPush,
    pull: mocks.mockPull,
    clone: mocks.mockClone,
    checkout: mocks.mockCheckout,
    createBranch: mocks.mockCreateBranch,
    getBranches: mocks.mockGetBranches,
    getRemoteBranches: mocks.mockGetRemoteBranches,
    getCurrentBranch: mocks.mockGetCurrentBranch,
    compareBranches: mocks.mockCompareBranches,
    deleteBranch: mocks.mockDeleteBranch,
    getBranchInfo: mocks.mockGetBranchInfo,
    addRemote: mocks.mockAddRemote,
    getRemotes: mocks.mockGetRemotes,
    getDiff: mocks.mockGetDiff,
    getDiffStaged: mocks.mockGetDiffStaged,
    tag: mocks.mockTag,
    pushTags: mocks.mockPushTags,
  },
  gitIgnoreService: {
    isIgnored: mocks.mockIsIgnored,
    getPatterns: mocks.mockGetPatterns,
  },
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0',
    getPath: (name: string) => (name === 'documents' ? '/mock/documents' : '/mock/path'),
    getAppPath: () => '/mock/app',
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
    commandLine: { appendSwitch: vi.fn() },
  },
  shell: {
    showItemInFolder: mocks.mockShowItemInFolder,
    openExternal: mocks.mockOpenExternal,
    openPath: mocks.mockOpenPath,
  },
  dialog: {
    showOpenDialog: mocks.mockShowOpenDialog,
  },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

vi.mock('fs', () => ({
  existsSync: mocks.mockExistsSync,
  rmSync: mocks.mockRmSync,
  readdirSync: mocks.mockReaddirSync,
  default: {
    existsSync: mocks.mockExistsSync,
    rmSync: mocks.mockRmSync,
    readdirSync: mocks.mockReaddirSync,
  },
}));

vi.mock('child_process', () => ({
  exec: mocks.mockExec,
}));

import { setupCoreHandlers } from '../../../src/main/ipc/handlers/core.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('core.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCoreHandlers();
  });

  it('registers all expected handlers', () => {
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('echo');
    expect(channels).toContain('fs:read-directory');
    expect(channels).toContain('fs:read-file');
    expect(channels).toContain('fs:write-file');
    expect(channels).toContain('fs:delete-file');
    expect(channels).toContain('fs:rename-file');
    expect(channels).toContain('fs:reveal-in-explorer');
    expect(channels).toContain('fs:directory-exists');
    expect(channels).toContain('fs:delete-directory');
    expect(channels).toContain('docs:get-structure');
    expect(channels).toContain('git:status');
    expect(channels).toContain('git:log');
    expect(channels).toContain('git:add');
    expect(channels).toContain('git:commit');
    expect(channels).toContain('git:push');
    expect(channels).toContain('git:pull');
    expect(channels).toContain('git:clone');
    expect(channels).toContain('git:checkout');
    expect(channels).toContain('git:create-branch');
    expect(channels).toContain('git:get-branches');
    expect(channels).toContain('git:get-remote-branches');
    expect(channels).toContain('git:get-current-branch');
    expect(channels).toContain('git:compare-branches');
    expect(channels).toContain('git:delete-branch');
    expect(channels).toContain('git:get-branch-info');
    expect(channels).toContain('git:add-remote');
    expect(channels).toContain('git:get-remotes');
    expect(channels).toContain('git:diff');
    expect(channels).toContain('git:diff-staged');
    expect(channels).toContain('git:tag');
    expect(channels).toContain('git:push-tags');
    expect(channels).toContain('gitignore:is-ignored');
    expect(channels).toContain('gitignore:get-patterns');
    expect(channels).toContain('dialog:open-directory');
    expect(channels).toContain('shell:execute');
    expect(channels).toContain('shell:open-external');
    expect(channels).toContain('shell:launch-app');
  });

  // ── Echo ──

  it('echo returns formatted message', async () => {
    const handler = getHandler('echo');
    const result = await handler!({}, 'hello');
    expect(result).toBe('Echo: hello');
  });

  // ── File System ──

  it('fs:read-directory delegates to fileSystemService', async () => {
    mocks.mockReadDirectory.mockResolvedValue([{ name: 'file.txt' }]);
    const handler = getHandler('fs:read-directory');
    const result = await handler!({}, '/test/dir');
    expect(mocks.mockReadDirectory).toHaveBeenCalledWith('/test/dir');
    expect(result).toEqual([{ name: 'file.txt' }]);
  });

  it('fs:read-file delegates to fileSystemService', async () => {
    mocks.mockReadFile.mockResolvedValue('content');
    const handler = getHandler('fs:read-file');
    const result = await handler!({}, '/test/file.txt');
    expect(mocks.mockReadFile).toHaveBeenCalledWith('/test/file.txt');
    expect(result).toBe('content');
  });

  it('fs:write-file delegates to fileSystemService', async () => {
    mocks.mockWriteFile.mockResolvedValue(undefined);
    const handler = getHandler('fs:write-file');
    await handler!({}, '/test/file.txt', 'new content');
    expect(mocks.mockWriteFile).toHaveBeenCalledWith('/test/file.txt', 'new content');
  });

  it('fs:delete-file delegates to fileSystemService', async () => {
    mocks.mockDeleteFile.mockResolvedValue(undefined);
    const handler = getHandler('fs:delete-file');
    await handler!({}, '/test/file.txt');
    expect(mocks.mockDeleteFile).toHaveBeenCalledWith('/test/file.txt');
  });

  it('fs:rename-file delegates to fileSystemService.moveFile', async () => {
    mocks.mockMoveFile.mockResolvedValue(undefined);
    const handler = getHandler('fs:rename-file');
    await handler!({}, '/old/path', '/new/path');
    expect(mocks.mockMoveFile).toHaveBeenCalledWith('/old/path', '/new/path');
  });

  it('fs:reveal-in-explorer calls shell.showItemInFolder', async () => {
    const handler = getHandler('fs:reveal-in-explorer');
    await handler!({}, '/test/file.txt');
    expect(mocks.mockShowItemInFolder).toHaveBeenCalledWith('/test/file.txt');
  });

  it('fs:directory-exists returns true when directory exists', async () => {
    mocks.mockExistsSync.mockReturnValue(true);
    const handler = getHandler('fs:directory-exists');
    const result = await handler!({}, '/test/dir');
    expect(result).toBe(true);
  });

  it('fs:delete-directory removes directory when it exists', async () => {
    mocks.mockExistsSync.mockReturnValue(true);
    const handler = getHandler('fs:delete-directory');
    await handler!({}, '/test/dir');
    expect(mocks.mockRmSync).toHaveBeenCalledWith('/test/dir', { recursive: true, force: true });
  });

  it('fs:delete-directory does nothing when directory does not exist', async () => {
    mocks.mockExistsSync.mockReturnValue(false);
    const handler = getHandler('fs:delete-directory');
    await handler!({}, '/nonexistent');
    expect(mocks.mockRmSync).not.toHaveBeenCalled();
  });

  // ── Git ──

  it('git:status delegates to gitService', async () => {
    const mockStatus = { staged: [], unstaged: [] };
    mocks.mockGetStatus.mockResolvedValue(mockStatus);
    const handler = getHandler('git:status');
    const result = await handler!({}, '/repo');
    expect(mocks.mockGetStatus).toHaveBeenCalledWith('/repo');
    expect(result).toBe(mockStatus);
  });

  it('git:log delegates to gitService', async () => {
    const mockLog = [{ hash: 'abc123', message: 'test' }];
    mocks.mockGetLog.mockResolvedValue(mockLog);
    const handler = getHandler('git:log');
    const result = await handler!({}, '/repo', 10);
    expect(mocks.mockGetLog).toHaveBeenCalledWith('/repo', 10);
    expect(result).toBe(mockLog);
  });

  it('git:add delegates to gitService', async () => {
    mocks.mockAdd.mockResolvedValue(undefined);
    const handler = getHandler('git:add');
    await handler!({}, '/repo', ['file1.ts', 'file2.ts']);
    expect(mocks.mockAdd).toHaveBeenCalledWith('/repo', ['file1.ts', 'file2.ts']);
  });

  it('git:commit delegates to gitService', async () => {
    mocks.mockCommit.mockResolvedValue(undefined);
    const handler = getHandler('git:commit');
    await handler!({}, '/repo', 'fix: bug');
    expect(mocks.mockCommit).toHaveBeenCalledWith('/repo', 'fix: bug');
  });

  it('git:push delegates to gitService', async () => {
    mocks.mockPush.mockResolvedValue(undefined);
    const handler = getHandler('git:push');
    await handler!({}, '/repo', 'origin', 'main', true);
    expect(mocks.mockPush).toHaveBeenCalledWith('/repo', 'origin', 'main', true);
  });

  it('git:pull delegates to gitService', async () => {
    mocks.mockPull.mockResolvedValue(undefined);
    const handler = getHandler('git:pull');
    await handler!({}, '/repo', 'origin', 'main');
    expect(mocks.mockPull).toHaveBeenCalledWith('/repo', 'origin', 'main');
  });

  it('git:clone delegates to gitService', async () => {
    mocks.mockClone.mockResolvedValue(undefined);
    const handler = getHandler('git:clone');
    await handler!({}, 'https://github.com/org/repo', '/target');
    expect(mocks.mockClone).toHaveBeenCalledWith('https://github.com/org/repo', '/target');
  });

  it('git:checkout delegates to gitService', async () => {
    mocks.mockCheckout.mockResolvedValue(undefined);
    const handler = getHandler('git:checkout');
    await handler!({}, '/repo', 'feature-branch');
    expect(mocks.mockCheckout).toHaveBeenCalledWith('/repo', 'feature-branch');
  });

  it('git:create-branch delegates to gitService', async () => {
    mocks.mockCreateBranch.mockResolvedValue(undefined);
    const handler = getHandler('git:create-branch');
    await handler!({}, '/repo', 'new-branch');
    expect(mocks.mockCreateBranch).toHaveBeenCalledWith('/repo', 'new-branch');
  });

  it('git:get-branches delegates to gitService', async () => {
    mocks.mockGetBranches.mockResolvedValue(['main', 'dev']);
    const handler = getHandler('git:get-branches');
    const result = await handler!({}, '/repo');
    expect(mocks.mockGetBranches).toHaveBeenCalledWith('/repo');
    expect(result).toEqual(['main', 'dev']);
  });

  it('git:get-remote-branches delegates to gitService', async () => {
    mocks.mockGetRemoteBranches.mockResolvedValue(['origin/main']);
    const handler = getHandler('git:get-remote-branches');
    const result = await handler!({}, '/repo', 'origin');
    expect(mocks.mockGetRemoteBranches).toHaveBeenCalledWith('/repo', 'origin');
    expect(result).toEqual(['origin/main']);
  });

  it('git:get-current-branch delegates to gitService', async () => {
    mocks.mockGetCurrentBranch.mockResolvedValue('main');
    const handler = getHandler('git:get-current-branch');
    const result = await handler!({}, '/repo');
    expect(mocks.mockGetCurrentBranch).toHaveBeenCalledWith('/repo');
    expect(result).toBe('main');
  });

  it('git:compare-branches delegates to gitService', async () => {
    const mockResult = { ahead: 2, behind: 1 };
    mocks.mockCompareBranches.mockResolvedValue(mockResult);
    const handler = getHandler('git:compare-branches');
    const result = await handler!({}, '/repo', 'main', 'dev');
    expect(mocks.mockCompareBranches).toHaveBeenCalledWith('/repo', 'main', 'dev');
    expect(result).toBe(mockResult);
  });

  it('git:delete-branch delegates to gitService', async () => {
    mocks.mockDeleteBranch.mockResolvedValue(undefined);
    const handler = getHandler('git:delete-branch');
    await handler!({}, '/repo', 'old-branch', true);
    expect(mocks.mockDeleteBranch).toHaveBeenCalledWith('/repo', 'old-branch', true);
  });

  it('git:get-branch-info delegates to gitService', async () => {
    const mockInfo = { name: 'main', upstream: 'origin/main' };
    mocks.mockGetBranchInfo.mockResolvedValue(mockInfo);
    const handler = getHandler('git:get-branch-info');
    const result = await handler!({}, '/repo', 'main');
    expect(mocks.mockGetBranchInfo).toHaveBeenCalledWith('/repo', 'main');
    expect(result).toBe(mockInfo);
  });

  it('git:add-remote delegates to gitService', async () => {
    mocks.mockAddRemote.mockResolvedValue(undefined);
    const handler = getHandler('git:add-remote');
    await handler!({}, '/repo', 'upstream', 'https://github.com/org/repo');
    expect(mocks.mockAddRemote).toHaveBeenCalledWith(
      '/repo',
      'upstream',
      'https://github.com/org/repo'
    );
  });

  it('git:get-remotes delegates to gitService', async () => {
    mocks.mockGetRemotes.mockResolvedValue([{ name: 'origin', url: 'https://...' }]);
    const handler = getHandler('git:get-remotes');
    const result = await handler!({}, '/repo');
    expect(mocks.mockGetRemotes).toHaveBeenCalledWith('/repo');
    expect(result).toEqual([{ name: 'origin', url: 'https://...' }]);
  });

  it('git:diff delegates to gitService', async () => {
    mocks.mockGetDiff.mockResolvedValue('diff output');
    const handler = getHandler('git:diff');
    const result = await handler!({}, '/repo');
    expect(mocks.mockGetDiff).toHaveBeenCalledWith('/repo');
    expect(result).toBe('diff output');
  });

  it('git:diff-staged delegates to gitService', async () => {
    mocks.mockGetDiffStaged.mockResolvedValue('staged diff');
    const handler = getHandler('git:diff-staged');
    const result = await handler!({}, '/repo');
    expect(mocks.mockGetDiffStaged).toHaveBeenCalledWith('/repo');
    expect(result).toBe('staged diff');
  });

  it('git:tag delegates to gitService', async () => {
    mocks.mockTag.mockResolvedValue(undefined);
    const handler = getHandler('git:tag');
    await handler!({}, '/repo', 'v1.0.0', 'Release 1.0.0');
    expect(mocks.mockTag).toHaveBeenCalledWith('/repo', 'v1.0.0', 'Release 1.0.0');
  });

  it('git:push-tags delegates to gitService', async () => {
    mocks.mockPushTags.mockResolvedValue(undefined);
    const handler = getHandler('git:push-tags');
    await handler!({}, '/repo', 'origin');
    expect(mocks.mockPushTags).toHaveBeenCalledWith('/repo', 'origin');
  });

  // ── GitIgnore ──

  it('gitignore:is-ignored delegates to gitIgnoreService', async () => {
    mocks.mockIsIgnored.mockResolvedValue(true);
    const handler = getHandler('gitignore:is-ignored');
    const result = await handler!({}, '/repo', 'node_modules');
    expect(mocks.mockIsIgnored).toHaveBeenCalledWith('/repo', 'node_modules');
    expect(result).toBe(true);
  });

  it('gitignore:get-patterns delegates to gitIgnoreService', async () => {
    mocks.mockGetPatterns.mockResolvedValue(['node_modules', '.env']);
    const handler = getHandler('gitignore:get-patterns');
    const result = await handler!({}, '/repo');
    expect(mocks.mockGetPatterns).toHaveBeenCalledWith('/repo');
    expect(result).toEqual(['node_modules', '.env']);
  });

  // ── Dialog ──

  it('dialog:open-directory returns selected directory', async () => {
    mocks.mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/selected/dir'] });
    const handler = getHandler('dialog:open-directory');
    const result = await handler!({});
    expect(result).toBe('/selected/dir');
  });

  it('dialog:open-directory returns null when canceled', async () => {
    mocks.mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const handler = getHandler('dialog:open-directory');
    const result = await handler!({});
    expect(result).toBeNull();
  });

  // ── Shell ──

  it('shell:open-external delegates to shell.openExternal', async () => {
    mocks.mockOpenExternal.mockResolvedValue(undefined);
    const handler = getHandler('shell:open-external');
    await handler!({}, 'https://github.com');
    expect(mocks.mockOpenExternal).toHaveBeenCalledWith('https://github.com');
  });

  it('shell:execute delegates to shell.openPath', async () => {
    mocks.mockOpenPath.mockResolvedValue('');
    const handler = getHandler('shell:execute');
    await handler!({}, '/usr/bin/app');
    expect(mocks.mockOpenPath).toHaveBeenCalledWith('/usr/bin/app');
  });

  it('shell:launch-app executes allowed app command', async () => {
    const handler = getHandler('shell:launch-app');
    await handler!({}, 'chrome');
    expect(mocks.mockExec).toHaveBeenCalledWith('start chrome');
  });

  it('shell:launch-app does not execute unknown app', async () => {
    const handler = getHandler('shell:launch-app');
    await handler!({}, 'malware');
    expect(mocks.mockExec).not.toHaveBeenCalled();
  });
});
