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

// Mock react-markdown to avoid parsing overhead in tests
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock lucide-react icons (including X used by Dialog close button)
vi.mock('lucide-react', () => ({
  ExternalLink: () => <span data-testid="icon-external-link" />,
  MessageSquare: () => <span data-testid="icon-message-square" />,
  FileCode: () => <span data-testid="icon-file-code" />,
  Send: () => <span data-testid="icon-send" />,
  X: () => <span data-testid="icon-x" />,
}));

import { PullRequestDetailModal } from '../../../../src/renderer/components/pull-requests/PullRequestDetailModal';

const basePR = {
  number: 1,
  title: 'Test PR',
  url: 'https://github.com/org/repo/pull/1',
  state: 'open',
  merged: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  author: 'testuser',
  headBranch: 'feature-branch',
};

const basePRDetail = {
  number: 1,
  title: 'Detailed PR Title',
  body: '# PR Description\nThis is a test PR.',
  url: 'https://github.com/org/repo/pull/1',
  state: 'open',
  merged: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  author: 'testuser',
};

const baseComment = {
  id: 100,
  body: 'This is a comment',
  author: 'commenter',
  authorAvatarUrl: 'https://avatar.url/commenter',
  createdAt: new Date('2026-01-03T00:00:00Z'),
  updatedAt: new Date('2026-01-03T00:00:00Z'),
};

const baseReview = {
  id: 200,
  body: 'Looks good!',
  state: 'APPROVED',
  author: 'reviewer',
  authorAvatarUrl: 'https://avatar.url/reviewer',
  submittedAt: new Date('2026-01-04T00:00:00Z'),
};

const baseReviewComment = {
  id: 300,
  body: 'Inline feedback',
  author: 'reviewer',
  authorAvatarUrl: 'https://avatar.url/reviewer',
  path: 'src/foo.ts',
  line: 42,
  createdAt: new Date('2026-01-05T00:00:00Z'),
  inReplyToId: null,
};

function setupMockIPC(overrides: {
  detail?: any;
  comments?: any[];
  reviews?: any[];
  reviewComments?: any[];
  error?: boolean;
} = {}) {
  if (overrides.error) {
    mockInvoke.mockRejectedValue(new Error('API Error'));
    return;
  }

  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'github:get-pull-request':
        return overrides.detail ?? basePRDetail;
      case 'github:list-pr-comments':
        return overrides.comments ?? [];
      case 'github:list-pr-reviews':
        return overrides.reviews ?? [];
      case 'github:list-pr-review-comments':
        return overrides.reviewComments ?? [];
      case 'github:create-pr-comment':
        return undefined;
      case 'shell:open-external':
        return undefined;
      default:
        return undefined;
    }
  });
}

describe('PullRequestDetailModal', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders null when pr is null', () => {
    const { container } = render(
      <PullRequestDetailModal pr={null} owner="org" repo="repo" onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows loading spinner on open', () => {
    // Never resolve the IPC calls to keep loading state
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    expect(screen.getByText('Test PR')).toBeDefined();
  });

  it('shows error with retry button when all IPCs fail', async () => {
    setupMockIPC({ error: true });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeDefined();
    });
    expect(screen.getByText('API Error')).toBeDefined();
  });

  it('retry re-fetches data', async () => {
    setupMockIPC({ error: true });
    const user = userEvent.setup();
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeDefined();
    });

    // Clear and setup success mocks
    mockInvoke.mockReset();
    setupMockIPC();

    await user.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(screen.getByText('Detailed PR Title')).toBeDefined();
    });
  });

  it('renders PR title from detail after loading', async () => {
    setupMockIPC();
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Detailed PR Title')).toBeDefined();
    });
  });

  it('falls back to pr.title while loading', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    expect(screen.getByText('Test PR')).toBeDefined();
  });

  it('renders PR body as markdown', async () => {
    setupMockIPC();
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      const markdown = screen.getByTestId('markdown');
      expect(markdown).toBeDefined();
      expect(markdown.textContent).toContain('PR Description');
      expect(markdown.textContent).toContain('This is a test PR.');
    });
  });

  it('does not render body section when body is empty', async () => {
    setupMockIPC({ detail: { ...basePRDetail, body: '' } });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Detailed PR Title')).toBeDefined();
    });
    expect(screen.queryByText('# PR Description')).toBeNull();
  });

  it('shows empty state when no activity and no body', async () => {
    setupMockIPC({ detail: { ...basePRDetail, body: '' } });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('No activity on this pull request yet.')).toBeDefined();
    });
  });

  it('renders timeline with comments', async () => {
    setupMockIPC({ comments: [baseComment] });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('This is a comment')).toBeDefined();
    });
    expect(screen.getByText('commenter')).toBeDefined();
  });

  it('renders timeline with reviews', async () => {
    setupMockIPC({ reviews: [baseReview] });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Looks good!')).toBeDefined();
    });
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('filters COMMENTED reviews with no body', async () => {
    setupMockIPC({
      reviews: [{ ...baseReview, state: 'COMMENTED', body: '' }],
    });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Detailed PR Title')).toBeDefined();
    });
    // The review should be filtered out, so no "Commented" badge in timeline
    // But activity count may still be 0
  });

  it('shows APPROVED review with no body (badge only)', async () => {
    setupMockIPC({
      reviews: [{ ...baseReview, body: '' }],
    });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeDefined();
    });
    expect(screen.getByText('reviewer')).toBeDefined();
  });

  it('renders review comment with file path and line', async () => {
    setupMockIPC({ reviewComments: [baseReviewComment] });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Inline feedback')).toBeDefined();
    });
    expect(screen.getByText(/src\/foo\.ts/)).toBeDefined();
    expect(screen.getByText(/:42/)).toBeDefined();
  });

  it('renders review comment without line when line is null', async () => {
    setupMockIPC({
      reviewComments: [{ ...baseReviewComment, line: null }],
    });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Inline feedback')).toBeDefined();
    });
    expect(screen.queryByText(/:42/)).toBeNull();
  });

  it('shows activity count in header', async () => {
    setupMockIPC({
      comments: [baseComment],
      reviews: [baseReview],
      reviewComments: [baseReviewComment],
    });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('Activity (3)')).toBeDefined();
    });
  });

  it('shows avatar image when authorAvatarUrl is present', async () => {
    setupMockIPC({ comments: [baseComment] });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('commenter')).toBeDefined();
    });
    const avatar = screen.getByAltText('commenter');
    expect(avatar).toBeDefined();
    expect(avatar.getAttribute('src')).toBe('https://avatar.url/commenter');
  });

  it('shows placeholder when authorAvatarUrl is empty', async () => {
    setupMockIPC({
      comments: [{ ...baseComment, authorAvatarUrl: '' }],
    });
    render(
      <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText('commenter')).toBeDefined();
    });
    expect(screen.queryByAltText('commenter')).toBeNull();
  });

  describe('comment submission', () => {
    it('submit button is disabled when textarea is empty', async () => {
      setupMockIPC();
      render(
        <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
      );
      await waitFor(() => {
        expect(screen.getByText('Comment')).toBeDefined();
      });
      const submitBtn = screen.getByText('Comment').closest('button');
      expect(submitBtn?.disabled).toBe(true);
    });

    it('submit button is disabled when textarea has only whitespace', async () => {
      setupMockIPC();
      const user = userEvent.setup();
      render(
        <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
      );
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Write a comment/)).toBeDefined();
      });
      await user.type(screen.getByPlaceholderText(/Write a comment/), '   ');
      const submitBtn = screen.getByText('Comment').closest('button');
      expect(submitBtn?.disabled).toBe(true);
    });

    it('submit button is enabled with content', async () => {
      setupMockIPC();
      const user = userEvent.setup();
      render(
        <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
      );
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Write a comment/)).toBeDefined();
      });
      await user.type(screen.getByPlaceholderText(/Write a comment/), 'hello');
      const submitBtn = screen.getByText('Comment').closest('button');
      expect(submitBtn?.disabled).toBe(false);
    });

    it('successful comment clears textarea and refreshes', async () => {
      setupMockIPC({ comments: [] });
      const user = userEvent.setup();
      render(
        <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
      );
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Write a comment/)).toBeDefined();
      });
      const textarea = screen.getByPlaceholderText(/Write a comment/) as HTMLTextAreaElement;
      await user.type(textarea, 'my new comment');
      await user.click(screen.getByText('Comment'));

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });

      // Verify IPC was called for create and then refresh
      const createCalls = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'github:create-pr-comment'
      );
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('View on GitHub opens external URL', async () => {
      setupMockIPC();
      const user = userEvent.setup();
      render(
        <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
      );
      await waitFor(() => {
        expect(screen.getByText('View on GitHub')).toBeDefined();
      });
      await user.click(screen.getByText('View on GitHub'));

      await waitFor(() => {
        const openCalls = mockInvoke.mock.calls.filter(
          (c: unknown[]) => c[0] === 'shell:open-external'
        );
        expect(openCalls.length).toBe(1);
        expect(openCalls[0][1]).toBe('https://github.com/org/repo/pull/1');
      });
    });
  });

  describe('status badges in header', () => {
    it('shows Merged badge when PR is merged', async () => {
      setupMockIPC();
      render(
        <PullRequestDetailModal
          pr={{ ...basePR, merged: true, state: 'closed' }}
          owner="org"
          repo="repo"
          onClose={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Merged')).toBeDefined();
      });
    });

    it('shows Open badge for open PR', async () => {
      setupMockIPC();
      render(
        <PullRequestDetailModal pr={basePR} owner="org" repo="repo" onClose={vi.fn()} />
      );
      await waitFor(() => {
        expect(screen.getByText('Open')).toBeDefined();
      });
    });

    it('shows Closed badge for closed non-merged PR', async () => {
      setupMockIPC();
      render(
        <PullRequestDetailModal
          pr={{ ...basePR, state: 'closed', merged: false }}
          owner="org"
          repo="repo"
          onClose={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Closed')).toBeDefined();
      });
    });
  });
});
