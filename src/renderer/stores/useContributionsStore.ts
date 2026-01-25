import { create } from 'zustand';
import type { Contribution } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface ContributionsState {
  contributions: Contribution[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchContributions: () => Promise<void>;
  createContribution: (data: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Contribution>;
  updateContribution: (id: string, data: Partial<Contribution>) => Promise<Contribution>;
  deleteContribution: (id: string) => Promise<void>;
  getContributionById: (id: string) => Contribution | undefined;
}

export const useContributionsStore = create<ContributionsState>((set, get) => ({
  contributions: [],
  loading: false,
  error: null,

  fetchContributions: async () => {
    set({ loading: true, error: null });
    try {
      const contributions = await ipc.invoke('contribution:get-all');
      set({ contributions, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  createContribution: async (data) => {
    set({ loading: true, error: null });
    try {
      const contribution = await ipc.invoke('contribution:create', data);
      set((state) => ({
        contributions: [contribution, ...state.contributions],
        loading: false,
      }));
      return contribution;
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  updateContribution: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const updated = await ipc.invoke('contribution:update', id, data);
      set((state) => ({
        contributions: state.contributions.map((c) =>
          c.id === id ? updated : c
        ),
        loading: false,
      }));
      return updated;
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  deleteContribution: async (id) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('contribution:delete', id);
      set((state) => ({
        contributions: state.contributions.filter((c) => c.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  getContributionById: (id) => {
    return get().contributions.find((c) => c.id === id);
  },
}));
