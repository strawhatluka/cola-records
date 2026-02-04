import { create } from 'zustand';
import type { AppSettings } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface SettingsState extends AppSettings {
  loading: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setDefaultClonePath: (path: string) => Promise<void>;
  setAutoFetch: (enabled: boolean) => Promise<void>;
  setDefaultProjectsPath: (path: string) => Promise<void>;
  setDefaultProfessionalProjectsPath: (path: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Default values
  theme: 'system',
  defaultClonePath: '',
  defaultProjectsPath: '',
  defaultProfessionalProjectsPath: '',
  autoFetch: true,
  aliases: [],
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await ipc.invoke('settings:get');
      set({ ...settings, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  updateSettings: async (updates) => {
    set({ loading: true, error: null });
    try {
      const updated = await ipc.invoke('settings:update', updates);
      set({ ...updated, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  setTheme: async (theme) => {
    await get().updateSettings({ theme });
  },

  setDefaultClonePath: async (defaultClonePath) => {
    await get().updateSettings({ defaultClonePath });
  },

  setAutoFetch: async (autoFetch) => {
    await get().updateSettings({ autoFetch });
  },

  setDefaultProjectsPath: async (defaultProjectsPath) => {
    await get().updateSettings({ defaultProjectsPath });
  },

  setDefaultProfessionalProjectsPath: async (defaultProfessionalProjectsPath) => {
    await get().updateSettings({ defaultProfessionalProjectsPath });
  },
}));
