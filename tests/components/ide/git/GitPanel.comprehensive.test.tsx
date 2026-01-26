import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GitPanel } from '@renderer/components/ide/git/GitPanel';
import { useGitStore } from '@renderer/stores/useGitStore';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => () => {});

vi.mock('@renderer/ipc/client', () => ({
  ipc: {
    invoke: mockInvoke,
    on: mockOn,
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('GitPanel - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store
    useGitStore.setState({
      repoPath: null,
      status: null,
      commits: [],
      branches: [],
      currentBranch: null,
      loading: false,
      error: null,
      lastRefresh: null,
    });
  });

  it('should show git status summary', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [
        { path: 'file1.ts', index: 'M', working_dir: ' ' },
        { path: 'file2.ts', index: 'M', working_dir: ' ' },
        { path: 'file3.ts', index: 'A', working_dir: ' ' },
        { path: 'file4.ts', index: ' ', working_dir: '?' },
      ],
    });

    render(<GitPanel repoPath="/test/repo" />);

    // Wait for branch button and click to open dropdown
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    await waitFor(() => {
      expect(screen.getByText(/2.*modified/i)).toBeInTheDocument();
      expect(screen.getByText(/1.*added/i)).toBeInTheDocument();
      expect(screen.getByText(/1.*untracked/i)).toBeInTheDocument();
    });
  });

  it('should open commit dialog', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      files: [{ path: 'file1.ts', index: 'M', working_dir: ' ' }],
    });

    render(<GitPanel repoPath="/test/repo" />);

    // Wait for branch button and click to open dropdown
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    await waitFor(() => {
      const commitButton = screen.getByRole('button', { name: /commit/i });
      expect(commitButton).toBeInTheDocument();
    });

    const commitButton = screen.getByRole('button', { name: /commit/i });
    await user.click(commitButton);

    await waitFor(() => {
      expect(screen.getByText(/commit changes/i)).toBeInTheDocument();
    });
  });

  it('should commit changes', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        current: 'main',
        files: [{ path: 'file1.ts', index: 'M', working_dir: ' ' }],
      })
      .mockResolvedValueOnce(undefined) // git:add
      .mockResolvedValueOnce(undefined); // git:commit

    render(<GitPanel repoPath="/test/repo" />);

    // Wait for branch button and click to open dropdown
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    // Open commit dialog
    await waitFor(() => {
      const commitButton = screen.getByRole('button', { name: /commit/i });
      expect(commitButton).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /commit/i }));

    // Enter commit message
    const messageInput = screen.getByPlaceholderText(/describe your changes/i);
    await user.type(messageInput, 'Test commit');

    // Select files
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Submit
    const submitButton = screen.getAllByRole('button', { name: /commit/i })[1];
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:commit',
        '/test/repo',
        expect.stringContaining('Test commit')
      );
    });
  });

  it('should push changes', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        current: 'main',
        tracking: 'origin/main',
        ahead: 2,
        files: [],
      })
      .mockResolvedValueOnce(undefined); // git:push

    render(<GitPanel repoPath="/test/repo" />);

    // Wait for branch button and click to open dropdown
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    await waitFor(() => {
      const pushButton = screen.getByRole('button', { name: /push/i });
      expect(pushButton).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /push/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:push',
        '/test/repo',
        'origin',
        'main'
      );
    });
  });

  it('should pull changes', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        current: 'main',
        tracking: 'origin/main',
        behind: 3,
        files: [],
      })
      .mockResolvedValueOnce(undefined); // git:pull

    render(<GitPanel repoPath="/test/repo" />);

    // Wait for branch button and click to open dropdown
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    await waitFor(() => {
      const pullButton = screen.getByRole('button', { name: /pull/i });
      expect(pullButton).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /pull/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git:pull',
        '/test/repo',
        'origin',
        'main'
      );
    });
  });

  it('should refresh git status', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        current: 'main',
        files: [],
      })
      .mockResolvedValueOnce({
        current: 'main',
        files: [{ path: 'new-file.ts', index: 'A', working_dir: ' ' }],
      });

    render(<GitPanel repoPath="/test/repo" />);

    // Wait for branch button and click to open dropdown
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    const branchButton = screen.getByRole('button', { name: /main/i });
    await user.click(branchButton);

    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(3); // mount + dropdown + refresh button
    });
  });

  it('should show branch name', async () => {
    mockInvoke.mockResolvedValueOnce({
      current: 'feature-branch',
      files: [],
    });

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });
  });

  it('should handle git errors gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Git not found'));

    render(<GitPanel repoPath="/test/repo" />);

    await waitFor(() => {
      const { error } = useGitStore.getState();
      expect(error).toBe('Error: Git not found');
    });
  });
});
