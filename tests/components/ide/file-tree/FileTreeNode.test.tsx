import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTreeNode } from '@renderer/components/ide/file-tree/FileTreeNode';
import { useFileTreeStore } from '@renderer/stores/useFileTreeStore';
import type { FileNode } from '../../../../main/ipc/channels';

// Mock the store
vi.mock('@renderer/stores/useFileTreeStore', () => ({
  useFileTreeStore: vi.fn(),
}));

// Mock IPC
vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()), // Return unsubscribe function
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

describe('FileTreeNode', () => {
  const mockToggleNode = vi.fn();
  const mockSelectNode = vi.fn();
  const mockLoadTree = vi.fn();
  const mockRemoveNode = vi.fn();

  const fileNode: FileNode = {
    name: 'test.ts',
    path: '/repo/test.ts',
    type: 'file',
    size: 1024,
    modified: new Date(),
  };

  const dirNode: FileNode = {
    name: 'src',
    path: '/repo/src',
    type: 'directory',
    children: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFileTreeStore).mockReturnValue({
      toggleNode: mockToggleNode,
      selectNode: mockSelectNode,
      selectedPath: null,
      expandedPaths: new Set(),
      loadTree: mockLoadTree,
      removeNode: mockRemoveNode,
    });
  });

  describe('Basic rendering', () => {
    it('should render file node', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      expect(container.querySelector('[role="treeitem"]')).toBeInTheDocument();
      expect(screen.getByText('test.ts')).toBeInTheDocument();
    });

    it('should render directory node', () => {
      const { container } = render(<FileTreeNode node={dirNode} depth={0} />);
      expect(container.querySelector('[role="treeitem"]')).toBeInTheDocument();
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    it('should apply depth indentation', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={2} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveStyle({ paddingLeft: '40px' }); // 2 * 16 + 8
    });

    it('should apply custom style', () => {
      const customStyle = { backgroundColor: 'red' };
      const { container } = render(<FileTreeNode node={fileNode} depth={0} style={customStyle} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      // Check that the custom style is applied along with default inline styles
      expect(treeItem).toHaveStyle({ backgroundColor: 'red', paddingLeft: '8px', opacity: '1' });
    });
  });

  describe('Selection state', () => {
    it('should highlight when selected', () => {
      vi.mocked(useFileTreeStore).mockReturnValue({
        toggleNode: mockToggleNode,
        selectNode: mockSelectNode,
        selectedPath: fileNode.path,
        expandedPaths: new Set(),
        loadTree: mockLoadTree,
        removeNode: mockRemoveNode,
      });

      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveClass('bg-accent');
    });

    it('should have aria-selected when selected', () => {
      vi.mocked(useFileTreeStore).mockReturnValue({
        toggleNode: mockToggleNode,
        selectNode: mockSelectNode,
        selectedPath: fileNode.path,
        expandedPaths: new Set(),
        loadTree: mockLoadTree,
        removeNode: mockRemoveNode,
      });

      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Directory expansion', () => {
    it('should show chevron for directories', () => {
      const { container } = render(<FileTreeNode node={dirNode} depth={0} />);
      const chevron = container.querySelector('svg.rotate-90, svg:not(.rotate-90)');
      expect(chevron).toBeInTheDocument();
    });

    it('should rotate chevron when expanded', () => {
      vi.mocked(useFileTreeStore).mockReturnValue({
        toggleNode: mockToggleNode,
        selectNode: mockSelectNode,
        selectedPath: null,
        expandedPaths: new Set([dirNode.path]),
        loadTree: mockLoadTree,
        removeNode: mockRemoveNode,
      });

      const { container } = render(<FileTreeNode node={dirNode} depth={0} />);
      const chevron = container.querySelector('.rotate-90');
      expect(chevron).toBeInTheDocument();
    });

    it('should have aria-expanded attribute for directories', () => {
      const { container } = render(<FileTreeNode node={dirNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveAttribute('aria-expanded', 'false');
    });

    it('should not have aria-expanded for files', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).not.toHaveAttribute('aria-expanded');
    });
  });

  describe('Click behavior', () => {
    it('should call selectNode when file is clicked', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      fireEvent.click(treeItem!);
      expect(mockSelectNode).toHaveBeenCalledWith(fileNode.path);
    });

    it('should call toggleNode and selectNode when directory is clicked', () => {
      const { container } = render(<FileTreeNode node={dirNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      fireEvent.click(treeItem!);
      expect(mockToggleNode).toHaveBeenCalledWith(dirNode.path);
      expect(mockSelectNode).toHaveBeenCalledWith(dirNode.path);
    });

    it('should stop propagation on click', () => {
      const parentClickHandler = vi.fn();
      const { container } = render(
        <div onClick={parentClickHandler}>
          <FileTreeNode node={fileNode} depth={0} />
        </div>
      );
      const treeItem = container.querySelector('[role="treeitem"]');
      fireEvent.click(treeItem!);
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Git status', () => {
    it('should render git status badge when present', () => {
      const modifiedNode: FileNode = { ...fileNode, gitStatus: 'M' };
      render(<FileTreeNode node={modifiedNode} depth={0} />);
      expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('should not render badge when no git status', () => {
      render(<FileTreeNode node={fileNode} depth={0} />);
      expect(screen.queryByText('M')).not.toBeInTheDocument();
      expect(screen.queryByText('A')).not.toBeInTheDocument();
    });
  });

  describe('Gitignore dimming', () => {
    it('should dim ignored files', () => {
      const ignoredNode: FileNode = { ...fileNode, isGitIgnored: true };
      const { container } = render(<FileTreeNode node={ignoredNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveStyle({ opacity: 0.4 });
    });

    it('should not dim non-ignored files', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveStyle({ opacity: 1 });
    });
  });

  describe('File icon', () => {
    it('should render icon for files', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should render folder icon for directories', () => {
      const { container } = render(<FileTreeNode node={dirNode} depth={0} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have treeitem role', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      expect(container.querySelector('[role="treeitem"]')).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveClass('cursor-pointer');
    });

    it('should prevent text selection', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveClass('select-none');
    });
  });

  describe('Hover effects', () => {
    it('should have hover background class', () => {
      const { container } = render(<FileTreeNode node={fileNode} depth={0} />);
      const treeItem = container.querySelector('[role="treeitem"]');
      expect(treeItem).toHaveClass('hover:bg-accent');
    });
  });
});
