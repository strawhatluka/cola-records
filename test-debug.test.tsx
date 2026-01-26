import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FileTreeNode } from './src/renderer/components/ide/file-tree/FileTreeNode';
import { useFileTreeStore } from './src/renderer/stores/useFileTreeStore';
import type { FileNode } from './src/main/ipc/channels';

// Mock the store
vi.mock('./src/renderer/stores/useFileTreeStore', () => ({
  useFileTreeStore: vi.fn(() => ({
    toggleNode: vi.fn(),
    selectNode: vi.fn(),
    selectedPath: null,
    expandedPaths: new Set(),
    loadTree: vi.fn(),
    removeNode: vi.fn(),
  })),
}));

// Mock IPC
vi.mock('./src/renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(() => vi.fn()),
  },
}));

// Mock ContextMenu
vi.mock('./src/renderer/components/ui/ContextMenu', () => ({
  ContextMenu: ({ children }: any) => children,
  ContextMenuTrigger: ({ children }: any) => children,
  ContextMenuContent: () => null,
  ContextMenuItem: () => null,
  ContextMenuSeparator: () => null,
}));

describe('Debug FileTreeNode style', () => {
  const fileNode: FileNode = {
    name: 'test.ts',
    path: '/repo/test.ts',
    type: 'file',
    size: 1024,
    modified: new Date(),
  };

  it('should apply custom style - DEBUG', () => {
    const customStyle = { backgroundColor: 'red' };
    const { container } = render(<FileTreeNode node={fileNode} depth={0} style={customStyle} />);
    const treeItem = container.querySelector('[role="treeitem"]');
    
    console.log('Tree Item HTML:', treeItem?.outerHTML);
    console.log('Tree Item style attribute:', treeItem?.getAttribute('style'));
    console.log('Tree Item computed style backgroundColor:', window.getComputedStyle(treeItem!).backgroundColor);
    console.log('Tree Item computed style paddingLeft:', window.getComputedStyle(treeItem!).paddingLeft);
    
    expect(treeItem).toBeTruthy();
  });
});
