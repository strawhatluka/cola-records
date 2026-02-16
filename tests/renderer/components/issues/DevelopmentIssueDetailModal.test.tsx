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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { DevelopmentIssueDetailModal } from '../../../../src/renderer/components/issues/DevelopmentIssueDetailModal';

const baseIssue = {
  number: 10,
  title: 'Test Issue',
  url: 'https://github.com/org/repo/issues/10',
  state: 'open',
  labels: ['bug', 'help wanted'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  author: 'testuser',
  authorAvatarUrl: 'https://avatar.url/testuser',
};

const baseIssueDetail = {
  number: 10,
  title: 'Detailed Issue Title',
  body: '# Issue Description\nThis is a test issue.',
  url: 'https://github.com/org/repo/issues/10',
  state: 'open',
  labels: ['bug', 'help wanted'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  author: 'testuser',
  authorAvatarUrl: 'https://avatar.url/testuser',
};

const baseComment = {
  id: 100,
  body: 'This is a comment',
  author: 'commenter',
  authorAvatarUrl: 'https://avatar.url/commenter',
  createdAt: new Date('2026-01-03T00:00:00Z'),
  updatedAt: new Date('2026-01-03T00:00:00Z'),
};

function setupMockIPC(
  overrides: {
    detail?: any;
    comments?: any[];
    error?: boolean;
  } = {}
) {
  if (overrides.error) {
    mockInvoke.mockRejectedValue(new Error('API Error'));
    return;
  }

  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'github:get-issue':
        return overrides.detail ?? baseIssueDetail;
      case 'github:list-issue-comments':
        return overrides.comments ?? [];
      case 'github:create-issue-comment':
        return undefined;
      case 'github:list-issue-reactions':
        return [];
      case 'github:list-comment-reactions':
        return [];
      case 'github:list-sub-issues':
        return [];
      case 'shell:open-external':
        return undefined;
      default:
        return undefined;
    }
  });
}

describe('DevelopmentIssueDetailModal', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders null when issue is null', () => {
    const { container } = render(
      <DevelopmentIssueDetailModal
        issue={null}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows loading spinner on open', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Test Issue')).toBeDefined();
  });

  it('shows error with retry button when IPCs fail', async () => {
    setupMockIPC({ error: true });
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
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
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeDefined();
    });

    mockInvoke.mockReset();
    setupMockIPC();

    await user.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(screen.getByText('Detailed Issue Title')).toBeDefined();
    });
  });

  it('renders issue title from detail after loading', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Detailed Issue Title')).toBeDefined();
    });
  });

  it('falls back to issue.title while loading', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Test Issue')).toBeDefined();
  });

  it('renders issue body as markdown', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      const markdown = screen.getByTestId('markdown');
      expect(markdown).toBeDefined();
      expect(markdown.textContent).toContain('Issue Description');
      expect(markdown.textContent).toContain('This is a test issue.');
    });
  });

  it('shows empty state when no comments and no body', async () => {
    setupMockIPC({ detail: { ...baseIssueDetail, body: '' } });
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('No activity on this issue yet.')).toBeDefined();
    });
  });

  it('renders labels as badges', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('bug')).toBeDefined();
      expect(screen.getByText('help wanted')).toBeDefined();
    });
  });

  it('renders comments', async () => {
    setupMockIPC({ comments: [baseComment] });
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('This is a comment')).toBeDefined();
    });
    expect(screen.getByText('commenter')).toBeDefined();
  });

  it('shows comment count in header', async () => {
    setupMockIPC({
      comments: [baseComment, { ...baseComment, id: 101, body: 'Second comment' }],
    });
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Comments (2)')).toBeDefined();
    });
  });

  it('shows avatar image when authorAvatarUrl is present', async () => {
    setupMockIPC({ comments: [baseComment] });
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
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
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('commenter')).toBeDefined();
    });
    expect(screen.queryByAltText('commenter')).toBeNull();
  });

  it('shows Open status badge', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Open')).toBeDefined();
    });
  });

  it('shows Closed status badge for closed issue', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={{ ...baseIssue, state: 'closed' }}
        owner="org"
        repo="repo"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Closed')).toBeDefined();
    });
  });

  it('shows branched badge when isBranched is true', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        isBranched={true}
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('branched')).toBeDefined();
    });
  });

  it('does not show branched badge when isBranched is false', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        isBranched={false}
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Open')).toBeDefined();
    });
    expect(screen.queryByText('branched')).toBeNull();
  });

  describe('close/reopen error feedback', () => {
    it('shows alert when closing issue fails', async () => {
      setupMockIPC();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
        />
      );
      // Wait for the destructive Close button (not the dialog sr-only Close)
      // The sr-only Close appears immediately, but the destructive one only renders
      // after issue detail loads, so we must wait for it specifically.
      let closeBtn!: HTMLElement;
      await waitFor(() => {
        const match = screen
          .getAllByText('Close')
          .find((el) => el.closest('button[data-variant="destructive"]'));
        expect(match).toBeDefined();
        closeBtn = match!;
      });

      // Make update-issue reject after initial load succeeds
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:update-issue') {
          throw new Error('Insufficient permissions');
        }
        return undefined;
      });

      // Open close menu
      await user.click(closeBtn);
      await user.click(screen.getByText('Close as completed'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to close issue: Insufficient permissions');
      });
      alertSpy.mockRestore();
    });

    it('shows alert when reopening issue fails', async () => {
      setupMockIPC();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(
        <DevelopmentIssueDetailModal
          issue={{ ...baseIssue, state: 'closed' }}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Reopen')).toBeDefined();
      });

      // Make update-issue reject
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:update-issue') {
          throw new Error('Insufficient permissions');
        }
        return undefined;
      });

      await user.click(screen.getByText('Reopen'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to reopen issue: Insufficient permissions');
      });
      alertSpy.mockRestore();
    });
  });

  describe('comment submission', () => {
    it('submit button is disabled when textarea is empty', async () => {
      setupMockIPC();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Comment')).toBeDefined();
      });
      const submitBtn = screen.getByText('Comment').closest('button');
      expect(submitBtn?.disabled).toBe(true);
    });

    it('submit button is enabled with content', async () => {
      setupMockIPC();
      const user = userEvent.setup();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
        />
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
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
        />
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

      const createCalls = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'github:create-issue-comment'
      );
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('View on GitHub opens external URL', async () => {
      setupMockIPC();
      const user = userEvent.setup();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
        />
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
        expect(openCalls[0][1]).toBe('https://github.com/org/repo/issues/10');
      });
    });
  });
});
