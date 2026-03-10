import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

import { GitHubConfigPanel } from '../../../../src/renderer/components/tools/GitHubConfigPanel';
import type {
  GitHubConfigFeature,
  GitHubConfigTemplate,
} from '../../../../src/main/ipc/channels/types';

const mockTemplates: GitHubConfigTemplate[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Default template',
    content: '# Default template content\nSome content here',
    targetPath: 'PULL_REQUEST_TEMPLATE.md',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    description: 'Detailed template',
    content: '# Detailed template content\nMore detailed content',
    targetPath: 'PULL_REQUEST_TEMPLATE.md',
  },
];

const notDeployedFeature: GitHubConfigFeature = {
  id: 'pr-template',
  label: 'PR Template',
  description: 'Pull request template for your repository',
  path: 'PULL_REQUEST_TEMPLATE.md',
  exists: false,
  files: [],
};

const deployedFeature: GitHubConfigFeature = {
  id: 'pr-template',
  label: 'PR Template',
  description: 'Pull request template for your repository',
  path: 'PULL_REQUEST_TEMPLATE.md',
  exists: true,
  files: ['.github/PULL_REQUEST_TEMPLATE.md'],
};

const defaultProps = {
  workingDirectory: '/test/project',
  feature: notDeployedFeature,
  onOpenEditor: vi.fn(),
  onChanged: vi.fn(),
};

describe('GitHubConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:list-templates') return Promise.resolve(mockTemplates);
      if (channel === 'github-config:create-from-template')
        return Promise.resolve({ success: true, message: 'Deployed successfully' });
      if (channel === 'github-config:delete-file')
        return Promise.resolve({ success: true, message: 'Deleted successfully' });
      return Promise.resolve(null);
    });
  });

  // ── Setup Mode (feature.exists = false) ──

  it('shows Deploy button when feature is not deployed', async () => {
    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Deploy')).toBeDefined();
    });
  });

  it('shows feature description in setup mode', async () => {
    await act(async () => {
      render(<GitHubConfigPanel {...defaultProps} />);
    });

    expect(screen.getByText('Pull request template for your repository')).toBeDefined();
  });

  it('fetches templates via github-config:list-templates on mount', async () => {
    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github-config:list-templates', 'pr-template');
    });
  });

  it('shows template preview when templates are loaded', async () => {
    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Default template content/)).toBeDefined();
    });
  });

  it('shows template selector when multiple templates exist', async () => {
    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeDefined();
    });
  });

  it('calls create-from-template IPC on Deploy click', async () => {
    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Deploy')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:create-from-template',
        '/test/project',
        'pr-template',
        'default'
      );
    });
  });

  it('calls onChanged after successful deploy', async () => {
    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Deploy')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(defaultProps.onChanged).toHaveBeenCalled();
    });
  });

  it('shows success message after deploy', async () => {
    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Deploy')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(screen.getByText('Deployed successfully')).toBeDefined();
    });
  });

  // ── Actions Mode (feature.exists = true) ──

  it('shows Edit and Delete buttons when feature is deployed', async () => {
    render(<GitHubConfigPanel {...defaultProps} feature={deployedFeature} />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeDefined();
    });

    // Delete button text
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('shows "deployed" status text in actions mode', async () => {
    render(<GitHubConfigPanel {...defaultProps} feature={deployedFeature} />);

    await waitFor(() => {
      expect(screen.getByText('deployed')).toBeDefined();
    });
  });

  it('calls onOpenEditor when Edit button is clicked', async () => {
    render(<GitHubConfigPanel {...defaultProps} feature={deployedFeature} />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Edit'));
    expect(defaultProps.onOpenEditor).toHaveBeenCalled();
  });

  it('shows delete confirmation when delete button is clicked', async () => {
    render(<GitHubConfigPanel {...defaultProps} feature={deployedFeature} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeDefined();
    });

    // Click the Delete button (get all buttons and find the one with text "Delete")
    const deleteButtons = screen.getAllByText('Delete');
    const deleteButton = deleteButtons[0].closest('button')!;
    await userEvent.click(deleteButton);

    expect(screen.getByText(/Delete .github\/PULL_REQUEST_TEMPLATE.md/)).toBeDefined();
  });

  it('calls delete IPC and onChanged after confirming delete', async () => {
    render(<GitHubConfigPanel {...defaultProps} feature={deployedFeature} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeDefined();
    });

    // Click the Delete button
    const deleteButtons = screen.getAllByText('Delete');
    const deleteButton = deleteButtons[0].closest('button')!;
    await userEvent.click(deleteButton);

    // Click the confirmation Delete button (should be the last one)
    const confirmDeleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(confirmDeleteButtons[confirmDeleteButtons.length - 1]);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:delete-file',
        '/test/project',
        'PULL_REQUEST_TEMPLATE.md'
      );
      expect(defaultProps.onChanged).toHaveBeenCalled();
    });
  });

  it('hides delete confirmation when Cancel is clicked', async () => {
    render(<GitHubConfigPanel {...defaultProps} feature={deployedFeature} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeDefined();
    });

    // Click the Delete button
    const deleteButtons = screen.getAllByText('Delete');
    const deleteButton = deleteButtons[0].closest('button')!;
    await userEvent.click(deleteButton);

    expect(screen.getByText(/Delete .github\/PULL_REQUEST_TEMPLATE.md/)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/Delete .github\/PULL_REQUEST_TEMPLATE.md/)).toBeNull();
  });

  // ── Error handling ──

  it('shows error message when deploy fails', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:list-templates') return Promise.resolve(mockTemplates);
      if (channel === 'github-config:create-from-template')
        return Promise.resolve({ success: false, message: 'Permission denied' });
      return Promise.resolve(null);
    });

    render(<GitHubConfigPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Deploy')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Deploy'));

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });
  });
});
