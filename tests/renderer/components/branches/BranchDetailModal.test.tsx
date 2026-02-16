import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { BranchDetailModal } from '../../../../src/renderer/components/branches/BranchDetailModal';
import type { BranchInfo } from '../../../../src/main/ipc/channels';

const createMockBranchInfo = (overrides: Partial<BranchInfo> = {}): BranchInfo => ({
  name: 'feature-branch',
  isCurrent: false,
  isProtected: false,
  lastCommit: {
    hash: 'abc123def456',
    message: 'Add new feature',
    author: 'Test User',
    date: new Date('2026-01-15T10:00:00Z'),
  },
  ahead: 5,
  behind: 2,
  commitCount: 25,
  ...overrides,
});

describe('BranchDetailModal', () => {
  const mockOnClose = vi.fn();
  const mockOnDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );
    // Look for the spinner (has animate-spin class)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeDefined();
  });

  it('renders branch info after loading', async () => {
    const branchInfo = createMockBranchInfo({ name: 'feature-branch' });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="feature-branch"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('feature-branch')).toBeDefined();
    });

    expect(screen.getByText('Branch details and statistics')).toBeDefined();
  });

  it('displays commit count', async () => {
    const branchInfo = createMockBranchInfo({ commitCount: 42 });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('42')).toBeDefined();
    });
    expect(screen.getByText('Commits')).toBeDefined();
  });

  it('displays ahead/behind stats', async () => {
    const branchInfo = createMockBranchInfo({ ahead: 10, behind: 3 });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('+10')).toBeDefined();
      expect(screen.getByText('-3')).toBeDefined();
    });
  });

  it('displays last commit info', async () => {
    const branchInfo = createMockBranchInfo({
      lastCommit: {
        hash: 'abc123def456',
        message: 'Fix critical bug',
        author: 'Developer',
        date: new Date('2026-01-15T10:00:00Z'),
      },
    });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('abc123d')).toBeDefined(); // Short hash
      expect(screen.getByText('Fix critical bug')).toBeDefined();
      expect(screen.getByText('Developer')).toBeDefined();
    });
  });

  it('shows Current Branch badge when isCurrent is true', async () => {
    const branchInfo = createMockBranchInfo({ isCurrent: true });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="main"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Current Branch')).toBeDefined();
    });
  });

  it('shows Protected badge when isProtected is true', async () => {
    const branchInfo = createMockBranchInfo({ isProtected: true });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="main"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Protected')).toBeDefined();
    });
  });

  it('disables delete button for current branch', async () => {
    const branchInfo = createMockBranchInfo({ isCurrent: true });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      const deleteBtn = screen.getByText('Delete Branch').closest('button');
      expect(deleteBtn?.disabled).toBe(true);
    });

    expect(screen.getByText('Cannot delete the current branch')).toBeDefined();
  });

  it('disables delete button for protected branch', async () => {
    const branchInfo = createMockBranchInfo({ isProtected: true });
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="main"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      const deleteBtn = screen.getByText('Delete Branch').closest('button');
      expect(deleteBtn?.disabled).toBe(true);
    });

    expect(screen.getByText('Cannot delete protected branches')).toBeDefined();
  });

  it('shows confirmation dialog when delete is clicked', async () => {
    const user = userEvent.setup();
    const branchInfo = createMockBranchInfo();
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Branch')).toBeDefined();
    });

    await user.click(screen.getByText('Delete Branch'));

    expect(screen.getByText(/Delete \u201Cfeature\u201D\?/)).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
    expect(screen.getByText('Confirm Delete')).toBeDefined();
  });

  it('calls delete IPC when confirmed', async () => {
    const user = userEvent.setup();
    const branchInfo = createMockBranchInfo({ name: 'feature-to-delete' });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-branch-info') return Promise.resolve(branchInfo);
      if (channel === 'git:delete-branch') return Promise.resolve();
      return Promise.resolve();
    });

    render(
      <BranchDetailModal
        branchName="feature-to-delete"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Branch')).toBeDefined();
    });

    await user.click(screen.getByText('Delete Branch'));
    await user.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:delete-branch',
        '/repo',
        'feature-to-delete',
        false
      );
    });

    expect(mockOnDeleted).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows error message on delete failure', async () => {
    const user = userEvent.setup();
    const branchInfo = createMockBranchInfo();

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:get-branch-info') return Promise.resolve(branchInfo);
      if (channel === 'git:delete-branch') {
        return Promise.reject(new Error('Branch is not fully merged'));
      }
      return Promise.resolve();
    });

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Branch')).toBeDefined();
    });

    await user.click(screen.getByText('Delete Branch'));
    await user.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(screen.getByText(/not fully merged/)).toBeDefined();
    });
  });

  it('cancels delete confirmation', async () => {
    const user = userEvent.setup();
    const branchInfo = createMockBranchInfo();
    mockInvoke.mockResolvedValue(branchInfo);

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Branch')).toBeDefined();
    });

    await user.click(screen.getByText('Delete Branch'));
    expect(screen.getByText('Confirm Delete')).toBeDefined();

    await user.click(screen.getByText('Cancel'));

    // Should be back to showing Delete Branch button
    expect(screen.getByText('Delete Branch')).toBeDefined();
    expect(screen.queryByText('Confirm Delete')).toBeNull();
  });

  it('renders error state when fetch fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to get branch info'));

    render(
      <BranchDetailModal
        branchName="feature"
        localPath="/repo"
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to get branch info/)).toBeDefined();
    });
  });
});
