import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorTab } from '@renderer/components/ide/editor/EditorTab';
import type { EditorFile } from '@renderer/stores/useCodeEditorStore';

// Mock FileIcon component
vi.mock('@renderer/components/ide/file-tree/FileIcon', () => ({
  FileIcon: () => <div data-testid="file-icon">📄</div>,
}));

describe('EditorTab', () => {
  const mockOnClose = vi.fn();
  const mockOnClick = vi.fn();

  const mockFile: EditorFile = {
    path: '/repo/src/test.ts',
    content: 'const x = 42;',
    originalContent: 'const x = 42;',
    isModified: false,
    extension: 'ts',
    lastModified: new Date(),
    viewerType: 'monaco',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render file name', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('test.ts')).toBeInTheDocument();
    });

    it('should render file icon', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const icon = screen.getByTestId('file-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should extract filename from Windows path', () => {
      const windowsFile = { ...mockFile, path: 'C:\\Users\\test\\file.ts' };
      render(
        <EditorTab
          file={windowsFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('file.ts')).toBeInTheDocument();
    });

    it('should extract filename from Unix path', () => {
      const unixFile = { ...mockFile, path: '/home/user/project/file.ts' };
      render(
        <EditorTab
          file={unixFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('file.ts')).toBeInTheDocument();
    });
  });

  describe('Active state', () => {
    it('should apply active styling when active', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={true}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const tab = screen.getByRole('tab');
      expect(tab.className).toContain('bg-accent');
      expect(tab.className).toContain('border-b-primary');
    });

    it('should not apply active styling when inactive', () => {
      const { container } = render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const tab = container.firstChild as HTMLElement;
      expect(tab.className).not.toContain('border-b-primary');
    });

    it('should set aria-selected to true when active', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={true}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const tab = screen.getByRole('tab');
      expect(tab.getAttribute('aria-selected')).toBe('true');
    });

    it('should set aria-selected to false when inactive', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const tab = screen.getByRole('tab');
      expect(tab.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('Modified indicator', () => {
    it('should show blue dot when file is modified', () => {
      const modifiedFile = { ...mockFile, isModified: true };
      render(
        <EditorTab
          file={modifiedFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const indicator = screen.getByTitle('Modified');
      expect(indicator).toBeInTheDocument();
      expect(indicator.className).toContain('bg-blue-500');
    });

    it('should not show indicator when file is unmodified', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const indicator = screen.queryByTitle('Modified');
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('Click interactions', () => {
    it('should call onClick when tab is clicked', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const tab = screen.getByRole('tab');
      fireEvent.click(tab);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when close button is clicked', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have role="tab"', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByRole('tab')).toBeInTheDocument();
    });

    it('should be keyboard navigable (tabIndex=0)', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={true}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const tab = screen.getByRole('tab');
      expect(tab.getAttribute('tabIndex')).toBe('0');
    });

    it('should have descriptive aria-label on close button', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close test\.ts/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should show keyboard shortcut in close button title', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton.getAttribute('title')).toBe('Close (Ctrl+W)');
    });

    it('should show full path in title tooltip', () => {
      render(
        <EditorTab
          file={mockFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const fileName = screen.getByText('test.ts');
      expect(fileName.getAttribute('title')).toBe('/repo/src/test.ts');
    });
  });

  describe('Truncation', () => {
    it('should truncate long file names', () => {
      const longNameFile = {
        ...mockFile,
        path: '/repo/src/very-long-filename-that-should-be-truncated.ts',
      };
      render(
        <EditorTab
          file={longNameFile}
          isActive={false}
          onClose={mockOnClose}
          onClick={mockOnClick}
        />
      );

      const fileNameEl = screen.getByText('very-long-filename-that-should-be-truncated.ts');
      expect(fileNameEl.className).toContain('truncate');
      expect(fileNameEl.className).toContain('max-w-[120px]');
    });
  });

  describe('Multiple file types', () => {
    const fileTypes = [
      { ext: 'js', viewer: 'monaco' },
      { ext: 'py', viewer: 'monaco' },
      { ext: 'png', viewer: 'image' },
      { ext: 'pdf', viewer: 'pdf' },
      { ext: 'exe', viewer: 'unsupported' },
    ];

    fileTypes.forEach(({ ext, viewer }) => {
      it(`should render tab for ${viewer} viewer (${ext})`, () => {
        const typeFile = {
          ...mockFile,
          path: `/repo/file.${ext}`,
          extension: ext,
          viewerType: viewer as EditorFile['viewerType'],
        };

        render(
          <EditorTab
            file={typeFile}
            isActive={false}
            onClose={mockOnClose}
            onClick={mockOnClick}
          />
        );

        expect(screen.getByText(`file.${ext}`)).toBeInTheDocument();
      });
    });
  });
});
