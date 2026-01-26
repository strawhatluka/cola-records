import { useState } from 'react';
import { ChevronRight, Copy, Trash2, Edit, ExternalLink, FilePlus, FolderPlus } from 'lucide-react';
import type { FileNode } from '../../../../main/ipc/channels';
import { useFileTreeStore } from '../../../stores/useFileTreeStore';
import { useCodeEditorStore } from '../../../stores/useCodeEditorStore';
import { FileIcon } from './FileIcon';
import { GitStatusBadge } from './GitStatusBadge';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../../ui/ContextMenu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';
import { ipc } from '../../../ipc/client';

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  style?: React.CSSProperties;
}

export function FileTreeNode({ node, depth, style }: FileTreeNodeProps) {
  const { toggleNode, selectNode, selectedPath, expandedPaths, loadTree, removeNode } = useFileTreeStore();
  const { openFile } = useCodeEditorStore();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const isSelected = node.path === selectedPath;
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isDirectory) {
      toggleNode(node.path);
    } else {
      // Open file in editor
      try {
        const result = await ipc.invoke('fs:read-file', node.path);
        openFile(node.path, result.content);
      } catch (error) {
        toast.error(`Failed to open file: ${error}`);
      }
    }

    selectNode(node.path);
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(node.path);
      toast.success('Path copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy path');
    }
  };

  const handleRevealInExplorer = async () => {
    try {
      await ipc.invoke('fs:reveal-in-explorer', node.path);
    } catch (error) {
      toast.error('Failed to reveal in explorer');
    }
  };

  const handleRename = () => {
    setNewName(node.name);
    setRenameDialogOpen(true);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleNewFile = () => {
    setNewFileName('');
    setNewFileDialogOpen(true);
  };

  const handleNewFolder = () => {
    setNewFolderName('');
    setNewFolderDialogOpen(true);
  };

  const confirmNewFile = async () => {
    if (!newFileName.trim()) {
      toast.error('Filename cannot be empty');
      return;
    }

    setIsCreating(true);
    try {
      const targetDir = isDirectory ? node.path : node.path.split(/[/\\]/).slice(0, -1).join('/');
      const newFilePath = `${targetDir}/${newFileName}`;

      await ipc.invoke('fs:create-file', newFilePath, '');

      // Reload the tree to reflect changes
      const pathParts = node.path.split(/[/\\]/);
      const repoPath = pathParts[0] + '/' + pathParts[1]; // Get /test/repo
      await loadTree(repoPath);

      toast.success(`Created ${newFileName}`);
      setNewFileDialogOpen(false);

      // Open the new file in editor
      openFile(newFilePath, '');
    } catch (error) {
      toast.error(`Failed to create file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCreating(false);
    }
  };

  const confirmNewFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Folder name cannot be empty');
      return;
    }

    setIsCreating(true);
    try {
      const targetDir = isDirectory ? node.path : node.path.split(/[/\\]/).slice(0, -1).join('/');
      const newFolderPath = `${targetDir}/${newFolderName}`;

      await ipc.invoke('fs:create-directory', newFolderPath);

      // Reload the tree to reflect changes
      const pathParts = node.path.split(/[/\\]/);
      const repoPath = pathParts[0] + '/' + pathParts[1]; // Get /test/repo
      await loadTree(repoPath);

      toast.success(`Created folder ${newFolderName}`);
      setNewFolderDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to create folder: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCreating(false);
    }
  };

  const confirmRename = async () => {
    if (!newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    if (newName === node.name) {
      setRenameDialogOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      // Extract directory path
      const pathParts = node.path.split(/[/\\]/);
      pathParts.pop(); // Remove old filename
      const dirPath = pathParts.join('/');
      const newPath = `${dirPath}/${newName}`;

      await ipc.invoke('fs:rename-file', node.path, newPath);

      // Reload the tree to reflect changes
      const repoPath = node.path.split(/[/\\]/)[0]; // Get root path
      await loadTree(repoPath);

      toast.success(`Renamed to ${newName}`);
      setRenameDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to rename: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRenaming(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await ipc.invoke('fs:delete-file', node.path);

      // Remove from tree
      removeNode(node.path);

      toast.success(`Deleted ${node.name}`);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to delete: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Merge custom styles with default styles
  // Custom styles come AFTER defaults to ensure they take precedence
  const nodeStyle: React.CSSProperties = {
    paddingLeft: `${depth * 16 + 8}px`,
    opacity: node.isGitIgnored ? 0.4 : 1,
    ...(style || {}),
  };

  const nodeContent = (
    <div
      className={cn(
        'flex items-center gap-1.5 py-1 cursor-pointer hover:bg-accent text-sm select-none',
        isSelected && 'bg-accent'
      )}
      style={nodeStyle}
      onClick={handleClick}
      role="treeitem"
      aria-label={node.name}
      aria-selected={isSelected}
      aria-expanded={isDirectory ? isExpanded : undefined}
      data-ignored={node.isGitIgnored ? 'true' : undefined}
      tabIndex={0}
    >
      {/* Chevron for directories */}
      {isDirectory ? (
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
      ) : (
        <div className="w-3.5" /> // Spacer for files
      )}

      {/* File/Folder Icon */}
      <FileIcon filename={node.name} type={node.type} isExpanded={isExpanded} />

      {/* File/Folder Name */}
      <span className="flex-1 truncate">{node.name}</span>

      {/* Git Status Badge */}
      {node.gitStatus && <GitStatusBadge status={node.gitStatus} />}
    </div>
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{nodeContent}</ContextMenuTrigger>
        <ContextMenuContent>
          {isDirectory && (
            <>
              <ContextMenuItem onClick={handleNewFile}>
                <FilePlus className="h-4 w-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={handleNewFolder}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={handleRename}>
            <Edit className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyPath}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Path
          </ContextMenuItem>
          <ContextMenuItem onClick={handleRevealInExplorer}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Reveal in Explorer
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {isDirectory ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              Enter a new name for {node.name}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirmRename();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={isRenaming}>
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {isDirectory ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{node.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={newFileDialogOpen} onOpenChange={setNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>
              Enter a name for the new file
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="filename"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirmNewFile();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmNewFile} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirmNewFolder();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmNewFolder} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
