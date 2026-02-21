import { create } from 'zustand';
import type { DevScript } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface DevScriptsState {
  scripts: DevScript[];
  loading: boolean;
  error: string | null;
  executingScriptId: string | null;
  activeTerminalSession: string | null;
  /** Ephemeral toggle state: false = first press next, true = second press next */
  toggleStates: Record<string, boolean>;

  // Actions
  loadScripts: (projectPath: string) => Promise<void>;
  saveScript: (script: DevScript) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  setExecutingScript: (id: string | null) => void;
  setActiveTerminalSession: (sessionId: string | null) => void;
  flipToggleState: (scriptId: string) => void;
  resetToggleStates: () => void;
}

export const useDevScriptsStore = create<DevScriptsState>((set, get) => ({
  scripts: [],
  loading: false,
  error: null,
  executingScriptId: null,
  activeTerminalSession: null,
  toggleStates: {},

  loadScripts: async (projectPath: string) => {
    set({ loading: true, error: null, toggleStates: {} });
    try {
      const loaded = await ipc.invoke('dev-scripts:get-all', projectPath);
      set((state) => ({
        scripts: [...state.scripts.filter((s) => s.projectPath !== projectPath), ...loaded],
        loading: false,
      }));
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  saveScript: async (script: DevScript) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('dev-scripts:save', script);
      // Reload scripts to get updated list
      const loaded = await ipc.invoke('dev-scripts:get-all', script.projectPath);
      set((state) => ({
        scripts: [...state.scripts.filter((s) => s.projectPath !== script.projectPath), ...loaded],
        loading: false,
      }));
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
      const loaded = await ipc.invoke('dev-scripts:get-all', script.projectPath);
      set((state) => ({
        scripts: [...state.scripts.filter((s) => s.projectPath !== script.projectPath), ...loaded],
        loading: false,
      }));
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

  flipToggleState: (scriptId: string) => {
    set((state) => ({
      toggleStates: {
        ...state.toggleStates,
        [scriptId]: !state.toggleStates[scriptId],
      },
    }));
  },

  resetToggleStates: () => {
    set({ toggleStates: {} });
  },
}));

/** Select only scripts belonging to a specific project path */
export function selectScriptsForProject(scripts: DevScript[], projectPath: string): DevScript[] {
  return scripts.filter((s) => s.projectPath === projectPath);
}
