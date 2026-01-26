import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorTabBar } from '@renderer/components/ide/editor/EditorTabBar';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';
import type { EditorFile } from '@renderer/stores/useCodeEditorStore';

// Mock stores
vi.mock('../../../../renderer/stores/useCodeEditorStore', () => ({
  useCodeEditorStore: vi.fn(),
}));

// Mock EditorTab component
vi.mock('../../../../renderer/components/ide/editor/EditorTab', () => ({
  EditorTab: ({ file, isActive, onClose, onClick }: any) => (
    <div
      data-testid={`tab-${file.path}`}
      data-active={isActive}
      onClick={onClick}
    >
      <span>{file.path.split(/[/\\]/).pop()}</span>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}>Close</button>
      {file.isModified && <span data-testid="modified-indicator">•</span>}
    </div>
  ),
}));

describe('EditorTabBar', () => {
  const mockSwitchToTab = vi.fn();
  const mockCloseFile = vi.fn();

  const createMockFile = (path: string, isModified = false): EditorFile => ({
    path,
    content: 'test content',
    originalContent: 'test content',
    isModified,
    extension: path.split('.').pop() || 'txt',
    lastModified: new Date(),
    viewerType: 'monaco',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all open tabs', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
        ['/repo/file2.js', createMockFile('/repo/file2.js')],
        ['/repo/file3.py', createMockFile('/repo/file3.py')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      expect(screen.getByTestId('tab-/repo/file1.ts')).toBeInTheDocument();
      expect(screen.getByTestId('tab-/repo/file2.js')).toBeInTheDocument();
      expect(screen.getByTestId('tab-/repo/file3.py')).toBeInTheDocument();
    });

    it('should render nothing when no files are open', () => {
      (useCodeEditorStore as any).mockReturnValue({
        openFiles: new Map(),
        activeFilePath: null,
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      const { container } = render(<EditorTabBar />);

      expect(container.firstChild).toBeNull();
    });

    it('should mark active tab correctly', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
        ['/repo/file2.js', createMockFile('/repo/file2.js')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file2.js',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      const tab1 = screen.getByTestId('tab-/repo/file1.ts');
      const tab2 = screen.getByTestId('tab-/repo/file2.js');

      expect(tab1.getAttribute('data-active')).toBe('false');
      expect(tab2.getAttribute('data-active')).toBe('true');
    });

    it('should show modified indicators', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts', true)],
        ['/repo/file2.js', createMockFile('/repo/file2.js', false)],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(['/repo/file1.ts']),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      const indicators = screen.getAllByTestId('modified-indicator');
      expect(indicators).toHaveLength(1);
    });
  });

  describe('Tab interactions', () => {
    it('should call switchToTab when tab is clicked', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
        ['/repo/file2.js', createMockFile('/repo/file2.js')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      const tab2 = screen.getByTestId('tab-/repo/file2.js');
      fireEvent.click(tab2);

      expect(mockSwitchToTab).toHaveBeenCalledWith('/repo/file2.js');
    });

    it('should call closeFile when close button is clicked', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      expect(mockCloseFile).toHaveBeenCalledWith('/repo/file1.ts');
    });

    it('should not call switchToTab when close button is clicked', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      expect(mockSwitchToTab).not.toHaveBeenCalled();
    });
  });

  describe('Tab ordering', () => {
    it('should maintain tab order based on Map insertion order', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
        ['/repo/file2.js', createMockFile('/repo/file2.js')],
        ['/repo/file3.py', createMockFile('/repo/file3.py')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      const { container } = render(<EditorTabBar />);
      const tabs = container.querySelectorAll('[data-testid^="tab-"]');

      expect(tabs[0].getAttribute('data-testid')).toBe('tab-/repo/file1.ts');
      expect(tabs[1].getAttribute('data-testid')).toBe('tab-/repo/file2.js');
      expect(tabs[2].getAttribute('data-testid')).toBe('tab-/repo/file3.py');
    });
  });

  describe('Multiple file scenarios', () => {
    it('should handle single file', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      expect(screen.getByTestId('tab-/repo/file1.ts')).toBeInTheDocument();
      expect(screen.getByText('file1.ts')).toBeInTheDocument();
    });

    it('should handle many files (10+)', () => {
      const openFiles = new Map<string, EditorFile>();
      for (let i = 1; i <= 15; i++) {
        openFiles.set(`/repo/file${i}.ts`, createMockFile(`/repo/file${i}.ts`));
      }

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      const { container } = render(<EditorTabBar />);
      const tabs = container.querySelectorAll('[data-testid^="tab-"]');

      expect(tabs).toHaveLength(15);
    });

    it('should handle mix of modified and unmodified files', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts', true)],
        ['/repo/file2.js', createMockFile('/repo/file2.js', false)],
        ['/repo/file3.py', createMockFile('/repo/file3.py', true)],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(['/repo/file1.ts', '/repo/file3.py']),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      const indicators = screen.getAllByTestId('modified-indicator');
      expect(indicators).toHaveLength(2);
    });
  });

  describe('File type diversity', () => {
    it('should handle different file types', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/code.ts', createMockFile('/repo/code.ts')],
        ['/repo/image.png', { ...createMockFile('/repo/image.png'), viewerType: 'image' }],
        ['/repo/doc.pdf', { ...createMockFile('/repo/doc.pdf'), viewerType: 'pdf' }],
        ['/repo/binary.exe', { ...createMockFile('/repo/binary.exe'), viewerType: 'unsupported' }],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/code.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      render(<EditorTabBar />);

      expect(screen.getByText('code.ts')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
      expect(screen.getByText('binary.exe')).toBeInTheDocument();
    });
  });

  describe('Container styling', () => {
    it('should have horizontal scroll container', () => {
      const openFiles = new Map<string, EditorFile>([
        ['/repo/file1.ts', createMockFile('/repo/file1.ts')],
      ]);

      (useCodeEditorStore as any).mockReturnValue({
        openFiles,
        activeFilePath: '/repo/file1.ts',
        modifiedFiles: new Set(),
        switchToTab: mockSwitchToTab,
        closeFile: mockCloseFile,
      });

      const { container } = render(<EditorTabBar />);
      const tabBar = container.firstChild as HTMLElement;

      expect(tabBar.className).toContain('flex');
      expect(tabBar.className).toContain('overflow-x-auto');
    });
  });
});
