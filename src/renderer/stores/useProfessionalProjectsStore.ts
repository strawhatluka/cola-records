import { create } from 'zustand';
import type { Contribution } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface ProfessionalProjectsState {
  projects: Contribution[];
  loading: boolean;
  error: string | null;

  // Actions
  setProjects: (projects: Contribution[]) => void;
  deleteProject: (id: string) => Promise<void>;
}

export const useProfessionalProjectsStore = create<ProfessionalProjectsState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  setProjects: (projects) => {
    set({ projects });
  },

  deleteProject: async (id) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('contribution:delete', id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },
}));
