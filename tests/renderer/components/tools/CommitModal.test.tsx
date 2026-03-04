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

// Mock electronAPI for terminal:data listener
const mockOn = vi.fn(() => vi.fn());
Object.defineProperty(window, 'electronAPI', {
  value: { on: mockOn },
  writable: true,
});

// Mock icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock XTermTerminal to avoid xterm dependency
vi.mock('../../../../src/renderer/components/tools/XTermTerminal', () => ({
  XTermTerminal: ({ terminalId }: { terminalId: string }) => (
    <div data-testid="xterm-terminal">{terminalId}</div>
  ),
}));

// Mock stripAnsiCodes
vi.mock('../../../../src/renderer/components/tools/ScriptExecutionModal', () => ({
  stripAnsiCodes: (s: string) => s,
}));

import { CommitModal } from '../../../../src/renderer/components/tools/CommitModal';

describe('CommitModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    workingDirectory: '/test/project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state while generating commit message', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<CommitModal {...defaultProps} />);
    expect(screen.getByText(/generating/i)).toBeDefined();
  });

  it('should display generated commit message in textarea', async () => {
    mockInvoke.mockResolvedValue('feat: add new feature');

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDefined();
      expect((textarea as HTMLTextAreaElement).value).toBe('feat: add new feature');
    });
  });

  it('should show info message when AI is not configured', async () => {
    mockInvoke.mockRejectedValue(new Error('AI not configured'));

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/configure ai/i)).toBeDefined();
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

  it('should spawn terminal and switch to committing phase on Commit click', async () => {
    mockInvoke.mockResolvedValueOnce('feat: my commit'); // generate message
    mockInvoke.mockResolvedValueOnce({ id: 'session-123' }); // terminal:spawn

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const commitBtn = screen.getByText('Commit');
    await userEvent.click(commitBtn);

    expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', 'git-bash', '/test/project');
  });

  it('should close modal on Cancel click', async () => {
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

  it('should not render when open is false', () => {
    const { container } = render(<CommitModal {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should disable Commit button when message is empty', async () => {
    mockInvoke.mockResolvedValue('');

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const commitBtn = screen.getByText('Commit');
    expect(commitBtn.closest('button')?.disabled).toBe(true);
  });
});
