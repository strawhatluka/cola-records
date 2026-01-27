import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FileTreePanel } from '@renderer/components/ide/file-tree/FileTreePanel';
import { useFileTreeStore } from '@renderer/stores/useFileTreeStore';
import { useGitStore } from '@renderer/stores/useGitStore';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';

// Mock IPC with hoisting
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockOn: vi.fn(() => () => {}),
}));

vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    on: mockOn,
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock ContextMenu components to passthrough children
vi.mock('@renderer/components/ui/ContextMenu', () => ({
  ContextMenu: ({ children }: any) => <>{children}</>,
  ContextMenuTrigger: ({ children }: any) => <>{children}</>,
  ContextMenuContent: () => null,
  ContextMenuItem: () => null,
  ContextMenuSeparator: () => null,
}));

// Mock react-window for virtualization
vi.mock('react-window', () => {
  const React = require('react');

  // Create a proper React component that re-renders when props change
  const MockList = ({ children, itemCount, innerElementType: InnerElement }: any) => {
    const Inner = InnerElement || 'div';

    // Generate items array - will re-render when itemCount changes
    const items = Array.from({ length: Math.min(itemCount, 10) }).map((_, index) =>
      children({ index, style: {} })
    );

    return (
      <Inner data-testid="virtualized-list" data-row-count={itemCount}>
        {items}
      </Inner>
    );
  };

  // Mark component name for React DevTools
  MockList.displayName = 'MockList';

  return {
    List: MockList,
  };
});

// Note: react-window is mocked above to render all items in tests
// This ensures all file tree nodes are accessible for testing

describe('FileTreePanel - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default IPC mocks
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:status') {
        return Promise.resolve({ files: [] });
      }
      if (channel === 'fs:watch-directory' || channel === 'fs:unwatch-directory') {
        return Promise.resolve();
      }
      if (channel === 'gitignore:is-ignored') {
        return Promise.resolve(false);
      }
      if (channel === 'fs:read-file') {
        return Promise.resolve({ content: '' });
      }
      return Promise.reject(new Error(`Unexpected IPC channel: ${channel}`));
    });

    // Reset FileTreeStore to initial state
    useFileTreeStore.setState({
      rootPath: null,
      root: null,
      fileTree: [],
      expandedPaths: new Set(),
      selectedPath: null,
      gitStatus: null,
      gitIgnoreCache: new Map(),
      loading: false,
      error: null,
      expandedDirs: new Set(),
      selectedFile: null,
    });

    // Reset GitStore to initial state
    useGitStore.setState({
      repoPath: null,
      status: null,
      commits: [],
      branches: [],
      currentBranch: null,
      loading: false,
      error: null,
      lastRefresh: null,
    });

    // Reset CodeEditorStore to initial state
    useCodeEditorStore.setState({
      openFiles: new Map(),
      activeFilePath: null,
      modifiedFiles: new Set(),
      loading: false,
    });

    global.window = global.window || ({} as any);
    (global.window as any).electronAPI = {
      invoke: mockInvoke,
      on: mockOn,
    };
  });

  it('should load and display file tree', async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory',
        children: [],
      },
      {
        name: 'README.md',
        path: '/test/repo/README.md',
        type: 'file',
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });
  });

  it('should expand and collapse directories', () => {
    const mockFileTree = [
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory' as const,
        children: [
          {
            name: 'index.ts',
            path: '/test/repo/src/index.ts',
            type: 'file' as const,
          },
        ],
      },
    ];

    // Test collapsed state
    useFileTreeStore.setState({
      rootPath: '/test/repo',
      root: null,
      fileTree: mockFileTree,
      expandedPaths: new Set(), // Empty = collapsed
      selectedPath: null,
      gitStatus: null,
      gitIgnoreCache: new Map(),
      loading: false,
      error: null,
      expandedDirs: new Set(),
      selectedFile: null,
    });

    const { rerender } = render(<FileTreePanel repoPath="/test/repo" />);

    // Children not visible when collapsed
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    expect(screen.getByTestId('virtualized-list').getAttribute('data-row-count')).toBe('1');

    // Test expanded state
    useFileTreeStore.setState({
      rootPath: '/test/repo',
      root: null,
      fileTree: mockFileTree,
      expandedPaths: new Set(['/test/repo/src']), // Contains path = expanded
      selectedPath: null,
      gitStatus: null,
      gitIgnoreCache: new Map(),
      loading: false,
      error: null,
      expandedDirs: new Set(['/test/repo/src']),
      selectedFile: null,
    });

    rerender(<FileTreePanel repoPath="/test/repo" />);

    // Children visible when expanded
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByTestId('virtualized-list').getAttribute('data-row-count')).toBe('2');

    // Test re-collapsed state
    useFileTreeStore.setState({
      rootPath: '/test/repo',
      root: null,
      fileTree: mockFileTree,
      expandedPaths: new Set(), // Empty again = collapsed
      selectedPath: null,
      gitStatus: null,
      gitIgnoreCache: new Map(),
      loading: false,
      error: null,
      expandedDirs: new Set(),
      selectedFile: null,
    });

    rerender(<FileTreePanel repoPath="/test/repo" />);

    // Children not visible when collapsed again
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    expect(screen.getByTestId('virtualized-list').getAttribute('data-row-count')).toBe('1');
  });

  it('should show git status badges', async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'modified.ts',
        path: '/test/repo/modified.ts',
        type: 'file',
        gitStatus: 'M',
      },
      {
        name: 'added.ts',
        path: '/test/repo/added.ts',
        type: 'file',
        gitStatus: 'A',
      },
    ]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      const badges = container.querySelectorAll('[data-git-status]');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('should handle loading state', async () => {
    mockInvoke.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    );

    render(<FileTreePanel repoPath="/test/repo" />);

    // Should show loading state
    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Failed to load tree'));

    render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load file tree')).toBeInTheDocument();
    });
  });

  it('should handle empty repository', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('No files found')).toBeInTheDocument();
    });
  });

  it('should show gitignore dimming for ignored files', async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'node_modules',
        path: '/test/repo/node_modules',
        type: 'directory',
        isGitIgnored: true,
      },
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory',
        isGitIgnored: false,
      },
    ]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      const ignoredNode = screen.getByText('node_modules').closest('[role="treeitem"]');
      const normalNode = screen.getByText('src').closest('[role="treeitem"]');

      expect(ignoredNode).toHaveStyle({ opacity: '0.4' }); // Inline style from component
      expect(normalNode).toHaveStyle({ opacity: '1' });
    });
  });
});
