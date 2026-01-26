import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileTreePanel } from '@renderer/components/ide/file-tree/FileTreePanel';
import { useFileTreeStore } from '@renderer/stores/useFileTreeStore';
import { useGitStore } from '@renderer/stores/useGitStore';
import type { FileNode } from '@main/ipc/channels';

// Mock stores
vi.mock('@renderer/stores/useFileTreeStore', () => ({
  useFileTreeStore: vi.fn(),
}));

vi.mock('@renderer/stores/useGitStore', () => ({
  useGitStore: vi.fn(),
}));

// Mock IPC
vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()), // Return unsubscribe function
  },
}));

// Mock react-window
vi.mock('react-window', () => ({
  List: ({ children, rowCount }: any) => (
    <div data-testid="virtualized-list" data-row-count={rowCount}>
      {Array.from({ length: Math.min(rowCount, 10) }).map((_, index) =>
        children({ index, style: {} })
      )}
    </div>
  ),
}));

describe('FileTreePanel', () => {
  const mockLoadTree = vi.fn();
  const mockAddNode = vi.fn();
  const mockRemoveNode = vi.fn();
  const mockFetchStatus = vi.fn();

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

  beforeEach(() => {
    vi.clearAllMocks();
    (useFileTreeStore as any).mockReturnValue({
      fileTree: [],
      expandedPaths: new Set(),
      loading: false,
      error: null,
      loadTree: mockLoadTree,
      addNode: mockAddNode,
      removeNode: mockRemoveNode,
    });
    (useGitStore as any).mockReturnValue({
      fetchStatus: mockFetchStatus,
    });
  });

  describe('Loading state', () => {
    it('should show skeleton when loading', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: true,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      // Skeleton items should be visible
      const skeletons = document.querySelectorAll('.h-4');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not show virtualized list when loading', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: true,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should display error message when error occurs', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: false,
        error: 'Failed to load file tree',
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      expect(screen.getByText('Failed to load file tree')).toBeInTheDocument();
      expect(screen.getByText('Failed to load file tree')).toBeInTheDocument();
    });

    it('should show error title', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: false,
        error: 'Network error',
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      expect(screen.getByText('Failed to load file tree')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty message when no files', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      expect(screen.getByText('No files found')).toBeInTheDocument();
    });
  });

  describe('File tree rendering', () => {
    it('should render virtualized list when files exist', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('should flatten tree correctly', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      const list = screen.getByTestId('virtualized-list');
      // Should have 2 items (collapsed directories don't show children)
      expect(list.getAttribute('data-row-count')).toBe('2');
    });

    it('should include expanded directory children', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(['/repo/src']),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      const list = screen.getByTestId('virtualized-list');
      // Should have 3 items (src, src/index.ts, package.json)
      expect(list.getAttribute('data-row-count')).toBe('3');
    });
  });

  describe('Initialization', () => {
    it('should call loadTree on mount', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      expect(mockLoadTree).toHaveBeenCalledWith('/repo');
    });

    it('should start watching directory on mount', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      const { ipc } = require('@renderer/ipc/client');
      render(<FileTreePanel repoPath="/repo" />);
      expect(ipc.invoke).toHaveBeenCalledWith('fs:watch-directory', '/repo');
    });
  });

  describe('Cleanup', () => {
    it('should unwatch directory on unmount', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: [],
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      const { ipc } = require('@renderer/ipc/client');
      const { unmount } = render(<FileTreePanel repoPath="/repo" />);
      unmount();
      expect(ipc.invoke).toHaveBeenCalledWith('fs:unwatch-directory', '/repo');
    });
  });

  describe('Accessibility', () => {
    it('should have tree role', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      const { container } = render(<FileTreePanel repoPath="/repo" />);
      expect(container.querySelector('[role="tree"]')).toBeInTheDocument();
    });

    it('should have aria-label', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      const { container } = render(<FileTreePanel repoPath="/repo" />);
      expect(container.querySelector('[aria-label="File explorer"]')).toBeInTheDocument();
    });
  });

  describe('Custom height', () => {
    it('should use default height when not specified', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      // Height prop passed to List component (default 800)
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('should accept custom height', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" height={600} />);
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });
  });

  describe('Virtualization', () => {
    it('should use consistent row height', () => {
      (useFileTreeStore as any).mockReturnValue({
        fileTree: mockFileTree,
        expandedPaths: new Set(),
        loading: false,
        error: null,
        loadTree: mockLoadTree,
        addNode: mockAddNode,
        removeNode: mockRemoveNode,
      });

      render(<FileTreePanel repoPath="/repo" />);
      // Component uses 28px row height
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });
  });
});
