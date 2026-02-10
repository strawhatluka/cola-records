import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createMockDevScript, createMockTerminalSession } from '../../../mocks/dev-scripts.mock';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Hoist mock variables
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockOn: vi.fn(() => vi.fn()),
}));

// Mock the IPC client
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    send: vi.fn(),
    on: mockOn,
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock window.electronAPI
const mockElectronAPI = {
  invoke: mockInvoke,
  on: vi.fn(() => vi.fn()),
};

// Mock XTermTerminal component since it requires complex DOM setup
vi.mock('../../../../src/renderer/components/tools/XTermTerminal', () => ({
  XTermTerminal: vi.fn(({ terminalId, onData }) => (
    <div
      data-testid="xterm-terminal"
      data-terminal-id={terminalId}
      onClick={() => onData?.('test input')}
    >
      Mock Terminal
    </div>
  )),
}));

import {
  ScriptExecutionModal,
  stripAnsiCodes,
} from '../../../../src/renderer/components/tools/ScriptExecutionModal';

describe('ScriptExecutionModal', () => {
  const mockScript = createMockDevScript({
    id: 'script_1',
    name: 'Build',
    command: 'npm run build',
  });

  const mockOnClose = vi.fn();
  const mockOnMoveToTerminal = vi.fn();

  const defaultProps = {
    isOpen: true,
    script: mockScript,
    workingDirectory: '/test/project',
    onClose: mockOnClose,
    onMoveToTerminal: mockOnMoveToTerminal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup window.electronAPI mock
    (window as any).electronAPI = mockElectronAPI;
  });

  afterEach(() => {
    cleanup();
    // Use property assignment instead of delete to avoid error
    (window as any).electronAPI = undefined;
  });

  // ── TT-11: Rendering Tests ──────────────────────────────────────────

  // Helper to setup mock for terminal spawn
  const setupTerminalMock = (session: { id: string; shellType: string }) => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'terminal:spawn') {
        return Promise.resolve(session);
      }
      return Promise.resolve(undefined);
    });
  };

  describe('rendering', () => {
    it('should render when isOpen is true', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      setupTerminalMock(mockSession);

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Build')).toBeDefined();
      });
    });

    it('should not render when isOpen is false', () => {
      setupTerminalMock(createMockTerminalSession({ id: 'session_1' }));
      render(<ScriptExecutionModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Build')).toBeNull();
    });

    it('should show script name in header', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      setupTerminalMock(mockSession);

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Build')).toBeDefined();
      });
    });

    it('should show script command in header', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      setupTerminalMock(mockSession);

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('npm run build')).toBeDefined();
      });
    });

    it('should render terminal container', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      setupTerminalMock(mockSession);

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });
    });

    it('should show loading state before terminal spawns', () => {
      // Don't resolve the invoke immediately
      mockInvoke.mockReturnValue(new Promise(() => {}));

      render(<ScriptExecutionModal {...defaultProps} />);

      expect(screen.getByText('Starting terminal...')).toBeDefined();
    });

    it('should not render when script is null', () => {
      setupTerminalMock(createMockTerminalSession({ id: 'session_1' }));
      render(<ScriptExecutionModal {...defaultProps} script={null} />);

      expect(screen.queryByText('Build')).toBeNull();
    });

    it('should render with backdrop', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      setupTerminalMock(mockSession);

      const { container } = render(<ScriptExecutionModal {...defaultProps} />);

      // Check for backdrop class
      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeDefined();
    });
  });

  // ── TT-12: Terminal Tests ──────────────────────────────────────────

  describe('terminal execution', () => {
    it('should spawn terminal on open', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockResolvedValueOnce(mockSession);

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', 'git-bash', '/test/project');
      });
    });

    it('should execute script command after spawn', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      // Mock implementation to return session for spawn, undefined for other calls
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      // Wait for spawn to be called
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', 'git-bash', '/test/project');
      });

      // Wait for the write command to be called (component uses setTimeout internally)
      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith('terminal:write', 'session_1', 'npm run build\n');
        },
        { timeout: 2000 }
      );
    });

    it('should render terminal with correct session id', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_abc' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        const terminal = screen.getByTestId('xterm-terminal');
        expect(terminal.getAttribute('data-terminal-id')).toBe('session_abc');
      });
    });

    it('should handle terminal spawn error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockImplementation(() => Promise.reject(new Error('Spawn failed')));

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });
  });

  // ── TT-13: Action Tests ──────────────────────────────────────────

  describe('close button', () => {
    it('should stop terminal process on close', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });

      // Find and click close button (X icon)
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(
        (btn) => btn.querySelector('svg') && btn.classList.contains('h-8')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
      } else {
        // Try clicking the first button that looks like a close button
        fireEvent.click(buttons[buttons.length - 1]);
      }

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', 'session_1');
      });
    });

    it('should call onClose callback', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      const { container } = render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });

      // Find backdrop element and click it
      const backdrop = container.querySelector('.bg-background\\/80');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should close on backdrop click', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      const { container } = render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });

      // Find backdrop element
      const backdrop = container.querySelector('.bg-background\\/80');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('copy output', () => {
    it('should have copy button visible', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy Output')).toBeDefined();
      });
    });

    it('should show success feedback after copy', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      // Mock clipboard for this test
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      const originalClipboard = navigator.clipboard;
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy Output')).toBeDefined();
      });

      // Use fireEvent instead of userEvent to avoid clipboard conflicts
      fireEvent.click(screen.getByText('Copy Output'));

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeDefined();
      });

      // Restore clipboard
      Object.assign(navigator, { clipboard: originalClipboard });
      vi.useRealTimers();
    });
  });

  describe('move to terminal', () => {
    it('should show move to terminal button when callback provided', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Move to Terminal')).toBeDefined();
      });
    });

    it('should not show move to terminal button when callback not provided', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} onMoveToTerminal={undefined} />);

      // Wait for terminal to be ready first
      await waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });

      // Then verify Move to Terminal button is not present
      expect(screen.queryByText('Move to Terminal')).toBeNull();
    });

    it('should transfer session to ToolBox with output and script name', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_123' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Move to Terminal')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Move to Terminal'));

      await waitFor(() => {
        // Should be called with sessionId, initialOutput (empty string), and script name
        expect(mockOnMoveToTerminal).toHaveBeenCalledWith(
          'session_123',
          expect.any(String),
          'Build'
        );
      });
    });

    it('should close modal after transfer', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_123' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Move to Terminal')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Move to Terminal'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should NOT kill terminal when transferred to Terminal tool', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_transfer' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      const { unmount } = render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Move to Terminal')).toBeDefined();
      });

      // Transfer the session
      fireEvent.click(screen.getByText('Move to Terminal'));

      await waitFor(() => {
        expect(mockOnMoveToTerminal).toHaveBeenCalled();
      });

      // Clear mock to track only subsequent calls
      mockInvoke.mockClear();

      // Unmount the component
      unmount();

      // Wait a tick to ensure cleanup runs
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify terminal:kill was NOT called for the transferred session
      const killCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === 'terminal:kill' && call[1] === 'session_transfer'
      );
      expect(killCalls.length).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should kill terminal on unmount when session exists', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_cleanup' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      const { unmount } = render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });

      unmount();

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', 'session_cleanup');
      });
    });

    it('should reset state when modal closes', async () => {
      const mockSession = createMockTerminalSession({ id: 'session_1' });
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'terminal:spawn') {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(undefined);
      });

      const { rerender } = render(<ScriptExecutionModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });

      // Close modal
      rerender(<ScriptExecutionModal {...defaultProps} isOpen={false} />);

      // Modal should not be visible
      expect(screen.queryByTestId('xterm-terminal')).toBeNull();
    });
  });
});

describe('stripAnsiCodes', () => {
  it('should strip basic color codes', () => {
    const input = '\x1B[32mgreen text\x1B[0m';
    expect(stripAnsiCodes(input)).toBe('green text');
  });

  it('should strip cursor movement codes', () => {
    const input = '\x1B[2J\x1B[Hsome text';
    expect(stripAnsiCodes(input)).toBe('some text');
  });

  it('should strip private mode sequences like cursor visibility', () => {
    const input = '\x1B[?25hvisible\x1B[?25l';
    expect(stripAnsiCodes(input)).toBe('visible');
  });

  it('should strip bracketed paste mode sequences', () => {
    const input = '\x1B[?2004hcontent\x1B[?2004l';
    expect(stripAnsiCodes(input)).toBe('content');
  });

  it('should strip OSC title sequences', () => {
    const input = '\x1B]0;Window Title\x07actual content';
    expect(stripAnsiCodes(input)).toBe('actual content');
  });

  it('should strip malformed OSC sequences without escape', () => {
    const input = ']0;Window Title\nactual content';
    expect(stripAnsiCodes(input)).toBe('actual content');
  });

  it('should strip leftover bracket sequences without escape', () => {
    const input = '[?25h\nGit Bash loaded';
    expect(stripAnsiCodes(input)).toBe('Git Bash loaded');
  });

  it('should handle complex real-world terminal output', () => {
    const input =
      '\x1B[?25h\nGit Bash shortcuts loaded!\n\x1B[?2004h\x1B[?2004l\n\x1B[38;2;95;0;135muser\x1B[m ~/project\n$ npm run build';
    const result = stripAnsiCodes(input);
    expect(result).toContain('Git Bash shortcuts loaded!');
    expect(result).toContain('user ~/project');
    expect(result).toContain('$ npm run build');
    expect(result).not.toContain('\x1B');
    expect(result).not.toContain('[?25h');
    expect(result).not.toContain('[?2004');
  });

  it('should collapse multiple blank lines', () => {
    const input = 'line1\n\n\n\n\nline2';
    expect(stripAnsiCodes(input)).toBe('line1\n\nline2');
  });

  it('should trim whitespace from result', () => {
    const input = '  \n\ncontent\n\n  ';
    expect(stripAnsiCodes(input)).toBe('content');
  });

  it('should handle nodemon output with color codes', () => {
    const input = '\x1B[33m[nodemon] 3.1.10\x1B[m\n\x1B[33m[nodemon] starting\x1B[m';
    const result = stripAnsiCodes(input);
    expect(result).toBe('[nodemon] 3.1.10\n[nodemon] starting');
  });

  it('should preserve normal text without escape sequences', () => {
    const input = 'Hello, World!\nThis is normal text.';
    expect(stripAnsiCodes(input)).toBe('Hello, World!\nThis is normal text.');
  });

  it('should remove control characters except newline and tab', () => {
    const input = 'text\x07with\x08bell\x7Fand\tbackspace';
    const result = stripAnsiCodes(input);
    expect(result).not.toContain('\x07');
    expect(result).not.toContain('\x08');
    expect(result).not.toContain('\x7F');
    expect(result).toContain('\t'); // Tab should be preserved
  });
});
