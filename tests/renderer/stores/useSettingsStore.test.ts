import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMockSettings } from '../../mocks/factories';

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
        new Promise((resolve) => { resolvePromise = resolve; })
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

      await expect(
        useSettingsStore.getState().updateSettings({ theme: 'dark' })
      ).rejects.toThrow('Update failed');

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
});
