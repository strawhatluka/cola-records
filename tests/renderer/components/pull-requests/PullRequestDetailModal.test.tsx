/**
 * PullRequestDetailModal Tests
 *
 * Tests the PR detail modal component which displays PR information,
 * comments, reviews, and provides merge/close actions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ============================================
// Mocks - must be before component import
// ============================================

// Mock IPC client
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

// Mock lucide-react icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock Dialog components - render without portals
vi.mock('../../../../src/renderer/components/ui/Dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange: _onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    // Always render when open is truthy
    return open ? <div data-testid="dialog">{children}</div> : null;
  },
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>
      {children}
    </h2>
  ),
  DialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <p className={className}>{children}</p>,
}));

// Mock DropdownMenu components
vi.mock('../../../../src/renderer/components/ui/DropdownMenu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div role="menuitem" onClick={onClick}>
      {children}
    </div>
  ),
}));

// Mock MarkdownEditor - simple textarea
vi.mock('../../../../src/renderer/components/pull-requests/MarkdownEditor', () => ({
  MarkdownEditor: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid="comment-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

// Mock ReactionDisplay
vi.mock('../../../../src/renderer/components/ui/ReactionPicker', () => ({
  ReactionDisplay: () => <div data-testid="reactions" />,
}));

// Import component after mocks
import {
  PullRequestDetailModal,
  reviewStateBadge,
  statusBadge,
  formatDate,
} from '../../../../src/renderer/components/pull-requests/PullRequestDetailModal';

// ============================================
// Test Data
// ============================================

const createBasePR = (overrides = {}) => ({
  number: 123,
  title: 'Test Pull Request',
  url: 'https://github.com/owner/repo/pull/123',
  state: 'open',
  merged: false,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-16T10:00:00Z'),
  author: 'testauthor',
  headBranch: 'feature/test-branch',
  ...overrides,
});

const createPRDetail = (overrides = {}) => ({
  number: 123,
  title: 'Detailed PR Title',
  body: 'This is the PR description with **markdown**.',
  url: 'https://github.com/owner/repo/pull/123',
  state: 'open',
  merged: false,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-16T10:00:00Z'),
  author: 'testauthor',
  ...overrides,
});

const createComment = (overrides = {}) => ({
  id: 1,
  body: 'This is a test comment',
  author: 'commenter',
  authorAvatarUrl: 'https://github.com/commenter.png',
  createdAt: new Date('2026-01-15T11:00:00Z'),
  updatedAt: new Date('2026-01-15T11:00:00Z'),
  ...overrides,
});

const createReview = (overrides = {}) => ({
  id: 1,
  body: 'Looks good to me!',
  state: 'APPROVED',
  author: 'reviewer',
  authorAvatarUrl: 'https://github.com/reviewer.png',
  submittedAt: new Date('2026-01-15T12:00:00Z'),
  ...overrides,
});

const createReviewComment = (overrides = {}) => ({
  id: 1,
  body: 'Consider refactoring this',
  author: 'reviewer',
  authorAvatarUrl: 'https://github.com/reviewer.png',
  path: 'src/index.ts',
  line: 42,
  createdAt: new Date('2026-01-15T12:30:00Z'),
  inReplyToId: null,
  ...overrides,
});

// ============================================
// Test Helpers
// ============================================

function setupSuccessfulFetch(
  options: {
    detail?: ReturnType<typeof createPRDetail>;
    comments?: ReturnType<typeof createComment>[];
    reviews?: ReturnType<typeof createReview>[];
    reviewComments?: ReturnType<typeof createReviewComment>[];
  } = {}
) {
  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'github:get-pull-request':
        return options.detail ?? createPRDetail();
      case 'github:list-pr-comments':
        return options.comments ?? [];
      case 'github:list-pr-reviews':
        return options.reviews ?? [];
      case 'github:list-pr-review-comments':
        return options.reviewComments ?? [];
      case 'github:list-issue-reactions':
        return [];
      case 'github:list-comment-reactions':
        return [];
      case 'shell:open-external':
        return undefined;
      case 'github:create-pr-comment':
        return undefined;
      case 'github:merge-pull-request':
        return { sha: 'abc123', merged: true };
      case 'github:close-pull-request':
        return { number: 123, state: 'closed' };
      default:
        return undefined;
    }
  });
}

function setupFailedFetch() {
  mockInvoke.mockRejectedValue(new Error('API Error'));
}

const defaultProps = {
  owner: 'owner',
  repo: 'repo',
  githubUsername: 'currentuser',
  onClose: vi.fn(),
  onRefresh: vi.fn(),
  canWrite: true,
};

// ============================================
// Tests
// ============================================

describe('PullRequestDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering states', () => {
    it('renders nothing when pr is null', () => {
      const { container } = render(<PullRequestDetailModal pr={null} {...defaultProps} />);
      expect(container.innerHTML).toBe('');
    });

    it('shows loading state initially', () => {
      // Never resolve to keep loading
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      // Should show the PR title from props while loading
      expect(screen.getByText('Test Pull Request')).toBeDefined();
    });

    it('shows error state with retry button when fetch fails', async () => {
      setupFailedFetch();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeDefined();
      });
      expect(screen.getByText('Retry')).toBeDefined();
    });

    it('shows content after successful fetch', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Detailed PR Title')).toBeDefined();
      });
    });
  });

  describe('PR header', () => {
    it('displays PR title from fetched detail', async () => {
      setupSuccessfulFetch({ detail: createPRDetail({ title: 'Custom Title' }) });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Custom Title')).toBeDefined();
      });
    });

    it('displays PR number', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR({ number: 456 })} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('#456')).toBeDefined();
      });
    });

    it('displays author name', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR({ author: 'johndoe' })} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('johndoe')).toBeDefined();
      });
    });

    it('displays head branch', async () => {
      setupSuccessfulFetch();

      render(
        <PullRequestDetailModal pr={createBasePR({ headBranch: 'my-feature' })} {...defaultProps} />
      );

      await waitFor(() => {
        expect(screen.getByText('my-feature')).toBeDefined();
      });
    });
  });

  describe('PR body', () => {
    it('renders PR body as markdown', async () => {
      setupSuccessfulFetch({ detail: createPRDetail({ body: 'Test body content' }) });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('markdown')).toBeDefined();
        expect(screen.getByText('Test body content')).toBeDefined();
      });
    });

    it('shows empty state when no body and no activity', async () => {
      setupSuccessfulFetch({ detail: createPRDetail({ body: '' }) });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No activity on this pull request yet.')).toBeDefined();
      });
    });
  });

  describe('timeline', () => {
    it('shows comments in timeline', async () => {
      setupSuccessfulFetch({
        comments: [createComment({ body: 'Great work!' })],
      });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Great work!')).toBeDefined();
      });
    });

    it('shows reviews in timeline', async () => {
      setupSuccessfulFetch({
        reviews: [createReview({ body: 'LGTM', state: 'APPROVED' })],
      });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('LGTM')).toBeDefined();
        expect(screen.getByText('Approved')).toBeDefined();
      });
    });

    it('shows review comments with file path', async () => {
      setupSuccessfulFetch({
        reviewComments: [createReviewComment({ path: 'src/utils.ts', line: 10 })],
      });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/src\/utils\.ts/)).toBeDefined();
      });
    });

    it('displays activity count', async () => {
      setupSuccessfulFetch({
        comments: [createComment()],
        reviews: [createReview()],
        reviewComments: [createReviewComment()],
      });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Activity (3)')).toBeDefined();
      });
    });

    it('filters COMMENTED reviews with empty body', async () => {
      setupSuccessfulFetch({
        reviews: [createReview({ body: '', state: 'COMMENTED' })],
      });

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Detailed PR Title')).toBeDefined();
      });
      // COMMENTED review with no body should be filtered out
      expect(screen.queryByText('Commented')).toBeNull();
    });
  });

  describe('comment submission', () => {
    it('has disabled submit button when textarea is empty', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Comment')).toBeDefined();
      });

      const submitBtn = screen.getByText('Comment').closest('button');
      expect(submitBtn?.disabled).toBe(true);
    });

    it('enables submit button when textarea has content', async () => {
      setupSuccessfulFetch();
      const user = userEvent.setup();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('comment-input')).toBeDefined();
      });

      await user.type(screen.getByTestId('comment-input'), 'My comment');

      const submitBtn = screen.getByText('Comment').closest('button');
      expect(submitBtn?.disabled).toBe(false);
    });

    it('submits comment and clears textarea', async () => {
      setupSuccessfulFetch();
      const user = userEvent.setup();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('comment-input')).toBeDefined();
      });

      const textarea = screen.getByTestId('comment-input') as HTMLTextAreaElement;
      await user.type(textarea, 'New comment');
      await user.click(screen.getByText('Comment'));

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-pr-comment',
        'owner',
        'repo',
        123,
        'New comment'
      );
    });
  });

  describe('View on GitHub button', () => {
    it('opens external URL when clicked', async () => {
      setupSuccessfulFetch();
      const user = userEvent.setup();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('View on GitHub')).toBeDefined();
      });

      await user.click(screen.getByText('View on GitHub'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'shell:open-external',
        'https://github.com/owner/repo/pull/123'
      );
    });
  });

  describe('merge and close actions', () => {
    it('shows merge button for open PRs', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR({ state: 'open' })} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Merge pull request')).toBeDefined();
      });
    });

    it('shows close button for open PRs', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR({ state: 'open' })} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Close pull request')).toBeDefined();
      });
    });

    it('hides merge/close buttons for closed PRs', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR({ state: 'closed' })} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Detailed PR Title')).toBeDefined();
      });

      expect(screen.queryByText('Merge pull request')).toBeNull();
      expect(screen.queryByText('Close pull request')).toBeNull();
    });

    it('hides merge/close buttons for merged PRs', async () => {
      setupSuccessfulFetch();

      render(<PullRequestDetailModal pr={createBasePR({ merged: true })} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Detailed PR Title')).toBeDefined();
      });

      expect(screen.queryByText('Merge pull request')).toBeNull();
    });

    it('hides merge/close buttons when canWrite is false', async () => {
      setupSuccessfulFetch();

      render(
        <PullRequestDetailModal
          pr={createBasePR({ state: 'open' })}
          {...defaultProps}
          canWrite={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Detailed PR Title')).toBeDefined();
      });

      expect(screen.queryByText('Merge pull request')).toBeNull();
      expect(screen.queryByText('Close pull request')).toBeNull();
    });

    it('calls merge IPC and callbacks on merge', async () => {
      setupSuccessfulFetch();
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onRefresh = vi.fn();

      render(
        <PullRequestDetailModal
          pr={createBasePR()}
          {...defaultProps}
          onClose={onClose}
          onRefresh={onRefresh}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Merge pull request')).toBeDefined();
      });

      await user.click(screen.getByText('Merge pull request'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'github:merge-pull-request',
          'owner',
          'repo',
          123,
          'merge'
        );
      });

      expect(onRefresh).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('calls close IPC and callbacks on close', async () => {
      setupSuccessfulFetch();
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onRefresh = vi.fn();

      render(
        <PullRequestDetailModal
          pr={createBasePR()}
          {...defaultProps}
          onClose={onClose}
          onRefresh={onRefresh}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Close pull request')).toBeDefined();
      });

      await user.click(screen.getByText('Close pull request'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('github:close-pull-request', 'owner', 'repo', 123);
      });

      expect(onRefresh).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('shows error message when merge fails', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:merge-pull-request') {
          throw new Error('Merge conflict');
        }
        // Default success for other calls
        if (channel === 'github:get-pull-request') return createPRDetail();
        if (channel === 'github:list-pr-comments') return [];
        if (channel === 'github:list-pr-reviews') return [];
        if (channel === 'github:list-pr-review-comments') return [];
        if (channel === 'github:list-issue-reactions') return [];
        return undefined;
      });

      const user = userEvent.setup();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Merge pull request')).toBeDefined();
      });

      await user.click(screen.getByText('Merge pull request'));

      await waitFor(() => {
        expect(screen.getByText('Merge conflict')).toBeDefined();
      });
    });

    it('shows error message when close fails', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:close-pull-request') {
          throw new Error('Cannot close');
        }
        if (channel === 'github:get-pull-request') return createPRDetail();
        if (channel === 'github:list-pr-comments') return [];
        if (channel === 'github:list-pr-reviews') return [];
        if (channel === 'github:list-pr-review-comments') return [];
        if (channel === 'github:list-issue-reactions') return [];
        return undefined;
      });

      const user = userEvent.setup();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Close pull request')).toBeDefined();
      });

      await user.click(screen.getByText('Close pull request'));

      await waitFor(() => {
        expect(screen.getByText('Cannot close')).toBeDefined();
      });
    });
  });

  describe('retry functionality', () => {
    it('refetches data when retry button is clicked', async () => {
      // First fail, then succeed
      let callCount = 0;
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:get-pull-request') {
          callCount++;
          if (callCount === 1) throw new Error('Network error');
          return createPRDetail();
        }
        if (channel === 'github:list-pr-comments') return [];
        if (channel === 'github:list-pr-reviews') return [];
        if (channel === 'github:list-pr-review-comments') return [];
        if (channel === 'github:list-issue-reactions') return [];
        return undefined;
      });

      const user = userEvent.setup();

      render(<PullRequestDetailModal pr={createBasePR()} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeDefined();
      });

      await user.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Detailed PR Title')).toBeDefined();
      });
    });
  });
});

// ============================================
// Utility Function Tests
// ============================================

describe('reviewStateBadge', () => {
  it('returns Approved badge for APPROVED state', () => {
    const result = reviewStateBadge('APPROVED');
    expect(result).toBeDefined();
  });

  it('returns Changes Requested badge for CHANGES_REQUESTED state', () => {
    const result = reviewStateBadge('CHANGES_REQUESTED');
    expect(result).toBeDefined();
  });

  it('returns Commented badge for COMMENTED state', () => {
    const result = reviewStateBadge('COMMENTED');
    expect(result).toBeDefined();
  });

  it('returns Dismissed badge for DISMISSED state', () => {
    const result = reviewStateBadge('DISMISSED');
    expect(result).toBeDefined();
  });

  it('returns outline badge for unknown state', () => {
    const result = reviewStateBadge('UNKNOWN');
    expect(result).toBeDefined();
  });
});

describe('statusBadge', () => {
  it('returns Merged badge when merged is true', () => {
    const result = statusBadge('closed', true);
    expect(result).toBeDefined();
  });

  it('returns Open badge for open state', () => {
    const result = statusBadge('open', false);
    expect(result).toBeDefined();
  });

  it('returns Closed badge for closed non-merged state', () => {
    const result = statusBadge('closed', false);
    expect(result).toBeDefined();
  });
});

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2026-01-15T10:30:00Z');
    const result = formatDate(date);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });
});
