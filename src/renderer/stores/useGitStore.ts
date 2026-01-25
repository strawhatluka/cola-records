import { create } from 'zustand';
import type { GitStatus, GitCommit } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface GitState {
  repoPath: string | null;
  status: GitStatus | null;
  commits: GitCommit[];
  loading: boolean;
  error: string | null;

  // Actions
  setRepoPath: (path: string) => void;
  fetchStatus: (path: string) => Promise<void>;
  fetchLog: (path: string, limit?: number) => Promise<void>;
  stageFiles: (path: string, files: string[]) => Promise<void>;
  commitChanges: (path: string, message: string) => Promise<void>;
  push: (path: string, remote?: string, branch?: string) => Promise<void>;
  pull: (path: string, remote?: string, branch?: string) => Promise<void>;
  checkout: (path: string, branch: string) => Promise<void>;
  createBranch: (path: string, branchName: string) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  repoPath: null,
  status: null,
  commits: [],
  loading: false,
  error: null,

  setRepoPath: (repoPath) => {
    set({ repoPath });
  },

  fetchStatus: async (path) => {
    set({ loading: true, error: null });
    try {
      const status = await ipc.invoke('git:status', path);
      set({ status, loading: false, repoPath: path });
    } catch (error) {
      set({ error: String(error), loading: false });
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

  createBranch: async (path, branchName) => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('git:create-branch', path, branchName);
      await get().fetchStatus(path);
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },
}));
