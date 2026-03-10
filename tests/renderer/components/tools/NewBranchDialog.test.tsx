import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock Radix Dialog
vi.mock('@radix-ui/react-dialog', async () => import('../../../mocks/radix-dialog'));

// Mock Radix Select
vi.mock('@radix-ui/react-select', async () => import('../../../mocks/radix-select'));

// Mock IPC client
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { NewBranchDialog } from '../../../../src/renderer/components/tools/NewBranchDialog';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  workingDirectory: '/test/project',
  onBranchCreated: vi.fn(),
};

describe('NewBranchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('renders dialog title and description when open', () => {
    render(<NewBranchDialog {...defaultProps} />);

    expect(screen.getByText('New Branch')).toBeDefined();
    expect(screen.getByText('Create and checkout a new branch from HEAD.')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(<NewBranchDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('New Branch')).toBeNull();
  });

  it('renders prefix selector with feat/ as default', () => {
    render(<NewBranchDialog {...defaultProps} />);

    expect(screen.getByText('Prefix')).toBeDefined();
    // Default prefix appears in trigger display and options list
    expect(screen.getAllByText('feat/').length).toBeGreaterThanOrEqual(1);
  });

  it('renders all 7 prefix options', () => {
    render(<NewBranchDialog {...defaultProps} />);

    // feat/ may appear multiple times (trigger + option), others appear once
    const uniquePrefixes = ['fix/', 'refactor/', 'chore/', 'docs/', 'test/', 'hotfix/'];
    for (const prefix of uniquePrefixes) {
      expect(screen.getByText(prefix)).toBeDefined();
    }
    expect(screen.getAllByText('feat/').length).toBeGreaterThanOrEqual(1);
  });

  it('renders branch name input', () => {
    render(<NewBranchDialog {...defaultProps} />);

    expect(screen.getByText('Branch Name')).toBeDefined();
    expect(screen.getByPlaceholderText('my-feature-name')).toBeDefined();
  });

  it('shows live preview when name is entered', async () => {
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'add login');

    expect(screen.getByText('feat/add-login')).toBeDefined();
  });

  it('converts spaces to hyphens in preview', async () => {
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'my new feature');

    expect(screen.getByText('feat/my-new-feature')).toBeDefined();
  });

  it('strips special characters from name', async () => {
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'my@feature!name');

    expect(screen.getByText('feat/myfeaturename')).toBeDefined();
  });

  it('disables Create Branch button when name is empty', () => {
    render(<NewBranchDialog {...defaultProps} />);

    const createButton = screen.getByText('Create Branch').closest('button');
    expect(createButton?.disabled).toBe(true);
  });

  it('enables Create Branch button when valid name is entered', async () => {
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'valid-name');

    const createButton = screen.getByText('Create Branch').closest('button');
    expect(createButton?.disabled).toBe(false);
  });

  it('calls git:create-branch with correct args on create', async () => {
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'login page');

    const createButton = screen.getByText('Create Branch').closest('button')!;
    await user.click(createButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:create-branch',
        '/test/project',
        'feat/login-page'
      );
    });
  });

  it('calls onBranchCreated on success', async () => {
    const onBranchCreated = vi.fn();
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} onBranchCreated={onBranchCreated} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'test');

    const createButton = screen.getByText('Create Branch').closest('button')!;
    await user.click(createButton);

    await waitFor(() => {
      expect(onBranchCreated).toHaveBeenCalled();
    });
  });

  it('calls onOpenChange(false) on success', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} onOpenChange={onOpenChange} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'test');

    const createButton = screen.getByText('Create Branch').closest('button')!;
    await user.click(createButton);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows error when git:create-branch fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Branch already exists'));
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'existing-branch');

    const createButton = screen.getByText('Create Branch').closest('button')!;
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Branch already exists')).toBeDefined();
    });
  });

  it('does not call onBranchCreated on error', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed'));
    const onBranchCreated = vi.fn();
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} onBranchCreated={onBranchCreated} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'test');

    const createButton = screen.getByText('Create Branch').closest('button')!;
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });

    expect(onBranchCreated).not.toHaveBeenCalled();
  });

  it('changes prefix when different option is selected', async () => {
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    // Type a name first
    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'bug');

    // Should show feat/ prefix initially
    expect(screen.getByText('feat/bug')).toBeDefined();

    // Click fix/ option
    const fixOption = screen.getByText('fix/');
    await user.click(fixOption);

    // Preview should update with fix/ prefix
    expect(screen.getByText('fix/bug')).toBeDefined();
  });

  it('renders Cancel button', () => {
    render(<NewBranchDialog {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('creates branch on Enter key press', async () => {
    const user = userEvent.setup();
    render(<NewBranchDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText('my-feature-name');
    await user.type(input, 'quick-fix{Enter}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:create-branch',
        '/test/project',
        'feat/quick-fix'
      );
    });
  });
});
