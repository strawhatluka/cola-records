import { create } from 'zustand';
import type { GitHubIssue } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface IssuesState {
  issues: GitHubIssue[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedLabels: string[];

  // Actions
  searchIssues: (query: string, labels: string[]) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedLabels: (labels: string[]) => void;
  clearIssues: () => void;
}

export const useIssuesStore = create<IssuesState>((set) => ({
  issues: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedLabels: ['good first issue'],

  searchIssues: async (query, labels) => {
    console.log('searchIssues called with:', query, labels);
    set({ loading: true, error: null });
    try {
      console.log('Invoking IPC: github:search-issues');
      const issues = await ipc.invoke('github:search-issues', query, labels);
      console.log('Received issues:', issues.length);
      set({ issues, loading: false, searchQuery: query, selectedLabels: labels });
    } catch (error) {
      console.error('Search error:', error);
      set({ error: String(error), loading: false });
    }
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
  },

  setSelectedLabels: (selectedLabels) => {
    set({ selectedLabels });
  },

  clearIssues: () => {
    set({ issues: [], searchQuery: '', selectedLabels: ['good first issue'] });
  },
}));
