import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PdfViewer } from '../../../../renderer/components/ide/editor/PdfViewer';

// Mock react-pdf
vi.mock('react-pdf', () => ({
  Document: ({ file, onLoadSuccess, children }: any) => {
    // Simulate successful PDF load after a brief delay
    setTimeout(() => {
      onLoadSuccess?.({ numPages: 5 });
    }, 10);

    return (
      <div data-testid="pdf-document" data-file={file}>
        {children}
      </div>
    );
  },
  Page: ({ pageNumber, className }: any) => (
    <div data-testid={`pdf-page-${pageNumber}`} className={className}>
      Page {pageNumber}
    </div>
  ),
  pdfjs: {
    GlobalWorkerOptions: {},
    version: '3.11.174',
  },
}));

// Mock Button component
vi.mock('../../../../renderer/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, size, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

describe('PdfViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial rendering', () => {
    it('should render PDF document', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      });
    });

    it('should start at page 1', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-page-1')).toBeInTheDocument();
      });
    });

    it('should show loading message initially', () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      expect(screen.getByText(/loading pdf/i)).toBeInTheDocument();
    });

    it('should convert file path to file:// URL', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const doc = screen.getByTestId('pdf-document');
        const fileAttr = doc.getAttribute('data-file');
        expect(fileAttr).toContain('file:///');
        expect(fileAttr).toContain('/repo/document.pdf');
      });
    });

    it('should convert Windows paths correctly', async () => {
      render(<PdfViewer filePath="C:\\Users\\test\\doc.pdf" />);

      await waitFor(() => {
        const doc = screen.getByTestId('pdf-document');
        const fileAttr = doc.getAttribute('data-file');
        expect(fileAttr).toContain('file:///');
        expect(fileAttr).toContain('C:/Users/test/doc.pdf');
      });
    });
  });

  describe('Page navigation controls', () => {
    it('should render Previous button', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /previous page/i });
        expect(prevButton).toBeInTheDocument();
      });
    });

    it('should render Next button', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next page/i });
        expect(nextButton).toBeInTheDocument();
      });
    });

    it('should display current page number', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
      });
    });

    it('should display total page count after loading', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });
    });

    it('should disable Previous button on first page', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /previous page/i });
        expect(prevButton).toBeDisabled();
      });
    });

    it('should enable Next button on first page', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next page/i });
        expect(nextButton).not.toBeDisabled();
      });
    });
  });

  describe('Page navigation', () => {
    it('should navigate to next page when Next is clicked', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
        expect(screen.getByTestId('pdf-page-2')).toBeInTheDocument();
      });
    });

    it('should navigate to previous page when Previous is clicked', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });

      // Go to page 2
      const nextButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
      });

      // Go back to page 1
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      fireEvent.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
        expect(screen.getByTestId('pdf-page-1')).toBeInTheDocument();
      });
    });

    it('should not go below page 1', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });

      const prevButton = screen.getByRole('button', { name: /previous page/i });

      // Try to go to page 0 (should stay at 1)
      fireEvent.click(prevButton);

      expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
    });

    it('should not go beyond last page', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next page/i });

      // Navigate to last page (page 5)
      for (let i = 0; i < 4; i++) {
        fireEvent.click(nextButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/page 5 of 5/i)).toBeInTheDocument();
      });

      // Try to go beyond (should stay at 5)
      fireEvent.click(nextButton);

      expect(screen.getByText(/page 5 of 5/i)).toBeInTheDocument();
    });

    it('should disable Next button on last page', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next page/i });

      // Navigate to last page
      for (let i = 0; i < 4; i++) {
        fireEvent.click(nextButton);
      }

      await waitFor(() => {
        expect(nextButton).toBeDisabled();
      });
    });
  });

  describe('File path display', () => {
    it('should display file path in header', async () => {
      render(<PdfViewer filePath="/repo/documents/report.pdf" />);

      await waitFor(() => {
        expect(screen.getByText('/repo/documents/report.pdf')).toBeInTheDocument();
      });
    });

    it('should truncate long file paths', async () => {
      render(<PdfViewer filePath="/very/long/path/to/document/report.pdf" />);

      await waitFor(() => {
        const pathElement = screen.getByText('/very/long/path/to/document/report.pdf');
        expect(pathElement.className).toContain('truncate');
        expect(pathElement.className).toContain('max-w-md');
      });
    });

    it('should show full path in title tooltip', async () => {
      const longPath = '/very/long/path/to/document/report.pdf';
      render(<PdfViewer filePath={longPath} />);

      await waitFor(() => {
        const pathElement = screen.getByText(longPath);
        expect(pathElement.getAttribute('title')).toBe(longPath);
      });
    });
  });

  describe('Styling', () => {
    it('should have muted background', () => {
      const { container } = render(<PdfViewer filePath="/repo/document.pdf" />);

      const viewer = container.firstChild as HTMLElement;
      expect(viewer.className).toContain('bg-muted/20');
    });

    it('should apply shadow to page', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const page = screen.getByTestId('pdf-page-1');
        expect(page.className).toContain('shadow-lg');
      });
    });

    it('should have flex column layout', () => {
      const { container } = render(<PdfViewer filePath="/repo/document.pdf" />);

      const viewer = container.firstChild as HTMLElement;
      expect(viewer.className).toContain('flex');
      expect(viewer.className).toContain('flex-col');
      expect(viewer.className).toContain('h-full');
    });

    it('should have border on control bar', () => {
      const { container } = render(<PdfViewer filePath="/repo/document.pdf" />);

      const controlBar = container.querySelector('.border-b');
      expect(controlBar).toBeInTheDocument();
    });
  });

  describe('Button styling', () => {
    it('should apply correct size to buttons', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /previous page/i });
        const nextButton = screen.getByRole('button', { name: /next page/i });

        expect(prevButton.getAttribute('data-size')).toBe('sm');
        expect(nextButton.getAttribute('data-size')).toBe('sm');
      });
    });

    it('should apply correct variant to buttons', async () => {
      render(<PdfViewer filePath="/repo/document.pdf" />);

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /previous page/i });
        const nextButton = screen.getByRole('button', { name: /next page/i });

        expect(prevButton.getAttribute('data-variant')).toBe('outline');
        expect(nextButton.getAttribute('data-variant')).toBe('outline');
      });
    });
  });

  describe('Multiple PDFs', () => {
    it('should render different PDFs independently', async () => {
      const { rerender } = render(<PdfViewer filePath="/repo/doc1.pdf" />);

      await waitFor(() => {
        expect(screen.getByText('/repo/doc1.pdf')).toBeInTheDocument();
      });

      rerender(<PdfViewer filePath="/repo/doc2.pdf" />);

      await waitFor(() => {
        expect(screen.getByText('/repo/doc2.pdf')).toBeInTheDocument();
      });
    });

    it('should reset to page 1 when file changes', async () => {
      const { rerender } = render(<PdfViewer filePath="/repo/doc1.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
      });

      // Navigate to page 3
      const nextButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/page 3 of 5/i)).toBeInTheDocument();
      });

      // Switch to different PDF
      rerender(<PdfViewer filePath="/repo/doc2.pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
      });
    });
  });
});
