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

import { DocsResult } from '../../../../src/renderer/components/tools/DocsResult';

describe('DocsResult', () => {
  const defaultProps = {
    workingDirectory: '/test/project',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<DocsResult {...defaultProps} />);
    expect(screen.getByText(/analyzing/i)).toBeDefined();
  });

  it('should display documentation updates', async () => {
    mockInvoke.mockResolvedValue({
      updates: [
        { path: 'docs/api.md', content: '# API', action: 'create' },
        { path: 'docs/guide.md', content: '# Guide', action: 'update' },
      ],
      hasChanges: true,
    });

    render(<DocsResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('docs/api.md')).toBeDefined();
      expect(screen.getByText('docs/guide.md')).toBeDefined();
    });
  });

  it('should show NEW/UPD badges for create/update actions', async () => {
    mockInvoke.mockResolvedValue({
      updates: [
        { path: 'docs/new.md', content: '', action: 'create' },
        { path: 'docs/existing.md', content: '', action: 'update' },
      ],
      hasChanges: true,
    });

    render(<DocsResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('NEW')).toBeDefined();
      expect(screen.getByText('UPD')).toBeDefined();
    });
  });

  it('should show "no changes needed" when hasChanges is false', async () => {
    mockInvoke.mockResolvedValue({ updates: [], hasChanges: false });

    render(<DocsResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no documentation changes/i)).toBeDefined();
    });
  });

  it('should show error on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to generate'));

    render(<DocsResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to generate/)).toBeDefined();
    });
  });

  it('should apply single file update', async () => {
    const update = { path: 'docs/api.md', content: '# API Docs', action: 'create' as const };
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-docs-update') {
        return Promise.resolve({ updates: [update], hasChanges: true });
      }
      return Promise.resolve();
    });

    render(<DocsResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('docs/api.md')).toBeDefined();
    });

    // Click the per-file Apply button
    const applyBtns = screen.getAllByText('Apply');
    await userEvent.click(applyBtns[0]);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:apply-docs-update',
        '/test/project',
        update
      );
    });
  });

  it('should apply all updates with Apply All button', async () => {
    const updates = [
      { path: 'docs/a.md', content: 'A', action: 'create' as const },
      { path: 'docs/b.md', content: 'B', action: 'update' as const },
    ];
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-docs-update') {
        return Promise.resolve({ updates, hasChanges: true });
      }
      return Promise.resolve();
    });

    render(<DocsResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Apply All/)).toBeDefined();
    });

    await userEvent.click(screen.getByText(/Apply All/));

    await waitFor(() => {
      expect(screen.getByText(/All updates applied/)).toBeDefined();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    mockInvoke.mockResolvedValue({ updates: [], hasChanges: false });

    render(<DocsResult {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Close')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
