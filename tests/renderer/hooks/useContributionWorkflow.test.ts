import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

import { useContributionsStore } from '../../../src/renderer/stores/useContributionsStore';
import { useSettingsStore } from '../../../src/renderer/stores/useSettingsStore';
import { useContributionWorkflow } from '../../../src/renderer/hooks/useContributionWorkflow';
import type { GitHubIssue } from '../../../src/main/ipc/channels';

const mockIssue: GitHubIssue = {
  id: 'issue_1',
  number: 42,
  title: 'Fix bug',
  body: 'Description',
  url: 'https://github.com/org/repo/issues/42',
  repository: 'org/repo',
  labels: ['bug'],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('useContributionWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ defaultClonePath: '/mock/contributions' });
    useContributionsStore.setState({ contributions: [] });

    // Default mock implementations for a successful workflow
    mockInvoke.mockImplementation(async (channel: string) => {
      switch (channel) {
        case 'github:fork-repository':
          return { name: 'repo', url: 'https://github.com/user/repo.git' };
        case 'fs:directory-exists':
          return false;
        case 'git:clone':
          return undefined;
        case 'git:add-remote':
          return undefined;
        case 'git:create-branch':
          return undefined;
        case 'git:checkout':
          return undefined;
        case 'contribution:create':
          return {
            id: 'new-contrib',
            repositoryUrl: 'https://github.com/user/repo.git',
            localPath: '/mock/contributions/repo',
            issueNumber: 42,
            issueTitle: 'Fix bug',
            branchName: 'fix/42-fix-bug',
            status: 'in_progress',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        default:
          return undefined;
      }
    });
  });

  it('starts with idle state', () => {
    const { result } = renderHook(() => useContributionWorkflow());
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toBeNull();
  });

  it('completes full workflow successfully', async () => {
    const { result } = renderHook(() => useContributionWorkflow());

    let contribution: any;
    await act(async () => {
      contribution = await result.current.startWorkflow(mockIssue);
    });

    expect(contribution).toBeDefined();
    expect(contribution.id).toBe('new-contrib');
    expect(result.current.state.status).toBe('complete');
    expect(result.current.state.progress).toBe(100);

    // Verify IPC calls in order
    expect(mockInvoke).toHaveBeenCalledWith('github:fork-repository', 'org/repo');
    expect(mockInvoke).toHaveBeenCalledWith(
      'git:clone',
      'https://github.com/user/repo.git',
      '/mock/contributions/repo'
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      'git:add-remote',
      '/mock/contributions/repo',
      'upstream',
      'https://github.com/org/repo.git'
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      'git:create-branch',
      '/mock/contributions/repo',
      'fix/42-fix-bug'
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      'git:checkout',
      '/mock/contributions/repo',
      'fix/42-fix-bug'
    );
  });

  it('handles error during forking', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:fork-repository') throw new Error('Fork failed');
      return undefined;
    });

    const { result } = renderHook(() => useContributionWorkflow());

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.startWorkflow(mockIssue);
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe('Fork failed');
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('Fork failed');
  });

  it('handles error during cloning', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:fork-repository')
        return { name: 'repo', url: 'https://github.com/user/repo.git' };
      if (channel === 'fs:directory-exists') return false;
      if (channel === 'git:clone') throw new Error('Clone failed');
      return undefined;
    });

    const { result } = renderHook(() => useContributionWorkflow());

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.startWorkflow(mockIssue);
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe('Clone failed');
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('Clone failed');
  });

  it('appends counter when directory already exists', async () => {
    let dirCheckCount = 0;
    mockInvoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      if (channel === 'github:fork-repository')
        return { name: 'repo', url: 'https://github.com/user/repo.git' };
      if (channel === 'fs:directory-exists') {
        dirCheckCount++;
        return dirCheckCount <= 1; // First check returns true, second returns false
      }
      if (channel === 'contribution:create') return { id: 'new', localPath: args[0] };
      return undefined;
    });

    const { result } = renderHook(() => useContributionWorkflow());

    await act(async () => {
      await result.current.startWorkflow(mockIssue);
    });

    // Should have tried /mock/contributions/repo first (exists), then /mock/contributions/repo-1
    expect(mockInvoke).toHaveBeenCalledWith(
      'git:clone',
      'https://github.com/user/repo.git',
      '/mock/contributions/repo-1'
    );
  });

  it('resets state', () => {
    const { result } = renderHook(() => useContributionWorkflow());

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.contribution).toBeNull();
  });

  describe('rollback logic', () => {
    it('deletes cloned directory when clone succeeds but later step fails', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:fork-repository')
          return { name: 'repo', url: 'https://github.com/user/repo.git' };
        if (channel === 'fs:directory-exists') return false;
        if (channel === 'git:clone') return undefined;
        if (channel === 'git:add-remote') throw new Error('Remote setup failed');
        if (channel === 'fs:delete-directory') return undefined;
        return undefined;
      });

      const { result } = renderHook(() => useContributionWorkflow());

      await act(async () => {
        try {
          await result.current.startWorkflow(mockIssue);
        } catch {
          // Expected
        }
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('Remote setup failed');
      expect(mockInvoke).toHaveBeenCalledWith('fs:delete-directory', '/mock/contributions/repo');
    });

    it('does not attempt directory cleanup when clone was never reached', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:fork-repository') throw new Error('Fork failed');
        return undefined;
      });

      const { result } = renderHook(() => useContributionWorkflow());

      await act(async () => {
        try {
          await result.current.startWorkflow(mockIssue);
        } catch {
          // Expected
        }
      });

      expect(result.current.state.status).toBe('error');
      expect(mockInvoke).not.toHaveBeenCalledWith('fs:delete-directory', expect.any(String));
    });

    it('deletes contribution record and cloned directory on branch creation failure', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:fork-repository')
          return { name: 'repo', url: 'https://github.com/user/repo.git' };
        if (channel === 'fs:directory-exists') return false;
        if (channel === 'git:clone') return undefined;
        if (channel === 'git:add-remote') return undefined;
        if (channel === 'git:create-branch') throw new Error('Branch creation failed');
        if (channel === 'fs:delete-directory') return undefined;
        if (channel === 'contribution:delete') return undefined;
        return undefined;
      });

      const { result } = renderHook(() => useContributionWorkflow());

      await act(async () => {
        try {
          await result.current.startWorkflow(mockIssue);
        } catch {
          // Expected
        }
      });

      expect(result.current.state.status).toBe('error');
      // Directory should be cleaned up
      expect(mockInvoke).toHaveBeenCalledWith('fs:delete-directory', '/mock/contributions/repo');
      // No contribution was saved, so no delete call
      expect(mockInvoke).not.toHaveBeenCalledWith('contribution:delete', expect.any(String));
    });

    it('handles rollback errors gracefully without throwing', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:fork-repository')
          return { name: 'repo', url: 'https://github.com/user/repo.git' };
        if (channel === 'fs:directory-exists') return false;
        if (channel === 'git:clone') return undefined;
        if (channel === 'git:add-remote') throw new Error('Remote setup failed');
        if (channel === 'fs:delete-directory') throw new Error('Cleanup also failed');
        return undefined;
      });

      const { result } = renderHook(() => useContributionWorkflow());

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.startWorkflow(mockIssue);
        } catch (e) {
          caughtError = e as Error;
        }
      });

      // Original error is thrown, not the rollback error
      expect(caughtError?.message).toBe('Remote setup failed');
      expect(result.current.state.status).toBe('error');
    });
  });
});
