import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  number: 1,
  title: 'Issue title',
  state: 'open',
  htmlUrl: '',
  createdAt: '2026-02-18T10:00:00Z',
  updatedAt: '',
  closedAt: null,
  labels: [],
  repoFullName: 'owner/repo',
  isPullRequest: false,
  author: 'testuser',
  ...overrides,
});

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
      expect(screen.getByText('No open issues found')).toBeDefined();
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
            makeItem({
              id: 1,
              number: 1,
              title: 'Fix a bug',
              repoFullName: 'owner/repo-a',
              labels: ['bug'],
            }),
            makeItem({
              id: 2,
              number: 5,
              title: 'Add feature',
              repoFullName: 'owner/repo-b',
              createdAt: '2026-02-17T10:00:00Z',
            }),
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
            makeItem({
              number: 5,
              title: 'Issue',
              labels: ['bug', 'critical'],
              repoFullName: 'owner/repo',
            }),
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
    const items = Array.from({ length: 15 }, (_, i) =>
      makeItem({ id: i, number: i + 1, title: `Issue ${i + 1}` })
    );

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

  it('renders widget title', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      return { totalCount: 0, items: [] };
    });
    render(<OpenIssuesWidget />);
    expect(screen.getByText('Open Issues')).toBeDefined();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  it('shows empty state when both search queries fail (allSettled catches errors)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      throw new Error('API down');
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      // Promise.allSettled catches both failures, resulting in empty arrays
      expect(screen.getByText('No open issues found')).toBeDefined();
    });
  });

  it('merges assigned and authored issues and deduplicates', async () => {
    let callCount = 0;
    mockInvoke.mockImplementation(async (channel: string, query?: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        callCount++;
        if (query?.includes('assignee:')) {
          return {
            totalCount: 2,
            items: [
              makeItem({ id: 1, number: 1, title: 'Assigned issue', repoFullName: 'owner/repo-a' }),
              makeItem({ id: 2, number: 2, title: 'Shared issue', repoFullName: 'owner/repo-b' }),
            ],
          };
        }
        if (query?.includes('author:')) {
          return {
            totalCount: 2,
            items: [
              makeItem({ id: 2, number: 2, title: 'Shared issue', repoFullName: 'owner/repo-b' }),
              makeItem({ id: 3, number: 3, title: 'Authored issue', repoFullName: 'owner/repo-c' }),
            ],
          };
        }
      }
      return undefined;
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('Assigned issue')).toBeDefined();
    });

    // Both queries fired
    expect(callCount).toBe(2);

    // All 3 unique issues shown, duplicate removed
    expect(screen.getByText('Assigned issue')).toBeDefined();
    expect(screen.getByText('Shared issue')).toBeDefined();
    expect(screen.getByText('Authored issue')).toBeDefined();

    // Only 3 rows (not 4 — the duplicate is removed)
    const rows = screen.getAllByText(/#\d+/);
    expect(rows.length).toBe(3);
  });

  it('shows issues from both assigned and authored queries', async () => {
    mockInvoke.mockImplementation(async (channel: string, query?: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        if (query?.includes('assignee:')) {
          return {
            totalCount: 1,
            items: [
              makeItem({
                id: 1,
                number: 10,
                title: 'Assigned only',
                repoFullName: 'owner/assigned-repo',
              }),
            ],
          };
        }
        if (query?.includes('author:')) {
          return {
            totalCount: 1,
            items: [
              makeItem({
                id: 2,
                number: 20,
                title: 'Authored only',
                repoFullName: 'owner/authored-repo',
              }),
            ],
          };
        }
      }
      return undefined;
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('Assigned only')).toBeDefined();
    });

    expect(screen.getByText('Authored only')).toBeDefined();
    expect(screen.getByText('owner/assigned-repo #10')).toBeDefined();
    expect(screen.getByText('owner/authored-repo #20')).toBeDefined();
  });

  it('renders Open button when onOpenProject is provided', async () => {
    const onOpenProject = vi.fn();
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [makeItem({ number: 7, title: 'Test issue', repoFullName: 'owner/my-repo' })],
        };
      }
      return undefined;
    });

    render(<OpenIssuesWidget onOpenProject={onOpenProject} />);

    await waitFor(() => {
      expect(screen.getByText('Test issue')).toBeDefined();
    });

    const openButton = screen.getByTitle('Open in Cola Records');
    expect(openButton).toBeDefined();
    fireEvent.click(openButton);
    expect(onOpenProject).toHaveBeenCalledWith('owner/my-repo');
  });

  it('does not render Open button when onOpenProject is not provided', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [makeItem({ number: 7, title: 'Test issue', repoFullName: 'owner/my-repo' })],
        };
      }
      return undefined;
    });

    render(<OpenIssuesWidget />);

    await waitFor(() => {
      expect(screen.getByText('Test issue')).toBeDefined();
    });

    expect(screen.queryByTitle('Open in Cola Records')).toBeNull();
  });
});
