import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContributionsStore } from '../../renderer/stores/useContributionsStore';

// Mock the IPC client
vi.mock('../../renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));

describe('useContributionsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useContributionsStore());
    act(() => {
      result.current.contributions = [];
      result.current.loading = false;
      result.current.error = null;
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useContributionsStore());

    expect(result.current.contributions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should fetch contributions', async () => {
    const { ipc } = await import('../../renderer/ipc/client');
    const mockContributions = [
      {
        id: '1',
        repositoryUrl: 'https://github.com/test/repo',
        localPath: '/path/to/repo',
        issueNumber: 123,
        issueTitle: 'Test Issue',
        branchName: 'feature/test',
        status: 'in_progress' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(ipc.invoke).mockResolvedValueOnce(mockContributions);

    const { result } = renderHook(() => useContributionsStore());

    await act(async () => {
      await result.current.fetchContributions();
    });

    expect(result.current.contributions).toEqual(mockContributions);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const { ipc } = await import('../../renderer/ipc/client');
    const errorMessage = 'Failed to fetch';

    vi.mocked(ipc.invoke).mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useContributionsStore());

    await act(async () => {
      await result.current.fetchContributions();
    });

    expect(result.current.error).toContain(errorMessage);
    expect(result.current.loading).toBe(false);
  });

  it('should get contribution by id', () => {
    const mockContribution = {
      id: '1',
      repositoryUrl: 'https://github.com/test/repo',
      localPath: '/path/to/repo',
      issueNumber: 123,
      issueTitle: 'Test Issue',
      branchName: 'feature/test',
      status: 'in_progress' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { result } = renderHook(() => useContributionsStore());

    act(() => {
      result.current.contributions = [mockContribution];
    });

    const found = result.current.getContributionById('1');
    expect(found).toEqual(mockContribution);

    const notFound = result.current.getContributionById('999');
    expect(notFound).toBeUndefined();
  });
});
