import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
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

// Mock react-markdown to avoid parsing overhead in tests
vi.mock('react-markdown', () => ({
  default: () => null,
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { CreatePullRequestModal } from '../../../../src/renderer/components/pull-requests/CreatePullRequestModal';

const defaultProps = {
  open: true,
  owner: 'test-owner',
  repo: 'test-repo',
  localPath: '/mock/local/repo',
  branches: ['main', 'develop', 'feature-branch'],
  remotes: [
    {
      name: 'origin',
      fetchUrl: 'https://github.com/test-owner/test-repo.git',
      pushUrl: 'https://github.com/test-owner/test-repo.git',
    },
  ],
  onClose: vi.fn(),
  onCreated: vi.fn(),
};

function setupMockIPC(overrides: { currentBranch?: string; error?: boolean } = {}) {
  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'git:get-current-branch':
        return overrides.currentBranch ?? 'feature-branch';
      case 'git:compare-branches':
        return {
          commits: [],
          files: [],
          totalFilesChanged: 0,
          totalInsertions: 0,
          totalDeletions: 0,
          rawDiff: '',
        };
      case 'git:get-remote-branches':
        return ['main', 'develop', 'feature-branch'];
      case 'git:push':
        return undefined;
      case 'github:create-pull-request':
        if (overrides.error) throw new Error('API rate limit exceeded');
        return { number: 1, url: 'https://github.com/org/repo/pull/1', state: 'open' };
      default:
        return undefined;
    }
  });
}

describe('CreatePullRequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockIPC();
  });

  it('does not render content when open is false', () => {
    render(<CreatePullRequestModal {...defaultProps} open={false} />);

    expect(screen.queryByPlaceholderText('Pull request title')).not.toBeInTheDocument();
  });

  it('renders form fields when open', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
    expect(screen.getByText('Base Branch')).toBeInTheDocument();
    expect(screen.getByText('Compare Branch')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders branch select dropdowns with branches', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    // Base branch defaults to first branch
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    // Compare branch is set from git:get-current-branch
    await waitFor(() => {
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });
  });

  it('auto-fills title from compare branch name', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      // branchToTitle('feature-branch') => 'Feature Branch'
      expect(titleInput.value).toBe('Feature Branch');
    });
  });

  it('submit button exists and can be clicked after title is set', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    // Wait for auto-init (sets base, compare, and title)
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      expect(titleInput.value).not.toBe('');
    });

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    expect(submitButton).toBeInTheDocument();
  });

  it('successful submission calls IPC and triggers callbacks', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreated = vi.fn();

    render(<CreatePullRequestModal {...defaultProps} onClose={onClose} onCreated={onCreated} />);

    // Wait for auto-init
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      expect(titleInput.value).not.toBe('');
    });

    // Clear auto-title and type custom title
    const titleInput = screen.getByPlaceholderText('Pull request title');
    await user.clear(titleInput);
    await user.type(titleInput, 'My PR Title');

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-pull-request',
        'test-owner',
        'test-repo',
        'My PR Title',
        'feature-branch',
        'main',
        ''
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error message when submission fails', async () => {
    setupMockIPC({ error: true });
    const user = userEvent.setup();

    render(<CreatePullRequestModal {...defaultProps} />);

    // Wait for auto-init
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      expect(titleInput.value).not.toBe('');
    });

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument();
    });
  });

  it('cancel button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<CreatePullRequestModal {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('sets base to first branch on open', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    // Base defaults to branches[0] which is 'main'
    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      // First combobox is base branch
      expect(comboboxes[0].textContent).toContain('main');
    });
  });

  it('sets compare to current branch from git', async () => {
    setupMockIPC({ currentBranch: 'develop' });
    render(<CreatePullRequestModal {...defaultProps} />);

    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      // Second combobox is compare branch
      expect(comboboxes[1].textContent).toContain('develop');
    });
  });
});
