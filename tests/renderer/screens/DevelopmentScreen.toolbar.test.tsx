import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock PullRequestDetailModal to avoid nested IPC complexity
vi.mock('../../../src/renderer/components/pull-requests/PullRequestDetailModal', () => ({
  PullRequestDetailModal: ({ pr, onClose }: { pr: any; onClose: () => void }) => (
    <div data-testid="pr-detail-modal">
      <span>PR Modal: #{pr?.number}</span>
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

// Mock DevelopmentIssueDetailModal to avoid nested IPC complexity
vi.mock('../../../src/renderer/components/issues/DevelopmentIssueDetailModal', () => ({
  DevelopmentIssueDetailModal: ({ issue, onClose }: { issue: any; onClose: () => void }) => (
    <div data-testid="issue-detail-modal">
      <span>Issue Modal: #{issue?.number}</span>
      <button onClick={onClose}>Close Issue Modal</button>
    </div>
  ),
}));

// Mock CreateIssueModal
vi.mock('../../../src/renderer/components/issues/CreateIssueModal', () => ({
  CreateIssueModal: ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) =>
    open ? (
      <div data-testid="create-issue-modal">
        <span>Create Issue Modal</span>
        <button onClick={onClose}>Close Create Issue</button>
        <button onClick={() => { onCreated(); onClose(); }}>Submit Issue</button>
      </div>
    ) : null,
}));

// Mock CreatePullRequestModal
vi.mock('../../../src/renderer/components/pull-requests/CreatePullRequestModal', () => ({
  CreatePullRequestModal: ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) =>
    open ? (
      <div data-testid="create-pr-modal">
        <span>Create PR Modal</span>
        <button onClick={onClose}>Close Create PR</button>
        <button onClick={() => { onCreated(); onClose(); }}>Submit PR</button>
      </div>
    ) : null,
}));

import { DevelopmentScreen } from '../../../src/renderer/screens/DevelopmentScreen';
import type { Contribution } from '../../../src/main/ipc/channels';

const baseContribution: Contribution = {
  id: 'test-1',
  repositoryUrl: 'https://github.com/org/repo.git',
  localPath: '/mock/path/repo',
  issueNumber: 1,
  issueTitle: 'Test Issue',
  branchName: 'feature-branch',
  status: 'in_progress',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  upstreamUrl: 'https://github.com/upstream/repo.git',
};

/**
 * Sets up IPC mocks so the component reaches 'running' state.
 * code-server:start must resolve for the toolbar to appear.
 */
function setupRunningState() {
  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'code-server:start':
        return { url: 'http://127.0.0.1:8080' };
      case 'code-server:stop':
        return undefined;
      case 'git:get-remotes':
        return [
          { name: 'origin', fetchUrl: 'https://github.com/user/repo.git', pushUrl: 'https://github.com/user/repo.git' },
          { name: 'upstream', fetchUrl: 'https://github.com/upstream/repo.git', pushUrl: 'https://github.com/upstream/repo.git' },
        ];
      case 'github:list-pull-requests':
        return [
          {
            number: 1,
            title: 'Test PR',
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
            title: 'Merged PR',
            url: 'https://github.com/upstream/repo/pull/2',
            state: 'closed',
            merged: true,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
            author: 'testuser',
            headBranch: 'old-branch',
          },
        ];
      case 'github:list-issues':
        return [
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
            number: 1,
            title: 'Matching branch issue',
            body: 'This matches the branch',
            url: 'https://github.com/upstream/repo/issues/1',
            state: 'open',
            labels: ['enhancement'],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
            author: 'contributor',
            authorAvatarUrl: '',
          },
        ];
      default:
        return undefined;
    }
  });
}

async function renderInRunningState(contributionOverrides: Partial<Contribution> = {}) {
  setupRunningState();
  const contribution = { ...baseContribution, ...contributionOverrides };
  const onNavigateBack = vi.fn();

  render(<DevelopmentScreen contribution={contribution} onNavigateBack={onNavigateBack} />);

  // Wait for running state (toolbar appears with "Stop & Back" button)
  await waitFor(() => {
    expect(screen.getByText('Stop & Back')).toBeDefined();
  });

  return { contribution, onNavigateBack };
}

describe('DevelopmentScreen Toolbar Buttons', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('Remotes button styling', () => {
    it('has default styling when not a fork', async () => {
      await renderInRunningState({ isFork: false, remotesValid: false });
      const remotesBtn = screen.getByText('Remotes');
      expect(remotesBtn.className).toContain('border-border');
    });

    it('has primary styling when fork with valid remotes', async () => {
      await renderInRunningState({ isFork: true, remotesValid: true });
      const remotesBtn = screen.getByText('Remotes');
      expect(remotesBtn.className).toContain('bg-primary');
      expect(remotesBtn.className).toContain('text-primary-foreground');
    });

    it('has default styling when fork with invalid remotes', async () => {
      await renderInRunningState({ isFork: true, remotesValid: false });
      const remotesBtn = screen.getByText('Remotes');
      expect(remotesBtn.className).toContain('border-border');
    });
  });

  describe('Pull Requests button styling', () => {
    it('has default styling with no prStatus', async () => {
      await renderInRunningState({ prStatus: undefined });
      const prBtn = screen.getByText('Pull Requests');
      expect(prBtn.className).toContain('border-border');
    });

    it('has green styling when prStatus is open', async () => {
      await renderInRunningState({ prStatus: 'open' });
      const prBtn = screen.getByText('Pull Requests');
      expect(prBtn.className).toContain('bg-green-500');
    });

    it('has primary styling when prStatus is merged', async () => {
      await renderInRunningState({ prStatus: 'merged' });
      const prBtn = screen.getByText('Pull Requests');
      expect(prBtn.className).toContain('bg-primary');
    });

    it('has default styling when prStatus is closed', async () => {
      await renderInRunningState({ prStatus: 'closed' });
      const prBtn = screen.getByText('Pull Requests');
      expect(prBtn.className).toContain('border-border');
    });
  });

  describe('Remotes dropdown', () => {
    it('shows remotes after clicking button', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Remotes'));

      await waitFor(() => {
        // 'origin' appears twice: as remote name and as badge label
        expect(screen.getAllByText('origin').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('upstream').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows "No remotes configured" when empty', async () => {
      setupRunningState();
      // Override git:get-remotes to return empty
      const originalImpl = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
        if (channel === 'git:get-remotes') return [];
        return (originalImpl as Function)(channel, ...args);
      });

      render(<DevelopmentScreen contribution={baseContribution} onNavigateBack={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Remotes'));

      await waitFor(() => {
        expect(screen.getByText('No remotes configured')).toBeDefined();
      });
    });

    it('shows "No remotes configured" on fetch error', async () => {
      setupRunningState();
      const originalImpl = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
        if (channel === 'git:get-remotes') throw new Error('git error');
        return (originalImpl as Function)(channel, ...args);
      });

      render(<DevelopmentScreen contribution={baseContribution} onNavigateBack={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Remotes'));

      await waitFor(() => {
        expect(screen.getByText('No remotes configured')).toBeDefined();
      });
    });
  });

  describe('Pull Requests dropdown', () => {
    it('shows PRs after clicking button', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Pull Requests'));

      await waitFor(() => {
        expect(screen.getByText('Test PR')).toBeDefined();
        expect(screen.getByText('#1')).toBeDefined();
        expect(screen.getByText('Merged PR')).toBeDefined();
      });
    });

    it('shows "No pull requests found" when empty', async () => {
      setupRunningState();
      const originalImpl = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
        if (channel === 'github:list-pull-requests') return [];
        return (originalImpl as Function)(channel, ...args);
      });

      render(<DevelopmentScreen contribution={baseContribution} onNavigateBack={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Pull Requests'));

      await waitFor(() => {
        expect(screen.getByText('No pull requests found')).toBeDefined();
      });
    });

    it('shows error when fetch fails', async () => {
      setupRunningState();
      const originalImpl = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
        if (channel === 'github:list-pull-requests') throw new Error('PR fetch failed');
        return (originalImpl as Function)(channel, ...args);
      });

      render(<DevelopmentScreen contribution={baseContribution} onNavigateBack={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Pull Requests'));

      await waitFor(() => {
        expect(screen.getByText('PR fetch failed')).toBeDefined();
      });
    });

    it('shows PR status badges correctly', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Pull Requests'));

      await waitFor(() => {
        expect(screen.getByText('open')).toBeDefined();
        expect(screen.getByText('merged')).toBeDefined();
      });
    });
  });

  describe('Dropdown interactions', () => {
    it('closes dropdown on re-click', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      // Use getByRole to target the button specifically (dropdown header also says "Remotes")
      const remotesButton = screen.getByRole('button', { name: 'Remotes' });
      await user.click(remotesButton);
      await waitFor(() => {
        expect(screen.getAllByText('origin').length).toBeGreaterThanOrEqual(1);
      });

      await user.click(remotesButton);
      await waitFor(() => {
        expect(screen.queryAllByText('origin')).toHaveLength(0);
      });
    });

    it('clicking a PR opens the detail modal', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Pull Requests'));
      await waitFor(() => {
        expect(screen.getByText('Test PR')).toBeDefined();
      });

      await user.click(screen.getByText('Test PR'));

      await waitFor(() => {
        expect(screen.getByTestId('pr-detail-modal')).toBeDefined();
        expect(screen.getByText('PR Modal: #1')).toBeDefined();
      });
    });

    it('closing modal clears selectedPR', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      // Open dropdown and click PR
      await user.click(screen.getByText('Pull Requests'));
      await waitFor(() => {
        expect(screen.getByText('Test PR')).toBeDefined();
      });
      await user.click(screen.getByText('Test PR'));

      await waitFor(() => {
        expect(screen.getByTestId('pr-detail-modal')).toBeDefined();
      });

      // Close modal
      await user.click(screen.getByText('Close Modal'));
      await waitFor(() => {
        expect(screen.queryByTestId('pr-detail-modal')).toBeNull();
      });
    });
  });

  describe('Issues button styling', () => {
    it('has green styling when branched issue is open', async () => {
      // branchName 'fix-10-login' matches issue #10 which is open
      await renderInRunningState({ branchName: 'fix-10-login' });

      // Wait for issues to be fetched eagerly on mount
      await waitFor(() => {
        const issuesBtn = screen.getByRole('button', { name: 'Issues' });
        expect(issuesBtn.className).toContain('bg-green-500');
      });
    });

    it('has red styling when branched issue is closed', async () => {
      setupRunningState();
      // Override to return a closed branched issue
      const originalImpl = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
        if (channel === 'github:list-issues') return [
          {
            number: 10,
            title: 'Closed issue',
            body: '',
            url: 'https://github.com/upstream/repo/issues/10',
            state: 'closed',
            labels: [],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-02'),
            author: 'reporter',
            authorAvatarUrl: '',
          },
        ];
        return (originalImpl as Function)(channel, ...args);
      });

      render(<DevelopmentScreen contribution={{ ...baseContribution, branchName: 'fix-10-login' }} onNavigateBack={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      await waitFor(() => {
        const issuesBtn = screen.getByRole('button', { name: 'Issues' });
        expect(issuesBtn.className).toContain('bg-red-500');
      });
    });

    it('has default styling when no branched issue', async () => {
      await renderInRunningState({ branchName: 'unrelated-branch' });

      await waitFor(() => {
        const issuesBtn = screen.getByRole('button', { name: 'Issues' });
        expect(issuesBtn.className).toContain('border-border');
      });
    });
  });

  describe('Issues dropdown', () => {
    it('shows issues after clicking button', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Issues'));

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
        expect(screen.getByText('#10')).toBeDefined();
        expect(screen.getByText('Matching branch issue')).toBeDefined();
      });
    });

    it('shows "No issues found" when empty', async () => {
      setupRunningState();
      const originalImpl = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
        if (channel === 'github:list-issues') return [];
        return (originalImpl as Function)(channel, ...args);
      });

      render(<DevelopmentScreen contribution={baseContribution} onNavigateBack={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Issues'));

      await waitFor(() => {
        expect(screen.getByText('No issues found')).toBeDefined();
      });
    });

    it('shows error when fetch fails', async () => {
      setupRunningState();
      const originalImpl = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
        if (channel === 'github:list-issues') throw new Error('Issues fetch failed');
        return (originalImpl as Function)(channel, ...args);
      });

      render(<DevelopmentScreen contribution={baseContribution} onNavigateBack={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Stop & Back')).toBeDefined();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Issues'));

      await waitFor(() => {
        expect(screen.getByText('Issues fetch failed')).toBeDefined();
      });
    });

    it('shows blue "branched" badge when branch matches issue number', async () => {
      await renderInRunningState({ branchName: 'fix-10-login' });
      const user = userEvent.setup();

      await user.click(screen.getByText('Issues'));

      await waitFor(() => {
        expect(screen.getByText('branched')).toBeDefined();
      });
    });

    it('does not show "branched" badge when branch does not match', async () => {
      await renderInRunningState({ branchName: 'unrelated-branch' });
      const user = userEvent.setup();

      await user.click(screen.getByText('Issues'));

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
      });
      expect(screen.queryByText('branched')).toBeNull();
    });

    it('clicking an issue opens the detail modal', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Issues'));
      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
      });

      await user.click(screen.getByText('Fix login bug'));

      await waitFor(() => {
        expect(screen.getByTestId('issue-detail-modal')).toBeDefined();
        expect(screen.getByText('Issue Modal: #10')).toBeDefined();
      });
    });

    it('closing issue modal clears selectedIssue', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Issues'));
      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeDefined();
      });
      await user.click(screen.getByText('Fix login bug'));

      await waitFor(() => {
        expect(screen.getByTestId('issue-detail-modal')).toBeDefined();
      });

      await user.click(screen.getByText('Close Issue Modal'));
      await waitFor(() => {
        expect(screen.queryByTestId('issue-detail-modal')).toBeNull();
      });
    });
  });

  describe('Create buttons', () => {
    it('shows "+ New Issue" button in Issues dropdown', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Issues'));

      await waitFor(() => {
        expect(screen.getByText('+ New Issue')).toBeDefined();
      });
    });

    it('clicking "+ New Issue" opens the CreateIssueModal', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Issues'));
      await waitFor(() => {
        expect(screen.getByText('+ New Issue')).toBeDefined();
      });

      await user.click(screen.getByText('+ New Issue'));

      await waitFor(() => {
        expect(screen.getByTestId('create-issue-modal')).toBeDefined();
      });
    });

    it('shows "+ New PR" button in Pull Requests dropdown', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Pull Requests'));

      await waitFor(() => {
        expect(screen.getByText('+ New PR')).toBeDefined();
      });
    });

    it('clicking "+ New PR" opens the CreatePullRequestModal', async () => {
      await renderInRunningState();
      const user = userEvent.setup();

      await user.click(screen.getByText('Pull Requests'));
      await waitFor(() => {
        expect(screen.getByText('+ New PR')).toBeDefined();
      });

      await user.click(screen.getByText('+ New PR'));

      await waitFor(() => {
        expect(screen.getByTestId('create-pr-modal')).toBeDefined();
      });
    });
  });
});
