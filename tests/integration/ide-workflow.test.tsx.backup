import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDELayout } from '@renderer/components/ide/IDELayout';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';
import { useTerminalStore } from '@renderer/stores/useTerminalStore';
import { useIDEStore } from '@renderer/stores/useIDEStore';

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

describe('IDE Workflow - Complete Integration Tests', () => {
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

    // Reset all stores
    useCodeEditorStore.setState({
      openFiles: new Map(),
      activeFilePath: null,
      modifiedFiles: new Set(),
      loading: false,
    });

    useTerminalStore.setState({
      sessions: new Map(),
      activeSessionId: null,
    });

    useIDEStore.setState({
      panelSizes: {
        fileTree: 25,
        main: 75,
        editor: 60,
        terminal: 40,
      },
      focusedPanel: null,
    });
  });
  it('should complete full workflow: load → edit → save → commit → push', async () => {
    const user = userEvent.setup();

    // Mock file tree load
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory',
        children: [
          { name: 'index.ts', path: '/test/repo/src/index.ts', type: 'file' },
        ],
      },
    ]);

    // Mock git status
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-test',
      tracking: 'origin/feature-test',
      ahead: 0,
      behind: 0,
      files: [],
    });

    // Mock terminal creation
    mockInvoke.mockResolvedValueOnce('session-123');

    render(<IDELayout contribution={mockContribution} />);

    // Step 1: Wait for file tree to load
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    // Step 2: Open file
    mockInvoke.mockResolvedValueOnce({
      content: 'export const greeting = "Hello";',
      encoding: 'utf-8',
    });

    const fileNode = screen.getByText('index.ts');
    await user.click(fileNode);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:read-file',
        '/test/repo/src/index.ts'
      );
    });

    // Step 3: Edit content
    const { updateContent } = useCodeEditorStore.getState();
    updateContent(
      '/test/repo/src/index.ts',
      'export const greeting = "Hello World";'
    );

    // Verify unsaved changes indicator
    const { modifiedFiles } = useCodeEditorStore.getState();
    expect(modifiedFiles.has('/test/repo/src/index.ts')).toBe(true);

    // Step 4: Save file (Ctrl+S)
    mockInvoke.mockResolvedValueOnce(undefined); // save response

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/src/index.ts',
        'export const greeting = "Hello World";'
      );
    });

    // Verify unsaved changes cleared
    expect(useCodeEditorStore.getState().modifiedFiles.size).toBe(0);

    // Step 5: Refresh git status to show changes
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-test',
      tracking: 'origin/feature-test',
      ahead: 0,
      behind: 0,
      files: [
        { path: 'src/index.ts', index: ' ', working_dir: 'M' },
      ],
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText(/1.*modified/i)).toBeInTheDocument();
    });

    // Step 6: Commit changes
    mockInvoke.mockResolvedValueOnce(undefined); // commit response

    const commitButton = screen.getByRole('button', { name: /commit/i });
    await user.click(commitButton);

    const commitMessageInput = screen.getByPlaceholderText(/commit message/i);
    await user.type(commitMessageInput, 'Update greeting message');

    const confirmCommitButton = screen.getByRole('button', {
      name: /confirm/i,
    });
    await user.click(confirmCommitButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:commit',
        '/test/repo',
        'Update greeting message'
      );
    });

    // Step 7: Push changes
    mockInvoke.mockResolvedValueOnce(undefined); // push response

    const pushButton = screen.getByRole('button', { name: /push/i });
    await user.click(pushButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:push', '/test/repo');
    });

    // Step 8: Verify final git status shows pushed state
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-test',
      tracking: 'origin/feature-test',
      ahead: 0,
      behind: 0,
      files: [],
    });

    await waitFor(() => {
      expect(screen.queryByText(/modified/i)).not.toBeInTheDocument();
    });
  });

  it('should handle concurrent file editing and terminal execution', async () => {
    const user = userEvent.setup();

    // Mock file tree and git status
    mockInvoke
      .mockResolvedValueOnce([
        { name: 'package.json', path: '/test/repo/package.json', type: 'file' },
      ])
      .mockResolvedValueOnce({
        current: 'main',
        files: [],
      })
      .mockResolvedValueOnce('session-456'); // terminal session

    render(<IDELayout contribution={mockContribution} />);

    // Open file in editor
    mockInvoke.mockResolvedValueOnce({
      content: '{"name": "test-project"}',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('package.json');
    await user.click(fileNode);

    // Execute terminal command concurrently
    const { sessions } = useTerminalStore.getState();
    const sessionId = Array.from(sessions.keys())[0];

    mockInvoke.mockResolvedValueOnce(undefined); // terminal input

    // Simulate typing in terminal
    mockOn.mock.calls.forEach(([event, handler]) => {
      if (event === 'terminal:data') {
        handler({
          sessionId,
          data: 'npm install\r\n',
        });
      }
    });

    // Edit file while terminal is running
    const { updateContent } = useCodeEditorStore.getState();
    updateContent(
      '/test/repo/package.json',
      '{"name": "test-project", "version": "1.0.0"}'
    );

    // Verify both operations are independent
    expect(useCodeEditorStore.getState().modifiedFiles.size).toBe(1);
    expect(useTerminalStore.getState().sessions.size).toBeGreaterThan(0);
  });

  it('should handle panel resizing during active editing', async () => {
    const user = userEvent.setup();

    mockInvoke
      .mockResolvedValueOnce([
        { name: 'test.ts', path: '/test/repo/test.ts', type: 'file' },
      ])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-789');

    render(<IDELayout contribution={mockContribution} />);

    // Open file
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = 1;',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('test.ts');
    await user.click(fileNode);

    // Resize panel
    const { savePanelSizes } = useIDEStore.getState();
    savePanelSizes({
      'file-tree': 30,
      'main': 70,
      'editor': 65,
      'terminal': 35,
    });

    // Verify content is still editable after resize
    const { updateContent } = useCodeEditorStore.getState();
    updateContent('/test/repo/test.ts', 'const test = 2;');

    expect(useCodeEditorStore.getState().modifiedFiles.has('/test/repo/test.ts')).toBe(true);
    expect(useIDEStore.getState().panelSizes.fileTree).toBe(30);
  });

  it('should maintain state across panel focus changes', async () => {
    const user = userEvent.setup();

    mockInvoke
      .mockResolvedValueOnce([
        { name: 'app.ts', path: '/test/repo/app.ts', type: 'file' },
      ])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-abc');

    render(<IDELayout contribution={mockContribution} />);

    // Open file in editor
    mockInvoke.mockResolvedValueOnce({
      content: 'console.log("test");',
      encoding: 'utf-8',
    });

    const fileNode = await screen.findByText('app.ts');
    await user.click(fileNode);

    const { updateContent } = useCodeEditorStore.getState();
    updateContent('/test/repo/app.ts', 'console.log("updated");');

    // Switch focus to terminal
    const { setFocusedPanel } = useIDEStore.getState();
    setFocusedPanel('terminal');

    expect(useIDEStore.getState().focusedPanel).toBe('terminal');

    // Switch back to editor
    setFocusedPanel('editor');

    // Verify editor state is preserved
    const { openFiles, modifiedFiles } = useCodeEditorStore.getState();
    const appFile = openFiles.get('/test/repo/app.ts');
    expect(appFile?.content).toBe('console.log("updated");');
    expect(modifiedFiles.has('/test/repo/app.ts')).toBe(true);
  });
});
