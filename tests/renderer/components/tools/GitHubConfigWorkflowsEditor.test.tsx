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
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { GitHubConfigWorkflowsEditor } from '../../../../src/renderer/components/tools/GitHubConfigWorkflowsEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  onClose: vi.fn(),
};

describe('GitHubConfigWorkflowsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              label: 'Workflows',
              path: 'workflows',
              category: 'directory',
              exists: true,
              description: 'GitHub Actions workflows',
              files: ['ci.yml', 'release.yml'],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') {
        return Promise.resolve([
          { id: 'node-ci', label: 'Node.js CI', description: 'CI for Node.js projects' },
        ]);
      }
      return Promise.resolve(null);
    });
  });

  it('renders close button and header', async () => {
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeDefined();
    });
    // Close button (X icon) should be present
    expect(screen.getByTestId('icon-x')).toBeDefined();
  });

  it('shows loading state then displays workflow files', async () => {
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);

    // After loading completes, workflow files should appear
    await waitFor(() => {
      expect(screen.getByText('ci.yml')).toBeDefined();
      expect(screen.getByText('release.yml')).toBeDefined();
    });
  });

  it('shows New button to create workflows', async () => {
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('New')).toBeDefined();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<GitHubConfigWorkflowsEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeDefined();
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens edit view with interactive trigger chips when clicking a workflow', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              label: 'Workflows',
              path: 'workflows',
              category: 'directory',
              exists: true,
              description: '',
              files: ['ci.yml'],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file') {
        return Promise.resolve(
          'name: CI\n\non:\n  push:\n    branches: [main, dev]\n  pull_request:\n    branches: [main]\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n'
        );
      }
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());

    await user.click(screen.getByText('ci.yml'));

    // Should show trigger toggle chips
    await waitFor(() => {
      expect(screen.getByTestId('trigger-push')).toBeDefined();
      expect(screen.getByTestId('trigger-pull_request')).toBeDefined();
    });

    // push and pull_request should be active (parsed from YAML)
    const pushChip = screen.getByTestId('trigger-push');
    expect(pushChip.className).toContain('bg-primary');

    // Branch config panels should appear for active triggers
    expect(screen.getByTestId('trigger-config-push')).toBeDefined();
    expect(screen.getByTestId('trigger-config-pull_request')).toBeDefined();

    // Branch chips should show parsed values
    const pushBranches = screen.getByTestId('trigger-push-branches');
    expect(pushBranches.textContent).toContain('main');
    expect(pushBranches.textContent).toContain('dev');

    // Jobs YAML textarea should contain jobs section
    const jobsTextarea = screen.getByTestId('config-jobs') as HTMLTextAreaElement;
    expect(jobsTextarea.value).toContain('runs-on: ubuntu-latest');
  });

  it('toggles a trigger on/off by clicking its chip', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              label: 'Workflows',
              path: 'workflows',
              category: 'directory',
              exists: true,
              description: '',
              files: ['ci.yml'],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file') {
        return Promise.resolve(
          'name: CI\n\non:\n  push:\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n'
        );
      }
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());
    await user.click(screen.getByText('ci.yml'));

    await waitFor(() => expect(screen.getByTestId('trigger-push')).toBeDefined());

    // schedule should be inactive (not in YAML)
    const scheduleChip = screen.getByTestId('trigger-schedule');
    expect(scheduleChip.className).toContain('border-dashed');

    // Click to enable schedule
    await user.click(scheduleChip);

    // Now schedule config panel should appear
    await waitFor(() => {
      expect(screen.getByTestId('trigger-config-schedule')).toBeDefined();
    });
  });

  it('shows empty state when no workflows exist', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') {
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              label: 'Workflows',
              path: 'workflows',
              category: 'directory',
              exists: false,
              description: 'GitHub Actions workflows',
              files: [],
            },
          ],
        });
      }
      if (channel === 'github-config:list-templates') {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No workflows found/)).toBeDefined();
    });
  });
});
