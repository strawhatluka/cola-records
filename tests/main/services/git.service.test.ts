import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock simple-git
const mockStatus = vi.fn();
const mockLog = vi.fn();
const mockAdd = vi.fn();
const mockCommit = vi.fn();
const mockPush = vi.fn();
const mockPull = vi.fn();
const mockClone = vi.fn();
const mockCheckout = vi.fn();
const mockCheckoutLocalBranch = vi.fn();
const mockBranchLocal = vi.fn();
const mockGetRemotes = vi.fn();
const mockFetch = vi.fn();
const mockInit = vi.fn();
const mockAddRemote = vi.fn();

const mockGitInstance = {
  status: mockStatus,
  log: mockLog,
  add: mockAdd,
  commit: mockCommit,
  push: mockPush,
  pull: mockPull,
  clone: mockClone,
  checkout: mockCheckout,
  checkoutLocalBranch: mockCheckoutLocalBranch,
  branchLocal: mockBranchLocal,
  getRemotes: mockGetRemotes,
  fetch: mockFetch,
  init: mockInit,
  addRemote: mockAddRemote,
};

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGitInstance),
}));

import { GitService } from '../../../src/main/services/git.service';

describe('GitService', () => {
  let service: GitService;

  beforeEach(() => {
    service = new GitService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('returns mapped git status', async () => {
      mockStatus.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        ahead: 2,
        behind: 1,
        files: [
          { path: 'src/index.ts', index: 'M', working_dir: ' ' },
        ],
      });

      const status = await service.getStatus('/repo');
      expect(status.current).toBe('main');
      expect(status.tracking).toBe('origin/main');
      expect(status.ahead).toBe(2);
      expect(status.behind).toBe(1);
      expect(status.files).toHaveLength(1);
      expect(status.files[0].path).toBe('src/index.ts');
    });

    it('handles null current branch', async () => {
      mockStatus.mockResolvedValue({
        current: null,
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      });

      const status = await service.getStatus('/repo');
      expect(status.current).toBeNull();
    });

    it('throws on error', async () => {
      mockStatus.mockRejectedValue(new Error('not a git repo'));
      await expect(service.getStatus('/not-a-repo')).rejects.toThrow('Failed to get git status');
    });
  });

  describe('getLog', () => {
    it('returns mapped commits', async () => {
      mockLog.mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            message: 'Initial commit',
            author_name: 'Test',
            author_email: 'test@test.com',
            date: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const log = await service.getLog('/repo');
      expect(log).toHaveLength(1);
      expect(log[0].hash).toBe('abc123');
      expect(log[0].message).toBe('Initial commit');
      expect(log[0].author).toBe('Test <test@test.com>');
    });

    it('respects limit parameter', async () => {
      mockLog.mockResolvedValue({ all: [] });
      await service.getLog('/repo', 10);
      expect(mockLog).toHaveBeenCalledWith({ maxCount: 10 });
    });
  });

  describe('add', () => {
    it('stages files', async () => {
      mockAdd.mockResolvedValue(undefined);
      await service.add('/repo', ['file1.ts', 'file2.ts']);
      expect(mockAdd).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
    });
  });

  describe('commit', () => {
    it('creates commit with message', async () => {
      mockCommit.mockResolvedValue(undefined);
      await service.commit('/repo', 'fix: bug fix');
      expect(mockCommit).toHaveBeenCalledWith('fix: bug fix');
    });
  });

  describe('push', () => {
    it('pushes to default remote', async () => {
      mockPush.mockResolvedValue(undefined);
      await service.push('/repo');
      expect(mockPush).toHaveBeenCalledWith();
    });

    it('pushes to specific remote and branch', async () => {
      mockPush.mockResolvedValue(undefined);
      await service.push('/repo', 'upstream', 'feature');
      expect(mockPush).toHaveBeenCalledWith('upstream', 'feature');
    });
  });

  describe('pull', () => {
    it('pulls from default remote', async () => {
      mockPull.mockResolvedValue(undefined);
      await service.pull('/repo');
      expect(mockPull).toHaveBeenCalledWith();
    });

    it('pulls from specific remote and branch', async () => {
      mockPull.mockResolvedValue(undefined);
      await service.pull('/repo', 'upstream', 'main');
      expect(mockPull).toHaveBeenCalledWith('upstream', 'main');
    });
  });

  describe('checkout', () => {
    it('checks out branch', async () => {
      mockCheckout.mockResolvedValue(undefined);
      await service.checkout('/repo', 'develop');
      expect(mockCheckout).toHaveBeenCalledWith('develop');
    });
  });

  describe('createBranch', () => {
    it('creates and checks out local branch', async () => {
      mockCheckoutLocalBranch.mockResolvedValue(undefined);
      await service.createBranch('/repo', 'feature-x');
      expect(mockCheckoutLocalBranch).toHaveBeenCalledWith('feature-x');
    });
  });

  describe('getCurrentBranch', () => {
    it('returns current branch name', async () => {
      mockStatus.mockResolvedValue({ current: 'main' });
      const branch = await service.getCurrentBranch('/repo');
      expect(branch).toBe('main');
    });

    it('returns null for detached HEAD', async () => {
      mockStatus.mockResolvedValue({ current: null });
      const branch = await service.getCurrentBranch('/repo');
      expect(branch).toBeNull();
    });
  });

  describe('getBranches', () => {
    it('returns sorted branches with main first, dev second', async () => {
      mockBranchLocal.mockResolvedValue({
        all: ['feature', 'dev', 'main', 'bugfix'],
      });

      const branches = await service.getBranches('/repo');
      expect(branches[0]).toBe('main');
      expect(branches[1]).toBe('dev');
      // Rest alphabetical
      expect(branches[2]).toBe('bugfix');
      expect(branches[3]).toBe('feature');
    });
  });

  describe('isRepository', () => {
    it('returns true for valid repos', async () => {
      mockStatus.mockResolvedValue({});
      expect(await service.isRepository('/repo')).toBe(true);
    });

    it('returns false for non-repos', async () => {
      mockStatus.mockRejectedValue(new Error('not a repo'));
      expect(await service.isRepository('/not-repo')).toBe(false);
    });
  });

  describe('getRemoteUrl', () => {
    it('returns origin fetch URL', async () => {
      mockGetRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/test/repo.git' } },
      ]);

      const url = await service.getRemoteUrl('/repo');
      expect(url).toBe('https://github.com/test/repo.git');
    });

    it('returns null when remote not found', async () => {
      mockGetRemotes.mockResolvedValue([]);
      const url = await service.getRemoteUrl('/repo');
      expect(url).toBeNull();
    });
  });

  describe('fetch', () => {
    it('fetches from remote', async () => {
      mockFetch.mockResolvedValue(undefined);
      await service.fetch('/repo', 'origin');
      expect(mockFetch).toHaveBeenCalledWith('origin');
    });
  });

  describe('addRemote', () => {
    it('adds a remote', async () => {
      mockAddRemote.mockResolvedValue(undefined);
      await service.addRemote('/repo', 'upstream', 'https://github.com/upstream/repo.git');
      expect(mockAddRemote).toHaveBeenCalledWith('upstream', 'https://github.com/upstream/repo.git');
    });
  });
});
