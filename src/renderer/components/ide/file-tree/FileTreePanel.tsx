import { useEffect, useMemo, useCallback, useRef } from 'react';
import { List } from 'react-window';
import type { FileNode } from '../../../../main/ipc/channels';
import { useFileTreeStore } from '../../../stores/useFileTreeStore';
import { useGitStore } from '../../../stores/useGitStore';
import { FileTreeNode } from './FileTreeNode';
import { FileTreeSkeleton } from '../../ui/FileTreeSkeleton';
import { ipc } from '../../../ipc/client';

interface FileTreePanelProps {
  repoPath: string;
  height?: number;
}

interface FlattenedNode {
  node: FileNode;
  depth: number;
}

/**
 * Flatten tree structure for virtualization
 */
function flattenTree(nodes: FileNode[], expandedPaths: Set<string>, depth = 0): FlattenedNode[] {
  const flattened: FlattenedNode[] = [];

  if (!nodes || !Array.isArray(nodes)) {
    return flattened;
  }

  for (const node of nodes) {
    // Add current node
    flattened.push({ node, depth });

    // Add children if directory is expanded
    if (node.type === 'directory' && node.children && Array.isArray(node.children) && expandedPaths.has(node.path)) {
      flattened.push(...flattenTree(node.children, expandedPaths, depth + 1));
    }
  }

  return flattened;
}

export function FileTreePanel({ repoPath, height = 800 }: FileTreePanelProps) {
  const { fileTree, expandedPaths, loading, error, loadTree, addNode, removeNode } =
    useFileTreeStore();
  const { fetchStatus } = useGitStore();

  // Debounced git status refresh
  const refreshGitStatusDebounced = useRef<NodeJS.Timeout | null>(null);
  const debouncedRefreshGitStatus = useCallback(() => {
    if (refreshGitStatusDebounced.current) {
      clearTimeout(refreshGitStatusDebounced.current);
    }

    refreshGitStatusDebounced.current = setTimeout(() => {
      if (repoPath) {
        fetchStatus(repoPath);
      }
    }, 500);
  }, [repoPath, fetchStatus]);

  // Load tree on mount or when repoPath changes
  useEffect(() => {
    if (repoPath) {
      loadTree(repoPath);

      // Start watching directory
      ipc.invoke('fs:watch-directory', repoPath);
    }

    return () => {
      // Cleanup debounce timer
      if (refreshGitStatusDebounced.current) {
        clearTimeout(refreshGitStatusDebounced.current);
      }

      // Stop watching directory
      if (repoPath) {
        ipc.invoke('fs:unwatch-directory', repoPath);
      }
    };
  }, [repoPath, loadTree]);

  // Subscribe to file watcher events
  useEffect(() => {
    if (!repoPath) return;

    const handleFileAdded = (path: string) => {
      if (path.startsWith(repoPath)) {
        addNode(path);
        debouncedRefreshGitStatus();
      }
    };

    const handleFileDeleted = (path: string) => {
      if (path.startsWith(repoPath)) {
        removeNode(path);
        debouncedRefreshGitStatus();
      }
    };

    const handleFileChanged = (path: string) => {
      if (path.startsWith(repoPath)) {
        debouncedRefreshGitStatus();
      }
    };

    const unsubscribeAdded = ipc.on('fs:file-added', handleFileAdded);
    const unsubscribeDeleted = ipc.on('fs:file-deleted', handleFileDeleted);
    const unsubscribeChanged = ipc.on('fs:file-changed', handleFileChanged);

    return () => {
      unsubscribeAdded();
      unsubscribeDeleted();
      unsubscribeChanged();
    };
  }, [repoPath, addNode, removeNode, debouncedRefreshGitStatus]);

  // Flatten tree for virtualization
  const flattenedNodes = useMemo(() => {
    if (!fileTree || !Array.isArray(fileTree)) {
      return [];
    }
    return flattenTree(fileTree, expandedPaths);
  }, [fileTree, expandedPaths]);

  // Loading state
  if (loading && fileTree.length === 0) {
    return (
      <div className="h-full border-r">
        <FileTreeSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    const errorTitle = 'Failed to load file tree';
    const showErrorMessage = error !== errorTitle;
    
    return (
      <div className="h-full border-r p-4">
        <div className="text-sm text-destructive">
          <p className="font-semibold">{errorTitle}</p>
          {showErrorMessage && <p className="text-xs mt-1">{error}</p>}
        </div>
      </div>
    );
  }

  // Empty state
  if (flattenedNodes.length === 0) {
    return (
      <div className="h-full border-r p-4" role="tree" aria-label="File explorer">
        <p className="text-sm text-muted-foreground">No files found</p>
      </div>
    );
  }

  // Row component for virtualized list
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const { node, depth } = flattenedNodes[index];
    return <FileTreeNode key={node.path} node={node} depth={depth} style={style} />;
  };

  // Custom inner element that doesn't use role="list"
  const InnerElement = ({ children, ...rest }: any) => (
    <div {...rest} role="group" data-testid="virtualized-list" data-row-count={flattenedNodes.length}>
      {children}
    </div>
  );

  // Virtualized tree
  return (
    <div className="h-full border-r" role="tree" aria-label="File explorer">
      <List
        key={`${flattenedNodes.length}-${expandedPaths.size}`}
        height={height}
        width="100%"
        itemCount={flattenedNodes.length}
        itemSize={28}
        className="scrollbar-thin"
        innerElementType={InnerElement}
      >
        {Row}
      </List>
    </div>
  );
}
