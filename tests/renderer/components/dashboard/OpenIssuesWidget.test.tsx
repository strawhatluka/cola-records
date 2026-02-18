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

import { OpenIssuesWidget } from '../../../../src/renderer/components/dashboard/OpenIssuesWidget';

describe('OpenIssuesWidget', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders empty state when no open issues', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') return { totalCount: 0, items: [] };
      return undefined;
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('No assigned issues found')).toBeDefined();
    });
  });

  it('renders issues with title and repo name', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 2,
          items: [
            {
              id: 1,
              number: 1,
              title: 'Fix a bug',
              state: 'open',
              htmlUrl: '',
              createdAt: '2026-02-18T10:00:00Z',
              updatedAt: '',
              closedAt: null,
              labels: ['bug'],
              repoFullName: 'owner/repo-a',
              isPullRequest: false,
              author: 'other',
            },
            {
              id: 2,
              number: 5,
              title: 'Add feature',
              state: 'open',
              htmlUrl: '',
              createdAt: '2026-02-17T10:00:00Z',
              updatedAt: '',
              closedAt: null,
              labels: [],
              repoFullName: 'owner/repo-b',
              isPullRequest: false,
              author: 'other',
            },
          ],
        };
      }
      return undefined;
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('Fix a bug')).toBeDefined();
    });

    expect(screen.getByText('owner/repo-a #1')).toBeDefined();
    expect(screen.getByText('Add feature')).toBeDefined();
    expect(screen.getByText('owner/repo-b #5')).toBeDefined();
  });

  it('displays labels', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 1,
              number: 5,
              title: 'Issue',
              state: 'open',
              htmlUrl: '',
              createdAt: '2026-02-18T10:00:00Z',
              updatedAt: '',
              closedAt: null,
              labels: ['bug', 'critical'],
              repoFullName: 'owner/repo',
              isPullRequest: false,
              author: 'testuser',
            },
          ],
        };
      }
      return undefined;
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeDefined();
      expect(screen.getByText('critical')).toBeDefined();
    });
  });

  it('limits to 10 issues', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      number: i + 1,
      title: `Issue ${i + 1}`,
      state: 'open',
      htmlUrl: '',
      createdAt: '2026-02-18T10:00:00Z',
      updatedAt: '',
      closedAt: null,
      labels: [],
      repoFullName: 'owner/repo',
      isPullRequest: false,
      author: 'testuser',
    }));

    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') return { totalCount: 15, items };
      return undefined;
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      const issueRows = screen.getAllByText(/owner\/repo #\d+/);
      expect(issueRows.length).toBeLessThanOrEqual(10);
    });
  });

  it('renders no-token fallback when auth fails', async () => {
    mockInvoke.mockRejectedValue(new Error('No token'));

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('renders widget title', () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      return { totalCount: 0, items: [] };
    });
    render(<OpenIssuesWidget />);
    expect(screen.getByText('Open Issues')).toBeDefined();
  });

  it('shows error when search fails', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      throw new Error('API down');
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('API down')).toBeDefined();
    });
  });
});
