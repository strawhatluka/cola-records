import { create } from 'zustand';
import type { FileNode, GitStatus } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

interface FileTreeState {
  rootPath: string | null;
  root: FileNode | null;
  fileTree: FileNode[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  gitStatus: GitStatus | null;
  gitIgnoreCache: Map<string, boolean>;
  loading: boolean;
  error: string | null;

  // Actions
  loadTree: (repoPath: string) => Promise<void>;
  toggleNode: (path: string) => void;
  selectNode: (path: string) => void;
  updateGitStatus: (status: GitStatus) => void;
  warmGitIgnoreCache: (root: FileNode, repoPath: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  setRootPath: (path: string) => void;
  addNode: (path: string) => Promise<void>;
  removeNode: (path: string) => void;

  // Legacy compatibility
  loadDirectory: (path: string) => Promise<void>;
  toggleDirectory: (path: string) => void;
  selectFile: (path: string) => void;
  expandedDirs: Set<string>;
  selectedFile: string | null;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  rootPath: null,
  root: null,
  fileTree: [],
  expandedPaths: new Set(),
  selectedPath: null,
  gitStatus: null,
  gitIgnoreCache: new Map(),
  loading: false,
  error: null,

  // Legacy compatibility
  expandedDirs: new Set(),
  selectedFile: null,

  loadTree: async (repoPath) => {
    set({ loading: true, error: null, rootPath: repoPath });
    try {
      // Phase 1: Load bare file tree (fast)
      const nodes = await ipc.invoke('fs:read-directory', repoPath);

      // Create root node
      const root: FileNode = {
        name: repoPath.split(/[\\/]/).pop() || repoPath,
        path: repoPath,
        type: 'directory',
        children: nodes,
      };

      set({ fileTree: nodes, root, loading: false });

      // Phase 2: Apply git status (async)
      try {
        const gitStatus = await ipc.invoke('git:status', repoPath);
        get().updateGitStatus(gitStatus);
      } catch (gitError) {
        console.warn('Failed to load git status:', gitError);
      }

      // Phase 3: Warm gitignore cache (async, low priority)
      setTimeout(() => {
        get().warmGitIgnoreCache(root, repoPath).catch((err) => {
          console.warn('Failed to warm gitignore cache:', err);
        });
      }, 100);
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  toggleNode: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return {
        expandedPaths: newExpanded,
        expandedDirs: newExpanded, // Legacy compatibility
      };
    });
  },

  selectNode: (path) => {
    set({
      selectedPath: path,
      selectedFile: path, // Legacy compatibility
    });
  },

  updateGitStatus: (status) => {
    set({ gitStatus: status });

    const { fileTree, root, rootPath } = get();
    if (!root || !rootPath) return;

    // Create a map of file paths to git status
    const statusMap = new Map<string, 'M' | 'A' | 'D' | 'C'>();

    if (status?.files) {
      for (const file of status.files) {
        // Determine status: M (modified), A (added), D (deleted), C (conflicted)
        let fileStatus: 'M' | 'A' | 'D' | 'C' | null = null;

        if (file.working_dir === 'D' || file.index === 'D') {
          fileStatus = 'D';
        } else if (file.working_dir === 'M' || file.index === 'M') {
          fileStatus = 'M';
        } else if (file.working_dir === 'A' || file.index === 'A') {
          fileStatus = 'A';
        } else if (file.working_dir === 'U' || file.index === 'U') {
          fileStatus = 'C'; // Unmerged = Conflicted
        }

        if (fileStatus) {
          statusMap.set(file.path, fileStatus);
        }
      }
    }

    // Apply git status to tree nodes
    const applyStatus = (node: FileNode) => {
      const relativePath = node.path
        .replace(rootPath + '/', '')
        .replace(rootPath + '\\', '')
        .replace(/\\/g, '/');
      if (statusMap.has(relativePath)) {
        node.gitStatus = statusMap.get(relativePath) || null;
      }
      if (node.children) {
        node.children.forEach(applyStatus);
      }
    };

    applyStatus(root);
    fileTree.forEach(applyStatus);
    set({ root: { ...root }, fileTree: [...fileTree] }); // Trigger re-render
  },

  warmGitIgnoreCache: async (root, repoPath) => {
    const cache = new Map<string, boolean>();

    const checkNode = async (node: FileNode) => {
      try {
        const isIgnored = await ipc.invoke('gitignore:is-ignored', repoPath, node.path);
        cache.set(node.path, isIgnored);
        node.isGitIgnored = isIgnored;

        if (node.children) {
          await Promise.all(node.children.map(checkNode));
        }
      } catch (error) {
        console.warn(`Failed to check gitignore for ${node.path}:`, error);
      }
    };

    await checkNode(root);
    set({ gitIgnoreCache: cache, root: { ...root } });
  },

  refreshTree: async () => {
    const { rootPath } = get();
    if (rootPath) {
      await get().loadTree(rootPath);
    }
  },

  setRootPath: (rootPath) => {
    set({ rootPath });
  },

  addNode: async (_path) => {
    const { root, rootPath } = get();
    if (!root || !rootPath) return;

    // Refresh the entire tree (simplified)
    await get().refreshTree();
  },

  removeNode: (path) => {
    const { root } = get();
    if (!root) return;

    const removeFromTree = (node: FileNode): boolean => {
      if (!node.children) return false;

      const index = node.children.findIndex((child) => child.path === path);
      if (index !== -1) {
        node.children.splice(index, 1);
        return true;
      }

      for (const child of node.children) {
        if (removeFromTree(child)) return true;
      }

      return false;
    };

    removeFromTree(root);
    set({ root: { ...root } });
  },

  // Legacy compatibility methods
  loadDirectory: async (path) => {
    await get().loadTree(path);
  },

  toggleDirectory: (path) => {
    get().toggleNode(path);
  },

  selectFile: (path) => {
    get().selectNode(path);
  },
}));
