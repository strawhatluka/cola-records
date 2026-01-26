import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitPanel } from '@renderer/components/ide/git/GitPanel';

describe('Git Operations - Integration Tests', () => {
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
  });
  it('should handle complete commit workflow with staged files', async () => {
    const user = userEvent.setup();

    // Mock git status with staged and unstaged files
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-branch',
      tracking: 'origin/feature-branch',
      ahead: 0,
      behind: 0,
      files: [
        { path: 'file1.ts', index: 'M', working_dir: ' ' }, // staged
        { path: 'file2.ts', index: ' ', working_dir: 'M' }, // unstaged
      ],
    });

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/file1\.ts/)).toBeInTheDocument();
      expect(screen.getByText(/file2\.ts/)).toBeInTheDocument();
    });

    // Stage unstaged file
    mockInvoke.mockResolvedValueOnce(undefined); // stage response

    const stageButton = screen.getAllByRole('button', { name: /stage/i })[0];
    await user.click(stageButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:stage',
        '/test/repo',
        'file2.ts'
      );
    });

    // Open commit dialog
    const commitButton = screen.getByRole('button', { name: /commit/i });
    await user.click(commitButton);

    // Enter commit message
    const commitInput = screen.getByPlaceholderText(/commit message/i);
    await user.type(commitInput, 'feat: add new features');

    // Commit
    mockInvoke.mockResolvedValueOnce(undefined);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:commit',
        '/test/repo',
        'feat: add new features'
      );
    });

    // Verify status updates
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-branch',
      tracking: 'origin/feature-branch',
      ahead: 1,
      behind: 0,
      files: [],
    });

    await waitFor(() => {
      expect(screen.getByText(/1.*ahead/i)).toBeInTheDocument();
    });
  });

  it('should handle branch switching workflow', async () => {
    const user = userEvent.setup();

    // Mock initial git status
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [],
    });

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    // Mock branch list
    mockInvoke.mockResolvedValueOnce([
      { name: 'main', current: true },
      { name: 'feature-a', current: false },
      { name: 'feature-b', current: false },
    ]);

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    await waitFor(() => {
      expect(screen.getByText('feature-a')).toBeInTheDocument();
      expect(screen.getByText('feature-b')).toBeInTheDocument();
    });

    // Switch to feature-a
    mockInvoke.mockResolvedValueOnce(undefined); // checkout response

    const featureAButton = screen.getByRole('button', { name: /feature-a/i });
    await user.click(featureAButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:checkout',
        '/test/repo',
        'feature-a'
      );
    });

    // Verify new git status
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-a',
      tracking: 'origin/feature-a',
      ahead: 0,
      behind: 0,
      files: [],
    });

    await waitFor(() => {
      expect(screen.getByText('feature-a')).toBeInTheDocument();
    });
  });

  it('should handle merge conflict resolution', async () => {
    const user = userEvent.setup();

    // Mock git status with conflict
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-branch',
      tracking: 'origin/feature-branch',
      ahead: 0,
      behind: 1,
      files: [
        { path: 'conflicted.ts', index: 'U', working_dir: 'U' }, // conflict
      ],
    });

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/conflicted\.ts/)).toBeInTheDocument();
      expect(screen.getByText(/conflict/i)).toBeInTheDocument();
    });

    // Attempt pull (which would show conflict)
    mockInvoke.mockRejectedValueOnce(new Error('Merge conflict detected'));

    const pullButton = screen.getByRole('button', { name: /pull/i });
    await user.click(pullButton);

    await waitFor(() => {
      expect(screen.getByText(/merge conflict/i)).toBeInTheDocument();
    });

    // User resolves conflict in editor (simulated)
    // Mark as resolved
    mockInvoke.mockResolvedValueOnce(undefined);

    const resolveButton = screen.getByRole('button', { name: /resolve/i });
    await user.click(resolveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:add',
        '/test/repo',
        'conflicted.ts'
      );
    });

    // Complete merge with commit
    mockInvoke.mockResolvedValueOnce(undefined);

    const commitButton = screen.getByRole('button', { name: /commit/i });
    await user.click(commitButton);

    const commitInput = screen.getByPlaceholderText(/commit message/i);
    await user.type(commitInput, 'Resolve merge conflict');

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:commit',
        '/test/repo',
        'Resolve merge conflict'
      );
    });
  });

  it('should handle pull with remote changes', async () => {
    const user = userEvent.setup();

    // Mock git status showing behind remote
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 3,
      files: [],
    });

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/3.*behind/i)).toBeInTheDocument();
    });

    // Pull changes
    mockInvoke.mockResolvedValueOnce({
      filesChanged: 5,
      insertions: 120,
      deletions: 45,
    });

    const pullButton = screen.getByRole('button', { name: /pull/i });
    await user.click(pullButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:pull', '/test/repo');
    });

    // Verify updated status
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [],
    });

    await waitFor(() => {
      expect(screen.queryByText(/behind/i)).not.toBeInTheDocument();
      expect(screen.getByText(/up to date/i)).toBeInTheDocument();
    });
  });

  it('should handle push with authentication failure', async () => {
    const user = userEvent.setup();

    // Mock git status with commits ahead
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-branch',
      tracking: 'origin/feature-branch',
      ahead: 2,
      behind: 0,
      files: [],
    });

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText(/2.*ahead/i)).toBeInTheDocument();
    });

    // Attempt push with auth failure
    mockInvoke.mockRejectedValueOnce(
      new Error('Authentication failed: invalid credentials')
    );

    const pushButton = screen.getByRole('button', { name: /push/i });
    await user.click(pushButton);

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    // Show retry option
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Retry with success
    mockInvoke.mockResolvedValueOnce(undefined);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:push', '/test/repo');
    });

    // Verify success
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-branch',
      tracking: 'origin/feature-branch',
      ahead: 0,
      behind: 0,
      files: [],
    });

    await waitFor(() => {
      expect(screen.queryByText(/ahead/i)).not.toBeInTheDocument();
    });
  });

  it('should handle creating new branch from current', async () => {
    const user = userEvent.setup();

    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [],
    });

    render(<GitPanel repoPath="/test/repo" />);

    // Open branch menu
    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    // Click create new branch
    const createButton = screen.getByRole('button', { name: /new branch/i });
    await user.click(createButton);

    // Enter branch name
    const branchInput = screen.getByPlaceholderText(/branch name/i);
    await user.type(branchInput, 'feature-new-feature');

    // Create branch
    mockInvoke.mockResolvedValueOnce(undefined);

    const confirmButton = screen.getByRole('button', { name: /create/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:create-branch',
        '/test/repo',
        'feature-new-feature'
      );
    });

    // Verify checkout to new branch
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-new-feature',
      tracking: null,
      ahead: 0,
      behind: 0,
      files: [],
    });

    await waitFor(() => {
      expect(screen.getByText('feature-new-feature')).toBeInTheDocument();
    });
  });

  it('should handle stashing changes before branch switch', async () => {
    const user = userEvent.setup();

    // Mock git status with uncommitted changes
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [
        { path: 'modified.ts', index: ' ', working_dir: 'M' },
      ],
    });

    render(<GitPanel repoPath="/test/repo" />);

    // Attempt to switch branch
    mockInvoke.mockResolvedValueOnce([
      { name: 'main', current: true },
      { name: 'feature-a', current: false },
    ]);

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    const featureAButton = await screen.findByRole('button', {
      name: /feature-a/i,
    });
    await user.click(featureAButton);

    // Show stash prompt
    await waitFor(() => {
      expect(screen.getByText(/uncommitted changes/i)).toBeInTheDocument();
      expect(screen.getByText(/stash/i)).toBeInTheDocument();
    });

    // Stash changes
    mockInvoke.mockResolvedValueOnce(undefined);

    const stashButton = screen.getByRole('button', { name: /stash/i });
    await user.click(stashButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:stash', '/test/repo');
    });

    // Proceed with checkout
    mockInvoke.mockResolvedValueOnce(undefined);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:checkout',
        '/test/repo',
        'feature-a'
      );
    });

    // Verify new branch
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-a',
      tracking: 'origin/feature-a',
      ahead: 0,
      behind: 0,
      files: [],
    });

    await waitFor(() => {
      expect(screen.getByText('feature-a')).toBeInTheDocument();
    });
  });
});
