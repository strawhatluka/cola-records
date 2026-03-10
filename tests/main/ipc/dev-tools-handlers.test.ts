import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  // codeServerService
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockGetStatus: vi.fn(),
  mockAddWorkspace: vi.fn(),
  mockRemoveWorkspace: vi.fn(),
  mockGetMountedProjects: vi.fn(),
  mockGetContainerStats: vi.fn(),
  // terminalService
  mockSpawn: vi.fn(),
  mockWrite: vi.fn(),
  mockResize: vi.fn(),
  mockKill: vi.fn(),
  mockGetOutputBuffer: vi.fn(),
  // database
  mockGetDevScripts: vi.fn(),
  mockSaveDevScript: vi.fn(),
  mockDeleteDevScript: vi.fn(),
  // updaterService
  mockCheckForUpdates: vi.fn(),
  mockDownloadUpdate: vi.fn(),
  mockQuitAndInstall: vi.fn(),
  mockGetUpdaterStatus: vi.fn(),
  mockGetVersion: vi.fn(),
  // projectDetectionService
  mockDetect: vi.fn(),
  mockGetInstallCommand: vi.fn(),
  mockGetTypecheckCommand: vi.fn(),
  mockGetGitInitCommand: vi.fn(),
  mockGetHookInstallCommand: vi.fn(),
  mockGetCleanTargets: vi.fn(),
  // diskUsageService
  mockDiskScan: vi.fn(),
  // envScannerService
  mockEnvScan: vi.fn(),
  // envFileService
  mockDiscoverEnvFiles: vi.fn(),
  mockCreateEnvExample: vi.fn(),
  mockCreateEnvFile: vi.fn(),
  mockReadEnvFile: vi.fn(),
  mockWriteEnvFile: vi.fn(),
  mockSyncEnvFiles: vi.fn(),
  // hooksService
  mockHooksDetect: vi.fn(),
  mockSetupHookTool: vi.fn(),
  mockGetHookInstallCmd: vi.fn(),
  mockReadHooksConfig: vi.fn(),
  mockWriteHooksConfig: vi.fn(),
  mockSetupLintStaged: vi.fn(),
  mockGetPresetActions: vi.fn(),
  mockGetLintStagedPresets: vi.fn(),
  // editorconfigService
  mockReadEditorconfig: vi.fn(),
  mockWriteEditorconfig: vi.fn(),
  mockCreateDefault: vi.fn(),
  mockDeleteEditorconfig: vi.fn(),
  mockGetEditorconfigPresets: vi.fn(),
  // formatConfigService
  mockDetectFormatter: vi.fn(),
  mockReadFormatConfig: vi.fn(),
  mockWriteFormatConfig: vi.fn(),
  mockGetFormatPresets: vi.fn(),
  mockCreateFormatIgnore: vi.fn(),
  mockReadFormatIgnore: vi.fn(),
  mockWriteFormatIgnore: vi.fn(),
  // testConfigService
  mockDetectTestFramework: vi.fn(),
  mockReadTestConfig: vi.fn(),
  mockWriteTestConfig: vi.fn(),
  mockGetTestPresets: vi.fn(),
  // coverageConfigService
  mockDetectCoverage: vi.fn(),
  mockReadCoverageConfig: vi.fn(),
  mockWriteCoverageConfig: vi.fn(),
  mockGetCoveragePresets: vi.fn(),
  mockOpenReport: vi.fn(),
  // buildConfigService
  mockDetectBuildTool: vi.fn(),
  mockReadBuildConfig: vi.fn(),
  mockWriteBuildConfig: vi.fn(),
  mockGetBuildPresets: vi.fn(),
  // lintConfigService
  mockDetectLinter: vi.fn(),
  mockReadLintConfig: vi.fn(),
  mockWriteLintConfig: vi.fn(),
  mockGetLintPresets: vi.fn(),
  // fs
  mockAccess: vi.fn(),
  mockCopyFile: vi.fn(),
  mockFsWriteFile: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services/code-server.service', () => ({
  codeServerService: {
    start: mocks.mockStart,
    stop: mocks.mockStop,
    getStatus: mocks.mockGetStatus,
    addWorkspace: mocks.mockAddWorkspace,
    removeWorkspace: mocks.mockRemoveWorkspace,
    getMountedProjects: mocks.mockGetMountedProjects,
    getContainerStats: mocks.mockGetContainerStats,
  },
}));

vi.mock('../../../src/main/services/terminal.service', () => ({
  terminalService: {
    spawn: mocks.mockSpawn,
    write: mocks.mockWrite,
    resize: mocks.mockResize,
    kill: mocks.mockKill,
    getOutputBuffer: mocks.mockGetOutputBuffer,
  },
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    initialize: vi.fn(),
    getDevScripts: mocks.mockGetDevScripts,
    saveDevScript: mocks.mockSaveDevScript,
    deleteDevScript: mocks.mockDeleteDevScript,
    getSetting: vi.fn(),
    setSetting: vi.fn(),
  },
}));

vi.mock('../../../src/main/services/updater.service', () => ({
  updaterService: {
    checkForUpdates: mocks.mockCheckForUpdates,
    downloadUpdate: mocks.mockDownloadUpdate,
    quitAndInstall: mocks.mockQuitAndInstall,
    getStatus: mocks.mockGetUpdaterStatus,
    getVersion: mocks.mockGetVersion,
  },
}));

vi.mock('../../../src/main/services/project-detection.service', () => ({
  projectDetectionService: {
    detect: mocks.mockDetect,
    getInstallCommand: mocks.mockGetInstallCommand,
    getTypecheckCommand: mocks.mockGetTypecheckCommand,
    getGitInitCommand: mocks.mockGetGitInitCommand,
    getHookInstallCommand: mocks.mockGetHookInstallCommand,
    getCleanTargets: mocks.mockGetCleanTargets,
  },
}));

vi.mock('../../../src/main/services/disk-usage.service', () => ({
  diskUsageService: { scan: mocks.mockDiskScan },
}));

vi.mock('../../../src/main/services/env-scanner.service', () => ({
  envScannerService: { scan: mocks.mockEnvScan },
}));

vi.mock('../../../src/main/services/env-file.service', () => ({
  envFileService: {
    discoverEnvFiles: mocks.mockDiscoverEnvFiles,
    createEnvExample: mocks.mockCreateEnvExample,
    createEnvFile: mocks.mockCreateEnvFile,
    readEnvFile: mocks.mockReadEnvFile,
    writeEnvFile: mocks.mockWriteEnvFile,
    syncEnvFiles: mocks.mockSyncEnvFiles,
  },
}));

vi.mock('../../../src/main/services/hooks.service', () => ({
  hooksService: {
    detect: mocks.mockHooksDetect,
    setupHookTool: mocks.mockSetupHookTool,
    getInstallCommand: mocks.mockGetHookInstallCmd,
    readConfig: mocks.mockReadHooksConfig,
    writeConfig: mocks.mockWriteHooksConfig,
    setupLintStaged: mocks.mockSetupLintStaged,
    getPresetActions: mocks.mockGetPresetActions,
    getLintStagedPresets: mocks.mockGetLintStagedPresets,
  },
}));

vi.mock('../../../src/main/services/editorconfig.service', () => ({
  editorconfigService: {
    readConfig: mocks.mockReadEditorconfig,
    writeConfig: mocks.mockWriteEditorconfig,
    createDefault: mocks.mockCreateDefault,
    deleteConfig: mocks.mockDeleteEditorconfig,
    getPresets: mocks.mockGetEditorconfigPresets,
  },
}));

vi.mock('../../../src/main/services/format-config.service', () => ({
  formatConfigService: {
    detectFormatter: mocks.mockDetectFormatter,
    readConfig: mocks.mockReadFormatConfig,
    writeConfig: mocks.mockWriteFormatConfig,
    getPresets: mocks.mockGetFormatPresets,
    createIgnoreFile: mocks.mockCreateFormatIgnore,
    readIgnoreFile: mocks.mockReadFormatIgnore,
    writeIgnoreFile: mocks.mockWriteFormatIgnore,
  },
}));

vi.mock('../../../src/main/services/test-config.service', () => ({
  testConfigService: {
    detectTestFramework: mocks.mockDetectTestFramework,
    readConfig: mocks.mockReadTestConfig,
    writeConfig: mocks.mockWriteTestConfig,
    getPresets: mocks.mockGetTestPresets,
  },
}));

vi.mock('../../../src/main/services/coverage-config.service', () => ({
  coverageConfigService: {
    detectCoverage: mocks.mockDetectCoverage,
    readConfig: mocks.mockReadCoverageConfig,
    writeConfig: mocks.mockWriteCoverageConfig,
    getPresets: mocks.mockGetCoveragePresets,
    openReport: mocks.mockOpenReport,
  },
}));

vi.mock('../../../src/main/services/build-config.service', () => ({
  buildConfigService: {
    detectBuildTool: mocks.mockDetectBuildTool,
    readConfig: mocks.mockReadBuildConfig,
    writeConfig: mocks.mockWriteBuildConfig,
    getPresets: mocks.mockGetBuildPresets,
  },
}));

vi.mock('../../../src/main/services/lint-config.service', () => ({
  lintConfigService: {
    detectLinter: mocks.mockDetectLinter,
    readConfig: mocks.mockReadLintConfig,
    writeConfig: mocks.mockWriteLintConfig,
    getPresets: mocks.mockGetLintPresets,
  },
}));

vi.mock('fs/promises', () => ({
  access: mocks.mockAccess,
  copyFile: mocks.mockCopyFile,
  writeFile: mocks.mockFsWriteFile,
  default: {
    access: mocks.mockAccess,
    copyFile: mocks.mockCopyFile,
    writeFile: mocks.mockFsWriteFile,
  },
}));

import { setupDevToolsHandlers } from '../../../src/main/ipc/handlers/dev-tools.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('dev-tools.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDevToolsHandlers();
  });

  it('registers all dev-tools handlers', () => {
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('code-server:start');
    expect(channels).toContain('terminal:spawn');
    expect(channels).toContain('dev-scripts:get-all');
    expect(channels).toContain('updater:check');
    expect(channels).toContain('dev-tools:detect-project');
    expect(channels).toContain('dev-tools:detect-linter');
  });

  // ── Code Server ──

  it('code-server:start delegates', async () => {
    mocks.mockStart.mockResolvedValue({ url: 'http://localhost:8080' });
    const result = await getHandler('code-server:start')!({}, '/project');
    expect(mocks.mockStart).toHaveBeenCalledWith('/project');
    expect(result).toEqual({ url: 'http://localhost:8080' });
  });

  it('code-server:stop delegates', async () => {
    await getHandler('code-server:stop')!({});
    expect(mocks.mockStop).toHaveBeenCalled();
  });

  it('code-server:status delegates', async () => {
    mocks.mockGetStatus.mockReturnValue({ running: true });
    const result = await getHandler('code-server:status')!({});
    expect(result).toEqual({ running: true });
  });

  it('code-server:add-workspace delegates', async () => {
    mocks.mockAddWorkspace.mockResolvedValue('http://localhost:8080?folder=/project');
    const result = await getHandler('code-server:add-workspace')!({}, '/project');
    expect(mocks.mockAddWorkspace).toHaveBeenCalledWith('/project');
    expect(result).toBe('http://localhost:8080?folder=/project');
  });

  it('code-server:remove-workspace stops when shouldStop is true', async () => {
    mocks.mockRemoveWorkspace.mockResolvedValue({ shouldStop: true });
    mocks.mockStop.mockResolvedValue(undefined);
    await getHandler('code-server:remove-workspace')!({}, '/project');
    expect(mocks.mockRemoveWorkspace).toHaveBeenCalledWith('/project');
    expect(mocks.mockStop).toHaveBeenCalled();
  });

  it('code-server:remove-workspace does not stop when shouldStop is false', async () => {
    mocks.mockRemoveWorkspace.mockResolvedValue({ shouldStop: false });
    await getHandler('code-server:remove-workspace')!({}, '/project');
    expect(mocks.mockStop).not.toHaveBeenCalled();
  });

  it('code-server:get-mounted-projects delegates', async () => {
    mocks.mockGetMountedProjects.mockReturnValue(['/p1', '/p2']);
    const result = await getHandler('code-server:get-mounted-projects')!({});
    expect(result).toEqual(['/p1', '/p2']);
  });

  it('code-server:get-stats delegates', async () => {
    mocks.mockGetContainerStats.mockResolvedValue({ cpu: '5%' });
    const result = await getHandler('code-server:get-stats')!({});
    expect(result).toEqual({ cpu: '5%' });
  });

  // ── Terminal ──

  it('terminal:spawn delegates', async () => {
    mocks.mockSpawn.mockReturnValue({ id: 't1', shellType: 'bash' });
    const result = await getHandler('terminal:spawn')!({}, 'bash', '/dir');
    expect(mocks.mockSpawn).toHaveBeenCalledWith('bash', '/dir');
    expect(result).toEqual({ id: 't1', shellType: 'bash' });
  });

  it('terminal:write delegates', async () => {
    await getHandler('terminal:write')!({}, 't1', 'ls\n');
    expect(mocks.mockWrite).toHaveBeenCalledWith('t1', 'ls\n');
  });

  it('terminal:resize delegates', async () => {
    await getHandler('terminal:resize')!({}, 't1', 80, 24);
    expect(mocks.mockResize).toHaveBeenCalledWith('t1', 80, 24);
  });

  it('terminal:kill delegates', async () => {
    await getHandler('terminal:kill')!({}, 't1');
    expect(mocks.mockKill).toHaveBeenCalledWith('t1');
  });

  it('terminal:get-buffer delegates', async () => {
    mocks.mockGetOutputBuffer.mockReturnValue('output');
    const result = await getHandler('terminal:get-buffer')!({}, 't1');
    expect(mocks.mockGetOutputBuffer).toHaveBeenCalledWith('t1');
    expect(result).toBe('output');
  });

  // ── Dev Scripts ──

  it('dev-scripts:get-all delegates', async () => {
    mocks.mockGetDevScripts.mockReturnValue([]);
    const result = await getHandler('dev-scripts:get-all')!({}, '/project');
    expect(mocks.mockGetDevScripts).toHaveBeenCalledWith('/project');
    expect(result).toEqual([]);
  });

  it('dev-scripts:save delegates', async () => {
    const script = { id: 's1', name: 'test' };
    await getHandler('dev-scripts:save')!({}, script);
    expect(mocks.mockSaveDevScript).toHaveBeenCalledWith(script);
  });

  it('dev-scripts:delete delegates', async () => {
    await getHandler('dev-scripts:delete')!({}, 's1');
    expect(mocks.mockDeleteDevScript).toHaveBeenCalledWith('s1');
  });

  // ── Updater ──

  it('updater:check returns formatted info', async () => {
    mocks.mockCheckForUpdates.mockResolvedValue({
      version: '2.0.0',
      releaseDate: '2026-03-01',
      releaseNotes: 'Bug fixes',
    });
    const result = (await getHandler('updater:check')!({})) as Record<string, unknown>;
    expect(result).toEqual({
      version: '2.0.0',
      releaseDate: '2026-03-01',
      releaseNotes: 'Bug fixes',
    });
  });

  it('updater:check returns null when no update', async () => {
    mocks.mockCheckForUpdates.mockResolvedValue(null);
    const result = await getHandler('updater:check')!({});
    expect(result).toBeNull();
  });

  it('updater:check handles array releaseNotes', async () => {
    mocks.mockCheckForUpdates.mockResolvedValue({
      version: '2.0.0',
      releaseDate: '2026-03-01',
      releaseNotes: [
        { version: 'v2.0.0', note: 'Major update' },
        { version: 'v1.9.0', note: 'Minor fix' },
      ],
    });
    const result = (await getHandler('updater:check')!({})) as Record<string, unknown>;
    expect(result!.releaseNotes).toBe('v2.0.0: Major update\nv1.9.0: Minor fix');
  });

  it('updater:download delegates', async () => {
    await getHandler('updater:download')!({});
    expect(mocks.mockDownloadUpdate).toHaveBeenCalled();
  });

  it('updater:install delegates', async () => {
    await getHandler('updater:install')!({});
    expect(mocks.mockQuitAndInstall).toHaveBeenCalled();
  });

  it('updater:get-status delegates', async () => {
    mocks.mockGetUpdaterStatus.mockReturnValue('idle');
    const result = await getHandler('updater:get-status')!({});
    expect(result).toBe('idle');
  });

  it('updater:get-version delegates', async () => {
    mocks.mockGetVersion.mockReturnValue('1.0.9');
    const result = await getHandler('updater:get-version')!({});
    expect(result).toBe('1.0.9');
  });

  // ── Project Detection ──

  it('dev-tools:detect-project delegates', async () => {
    mocks.mockDetect.mockResolvedValue({ ecosystem: 'node' });
    const result = await getHandler('dev-tools:detect-project')!({}, '/dir');
    expect(mocks.mockDetect).toHaveBeenCalledWith('/dir');
    expect(result).toEqual({ ecosystem: 'node' });
  });

  it('dev-tools:get-install-command detects and gets command', async () => {
    mocks.mockDetect.mockResolvedValue({ packageManager: 'npm' });
    mocks.mockGetInstallCommand.mockReturnValue('npm install');
    const result = await getHandler('dev-tools:get-install-command')!({}, '/dir');
    expect(mocks.mockGetInstallCommand).toHaveBeenCalledWith('npm');
    expect(result).toBe('npm install');
  });

  it('dev-tools:get-typecheck-command detects and gets command', async () => {
    mocks.mockDetect.mockResolvedValue({ ecosystem: 'node' });
    mocks.mockGetTypecheckCommand.mockReturnValue('npx tsc --noEmit');
    const result = await getHandler('dev-tools:get-typecheck-command')!({}, '/dir');
    expect(mocks.mockGetTypecheckCommand).toHaveBeenCalledWith('node');
    expect(result).toBe('npx tsc --noEmit');
  });

  it('dev-tools:get-git-init-command delegates', async () => {
    mocks.mockGetGitInitCommand.mockReturnValue('git init');
    const result = await getHandler('dev-tools:get-git-init-command')!({});
    expect(result).toBe('git init');
  });

  it('dev-tools:get-hooks-command detects and gets command', async () => {
    mocks.mockDetect.mockResolvedValue({ hookTool: 'husky' });
    mocks.mockGetHookInstallCommand.mockReturnValue('npx husky install');
    const result = await getHandler('dev-tools:get-hooks-command')!({}, '/dir');
    expect(mocks.mockGetHookInstallCommand).toHaveBeenCalledWith('husky');
    expect(result).toBe('npx husky install');
  });

  it('dev-tools:get-clean-targets detects and gets targets', async () => {
    mocks.mockDetect.mockResolvedValue({ ecosystem: 'node' });
    mocks.mockGetCleanTargets.mockResolvedValue(['node_modules', 'dist']);
    const result = await getHandler('dev-tools:get-clean-targets')!({}, '/dir');
    expect(mocks.mockGetCleanTargets).toHaveBeenCalledWith('/dir', 'node');
    expect(result).toEqual(['node_modules', 'dist']);
  });

  it('dev-tools:disk-usage delegates', async () => {
    mocks.mockDiskScan.mockResolvedValue({ total: 1000 });
    const result = await getHandler('dev-tools:disk-usage')!({}, '/dir');
    expect(mocks.mockDiskScan).toHaveBeenCalledWith('/dir');
    expect(result).toEqual({ total: 1000 });
  });

  it('dev-tools:project-info delegates to detect', async () => {
    mocks.mockDetect.mockResolvedValue({ ecosystem: 'node' });
    const result = await getHandler('dev-tools:project-info')!({}, '/dir');
    expect(mocks.mockDetect).toHaveBeenCalledWith('/dir');
    expect(result).toEqual({ ecosystem: 'node' });
  });

  // ── Env File Management ──

  it('dev-tools:scan-env-variables delegates', async () => {
    mocks.mockEnvScan.mockResolvedValue([]);
    await getHandler('dev-tools:scan-env-variables')!({}, '/dir', 'node');
    expect(mocks.mockEnvScan).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:discover-env-files delegates', async () => {
    mocks.mockDiscoverEnvFiles.mockResolvedValue([]);
    await getHandler('dev-tools:discover-env-files')!({}, '/dir');
    expect(mocks.mockDiscoverEnvFiles).toHaveBeenCalledWith('/dir');
  });

  it('dev-tools:create-env-example delegates', async () => {
    mocks.mockCreateEnvExample.mockResolvedValue({ success: true });
    await getHandler('dev-tools:create-env-example')!({}, '/dir', 'node');
    expect(mocks.mockCreateEnvExample).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:create-env-file delegates', async () => {
    mocks.mockCreateEnvFile.mockResolvedValue({ success: true });
    await getHandler('dev-tools:create-env-file')!({}, '/dir', '.env.local');
    expect(mocks.mockCreateEnvFile).toHaveBeenCalledWith('/dir', '.env.local');
  });

  it('dev-tools:read-env-file delegates', async () => {
    mocks.mockReadEnvFile.mockResolvedValue('KEY=value');
    await getHandler('dev-tools:read-env-file')!({}, '/dir/.env');
    expect(mocks.mockReadEnvFile).toHaveBeenCalledWith('/dir/.env');
  });

  it('dev-tools:write-env-file delegates', async () => {
    await getHandler('dev-tools:write-env-file')!({}, '/dir/.env', 'KEY=new');
    expect(mocks.mockWriteEnvFile).toHaveBeenCalledWith('/dir/.env', 'KEY=new');
  });

  it('dev-tools:sync-env-files delegates', async () => {
    mocks.mockSyncEnvFiles.mockResolvedValue({ synced: true });
    await getHandler('dev-tools:sync-env-files')!({}, '/dir', 'node');
    expect(mocks.mockSyncEnvFiles).toHaveBeenCalledWith('/dir', 'node');
  });

  // ── Setup Env File (complex logic) ──

  it('dev-tools:setup-env-file returns error if .env already exists', async () => {
    mocks.mockAccess.mockResolvedValue(undefined);
    const result = (await getHandler('dev-tools:setup-env-file')!({}, '/dir')) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(false);
    expect(result.message).toBe('.env file already exists');
  });

  it('dev-tools:setup-env-file copies from .env.example if it exists', async () => {
    mocks.mockAccess
      .mockRejectedValueOnce(new Error('not found')) // .env doesn't exist
      .mockResolvedValueOnce(undefined); // .env.example exists
    mocks.mockCopyFile.mockResolvedValue(undefined);
    const result = (await getHandler('dev-tools:setup-env-file')!({}, '/dir')) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(true);
    expect(result.message).toContain('.env.example');
    expect(mocks.mockCopyFile).toHaveBeenCalled();
  });

  it('dev-tools:setup-env-file creates empty .env if no example', async () => {
    mocks.mockAccess
      .mockRejectedValueOnce(new Error('not found')) // .env doesn't exist
      .mockRejectedValueOnce(new Error('not found')); // .env.example doesn't exist
    mocks.mockFsWriteFile.mockResolvedValue(undefined);
    const result = (await getHandler('dev-tools:setup-env-file')!({}, '/dir')) as Record<
      string,
      unknown
    >;
    expect(result.success).toBe(true);
    expect(result.message).toContain('empty .env');
  });

  // ── Hooks Management ──

  it('dev-tools:detect-hooks delegates', async () => {
    mocks.mockHooksDetect.mockResolvedValue({ tool: 'husky' });
    await getHandler('dev-tools:detect-hooks')!({}, '/dir', 'node');
    expect(mocks.mockHooksDetect).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:setup-hook-tool delegates', async () => {
    mocks.mockSetupHookTool.mockResolvedValue({ success: true });
    await getHandler('dev-tools:setup-hook-tool')!({}, '/dir', 'husky', 'node');
    expect(mocks.mockSetupHookTool).toHaveBeenCalledWith('/dir', 'husky', 'node');
  });

  it('dev-tools:get-hook-install-cmd delegates', async () => {
    mocks.mockGetHookInstallCmd.mockReturnValue('npx husky install');
    await getHandler('dev-tools:get-hook-install-cmd')!({}, 'husky');
    expect(mocks.mockGetHookInstallCmd).toHaveBeenCalledWith('husky');
  });

  it('dev-tools:read-hooks-config delegates', async () => {
    mocks.mockReadHooksConfig.mockResolvedValue({});
    await getHandler('dev-tools:read-hooks-config')!({}, '/dir', 'husky');
    expect(mocks.mockReadHooksConfig).toHaveBeenCalledWith('/dir', 'husky');
  });

  it('dev-tools:write-hooks-config delegates', async () => {
    const config = { hooks: {} };
    await getHandler('dev-tools:write-hooks-config')!({}, '/dir', config);
    expect(mocks.mockWriteHooksConfig).toHaveBeenCalledWith('/dir', config);
  });

  it('dev-tools:setup-lint-staged delegates', async () => {
    const config = { '*.ts': 'eslint' };
    await getHandler('dev-tools:setup-lint-staged')!({}, '/dir', config);
    expect(mocks.mockSetupLintStaged).toHaveBeenCalledWith('/dir', config);
  });

  it('dev-tools:get-hook-presets delegates', async () => {
    mocks.mockGetPresetActions.mockReturnValue([]);
    await getHandler('dev-tools:get-hook-presets')!({}, 'node', 'husky');
    expect(mocks.mockGetPresetActions).toHaveBeenCalledWith('node', 'husky');
  });

  it('dev-tools:get-lint-staged-presets delegates', async () => {
    mocks.mockGetLintStagedPresets.mockReturnValue([]);
    await getHandler('dev-tools:get-lint-staged-presets')!({}, 'node');
    expect(mocks.mockGetLintStagedPresets).toHaveBeenCalledWith('node');
  });

  // ── EditorConfig ──

  it('dev-tools:read-editorconfig delegates', async () => {
    mocks.mockReadEditorconfig.mockResolvedValue({});
    await getHandler('dev-tools:read-editorconfig')!({}, '/dir');
    expect(mocks.mockReadEditorconfig).toHaveBeenCalledWith('/dir');
  });

  it('dev-tools:write-editorconfig delegates', async () => {
    const config = { root: true };
    await getHandler('dev-tools:write-editorconfig')!({}, '/dir', config);
    expect(mocks.mockWriteEditorconfig).toHaveBeenCalledWith('/dir', config);
  });

  it('dev-tools:create-editorconfig delegates', async () => {
    await getHandler('dev-tools:create-editorconfig')!({}, '/dir', 'node');
    expect(mocks.mockCreateDefault).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:delete-editorconfig delegates', async () => {
    await getHandler('dev-tools:delete-editorconfig')!({}, '/dir');
    expect(mocks.mockDeleteEditorconfig).toHaveBeenCalledWith('/dir');
  });

  it('dev-tools:get-editorconfig-presets delegates', async () => {
    mocks.mockGetEditorconfigPresets.mockReturnValue([]);
    await getHandler('dev-tools:get-editorconfig-presets')!({}, 'node');
    expect(mocks.mockGetEditorconfigPresets).toHaveBeenCalledWith('node');
  });

  // ── Format Config ──

  it('dev-tools:detect-formatter delegates', async () => {
    mocks.mockDetectFormatter.mockResolvedValue({ formatter: 'prettier' });
    await getHandler('dev-tools:detect-formatter')!({}, '/dir', 'node');
    expect(mocks.mockDetectFormatter).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:read-format-config delegates', async () => {
    mocks.mockReadFormatConfig.mockResolvedValue({});
    await getHandler('dev-tools:read-format-config')!({}, '/dir/.prettierrc', 'prettier');
    expect(mocks.mockReadFormatConfig).toHaveBeenCalledWith('/dir/.prettierrc', 'prettier');
  });

  it('dev-tools:write-format-config delegates', async () => {
    await getHandler('dev-tools:write-format-config')!({}, '/dir', 'prettier', {});
    expect(mocks.mockWriteFormatConfig).toHaveBeenCalledWith('/dir', 'prettier', {});
  });

  it('dev-tools:get-format-presets delegates', async () => {
    mocks.mockGetFormatPresets.mockReturnValue([]);
    await getHandler('dev-tools:get-format-presets')!({}, 'node', 'prettier');
    expect(mocks.mockGetFormatPresets).toHaveBeenCalledWith('node', 'prettier');
  });

  it('dev-tools:create-format-ignore delegates', async () => {
    await getHandler('dev-tools:create-format-ignore')!({}, '/dir', 'prettier');
    expect(mocks.mockCreateFormatIgnore).toHaveBeenCalledWith('/dir', 'prettier');
  });

  it('dev-tools:read-format-ignore delegates', async () => {
    mocks.mockReadFormatIgnore.mockResolvedValue('node_modules');
    await getHandler('dev-tools:read-format-ignore')!({}, '/dir', 'prettier');
    expect(mocks.mockReadFormatIgnore).toHaveBeenCalledWith('/dir', 'prettier');
  });

  it('dev-tools:write-format-ignore delegates', async () => {
    await getHandler('dev-tools:write-format-ignore')!({}, '/dir', 'prettier', 'dist');
    expect(mocks.mockWriteFormatIgnore).toHaveBeenCalledWith('/dir', 'prettier', 'dist');
  });

  // ── Test Config ──

  it('dev-tools:detect-test-framework delegates', async () => {
    mocks.mockDetectTestFramework.mockResolvedValue({ framework: 'vitest' });
    await getHandler('dev-tools:detect-test-framework')!({}, '/dir', 'node');
    expect(mocks.mockDetectTestFramework).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:read-test-config delegates', async () => {
    mocks.mockReadTestConfig.mockResolvedValue({});
    await getHandler('dev-tools:read-test-config')!({}, '/dir/vitest.config.ts', 'vitest');
    expect(mocks.mockReadTestConfig).toHaveBeenCalledWith('/dir/vitest.config.ts', 'vitest');
  });

  it('dev-tools:write-test-config delegates', async () => {
    await getHandler('dev-tools:write-test-config')!({}, '/dir', 'vitest', {});
    expect(mocks.mockWriteTestConfig).toHaveBeenCalledWith('/dir', 'vitest', {});
  });

  it('dev-tools:get-test-presets delegates', async () => {
    mocks.mockGetTestPresets.mockReturnValue([]);
    await getHandler('dev-tools:get-test-presets')!({}, 'node', 'vitest');
    expect(mocks.mockGetTestPresets).toHaveBeenCalledWith('node', 'vitest');
  });

  // ── Coverage Config ──

  it('dev-tools:detect-coverage delegates', async () => {
    mocks.mockDetectCoverage.mockResolvedValue({ provider: 'v8' });
    await getHandler('dev-tools:detect-coverage')!({}, '/dir', 'node');
    expect(mocks.mockDetectCoverage).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:read-coverage-config delegates', async () => {
    mocks.mockReadCoverageConfig.mockResolvedValue({});
    await getHandler('dev-tools:read-coverage-config')!({}, '/path', 'v8');
    expect(mocks.mockReadCoverageConfig).toHaveBeenCalledWith('/path', 'v8');
  });

  it('dev-tools:write-coverage-config delegates', async () => {
    await getHandler('dev-tools:write-coverage-config')!({}, '/dir', 'v8', {});
    expect(mocks.mockWriteCoverageConfig).toHaveBeenCalledWith('/dir', 'v8', {});
  });

  it('dev-tools:get-coverage-presets delegates', async () => {
    mocks.mockGetCoveragePresets.mockReturnValue([]);
    await getHandler('dev-tools:get-coverage-presets')!({}, 'node', 'v8');
    expect(mocks.mockGetCoveragePresets).toHaveBeenCalledWith('node', 'v8');
  });

  it('dev-tools:open-coverage-report delegates', async () => {
    await getHandler('dev-tools:open-coverage-report')!({}, '/report');
    expect(mocks.mockOpenReport).toHaveBeenCalledWith('/report');
  });

  // ── Build Config ──

  it('dev-tools:detect-build-tool delegates', async () => {
    mocks.mockDetectBuildTool.mockResolvedValue({ tool: 'vite' });
    await getHandler('dev-tools:detect-build-tool')!({}, '/dir', 'node');
    expect(mocks.mockDetectBuildTool).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:read-build-config delegates', async () => {
    mocks.mockReadBuildConfig.mockResolvedValue({});
    await getHandler('dev-tools:read-build-config')!({}, '/path', 'vite');
    expect(mocks.mockReadBuildConfig).toHaveBeenCalledWith('/path', 'vite');
  });

  it('dev-tools:write-build-config delegates', async () => {
    await getHandler('dev-tools:write-build-config')!({}, '/dir', 'vite', {});
    expect(mocks.mockWriteBuildConfig).toHaveBeenCalledWith('/dir', 'vite', {});
  });

  it('dev-tools:get-build-presets delegates', async () => {
    mocks.mockGetBuildPresets.mockReturnValue([]);
    await getHandler('dev-tools:get-build-presets')!({}, 'node', 'vite');
    expect(mocks.mockGetBuildPresets).toHaveBeenCalledWith('node', 'vite');
  });

  // ── Lint Config ──

  it('dev-tools:detect-linter delegates', async () => {
    mocks.mockDetectLinter.mockResolvedValue({ linter: 'eslint' });
    await getHandler('dev-tools:detect-linter')!({}, '/dir', 'node');
    expect(mocks.mockDetectLinter).toHaveBeenCalledWith('/dir', 'node');
  });

  it('dev-tools:read-lint-config delegates', async () => {
    mocks.mockReadLintConfig.mockResolvedValue({});
    await getHandler('dev-tools:read-lint-config')!({}, '/path', 'eslint');
    expect(mocks.mockReadLintConfig).toHaveBeenCalledWith('/path', 'eslint');
  });

  it('dev-tools:write-lint-config delegates', async () => {
    await getHandler('dev-tools:write-lint-config')!({}, '/dir', 'eslint', {});
    expect(mocks.mockWriteLintConfig).toHaveBeenCalledWith('/dir', 'eslint', {});
  });

  it('dev-tools:get-lint-presets delegates', async () => {
    mocks.mockGetLintPresets.mockReturnValue([]);
    await getHandler('dev-tools:get-lint-presets')!({}, 'node', 'eslint');
    expect(mocks.mockGetLintPresets).toHaveBeenCalledWith('node', 'eslint');
  });
});
