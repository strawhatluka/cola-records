import { create } from 'zustand';
import type { FileNode } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface FileTreeState {
  rootPath: string | null;
  fileTree: FileNode[];
  expandedDirs: Set<string>;
  selectedFile: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadDirectory: (path: string) => Promise<void>;
  toggleDirectory: (path: string) => void;
  selectFile: (path: string) => void;
  refreshTree: () => Promise<void>;
  setRootPath: (path: string) => void;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  rootPath: null,
  fileTree: [],
  expandedDirs: new Set(),
  selectedFile: null,
  loading: false,
  error: null,

  loadDirectory: async (path) => {
    set({ loading: true, error: null });
    try {
      const nodes = await ipc.invoke('fs:read-directory', path);
      set({ fileTree: nodes, loading: false, rootPath: path });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  toggleDirectory: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedDirs);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedDirs: newExpanded };
    });
  },

  selectFile: (path) => {
    set({ selectedFile: path });
  },

  refreshTree: async () => {
    const { rootPath } = get();
    if (rootPath) {
      await get().loadDirectory(rootPath);
    }
  },

  setRootPath: (rootPath) => {
    set({ rootPath });
  },
}));
