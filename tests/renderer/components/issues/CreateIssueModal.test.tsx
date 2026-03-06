import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

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

// Mock MarkdownEditor to avoid Radix Tooltip complexity in jsdom
vi.mock('../../../../src/renderer/components/pull-requests/MarkdownEditor', () => ({
  MarkdownEditor: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) =>
    createElement('textarea', {
      'data-testid': 'markdown-editor',
      value,
      onChange: (e: any) => onChange(e.target.value),
      placeholder,
      disabled,
    }),
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { CreateIssueModal } from '../../../../src/renderer/components/issues/CreateIssueModal';

describe('CreateIssueModal', () => {
  const defaultProps = {
    open: true,
    owner: 'test-org',
    repo: 'test-repo',
    localPath: '/tmp/test-repo',
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:list-issue-templates') return Promise.resolve([]);
      return Promise.resolve({ number: 1, url: 'https://github.com/org/repo/issues/1' });
    });
  });

  it('does not render content when open is false', () => {
    const { container } = render(<CreateIssueModal {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders form fields when open', () => {
    render(<CreateIssueModal {...defaultProps} />);

    expect(screen.getByPlaceholderText('Issue title')).toBeDefined();
    expect(screen.getByPlaceholderText(/Describe the issue/)).toBeDefined();
    expect(screen.getByPlaceholderText(/bug, enhancement/)).toBeDefined();
  });

  it('submit button is disabled when title is empty', () => {
    render(<CreateIssueModal {...defaultProps} />);

    const submitButton = screen.getByText('Create Issue').closest('button');
    expect(submitButton).toBeDefined();
    expect(submitButton!.disabled).toBe(true);
  });

  it('submit button is enabled when title has content', async () => {
    const user = userEvent.setup();
    render(<CreateIssueModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Issue title');
    await user.type(titleInput, 'My new issue');

    const submitButton = screen.getByText('Create Issue').closest('button');
    expect(submitButton!.disabled).toBe(false);
  });

  it('successful submission calls IPC with correct args and calls onCreated + onClose', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(<CreateIssueModal {...defaultProps} onCreated={onCreated} onClose={onClose} />);

    const titleInput = screen.getByPlaceholderText('Issue title');
    const labelsInput = screen.getByPlaceholderText(/bug, enhancement/);

    await user.type(titleInput, 'Bug report');
    await user.type(labelsInput, 'bug, urgent');

    const submitButton = screen.getByText('Create Issue').closest('button');
    await user.click(submitButton!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-issue',
        'test-org',
        'test-repo',
        'Bug report',
        '',
        ['bug', 'urgent']
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message when IPC invoke rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('API rate limit exceeded'));
    const user = userEvent.setup();

    render(<CreateIssueModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Issue title');
    await user.type(titleInput, 'Test issue');

    const submitButton = screen.getByText('Create Issue').closest('button');
    await user.click(submitButton!);

    await waitFor(() => {
      expect(screen.getByText('API rate limit exceeded')).toBeDefined();
    });
  });

  it('cancel button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<CreateIssueModal {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('labels are split by comma and trimmed', async () => {
    const user = userEvent.setup();

    render(<CreateIssueModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Issue title');
    const labelsInput = screen.getByPlaceholderText(/bug, enhancement/);

    await user.type(titleInput, 'Label test');
    await user.type(labelsInput, ' bug , enhancement ');

    const submitButton = screen.getByText('Create Issue').closest('button');
    await user.click(submitButton!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-issue',
        'test-org',
        'test-repo',
        'Label test',
        '',
        ['bug', 'enhancement']
      );
    });
  });
});
