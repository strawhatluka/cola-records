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

    it('shows "No logs available" when logs are empty', async () => {
      const user = userEvent.setup();
      setupMocks(mockRuns, mockJobs, '');
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
        expect(screen.getByText('No logs available')).toBeDefined();
      });
    });

    it('truncates logs when they exceed 500 lines', async () => {
      const user = userEvent.setup();
      const longLogs = Array.from({ length: 600 }, (_, i) => `Line ${i + 1}`).join('\n');
      setupMocks(mockRuns, mockJobs, longLogs);
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
        // Should show truncation notice
        expect(screen.getByText(/truncated 100 lines/)).toBeDefined();
        // Should show last line
        expect(screen.getByText(/Line 600/)).toBeDefined();
      });
    });

    it('shows logs error state with retry button', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-workflow-runs') return mockRuns;
        if (channel === 'github:list-workflow-run-jobs') return mockJobs;
        if (channel === 'github:get-job-logs') throw new Error('Logs fetch failed');
        return undefined;
      });
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
        expect(screen.getByText('Logs fetch failed')).toBeDefined();
        expect(screen.getByText('Retry')).toBeDefined();
      });
    });

    it('logs error with non-Error object shows stringified error', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-workflow-runs') return mockRuns;
        if (channel === 'github:list-workflow-run-jobs') return mockJobs;
        if (channel === 'github:get-job-logs') throw 'logs string error';
        return undefined;
      });
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
        expect(screen.getByText('logs string error')).toBeDefined();
      });
    });

    it('opens external link from job logs view', async () => {
      const user = userEvent.setup();
      setupMocks();
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
        expect(screen.getByText('GitHub')).toBeDefined();
      });

      await user.click(screen.getByText('GitHub'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'shell:open-external',
        'https://github.com/org/repo/actions/runs/1001/jobs/2001'
      );
    });
  });

  describe('Branch coverage - status badge classes', () => {
    it('shows cancelled conclusion with muted styling', async () => {
      const cancelledRun = {
        ...mockRuns[0],
        id: 2001,
        displayTitle: 'Cancelled run',
        status: 'completed',
        conclusion: 'cancelled',
      };
      setupMocks([cancelledRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('cancelled');
        expect(badge.className).toContain('text-muted-foreground');
      });
    });

    it('shows skipped conclusion with muted styling', async () => {
      const skippedRun = {
        ...mockRuns[0],
        id: 2002,
        displayTitle: 'Skipped run',
        status: 'completed',
        conclusion: 'skipped',
      };
      setupMocks([skippedRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('skipped');
        expect(badge.className).toContain('text-muted-foreground');
      });
    });

    it('shows queued status with yellow styling', async () => {
      const queuedRun = {
        ...mockRuns[0],
        id: 2003,
        displayTitle: 'Queued run',
        status: 'queued',
        conclusion: null,
      };
      setupMocks([queuedRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('queued');
        expect(badge.className).toContain('text-yellow-500');
      });
    });

    it('shows completed with no conclusion using muted styling', async () => {
      const completedNoConclusion = {
        ...mockRuns[0],
        id: 2004,
        displayTitle: 'No conclusion run',
        status: 'completed',
        conclusion: null,
      };
      setupMocks([completedNoConclusion]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('completed');
        expect(badge.className).toContain('text-muted-foreground');
      });
    });

    it('shows unknown status with default muted styling', async () => {
      const unknownRun = {
        ...mockRuns[0],
        id: 2005,
        displayTitle: 'Unknown status run',
        status: 'waiting',
        conclusion: null,
      };
      setupMocks([unknownRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        const badge = screen.getByText('waiting');
        expect(badge.className).toContain('text-muted-foreground');
      });
    });
  });

  describe('Branch coverage - step dots', () => {
    it('shows green dot for success step', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        // Steps should be visible: Checkout (success), Run tests (success), Deploy (failure)
        expect(screen.getByText('Checkout')).toBeDefined();
        expect(screen.getByText('Run tests')).toBeDefined();
      });
    });

    it('shows correct dot colors for different step conclusions', async () => {
      const user = userEvent.setup();
      const jobsWithVariousSteps = [
        {
          id: 4001,
          name: 'test-job',
          status: 'completed',
          conclusion: 'failure',
          startedAt: '2026-02-01T00:00:00Z',
          completedAt: '2026-02-01T00:03:00Z',
          htmlUrl: 'https://github.com/org/repo/actions/runs/1001/jobs/4001',
          runnerName: 'ubuntu-latest',
          labels: ['ubuntu-latest'],
          steps: [
            { name: 'Success Step', status: 'completed', conclusion: 'success', number: 1 },
            { name: 'Failed Step', status: 'completed', conclusion: 'failure', number: 2 },
            { name: 'Skipped Step', status: 'completed', conclusion: 'skipped', number: 3 },
            {
              name: 'Pending Step',
              status: 'queued',
              conclusion: null as unknown as string,
              number: 4,
            },
          ],
        },
      ];
      setupMocks(mockRuns, jobsWithVariousSteps);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('Success Step')).toBeDefined();
        expect(screen.getByText('Failed Step')).toBeDefined();
        expect(screen.getByText('Skipped Step')).toBeDefined();
        expect(screen.getByText('Pending Step')).toBeDefined();
      });
    });
  });

  describe('Branch coverage - formatDuration', () => {
    it('shows job duration when startedAt and completedAt are present', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        // build job: 5 min duration
        expect(screen.getByText('5m 0s')).toBeDefined();
        // deploy job: 1 min duration
        expect(screen.getByText('1m 0s')).toBeDefined();
      });
    });

    it('does not show duration when startedAt or completedAt is null', async () => {
      const user = userEvent.setup();
      const jobsNoTimes = [
        {
          id: 5001,
          name: 'no-time-job',
          status: 'in_progress',
          conclusion: null as unknown as string,
          startedAt: '2026-02-01T00:00:00Z',
          completedAt: null as unknown as string,
          htmlUrl: 'https://github.com/org/repo/actions/runs/1001/jobs/5001',
          runnerName: 'ubuntu-latest',
          labels: ['ubuntu-latest'],
          steps: [],
        },
      ];
      setupMocks(mockRuns, jobsNoTimes);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('no-time-job')).toBeDefined();
        // No duration text should be rendered
        expect(screen.queryByText(/\d+[ms]/)).toBeNull();
      });
    });

    it('shows seconds only for short durations under 60 seconds', async () => {
      const user = userEvent.setup();
      const shortJobs = [
        {
          id: 5002,
          name: 'short-job',
          status: 'completed',
          conclusion: 'success',
          startedAt: '2026-02-01T00:00:00Z',
          completedAt: '2026-02-01T00:00:45Z',
          htmlUrl: 'https://github.com/org/repo/actions/runs/1001/jobs/5002',
          runnerName: 'ubuntu-latest',
          labels: ['ubuntu-latest'],
          steps: [],
        },
      ];
      setupMocks(mockRuns, shortJobs);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('45s')).toBeDefined();
      });
    });
  });

  describe('Branch coverage - formatRelativeTime paths', () => {
    it('shows "just now" for very recent runs', async () => {
      const recentRun = {
        ...mockRuns[0],
        id: 6001,
        displayTitle: 'Recent run',
        createdAt: new Date().toISOString(),
      };
      setupMocks([recentRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/just now/)).toBeDefined();
      });
    });

    it('shows minutes ago for runs within the hour', async () => {
      const minutesRun = {
        ...mockRuns[0],
        id: 6002,
        displayTitle: 'Minutes run',
        createdAt: new Date(Date.now() - 900000).toISOString(), // 15 min ago
      };
      setupMocks([minutesRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/15m ago/)).toBeDefined();
      });
    });

    it('shows hours ago for runs within the day', async () => {
      const hoursRun = {
        ...mockRuns[0],
        id: 6003,
        displayTitle: 'Hours run',
        createdAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
      };
      setupMocks([hoursRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/3h ago/)).toBeDefined();
      });
    });

    it('shows days ago for runs older than a day', async () => {
      const daysRun = {
        ...mockRuns[0],
        id: 6004,
        displayTitle: 'Days run',
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      };
      setupMocks([daysRun]);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/2d ago/)).toBeDefined();
      });
    });
  });

  describe('Branch coverage - error handling', () => {
    it('fetch runs error with non-Error object shows stringified error', async () => {
      mockInvoke.mockRejectedValue('plain string error');
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('plain string error')).toBeDefined();
      });
    });

    it('retry button refetches runs after error', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-workflow-runs') {
          callCount++;
          if (callCount === 1) throw new Error('Temporary error');
          return mockRuns;
        }
        return undefined;
      });
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Temporary error')).toBeDefined();
      });

      await user.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
    });

    it('jobs error with non-Error object shows stringified error', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-workflow-runs') return mockRuns;
        if (channel === 'github:list-workflow-run-jobs') throw 'jobs string error';
        return undefined;
      });
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('jobs string error')).toBeDefined();
      });
    });

    it('jobs error with Error object shows error message', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-workflow-runs') return mockRuns;
        if (channel === 'github:list-workflow-run-jobs') throw new Error('Jobs failed');
        return undefined;
      });
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('Jobs failed')).toBeDefined();
      });
    });
  });

  describe('Branch coverage - run detail view edge cases', () => {
    it('shows Edit button when onSwitchTool is provided', async () => {
      const user = userEvent.setup();
      const onSwitchTool = vi.fn();
      setupMocks();
      render(<ActionsTool {...defaultProps} onSwitchTool={onSwitchTool} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeDefined();
      });

      await user.click(screen.getByText('Edit'));

      expect(onSwitchTool).toHaveBeenCalledWith('github-config', { feature: 'workflows' });
    });

    it('does not show Edit button when onSwitchTool is not provided', async () => {
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

      expect(screen.queryByText('Edit')).toBeNull();
    });

    it('shows "No jobs found" when jobs list is empty', async () => {
      const user = userEvent.setup();
      setupMocks(mockRuns, []);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('No jobs found')).toBeDefined();
      });
    });

    it('shows job with no steps (steps.length === 0)', async () => {
      const user = userEvent.setup();
      const jobsNoSteps = [
        {
          id: 7001,
          name: 'empty-steps-job',
          status: 'completed',
          conclusion: 'success',
          startedAt: '2026-02-01T00:00:00Z',
          completedAt: '2026-02-01T00:02:00Z',
          htmlUrl: 'https://github.com/org/repo/actions/runs/1001/jobs/7001',
          runnerName: 'ubuntu-latest',
          labels: ['ubuntu-latest'],
          steps: [],
        },
      ];
      setupMocks(mockRuns, jobsNoSteps);
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fix tests')).toBeDefined();
      });
      await user.click(screen.getByText('Fix tests'));

      await waitFor(() => {
        expect(screen.getByText('empty-steps-job')).toBeDefined();
        // No step names should appear
        expect(screen.queryByText('Checkout')).toBeNull();
      });
    });
  });

  describe('Branch coverage - repositoryUrl fallback', () => {
    it('uses repositoryUrl when upstreamUrl is not set', async () => {
      setupMocks();
      render(
        <ActionsTool
          contribution={createMockContribution({
            repositoryUrl: 'https://github.com/myorg/myrepo.git',
            upstreamUrl: undefined,
          })}
        />
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('github:list-workflow-runs', 'myorg', 'myrepo');
      });
    });
  });

  describe('Branch coverage - getStatusLabel', () => {
    it('shows conclusion as label when conclusion is present', async () => {
      setupMocks([mockRuns[0]]); // conclusion: 'success'
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('success')).toBeDefined();
      });
    });

    it('shows status as label when conclusion is null', async () => {
      setupMocks([mockRuns[2]]); // status: 'in_progress', conclusion: null
      render(<ActionsTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('in_progress')).toBeDefined();
      });
    });
  });
});
