import { create } from 'zustand';
import { ipc } from '../ipc/client';
import { toast } from 'sonner';

export interface EditorFile {
  path: string;
  content: string;
  originalContent: string;
  isModified: boolean;
  extension: string;
  lastModified: Date;
  viewerType: 'monaco' | 'image' | 'pdf' | 'unsupported';
}

interface CodeEditorState {
  openFiles: Map<string, EditorFile>;
  activeFilePath: string | null;
  modifiedFiles: Set<string>;
  loading: boolean;

  // Actions
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  closeAllFiles: () => void;
  closeOtherFiles: (path: string) => void;
  switchToTab: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  reloadFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => void;
  isModified: (path: string) => boolean;
}

/**
 * Determine viewer type based on file extension
 */
function getViewerType(extension: string): EditorFile['viewerType'] {
  const ext = extension.toLowerCase();

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
    return 'image';
  }

  // PDFs
  if (ext === 'pdf') {
    return 'pdf';
  }

  // Text/Code files (Monaco)
  const textExtensions = [
    'ts', 'tsx', 'js', 'jsx', 'py', 'dart', 'java', 'c', 'cpp', 'h', 'hpp',
    'cs', 'go', 'rs', 'swift', 'kt', 'rb', 'php', 'html', 'css', 'scss',
    'sass', 'less', 'json', 'xml', 'yaml', 'yml', 'md', 'txt', 'sh', 'bash',
    'zsh', 'ps1', 'bat', 'sql', 'r', 'lua', 'vim', 'makefile', 'dockerfile',
    'gitignore', 'env', 'ini', 'toml', 'lock', 'log',
  ];

  if (textExtensions.includes(ext)) {
    return 'monaco';
  }

  // Default to unsupported for binary files
  return 'unsupported';
}

/**
 * Get file extension from path
 */
function getExtension(filePath: string): string {
  const parts = filePath.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '';
}

export const useCodeEditorStore = create<CodeEditorState>((set, get) => ({
  openFiles: new Map(),
  activeFilePath: null,
  modifiedFiles: new Set(),
  loading: false,

  openFile: async (path: string) => {
    try {
      // Check if already open
      const { openFiles } = get();
      if (openFiles.has(path)) {
        set({ activeFilePath: path });
        return;
      }

      set({ loading: true });

      // Read file content
      const fileContent = await ipc.invoke('fs:read-file', path);
      const extension = getExtension(path);
      const viewerType = getViewerType(extension);

      const file: EditorFile = {
        path,
        content: fileContent.content,
        originalContent: fileContent.content,
        isModified: false,
        extension,
        lastModified: new Date(),
        viewerType,
      };

      const newOpenFiles = new Map(openFiles);
      newOpenFiles.set(path, file);

      set({
        openFiles: newOpenFiles,
        activeFilePath: path,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      toast.error(`Failed to open file: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  closeFile: (path: string) => {
    const { openFiles, activeFilePath, modifiedFiles } = get();

    // Warn if file is modified
    if (modifiedFiles.has(path)) {
      const confirmed = confirm(`File "${path}" has unsaved changes. Close anyway?`);
      if (!confirmed) return;
    }

    const newOpenFiles = new Map(openFiles);
    newOpenFiles.delete(path);

    const newModifiedFiles = new Set(modifiedFiles);
    newModifiedFiles.delete(path);

    // Switch to another tab if closing active tab
    let newActiveFilePath = activeFilePath;
    if (activeFilePath === path) {
      const remainingFiles = Array.from(newOpenFiles.keys());
      newActiveFilePath = remainingFiles.length > 0 ? remainingFiles[0] : null;
    }

    set({
      openFiles: newOpenFiles,
      activeFilePath: newActiveFilePath,
      modifiedFiles: newModifiedFiles,
    });
  },

  closeAllFiles: () => {
    const { modifiedFiles } = get();

    // Warn if any files are modified
    if (modifiedFiles.size > 0) {
      const confirmed = confirm(`${modifiedFiles.size} file(s) have unsaved changes. Close all anyway?`);
      if (!confirmed) return;
    }

    set({
      openFiles: new Map(),
      activeFilePath: null,
      modifiedFiles: new Set(),
    });
  },

  closeOtherFiles: (path: string) => {
    const { openFiles, modifiedFiles } = get();

    // Count modified files (excluding the kept file)
    const otherModifiedFiles = Array.from(modifiedFiles).filter(p => p !== path);
    if (otherModifiedFiles.length > 0) {
      const confirmed = confirm(`${otherModifiedFiles.length} file(s) have unsaved changes. Close them anyway?`);
      if (!confirmed) return;
    }

    const file = openFiles.get(path);
    if (!file) return;

    const newOpenFiles = new Map();
    newOpenFiles.set(path, file);

    const newModifiedFiles = new Set<string>();
    if (modifiedFiles.has(path)) {
      newModifiedFiles.add(path);
    }

    set({
      openFiles: newOpenFiles,
      activeFilePath: path,
      modifiedFiles: newModifiedFiles,
    });
  },

  switchToTab: (path: string) => {
    set({ activeFilePath: path });
  },

  updateContent: (path: string, content: string) => {
    const { openFiles, modifiedFiles } = get();
    const file = openFiles.get(path);
    if (!file) return;

    const isModified = content !== file.originalContent;

    const updatedFile: EditorFile = {
      ...file,
      content,
      isModified,
    };

    const newOpenFiles = new Map(openFiles);
    newOpenFiles.set(path, updatedFile);

    const newModifiedFiles = new Set(modifiedFiles);
    if (isModified) {
      newModifiedFiles.add(path);
    } else {
      newModifiedFiles.delete(path);
    }

    set({
      openFiles: newOpenFiles,
      modifiedFiles: newModifiedFiles,
    });
  },

  saveFile: async (path: string) => {
    try {
      const { openFiles, modifiedFiles } = get();
      const file = openFiles.get(path);
      if (!file) return;

      // Write file
      await ipc.invoke('fs:write-file', path, file.content);

      // Update file state
      const updatedFile: EditorFile = {
        ...file,
        originalContent: file.content,
        isModified: false,
        lastModified: new Date(),
      };

      const newOpenFiles = new Map(openFiles);
      newOpenFiles.set(path, updatedFile);

      const newModifiedFiles = new Set(modifiedFiles);
      newModifiedFiles.delete(path);

      set({
        openFiles: newOpenFiles,
        modifiedFiles: newModifiedFiles,
      });

      toast.success(`Saved: ${path.split(/[/\\]/).pop()}`);
    } catch (error) {
      toast.error('Failed to save file');
    }
  },

  saveAllFiles: async () => {
    const { openFiles, modifiedFiles } = get();
    if (modifiedFiles.size === 0) {
      toast.info('No modified files to save');
      return;
    }

    try {
      const filesToSave = Array.from(modifiedFiles);

      // Save all files in parallel
      await Promise.all(
        filesToSave.map(path => {
          const file = openFiles.get(path);
          if (!file) return Promise.resolve();
          return ipc.invoke('fs:write-file', path, file.content);
        })
      );

      // Update all files at once to avoid race conditions
      const newOpenFiles = new Map(openFiles);
      filesToSave.forEach(path => {
        const file = openFiles.get(path);
        if (file) {
          newOpenFiles.set(path, {
            ...file,
            originalContent: file.content,
            isModified: false,
            lastModified: new Date(),
          });
        }
      });

      set({
        openFiles: newOpenFiles,
        modifiedFiles: new Set(), // Clear all modified files
      });

      toast.success('All files saved successfully');
    } catch (error) {
      toast.error(`Failed to save all files: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  reloadFile: async (path: string) => {
    const { openFiles, modifiedFiles } = get();
    const file = openFiles.get(path);
    if (!file) return;

    try {
      const fileContent = await ipc.invoke('fs:read-file', path);

      const updatedFile: EditorFile = {
        ...file,
        content: fileContent.content,
        originalContent: fileContent.content,
        isModified: false,
        lastModified: new Date(),
      };

      const newOpenFiles = new Map(openFiles);
      newOpenFiles.set(path, updatedFile);

      const newModifiedFiles = new Set(modifiedFiles);
      newModifiedFiles.delete(path);

      set({
        openFiles: newOpenFiles,
        modifiedFiles: newModifiedFiles,
      });

      toast.success('File reloaded');
    } catch (error) {
      toast.error(`Failed to reload file: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  renameFile: (oldPath: string, newPath: string) => {
    const { openFiles, activeFilePath, modifiedFiles } = get();
    const file = openFiles.get(oldPath);

    if (!file) return;

    // Create new file entry with updated path
    const updatedFile: EditorFile = {
      ...file,
      path: newPath,
      extension: getExtension(newPath),
    };

    const newOpenFiles = new Map(openFiles);
    newOpenFiles.delete(oldPath);
    newOpenFiles.set(newPath, updatedFile);

    // Update modified files set
    const newModifiedFiles = new Set(modifiedFiles);
    if (modifiedFiles.has(oldPath)) {
      newModifiedFiles.delete(oldPath);
      newModifiedFiles.add(newPath);
    }

    // Update active file path if renamed file was active
    const newActiveFilePath = activeFilePath === oldPath ? newPath : activeFilePath;

    set({
      openFiles: newOpenFiles,
      activeFilePath: newActiveFilePath,
      modifiedFiles: newModifiedFiles,
    });
  },

  isModified: (path: string) => {
    const { modifiedFiles } = get();
    return modifiedFiles.has(path);
  },
}));
