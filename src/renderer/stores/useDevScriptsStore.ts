import { create } from 'zustand';
import type { DevScript } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface DevScriptsState {
  scripts: DevScript[];
  loading: boolean;
  error: string | null;
  executingScriptId: string | null;
  activeTerminalSession: string | null;

  // Actions
  loadScripts: (projectPath: string) => Promise<void>;
  saveScript: (script: DevScript) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  setExecutingScript: (id: string | null) => void;
  setActiveTerminalSession: (sessionId: string | null) => void;
}

export const useDevScriptsStore = create<DevScriptsState>((set, get) => ({
  scripts: [],
  loading: false,
  error: null,
  executingScriptId: null,
  activeTerminalSession: null,

  loadScripts: async (projectPath: string) => {
    set({ loading: true, error: null });
    try {
      const scripts = await ipc.invoke('dev-scripts:get-all', projectPath);
      set({ scripts, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  saveScript: async (script: DevScript) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('dev-scripts:save', script);
      // Reload scripts to get updated list
      const scripts = await ipc.invoke('dev-scripts:get-all', script.projectPath);
      set({ scripts, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  deleteScript: async (id: string) => {
    const { scripts } = get();
    const script = scripts.find((s) => s.id === id);
    if (!script) return;

    set({ loading: true, error: null });
    try {
      await ipc.invoke('dev-scripts:delete', id);
      // Reload scripts to get updated list
      const updatedScripts = await ipc.invoke('dev-scripts:get-all', script.projectPath);
      set({ scripts: updatedScripts, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  setExecutingScript: (id: string | null) => {
    set({ executingScriptId: id });
  },

  setActiveTerminalSession: (sessionId: string | null) => {
    set({ activeTerminalSession: sessionId });
  },
}));
