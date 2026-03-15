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

  it('navigates to create view when New button clicked and shows templates', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('New')).toBeDefined());

    await user.click(screen.getByText('New'));

    await waitFor(() => {
      expect(screen.getByText('New Workflow')).toBeDefined();
      expect(screen.getByText('Node.js CI')).toBeDefined();
      expect(screen.getByText('CI for Node.js projects')).toBeDefined();
    });
  });

  it('deploys a template and returns to list view', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('New')).toBeDefined());

    await user.click(screen.getByText('New'));
    await waitFor(() => expect(screen.getByText('Node.js CI')).toBeDefined());

    await user.click(screen.getByText('Node.js CI'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:create-from-template',
        '/test/project',
        'workflows',
        'node-ci'
      );
    });
  });

  it('shows delete confirmation when trash icon clicked', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());

    // Click the first delete (trash) icon
    const trashIcons = screen.getAllByTestId('icon-trash2');
    await user.click(trashIcons[0].closest('button')!);

    expect(screen.getByText('Delete')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('deletes workflow when confirmed', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());

    const trashIcons = screen.getAllByTestId('icon-trash2');
    await user.click(trashIcons[0].closest('button')!);
    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:delete-file',
        '/test/project',
        'workflows/ci.yml'
      );
    });
  });

  it('cancels delete when Cancel clicked', async () => {
    const user = userEvent.setup();
    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());

    const trashIcons = screen.getAllByTestId('icon-trash2');
    await user.click(trashIcons[0].closest('button')!);
    expect(screen.getByText('Delete')).toBeDefined();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('saves workflow via Save button', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['ci.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          'name: CI\n\non:\n  push:\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n'
        );
      if (channel === 'github-config:write-file')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());
    await user.click(screen.getByText('ci.yml'));

    await waitFor(() => expect(screen.getByTestId('trigger-push')).toBeDefined());

    // Enable schedule trigger to make dirty
    await user.click(screen.getByTestId('trigger-schedule'));
    await waitFor(() => expect(screen.getByText('unsaved')).toBeDefined());

    // Click Save
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:write-file',
        '/test/project',
        'workflows/ci.yml',
        expect.any(String)
      );
    });
  });

  it('shows unsaved changes prompt when navigating back with dirty state', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['ci.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          'name: CI\n\non:\n  push:\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n'
        );
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());
    await user.click(screen.getByText('ci.yml'));

    await waitFor(() => expect(screen.getByTestId('trigger-push')).toBeDefined());

    // Make dirty by toggling a trigger
    await user.click(screen.getByTestId('trigger-schedule'));

    // Click back (ArrowLeft)
    const backBtn = screen.getByTestId('icon-arrowleft').closest('button')!;
    await user.click(backBtn);

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    expect(screen.getByText('Save and close')).toBeDefined();
    expect(screen.getByText('Close without saving')).toBeDefined();
  });

  it('shows schedule cron config with presets', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['ci.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          "name: CI\n\non:\n  schedule:\n    - cron: '0 0 * * *'\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n"
        );
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());
    await user.click(screen.getByText('ci.yml'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-config-schedule')).toBeDefined();
      expect(screen.getByTestId('trigger-schedule-cron')).toBeDefined();
    });

    // Cron presets should be visible
    expect(screen.getByText('Daily')).toBeDefined();
    expect(screen.getByText('Weekly')).toBeDefined();
    expect(screen.getByText('Monthly')).toBeDefined();

    // Click Weekly preset
    await user.click(screen.getByText('Weekly'));
    expect((screen.getByTestId('trigger-schedule-cron') as HTMLInputElement).value).toBe(
      '0 0 * * 0'
    );
  });

  it('shows workflow_dispatch config panel with manual trigger message', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['ci.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          'name: CI\n\non:\n  workflow_dispatch:\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n'
        );
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());
    await user.click(screen.getByText('ci.yml'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-config-workflow_dispatch')).toBeDefined();
      expect(screen.getByText(/Manual trigger/)).toBeDefined();
    });
  });

  it('parses push trigger with inline tags and shows tags ChipInput', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['release.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          'name: Release\n\non:\n  push:\n    tags: [v*]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n'
        );
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('release.yml')).toBeDefined());
    await user.click(screen.getByText('release.yml'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-config-push')).toBeDefined();
      expect(screen.getByTestId('trigger-push-tags')).toBeDefined();
    });

    const tagsChip = screen.getByTestId('trigger-push-tags');
    expect(tagsChip.textContent).toContain('v*');
  });

  it('parses push trigger with multiline tags', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['release.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          "name: Release\n\non:\n  push:\n    tags:\n      - 'v*.*.*'\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n"
        );
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('release.yml')).toBeDefined());
    await user.click(screen.getByText('release.yml'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-push-tags')).toBeDefined();
    });

    const tagsChip = screen.getByTestId('trigger-push-tags');
    expect(tagsChip.textContent).toContain('v*.*.*');
  });

  it('parses push trigger with both branches and tags', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['ci.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          'name: CI\n\non:\n  push:\n    branches: [main]\n    tags: [v*]\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n'
        );
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());
    await user.click(screen.getByText('ci.yml'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-push-branches')).toBeDefined();
      expect(screen.getByTestId('trigger-push-tags')).toBeDefined();
    });

    const branchesChip = screen.getByTestId('trigger-push-branches');
    expect(branchesChip.textContent).toContain('main');

    const tagsChip = screen.getByTestId('trigger-push-tags');
    expect(tagsChip.textContent).toContain('v*');
  });

  it('round-trips tags through parse and serialize (save preserves tags)', async () => {
    const user = userEvent.setup();
    let savedContent = '';
    mockInvoke.mockImplementation((channel: string, ...args: unknown[]) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['release.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          'name: Release\n\non:\n  push:\n    tags: [v*]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n'
        );
      if (channel === 'github-config:write-file') {
        savedContent = args[2] as string;
        return Promise.resolve({ success: true, message: 'Saved' });
      }
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('release.yml')).toBeDefined());
    await user.click(screen.getByText('release.yml'));

    await waitFor(() => expect(screen.getByTestId('trigger-push-tags')).toBeDefined());

    // Toggle schedule to make dirty so we can save
    await user.click(screen.getByTestId('trigger-schedule'));
    await waitFor(() => expect(screen.getByText('unsaved')).toBeDefined());

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:write-file',
        '/test/project',
        'workflows/release.yml',
        expect.any(String)
      );
    });

    // Verify saved content preserves tags
    expect(savedContent).toContain('tags: [v*]');
  });

  it('shows paths and paths-ignore ChipInputs for push trigger', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan')
        return Promise.resolve({
          features: [
            {
              id: 'workflows',
              files: ['ci.yml'],
              exists: true,
              label: '',
              path: '',
              category: 'directory',
              description: '',
            },
          ],
        });
      if (channel === 'github-config:list-templates') return Promise.resolve([]);
      if (channel === 'github-config:read-file')
        return Promise.resolve(
          'name: CI\n\non:\n  push:\n    branches: [main]\n\njobs:\n  ci:\n    runs-on: ubuntu-latest\n'
        );
      return Promise.resolve(null);
    });

    render(<GitHubConfigWorkflowsEditor {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('ci.yml')).toBeDefined());
    await user.click(screen.getByText('ci.yml'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-push-paths')).toBeDefined();
      expect(screen.getByTestId('trigger-push-paths-ignore')).toBeDefined();
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
