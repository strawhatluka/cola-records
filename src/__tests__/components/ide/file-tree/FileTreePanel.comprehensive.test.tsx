import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FileTreePanel } from '../../../../renderer/components/ide/file-tree/FileTreePanel';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => () => {});

beforeEach(() => {
  vi.clearAllMocks();
  global.window = global.window || ({} as any);
  (global.window as any).electronAPI = {
    invoke: mockInvoke,
    on: mockOn,
  };
});

describe('FileTreePanel - Comprehensive Tests', () => {
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

  it('should expand and collapse directories', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory',
        children: [
          {
            name: 'index.ts',
            path: '/test/repo/src/index.ts',
            type: 'file',
          },
        ],
      },
    ]);

    // const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Find the directory node
    const srcNode = screen.getByText('src').closest('[role="treeitem"]');
    expect(srcNode).toBeInTheDocument();

    // Initially collapsed - children not visible
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText('src'));

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    // Click to collapse
    await user.click(screen.getByText('src'));

    await waitFor(() => {
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    });
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

    // const { container } = render(<FileTreePanel repoPath="/test/repo" />);

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
    expect(screen.queryByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Failed to load tree'));

    render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
  });

  it('should handle empty repository', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/empty/i)).toBeInTheDocument();
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

    // const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      const ignoredNode = screen.getByText('node_modules').closest('[role="treeitem"]');
      const normalNode = screen.getByText('src').closest('[role="treeitem"]');

      expect(ignoredNode).toHaveClass('opacity-50'); // Dimmed
      expect(normalNode).not.toHaveClass('opacity-50');
    });
  });
});
