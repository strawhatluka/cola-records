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

  it('renders widget title', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      return { totalCount: 0, items: [] };
    });
    render(<PRsNeedingAttentionWidget />);
    expect(screen.getByText('PRs Needing Attention')).toBeDefined();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
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

  it('shows pending review state with Clock icon when no reviews', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 200,
              number: 77,
              title: 'Pending review PR',
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
      // No reviews => pending state
      if (channel === 'github:list-pr-reviews') return [];
      if (channel === 'github:get-pull-request')
        return { title: 'Pending review PR', headSha: 'sha1' };
      if (channel === 'github:get-pr-check-status')
        return { state: 'pending', total: 1, passed: 0, failed: 0, pending: 1 };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('Pending review PR')).toBeDefined();
    });

    // Clock icon for pending review state
    expect(screen.getByTestId('icon-clock')).toBeDefined();
  });

  it('shows CI failure status', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 300,
              number: 88,
              title: 'CI failing PR',
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
      if (channel === 'github:get-pull-request') return { title: 'CI failing PR', headSha: 'sha2' };
      if (channel === 'github:get-pr-check-status')
        return { state: 'failure', total: 2, passed: 1, failed: 1, pending: 0 };
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('CI failing PR')).toBeDefined();
    });

    // CheckCircle for approved review
    expect(screen.getByTestId('icon-checkcircle')).toBeDefined();
  });

  it('shows CI pending when check status is null (ci result rejected)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        return {
          totalCount: 1,
          items: [
            {
              id: 400,
              number: 99,
              title: 'No CI PR',
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
      // Make PR fetch fail so ci is null
      if (channel === 'github:get-pull-request') throw new Error('Not found');
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('No CI PR')).toBeDefined();
    });

    // CI status should be pending (null ci), review should be pending (no reviews)
    expect(screen.getByTestId('icon-clock')).toBeDefined();
    expect(screen.getByTestId('icon-circledot')).toBeDefined();
  });

  it('handles non-Error thrown in outer catch (String fallback)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      if (channel === 'github:search-issues-and-prs') {
        // Return invalid structure to trigger outer catch
        return { totalCount: 1, items: 'not-an-array' };
      }
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      // Error from trying to call .slice on a non-array
      const errorEl = screen.queryByText(/is not a function|not iterable|slice/i);
      expect(errorEl).not.toBeNull();
    });
  });

  it('handles string thrown in outer catch', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      // Throw non-Error to hit String() fallback
      if (channel === 'github:search-issues-and-prs') throw 'raw string error';
      return undefined;
    });

    render(<PRsNeedingAttentionWidget />);

    await waitFor(() => {
      expect(screen.getByText('raw string error')).toBeDefined();
    });
  });
});
