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

import { PRsNeedingAttentionWidget } from '../../../../src/renderer/components/dashboard/PRsNeedingAttentionWidget';

describe('PRsNeedingAttentionWidget', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders empty state when no open PRs', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') return { totalCount: 0, items: [] };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('No open PRs needing attention')).toBeDefined();
    });
  });

  it('renders PR titles with review and CI status', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 100,
              number: 42,
              title: 'Fix the bug',
              state: 'open',
              htmlUrl: '',
              createdAt: '',
              updatedAt: '',
              closedAt: null,
              labels: [],
              repoFullName: 'owner/repo',
              isPullRequest: true,
              author: 'testuser',
            },
          ],
        };
      }
      if (channel === 'github:list-pr-reviews') return [{ state: 'APPROVED', author: 'reviewer' }];
      if (channel === 'github:get-pull-request') return { title: 'Fix the bug', headSha: 'abc123' };
      if (channel === 'github:get-pr-check-status')
        return { state: 'success', total: 3, passed: 3, failed: 0, pending: 0 };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('Fix the bug')).toBeDefined();
    });

    expect(screen.getByText('owner/repo #42')).toBeDefined();
    expect(screen.getByTestId('icon-checkcircle')).toBeDefined();
    expect(screen.getByTestId('icon-circledot')).toBeDefined();
  });

  it('shows changes_requested review state', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 101,
              number: 10,
              title: 'Add feature',
              state: 'open',
              htmlUrl: '',
              createdAt: '',
              updatedAt: '',
              closedAt: null,
              labels: [],
              repoFullName: 'owner/repo',
              isPullRequest: true,
              author: 'testuser',
            },
          ],
        };
      }
      if (channel === 'github:list-pr-reviews')
        return [{ state: 'CHANGES_REQUESTED', author: 'reviewer' }];
      if (channel === 'github:get-pull-request') return { title: 'Add feature', headSha: 'def456' };
      if (channel === 'github:get-pr-check-status')
        return { state: 'failure', total: 2, passed: 1, failed: 1, pending: 0 };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('Add feature')).toBeDefined();
    });

    expect(screen.getByTestId('icon-xcircle')).toBeDefined();
  });

  it('limits to 10 PRs', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      number: i + 1,
      title: `PR ${i + 1}`,
      state: 'open',
      htmlUrl: '',
      createdAt: '',
      updatedAt: '',
      closedAt: null,
      labels: [],
      repoFullName: 'owner/repo',
      isPullRequest: true,
      author: 'testuser',
    }));

    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') return { totalCount: 15, items };
      if (channel === 'github:list-pr-reviews') return [];
      if (channel === 'github:get-pull-request') return { title: 'PR Title', headSha: 'sha' };
      if (channel === 'github:get-pr-check-status')
        return { state: 'pending', total: 0, passed: 0, failed: 0, pending: 0 };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      const items = screen.getAllByText(/owner\/repo #\d+/);
      expect(items.length).toBeLessThanOrEqual(10);
    });
  });

  it('uses involves: query instead of author:', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') return { totalCount: 0, items: [] };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('No open PRs needing attention')).toBeDefined();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'github:search-issues-and-prs',
      'involves:testuser type:pr is:open'
    );
  });

  it('renders no-token fallback when auth fails', async () => {
    mockInvoke.mockRejectedValue(new Error('No token'));

    render(<PRsNeedingAttentionWidget />);

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
    render(<PRsNeedingAttentionWidget />);
    expect(screen.getByText('PRs Needing Attention')).toBeDefined();
  });

  it('renders Open button when onOpenProject is provided', async () => {
    const onOpenProject = vi.fn();
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 100,
              number: 42,
              title: 'Fix the bug',
              state: 'open',
              htmlUrl: '',
              createdAt: '',
              updatedAt: '',
              closedAt: null,
              labels: [],
              repoFullName: 'owner/repo',
              isPullRequest: true,
              author: 'testuser',
            },
          ],
        };
      }
      if (channel === 'github:list-pr-reviews') return [];
      if (channel === 'github:get-pull-request') return { title: 'Fix the bug', headSha: 'abc123' };
      if (channel === 'github:get-pr-check-status')
        return { state: 'success', total: 3, passed: 3, failed: 0, pending: 0 };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget onOpenProject={onOpenProject} />);

    await waitFor(() => {
      expect(screen.getByText('Fix the bug')).toBeDefined();
    });

    const openButton = screen.getByTitle('Open in Cola Records');
    expect(openButton).toBeDefined();
    fireEvent.click(openButton);
    expect(onOpenProject).toHaveBeenCalledWith('owner/repo');
  });

  it('does not render Open button when onOpenProject is not provided', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 100,
              number: 42,
              title: 'Fix the bug',
              state: 'open',
              htmlUrl: '',
              createdAt: '',
              updatedAt: '',
              closedAt: null,
              labels: [],
              repoFullName: 'owner/repo',
              isPullRequest: true,
              author: 'testuser',
            },
          ],
        };
      }
      if (channel === 'github:list-pr-reviews') return [];
      if (channel === 'github:get-pull-request') return { title: 'Fix the bug', headSha: 'abc123' };
      if (channel === 'github:get-pr-check-status')
        return { state: 'success', total: 3, passed: 3, failed: 0, pending: 0 };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('Fix the bug')).toBeDefined();
    });

    expect(screen.queryByTitle('Open in Cola Records')).toBeNull();
  });
});
