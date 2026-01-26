import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TerminalPanel } from '@renderer/components/ide/terminal/TerminalPanel';
import { useTerminalStore } from '@renderer/stores/useTerminalStore';

// Mock IPC - using vi.hoisted() to avoid TDZ violations
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue(undefined),
  mockOn: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    on: mockOn,
  },
}));

// Mock the child components
vi.mock('@renderer/components/ide/terminal/XTermWrapper', () => ({
  XTermWrapper: ({ sessionId, cwd }: any) => (
    <div data-testid={`xterm-wrapper-${sessionId}`} data-cwd={cwd}>
      XTerm Terminal {sessionId}
    </div>
  ),
}));

vi.mock('@renderer/components/ide/terminal/TerminalControls', () => ({
  TerminalControls: ({ sessionId, onClear, onRestart }: any) => (
    <div data-testid={`terminal-controls-${sessionId}`}>
      <button onClick={onClear} data-testid="clear-button">
        Clear
      </button>
      <button onClick={onRestart} data-testid="restart-button">
        Restart
      </button>
    </div>
  ),
}));

vi.mock('@renderer/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks(); // Restores all spies before each test

    // Reset IPC mock to return resolved promise
    mockInvoke.mockResolvedValue(undefined);

    // Mock matchMedia for xterm.js
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Reset store state
    useTerminalStore.setState({
      sessions: new Map(),
      activeSessionId: null,
    });
  });

  afterEach(() => {
    const { sessions } = useTerminalStore.getState();
    sessions.forEach((_, id) => {
      useTerminalStore.getState().closeSession(id);
    });
  });

  describe('Initial rendering', () => {
    it('should create initial terminal session on mount', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        const { sessions } = useTerminalStore.getState();
        expect(sessions.size).toBe(1);
      });
    });

    it('should render terminal tab', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(screen.getByText('Terminal 1')).toBeInTheDocument();
      });
    });

    it('should render new terminal button', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(screen.getByLabelText('New terminal')).toBeInTheDocument();
      });
    });

    it('should show empty state when no sessions exist', () => {
      // Prevent auto-creation by mocking
      vi.spyOn(useTerminalStore.getState(), 'createSession').mockImplementation(() => '');

      render(<TerminalPanel defaultCwd="/test/path" />);

      expect(screen.getByText('No terminal sessions')).toBeInTheDocument();
      expect(screen.getByText('Create New Terminal')).toBeInTheDocument();
    });
  });

  describe('Multi-session management', () => {
    it('should create new terminal when new button is clicked', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const newButton = screen.getByLabelText('New terminal');
      fireEvent.click(newButton);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(2);
        expect(screen.getByText('Terminal 2')).toBeInTheDocument();
      });
    });

    it('should switch between terminal sessions', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      // Wait for first session
      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      // Create second session
      const newButton = screen.getByLabelText('New terminal');
      fireEvent.click(newButton);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(2);
      });

      // Get session IDs
      const sessions = Array.from(useTerminalStore.getState().sessions.values());
      const firstSessionId = sessions[0].id;
      const secondSessionId = sessions[1].id;

      // Click first tab
      const terminal1Tab = screen.getByText('Terminal 1');
      fireEvent.click(terminal1Tab);

      await waitFor(() => {
        expect(useTerminalStore.getState().activeSessionId).toBe(firstSessionId);
      });

      // Click second tab
      const terminal2Tab = screen.getByText('Terminal 2');
      fireEvent.click(terminal2Tab);

      await waitFor(() => {
        expect(useTerminalStore.getState().activeSessionId).toBe(secondSessionId);
      });
    });

    it('should close terminal tab', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      // Create second session
      const newButton = screen.getByLabelText('New terminal');
      fireEvent.click(newButton);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(2);
      });

      // Close first terminal
      const closeButton = screen.getByLabelText('Close terminal 1');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
        expect(screen.queryByText('Terminal 1')).not.toBeInTheDocument();
      });
    });

    it('should show only active terminal content', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const sessionId = Array.from(useTerminalStore.getState().sessions.keys())[0];

      // Should show XTerm wrapper for active session
      expect(screen.getByTestId(`xterm-wrapper-${sessionId}`)).toBeInTheDocument();
      expect(screen.getByTestId(`terminal-controls-${sessionId}`)).toBeInTheDocument();
    });
  });

  describe('Terminal controls', () => {
    it('should clear terminal when clear button is clicked', async () => {
      const clearTerminal = vi.spyOn(useTerminalStore.getState(), 'clearTerminal');

      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const clearButton = screen.getByTestId('clear-button');
      fireEvent.click(clearButton);

      expect(clearTerminal).toHaveBeenCalled();
    });

    it('should restart terminal when restart button is clicked', async () => {
      const restartTerminal = vi.spyOn(useTerminalStore.getState(), 'restartTerminal');

      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const restartButton = screen.getByTestId('restart-button');
      fireEvent.click(restartButton);

      expect(restartTerminal).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have role="tab" for terminal tabs', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
    });

    it('should set aria-selected on active tab', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const tab = screen.getByRole('tab');
      expect(tab.getAttribute('aria-selected')).toBe('true');
    });

    it('should have aria-label on buttons', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(screen.getByLabelText('New terminal')).toBeInTheDocument();
      });
    });
  });

  describe('Styling and UI', () => {
    it('should highlight active tab', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const tab = screen.getByRole('tab');
      expect(tab.className).toContain('bg-accent');
    });

    it('should show working directory in tab title', async () => {
      render(<TerminalPanel defaultCwd="/test/path" />);

      await waitFor(() => {
        expect(useTerminalStore.getState().sessions.size).toBe(1);
      });

      const tab = screen.getByText('Terminal 1');
      expect(tab.getAttribute('title')).toContain('/test/path');
    });
  });

  describe('Default working directory', () => {
    it('should use provided defaultCwd', async () => {
      const createSession = vi.spyOn(useTerminalStore.getState(), 'createSession');

      render(<TerminalPanel defaultCwd="/custom/path" />);

      await waitFor(() => {
        expect(createSession).toHaveBeenCalledWith('/custom/path');
      });
    });
  });
});
