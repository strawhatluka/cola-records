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
  defaultHead: 'user:feature-branch',
  onClose: vi.fn(),
  onCreated: vi.fn(),
};

describe('CreatePullRequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      number: 1,
      url: 'https://github.com/org/repo/pull/1',
      state: 'open',
    });
  });

  it('does not render content when open is false', () => {
    render(<CreatePullRequestModal {...defaultProps} open={false} />);

    expect(screen.queryByPlaceholderText('Pull request title')).not.toBeInTheDocument();
  });

  it('renders form fields when open', () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/branch-name/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('main')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe your changes/)).toBeInTheDocument();
  });

  it('submit button is disabled when title is empty', () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    expect(submitButton).toBeDisabled();
  });

  it('submit button is enabled when title, head, and base have content', async () => {
    const user = userEvent.setup();
    render(<CreatePullRequestModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Pull request title');
    await user.type(titleInput, 'My PR Title');

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    expect(submitButton).not.toBeDisabled();
  });

  it('successful submission calls IPC with correct args and calls onCreated + onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreated = vi.fn();

    render(
      <CreatePullRequestModal
        {...defaultProps}
        onClose={onClose}
        onCreated={onCreated}
      />
    );

    const titleInput = screen.getByPlaceholderText('Pull request title');
    await user.type(titleInput, 'My PR Title');

    const descriptionTextarea = screen.getByPlaceholderText(/Describe your changes/);
    await user.type(descriptionTextarea, 'Some description');

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-pull-request',
        'test-owner',
        'test-repo',
        'My PR Title',
        'user:feature-branch',
        'main',
        'Some description'
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error message when IPC invoke rejects', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('API rate limit exceeded'));
    const user = userEvent.setup();

    render(<CreatePullRequestModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Pull request title');
    await user.type(titleInput, 'My PR Title');

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

  it('pre-fills head from defaultHead prop', () => {
    render(
      <CreatePullRequestModal {...defaultProps} defaultHead="user:feature-branch" />
    );

    const headInput = screen.getByPlaceholderText(/branch-name/) as HTMLInputElement;
    expect(headInput.value).toBe('user:feature-branch');
  });

  it('pre-fills base from defaultBase prop', () => {
    render(
      <CreatePullRequestModal {...defaultProps} defaultBase="develop" />
    );

    const baseInput = screen.getByPlaceholderText('main') as HTMLInputElement;
    expect(baseInput.value).toBe('develop');
  });

  it('base defaults to "main" when defaultBase not provided', () => {
    render(
      <CreatePullRequestModal
        open={true}
        owner="test-owner"
        repo="test-repo"
        defaultHead="user:feature-branch"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const baseInput = screen.getByPlaceholderText('main') as HTMLInputElement;
    expect(baseInput.value).toBe('main');
  });
});
