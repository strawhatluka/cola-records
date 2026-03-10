import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

// Mock useNotificationStore
const mockAddNotification = vi.fn();
vi.mock('../../../../src/renderer/stores/useNotificationStore', () => ({
  useNotificationStore: {
    getState: () => ({
      addNotification: mockAddNotification,
    }),
  },
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

  // ---------------------------------------------------------------
  // New tests for uncovered branches
  // ---------------------------------------------------------------

  it('should show generic error message when generate fails with non-AI error', async () => {
    mockInvoke.mockRejectedValue(new Error('Network timeout'));

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeDefined();
    });
  });

  it('should handle falsy return from generate without crashing', async () => {
    mockInvoke.mockResolvedValue(null);

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('should go back to editing with error when terminal spawn fails', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message') return Promise.resolve('feat: test');
      if (channel === 'terminal:spawn') return Promise.reject(new Error('spawn error'));
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const commitBtn = screen.getByText('Commit');
    await userEvent.click(commitBtn);

    await waitFor(() => {
      expect(screen.getByText('Failed to spawn terminal')).toBeDefined();
    });

    // Should still be in editing phase (textarea visible)
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('should show Copy Output and Push buttons in done phase', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message')
        return Promise.resolve('feat: done phase');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-done' });
      if (channel === 'terminal:write') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    const commitBtn = screen.getByText('Commit');
    await userEvent.click(commitBtn);

    // Advance past the 1500ms timeout to reach 'done' phase
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Copy Output')).toBeDefined();
      expect(screen.getByText('Push')).toBeDefined();
    });

    vi.useRealTimers();
  });

  it('should copy terminal output to clipboard', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message') return Promise.resolve('feat: copy test');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-copy' });
      if (channel === 'terminal:write') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Copy Output')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Copy Output'));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });

  it('should push with tracking branch (no upstream needed)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message') return Promise.resolve('feat: push test');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-push' });
      if (channel === 'terminal:write') return Promise.resolve();
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Push'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:push', '/test/project', 'origin', 'main', false);
    });

    await waitFor(() => {
      expect(screen.getByText(/Pushed to origin\/main/)).toBeDefined();
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'git',
        title: 'Push Successful',
      })
    );

    vi.useRealTimers();
  });

  it('should push with needsUpstream when no tracking branch exists', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message')
        return Promise.resolve('feat: upstream test');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-upstream' });
      if (channel === 'terminal:write') return Promise.resolve();
      if (channel === 'git:status')
        return Promise.resolve({ current: 'feat/new-branch', tracking: null });
      if (channel === 'git:push') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Push'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:push',
        '/test/project',
        'origin',
        'feat/new-branch',
        true
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/upstream set/)).toBeDefined();
    });

    vi.useRealTimers();
  });

  it('should show error message when push fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message') return Promise.resolve('feat: push fail');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-pushfail' });
      if (channel === 'terminal:write') return Promise.resolve();
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push') return Promise.reject(new Error('Permission denied'));
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Push'));

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'git',
        title: 'Push Failed',
        priority: 'high',
      })
    );

    vi.useRealTimers();
  });

  it('should disable Push button while pushing is in progress', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let resolvePush: () => void;
    const pushPromise = new Promise<void>((resolve) => {
      resolvePush = resolve;
    });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message') return Promise.resolve('feat: pushing');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-pushing' });
      if (channel === 'terminal:write') return Promise.resolve();
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push') return pushPromise;
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Push'));

    await waitFor(() => {
      expect(screen.getByText('Pushing...')).toBeDefined();
    });

    // The button showing "Pushing..." should be disabled
    const pushingBtn = screen.getByText('Pushing...').closest('button');
    expect(pushingBtn?.disabled).toBe(true);

    // Resolve to clean up
    await act(async () => {
      resolvePush!();
    });

    vi.useRealTimers();
  });

  it('should disable Push button and show Pushed after successful push', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message') return Promise.resolve('feat: pushed');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-pushed' });
      if (channel === 'terminal:write') return Promise.resolve();
      if (channel === 'git:status')
        return Promise.resolve({ current: 'main', tracking: 'origin/main' });
      if (channel === 'git:push') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Push')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Push'));

    await waitFor(() => {
      expect(screen.getByText('Pushed')).toBeDefined();
    });

    const pushedBtn = screen.getByText('Pushed').closest('button');
    expect(pushedBtn?.disabled).toBe(true);

    vi.useRealTimers();
  });

  it('should show truncated message in header during done phase', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const longMessage =
      'feat: this is a very long commit message that exceeds fifty characters limit';

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message') return Promise.resolve(longMessage);
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-truncate' });
      if (channel === 'terminal:write') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      // The truncated message (first 50 chars + '...') should appear
      const truncated = longMessage.slice(0, 50) + '...';
      expect(screen.getByText(truncated)).toBeDefined();
    });

    vi.useRealTimers();
  });

  it('should kill terminal session when closing with active session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message')
        return Promise.resolve('feat: close test');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-kill' });
      if (channel === 'terminal:write') return Promise.resolve();
      if (channel === 'terminal:kill') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    // Wait for session to be set
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', 'git-bash', '/test/project');
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Copy Output')).toBeDefined();
    });

    // Click the X close button
    const closeBtn = screen.getByTestId('icon-x').closest('button');
    await userEvent.click(closeBtn!);

    expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', 'session-kill');
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);

    vi.useRealTimers();
  });

  it('should silently handle clipboard write errors', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'workflow:generate-commit-message')
        return Promise.resolve('feat: clipboard fail');
      if (channel === 'terminal:spawn') return Promise.resolve({ id: 'session-clipfail' });
      if (channel === 'terminal:write') return Promise.resolve();
      return Promise.resolve();
    });

    render(<CommitModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Commit'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(screen.getByText('Copy Output')).toBeDefined();
    });

    // This should not throw
    await userEvent.click(screen.getByText('Copy Output'));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });

    // No crash, component still renders
    expect(screen.getByText('Copy Output')).toBeDefined();

    vi.useRealTimers();
  });
});
