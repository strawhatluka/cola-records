import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTreePanel } from '@renderer/components/ide/file-tree/FileTreePanel';
import { CodeEditorPanel } from '@renderer/components/ide/editor/CodeEditorPanel';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';

// Mock IPC
const mockInvokeIPCIPC = vi.fn();
const mockOnIPC = vi.fn(() => () => {});

vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvokeIPCIPC,
    on: mockOnIPC,
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

// Mock react-window to avoid TypeError
vi.mock('react-window', () => ({
  List: ({ children, itemCount, innerElementType: InnerElement }: any) => {
    const Inner = InnerElement || 'div';
    return (
      <Inner data-testid="virtualized-list" data-row-count={itemCount}>
        {Array.from({ length: Math.min(itemCount, 10) }).map((_, index) =>
          children({ index, style: {} })
        )}
      </Inner>
    );
  },
}));
describe('File Operations - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
    mockInvokeIPC.mockResolvedValueOnce([
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
    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:create-file',
        '/test/repo/src/newFile.ts',
        ''
      );
    });

    // Mock file tree refresh
    mockInvokeIPC.mockResolvedValueOnce([
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
    mockInvokeIPC.mockResolvedValueOnce({
      content: '',
      encoding: 'utf-8',
    });

    // Open in editor
    const newFileNode = screen.getByText('newFile.ts');
    await user.click(newFileNode);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:read-file',
        '/test/repo/src/newFile.ts'
      );
    });

    // Verify editor has file open
    const { openFiles, activeFilePath } = useCodeEditorStore.getState();
    expect(openFiles.has('/test/repo/src/newFile.ts')).toBe(true);
    expect(activeFilePath).toBe('/test/repo/src/newFile.ts');
  });

  it('should rename file and update editor tab', async () => {
    const user = userEvent.setup();

    // Mock file tree with existing file
    mockInvokeIPC.mockResolvedValueOnce([
      {
        name: 'oldName.ts',
        path: '/test/repo/oldName.ts',
        type: 'file',
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file in editor first
    mockInvokeIPC.mockResolvedValueOnce({
      content: 'const test = 1;',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('oldName.ts');
    await user.click(fileNode);

    await waitFor(() => {
      const { openFiles } = useCodeEditorStore.getState();
      expect(openFiles.has('/test/repo/oldName.ts')).toBe(true);
    });

    // Right-click and rename
    await user.pointer({ keys: '[MouseRight]', target: fileNode });

    const renameButton = screen.getByRole('menuitem', { name: /rename/i });
    await user.click(renameButton);

    const renameInput = screen.getByDisplayValue('oldName.ts');
    await user.clear(renameInput);
    await user.type(renameInput, 'newName.ts{Enter}');

    // Mock rename operation
    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:rename',
        '/test/repo/oldName.ts',
        '/test/repo/newName.ts'
      );
    });

    // Mock file tree refresh
    mockInvokeIPC.mockResolvedValueOnce([
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
    mockInvokeIPC.mockResolvedValueOnce([
      {
        name: 'toDelete.ts',
        path: '/test/repo/toDelete.ts',
        type: 'file',
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file in editor
    mockInvokeIPC.mockResolvedValueOnce({
      content: 'const test = 1;',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('toDelete.ts');
    await user.click(fileNode);

    await waitFor(() => {
      const { openFiles } = useCodeEditorStore.getState();
      expect(openFiles.has('/test/repo/toDelete.ts')).toBe(true);
    });

    // Right-click and delete
    await user.pointer({ keys: '[MouseRight]', target: fileNode });

    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Mock delete operation
    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:delete',
        '/test/repo/toDelete.ts'
      );
    });

    // Mock file tree refresh
    mockInvokeIPC.mockResolvedValueOnce([]);

    await waitFor(() => {
      expect(screen.queryByText('toDelete.ts')).not.toBeInTheDocument();
    });

    // Verify editor tab closed
    const { openFiles, activeFilePath } = useCodeEditorStore.getState();
    expect(openFiles.has('/test/repo/toDelete.ts')).toBe(false);
    expect(activeFilePath).toBeNull();
  });

  it('should handle save as operation', async () => {
    const user = userEvent.setup();

    // Mock file tree
    mockInvokeIPC.mockResolvedValueOnce([
      {
        name: 'original.ts',
        path: '/test/repo/original.ts',
        type: 'file',
      },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file
    mockInvokeIPC.mockResolvedValueOnce({
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
    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/copy.ts',
        'const modified = true;'
      );
    });

    // Mock file tree refresh
    mockInvokeIPC.mockResolvedValueOnce([
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
    expect(openFiles.has('/test/repo/copy.ts')).toBe(true);
    expect(activeFilePath).toBe('/test/repo/copy.ts');
  });

  it('should handle concurrent file edits in multiple tabs', async () => {
    const user = userEvent.setup();

    // Mock file tree
    mockInvokeIPC.mockResolvedValueOnce([
      { name: 'file1.ts', path: '/test/repo/file1.ts', type: 'file' },
      { name: 'file2.ts', path: '/test/repo/file2.ts', type: 'file' },
    ]);

    render(<FileTreePanel repoPath="/test/repo" />);
    render(<CodeEditorPanel />);

    // Open file1
    mockInvokeIPC.mockResolvedValueOnce({
      content: 'const file1 = 1;',
      encoding: 'utf-8',
    });

    const file1Node = await screen.findByText('file1.ts');
    await user.click(file1Node);

    // Open file2
    mockInvokeIPC.mockResolvedValueOnce({
      content: 'const file2 = 2;',
      encoding: 'utf-8',
    });

    const file2Node = screen.getByText('file2.ts');
    await user.click(file2Node);

    // Wait for files to be opened
    await waitFor(() => {
      const { openFiles } = useCodeEditorStore.getState();
      expect(openFiles.has('/test/repo/file1.ts')).toBe(true);
      expect(openFiles.has('/test/repo/file2.ts')).toBe(true);
    });

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
    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/file2.ts', // active file
        'const file2 = 20;'
      );
    });

    // Switch to file1 and save
    const file1Tab = screen.getByRole('tab', { name: /file1\.ts/i });
    await user.click(file1Tab);

    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
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
    mockInvokeIPC.mockResolvedValueOnce([]);

    render(<FileTreePanel repoPath="/test/repo" />);

    // Create new directory
    const rootNode = screen.getByText(/test\/repo/i);
    await user.pointer({ keys: '[MouseRight]', target: rootNode });

    const newDirButton = screen.getByRole('menuitem', { name: /new folder/i });
    await user.click(newDirButton);

    const dirInput = screen.getByPlaceholderText(/folder name/i);
    await user.type(dirInput, 'components{Enter}');

    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:create-directory',
        '/test/repo/components'
      );
    });

    // Mock file tree refresh
    mockInvokeIPC.mockResolvedValueOnce([
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

    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:rename',
        '/test/repo/components',
        '/test/repo/ui'
      );
    });

    // Mock file tree refresh
    mockInvokeIPC.mockResolvedValueOnce([
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

    mockInvokeIPC.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvokeIPC).toHaveBeenCalledWith(
        'fs:delete-directory',
        '/test/repo/ui'
      );
    });

    // Mock file tree refresh
    mockInvokeIPC.mockResolvedValueOnce([]);

    await waitFor(() => {
      expect(screen.queryByText('ui')).not.toBeInTheDocument();
    });
  });
});
