import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnsupportedViewer } from '../../../../renderer/components/ide/editor/UnsupportedViewer';

// Mock IPC
vi.mock('../../../../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock Button component
vi.mock('../../../../renderer/components/ui/Button', () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
}));

describe('UnsupportedViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display file name', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      expect(screen.getByText('file.exe')).toBeInTheDocument();
    });

    it('should display file extension in message', () => {
      render(<UnsupportedViewer filePath="/repo/file.bin" extension="bin" />);

      expect(screen.getByText(/cannot preview \.bin files/i)).toBeInTheDocument();
    });

    it('should display full file path', () => {
      render(<UnsupportedViewer filePath="/repo/binaries/app.exe" extension="exe" />);

      expect(screen.getByText('/repo/binaries/app.exe')).toBeInTheDocument();
    });

    it('should extract filename from Windows path', () => {
      render(<UnsupportedViewer filePath="C:\\Users\\test\\file.dll" extension="dll" />);

      expect(screen.getByText('file.dll')).toBeInTheDocument();
    });

    it('should extract filename from Unix path', () => {
      render(<UnsupportedViewer filePath="/home/user/binaries/app.bin" extension="bin" />);

      expect(screen.getByText('app.bin')).toBeInTheDocument();
    });

    it('should show file icon', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      // FileQuestion icon should be rendered (from lucide-react)
      const icon = document.querySelector('[data-testid="lucide-file-question"]') ||
                   document.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    it('should render "Open in Default Application" button', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      expect(screen.getByRole('button', { name: /open in default application/i })).toBeInTheDocument();
    });

    it('should render "Reveal in Explorer" button', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      expect(screen.getByRole('button', { name: /reveal in explorer/i })).toBeInTheDocument();
    });

    it('should apply correct variant to primary button', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const openButton = screen.getByRole('button', { name: /open in default application/i });
      expect(openButton.getAttribute('data-variant')).toBe('default');
    });

    it('should apply correct variant to secondary button', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const revealButton = screen.getByRole('button', { name: /reveal in explorer/i });
      expect(revealButton.getAttribute('data-variant')).toBe('outline');
    });
  });

  describe('Open in Default Application', () => {
    it('should call IPC with correct command on click', async () => {
      const { ipc } = require('../../../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(undefined);

      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const openButton = screen.getByRole('button', { name: /open in default application/i });
      fireEvent.click(openButton);

      await waitFor(() => {
        expect(ipc.invoke).toHaveBeenCalledWith('shell:execute', 'start "" "/repo/file.exe"');
      });
    });

    it('should handle Windows paths correctly', async () => {
      const { ipc } = require('../../../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(undefined);

      render(<UnsupportedViewer filePath="C:\\Users\\test\\file.dll" extension="dll" />);

      const openButton = screen.getByRole('button', { name: /open in default application/i });
      fireEvent.click(openButton);

      await waitFor(() => {
        expect(ipc.invoke).toHaveBeenCalledWith(
          'shell:execute',
          'start "" "C:\\Users\\test\\file.dll"'
        );
      });
    });

    it('should show error toast on failure', async () => {
      const { ipc } = require('../../../../renderer/ipc/client');
      const { toast } = require('sonner');
      ipc.invoke.mockRejectedValue(new Error('Failed to open'));

      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const openButton = screen.getByRole('button', { name: /open in default application/i });
      fireEvent.click(openButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to open file in default application');
      });
    });
  });

  describe('Reveal in Explorer', () => {
    it('should call IPC with correct path on click', async () => {
      const { ipc } = require('../../../../renderer/ipc/client');
      ipc.invoke.mockResolvedValue(undefined);

      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const revealButton = screen.getByRole('button', { name: /reveal in explorer/i });
      fireEvent.click(revealButton);

      await waitFor(() => {
        expect(ipc.invoke).toHaveBeenCalledWith('fs:reveal-in-explorer', '/repo/file.exe');
      });
    });

    it('should show error toast on failure', async () => {
      const { ipc } = require('../../../../renderer/ipc/client');
      const { toast } = require('sonner');
      ipc.invoke.mockRejectedValue(new Error('Failed to reveal'));

      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const revealButton = screen.getByRole('button', { name: /reveal in explorer/i });
      fireEvent.click(revealButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to reveal file in explorer');
      });
    });
  });

  describe('Info message', () => {
    it('should display helpful information', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      expect(screen.getByText(/this file type is not supported for preview/i)).toBeInTheDocument();
    });

    it('should explain available actions', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const infoText = screen.getByText(/you can open it with your system's default application/i);
      expect(infoText).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have centered layout', () => {
      const { container } = render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const viewer = container.firstChild as HTMLElement;
      expect(viewer.className).toContain('flex');
      expect(viewer.className).toContain('flex-col');
      expect(viewer.className).toContain('items-center');
      expect(viewer.className).toContain('justify-center');
    });

    it('should have muted background', () => {
      const { container } = render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const viewer = container.firstChild as HTMLElement;
      expect(viewer.className).toContain('bg-muted/20');
    });

    it('should have appropriate spacing', () => {
      const { container } = render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const viewer = container.firstChild as HTMLElement;
      expect(viewer.className).toContain('gap-6');
      expect(viewer.className).toContain('p-8');
    });

    it('should center text', () => {
      const { container } = render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const viewer = container.firstChild as HTMLElement;
      expect(viewer.className).toContain('text-center');
    });

    it('should apply muted styling to file path', () => {
      render(<UnsupportedViewer filePath="/repo/binaries/app.exe" extension="exe" />);

      const pathElement = screen.getByText('/repo/binaries/app.exe');
      expect(pathElement.className).toContain('text-xs');
      expect(pathElement.className).toContain('text-muted-foreground');
    });
  });

  describe('Multiple file types', () => {
    const unsupportedTypes = [
      { ext: 'exe', name: 'executable' },
      { ext: 'dll', name: 'library' },
      { ext: 'bin', name: 'binary' },
      { ext: 'zip', name: 'archive' },
      { ext: 'dmg', name: 'disk image' },
      { ext: 'iso', name: 'ISO image' },
      { ext: 'db', name: 'database' },
    ];

    unsupportedTypes.forEach(({ ext, name }) => {
      it(`should handle ${name} files (.${ext})`, () => {
        render(<UnsupportedViewer filePath={`/repo/file.${ext}`} extension={ext} />);

        expect(screen.getByText(`file.${ext}`)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`\\.${ext}`, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('Responsive layout', () => {
    it('should have responsive button container', () => {
      const { container } = render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const buttonContainer = container.querySelector('.flex.flex-col.sm\\:flex-row');
      expect(buttonContainer).toBeInTheDocument();
    });

    it('should have max-width on info message', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const infoElement = screen.getByText(/this file type is not supported/i);
      expect(infoElement.className).toContain('max-w-md');
    });
  });

  describe('Icon rendering', () => {
    it('should display large file icon', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      const icon = document.querySelector('[class*="h-24"]');
      expect(icon).toBeInTheDocument();
    });

    it('should display external link icon on button', () => {
      render(<UnsupportedViewer filePath="/repo/file.exe" extension="exe" />);

      // ExternalLink icon should be present
      const externalLinkIcon = document.querySelector('[class*="h-4 w-4 mr-2"]');
      expect(externalLinkIcon).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle file without extension', () => {
      render(<UnsupportedViewer filePath="/repo/file" extension="" />);

      expect(screen.getByText('file')).toBeInTheDocument();
      expect(screen.getByText(/cannot preview \. files/i)).toBeInTheDocument();
    });

    it('should handle paths with special characters', () => {
      render(<UnsupportedViewer filePath="/repo/files (new)/app.exe" extension="exe" />);

      expect(screen.getByText('app.exe')).toBeInTheDocument();
      expect(screen.getByText('/repo/files (new)/app.exe')).toBeInTheDocument();
    });

    it('should handle very long file names', () => {
      const longName = 'very-long-filename-that-exceeds-normal-length-limits-for-testing-purposes.exe';
      render(<UnsupportedViewer filePath={`/repo/${longName}`} extension="exe" />);

      expect(screen.getByText(longName)).toBeInTheDocument();
    });
  });
});
