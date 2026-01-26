import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContributionWorkflow } from '@renderer/hooks/useContributionWorkflow';
import type { GitHubIssue, Contribution, GitHubRepository } from '@main/ipc/channels';

// Mock the IPC client
vi.mock('../../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));

// Mock the stores
vi.mock('../../renderer/stores/useContributionsStore', () => ({
  useContributionsStore: () => ({
    createContribution: vi.fn().mockResolvedValue({
      id: '1',
      repositoryUrl: 'https://github.com/user/forked-repo',
      localPath: '/path/to/repo',
      issueNumber: 123,
      issueTitle: 'Test Issue',
      branchName: 'fix-issue-123',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  }),
}));

vi.mock('../../renderer/stores/useSettingsStore', () => ({
  useSettingsStore: () => ({
    defaultClonePath: '/path/to',
  }),
}));

describe('useContributionWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have initial idle state', () => {
    const { result } = renderHook(() => useContributionWorkflow());

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toBe(null);
    expect(result.current.state.contribution).toBe(null);
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useContributionWorkflow());

    // Manually change state
    act(() => {
      result.current.state.status = 'error';
      result.current.state.progress = 50;
      result.current.state.error = 'Test error';
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toBe(null);
    expect(result.current.state.contribution).toBe(null);
  });

  it('should complete full workflow successfully', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/123',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFork: GitHubRepository = {
      id: 'fork-1',
      name: 'repo',
      fullName: 'user/repo',
      description: 'Forked repo',
      url: 'https://github.com/user/repo',
      language: 'TypeScript',
      stars: 0,
      forks: 1,
      openIssues: 0,
      defaultBranch: 'main',
    };

    // Mock IPC calls
    vi.mocked(ipc.invoke)
      .mockResolvedValueOnce(mockFork) // fork-repository
      .mockResolvedValueOnce(undefined) // git:clone
      .mockResolvedValueOnce(undefined) // git:add-remote
      .mockResolvedValueOnce(undefined) // git:create-branch
      .mockResolvedValueOnce(undefined); // git:checkout

    const { result } = renderHook(() => useContributionWorkflow());

    let contribution: Contribution | undefined;
    await act(async () => {
      contribution = await result.current.startWorkflow(mockIssue);
    });

    // Verify all IPC calls
    expect(ipc.invoke).toHaveBeenCalledWith('github:fork-repository', 'owner/repo');
    expect(ipc.invoke).toHaveBeenCalledWith('git:clone', mockFork.url, '/path/to/repo');
    expect(ipc.invoke).toHaveBeenCalledWith('git:add-remote', '/path/to/repo', 'upstream', 'https://github.com/owner/repo.git');
    expect(ipc.invoke).toHaveBeenCalledWith('git:create-branch', '/path/to/repo', 'fix-issue-123');
    expect(ipc.invoke).toHaveBeenCalledWith('git:checkout', '/path/to/repo', 'fix-issue-123');

    // Verify final state
    expect(result.current.state.status).toBe('complete');
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.error).toBe(null);
    expect(result.current.state.contribution).toBeDefined();
    expect(contribution).toBeDefined();
  });

  it('should reach 100% progress on successful completion', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/123',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFork: GitHubRepository = {
      id: 'fork-1',
      name: 'repo',
      fullName: 'user/repo',
      description: 'Forked repo',
      url: 'https://github.com/user/repo',
      language: 'TypeScript',
      stars: 0,
      forks: 1,
      openIssues: 0,
      defaultBranch: 'main',
    };

    // Mock IPC calls
    vi.mocked(ipc.invoke).mockImplementation(async (...args: any[]) => {
      const [channel] = args;
      if (channel === 'github:fork-repository') {
        return mockFork;
      }
      return undefined;
    });

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      await result.current.startWorkflow(mockIssue);
    });

    // Verify final progress is 100%
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.status).toBe('complete');

  });

  it('should handle fork error and set error state', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/123',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const errorMessage = 'Failed to fork repository';
    vi.mocked(ipc.invoke).mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      try {
        await result.current.startWorkflow(mockIssue);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe(errorMessage);
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.contribution).toBe(null);
  });

  it('should handle clone error', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/123',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFork: GitHubRepository = {
      id: 'fork-1',
      name: 'repo',
      fullName: 'user/repo',
      description: 'Forked repo',
      url: 'https://github.com/user/repo',
      language: 'TypeScript',
      stars: 0,
      forks: 1,
      openIssues: 0,
      defaultBranch: 'main',
    };

    const errorMessage = 'Failed to clone repository';
    vi.mocked(ipc.invoke)
      .mockResolvedValueOnce(mockFork) // fork succeeds
      .mockRejectedValueOnce(new Error(errorMessage)); // clone fails

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      try {
        await result.current.startWorkflow(mockIssue);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe(errorMessage);
  });

  it('should handle remote setup error', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/123',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFork: GitHubRepository = {
      id: 'fork-1',
      name: 'repo',
      fullName: 'user/repo',
      description: 'Forked repo',
      url: 'https://github.com/user/repo',
      language: 'TypeScript',
      stars: 0,
      forks: 1,
      openIssues: 0,
      defaultBranch: 'main',
    };

    const errorMessage = 'Failed to add remote';
    vi.mocked(ipc.invoke)
      .mockResolvedValueOnce(mockFork) // fork succeeds
      .mockResolvedValueOnce(undefined) // clone succeeds
      .mockRejectedValueOnce(new Error(errorMessage)); // add-remote fails

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      try {
        await result.current.startWorkflow(mockIssue);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe(errorMessage);
  });

  it('should handle branch creation error', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/123',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFork: GitHubRepository = {
      id: 'fork-1',
      name: 'repo',
      fullName: 'user/repo',
      description: 'Forked repo',
      url: 'https://github.com/user/repo',
      language: 'TypeScript',
      stars: 0,
      forks: 1,
      openIssues: 0,
      defaultBranch: 'main',
    };

    const errorMessage = 'Failed to create branch';
    vi.mocked(ipc.invoke)
      .mockResolvedValueOnce(mockFork) // fork succeeds
      .mockResolvedValueOnce(undefined) // clone succeeds
      .mockResolvedValueOnce(undefined) // add-remote succeeds
      .mockRejectedValueOnce(new Error(errorMessage)); // create-branch fails

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      try {
        await result.current.startWorkflow(mockIssue);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe(errorMessage);
  });

  it('should generate correct branch name from issue number', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 456,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/456',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFork: GitHubRepository = {
      id: 'fork-1',
      name: 'repo',
      fullName: 'user/repo',
      description: 'Forked repo',
      url: 'https://github.com/user/repo',
      language: 'TypeScript',
      stars: 0,
      forks: 1,
      openIssues: 0,
      defaultBranch: 'main',
    };

    vi.mocked(ipc.invoke).mockImplementation(async (...args: any[]) => {
      const [channel] = args;
      if (channel === 'github:fork-repository') return mockFork;
      return undefined;
    });

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      await result.current.startWorkflow(mockIssue);
    });

    expect(ipc.invoke).toHaveBeenCalledWith('git:create-branch', expect.any(String), 'fix-issue-456');
  });

  it('should use default clone path from settings', async () => {
    const { ipc } = await import('@renderer/ipc/client');

    const mockIssue: GitHubIssue = {
      id: 'issue-1',
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      url: 'https://github.com/owner/repo/issues/123',
      repository: 'owner/repo',
      labels: ['good first issue'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockFork: GitHubRepository = {
      id: 'fork-1',
      name: 'test-repo',
      fullName: 'user/test-repo',
      description: 'Forked repo',
      url: 'https://github.com/user/test-repo',
      language: 'TypeScript',
      stars: 0,
      forks: 1,
      openIssues: 0,
      defaultBranch: 'main',
    };

    vi.mocked(ipc.invoke).mockImplementation(async (...args: any[]) => {
      const [channel] = args;
      if (channel === 'github:fork-repository') return mockFork;
      return undefined;
    });

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      await result.current.startWorkflow(mockIssue);
    });

    expect(ipc.invoke).toHaveBeenCalledWith('git:clone', mockFork.url, '/path/to/test-repo');
  });
});
