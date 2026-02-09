import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => vi.fn());

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    on: (...args: unknown[]) => mockOn(...args),
    send: vi.fn(),
  },
  writable: true,
});

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock XTermTerminal to avoid xterm.js complexity
vi.mock('../../../../src/renderer/components/tools/XTermTerminal', () => ({
  XTermTerminal: ({
    terminalId,
    onData,
    onResize,
  }: {
    terminalId: string;
    onData: (data: string) => void;
    onResize: (cols: number, rows: number) => void;
  }) => (
    <div
      data-testid="xterm-terminal"
      data-terminal-id={terminalId}
      onClick={() => {
        onData('test-input');
        onResize(80, 24);
      }}
    >
      Mock XTerm Terminal
    </div>
  ),
}));

import { TerminalTool } from '../../../../src/renderer/components/tools/TerminalTool';

describe('TerminalTool', () => {
  const workingDirectory = '/test/project';
  let terminalIdCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    terminalIdCounter = 0;

    // Mock terminal spawn
    mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      if (channel === 'terminal:spawn') {
        terminalIdCounter++;
        return { id: `term-${terminalIdCounter}`, shellType: args[0] };
      }
      return undefined;
    });
  });

  it('creates a terminal on mount', async () => {
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', 'git-bash', workingDirectory);
    });
  });

  it('renders XTermTerminal component when terminal is active', async () => {
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByTestId('xterm-terminal')).toBeDefined();
    });
  });

  it('displays tab for the created terminal', async () => {
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });
  });

  it('shows shell dropdown button', async () => {
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByTestId('icon-plus')).toBeDefined();
    });
  });

  it('creates PowerShell terminal when selected from dropdown', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    // Wait for initial terminal
    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // Open dropdown
    const dropdownTrigger = screen.getByTestId('icon-plus').closest('button');
    await user.click(dropdownTrigger!);

    // Click PowerShell option
    await user.click(screen.getByText('PowerShell'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', 'powershell', workingDirectory);
    });
  });

  it('creates CMD terminal when selected from dropdown', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // Open dropdown
    const dropdownTrigger = screen.getByTestId('icon-plus').closest('button');
    await user.click(dropdownTrigger!);

    // Click CMD option
    await user.click(screen.getByText('CMD'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('terminal:spawn', 'cmd', workingDirectory);
    });
  });

  it('switches between tabs when clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    // Wait for initial terminal
    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // Create another terminal
    const dropdownTrigger = screen.getByTestId('icon-plus').closest('button');
    await user.click(dropdownTrigger!);
    await user.click(screen.getByText('PowerShell'));

    await waitFor(() => {
      expect(screen.getByText('PowerShell 2')).toBeDefined();
    });

    // Click first tab to switch back
    await user.click(screen.getByText('Git Bash 1'));

    // Verify the first terminal is shown
    const terminal = screen.getByTestId('xterm-terminal');
    expect(terminal.dataset.terminalId).toBe('term-1');
  });

  it('closes terminal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // Hover over tab to reveal close button
    const tab = screen.getByText('Git Bash 1').closest('div');
    const closeButton = tab?.querySelector('button');

    await user.click(closeButton!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('terminal:kill', 'term-1');
    });
  });

  it('shows empty state when no terminals are open', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // Close the terminal
    const tab = screen.getByText('Git Bash 1').closest('div');
    const closeButton = tab?.querySelector('button');
    await user.click(closeButton!);

    await waitFor(() => {
      expect(screen.getByText('No terminal open. Click + to create one.')).toBeDefined();
    });
  });

  it('sends data to terminal when XTermTerminal onData is called', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByTestId('xterm-terminal')).toBeDefined();
    });

    // Click the mock terminal to trigger onData
    await user.click(screen.getByTestId('xterm-terminal'));

    expect(mockInvoke).toHaveBeenCalledWith('terminal:write', 'term-1', 'test-input');
  });

  it('sends resize to terminal when XTermTerminal onResize is called', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByTestId('xterm-terminal')).toBeDefined();
    });

    // Click the mock terminal to trigger onResize
    await user.click(screen.getByTestId('xterm-terminal'));

    expect(mockInvoke).toHaveBeenCalledWith('terminal:resize', 'term-1', 80, 24);
  });

  it('only spawns one terminal on mount (React Strict Mode guard)', async () => {
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // Should only have called spawn once
    const spawnCalls = mockInvoke.mock.calls.filter((call) => call[0] === 'terminal:spawn');
    expect(spawnCalls.length).toBe(1);
  });

  it('switches to last tab when active tab is closed', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    // Wait for initial terminal
    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // Create second terminal
    const dropdownTrigger = screen.getByTestId('icon-plus').closest('button');
    await user.click(dropdownTrigger!);
    await user.click(screen.getByText('PowerShell'));

    await waitFor(() => {
      expect(screen.getByText('PowerShell 2')).toBeDefined();
    });

    // Close second terminal (active)
    const psTab = screen.getByText('PowerShell 2').closest('div');
    const psCloseButton = psTab?.querySelector('button');
    await user.click(psCloseButton!);

    // Should show first terminal now
    await waitFor(() => {
      const terminal = screen.getByTestId('xterm-terminal');
      expect(terminal.dataset.terminalId).toBe('term-1');
    });
  });

  it('displays correct shell label in dropdown button', async () => {
    const user = userEvent.setup();
    render(<TerminalTool workingDirectory={workingDirectory} />);

    await waitFor(() => {
      expect(screen.getByText('Git Bash 1')).toBeDefined();
    });

    // The dropdown button should show the last selected shell type
    expect(screen.getByText('Git Bash')).toBeDefined();

    // Change to PowerShell
    const dropdownTrigger = screen.getByTestId('icon-plus').closest('button');
    await user.click(dropdownTrigger!);
    await user.click(screen.getByText('PowerShell'));

    // Button text should update
    await waitFor(() => {
      const buttons = screen.getAllByText('PowerShell');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
