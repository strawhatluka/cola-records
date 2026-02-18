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

// Mock react-markdown
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

import { CreateSubIssueModal } from '../../../../src/renderer/components/issues/CreateSubIssueModal';

describe('CreateSubIssueModal', () => {
  const defaultProps = {
    open: true,
    owner: 'org',
    repo: 'repo',
    parentIssueNumber: 42,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ number: 99, url: 'https://github.com/org/repo/issues/99' });
  });

  it('renders dialog with title and description', () => {
    render(<CreateSubIssueModal {...defaultProps} />);
    expect(screen.getByText('Create Sub-Issue')).toBeDefined();
    expect(screen.getByText(/Create a new sub-issue/)).toBeDefined();
  });

  it('renders title input, description editor, and labels input', () => {
    render(<CreateSubIssueModal {...defaultProps} />);
    expect(screen.getByPlaceholderText('Title')).toBeDefined();
    expect(screen.getByText('Add a title')).toBeDefined();
    expect(screen.getByText('Add a description')).toBeDefined();
    expect(screen.getByText('Labels')).toBeDefined();
  });

  it('has disabled Create button when title is empty', () => {
    render(<CreateSubIssueModal {...defaultProps} />);
    const createBtn = screen.getByText('Create');
    expect(createBtn.closest('button')!.hasAttribute('disabled')).toBe(true);
  });

  it('enables Create button when title is provided', async () => {
    const user = userEvent.setup();
    render(<CreateSubIssueModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Title'), 'Sub-issue title');
    const createBtn = screen.getByText('Create');
    expect(createBtn.closest('button')!.hasAttribute('disabled')).toBe(false);
  });

  it('calls IPC and callbacks on successful submit', async () => {
    const user = userEvent.setup();
    render(<CreateSubIssueModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Title'), 'Sub-issue title');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-sub-issue',
        'org',
        'repo',
        42,
        'Sub-issue title',
        '',
        undefined
      );
    });
    expect(defaultProps.onCreated).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('passes parsed labels when provided', async () => {
    const user = userEvent.setup();
    render(<CreateSubIssueModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Title'), 'Title');
    await user.type(
      screen.getByPlaceholderText('bug, enhancement (comma-separated, optional)'),
      'bug, enhancement'
    );
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-sub-issue',
        'org',
        'repo',
        42,
        'Title',
        '',
        ['bug', 'enhancement']
      );
    });
  });

  it('shows error on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('API failed'));
    const user = userEvent.setup();
    render(<CreateSubIssueModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('Title'), 'Title');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('API failed')).toBeDefined();
    });
  });

  it('does not render when open is false', () => {
    render(<CreateSubIssueModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Create Sub-Issue')).toBeNull();
  });
});
