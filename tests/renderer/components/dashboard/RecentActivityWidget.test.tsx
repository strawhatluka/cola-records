import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { RecentActivityWidget } from '../../../../src/renderer/components/dashboard/RecentActivityWidget';

describe('RecentActivityWidget', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders empty state when no events', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') return [];
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeDefined();
    });
  });

  it('renders push event descriptions', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '1',
            type: 'PushEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: '',
            refType: '',
            ref: '',
            commitCount: 3,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Pushed 3 commits')).toBeDefined();
    });

    expect(screen.getByText('owner/repo')).toBeDefined();
  });

  it('renders PR event descriptions', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '2',
            type: 'PullRequestEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T09:00:00Z',
            action: 'opened',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: 42,
            prTitle: 'My PR',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Opened PR #42')).toBeDefined();
    });
  });

  it('renders issue event descriptions', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '3',
            type: 'IssuesEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T08:00:00Z',
            action: 'closed',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: 10,
            issueTitle: 'Bug fix',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Closed issue #10')).toBeDefined();
    });
  });

  it('renders create event descriptions', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '4',
            type: 'CreateEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T07:00:00Z',
            action: '',
            refType: 'branch',
            ref: 'feat/new',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Created branch feat/new')).toBeDefined();
    });
  });

  it('limits to 10 events', async () => {
    const events = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      type: 'PushEvent',
      repoName: `owner/repo-${i}`,
      createdAt: '2026-02-18T10:00:00Z',
      action: '',
      refType: '',
      ref: '',
      commitCount: 1,
      prNumber: null,
      prTitle: '',
      issueNumber: null,
      issueTitle: '',
    }));

    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') return events;
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      const items = screen.getAllByText(/Pushed 1 commit$/);
      expect(items.length).toBeLessThanOrEqual(10);
    });
  });

  it('renders no-token fallback when auth fails', async () => {
    mockInvoke.mockRejectedValue(new Error('No token'));

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('shows error when events fetch fails', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      throw new Error('Rate limited');
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Rate limited')).toBeDefined();
    });
  });

  it('renders the widget title', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      return [];
    });
    render(<RecentActivityWidget />);
    expect(screen.getByText('Recent Activity')).toBeDefined();

    // Wait for async effects to settle
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  it('renders DeleteEvent description', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '10',
            type: 'DeleteEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: '',
            refType: 'branch',
            ref: 'old-branch',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Deleted branch old-branch')).toBeDefined();
    });
    // DeleteEvent uses GitBranch icon
    expect(screen.getByTestId('icon-gitbranch')).toBeDefined();
  });

  it('renders WatchEvent description', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '11',
            type: 'WatchEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: 'started',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Starred repo')).toBeDefined();
    });
    // WatchEvent uses default CircleDot icon
    expect(screen.getByTestId('icon-circledot')).toBeDefined();
  });

  it('renders ForkEvent description', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '12',
            type: 'ForkEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: '',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Forked repo')).toBeDefined();
    });
  });

  it('renders IssueCommentEvent description', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '13',
            type: 'IssueCommentEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: 'created',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: 7,
            issueTitle: 'Some issue',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Commented on #7')).toBeDefined();
    });
  });

  it('renders PullRequestReviewEvent description with correct icon', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '14',
            type: 'PullRequestReviewEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: 'submitted',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: 55,
            prTitle: 'Some PR',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Reviewed PR #55')).toBeDefined();
    });
    // PullRequestReviewEvent shares GitPullRequest icon
    expect(screen.getByTestId('icon-gitpullrequest')).toBeDefined();
  });

  it('renders ReleaseEvent description with Tag icon', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '15',
            type: 'ReleaseEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: 'published',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Published release')).toBeDefined();
    });
    expect(screen.getByTestId('icon-tag')).toBeDefined();
  });

  it('renders unknown event type via default case', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '16',
            type: 'SomeUnknownEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: '',
            refType: '',
            ref: '',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      // default case strips "Event" suffix
      expect(screen.getByText('SomeUnknown')).toBeDefined();
    });
    // default icon is CircleDot
    expect(screen.getByTestId('icon-circledot')).toBeDefined();
  });

  it('renders CreateEvent without ref (empty ref branch)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '17',
            type: 'CreateEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: '',
            refType: 'repository',
            ref: '',
            commitCount: 0,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      // When ref is empty, should just show "Created repository" without trailing space
      expect(screen.getByText('Created repository')).toBeDefined();
    });
  });

  it('renders single commit (commitCount === 1)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') {
        return [
          {
            id: '18',
            type: 'PushEvent',
            repoName: 'owner/repo',
            createdAt: '2026-02-18T10:00:00Z',
            action: '',
            refType: '',
            ref: '',
            commitCount: 1,
            prNumber: null,
            prTitle: '',
            issueNumber: null,
            issueTitle: '',
          },
        ];
      }
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      // singular "commit" not "commits"
      expect(screen.getByText('Pushed 1 commit')).toBeDefined();
    });
  });

  it('handles non-Error thrown in catch (String fallback)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:list-user-events') throw 'plain string error';
      return undefined;
    });

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('plain string error')).toBeDefined();
    });
  });
});
