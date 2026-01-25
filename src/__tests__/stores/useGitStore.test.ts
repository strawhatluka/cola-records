import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGitStore } from '../../renderer/stores/useGitStore';

// Mock IPC
const mockInvoke = vi.fn();
const mockOn = vi.fn(() => () => {});

describe('useGitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.window = global.window || ({} as any);
    (global.window as any).electronAPI = {
      invoke: mockInvoke,
      on: mockOn,
    };

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

  describe('fetchStatus', () => {
    it('should fetch git status via IPC', async () => {
      const mockStatus = {
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        files: [],
      };

      mockInvoke.mockResolvedValue(mockStatus);

      await useGitStore.getState().fetchStatus('/repo/path');

      expect(mockInvoke).toHaveBeenCalledWith('git:status', '/repo/path');
      expect(useGitStore.getState().status).toEqual(mockStatus);
      expect(useGitStore.getState().currentBranch).toBe('main');
    });

    it('should handle fetch error', async () => {
      mockInvoke.mockRejectedValue(new Error('Git not found'));

      await useGitStore.getState().fetchStatus('/repo/path');

      expect(useGitStore.getState().error).toBe('Error: Git not found');
      expect(useGitStore.getState().loading).toBe(false);
    });
  });

  describe('commit', () => {
    it('should stage and commit files', async () => {
      const mockStatus = {
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      };

      mockInvoke
        .mockResolvedValueOnce(undefined) // git:add
        .mockResolvedValueOnce(undefined) // git:commit
        .mockResolvedValueOnce(mockStatus); // git:status

      await useGitStore.getState().commit('/repo/path', 'Test commit', ['file1.ts', 'file2.ts']);

      expect(mockInvoke).toHaveBeenCalledWith('git:add', '/repo/path', ['file1.ts', 'file2.ts']);
      expect(mockInvoke).toHaveBeenCalledWith('git:commit', '/repo/path', 'Test commit');
      expect(mockInvoke).toHaveBeenCalledWith('git:status', '/repo/path');
    });
  });

  describe('push/pull', () => {
    it('should push to remote', async () => {
      const mockStatus = {
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        files: [],
      };

      useGitStore.setState({ currentBranch: 'main' });

      mockInvoke
        .mockResolvedValueOnce(undefined) // git:push
        .mockResolvedValueOnce(mockStatus); // git:status

      await useGitStore.getState().push('/repo/path');

      expect(mockInvoke).toHaveBeenCalledWith('git:push', '/repo/path', 'origin', 'main');
    });

    it('should pull from remote', async () => {
      const mockStatus = {
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        files: [],
      };

      useGitStore.setState({ currentBranch: 'main' });

      mockInvoke
        .mockResolvedValueOnce(undefined) // git:pull
        .mockResolvedValueOnce(mockStatus); // git:status

      await useGitStore.getState().pull('/repo/path');

      expect(mockInvoke).toHaveBeenCalledWith('git:pull', '/repo/path', 'origin', 'main');
    });
  });

  describe('branches', () => {
    it('should create new branch', async () => {
      const mockStatus = {
        current: 'feature-new',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      };

      mockInvoke
        .mockResolvedValueOnce(undefined) // git:create-branch
        .mockResolvedValueOnce(mockStatus); // git:status (fetchBranches)

      await useGitStore.getState().createBranch('/repo/path', 'feature-new');

      expect(mockInvoke).toHaveBeenCalledWith('git:create-branch', '/repo/path', 'feature-new');
    });

    it('should switch branch', async () => {
      const mockStatus = {
        current: 'develop',
        tracking: 'origin/develop',
        ahead: 0,
        behind: 0,
        files: [],
      };

      mockInvoke
        .mockResolvedValueOnce(undefined) // git:checkout
        .mockResolvedValueOnce(mockStatus) // git:status
        .mockResolvedValueOnce(mockStatus); // git:status (fetchBranches)

      await useGitStore.getState().switchBranch('/repo/path', 'develop');

      expect(mockInvoke).toHaveBeenCalledWith('git:checkout', '/repo/path', 'develop');
    });
  });

  describe('refreshStatus', () => {
    it('should debounce status refresh', async () => {
      vi.useFakeTimers();

      const { refreshStatus } = useGitStore.getState();

      // Call refresh multiple times
      refreshStatus('/repo/path');
      refreshStatus('/repo/path');
      refreshStatus('/repo/path');

      // Should not call immediately
      expect(mockInvoke).not.toHaveBeenCalled();

      // Fast forward past debounce delay
      vi.advanceTimersByTime(500);

      // Should only call once after debounce
      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(1);
      });

      vi.useRealTimers();
    });
  });
});
