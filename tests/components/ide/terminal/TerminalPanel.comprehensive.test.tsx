import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerminalPanel } from '@renderer/components/ide/terminal/TerminalPanel';
import { useTerminalStore } from '@renderer/stores/useTerminalStore';

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => () => {});

describe('TerminalPanel - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.window = global.window || ({} as any);
    (global.window as any).electronAPI = {
      invoke: mockInvoke,
      on: mockOn,
    };

    // Reset store
    useTerminalStore.setState({
      sessions: new Map(),
      activeSessionId: null,
    });
  });

  it('should spawn terminal session on mount', async () => {
    mockInvoke.mockResolvedValueOnce('session-123');

    render(<TerminalPanel defaultCwd="/test/repo" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'terminal:create',
        expect.objectContaining({ cwd: '/test/repo' })
      );
    });
  });

  it('should create and display terminal session', async () => {
    render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();

    await waitFor(() => {
      expect(sessions.size).toBeGreaterThan(0);
    });
  });

  it('should handle terminal output', async () => {
    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    // Simulate terminal output
    mockOn.mock.calls.forEach(([event, handler]) => {
      if (event === 'terminal:data') {
        handler({
          sessionId,
          data: 'Hello from terminal\n',
        });
      }
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Hello from terminal');
    });
  });

  it('should handle terminal resize', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    // Simulate resize
    if (sessionId) {
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'terminal:resize',
          sessionId,
          expect.any(Number),
          expect.any(Number)
        );
      }, { timeout: 1000 });
    }
  });

  it('should handle multiple terminal tabs', async () => {
    render(<TerminalPanel defaultCwd="/test/repo" />);

    const { createSession, sessions } = useTerminalStore.getState();

    // Create additional sessions
    createSession('/test/repo2');
    createSession('/test/repo3');

    expect(sessions.size).toBe(3);
  });

  it('should switch between terminal sessions', async () => {
    render(<TerminalPanel defaultCwd="/test/repo" />);

    const { createSession, switchSession, activeSessionId } =
      useTerminalStore.getState();

    const session1 = createSession('/test/repo1');
    const session2 = createSession('/test/repo2');

    switchSession(session1);
    expect(useTerminalStore.getState().activeSessionId).toBe(session1);

    switchSession(session2);
    expect(useTerminalStore.getState().activeSessionId).toBe(session2);
  });

  it('should close terminal session', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    render(<TerminalPanel defaultCwd="/test/repo" />);

    const { createSession, closeSession, sessions } =
      useTerminalStore.getState();

    const sessionId = createSession('/test/repo');

    const initialCount = sessions.size;
    closeSession(sessionId);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', sessionId);
      expect(useTerminalStore.getState().sessions.size).toBe(
        initialCount - 1
      );
    });
  });

  it('should handle terminal errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Terminal spawn failed'));

    render(<TerminalPanel defaultCwd="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
