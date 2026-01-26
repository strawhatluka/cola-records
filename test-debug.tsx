import { render } from '@testing-library/react';
import { FileTreeNode } from './src/renderer/components/ide/file-tree/FileTreeNode';

// Mock the required hooks and dependencies
vi.mock('./src/renderer/stores/useFileTreeStore');
const customStyle = { backgroundColor: 'red' };
const fileNode = {
  name: 'test.txt',
  path: '/test/test.txt',
  type: 'file' as const,
  isGitIgnored: false,
};

const { container } = render(<FileTreeNode node={fileNode} depth={0} style={customStyle} />);
const treeItem = container.querySelector('[role="treeitem"]');
console.log('TreeItem HTML:', treeItem?.outerHTML);
console.log('TreeItem style:', treeItem?.getAttribute('style'));
