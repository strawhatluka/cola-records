import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  mockGetAllSettings: vi.fn(),
  mockGetSetting: vi.fn(),
  mockSetSetting: vi.fn(),
  mockResetClient: vi.fn(),
  mockSyncTokenToGitCredentials: vi.fn(),
  mockUpdateToken: vi.fn(),
  mockSyncSSHConfig: vi.fn(),
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    initialize: vi.fn(),
    getAllSettings: mocks.mockGetAllSettings,
    getSetting: mocks.mockGetSetting,
    setSetting: mocks.mockSetSetting,
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
  BrowserWindow: vi.fn(),
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

vi.mock('../../../src/main/services/github-graphql.service', () => ({
  gitHubGraphQLService: {
    resetClient: mocks.mockResetClient,
  },
}));

vi.mock('../../../src/main/services', () => ({
  gitService: {
    syncTokenToGitCredentials: mocks.mockSyncTokenToGitCredentials,
  },
}));

vi.mock('../../../src/main/services/git-askpass.service', () => ({
  gitAskPassService: {
    updateToken: mocks.mockUpdateToken,
  },
}));

vi.mock('../../../src/main/services/code-server.service', () => ({
  codeServerService: {
    syncSSHConfig: mocks.mockSyncSSHConfig,
  },
}));

vi.mock('fs', () => ({
  existsSync: mocks.mockExistsSync,
  mkdirSync: mocks.mockMkdirSync,
  default: {
    existsSync: mocks.mockExistsSync,
    mkdirSync: mocks.mockMkdirSync,
  },
}));

import { setupSettingsHandlers } from '../../../src/main/ipc/handlers/settings.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('settings.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSettingsHandlers();
  });

  it('registers all 4 handlers', () => {
    expect(mocks.mockHandleIpc).toHaveBeenCalledTimes(4);
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels).toContain('settings:get');
    expect(channels).toContain('settings:update');
    expect(channels).toContain('settings:get-ssh-remotes');
    expect(channels).toContain('settings:save-ssh-remotes');
  });

  describe('settings:get', () => {
    it('returns settings with existing paths', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        githubToken: 'ghp_test',
        theme: 'dark',
        defaultClonePath: '/existing/clone',
        defaultProjectsPath: '/existing/projects',
        defaultProfessionalProjectsPath: '/existing/professional',
        autoFetch: 'true',
        aliases: '[]',
      });

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.githubToken).toBe('ghp_test');
      expect(result.theme).toBe('dark');
      expect(result.defaultClonePath).toBe('/existing/clone');
      expect(result.defaultProjectsPath).toBe('/existing/projects');
      expect(result.defaultProfessionalProjectsPath).toBe('/existing/professional');
      expect(result.autoFetch).toBe(true);
      expect(result.aliases).toEqual([]);
    });

    it('creates default clone path when not set', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultProjectsPath: '/existing/projects',
        defaultProfessionalProjectsPath: '/existing/professional',
      });
      mocks.mockExistsSync.mockReturnValue(false);

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.defaultClonePath).toContain('Contributions');
      expect(mocks.mockMkdirSync).toHaveBeenCalled();
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('defaultClonePath', expect.any(String));
    });

    it('creates default projects path when not set', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultClonePath: '/existing/clone',
        defaultProfessionalProjectsPath: '/existing/professional',
      });
      mocks.mockExistsSync.mockReturnValue(false);

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.defaultProjectsPath).toContain('My Projects');
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('defaultProjectsPath', expect.any(String));
    });

    it('creates default professional path when not set', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultClonePath: '/existing/clone',
        defaultProjectsPath: '/existing/projects',
      });
      mocks.mockExistsSync.mockReturnValue(false);

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.defaultProfessionalProjectsPath).toContain('Professional Projects');
      expect(mocks.mockSetSetting).toHaveBeenCalledWith(
        'defaultProfessionalProjectsPath',
        expect.any(String)
      );
    });

    it('does not create directory when it already exists', async () => {
      mocks.mockGetAllSettings.mockReturnValue({});
      mocks.mockExistsSync.mockReturnValue(true);

      const handler = getHandler('settings:get');
      await handler!({});

      expect(mocks.mockMkdirSync).not.toHaveBeenCalled();
    });

    it('parses JSON fields correctly', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultClonePath: '/clone',
        defaultProjectsPath: '/projects',
        defaultProfessionalProjectsPath: '/professional',
        aliases: JSON.stringify([{ name: 'gs', command: 'git status' }]),
        bashProfile: JSON.stringify({ shell: 'bash' }),
        codeServerConfig: JSON.stringify({ port: 8080 }),
        aiConfig: JSON.stringify({ provider: 'openai' }),
        notificationPreferences: JSON.stringify({ enabled: false }),
      });

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.aliases).toEqual([{ name: 'gs', command: 'git status' }]);
      expect(result.bashProfile).toEqual({ shell: 'bash' });
      expect(result.codeServerConfig).toEqual({ port: 8080 });
      expect(result.aiConfig).toEqual({ provider: 'openai' });
      expect(result.notificationPreferences).toEqual({ enabled: false });
    });

    it('handles invalid JSON gracefully', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultClonePath: '/clone',
        defaultProjectsPath: '/projects',
        defaultProfessionalProjectsPath: '/professional',
        aliases: 'not json',
        bashProfile: '{invalid',
        codeServerConfig: 'bad',
        aiConfig: '{{',
        notificationPreferences: 'nope',
      });

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.aliases).toEqual([]);
      expect(result.bashProfile).toBeUndefined();
      expect(result.codeServerConfig).toBeUndefined();
      expect(result.aiConfig).toBeUndefined();
      expect(result.notificationPreferences).toBeUndefined();
    });

    it('defaults theme to system when not set', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultClonePath: '/clone',
        defaultProjectsPath: '/projects',
        defaultProfessionalProjectsPath: '/professional',
      });

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.theme).toBe('system');
    });

    it('returns autoFetch false when not "true"', async () => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultClonePath: '/clone',
        defaultProjectsPath: '/projects',
        defaultProfessionalProjectsPath: '/professional',
        autoFetch: 'false',
      });

      const handler = getHandler('settings:get');
      const result = (await handler!({})) as Record<string, unknown>;

      expect(result.autoFetch).toBe(false);
    });
  });

  describe('settings:update', () => {
    beforeEach(() => {
      mocks.mockGetAllSettings.mockReturnValue({
        defaultClonePath: '/clone',
        defaultProjectsPath: '/projects',
        defaultProfessionalProjectsPath: '/professional',
        autoFetch: 'true',
      });
    });

    it('saves theme setting', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { theme: 'dark' });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('theme', 'dark');
    });

    it('saves defaultClonePath setting', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { defaultClonePath: '/new/path' });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('defaultClonePath', '/new/path');
    });

    it('saves autoFetch as string', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { autoFetch: false });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('autoFetch', 'false');
    });

    it('saves aliases as JSON string', async () => {
      const aliases = [{ name: 'gs', command: 'git status' }];
      const handler = getHandler('settings:update');
      await handler!({}, { aliases });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('aliases', JSON.stringify(aliases));
    });

    it('saves bashProfile as JSON string', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { bashProfile: { shell: 'zsh' } });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith(
        'bashProfile',
        JSON.stringify({ shell: 'zsh' })
      );
    });

    it('resets GitHub services when token is updated', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { githubToken: 'ghp_new' });

      expect(mocks.mockSetSetting).toHaveBeenCalledWith('githubToken', 'ghp_new');
      expect(mocks.mockResetClient).toHaveBeenCalled();
      expect(mocks.mockSyncTokenToGitCredentials).toHaveBeenCalledWith('ghp_new');
      expect(mocks.mockUpdateToken).toHaveBeenCalledWith('ghp_new');
    });

    it('handles empty github token', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { githubToken: '' });

      expect(mocks.mockSetSetting).toHaveBeenCalledWith('githubToken', '');
      expect(mocks.mockSyncTokenToGitCredentials).toHaveBeenCalledWith(null);
      expect(mocks.mockUpdateToken).toHaveBeenCalledWith(null);
    });

    it('saves spotifyClientId', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { spotifyClientId: 'spotify_id' });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('spotifyClientId', 'spotify_id');
    });

    it('saves discordToken', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { discordToken: 'discord_token' });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('discordToken', 'discord_token');
    });

    it('saves codeServerConfig as JSON', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { codeServerConfig: { port: 9090 } });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith(
        'codeServerConfig',
        JSON.stringify({ port: 9090 })
      );
    });

    it('saves aiConfig as JSON', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { aiConfig: { provider: 'anthropic' } });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith(
        'aiConfig',
        JSON.stringify({ provider: 'anthropic' })
      );
    });

    it('saves notificationPreferences as JSON', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { notificationPreferences: { enabled: false } });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith(
        'notificationPreferences',
        JSON.stringify({ enabled: false })
      );
    });

    it('saves defaultProjectsPath', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { defaultProjectsPath: '/new/projects' });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith('defaultProjectsPath', '/new/projects');
    });

    it('saves defaultProfessionalProjectsPath', async () => {
      const handler = getHandler('settings:update');
      await handler!({}, { defaultProfessionalProjectsPath: '/new/pro' });
      expect(mocks.mockSetSetting).toHaveBeenCalledWith(
        'defaultProfessionalProjectsPath',
        '/new/pro'
      );
    });

    it('returns updated settings after save', async () => {
      const handler = getHandler('settings:update');
      const result = (await handler!({}, { theme: 'dark' })) as Record<string, unknown>;

      expect(result).toBeDefined();
      expect(mocks.mockGetAllSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('settings:get-ssh-remotes', () => {
    it('returns parsed SSH remotes', async () => {
      const remotes = [{ name: 'server1', host: '192.168.1.1' }];
      mocks.mockGetSetting.mockReturnValue(JSON.stringify(remotes));

      const handler = getHandler('settings:get-ssh-remotes');
      const result = await handler!({});

      expect(mocks.mockGetSetting).toHaveBeenCalledWith('sshRemotes');
      expect(result).toEqual(remotes);
    });

    it('returns empty array when no remotes saved', async () => {
      mocks.mockGetSetting.mockReturnValue(null);

      const handler = getHandler('settings:get-ssh-remotes');
      const result = await handler!({});

      expect(result).toEqual([]);
    });
  });

  describe('settings:save-ssh-remotes', () => {
    it('saves remotes and syncs SSH config', async () => {
      const remotes = [{ name: 'server1', host: '192.168.1.1' }];

      const handler = getHandler('settings:save-ssh-remotes');
      await handler!({}, remotes);

      expect(mocks.mockSetSetting).toHaveBeenCalledWith('sshRemotes', JSON.stringify(remotes));
      expect(mocks.mockSyncSSHConfig).toHaveBeenCalled();
    });
  });
});
