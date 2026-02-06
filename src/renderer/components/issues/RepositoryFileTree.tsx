import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { Skeleton } from '../ui/Skeleton';
import type { RepositoryTreeEntry } from '../../../main/ipc/channels';

interface FileTreeNode {
  name: string;
  type: 'tree' | 'blob';
  mode: string;
  children?: FileTreeNode[];
  byteSize?: number;
}

interface RepositoryFileTreeProps {
  repository: string; // "owner/repo"
  branch?: string;
}

export function RepositoryFileTree({ repository, branch = 'main' }: RepositoryFileTreeProps) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTree = async () => {
      try {
        setLoading(true);
        setError(null);
        const [owner, repo] = repository.split('/');
        const data = await ipc.invoke('github:get-repository-tree', owner, repo, branch);
        setTree(parseTreeData(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file tree');
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, [repository, branch]);

  const parseTreeData = (entries: RepositoryTreeEntry[]): FileTreeNode[] => {
    if (!entries || !Array.isArray(entries)) return [];

    const nodes = entries.map((entry) => ({
      name: entry.name,
      type: entry.type,
      mode: entry.mode,
      children: entry.object?.entries ? parseTreeData(entry.object.entries) : undefined,
      byteSize: entry.object?.byteSize,
    }));

    // Sort: folders first, then files, both alphabetically (case-insensitive)
    return nodes.sort((a, b) => {
      // Folders (tree) come before files (blob)
      if (a.type === 'tree' && b.type !== 'tree') return -1;
      if (a.type !== 'tree' && b.type === 'tree') return 1;
      // Within same type, sort alphabetically (case-insensitive)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  };

  const toggleNode = (nodePath: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodePath)) {
        next.delete(nodePath);
      } else {
        next.add(nodePath);
      }
      return next;
    });
  };

  const renderNode = (
    node: FileTreeNode,
    path: string = '',
    depth: number = 0
  ): React.JSX.Element => {
    const nodePath = `${path}/${node.name}`;
    const isExpanded = expandedNodes.has(nodePath);
    const isDirectory = node.type === 'tree';
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={nodePath}>
        <div
          className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded cursor-pointer"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => isDirectory && toggleNode(nodePath)}
        >
          {isDirectory ? (
            <>
              {hasChildren &&
                (isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                ))}
              {!hasChildren && <span className="w-4" />}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </>
          ) : (
            <>
              <span className="w-4" />
              <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </>
          )}
          <span className="text-sm truncate">{node.name}</span>
          {!isDirectory && node.byteSize && (
            <span className="text-xs text-muted-foreground ml-auto">
              {formatBytes(node.byteSize)}
            </span>
          )}
        </div>
        {isDirectory && isExpanded && hasChildren && node.children && (
          <div>{node.children.map((child) => renderNode(child, nodePath, depth + 1))}</div>
        )}
      </div>
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2 ml-4" />
        <Skeleton className="h-6 w-2/3 ml-4" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2 ml-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">No files found</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto border rounded-md p-2 styled-scroll">
      {tree.map((node) => renderNode(node))}
    </div>
  );
}
