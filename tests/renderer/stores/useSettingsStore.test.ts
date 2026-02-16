import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMockSettings, createMockCodeServerConfig } from '../../mocks/factories';

// Mock the IPC client module
const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Import after mocking
import { useSettingsStore } from '../../../src/renderer/stores/useSettingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset store to defaults
    useSettingsStore.setState({
      theme: 'system',
      defaultClonePath: '',
      defaultProjectsPath: '',
      defaultProfessionalProjectsPath: '',
      autoFetch: true,
      aliases: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
      expect(state.defaultClonePath).toBe('');
      expect(state.defaultProjectsPath).toBe('');
      expect(state.defaultProfessionalProjectsPath).toBe('');
      expect(state.autoFetch).toBe(true);
      expect(state.aliases).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchSettings', () => {
    it('loads settings from IPC and updates store', async () => {
      const mockSettings = createMockSettings({ theme: 'dark', defaultClonePath: '/test' });
      mockInvoke.mockResolvedValueOnce(mockSettings);

      await act(async () => {
        await useSettingsStore.getState().fetchSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.defaultClonePath).toBe('/test');
      expect(state.loading).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('settings:get');
    });

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      mockInvoke.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const fetchPromise = useSettingsStore.getState().fetchSettings();
      expect(useSettingsStore.getState().loading).toBe(true);

      resolvePromise!(createMockSettings());
      await fetchPromise;
      expect(useSettingsStore.getState().loading).toBe(false);
    });

    it('handles errors and sets error state', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('IPC failed'));

      await act(async () => {
        await useSettingsStore.getState().fetchSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.error).toContain('IPC failed');
      expect(state.loading).toBe(false);
    });
  });

  describe('updateSettings', () => {
    it('sends updates via IPC and applies returned settings', async () => {
      const updatedSettings = createMockSettings({ theme: 'light' });
      mockInvoke.mockResolvedValueOnce(updatedSettings);

      await act(async () => {
        await useSettingsStore.getState().updateSettings({ theme: 'light' });
      });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', { theme: 'light' });
      expect(useSettingsStore.getState().theme).toBe('light');
    });

    it('throws and sets error on failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Update failed'));

      await expect(useSettingsStore.getState().updateSettings({ theme: 'dark' })).rejects.toThrow(
        'Update failed'
      );

      expect(useSettingsStore.getState().error).toContain('Update failed');
    });
  });

  describe('setTheme', () => {
    it('delegates to updateSettings', async () => {
      const updatedSettings = createMockSettings({ theme: 'dark' });
      mockInvoke.mockResolvedValueOnce(updatedSettings);

      await act(async () => {
        await useSettingsStore.getState().setTheme('dark');
      });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', { theme: 'dark' });
    });
  });

  describe('setDefaultClonePath', () => {
    it('delegates to updateSettings', async () => {
      const updatedSettings = createMockSettings({ defaultClonePath: '/new/path' });
      mockInvoke.mockResolvedValueOnce(updatedSettings);

      await act(async () => {
        await useSettingsStore.getState().setDefaultClonePath('/new/path');
      });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', { defaultClonePath: '/new/path' });
    });
  });

  describe('setAutoFetch', () => {
    it('delegates to updateSettings', async () => {
      const updatedSettings = createMockSettings({ autoFetch: false });
      mockInvoke.mockResolvedValueOnce(updatedSettings);

      await act(async () => {
        await useSettingsStore.getState().setAutoFetch(false);
      });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', { autoFetch: false });
    });
  });

  describe('setDefaultProjectsPath', () => {
    it('delegates to updateSettings', async () => {
      const updatedSettings = createMockSettings({ defaultProjectsPath: '/projects' });
      mockInvoke.mockResolvedValueOnce(updatedSettings);

      await act(async () => {
        await useSettingsStore.getState().setDefaultProjectsPath('/projects');
      });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', {
        defaultProjectsPath: '/projects',
      });
      expect(useSettingsStore.getState().defaultProjectsPath).toBe('/projects');
    });
  });

  describe('setDefaultProfessionalProjectsPath', () => {
    it('delegates to updateSettings', async () => {
      const updatedSettings = createMockSettings({
        defaultProfessionalProjectsPath: '/professional',
      });
      mockInvoke.mockResolvedValueOnce(updatedSettings);

      await act(async () => {
        await useSettingsStore.getState().setDefaultProfessionalProjectsPath('/professional');
      });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', {
        defaultProfessionalProjectsPath: '/professional',
      });
      expect(useSettingsStore.getState().defaultProfessionalProjectsPath).toBe('/professional');
    });
  });

  // ── AT-25: codeServerConfig State Tests ─────────────────────────

  describe('codeServerConfig', () => {
    it('initial state has codeServerConfig as undefined', () => {
      const state = useSettingsStore.getState();
      expect(state.codeServerConfig).toBeUndefined();
    });

    it('fetchSettings populates codeServerConfig from IPC response', async () => {
      const config = createMockCodeServerConfig({ cpuLimit: 4, memoryLimit: '4g' });
      const mockSettings = createMockSettings({ codeServerConfig: config });
      mockInvoke.mockResolvedValueOnce(mockSettings);

      await act(async () => {
        await useSettingsStore.getState().fetchSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.codeServerConfig).toBeDefined();
      expect(state.codeServerConfig!.cpuLimit).toBe(4);
      expect(state.codeServerConfig!.memoryLimit).toBe('4g');
    });

    it('updateSettings sends codeServerConfig via IPC and updates store', async () => {
      const config = createMockCodeServerConfig({ shmSize: '512m' });
      const updatedSettings = createMockSettings({ codeServerConfig: config });
      mockInvoke.mockResolvedValueOnce(updatedSettings);

      await act(async () => {
        await useSettingsStore.getState().updateSettings({ codeServerConfig: config });
      });

      expect(mockInvoke).toHaveBeenCalledWith('settings:update', { codeServerConfig: config });
      expect(useSettingsStore.getState().codeServerConfig?.shmSize).toBe('512m');
    });

    it('error during update sets error state without corrupting existing config', async () => {
      // First, populate the store with a config
      const config = createMockCodeServerConfig({ cpuLimit: 2 });
      const existingSettings = createMockSettings({ codeServerConfig: config });
      mockInvoke.mockResolvedValueOnce(existingSettings);

      await act(async () => {
        await useSettingsStore.getState().fetchSettings();
      });

      // Now try an update that fails
      mockInvoke.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        useSettingsStore
          .getState()
          .updateSettings({ codeServerConfig: createMockCodeServerConfig({ cpuLimit: 8 }) })
      ).rejects.toThrow('Update failed');

      const state = useSettingsStore.getState();
      expect(state.error).toContain('Update failed');
      // The existing config should still be intact (cpuLimit: 2, not 8)
      expect(state.codeServerConfig?.cpuLimit).toBe(2);
    });
  });
});
