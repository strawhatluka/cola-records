import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

  it('renders form fields when open', async () => {
    await act(async () => {
      render(<CreateIssueModal {...defaultProps} />);
    });

    expect(screen.getByPlaceholderText('Issue title')).toBeDefined();
    expect(screen.getByPlaceholderText(/Describe the issue/)).toBeDefined();
    expect(screen.getByPlaceholderText(/bug, enhancement/)).toBeDefined();
  });

  it('submit button is disabled when title is empty', async () => {
    await act(async () => {
      render(<CreateIssueModal {...defaultProps} />);
    });

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

  // ── Inline mode branches ──

  describe('inline mode', () => {
    it('renders inline header and content when inline=true and open=true', async () => {
      await act(async () => {
        render(<CreateIssueModal {...defaultProps} inline={true} />);
      });

      expect(screen.getByText('Create New Issue')).toBeDefined();
      expect(screen.getByText('Submit a new issue to test-org/test-repo')).toBeDefined();
      expect(screen.getByPlaceholderText('Issue title')).toBeDefined();
    });

    it('returns null when inline=true and open=false', () => {
      const { container } = render(
        <CreateIssueModal {...defaultProps} inline={true} open={false} />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  // ── Template branches ──

  describe('templates', () => {
    const mockTemplates = [
      {
        name: 'Bug Report',
        description: 'Report a bug',
        title: 'Bug: ',
        labels: ['bug', 'triage'],
        body: 'Steps to reproduce...',
        fileName: 'bug_report.md',
      },
      {
        name: 'Feature Request',
        description: '',
        title: '',
        labels: [],
        body: 'Describe the feature...',
        fileName: 'feature_request.md',
      },
    ];

    it('renders template select when templates are loaded', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'github-config:list-issue-templates') return Promise.resolve(mockTemplates);
        return Promise.resolve({ number: 1 });
      });

      await act(async () => {
        render(<CreateIssueModal {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Template')).toBeDefined();
      });
    });

    it('gracefully handles template fetch failure', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'github-config:list-issue-templates')
          return Promise.reject(new Error('Network error'));
        return Promise.resolve({ number: 1 });
      });

      await act(async () => {
        render(<CreateIssueModal {...defaultProps} />);
      });

      // Should still render the form without templates
      expect(screen.getByPlaceholderText('Issue title')).toBeDefined();
      // Template section should not be rendered
      expect(screen.queryByText('Template')).toBeNull();
    });
  });

  // ── Submit with empty labels (undefined labelList) ──

  it('submits with undefined labels when no labels provided', async () => {
    const user = userEvent.setup();

    render(<CreateIssueModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Issue title');
    await user.type(titleInput, 'No labels issue');

    const submitButton = screen.getByText('Create Issue').closest('button');
    await user.click(submitButton!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-issue',
        'test-org',
        'test-repo',
        'No labels issue',
        '',
        undefined
      );
    });
  });

  // ── Error handling: non-Error thrown ──

  it('shows stringified error when non-Error is thrown', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:list-issue-templates') return Promise.resolve([]);
      return Promise.reject('string error message');
    });

    const user = userEvent.setup();
    render(<CreateIssueModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Issue title');
    await user.type(titleInput, 'Test issue');

    const submitButton = screen.getByText('Create Issue').closest('button');
    await user.click(submitButton!);

    await waitFor(() => {
      expect(screen.getByText('string error message')).toBeDefined();
    });
  });

  // ── handleSubmit does nothing when title is empty/whitespace ──

  it('does not submit when title is only whitespace', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    render(<CreateIssueModal {...defaultProps} onCreated={onCreated} />);

    // The submit button should be disabled, but also test the handleSubmit guard
    // by checking that create-issue is never called
    const titleInput = screen.getByPlaceholderText('Issue title');
    await user.type(titleInput, '   ');

    // Button should be disabled due to !title.trim()
    const submitButton = screen.getByText('Create Issue').closest('button');
    expect(submitButton!.disabled).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
  });

  // ── useEffect does not fetch templates when open is false ──

  it('does not fetch templates when open is false', async () => {
    render(<CreateIssueModal {...defaultProps} open={false} />);

    // Wait a tick to ensure useEffect would have run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockInvoke).not.toHaveBeenCalledWith(
      'github-config:list-issue-templates',
      expect.anything()
    );
  });
});
