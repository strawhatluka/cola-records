import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalPanel } from '../../renderer/components/ide/terminal/TerminalPanel';
import { useTerminalStore } from '../../renderer/stores/useTerminalStore';

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => () => {});

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

describe('Terminal Execution - Integration Tests', () => {
  it('should execute command and capture output', async () => {
    const user = userEvent.setup();

    // Mock terminal session creation
    mockInvoke.mockResolvedValueOnce('session-123');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'terminal:create',
        expect.objectContaining({ cwd: '/test/repo' })
      );
    });

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    // Simulate command input
    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });
    await user.type(terminalInput, 'npm test{Enter}');

    // Mock command execution
    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'terminal:input',
        sessionId,
        'npm test\n'
      );
    });

    // Simulate terminal output
    const mockCall = mockCall = mockOn.mock.calls.find(
      (call) => call[0] === 'terminal:data'
    );
    const mockCall2 = mockCall;
    const outputHandler = mockCall2?.[1]?);

    if (outputHandler) {
      outputHandler({
        sessionId,
        data: '> Running tests...\n',
      });

      outputHandler({
        sessionId,
        data: 'PASS  src/test.ts\n',
      });

      outputHandler({
        sessionId,
        data: 'Tests: 5 passed, 5 total\n',
      });
    }

    // Verify output appears
    await waitFor(() => {
      expect(container.textContent).toContain('Running tests');
      expect(container.textContent).toContain('PASS');
      expect(container.textContent).toContain('5 passed');
    });
  });

  it('should handle long-running process with streaming output', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce('session-456');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    // Execute build command
    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });
    await user.type(terminalInput, 'npm run build{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    // Simulate streaming output
    const mockCall = mockCall = mockOn.mock.calls.find(
      (call) => call[0] === 'terminal:data'
    );
    const mockCall2 = mockCall;
    const outputHandler = mockCall2?.[1]?);

    if (outputHandler) {
      // Initial output
      outputHandler({
        sessionId,
        data: '> Building project...\n',
      });

      // Progress updates
      for (let i = 1; i <= 10; i++) {
        outputHandler({
          sessionId,
          data: `[${i}/10] Processing files...\n`,
        });
      }

      // Completion
      outputHandler({
        sessionId,
        data: 'Build completed successfully!\n',
      });
    }

    await waitFor(() => {
      expect(container.textContent).toContain('Building project');
      expect(container.textContent).toContain('[10/10]');
      expect(container.textContent).toContain('Build completed successfully');
    });
  });

  it('should handle command with error output', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce('session-789');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    // Execute failing command
    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });
    await user.type(terminalInput, 'npm run invalid{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    // Simulate error output
    const mockCall2 = mockCall;
    const outputHandler = mockCall2?.[1] = mockOn.mock.calls.find(
      ([event]) => event === 'terminal:data'
    )?);

    if (outputHandler) {
      outputHandler({
        sessionId,
        data: 'npm ERR! Missing script: "invalid"\n',
      });

      outputHandler({
        sessionId,
        data: 'npm ERR! \n',
      });

      outputHandler({
        sessionId,
        data: 'npm ERR! To see a list of scripts, run:\n',
      });

      outputHandler({
        sessionId,
        data: 'npm ERR!   npm run\n',
      });
    }

    await waitFor(() => {
      expect(container.textContent).toContain('npm ERR!');
      expect(container.textContent).toContain('Missing script');
    });

    // Verify error styling applied
    const errorLines = container.querySelectorAll('.terminal-error');
    expect(errorLines.length).toBeGreaterThan(0);
  });

  it('should handle interactive prompts (y/n)', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce('session-abc');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    // Execute command with prompt
    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });
    await user.type(terminalInput, 'npm init{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    // Simulate prompt
    const mockCall2 = mockCall;
    const outputHandler = mockCall2?.[1] = mockOn.mock.calls.find(
      ([event]) => event === 'terminal:data'
    )?);

    if (outputHandler) {
      outputHandler({
        sessionId,
        data: 'This utility will walk you through creating a package.json file.\n',
      });

      outputHandler({
        sessionId,
        data: 'Is this OK? (yes) ',
      });
    }

    await waitFor(() => {
      expect(container.textContent).toContain('Is this OK?');
    });

    // Respond to prompt
    await user.type(terminalInput, 'yes{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'terminal:input',
        sessionId,
        'yes\n'
      );
    });
  });

  it('should handle Ctrl+C to cancel running process', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce('session-def');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    // Start long-running process
    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });
    await user.type(terminalInput, 'npm run dev{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    // Simulate process output
    const mockCall2 = mockCall;
    const outputHandler = mockCall2?.[1] = mockOn.mock.calls.find(
      ([event]) => event === 'terminal:data'
    )?);

    if (outputHandler) {
      outputHandler({
        sessionId,
        data: 'Server running on http://localhost:3000\n',
      });
    }

    await waitFor(() => {
      expect(container.textContent).toContain('Server running');
    });

    // Send Ctrl+C
    mockInvoke.mockResolvedValueOnce(undefined);

    await user.keyboard('{Control>}c{/Control}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', sessionId);
    });

    // Simulate process exit
    if (outputHandler) {
      outputHandler({
        sessionId,
        data: '^C\n',
      });

      outputHandler({
        sessionId,
        data: 'Process terminated\n',
      });
    }

    await waitFor(() => {
      expect(container.textContent).toContain('Process terminated');
    });
  });

  it('should handle directory navigation commands', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce('session-ghi');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });

    // Change directory
    await user.type(terminalInput, 'cd src{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    // Simulate pwd output
    const mockCall2 = mockCall;
    const outputHandler = mockCall2?.[1] = mockOn.mock.calls.find(
      ([event]) => event === 'terminal:data'
    )?);

    if (outputHandler) {
      outputHandler({
        sessionId,
        data: '/test/repo/src\n',
      });
    }

    // List files
    await user.type(terminalInput, 'ls{Enter}');

    mockInvoke.mockResolvedValueOnce(undefined);

    if (outputHandler) {
      outputHandler({
        sessionId,
        data: 'index.ts  utils.ts  components/\n',
      });
    }

    await waitFor(() => {
      expect(container.textContent).toContain('/test/repo/src');
      expect(container.textContent).toContain('index.ts');
      expect(container.textContent).toContain('components/');
    });
  });

  it('should preserve command history and allow navigation', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce('session-jkl');

    render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });

    // Execute multiple commands
    await user.type(terminalInput, 'npm test{Enter}');
    mockInvoke.mockResolvedValueOnce(undefined);

    await user.type(terminalInput, 'npm run build{Enter}');
    mockInvoke.mockResolvedValueOnce(undefined);

    await user.type(terminalInput, 'git status{Enter}');
    mockInvoke.mockResolvedValueOnce(undefined);

    // Navigate history with arrow up
    await user.keyboard('{ArrowUp}');

    expect(terminalInput).toHaveValue('git status');

    await user.keyboard('{ArrowUp}');

    expect(terminalInput).toHaveValue('npm run build');

    await user.keyboard('{ArrowUp}');

    expect(terminalInput).toHaveValue('npm test');

    // Navigate down
    await user.keyboard('{ArrowDown}');

    expect(terminalInput).toHaveValue('npm run build');
  });

  it('should handle tab completion', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce('session-mno');

    render(<TerminalPanel defaultCwd="/test/repo" />);

    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    const terminalInput = screen.getByRole('textbox', { name: /terminal/i });

    // Type partial command
    await user.type(terminalInput, 'npm ru');

    // Mock tab completion response
    mockInvoke.mockResolvedValueOnce(['run', 'run-script']);

    // Press Tab
    await user.keyboard('{Tab}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'terminal:autocomplete',
        sessionId,
        'npm ru'
      );
    });

    // Verify completion shown
    await waitFor(() => {
      expect(screen.getByText('run')).toBeInTheDocument();
      expect(screen.getByText('run-script')).toBeInTheDocument();
    });

    // Select first completion
    await user.keyboard('{Enter}');

    expect(terminalInput).toHaveValue('npm run');
  });
});
