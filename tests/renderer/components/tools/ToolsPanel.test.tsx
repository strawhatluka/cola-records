import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Use vi.hoisted to ensure mocks are available at vi.mock time
const { mockInvoke, mockOn } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockOn: vi.fn(() => vi.fn()),
}));

vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    send: vi.fn(),
    on: mockOn,
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock window.electronAPI for XTermTerminal
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: mockInvoke,
    on: mockOn,
    send: vi.fn(),
  },
  writable: true,
});

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock XTermTerminal to avoid xterm.js complexity
vi.mock('../../../../src/renderer/components/tools/XTermTerminal', () => ({
  XTermTerminal: ({ terminalId }: { terminalId: string }) => (
    <div data-testid="xterm-terminal" data-terminal-id={terminalId}>
      Mock XTerm Terminal
    </div>
  ),
}));

// Mock useDevScriptsStore
vi.mock('../../../../src/renderer/stores/useDevScriptsStore', () => ({
  useDevScriptsStore: () => ({
    scripts: [],
    loading: false,
    loadScripts: vi.fn(),
    saveScript: vi.fn(),
    deleteScript: vi.fn(),
  }),
}));

import { ToolsPanel } from '../../../../src/renderer/components/tools/ToolsPanel';

describe('ToolsPanel', () => {
  const mockOnClose = vi.fn();
  const workingDirectory = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock terminal spawn
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'terminal:spawn') {
        return { id: 'term-123', shellType: 'git-bash' };
      }
      return undefined;
    });
  });

  it('renders with issues tool selected by default', () => {
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);
    expect(screen.getByText('Issues')).toBeDefined();
  });

  it('renders hamburger menu button', () => {
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);
    expect(screen.getByTestId('icon-menu')).toBeDefined();
  });

  it('renders close button', () => {
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);
    const closeButton = screen.getByTestId('icon-x').closest('button');
    expect(closeButton).toBeDefined();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

    const closeButton = screen.getByTestId('icon-x').closest('button');
    expect(closeButton).not.toBeNull();
    await user.click(closeButton as HTMLButtonElement);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('opens menu when hamburger button is clicked', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

    const menuButton = screen.getByTestId('icon-menu').closest('button');
    expect(menuButton).not.toBeNull();
    await user.click(menuButton as HTMLButtonElement);

    // Menu should show all six tool options (Terminal is no longer in menu)
    expect(screen.getAllByText('Issues').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pull Requests')).toBeDefined();
    expect(screen.getByText('Actions')).toBeDefined();
    expect(screen.getByText('Releases')).toBeDefined();
    expect(screen.getByText('Dev Scripts')).toBeDefined();
    expect(screen.getByText('Maintenance')).toBeDefined();
  });

  it('switches to Dev Scripts tool when selected from menu', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

    // Open menu
    const menuButton = screen.getByTestId('icon-menu').closest('button');
    expect(menuButton).not.toBeNull();
    await user.click(menuButton as HTMLButtonElement);

    // Select Dev Scripts
    const devScriptsOption = screen.getByText('Dev Scripts');
    await user.click(devScriptsOption);

    // Should now show Dev Scripts content (empty state)
    expect(screen.getByText('No scripts yet')).toBeDefined();
  });

  it('switches to Maintenance tool when selected from menu', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

    // Open menu
    const menuButton = screen.getByTestId('icon-menu').closest('button');
    expect(menuButton).not.toBeNull();
    await user.click(menuButton as HTMLButtonElement);

    // Select Maintenance
    const maintenanceOption = screen.getByText('Maintenance');
    await user.click(maintenanceOption);

    // Should now show Maintenance content
    expect(screen.getByText('Coming soon')).toBeDefined();
    // Use getAllByTestId since wrench icon appears in both header and content
    expect(screen.getAllByTestId('icon-wrench').length).toBeGreaterThanOrEqual(1);
  });

  it('closes menu when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

    // Open menu
    const menuButton = screen.getByTestId('icon-menu').closest('button');
    expect(menuButton).not.toBeNull();
    await user.click(menuButton as HTMLButtonElement);

    // Menu should be visible
    expect(screen.getByText('Dev Scripts')).toBeDefined();

    // Click backdrop (the fixed inset-0 div)
    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as HTMLElement);

    // Menu items inside the dropdown should no longer be visible
    // (The header still shows current tool label)
    const devScriptsInMenu = screen.queryAllByText('Dev Scripts');
    // After closing, there should be no Dev Scripts in the dropdown
    expect(devScriptsInMenu.length).toBe(0);
  });

  it('highlights the active tool in the menu', async () => {
    const user = userEvent.setup();
    render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

    // Open menu
    const menuButton = screen.getByTestId('icon-menu').closest('button');
    expect(menuButton).not.toBeNull();
    await user.click(menuButton as HTMLButtonElement);

    // Issues should have bg-accent class (active, it's the default tool)
    const issuesButtons = screen.getAllByText('Issues');
    const issuesMenuItem = issuesButtons.find((el) =>
      el.closest('button')?.className.includes('bg-accent')
    );
    expect(issuesMenuItem).toBeDefined();
  });

  describe('persistent terminal bar', () => {
    it('renders minimized terminal bar by default', () => {
      render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

      // Terminal bar should show Terminal icon and label
      expect(screen.getByTestId('icon-terminal')).toBeDefined();
      // Terminal text appears in the minimized bar
      expect(screen.getByText('Terminal')).toBeDefined();
      // ChevronUp icon for expand
      expect(screen.getByTestId('icon-chevronup')).toBeDefined();
    });

    it('expands terminal when minimized bar is clicked', async () => {
      const user = userEvent.setup();
      render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

      // Click the minimized terminal bar
      const terminalBar = screen.getByText('Terminal').closest('div');
      expect(terminalBar).not.toBeNull();
      await user.click(terminalBar as HTMLElement);

      // After expanding, ChevronDown (collapse) should appear in terminal header
      // (TerminalTool's tab bar also renders a ChevronDown in its dropdown button)
      const chevronDowns = screen.getAllByTestId('icon-chevrondown');
      const collapseChevron = chevronDowns.find((el) =>
        el.closest('button')?.classList.contains('hover:bg-accent')
      );
      expect(collapseChevron).toBeDefined();
      // Terminal tool should be rendered (xterm mock)
      await vi.waitFor(() => {
        expect(screen.getByTestId('xterm-terminal')).toBeDefined();
      });
    });

    it('collapses terminal when collapse button is clicked', async () => {
      const user = userEvent.setup();
      render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

      // Expand first
      const terminalBar = screen.getByText('Terminal').closest('div');
      await user.click(terminalBar as HTMLElement);

      // Now collapse using the ChevronDown button in the terminal header
      // (TerminalTool's tab bar also renders a ChevronDown in its dropdown button)
      const chevronDowns = screen.getAllByTestId('icon-chevrondown');
      const collapseChevron = chevronDowns.find((el) =>
        el.classList.contains('text-muted-foreground')
      );
      expect(collapseChevron).toBeDefined();
      const collapseButton = collapseChevron!.closest('button');
      expect(collapseButton).not.toBeNull();
      await user.click(collapseButton as HTMLButtonElement);

      // Should be back to minimized with ChevronUp
      expect(screen.getByTestId('icon-chevronup')).toBeDefined();
      // Terminal is always mounted (preserves xterm state) but container has height 0
      const terminalContainer = screen.getByTestId('xterm-terminal').closest('[style]');
      expect(terminalContainer).not.toBeNull();
      expect((terminalContainer as HTMLElement).style.height).toBe('0px');
    });

    it('shows drag handle when terminal is expanded', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />
      );

      // Expand terminal
      const terminalBar = screen.getByText('Terminal').closest('div');
      await user.click(terminalBar as HTMLElement);

      // Drag handle should be present (cursor-row-resize class)
      const dragHandle = container.querySelector('.cursor-row-resize');
      expect(dragHandle).not.toBeNull();
    });

    it('terminal bar is visible regardless of active tool', async () => {
      const user = userEvent.setup();
      render(<ToolsPanel workingDirectory={workingDirectory} onClose={mockOnClose} />);

      // Default: Issues tool active, terminal bar visible
      expect(screen.getByText('Terminal')).toBeDefined();

      // Switch to Dev Scripts
      const menuButton = screen.getByTestId('icon-menu').closest('button');
      await user.click(menuButton as HTMLButtonElement);
      const devScriptsOption = screen.getByText('Dev Scripts');
      await user.click(devScriptsOption);

      // Terminal bar should still be visible
      expect(screen.getByText('Terminal')).toBeDefined();
    });
  });

  describe('multi-session adoption', () => {
    it('auto-expands terminal when adoptSessions is provided', () => {
      const sessions = [
        { sessionId: 'session_1', output: 'output 1', name: 'Frontend' },
        { sessionId: 'session_2', output: 'output 2', name: 'Backend' },
      ];

      render(
        <ToolsPanel
          workingDirectory={workingDirectory}
          onClose={mockOnClose}
          adoptSessions={sessions}
          onSessionsAdopted={vi.fn()}
        />
      );

      // Terminal should be expanded (ChevronDown visible for collapse)
      // (TerminalTool's tab bar also renders a ChevronDown in its dropdown button)
      const chevronDowns = screen.getAllByTestId('icon-chevrondown');
      const collapseChevron = chevronDowns.find((el) =>
        el.classList.contains('text-muted-foreground')
      );
      expect(collapseChevron).toBeDefined();
      // Terminal label should be visible in the expanded header
      expect(screen.getByText('Terminal')).toBeDefined();
    });

    it('passes adoptSessions to TerminalTool', async () => {
      const mockOnSessionsAdopted = vi.fn();
      const sessions = [{ sessionId: 'adopted_1', output: 'test output', name: 'Script' }];

      render(
        <ToolsPanel
          workingDirectory={workingDirectory}
          onClose={mockOnClose}
          adoptSessions={sessions}
          onSessionsAdopted={mockOnSessionsAdopted}
        />
      );

      // Wait for adopted session to appear as a tab
      await vi.waitFor(() => {
        expect(screen.getByText(/Script/)).toBeDefined();
      });

      // onSessionsAdopted should be called
      expect(mockOnSessionsAdopted).toHaveBeenCalled();
    });
  });
});
