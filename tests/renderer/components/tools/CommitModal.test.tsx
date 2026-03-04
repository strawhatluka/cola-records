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

// Mock icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock Radix Dialog
vi.mock('@radix-ui/react-dialog', async () => import('../../../mocks/radix-dialog'));

import { CommitModal } from '../../../../src/renderer/components/tools/CommitModal';

describe('CommitModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    workingDirectory: '/test/project',
    onRunCommand: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state while generating commit message', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<CommitModal {...defaultProps} />);
    expect(screen.getByText(/generating/i)).toBeDefined();
  });

  it('should display generated commit message', async () => {
    mockInvoke.mockResolvedValue('feat: add new feature');

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDefined();
      expect((textarea as HTMLTextAreaElement).value).toBe('feat: add new feature');
    });
  });

  it('should show empty input when AI is not configured', async () => {
    mockInvoke.mockRejectedValue(new Error('AI is not configured'));

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect((textarea as HTMLTextAreaElement).value).toBe('');
    });
  });

  it('should allow editing the commit message', async () => {
    mockInvoke.mockResolvedValue('feat: initial message');

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'fix: corrected message');

    expect((textarea as HTMLTextAreaElement).value).toBe('fix: corrected message');
  });

  it('should send commit command to terminal on Commit click', async () => {
    mockInvoke.mockResolvedValue('feat: my commit');

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const commitBtn = screen.getByText('Commit');
    await userEvent.click(commitBtn);

    expect(defaultProps.onRunCommand).toHaveBeenCalledWith(
      expect.stringContaining('git commit -m')
    );
  });

  it('should close modal on Cancel', async () => {
    mockInvoke.mockResolvedValue('feat: message');

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const cancelBtn = screen.getByText('Cancel');
    await userEvent.click(cancelBtn);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should pass issue number and branch to generate command', async () => {
    mockInvoke.mockResolvedValue('feat(auth): add login');

    render(<CommitModal {...defaultProps} issueNumber="42" branchName="feat/auth" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'workflow:generate-commit-message',
        '/test/project',
        '42',
        'feat/auth'
      );
    });
  });
});
