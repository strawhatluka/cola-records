import { create } from 'zustand';
import type { GitStatus, GitCommit } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

// Debounce helper
let refreshTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_DELAY = 500;

interface GitState {
  repoPath: string | null;
  status: GitStatus | null;
  commits: GitCommit[];
  branches: string[];
  currentBranch: string | null;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;

  // Actions
  setRepoPath: (path: string) => void;
  fetchStatus: (path: string) => Promise<void>;
  fetchLog: (path: string, limit?: number) => Promise<void>;
  fetchBranches: (path: string) => Promise<void>;
  stageFiles: (path: string, files: string[]) => Promise<void>;
  unstageFiles: (path: string, files: string[]) => Promise<void>;
  commit: (path: string, message: string, files: string[]) => Promise<void>;
  commitChanges: (path: string, message: string) => Promise<void>;
  push: (path: string, remote?: string, branch?: string) => Promise<void>;
  pull: (path: string, remote?: string, branch?: string) => Promise<void>;
  checkout: (path: string, branch: string) => Promise<void>;
  switchBranch: (path: string, branch: string) => Promise<void>;
  createBranch: (path: string, branchName: string) => Promise<void>;
  fetchDiff: (path: string, filePath?: string) => Promise<string>;
  refreshStatus: (path: string) => void; // Debounced
}

export const useGitStore = create<GitState>((set, get) => ({
  repoPath: null,
  status: null,
  commits: [],
  branches: [],
  currentBranch: null,
  loading: false,
  error: null,
  lastRefresh: null,

  setRepoPath: (repoPath) => {
    set({ repoPath });
  },

  fetchStatus: async (path) => {
    set({ loading: true, error: null });
    try {
      const status = await ipc.invoke('git:status', path);
      set({
        status,
        currentBranch: status.current,
        loading: false,
        repoPath: path,
        lastRefresh: new Date(),
      });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  fetchBranches: async (path) => {
    try {
      // Get current branch from status
      const status = await ipc.invoke('git:status', path);
      const currentBranch = status.current;

      // For now, use current branch - in production would need git:list-branches IPC handler
      const branches = [currentBranch || 'main'].filter(Boolean);

      set({
        branches,
        currentBranch,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchLog: async (path, limit = 50) => {
    set({ loading: true, error: null });
    try {
      const commits = await ipc.invoke('git:log', path, limit);
      set({ commits, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  stageFiles: async (path, files) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:add', path, files);
      await get().fetchStatus(path);
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  unstageFiles: async (_path, _files) => {
    set({ loading: true, error: null });
    try {
      // Git reset HEAD <files> to unstage
      // Requires git:unstage IPC handler - placeholder for now
      console.warn('Unstage files not implemented - requires git:unstage IPC handler');
      set({ loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  commit: async (path, message, files) => {
    set({ loading: true, error: null });
    try {
      // Stage files first
      await ipc.invoke('git:add', path, files);
      // Then commit
      await ipc.invoke('git:commit', path, message);
      // Refresh status
      await get().fetchStatus(path);
      set({ loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  commitChanges: async (path, message) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:commit', path, message);
      await get().fetchStatus(path);
      await get().fetchLog(path);
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  push: async (path, remote, branch) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:push', path, remote, branch);
      await get().fetchStatus(path);
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  pull: async (path, remote, branch) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:pull', path, remote, branch);
      await get().fetchStatus(path);
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  checkout: async (path, branch) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:checkout', path, branch);
      await get().fetchStatus(path);
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  switchBranch: async (path, branch) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:checkout', path, branch);
      await get().fetchStatus(path);
      await get().fetchBranches(path);
      set({ loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  createBranch: async (path, branchName) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:create-branch', path, branchName);
      await get().fetchBranches(path);
      set({ loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  fetchDiff: async (_path, filePath?) => {
    try {
      // Requires git:diff IPC handler - placeholder for now
      console.warn('Fetch diff not implemented - requires git:diff IPC handler');
      return `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}\n@@ -1,1 +1,1 @@\n-Old content\n+New content`;
    } catch (error) {
      throw error;
    }
  },

  refreshStatus: (path) => {
    // Debounced refresh
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }

    refreshTimeout = setTimeout(() => {
      get().fetchStatus(path);
      refreshTimeout = null;
    }, DEBOUNCE_DELAY);
  },
}));
