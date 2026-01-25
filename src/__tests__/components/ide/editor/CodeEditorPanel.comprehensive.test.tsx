import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CodeEditorPanel } from '../../../../renderer/components/ide/editor/CodeEditorPanel';
import { useCodeEditorStore } from '../../../../renderer/stores/useCodeEditorStore';
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

  // Reset store
  useCodeEditorStore.setState({
    openFiles: new Map(),
    activeFilePath: null,
    modifiedFiles: new Set(),
    loading: false,
  });
});

describe('CodeEditorPanel - Comprehensive Tests', () => {
  it('should render empty state when no files open', () => {
    render(<CodeEditorPanel />);

    expect(screen.getByText(/No file open/i)).toBeInTheDocument();
  });

  it('should open files in tabs', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = "hello";',
      encoding: 'utf-8',
    });

    render(<CodeEditorPanel />);

    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/index.ts');

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });
  });

  it('should show modified indicator on unsaved changes', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = "hello";',
      encoding: 'utf-8',
    });

    const { container } = render(<CodeEditorPanel />);

    const { openFile, updateContent } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/test.ts');

    // Simulate content change
    updateContent('/test/repo/src/test.ts', '// Modified content');

    await waitFor(() => {
      const modifiedIndicator = container.querySelector('[data-modified="true"]');
      expect(modifiedIndicator).toBeInTheDocument();
    });
  });

  it('should save file on Ctrl+S', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        content: 'const test = "hello";',
        encoding: 'utf-8',
      })
      .mockResolvedValueOnce(undefined); // save response

    render(<CodeEditorPanel />);

    const { openFile, updateContent } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/test.ts');
    updateContent('/test/repo/src/test.ts', '// New content');

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/src/test.ts',
        '// New content'
      );
    });
  });

  it('should close tab on Ctrl+W', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = "hello";',
      encoding: 'utf-8',
    });

    render(<CodeEditorPanel />);

    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/index.ts');

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    await user.keyboard('{Control>}w{/Control}');

    await waitFor(() => {
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    });
  });

  it('should switch between multiple open files', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({ content: 'File 1', encoding: 'utf-8' })
      .mockResolvedValueOnce({ content: 'File 2', encoding: 'utf-8' });

    render(<CodeEditorPanel />);

    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/file1.ts');
    await openFile('/test/repo/file2.ts');

    await waitFor(() => {
      expect(screen.getByText('file1.ts')).toBeInTheDocument();
      expect(screen.getByText('file2.ts')).toBeInTheDocument();
    });

    // Click first tab
    await user.click(screen.getByText('file1.ts'));

    await waitFor(() => {
      const { activeFilePath } = useCodeEditorStore.getState();
      expect(activeFilePath).toBe('/test/repo/file1.ts');
    });
  });

  it('should confirm before closing tab with unsaved changes', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    mockInvoke.mockResolvedValueOnce({
      content: 'const test = "hello";',
      encoding: 'utf-8',
    });

    render(<CodeEditorPanel />);

    const { openFile, updateContent } = useCodeEditorStore.getState();
    await openFile('/test/repo/src/test.ts');
    updateContent('/test/repo/src/test.ts', '// Modified');

    await user.keyboard('{Control>}w{/Control}');

    expect(confirmSpy).toHaveBeenCalled();

    // Tab should still be open because user cancelled
    expect(screen.getByText('test.ts')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it('should handle different file types (image, PDF, unsupported)', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: 'data:image/png;base64,...',
      encoding: 'base64',
    });

    render(<CodeEditorPanel />);

    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/image.png');

    await waitFor(() => {
      expect(screen.getByText('image.png')).toBeInTheDocument();
      // Should render ImageViewer component
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });
});
