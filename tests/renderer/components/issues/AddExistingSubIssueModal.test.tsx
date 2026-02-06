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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { AddExistingSubIssueModal } from '../../../../src/renderer/components/issues/AddExistingSubIssueModal';

describe('AddExistingSubIssueModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAdded = vi.fn();

  const mockIssues = [
    { number: 1, title: 'Bug report', state: 'open', url: 'https://github.com/org/repo/issues/1' },
    {
      number: 2,
      title: 'Feature request',
      state: 'open',
      url: 'https://github.com/org/repo/issues/2',
    },
    {
      number: 3,
      title: 'Closed issue',
      state: 'closed',
      url: 'https://github.com/org/repo/issues/3',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-issues') return mockIssues;
      if (channel === 'github:get-issue') return { id: '12345' };
      if (channel === 'github:add-existing-sub-issue') return undefined;
      return undefined;
    });
  });

  it('renders dialog with title when open', async () => {
    render(
      <AddExistingSubIssueModal
        open={true}
        owner="org"
        repo="repo"
        parentIssueNumber={10}
        onClose={mockOnClose}
        onAdded={mockOnAdded}
      />
    );
    expect(screen.getByText('Add Existing Issue')).toBeDefined();
    expect(screen.getByText(/Link an existing issue as a sub-issue of #10/)).toBeDefined();
  });

  it('fetches and displays issues on open', async () => {
    render(
      <AddExistingSubIssueModal
        open={true}
        owner="org"
        repo="repo"
        parentIssueNumber={10}
        onClose={mockOnClose}
        onAdded={mockOnAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bug report')).toBeDefined();
      expect(screen.getByText('Feature request')).toBeDefined();
    });
    expect(mockInvoke).toHaveBeenCalledWith('github:list-issues', 'org', 'repo', 'open');
  });

  it('filters issues by search query', async () => {
    const user = userEvent.setup();
    render(
      <AddExistingSubIssueModal
        open={true}
        owner="org"
        repo="repo"
        parentIssueNumber={10}
        onClose={mockOnClose}
        onAdded={mockOnAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bug report')).toBeDefined();
    });

    await user.type(screen.getByPlaceholderText('Search issues by title or number...'), 'Feature');

    await waitFor(() => {
      expect(screen.queryByText('Bug report')).toBeNull();
      expect(screen.getByText('Feature request')).toBeDefined();
    });
  });

  it('selects an issue and calls add-existing-sub-issue', async () => {
    const user = userEvent.setup();
    render(
      <AddExistingSubIssueModal
        open={true}
        owner="org"
        repo="repo"
        parentIssueNumber={10}
        onClose={mockOnClose}
        onAdded={mockOnAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bug report')).toBeDefined();
    });

    await user.click(screen.getByText('Bug report'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github:get-issue', 'org', 'repo', 1);
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:add-existing-sub-issue',
        'org',
        'repo',
        10,
        12345
      );
      expect(mockOnAdded).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows error when fetch fails', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-issues') throw new Error('Network error');
      return undefined;
    });

    render(
      <AddExistingSubIssueModal
        open={true}
        owner="org"
        repo="repo"
        parentIssueNumber={10}
        onClose={mockOnClose}
        onAdded={mockOnAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('excludes parent issue from results', async () => {
    const issuesWithParent = [
      ...mockIssues,
      {
        number: 10,
        title: 'Parent issue',
        state: 'open',
        url: 'https://github.com/org/repo/issues/10',
      },
    ];
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-issues') return issuesWithParent;
      return undefined;
    });

    render(
      <AddExistingSubIssueModal
        open={true}
        owner="org"
        repo="repo"
        parentIssueNumber={10}
        onClose={mockOnClose}
        onAdded={mockOnAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bug report')).toBeDefined();
    });
    expect(screen.queryByText('Parent issue')).toBeNull();
  });
});
