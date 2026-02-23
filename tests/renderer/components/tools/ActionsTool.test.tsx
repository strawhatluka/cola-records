import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { ActionsTool } from '../../../../src/renderer/components/tools/ActionsTool';
import { createMockContribution } from '../../../mocks/factories';

const mockRuns = [
  {
    id: 1001,
    name: 'CI',
    displayTitle: 'Fix tests',
    status: 'completed',
    conclusion: 'success',
    headBranch: 'main',
    headSha: 'abc123def456',
    event: 'push',
    runNumber: 42,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T01:00:00Z',
    htmlUrl: 'https://github.com/org/repo/actions/runs/1001',
    actor: 'dev',
    actorAvatarUrl: 'https://avatar.url/dev',
  },
  {
    id: 1002,
    name: 'CI',
    displayTitle: 'Add feature',
    status: 'completed',
    conclusion: 'failure',
    headBranch: 'feature',
    headSha: 'def456ghi789',
    event: 'pull_request',
    runNumber: 43,
    createdAt: '2026-02-02T00:00:00Z',
    updatedAt: '2026-02-02T01:00:00Z',
    htmlUrl: 'https://github.com/org/repo/actions/runs/1002',
    actor: 'contributor',
    actorAvatarUrl: '',
  },
  {
    id: 1003,
    name: 'Deploy',
    displayTitle: 'Deploy staging',
    status: 'in_progress',
    conclusion: null,
    headBranch: 'main',
    headSha: 'ghi789jkl012',
    event: 'push',
    runNumber: 44,
    createdAt: '2026-02-03T00:00:00Z',
    updatedAt: '2026-02-03T00:00:00Z',
    htmlUrl: 'https://github.com/org/repo/actions/runs/1003',
    actor: 'dev',
    actorAvatarUrl: '',
  },
];

const mockJobs = [
  {
    id: 2001,
    name: 'build',
    status: 'completed',
    conclusion: 'success',
    startedAt: '2026-02-01T00:00:00Z',
    completedAt: '2026-02-01T00:05:00Z',
    htmlUrl: 'https://github.com/org/repo/actions/runs/1001/jobs/2001',
    runnerName: 'ubuntu-latest',
    labels: ['ubuntu-latest'],
    steps: [
      { name: 'Checkout', status: 'completed', conclusion: 'success', number: 1 },
      { name: 'Run tests', status: 'completed', conclusion: 'success', number: 2 },
    ],
  },
  {
    id: 2002,
    name: 'deploy',
    status: 'completed',
    conclusion: 'failure',
    startedAt: '2026-02-01T00:05:00Z',
    completedAt: '2026-02-01T00:06:00Z',
    htmlUrl: 'https://github.com/org/repo/actions/runs/1001/jobs/2002',
    runnerName: 'ubuntu-latest',
    labels: ['ubuntu-latest'],
    steps: [{ name: 'Deploy', status: 'completed', conclusion: 'failure', number: 1 }],
  },
];

const defaultProps = {
  contribution: createMockContribution({
    upstreamUrl: 'https://github.com/upstream/repo.git',
  }),
};

function setupMocks(runs = mockRuns, jobs = mockJobs, logs = 'Log line 1\nLog line 2') {
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'github:list-workflow-runs') return runs;
    if (channel === 'github:list-workflow-run-jobs') return jobs;
    if (channel === 'github:get-job-logs') return logs;
    return undefined;
  });
}

describe('ActionsTool', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('List view', () => {
    it('renders loading state then workflow runs', async () => {
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
        expect(screen.getByText('Add feature')).toBeDefined();
      });
    });

    it('shows workflow name for each run', async () => {
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const ciLabels = screen.getAllByText('CI');
        expect(ciLabels.length).toBe(2); // Two runs with workflow name "CI"
        expect(screen.getByText('Deploy')).toBeDefined();
      });
    });

    it('shows run count after loading', async () => {
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('(3)')).toBeDefined();
      });
    });

    it('shows success badge in green', async () => {
      setupMocks([mockRuns[0]]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('success');
        expect(badge.className).toContain('text-green-500');
      });
    });

    it('shows failure badge in red', async () => {
      setupMocks([mockRuns[1]]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('failure');
        expect(badge.className).toContain('text-red-500');
      });
    });

    it('shows in_progress badge in yellow', async () => {
      setupMocks([mockRuns[2]]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('in_progress');
        expect(badge.className).toContain('text-yellow-500');
      });
    });

    it('shows error state with retry button', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeDefined();
        expect(screen.getByText('Retry')).toBeDefined();
      });
    });

    it('shows empty state when no runs', async () => {
      setupMocks([]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No workflow runs found')).toBeDefined();
      });
    });

    it('shows no GitHub repo message when not linked', () => {
      render(
        <ActionsTool
          contribution={createMockContribution({
            repositoryUrl: '',
            upstreamUrl: undefined,
          })}
        />
      );

      expect(screen.getByText('No GitHub repository linked to this project')).toBeDefined();
    });

    it('refresh button calls fetch again', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      // Click refresh
      const refreshIcon = screen.getByTestId('icon-refreshcw');
      const refreshButton = refreshIcon.closest('button');
      expect(refreshButton).not.toBeNull();
      await user.click(refreshButton as HTMLButtonElement);

      // Should have called list-workflow-runs twice (initial + refresh)
      const calls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'github:list-workflow-runs'
      );
      expect(calls.length).toBe(2);
    });
  });

  describe('Run detail view', () => {
    it('navigates to detail when run is clicked', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        // Should show run summary details
        expect(screen.getByText('main')).toBeDefined();
        expect(screen.getByText('push')).toBeDefined();
        expect(screen.getByText('dev')).toBeDefined();
      });
    });

    it('shows run summary (status, branch, event, actor)', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('abc123d')).toBeDefined(); // truncated sha
        expect(screen.getByText('#42')).toBeDefined();
      });
    });

    it('shows workflow name in run summary', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('CI')).toBeDefined(); // Workflow name in summary
      });
    });

    it('fetches and displays jobs', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('build')).toBeDefined();
        expect(screen.getByText('deploy')).toBeDefined();
      });
    });

    it('shows job status badges', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        const badges = screen.getAllByText('success');
        expect(badges.length).toBeGreaterThanOrEqual(1);
        const failBadges = screen.getAllByText('failure');
        expect(failBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('open in GitHub calls shell:open-external', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeDefined();
      });

      await user.click(screen.getByText('GitHub'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'shell:open-external',
        'https://github.com/org/repo/actions/runs/1001'
      );
    });

    it('back button returns to list', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });

      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('Jobs')).toBeDefined();
      });

      // Click back button
      const backIcon = screen.getByTestId('icon-arrowleft');
      const backButton = backIcon.closest('button');
      await user.click(backButton as HTMLButtonElement);

      // Should be back to list view
      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
        expect(screen.getByText('Add feature')).toBeDefined();
      });
    });
  });

  describe('Job logs view', () => {
    it('navigates to logs when job is clicked', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      // Navigate to run detail
      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      // Click a job
      await waitFor(() => {
        expect(screen.getByText('build')).toBeDefined();
      });
      await user.click(screen.getByText('build'));

      // Should show logs
      await waitFor(() => {
        expect(screen.getByText(/Log line 1/)).toBeDefined();
        expect(screen.getByText(/Log line 2/)).toBeDefined();
      });
    });

    it('fetches and displays job logs', async () => {
      const user = userEvent.setup();
      setupMocks(mockRuns, mockJobs, 'Step 1: Checkout\nStep 2: Build\nStep 3: Test');
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('build')).toBeDefined();
      });
      await user.click(screen.getByText('build'));

      await waitFor(() => {
        expect(screen.getByText(/Step 1: Checkout/)).toBeDefined();
        expect(screen.getByText(/Step 3: Test/)).toBeDefined();
      });

      // Verify get-job-logs was called
      expect(mockInvoke).toHaveBeenCalledWith('github:get-job-logs', 'upstream', 'repo', 2001);
    });

    it('back button returns to run detail', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      // Navigate to run detail → job logs
      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('build')).toBeDefined();
      });
      await user.click(screen.getByText('build'));

      await waitFor(() => {
        expect(screen.getByText(/Log line 1/)).toBeDefined();
      });

      // Click back button
      const backIcon = screen.getByTestId('icon-arrowleft');
      const backButton = backIcon.closest('button');
      await user.click(backButton as HTMLButtonElement);

      // Should be back to run detail
      await waitFor(() => {
        expect(screen.getByText('build')).toBeDefined();
        expect(screen.getByText('deploy')).toBeDefined();
        expect(screen.getByText('Jobs')).toBeDefined();
      });
    });
  });
});
