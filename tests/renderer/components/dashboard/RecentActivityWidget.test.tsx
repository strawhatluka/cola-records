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
});
