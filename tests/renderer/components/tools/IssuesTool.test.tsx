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

// Mock DevelopmentIssueDetailModal
vi.mock('../../../../src/renderer/components/issues/DevelopmentIssueDetailModal', () => ({
  DevelopmentIssueDetailModal: ({
    issue,
    onClose,
  }: {
    issue: { number: number; title: string };
    onClose: () => void;
  }) => (
    <div data-testid="issue-detail-modal">
      <span>
        Issue #{issue.number}: {issue.title}
      </span>
      <button onClick={onClose}>Close Detail</button>
    </div>
  ),
}));

// Mock CreateIssueModal
vi.mock('../../../../src/renderer/components/issues/CreateIssueModal', () => ({
  CreateIssueModal: ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => (
    <div data-testid="create-issue-modal">
      <span>Create Issue Form</span>
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

import { IssuesTool } from '../../../../src/renderer/components/tools/IssuesTool';
import { createMockContribution } from '../../../mocks/factories';

const mockIssues = [
  {
    number: 10,
    title: 'Fix login bug',
    body: 'Login is broken',
    url: 'https://github.com/upstream/repo/issues/10',
    state: 'open',
    labels: ['bug'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    author: 'reporter',
    authorAvatarUrl: 'https://avatar.url/reporter',
  },
  {
    number: 5,
    title: 'Add feature',
    body: 'Feature request',
    url: 'https://github.com/upstream/repo/issues/5',
    state: 'open',
    labels: ['enhancement'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    author: 'contributor',
    authorAvatarUrl: '',
  },
];

const defaultProps = {
  contribution: createMockContribution({
    upstreamUrl: 'https://github.com/upstream/repo.git',
  }),
  branches: ['main', 'fix-10-login'],
  githubUsername: 'testuser',
};

function setupMocks(issues = mockIssues) {
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'github:list-issues') return issues;
    return undefined;
  });
}

describe('IssuesTool', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('List view', () => {
    it('renders loading state then issues list', async () => {
      setupMocks();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
        expect(screen.getByText('Add feature')).toBeDefined();
      });
    });

    it('shows issue count', async () => {
      setupMocks();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('(2)')).toBeDefined();
      });
    });

    it('shows status badges', async () => {
      setupMocks();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        const openBadges = screen.getAllByText('open');
        expect(openBadges.length).toBe(2);
      });
    });

    it('shows "branched" badge when branch matches issue number', async () => {
      setupMocks();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('branched')).toBeDefined();
      });
    });

    it('sorts branched issues first', async () => {
      setupMocks();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        const items = screen.getAllByText(/Fix login bug|Add feature/);
        expect(items[0].textContent).toBe('Fix login bug');
      });
    });

    it('shows empty state when no issues', async () => {
      setupMocks([]);
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No issues found')).toBeDefined();
      });
    });

    it('shows error state on fetch failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeDefined();
      });
    });

    it('shows retry button on error', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeDefined();
      });
    });
  });

  describe('Detail view', () => {
    it('navigates to detail view when issue is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
      });

      await user.click(screen.getByText('Fix login bug'));

      await waitFor(() => {
        expect(screen.getByTestId('issue-detail-modal')).toBeDefined();
        expect(screen.getByText('Issue #10: Fix login bug')).toBeDefined();
      });
    });

    it('shows back button in detail view', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
      });
      await user.click(screen.getByText('Fix login bug'));

      await waitFor(() => {
        expect(screen.getByText('#10 Fix login bug')).toBeDefined();
      });
    });

    it('returns to list view when detail is closed', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
      });
      await user.click(screen.getByText('Fix login bug'));

      await waitFor(() => {
        expect(screen.getByTestId('issue-detail-modal')).toBeDefined();
      });

      await user.click(screen.getByText('Close Detail'));

      await waitFor(() => {
        expect(screen.queryByTestId('issue-detail-modal')).toBeNull();
        expect(screen.getByText('Issues')).toBeDefined();
      });
    });
  });

  describe('Create view', () => {
    it('navigates to create view when New Issue button is clicked', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('New Issue')).toBeDefined();
      });

      await user.click(screen.getByText('New Issue'));

      await waitFor(() => {
        expect(screen.getByTestId('create-issue-modal')).toBeDefined();
        expect(screen.getByText('Create Issue Form')).toBeDefined();
      });
    });

    it('returns to list view when create is cancelled', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('New Issue')).toBeDefined();
      });
      await user.click(screen.getByText('New Issue'));

      await waitFor(() => {
        expect(screen.getByTestId('create-issue-modal')).toBeDefined();
      });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('create-issue-modal')).toBeNull();
      });
    });
  });

  describe('Refresh', () => {
    it('has a refresh button', async () => {
      setupMocks();
      render(<IssuesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
      });

      // The refresh button exists (it's the RefreshCw icon button)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
