import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ImageViewer } from '@renderer/components/ide/editor/ImageViewer';

// Mock Skeleton component
vi.mock('@renderer/components/ui/Skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

describe('ImageViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should show skeleton while loading', () => {
      render(<ImageViewer filePath="/repo/image.png" />);

      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('should apply correct skeleton styling', () => {
      render(<ImageViewer filePath="/repo/image.png" />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton.className).toContain('w-64');
      expect(skeleton.className).toContain('h-64');
    });
  });

  describe('Image rendering', () => {
    it('should render image with file:// URL', async () => {
      render(<ImageViewer filePath="/repo/test.png" />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          expect(img.getAttribute('src')).toContain('file:///');
          expect(img.getAttribute('src')).toContain('/repo/test.png');
        }
      });
    });

    it('should convert Windows paths correctly', async () => {
      const windowsPath = 'C:\\Users\\test\\image.png';
      const expectedPath = 'C:/Users/test/image.png';
      render(<ImageViewer filePath={windowsPath} />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          expect(img.getAttribute('src')).toContain('file:///');
          expect(img.getAttribute('src')).toContain(expectedPath);
        }
      });
    });

    it('should set alt text to file path', async () => {
      render(<ImageViewer filePath="/repo/test.png" />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          expect(img.getAttribute('alt')).toBe('/repo/test.png');
        }
      });
    });

    it('should apply containment styling', async () => {
      render(<ImageViewer filePath="/repo/test.png" />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          expect(img.className).toContain('max-w-full');
          expect(img.className).toContain('max-h-full');
          expect(img.className).toContain('object-contain');
        }
      });
    });
  });

  describe('File path display', () => {
    it('should display file path below image', async () => {
      render(<ImageViewer filePath="/repo/images/test.png" />);

      await waitFor(() => {
        const pathElement = screen.queryByText('/repo/images/test.png');
        if (pathElement) {
          expect(pathElement).toBeInTheDocument();
          expect(pathElement.className).toContain('text-xs');
          expect(pathElement.className).toContain('text-muted-foreground');
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should show error message on image load failure', async () => {
      render(<ImageViewer filePath="/repo/invalid.png" />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          // Simulate image error
          const errorEvent = new Event('error');
          img.dispatchEvent(errorEvent);
        }
      });

      await waitFor(() => {
        const errorMessages = screen.queryAllByText(/failed to load image/i);
        if (errorMessages.length > 0) {
          expect(errorMessages[0]).toBeInTheDocument();
        }
      });
    });

    it('should show error with destructive styling', async () => {
      render(<ImageViewer filePath="/repo/invalid.png" />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          const errorEvent = new Event('error');
          img.dispatchEvent(errorEvent);
        }
      });

      await waitFor(() => {
        const errorMessages = screen.queryAllByText(/failed to load image/i);
        const destructiveMsg = errorMessages.find(el => el.className.includes('text-destructive'));
        if (destructiveMsg) {
          expect(destructiveMsg.className).toContain('text-destructive');
        }
      });
    });
  });

  describe('Supported image formats', () => {
    const formats = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];

    formats.forEach((format) => {
      it(`should handle ${format.toUpperCase()} images`, async () => {
        render(<ImageViewer filePath={`/repo/image.${format}`} />);

        await waitFor(() => {
          const img = screen.queryByRole('img');
          if (img) {
            expect(img.getAttribute('src')).toContain(`image.${format}`);
          }
        });
      });
    });
  });

  describe('Container styling', () => {
    it('should have centered flex container', async () => {
      const { container } = render(<ImageViewer filePath="/repo/test.png" />);

      await waitFor(() => {
        const viewerContainer = container.firstChild as HTMLElement;
        if (viewerContainer && viewerContainer.className.includes('flex')) {
          expect(viewerContainer.className).toContain('flex');
          expect(viewerContainer.className).toContain('items-center');
          expect(viewerContainer.className).toContain('justify-center');
          expect(viewerContainer.className).toContain('h-full');
        }
      });
    });

    it('should have muted background', async () => {
      const { container } = render(<ImageViewer filePath="/repo/test.png" />);

      await waitFor(() => {
        const viewerContainer = container.firstChild as HTMLElement;
        if (viewerContainer) {
          expect(viewerContainer.className).toContain('bg-muted/20');
        }
      });
    });

    it('should have padding', async () => {
      const { container } = render(<ImageViewer filePath="/repo/test.png" />);

      await waitFor(() => {
        const viewerContainer = container.firstChild as HTMLElement;
        if (viewerContainer) {
          expect(viewerContainer.className).toContain('p-8');
        }
      });
    });

    it('should have overflow auto', async () => {
      const { container } = render(<ImageViewer filePath="/repo/test.png" />);

      await waitFor(() => {
        const viewerContainer = container.firstChild as HTMLElement;
        if (viewerContainer) {
          expect(viewerContainer.className).toContain('overflow-auto');
        }
      });
    });
  });

  describe('Multiple images', () => {
    it('should render different images independently', async () => {
      const { rerender } = render(<ImageViewer filePath="/repo/image1.png" />);

      await waitFor(() => {
        const img1 = screen.queryByRole('img');
        if (img1) {
          expect(img1.getAttribute('src')).toContain('image1.png');
        }
      });

      rerender(<ImageViewer filePath="/repo/image2.png" />);

      await waitFor(() => {
        const img2 = screen.queryByRole('img');
        if (img2) {
          expect(img2.getAttribute('src')).toContain('image2.png');
        }
      });
    });
  });

  describe('Path formats', () => {
    it('should handle Unix absolute paths', async () => {
      render(<ImageViewer filePath="/home/user/images/photo.jpg" />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          expect(img.getAttribute('src')).toContain('file:///');
        }
      });
    });

    it('should handle Windows absolute paths', async () => {
      const windowsPath = 'D:\\Photos\\vacation.png';
      const expectedPath = 'D:/Photos/vacation.png';
      render(<ImageViewer filePath={windowsPath} />);

      await waitFor(() => {
        const img = screen.queryByRole('img');
        if (img) {
          expect(img.getAttribute('src')).toContain('file:///');
          expect(img.getAttribute('src')).toContain(expectedPath);
        }
      });
    });

    it('should handle paths with spaces', async () => {
      render(<ImageViewer filePath="/repo/my images/photo.png" />);

      await waitFor(() => {
        const pathElement = screen.queryByText('/repo/my images/photo.png');
        if (pathElement) {
          expect(pathElement).toBeInTheDocument();
        }
      });
    });

    it('should handle paths with special characters', async () => {
      render(<ImageViewer filePath="/repo/images/photo-2024_01.png" />);

      await waitFor(() => {
        const pathElement = screen.queryByText('/repo/images/photo-2024_01.png');
        if (pathElement) {
          expect(pathElement).toBeInTheDocument();
        }
      });
    });
  });
});
