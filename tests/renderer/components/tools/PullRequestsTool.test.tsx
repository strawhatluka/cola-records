import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

// Mock PullRequestDetailModal
vi.mock('../../../../src/renderer/components/pull-requests/PullRequestDetailModal', () => ({
  PullRequestDetailModal: ({
    pr,
    onClose,
  }: {
    pr: { number: number; title: string };
    onClose: () => void;
  }) => (
    <div data-testid="pr-detail-modal">
      <span>
        PR #{pr.number}: {pr.title}
      </span>
      <button onClick={onClose}>Close Detail</button>
    </div>
  ),
}));

// Mock CreatePullRequestModal
vi.mock('../../../../src/renderer/components/pull-requests/CreatePullRequestModal', () => ({
  CreatePullRequestModal: ({
    onClose,
    onCreated,
  }: {
    onClose: () => void;
    onCreated: () => void;
  }) => (
    <div data-testid="create-pr-modal">
      <span>Create PR Form</span>
      <button onClick={onClose}>Cancel</button>
      <button
        onClick={() => {
          onCreated();
          onClose();
        }}
      >
        Submit
      </button>
    </div>
  ),
}));

import { PullRequestsTool } from '../../../../src/renderer/components/tools/PullRequestsTool';
import { createMockContribution } from '../../../mocks/factories';

const mockPRs = [
  {
    number: 1,
    title: 'Add feature',
    url: 'https://github.com/upstream/repo/pull/1',
    state: 'open',
    merged: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    author: 'testuser',
    headBranch: 'feature-branch',
  },
  {
    number: 2,
    title: 'Bug fix',
    url: 'https://github.com/upstream/repo/pull/2',
    state: 'closed',
    merged: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    author: 'other-user',
    headBranch: 'fix-branch',
  },
];

const defaultProps = {
  contribution: createMockContribution({
    upstreamUrl: 'https://github.com/upstream/repo.git',
  }),
  branches: ['main', 'feature-branch'],
  remotes: [
    {
      name: 'origin',
      fetchUrl: 'https://github.com/user/repo.git',
      pushUrl: 'https://github.com/user/repo.git',
    },
  ],
  githubUsername: 'testuser',
};

function setupMocks(prs = mockPRs) {
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'github:list-pull-requests') return prs;
    return undefined;
  });
}

describe('PullRequestsTool', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('List view', () => {
    it('renders loading state then PR list', async () => {
      setupMocks();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add feature')).toBeDefined();
        expect(screen.getByText('Bug fix')).toBeDefined();
      });
    });

    it('shows PR count', async () => {
      setupMocks();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('(2)')).toBeDefined();
      });
    });

    it('shows status badges', async () => {
      setupMocks();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('open')).toBeDefined();
        expect(screen.getByText('merged')).toBeDefined();
      });
    });

    it('shows "submitted" badge for user PRs', async () => {
      setupMocks();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('submitted')).toBeDefined();
      });
    });

    it('sorts user PRs first', async () => {
      setupMocks();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        const items = screen.getAllByText(/Add feature|Bug fix/);
        expect(items[0].textContent).toBe('Add feature');
      });
    });

    it('shows empty state when no PRs', async () => {
      setupMocks([]);
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No pull requests found')).toBeDefined();
      });
    });

    it('shows error state on fetch failure', async () => {
      mockInvoke.mockRejectedValue(new Error('API error'));
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('API error')).toBeDefined();
      });
    });

    it('shows retry button on error', async () => {
      mockInvoke.mockRejectedValue(new Error('API error'));
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeDefined();
      });
    });

    it('shows head branch and author', async () => {
      setupMocks();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/feature-branch/)).toBeDefined();
        expect(screen.getByText(/other-user/)).toBeDefined();
      });
    });
  });

  describe('Detail view', () => {
    it('navigates to detail view when PR is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add feature')).toBeDefined();
      });

      await user.click(screen.getByText('Add feature'));

      await waitFor(() => {
        expect(screen.getByTestId('pr-detail-modal')).toBeDefined();
        expect(screen.getByText('PR #1: Add feature')).toBeDefined();
      });
    });

    it('shows back button with PR title in detail view', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add feature')).toBeDefined();
      });
      await user.click(screen.getByText('Add feature'));

      await waitFor(() => {
        expect(screen.getByText('#1 Add feature')).toBeDefined();
      });
    });

    it('returns to list view when detail is closed', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add feature')).toBeDefined();
      });
      await user.click(screen.getByText('Add feature'));

      await waitFor(() => {
        expect(screen.getByTestId('pr-detail-modal')).toBeDefined();
      });

      await user.click(screen.getByText('Close Detail'));

      await waitFor(() => {
        expect(screen.queryByTestId('pr-detail-modal')).toBeNull();
        expect(screen.getByText('Pull Requests')).toBeDefined();
      });
    });
  });

  describe('Create view', () => {
    it('navigates to create view when New PR button is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('New PR')).toBeDefined();
      });

      await user.click(screen.getByText('New PR'));

      await waitFor(() => {
        expect(screen.getByTestId('create-pr-modal')).toBeDefined();
        expect(screen.getByText('Create PR Form')).toBeDefined();
      });
    });

    it('returns to list view when create is cancelled', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('New PR')).toBeDefined();
      });
      await user.click(screen.getByText('New PR'));

      await waitFor(() => {
        expect(screen.getByTestId('create-pr-modal')).toBeDefined();
      });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('create-pr-modal')).toBeNull();
      });
    });

    it('shows "New Pull Request" header in create view', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<PullRequestsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('New PR')).toBeDefined();
      });
      await user.click(screen.getByText('New PR'));

      await waitFor(() => {
        expect(screen.getByText('New Pull Request')).toBeDefined();
      });
    });
  });
});
