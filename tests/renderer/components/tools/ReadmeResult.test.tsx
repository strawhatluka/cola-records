import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { ReadmeResult } from '../../../../src/renderer/components/tools/ReadmeResult';

describe('ReadmeResult', () => {
  const defaultProps = {
    workingDirectory: '/test/project',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<ReadmeResult {...defaultProps} />);
    expect(screen.getByText(/analyzing/i)).toBeDefined();
  });

  it('should display generated README content', async () => {
    mockInvoke.mockResolvedValue({
      content: '# Updated README\nNew content here',
      hasChanges: true,
      currentReadme: '# Old README',
    });

    render(<ReadmeResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Updated README/)).toBeDefined();
    });
  });

  it('should show "no changes needed" when hasChanges is false', async () => {
    mockInvoke.mockResolvedValue({ content: '', hasChanges: false, currentReadme: '' });

    render(<ReadmeResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no readme changes/i)).toBeDefined();
    });
  });

  it('should show error on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    render(<ReadmeResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeDefined();
    });
  });

  it('should apply readme update on Apply click', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-readme-update') {
        return Promise.resolve({
          content: '# New README',
          hasChanges: true,
          currentReadme: '# Old',
        });
      }
      return Promise.resolve();
    });

    render(<ReadmeResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Apply')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:apply-readme',
        '/test/project',
        '# New README'
      );
    });
  });

  it('should show "Applied" after successful apply', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-readme-update') {
        return Promise.resolve({ content: 'Updated', hasChanges: true, currentReadme: '' });
      }
      return Promise.resolve();
    });

    render(<ReadmeResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Apply')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.getByText(/Applied to README/)).toBeDefined();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    mockInvoke.mockResolvedValue({ content: '', hasChanges: false, currentReadme: '' });

    render(<ReadmeResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Close')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
