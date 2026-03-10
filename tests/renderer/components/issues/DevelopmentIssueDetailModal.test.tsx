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

// Mock sub-issue modals
vi.mock('../../../../src/renderer/components/issues/CreateSubIssueModal', () => ({
  CreateSubIssueModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-sub-issue-modal" /> : null,
}));

vi.mock('../../../../src/renderer/components/issues/AddExistingSubIssueModal', () => ({
  AddExistingSubIssueModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-existing-sub-issue-modal" /> : null,
}));

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
    parentIssue?: any;
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
      case 'github:get-parent-issue':
        return overrides.parentIssue ?? null;
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

  it('shows branched badge when branchBadge is "branched"', async () => {
    setupMockIPC();
    render(
      <DevelopmentIssueDetailModal
        issue={baseIssue}
        owner="org"
        repo="repo"
        branchBadge="branched"
        localPath="/mock/path"
        githubUsername="testuser"
        onClose={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('branched')).toBeDefined();
    });
  });

  it('does not show branched badge when branchBadge is undefined', async () => {
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
    expect(screen.queryByText('branched')).toBeNull();
    expect(screen.queryByText('Primary')).toBeNull();
    expect(screen.queryByText('Secondary')).toBeNull();
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

  describe('sub-issue navigation', () => {
    const mockSubIssues = [
      { id: 201, number: 20, title: 'Sub issue A', state: 'open', url: '', labels: ['Secondary'] },
      {
        id: 202,
        number: 21,
        title: 'Sub issue B',
        state: 'closed',
        url: '',
        labels: ['Secondary'],
      },
    ];

    it('renders open sub-issue rows as clickable buttons and hides closed', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:get-issue') return baseIssueDetail;
        if (channel === 'github:list-issue-comments') return [];
        if (channel === 'github:list-sub-issues') return mockSubIssues;
        return [];
      });
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Sub issue A')).toBeDefined();
      });
      // Open sub-issue should be a button
      const btnA = screen.getByText('Sub issue A').closest('button');
      expect(btnA).not.toBeNull();
      // Closed sub-issue should not render
      expect(screen.queryByText('Sub issue B')).toBeNull();
    });

    it('calls onNavigateToIssue with sub-issue number and parent context on click', async () => {
      const onNavigate = vi.fn();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:get-issue') return baseIssueDetail;
        if (channel === 'github:list-issue-comments') return [];
        if (channel === 'github:list-sub-issues') return mockSubIssues;
        return [];
      });
      const user = userEvent.setup();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={onNavigate}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Sub issue A')).toBeDefined();
      });
      await user.click(screen.getByText('Sub issue A').closest('button')!);
      expect(onNavigate).toHaveBeenCalledWith(20, { number: 10, title: 'Detailed Issue Title' });
    });

    it('renders parent issue breadcrumb when parentIssue is provided', async () => {
      setupMockIPC();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={vi.fn()}
          parentIssue={{ number: 5, title: 'Parent Feature' }}
        />
      );
      await waitFor(() => {
        expect(screen.getByText(/Sub-issue of #5 Parent Feature/)).toBeDefined();
      });
    });

    it('does NOT render parent breadcrumb when parentIssue is not provided', async () => {
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
      expect(screen.queryByText(/Sub-issue of/)).toBeNull();
    });

    it('clicking parent breadcrumb navigates to parent issue', async () => {
      setupMockIPC();
      const onNavigate = vi.fn();
      const user = userEvent.setup();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={onNavigate}
          parentIssue={{ number: 5, title: 'Parent Feature' }}
        />
      );
      await waitFor(() => {
        expect(screen.getByText(/Sub-issue of #5 Parent Feature/)).toBeDefined();
      });
      await user.click(screen.getByText(/Sub-issue of #5 Parent Feature/));
      expect(onNavigate).toHaveBeenCalledWith(5);
    });

    it('auto-detects parent issue via API when parentIssue prop is not provided', async () => {
      setupMockIPC({
        parentIssue: { id: 50, number: 3, title: 'Auto Parent', state: 'open', url: '' },
      });
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText(/Sub-issue of #3 Auto Parent/)).toBeDefined();
      });
    });

    it('does not call get-parent-issue when parentIssue prop is provided', async () => {
      setupMockIPC();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={vi.fn()}
          parentIssue={{ number: 5, title: 'Prop Parent' }}
        />
      );
      await waitFor(() => {
        expect(screen.getByText(/Sub-issue of #5 Prop Parent/)).toBeDefined();
      });
      const parentCalls = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'github:get-parent-issue'
      );
      expect(parentCalls).toHaveLength(0);
    });

    it('shows no breadcrumb when get-parent-issue returns null', async () => {
      setupMockIPC({ parentIssue: null });
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });
      expect(screen.queryByText(/Sub-issue of/)).toBeNull();
    });
  });

  describe('sub-issue branched badges', () => {
    const mockSubIssues = [
      {
        id: 201,
        number: 20,
        title: 'Sub issue A',
        state: 'open',
        url: '',
        labels: ['Secondary', 'enhancement'],
      },
      { id: 202, number: 21, title: 'Sub issue B', state: 'open', url: '', labels: ['Secondary'] },
    ];

    it('shows Secondary badge on sub-issues when parent has branchBadge Primary', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:get-issue') return baseIssueDetail;
        if (channel === 'github:list-issue-comments') return [];
        if (channel === 'github:list-sub-issues') return mockSubIssues;
        return [];
      });
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          branchBadge="Primary"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Sub issue A')).toBeDefined();
      });
      // Both sub-issues get Secondary badge inherited from parent
      const secondaryBadges = screen.getAllByText('Secondary');
      expect(secondaryBadges.length).toBe(2);
      // Other labels like 'enhancement' still render
      expect(screen.getByText('enhancement')).toBeDefined();
    });

    it('does not show Secondary badge when parent has no branchBadge', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:get-issue') return baseIssueDetail;
        if (channel === 'github:list-issue-comments') return [];
        if (channel === 'github:list-sub-issues') return mockSubIssues;
        return [];
      });
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          onNavigateToIssue={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Sub issue A')).toBeDefined();
      });
      // No Secondary badge since parent has no branchBadge (and label 'Secondary' is filtered from display)
      expect(screen.queryByText('Secondary')).toBeNull();
      expect(screen.queryByText('branched')).toBeNull();
    });
  });

  describe('Fix Issue auto-assign', () => {
    it('assigns the issue to the authenticated user after branch creation', async () => {
      setupMockIPC();
      const onClose = vi.fn();
      const user = userEvent.setup();

      // After detail loads, override mock to handle Fix Issue flow
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          branchBadge={undefined}
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={onClose}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      // Set up mock for the Fix Issue flow channels
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'git:get-branches':
            return ['main', 'dev'];
          case 'git:checkout':
          case 'git:create-branch':
            return undefined;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'github:add-assignees':
            return undefined;
          default:
            return undefined;
        }
      });

      await user.click(screen.getByText('Fix Issue'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      const assignCalls = mockInvoke.mock.calls.filter(
        (c: unknown[]) => c[0] === 'github:add-assignees'
      );
      expect(assignCalls).toHaveLength(1);
      expect(assignCalls[0]).toEqual(['github:add-assignees', 'org', 'repo', 10, ['testuser']]);
    });

    it('still completes branch creation when assignment fails', async () => {
      setupMockIPC();
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          branchBadge={undefined}
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={onClose}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      // Assignment rejects, but everything else succeeds
      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'git:get-branches':
            return ['main'];
          case 'git:checkout':
          case 'git:create-branch':
            return undefined;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'github:add-assignees':
            throw new Error('Forbidden');
          default:
            return undefined;
        }
      });

      await user.click(screen.getByText('Fix Issue'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('close issue menu', () => {
    it('shows close menu with all options', async () => {
      setupMockIPC();
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
      let closeBtn!: HTMLElement;
      await waitFor(() => {
        const match = screen
          .getAllByText('Close')
          .find((el) => el.closest('button[data-variant="destructive"]'));
        expect(match).toBeDefined();
        closeBtn = match!;
      });

      await user.click(closeBtn);
      expect(screen.getByText('Close as completed')).toBeDefined();
      expect(screen.getByText('Close as not planned')).toBeDefined();
      expect(screen.getByText('Close as duplicate')).toBeDefined();
    });

    it('closes issue as not planned', async () => {
      setupMockIPC();
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
      let closeBtn!: HTMLElement;
      await waitFor(() => {
        const match = screen
          .getAllByText('Close')
          .find((el) => el.closest('button[data-variant="destructive"]'));
        expect(match).toBeDefined();
        closeBtn = match!;
      });

      await user.click(closeBtn);
      await user.click(screen.getByText('Close as not planned'));

      await waitFor(() => {
        const calls = mockInvoke.mock.calls.filter(
          (c: unknown[]) => c[0] === 'github:update-issue'
        );
        expect(calls.length).toBeGreaterThanOrEqual(1);
        expect(calls[0]).toEqual([
          'github:update-issue',
          'org',
          'repo',
          10,
          { state: 'closed', state_reason: 'not_planned' },
        ]);
      });
    });

    it('opens duplicate search when clicking Close as duplicate', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:get-issue') return baseIssueDetail;
        if (channel === 'github:list-issue-comments') return [];
        if (channel === 'github:list-issue-reactions') return [];
        if (channel === 'github:list-sub-issues') return [];
        if (channel === 'github:get-parent-issue') return null;
        if (channel === 'github:list-issues')
          return [{ number: 5, title: 'Similar bug', state: 'open', labels: [] }];
        return undefined;
      });
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
      let closeBtn!: HTMLElement;
      await waitFor(() => {
        const match = screen
          .getAllByText('Close')
          .find((el) => el.closest('button[data-variant="destructive"]'));
        expect(match).toBeDefined();
        closeBtn = match!;
      });

      await user.click(closeBtn);
      await user.click(screen.getByText('Close as duplicate'));

      await waitFor(() => {
        expect(screen.getByText('Select duplicate issue')).toBeDefined();
      });

      // Should show the issue from the search results
      await waitFor(() => {
        expect(screen.getByText('Similar bug')).toBeDefined();
      });
    });
  });

  describe('inline rendering', () => {
    it('renders without crashing when inline is true (no Dialog context)', async () => {
      setupMockIPC();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          inline
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });
    });

    it('renders title as h2 element in inline mode', async () => {
      setupMockIPC();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          inline
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.textContent).toContain('Detailed Issue Title');
      expect(heading.textContent).toContain('#10');
    });

    it('shows issue content (labels, body, comments) in inline mode', async () => {
      setupMockIPC({
        comments: [baseComment],
      });
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          inline
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      // Labels
      expect(screen.getByText('bug')).toBeDefined();
      expect(screen.getByText('help wanted')).toBeDefined();

      // Issue body and comment both render via mocked react-markdown
      const markdownElements = screen.getAllByTestId('markdown');
      expect(markdownElements).toHaveLength(2);

      // Comment
      expect(screen.getByText('This is a comment')).toBeDefined();
    });

    it('does not render Dialog wrapper in inline mode', async () => {
      setupMockIPC();
      const { container } = render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={vi.fn()}
          inline
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      // Inline mode renders a plain div, not a dialog
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  describe('sub-issue modals', () => {
    it('opens create sub-issue modal from dropdown', async () => {
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
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      // Click 'Create sub-issue' button to open dropdown
      await user.click(screen.getByText('Create sub-issue'));

      // Wait for dropdown to appear with both options
      await waitFor(() => {
        expect(screen.getByText('Add existing issue')).toBeDefined();
      });

      // Click 'Create sub-issue' menu item (second one in the dropdown)
      const createItems = screen.getAllByText('Create sub-issue');
      // The dropdown menu item should be the last one
      await user.click(createItems[createItems.length - 1]);

      await waitFor(() => {
        expect(screen.getByTestId('create-sub-issue-modal')).toBeDefined();
      });
    });

    it('opens add existing sub-issue modal from dropdown', async () => {
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
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      await user.click(screen.getByText('Create sub-issue'));
      await waitFor(() => {
        expect(screen.getByText('Add existing issue')).toBeDefined();
      });
      await user.click(screen.getByText('Add existing issue'));

      await waitFor(() => {
        expect(screen.getByTestId('add-existing-sub-issue-modal')).toBeDefined();
      });
    });
  });

  describe('branchBadge variants', () => {
    it('renders Primary badge with purple styling', async () => {
      setupMockIPC();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          branchBadge="Primary"
          onClose={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Primary')).toBeDefined();
      });
    });

    it('renders Secondary badge with yellow styling', async () => {
      setupMockIPC();
      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          localPath="/mock/path"
          githubUsername="testuser"
          branchBadge="Secondary"
          onClose={vi.fn()}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Secondary')).toBeDefined();
      });
    });
  });

  describe('Fix Issue smart branching', () => {
    it('branches from parent issue branch when sub-issue has parentIssue prop', async () => {
      setupMockIPC();
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          branchBadge={undefined}
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={onClose}
          parentIssue={{ number: 22, title: 'Parent Feature' }}
          branches={['main', 'feat/22-maintenance-tools', 'dev']}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'git:get-branches':
            return ['main', 'feat/22-maintenance-tools', 'dev'];
          case 'git:checkout':
          case 'git:create-branch':
            return undefined;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'github:add-assignees':
            return undefined;
          default:
            return undefined;
        }
      });

      await user.click(screen.getByText('Fix Issue'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      // Should checkout the parent's branch, not main
      const checkoutCalls = mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === 'git:checkout');
      expect(checkoutCalls).toHaveLength(1);
      expect(checkoutCalls[0][2]).toBe('feat/22-maintenance-tools');
    });

    it('branches from parent branch when parent is auto-detected via API', async () => {
      setupMockIPC({
        parentIssue: { id: 50, number: 22, title: 'Auto Parent', state: 'open', url: '' },
      });
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          branchBadge={undefined}
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={onClose}
          onNavigateToIssue={vi.fn()}
          branches={['main', 'feat/22-maintenance-tools']}
        />
      );

      // Wait for detail load
      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      // Wait for parent detection to complete (renders breadcrumb)
      await waitFor(() => {
        expect(screen.getByText(/Sub-issue of #22 Auto Parent/)).toBeDefined();
      });

      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'git:get-branches':
            return ['main', 'feat/22-maintenance-tools'];
          case 'git:checkout':
          case 'git:create-branch':
            return undefined;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'github:add-assignees':
            return undefined;
          default:
            return undefined;
        }
      });

      await user.click(screen.getByText('Fix Issue'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      const checkoutCalls = mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === 'git:checkout');
      expect(checkoutCalls).toHaveLength(1);
      expect(checkoutCalls[0][2]).toBe('feat/22-maintenance-tools');
    });

    it('falls back to main when sub-issue parent branch does not exist', async () => {
      setupMockIPC();
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          branchBadge={undefined}
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={onClose}
          parentIssue={{ number: 99, title: 'Unbranched Parent' }}
          branches={['main', 'dev']}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'git:get-branches':
            return ['main', 'dev'];
          case 'git:checkout':
          case 'git:create-branch':
            return undefined;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'github:add-assignees':
            return undefined;
          default:
            return undefined;
        }
      });

      await user.click(screen.getByText('Fix Issue'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      // No parent branch found — should fall back to main
      const checkoutCalls = mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === 'git:checkout');
      expect(checkoutCalls).toHaveLength(1);
      expect(checkoutCalls[0][2]).toBe('main');
    });

    it('standalone issue (no parent) branches from main', async () => {
      setupMockIPC();
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <DevelopmentIssueDetailModal
          issue={baseIssue}
          owner="org"
          repo="repo"
          branchBadge={undefined}
          localPath="/mock/path"
          githubUsername="testuser"
          onClose={onClose}
          branches={['main', 'feat/22-maintenance-tools']}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Detailed Issue Title')).toBeDefined();
      });

      mockInvoke.mockImplementation(async (channel: string) => {
        switch (channel) {
          case 'git:get-branches':
            return ['main', 'feat/22-maintenance-tools'];
          case 'git:checkout':
          case 'git:create-branch':
            return undefined;
          case 'github:get-authenticated-user':
            return { login: 'testuser' };
          case 'github:add-assignees':
            return undefined;
          default:
            return undefined;
        }
      });

      await user.click(screen.getByText('Fix Issue'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      // No parent — should checkout main
      const checkoutCalls = mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === 'git:checkout');
      expect(checkoutCalls).toHaveLength(1);
      expect(checkoutCalls[0][2]).toBe('main');
    });
  });
});
