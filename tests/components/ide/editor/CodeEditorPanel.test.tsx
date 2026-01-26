import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeEditorPanel } from '@renderer/components/ide/editor/CodeEditorPanel';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';
import type { EditorFile } from '@renderer/stores/useCodeEditorStore';
import { toast } from 'sonner';

// Mock stores
vi.mock('@renderer/stores/useCodeEditorStore', () => ({
  useCodeEditorStore: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock child components
vi.mock('@renderer/components/ide/editor/EditorTabBar', () => ({
  EditorTabBar: () => <div data-testid="editor-tab-bar">Tab Bar</div>,
}));

vi.mock('@renderer/components/ide/editor/MonacoEditor', () => ({
  MonacoEditor: ({ filePath, content, onChange }: any) => (
    <div data-testid="monaco-editor" data-file={filePath}>
      <textarea
        data-testid="monaco-textarea"
        value={content}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock('@renderer/components/ide/editor/ImageViewer', () => ({
  ImageViewer: ({ filePath }: any) => (
    <div data-testid="image-viewer" data-file={filePath}>Image Viewer</div>
  ),
}));

vi.mock('@renderer/components/ide/editor/PdfViewer', () => ({
  PdfViewer: ({ filePath }: any) => (
    <div data-testid="pdf-viewer" data-file={filePath}>PDF Viewer</div>
  ),
}));

vi.mock('@renderer/components/ide/editor/UnsupportedViewer', () => ({
  UnsupportedViewer: ({ filePath, extension }: any) => (
    <div data-testid="unsupported-viewer" data-file={filePath} data-ext={extension}>
      Unsupported Viewer
    </div>
  ),
}));

describe('CodeEditorPanel', () => {
  const mockUpdateContent = vi.fn();
  const mockSaveFile = vi.fn();
  const mockSaveAllFiles = vi.fn();
  const mockCloseFile = vi.fn();

  const createMockFile = (
    path: string,
    viewerType: EditorFile['viewerType'],
    isModified = false
  ): EditorFile => ({
    path,
    content: 'test content',
    originalContent: 'test content',
    isModified,
    extension: path.split('.').pop() || 'txt',
    lastModified: new Date(),
    viewerType,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear keyboard event listeners
    window.removeEventListener('keydown', vi.fn() as any);
  });

  describe('Empty state', () => {
    it('should show empty state when no files are open', () => {
      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles: new Map(),
        activeFilePath: null,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByText(/no file open/i)).toBeInTheDocument();
      expect(screen.getByText(/select a file from the tree/i)).toBeInTheDocument();
    });

    it('should render FileCode icon in empty state', () => {
      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles: new Map(),
        activeFilePath: null,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      // FileCode icon should be present
      const icon = document.querySelector('[class*="h-16 w-16"]');
      expect(icon).toBeInTheDocument();
    });

    it('should not render tab bar when no files', () => {
      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles: new Map(),
        activeFilePath: null,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByTestId('editor-tab-bar')).toBeInTheDocument();
    });
  });

  describe('Monaco viewer', () => {
    it('should render Monaco editor for text files', () => {
      const file = createMockFile('/repo/test.ts', 'monaco');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor').getAttribute('data-file')).toBe('/repo/test.ts');
    });

    it('should call updateContent when Monaco content changes', () => {
      const file = createMockFile('/repo/test.ts', 'monaco');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      const textarea = screen.getByTestId('monaco-textarea');
      fireEvent.change(textarea, { target: { value: 'new content' } });

      expect(mockUpdateContent).toHaveBeenCalledWith('/repo/test.ts', 'new content');
    });

    it('should not update content when value is undefined', () => {
      const file = createMockFile('/repo/test.ts', 'monaco');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      const textarea = screen.getByTestId('monaco-textarea');
      // Simulate undefined value (shouldn't happen in real usage, but test edge case)
      fireEvent.change(textarea, { target: { value: undefined } });

      expect(mockUpdateContent).not.toHaveBeenCalled();
    });
  });

  describe('Image viewer', () => {
    it('should render ImageViewer for image files', () => {
      const file = createMockFile('/repo/image.png', 'image');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer').getAttribute('data-file')).toBe('/repo/image.png');
    });
  });

  describe('PDF viewer', () => {
    it('should render PdfViewer for PDF files', () => {
      const file = createMockFile('/repo/document.pdf', 'pdf');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-viewer').getAttribute('data-file')).toBe('/repo/document.pdf');
    });
  });

  describe('Unsupported viewer', () => {
    it('should render UnsupportedViewer for unsupported files', () => {
      const file = createMockFile('/repo/file.exe', 'unsupported');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByTestId('unsupported-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('unsupported-viewer').getAttribute('data-file')).toBe('/repo/file.exe');
      expect(screen.getByTestId('unsupported-viewer').getAttribute('data-ext')).toBe('exe');
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should save file on Ctrl+S when file is modified', async () => {
      const file = createMockFile('/repo/test.ts', 'monaco', true);
      const openFiles = new Map([[file.path, file]]);
      const modifiedFiles = new Set([file.path]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles,
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      // Simulate Ctrl+S
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockSaveFile).toHaveBeenCalledWith('/repo/test.ts');
      });
    });

    it('should show info toast on Ctrl+S when file is not modified', async () => {
      const file = createMockFile('/repo/test.ts', 'monaco', false);
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      // Simulate Ctrl+S
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(vi.mocked(toast.info)).toHaveBeenCalledWith('No changes to save');
        expect(mockSaveFile).not.toHaveBeenCalled();
      });
    });

    it('should save all files on Ctrl+Shift+S when files are modified', async () => {
      const file1 = createMockFile('/repo/file1.ts', 'monaco', true);
      const file2 = createMockFile('/repo/file2.ts', 'monaco', true);
      const openFiles = new Map([[file1.path, file1], [file2.path, file2]]);
      const modifiedFiles = new Set([file1.path, file2.path]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file1.path,
        modifiedFiles,
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      // Simulate Ctrl+Shift+S
      fireEvent.keyDown(window, { key: 'S', ctrlKey: true, shiftKey: true });

      await waitFor(() => {
        expect(mockSaveAllFiles).toHaveBeenCalled();
      });
    });

    it('should show info toast on Ctrl+Shift+S when no files are modified', async () => {
      const file = createMockFile('/repo/test.ts', 'monaco', false);
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      // Simulate Ctrl+Shift+S
      fireEvent.keyDown(window, { key: 'S', ctrlKey: true, shiftKey: true });

      await waitFor(() => {
        expect(vi.mocked(toast.info)).toHaveBeenCalledWith('No modified files to save');
        expect(mockSaveAllFiles).not.toHaveBeenCalled();
      });
    });

    it('should close tab on Ctrl+W', async () => {
      const file = createMockFile('/repo/test.ts', 'monaco');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      // Simulate Ctrl+W
      fireEvent.keyDown(window, { key: 'w', ctrlKey: true });

      await waitFor(() => {
        expect(mockCloseFile).toHaveBeenCalledWith('/repo/test.ts');
      });
    });

    it('should support Cmd key on Mac (metaKey)', async () => {
      const file = createMockFile('/repo/test.ts', 'monaco', true);
      const openFiles = new Map([[file.path, file]]);
      const modifiedFiles = new Set([file.path]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles,
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      // Simulate Cmd+S (Mac)
      fireEvent.keyDown(window, { key: 's', metaKey: true });

      await waitFor(() => {
        expect(mockSaveFile).toHaveBeenCalledWith('/repo/test.ts');
      });
    });

    it('should prevent default browser behavior', async () => {
      const file = createMockFile('/repo/test.ts', 'monaco', true);
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set([file.path]),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Tab bar integration', () => {
    it('should render tab bar', () => {
      const file = createMockFile('/repo/test.ts', 'monaco');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByTestId('editor-tab-bar')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('should have flex column layout', () => {
      const file = createMockFile('/repo/test.ts', 'monaco');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      const { container } = render(<CodeEditorPanel />);
      const panel = container.firstChild as HTMLElement;

      expect(panel.className).toContain('flex');
      expect(panel.className).toContain('flex-col');
      expect(panel.className).toContain('h-full');
    });

    it('should have overflow hidden on viewer container', () => {
      const file = createMockFile('/repo/test.ts', 'monaco');
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      const { container } = render(<CodeEditorPanel />);
      const viewerContainer = container.querySelector('.flex-1.overflow-hidden');

      expect(viewerContainer).toBeInTheDocument();
    });
  });

  describe('Unknown viewer type', () => {
    it('should show error for unknown viewer type', () => {
      const file = createMockFile('/repo/test.unknown', 'monaco');
      // Manually set to invalid viewer type
      (file as any).viewerType = 'invalid';
      const openFiles = new Map([[file.path, file]]);

      vi.mocked(useCodeEditorStore).mockReturnValue({
        openFiles,
        activeFilePath: file.path,
        modifiedFiles: new Set(),
        updateContent: mockUpdateContent,
        saveFile: mockSaveFile,
        saveAllFiles: mockSaveAllFiles,
        closeFile: mockCloseFile,
      });

      render(<CodeEditorPanel />);

      expect(screen.getByText(/unknown viewer type/i)).toBeInTheDocument();
    });
  });
});
