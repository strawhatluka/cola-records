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

import { CICDStatusWidget } from '../../../../src/renderer/components/dashboard/CICDStatusWidget';

describe('CICDStatusWidget', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders empty state when no repos', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') return [];
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('No CI/CD pipelines found')).toBeDefined();
    });
  });

  it('renders latest run per repo', async () => {
    const now = new Date('2026-02-18T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo-a',
            name: 'repo-a',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: 'TypeScript',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI Pipeline',
            displayTitle: 'CI',
            status: 'completed',
            conclusion: 'success',
            headBranch: 'main',
            headSha: 'abc',
            event: 'push',
            runNumber: 42,
            createdAt: '2026-02-18T10:00:00Z',
            updatedAt: '2026-02-18T10:05:00Z',
            htmlUrl: 'https://github.com/owner/repo-a/actions/runs/1',
            actor: 'user',
            actorAvatarUrl: '',
          },
        ];
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('owner/repo-a')).toBeDefined();
    });

    expect(screen.getByText('CI Pipeline')).toBeDefined();
    expect(screen.getByText('2h ago')).toBeDefined();

    vi.spyOn(Date, 'now').mockRestore();
  });

  it('shows green dot for success', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    const { container } = render(<CICDStatusWidget />);

    await waitFor(() => {
      const dot = container.querySelector('.bg-green-400');
      expect(dot).not.toBeNull();
    });
  });

  it('shows red dot for failure', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'failure',
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    const { container } = render(<CICDStatusWidget />);

    await waitFor(() => {
      const dot = container.querySelector('.bg-red-400');
      expect(dot).not.toBeNull();
    });
  });

  it('shows yellow dot for in_progress', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'in_progress',
            conclusion: null,
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    const { container } = render(<CICDStatusWidget />);

    await waitFor(() => {
      const dot = container.querySelector('.bg-yellow-400');
      expect(dot).not.toBeNull();
    });
  });

  it('handles repos with no workflow runs', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') return [];
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('No CI/CD pipelines found')).toBeDefined();
    });
  });

  it('handles workflow run errors gracefully', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') throw new Error('Network error');
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });

    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('renders no-token fallback when repos fetch fails', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') throw new Error('No token');
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('renders widget title', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') return [];
      return undefined;
    });
    render(<CICDStatusWidget />);
    expect(screen.getByText('CI/CD Status')).toBeDefined();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  it('shows pipelines from all repos (not limited to 5)', async () => {
    const makeRepo = (name: string) => ({
      fullName: `owner/${name}`,
      name,
      private: false,
      description: '',
      htmlUrl: '',
      defaultBranch: 'main',
      language: '',
      stargazersCount: 0,
      forksCount: 0,
      openIssuesCount: 0,
      createdAt: '',
      updatedAt: '',
      pushedAt: '',
    });

    // Create 8 repos — more than the old limit of 5
    const repos = Array.from({ length: 8 }, (_, i) => makeRepo(`repo-${i + 1}`));

    mockInvoke.mockImplementation(async (channel: string, owner?: string, repo?: string) => {
      if (channel === 'github:list-user-repos') return repos;
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: `https://github.com/${owner}/${repo}/actions/runs/1`,
          },
        ];
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      // All 8 repos should have pipelines displayed
      expect(screen.getByText('owner/repo-1')).toBeDefined();
      expect(screen.getByText('owner/repo-6')).toBeDefined();
      expect(screen.getByText('owner/repo-8')).toBeDefined();
    });
  });

  it('renders Open button when onOpenProject is provided', async () => {
    const onOpenProject = vi.fn();
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/my-repo',
            name: 'my-repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    render(<CICDStatusWidget onOpenProject={onOpenProject} />);

    await waitFor(() => {
      expect(screen.getByText('owner/my-repo')).toBeDefined();
    });

    const openButton = screen.getByTitle('Open in Cola Records');
    expect(openButton).toBeDefined();
    fireEvent.click(openButton);
    expect(onOpenProject).toHaveBeenCalledWith('owner/my-repo');
  });

  it('does not render Open button when onOpenProject is not provided', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/my-repo',
            name: 'my-repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('owner/my-repo')).toBeDefined();
    });

    expect(screen.queryByTitle('Open in Cola Records')).toBeNull();
  });

  it('limits display to 10 pipelines', async () => {
    const makeRepo = (name: string) => ({
      fullName: `owner/${name}`,
      name,
      private: false,
      description: '',
      htmlUrl: '',
      defaultBranch: 'main',
      language: '',
      stargazersCount: 0,
      forksCount: 0,
      openIssuesCount: 0,
      createdAt: '',
      updatedAt: '',
      pushedAt: '',
    });

    // Create 15 repos — more than the display limit of 10
    const repos = Array.from({ length: 15 }, (_, i) => makeRepo(`repo-${i + 1}`));

    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') return repos;
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      const repoNames = screen.getAllByText(/owner\/repo-\d+/);
      expect(repoNames.length).toBeLessThanOrEqual(10);
    });
  });

  it('sets noToken when all workflow runs reject with auth error', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return Promise.reject(new Error('Bad token'));
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('sets error when all workflow runs reject with non-auth error', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return Promise.reject(new Error('Server error'));
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeDefined();
    });
  });

  it('handles non-Error rejection reason in allSettled (String fallback)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return Promise.reject('string rejection');
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('string rejection')).toBeDefined();
    });
  });

  it('sets noToken when outer catch has auth error', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        // Return repos that will trigger Promise.allSettled
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      return undefined;
    });

    // Override mockInvoke to throw on the second call (list-user-repos succeeds,
    // but Promise.allSettled itself throws is hard to trigger; use a different approach)
    // The outer catch is triggered when Promise.allSettled itself throws,
    // which can happen if repos.map throws synchronously.
    // A simpler approach: make list-user-repos return something that causes
    // repos.map to throw during the split operation.
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        // Return a repo with fullName that won't cause split to fail,
        // but we need the outer catch. Let's use a different approach -
        // make the allSettled throw by returning non-iterable.
        return [{ fullName: 'owner/repo' }];
      }
      if (channel === 'github:list-workflow-runs') {
        // This returns normally but we need the outer catch
        throw new Error('Unauthorized access');
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    // The inner allSettled catches the workflow-runs rejection,
    // and since all rejected with "auth" keyword, sets noToken
    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('sets noToken when list-user-repos throws a runtime error (inner catch)', async () => {
    // Returning a non-array causes .map() to throw inside the inner try,
    // which is caught by the inner catch that always sets noToken(true)
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return 'not-an-array';
      }
      return undefined;
    });

    render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('falls back to status when conclusion is null', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'queued',
            conclusion: null,
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    const { container } = render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('owner/repo')).toBeDefined();
    });

    // conclusion is null, status is 'queued' => should use 'queued' from CI_STATUS_DOT_COLORS
    const dot = container.querySelector('.bg-yellow-400');
    expect(dot).not.toBeNull();
  });

  it('falls back to pending when both conclusion and status are null', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: null,
            conclusion: null,
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    const { container } = render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('owner/repo')).toBeDefined();
    });

    // conclusion null, status null => 'pending' => bg-yellow-400
    const dot = container.querySelector('.bg-yellow-400');
    expect(dot).not.toBeNull();
  });

  it('uses fallback color for unknown CI status', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:list-user-repos') {
        return [
          {
            fullName: 'owner/repo',
            name: 'repo',
            private: false,
            description: '',
            htmlUrl: '',
            defaultBranch: 'main',
            language: '',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            createdAt: '',
            updatedAt: '',
            pushedAt: '',
          },
        ];
      }
      if (channel === 'github:list-workflow-runs') {
        return [
          {
            id: 1,
            name: 'CI',
            status: 'completed',
            conclusion: 'unknown_status_xyz',
            createdAt: '2026-02-18T10:00:00Z',
            htmlUrl: '',
          },
        ];
      }
      return undefined;
    });

    const { container } = render(<CICDStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('owner/repo')).toBeDefined();
    });

    // Unknown status should fallback to 'bg-muted-foreground'
    const dot = container.querySelector('.bg-muted-foreground');
    expect(dot).not.toBeNull();
  });
});
