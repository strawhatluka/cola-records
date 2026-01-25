import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileTreeStore } from '../../renderer/stores/useFileTreeStore';
import type { FileNode, GitStatus } from '../../main/ipc/channels';

// Mock IPC
vi.mock('../../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()),
  },
}));

describe('useFileTreeStore', () => {
  const mockFileTree: FileNode[] = [
    {
      name: 'src',
      path: '/repo/src',
      type: 'directory',
      children: [
        { name: 'index.ts', path: '/repo/src/index.ts', type: 'file' },
      ],
    },
    { name: 'package.json', path: '/repo/package.json', type: 'file' },
  ];

  const mockGitStatus: GitStatus = {
    current: 'main',
    tracking: 'origin/main',
    ahead: 0,
    behind: 0,
    files: [
      { path: 'src/index.ts', index: ' ', working_dir: 'M' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    const { result } = renderHook(() => useFileTreeStore());
    act(() => {
      result.current.fileTree = [];
      result.current.expandedPaths = new Set();
      result.current.selectedPath = null;
      result.current.loading = false;
      result.current.error = null;
    });
  });

  describe('Initial state', () => {
    it('should have correct initial values', () => {
      const { result } = renderHook(() => useFileTreeStore());

      expect(result.current.rootPath).toBeNull();
      expect(result.current.root).toBeNull();
      expect(result.current.fileTree).toEqual([]);
      expect(result.current.expandedPaths).toEqual(new Set());
      expect(result.current.selectedPath).toBeNull();
      expect(result.current.gitStatus).toBeNull();
      expect(result.current.gitIgnoreCache).toEqual(new Map());
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('toggleNode', () => {
    it('should add path to expanded paths when collapsed', () => {
      const { result } = renderHook(() => useFileTreeStore());
      const path = '/repo/src';

      act(() => {
        result.current.toggleNode(path);
      });

      expect(result.current.expandedPaths.has(path)).toBe(true);
    });

    it('should remove path from expanded paths when expanded', () => {
      const { result } = renderHook(() => useFileTreeStore());
      const path = '/repo/src';

      act(() => {
        result.current.expandedPaths.add(path);
        result.current.toggleNode(path);
      });

      expect(result.current.expandedPaths.has(path)).toBe(false);
    });

    it('should handle multiple paths independently', () => {
      const { result } = renderHook(() => useFileTreeStore());
      const path1 = '/repo/src';
      const path2 = '/repo/dist';

      act(() => {
        result.current.toggleNode(path1);
        result.current.toggleNode(path2);
      });

      expect(result.current.expandedPaths.has(path1)).toBe(true);
      expect(result.current.expandedPaths.has(path2)).toBe(true);
    });
  });

  describe('selectNode', () => {
    it('should set selected path', () => {
      const { result } = renderHook(() => useFileTreeStore());
      const path = '/repo/src/index.ts';

      act(() => {
        result.current.selectNode(path);
      });

      expect(result.current.selectedPath).toBe(path);
    });

    it('should override previous selection', () => {
      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.selectNode('/repo/file1.ts');
        result.current.selectNode('/repo/file2.ts');
      });

      expect(result.current.selectedPath).toBe('/repo/file2.ts');
    });
  });

  describe('loadTree', () => {
    it('should set loading to true while loading', async () => {
      const { ipc } = require('../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(mockFileTree);

      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.loadTree('/repo');
      });

      expect(result.current.loading).toBe(true);
    });

    it('should set file tree after loading', async () => {
      const { ipc } = require('../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(mockFileTree);

      const { result } = renderHook(() => useFileTreeStore());

      await act(async () => {
        await result.current.loadTree('/repo');
      });

      await waitFor(() => {
        expect(result.current.fileTree).toEqual(mockFileTree);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set root path', async () => {
      const { ipc } = require('../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(mockFileTree);

      const { result } = renderHook(() => useFileTreeStore());

      await act(async () => {
        await result.current.loadTree('/repo');
      });

      await waitFor(() => {
        expect(result.current.rootPath).toBe('/repo');
      });
    });

    it('should handle errors gracefully', async () => {
      const { ipc } = require('../../renderer/ipc/client');
      ipc.invoke.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFileTreeStore());

      await act(async () => {
        await result.current.loadTree('/repo');
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('addNode', () => {
    it('should add simple file to root', () => {
      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.fileTree = mockFileTree;
        result.current.addNode('/repo/newfile.ts');
      });

      expect(result.current.fileTree.some(node => node.path === '/repo/newfile.ts')).toBe(true);
    });

    it('should expand parent directories automatically', () => {
      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.fileTree = mockFileTree;
        result.current.addNode('/repo/src/newfile.ts');
      });

      expect(result.current.expandedPaths.has('/repo/src')).toBe(true);
    });
  });

  describe('removeNode', () => {
    it('should remove node from tree', () => {
      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.fileTree = mockFileTree;
        result.current.removeNode('/repo/package.json');
      });

      expect(result.current.fileTree.some(node => node.path === '/repo/package.json')).toBe(false);
    });

    it('should deselect node if it was selected', () => {
      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.fileTree = mockFileTree;
        result.current.selectedPath = '/repo/package.json';
        result.current.removeNode('/repo/package.json');
      });

      expect(result.current.selectedPath).toBeNull();
    });
  });

  describe('updateGitStatus', () => {
    it('should merge git status into tree nodes', () => {
      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.fileTree = mockFileTree;
        result.current.updateGitStatus(mockGitStatus);
      });

      const srcDir = result.current.fileTree.find(n => n.name === 'src');
      const indexFile = srcDir?.children?.find(n => n.name === 'index.ts');
      expect(indexFile?.gitStatus).toBe('M');
    });

    it('should store git status', () => {
      const { result } = renderHook(() => useFileTreeStore());

      act(() => {
        result.current.fileTree = mockFileTree;
        result.current.updateGitStatus(mockGitStatus);
      });

      expect(result.current.gitStatus).toEqual(mockGitStatus);
    });
  });

  describe('warmGitIgnoreCache', () => {
    it('should populate gitignore cache', async () => {
      const { ipc } = require('../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(true); // File is ignored

      const { result } = renderHook(() => useFileTreeStore());
      const testNode: FileNode = { name: 'test.ts', path: '/repo/test.ts', type: 'file' };

      await act(async () => {
        await result.current.warmGitIgnoreCache(testNode, '/repo');
      });

      await waitFor(() => {
        expect(result.current.gitIgnoreCache.has('/repo/test.ts')).toBe(true);
      });
    });

    it('should handle directories recursively', async () => {
      const { ipc } = require('../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(false);

      const { result } = renderHook(() => useFileTreeStore());

      await act(async () => {
        await result.current.warmGitIgnoreCache(mockFileTree[0], '/repo');
      });

      await waitFor(() => {
        expect(result.current.gitIgnoreCache.size).toBeGreaterThan(0);
      });
    });
  });

  describe('State persistence', () => {
    it('should maintain expanded paths across re-renders', () => {
      const { result, rerender } = renderHook(() => useFileTreeStore());
      const path = '/repo/src';

      act(() => {
        result.current.toggleNode(path);
      });

      rerender();

      expect(result.current.expandedPaths.has(path)).toBe(true);
    });

    it('should maintain selection across re-renders', () => {
      const { result, rerender } = renderHook(() => useFileTreeStore());
      const path = '/repo/src/index.ts';

      act(() => {
        result.current.selectNode(path);
      });

      rerender();

      expect(result.current.selectedPath).toBe(path);
    });
  });

  describe('Error handling', () => {
    it('should clear error on successful load', async () => {
      const { ipc } = require('../../renderer/ipc/client');
      const { result } = renderHook(() => useFileTreeStore());

      // First load fails
      ipc.invoke.mockRejectedValueOnce(new Error('Failed'));
      await act(async () => {
        await result.current.loadTree('/repo');
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Second load succeeds
      ipc.invoke.mockResolvedValueOnce(mockFileTree);
      await act(async () => {
        await result.current.loadTree('/repo');
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });
});
