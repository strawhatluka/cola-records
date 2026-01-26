import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTreePanel } from '@renderer/components/ide/file-tree/FileTreePanel';
import { CodeEditorPanel } from '@renderer/components/ide/editor/CodeEditorPanel';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';

describe('File Operations - Integration Tests', () => {
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

    // Reset store
    useCodeEditorStore.setState({
      openFiles: new Map(),
      activeFilePath: null,
      modifiedFiles: new Set(),
      loading: false,
    });
  });
  it('should create new file and open in editor', async () => {
    const user = userEvent.setup();

    // Mock file tree
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory',
        children: [],
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Right-click on src directory
    const srcNode = await screen.findByText('src');
    await user.pointer({ keys: '[MouseRight]', target: srcNode });

    // Click "New File"
    const newFileButton = screen.getByRole('menuitem', { name: /new file/i });
    await user.click(newFileButton);

    // Enter filename
    const filenameInput = screen.getByPlaceholderText(/filename/i);
    await user.type(filenameInput, 'newFile.ts{Enter}');

    // Mock file creation
    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:create-file',
        '/test/repo/src/newFile.ts',
        ''
      );
    });

    // Mock file tree refresh
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory',
        children: [
          { name: 'newFile.ts', path: '/test/repo/src/newFile.ts', type: 'file' },
        ],
      },
    ]);

    // Verify file appears in tree
    await waitFor(() => {
      expect(screen.getByText('newFile.ts')).toBeInTheDocument();
    });

    // Mock file open
    mockInvoke.mockResolvedValueOnce({
      content: '',
      encoding: 'utf-8',
    });

    // Open in editor
    const newFileNode = screen.getByText('newFile.ts');
    await user.click(newFileNode);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:read-file',
        '/test/repo/src/newFile.ts'
      );
    });

    // Verify editor has file open
    const { openFiles, activeFilePath } = useCodeEditorStore.getState();
    expect(openFiles).toContain('/test/repo/src/newFile.ts');
    expect(activeFilePath).toBe('/test/repo/src/newFile.ts');
  });

  it('should rename file and update editor tab', async () => {
    const user = userEvent.setup();

    // Mock file tree with existing file
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'oldName.ts',
        path: '/test/repo/oldName.ts',
        type: 'file',
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file in editor first
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = 1;',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('oldName.ts');
    await user.click(fileNode);

    await waitFor(() => {
      const { openFiles } = useCodeEditorStore.getState();
      expect(openFiles).toContain('/test/repo/oldName.ts');
    });

    // Right-click and rename
    await user.pointer({ keys: '[MouseRight]', target: fileNode });

    const renameButton = screen.getByRole('menuitem', { name: /rename/i });
    await user.click(renameButton);

    const renameInput = screen.getByDisplayValue('oldName.ts');
    await user.clear(renameInput);
    await user.type(renameInput, 'newName.ts{Enter}');

    // Mock rename operation
    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:rename',
        '/test/repo/oldName.ts',
        '/test/repo/newName.ts'
      );
    });

    // Mock file tree refresh
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'newName.ts',
        path: '/test/repo/newName.ts',
        type: 'file',
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('newName.ts')).toBeInTheDocument();
      expect(screen.queryByText('oldName.ts')).not.toBeInTheDocument();
    });

    // Verify editor tab updated
    const { openFiles } = useCodeEditorStore.getState();
    const openFilePaths = Array.from(openFiles.keys());
    expect(openFilePaths).toContain('/test/repo/newName.ts');
    expect(openFilePaths).not.toContain('/test/repo/oldName.ts');
    const newNameFile = openFiles.get('/test/repo/newName.ts');
    expect(newNameFile?.content).toBe('const test = 1;');
  });

  it('should delete file and close editor tab', async () => {
    const user = userEvent.setup();

    // Mock file tree
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'toDelete.ts',
        path: '/test/repo/toDelete.ts',
        type: 'file',
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file in editor
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = 1;',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('toDelete.ts');
    await user.click(fileNode);

    await waitFor(() => {
      const { openFiles } = useCodeEditorStore.getState();
      expect(openFiles).toContain('/test/repo/toDelete.ts');
    });

    // Right-click and delete
    await user.pointer({ keys: '[MouseRight]', target: fileNode });

    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Mock delete operation
    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:delete',
        '/test/repo/toDelete.ts'
      );
    });

    // Mock file tree refresh
    mockInvoke.mockResolvedValueOnce([]);

    await waitFor(() => {
      expect(screen.queryByText('toDelete.ts')).not.toBeInTheDocument();
    });

    // Verify editor tab closed
    const { openFiles, activeFilePath } = useCodeEditorStore.getState();
    expect(openFiles).not.toContain('/test/repo/toDelete.ts');
    expect(activeFilePath).toBeNull();
  });

  it('should handle save as operation', async () => {
    const user = userEvent.setup();

    // Mock file tree
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'original.ts',
        path: '/test/repo/original.ts',
        type: 'file',
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file
    mockInvoke.mockResolvedValueOnce({
      content: 'const original = true;',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('original.ts');
    await user.click(fileNode);

    // Edit content
    const { updateContent } = useCodeEditorStore.getState();
    updateContent('/test/repo/original.ts', 'const modified = true;');

    // Trigger Save As (Ctrl+Shift+S)
    await user.keyboard('{Control>}{Shift>}s{/Shift}{/Control}');

    // Enter new filename
    const saveAsInput = screen.getByPlaceholderText(/save as/i);
    await user.type(saveAsInput, '/test/repo/copy.ts{Enter}');

    // Mock save as operation
    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/copy.ts',
        'const modified = true;'
      );
    });

    // Mock file tree refresh
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'original.ts',
        path: '/test/repo/original.ts',
        type: 'file',
      },
      {
        name: 'copy.ts',
        path: '/test/repo/copy.ts',
        type: 'file',
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('copy.ts')).toBeInTheDocument();
    });

    // Verify new file opened in editor
    const { openFiles, activeFilePath } = useCodeEditorStore.getState();
    expect(openFiles).toContain('/test/repo/copy.ts');
    expect(activeFilePath).toBe('/test/repo/copy.ts');
  });

  it('should handle concurrent file edits in multiple tabs', async () => {
    const user = userEvent.setup();

    // Mock file tree
    mockInvoke.mockResolvedValueOnce([
      { name: 'file1.ts', path: '/test/repo/file1.ts', type: 'file' },
      { name: 'file2.ts', path: '/test/repo/file2.ts', type: 'file' },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file1
    mockInvoke.mockResolvedValueOnce({
      content: 'const file1 = 1;',
      encoding: 'utf-8',
    });

    const file1Node = await screen.findByText('file1.ts');
    await user.click(file1Node);

    // Open file2
    mockInvoke.mockResolvedValueOnce({
      content: 'const file2 = 2;',
      encoding: 'utf-8',
    });

    const file2Node = screen.getByText('file2.ts');
    await user.click(file2Node);

    // Edit file1
    const { updateContent } = useCodeEditorStore.getState();
    updateContent('/test/repo/file1.ts', 'const file1 = 10;');

    // Edit file2
    updateContent('/test/repo/file2.ts', 'const file2 = 20;');

    // Verify both have unsaved changes
    const { modifiedFiles } = useCodeEditorStore.getState();
    expect(modifiedFiles.has('/test/repo/file1.ts')).toBe(true);
    expect(modifiedFiles.has('/test/repo/file2.ts')).toBe(true);

    // Save file1
    mockInvoke.mockResolvedValueOnce(undefined);

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/file2.ts', // active file
        'const file2 = 20;'
      );
    });

    // Switch to file1 and save
    const file1Tab = screen.getByRole('tab', { name: /file1\.ts/i });
    await user.click(file1Tab);

    mockInvoke.mockResolvedValueOnce(undefined);

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/file1.ts',
        'const file1 = 10;'
      );
    });

    // Verify no unsaved changes
    expect(useCodeEditorStore.getState().modifiedFiles.size).toBe(0);
  });

  it.skip('should handle directory operations (create, rename, delete)', async () => {
    const user = userEvent.setup();

    // Mock empty file tree
    mockInvoke.mockResolvedValueOnce([]);

    render(<FileTreePanel repoPath="/test/repo" />);

    // Create new directory
    const rootNode = screen.getByText(/test\/repo/i);
    await user.pointer({ keys: '[MouseRight]', target: rootNode });

    const newDirButton = screen.getByRole('menuitem', { name: /new folder/i });
    await user.click(newDirButton);

    const dirInput = screen.getByPlaceholderText(/folder name/i);
    await user.type(dirInput, 'components{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:create-directory',
        '/test/repo/components'
      );
    });

    // Mock file tree refresh
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'components',
        path: '/test/repo/components',
        type: 'directory',
        children: [],
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('components')).toBeInTheDocument();
    });

    // Rename directory
    const componentsNode = screen.getByText('components');
    await user.pointer({ keys: '[MouseRight]', target: componentsNode });

    const renameDirButton = screen.getByRole('menuitem', { name: /rename/i });
    await user.click(renameDirButton);

    const renameInput = screen.getByDisplayValue('components');
    await user.clear(renameInput);
    await user.type(renameInput, 'ui{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:rename',
        '/test/repo/components',
        '/test/repo/ui'
      );
    });

    // Mock file tree refresh
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'ui',
        path: '/test/repo/ui',
        type: 'directory',
        children: [],
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('ui')).toBeInTheDocument();
      expect(screen.queryByText('components')).not.toBeInTheDocument();
    });

    // Delete directory
    const uiNode = screen.getByText('ui');
    await user.pointer({ keys: '[MouseRight]', target: uiNode });

    const deleteDirButton = screen.getByRole('menuitem', { name: /delete/i });
    await user.click(deleteDirButton);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:delete-directory',
        '/test/repo/ui'
      );
    });

    // Mock file tree refresh
    mockInvoke.mockResolvedValueOnce([]);

    await waitFor(() => {
      expect(screen.queryByText('ui')).not.toBeInTheDocument();
    });
  });
});
