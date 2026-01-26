import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IDELayout } from '@renderer/components/ide/IDELayout';
import { useIDEStore } from '@renderer/stores/useIDEStore';
import { useGitStore } from '@renderer/stores/useGitStore';

const mockContribution = {
  id: 'test-contribution',
  repositoryUrl: 'https://github.com/test/repo',
  localPath: '/test/repo',
  issueNumber: 123,
  issueTitle: 'Test issue',
  branchName: 'feature-test',
  status: 'in_progress' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => () => {});

describe('IDELayout - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.window = global.window || ({} as any);
    (global.window as any).electronAPI = {
      invoke: mockInvoke,
      on: mockOn,
    };

    // Reset stores
    useIDEStore.setState({
      panelSizes: {
        fileTree: 25,
        main: 75,
        editor: 60,
        terminal: 40,
      },
      focusedPanel: null,
    });

    useGitStore.setState({
      currentBranch: null,
      status: null,
      commits: [],
      loading: false,
      error: null,
    });
  });

  it('should render all IDE panels', async () => {
    // Mock IPC responses for file tree, git status, and terminal
    mockInvoke
      .mockResolvedValueOnce([  // fs:read-directory for file tree
        {
          name: 'src',
          path: '/test/repo/src',
          type: 'directory',
          children: [
            { name: 'index.ts', path: '/test/repo/src/index.ts', type: 'file' },
          ],
        },
      ])
      .mockResolvedValueOnce(undefined) // fs:watch-directory
      .mockResolvedValueOnce({ current: 'main', files: [] }) // git:status
      .mockResolvedValueOnce('session-123'); // terminal:spawn

    render(<IDELayout contribution={mockContribution} />);

    // Should have app bar
    expect(screen.getByText('repo')).toBeInTheDocument(); // Repo name

    // Should render all panels (file tree, editor, terminal, git, status bar)
    expect(await screen.findByRole('tree')).toBeInTheDocument(); // File tree
    expect(screen.getByRole('tablist')).toBeInTheDocument(); // Editor tabs
    expect(screen.getByText(/terminal/i)).toBeInTheDocument();
  });

  it('should persist panel sizes', () => {
    const { savePanelSizes } = useIDEStore.getState();

    const newLayout = {
      'file-tree': 30,
      'main': 70,
      'editor': 65,
      'terminal': 35,
    };

    savePanelSizes(newLayout);

    const { panelSizes } = useIDEStore.getState();
    expect(panelSizes.fileTree).toBe(30);
    expect(panelSizes.main).toBe(70);
    expect(panelSizes.editor).toBe(65);
    expect(panelSizes.terminal).toBe(35);
  });

  it('should reset panel sizes to defaults', () => {
    const { savePanelSizes, resetPanelSizes } = useIDEStore.getState();

    // Change sizes
    savePanelSizes({
      'file-tree': 50,
      'main': 50,
      'editor': 80,
      'terminal': 20,
    });

    // Reset
    resetPanelSizes();

    const { panelSizes } = useIDEStore.getState();
    expect(panelSizes.fileTree).toBe(25);
    expect(panelSizes.main).toBe(75);
    expect(panelSizes.editor).toBe(60);
    expect(panelSizes.terminal).toBe(40);
  });

  it('should show git panel in app bar', () => {
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      files: [],
    });

    render(<IDELayout contribution={mockContribution} />);

    expect(screen.getByText(/main/i)).toBeInTheDocument(); // Branch button
  });

  it('should show status bar with git info', () => {
    // Mock git status to return feature-branch
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-branch',
      files: [],
    });

    // Set the current branch in git store
    useGitStore.setState({
      currentBranch: 'feature-branch',
    });

    render(<IDELayout contribution={mockContribution} />);

    // Branch name appears in both GitPanel and status bar
    const branchElements = screen.getAllByText('feature-branch');
    expect(branchElements.length).toBeGreaterThan(0);
  });

  it('should track focused panel', () => {
    render(<IDELayout contribution={mockContribution} />);

    const { setFocusedPanel, focusedPanel: initialFocus } = useIDEStore.getState();
    expect(initialFocus).toBeNull();

    setFocusedPanel('editor');
    expect(useIDEStore.getState().focusedPanel).toBe('editor');

    setFocusedPanel('terminal');
    expect(useIDEStore.getState().focusedPanel).toBe('terminal');

    setFocusedPanel('file-tree');
    expect(useIDEStore.getState().focusedPanel).toBe('file-tree');
  });
});
