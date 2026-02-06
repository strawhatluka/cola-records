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

const mockDiffSummary = vi.fn();
const mockDiff = vi.fn();

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
  diffSummary: mockDiffSummary,
  diff: mockDiff,
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
      expect(mockPush).toHaveBeenCalledWith('upstream', 'feature', []);
    });

    it('pushes with -u flag when setUpstream is true', async () => {
      mockPush.mockResolvedValue(undefined);
      await service.push('/repo', 'origin', 'feature', true);
      expect(mockPush).toHaveBeenCalledWith('origin', 'feature', ['-u']);
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

    it('throws on error', async () => {
      mockAddRemote.mockRejectedValue(new Error('remote exists'));
      await expect(service.addRemote('/repo', 'upstream', 'url')).rejects.toThrow('Failed to add remote');
    });
  });

  describe('clone', () => {
    it('clones repository to target path', async () => {
      mockClone.mockResolvedValue(undefined);
      await service.clone('https://github.com/org/repo.git', '/target/repo');
      expect(mockClone).toHaveBeenCalledWith('https://github.com/org/repo.git', '/target/repo');
    });

    it('throws on error', async () => {
      mockClone.mockRejectedValue(new Error('clone failed'));
      await expect(service.clone('url', '/path')).rejects.toThrow('Failed to clone');
    });
  });

  describe('init', () => {
    it('initializes git repo', async () => {
      mockInit.mockResolvedValue(undefined);
      await service.init('/new-repo');
      expect(mockInit).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      mockInit.mockRejectedValue(new Error('init failed'));
      await expect(service.init('/bad-path')).rejects.toThrow('Failed to initialize');
    });
  });

  describe('getRemotes', () => {
    it('returns mapped remotes', async () => {
      mockGetRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git', push: 'https://github.com/user/repo.git' } },
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git', push: '' } },
      ]);

      const remotes = await service.getRemotes('/repo');
      expect(remotes).toHaveLength(2);
      expect(remotes[0].name).toBe('origin');
      expect(remotes[0].fetchUrl).toBe('https://github.com/user/repo.git');
      expect(remotes[1].pushUrl).toBe('');
    });

    it('returns empty array on error', async () => {
      mockGetRemotes.mockRejectedValue(new Error('not a repo'));
      const remotes = await service.getRemotes('/not-repo');
      expect(remotes).toEqual([]);
    });
  });

  describe('compareBranches', () => {
    it('returns commits, files, and raw diff', async () => {
      mockLog.mockResolvedValue({
        all: [
          {
            hash: 'def456',
            message: 'Add feature',
            author_name: 'Dev',
            author_email: 'dev@test.com',
            date: '2026-01-02T00:00:00Z',
          },
        ],
      });
      mockDiffSummary.mockResolvedValue({
        files: [
          { file: 'src/new.ts', insertions: 10, deletions: 2, binary: false },
        ],
        insertions: 10,
        deletions: 2,
        changed: 1,
      });
      mockDiff.mockResolvedValue('diff --git a/src/new.ts b/src/new.ts\n+new line');

      const result = await service.compareBranches('/repo', 'main', 'feature');
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].hash).toBe('def456');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].file).toBe('src/new.ts');
      expect(result.totalInsertions).toBe(10);
      expect(result.totalDeletions).toBe(2);
      expect(result.totalFilesChanged).toBe(1);
      expect(result.rawDiff).toContain('+new line');
    });

    it('throws on error', async () => {
      mockLog.mockRejectedValue(new Error('bad ref'));
      await expect(service.compareBranches('/repo', 'main', 'bad')).rejects.toThrow('Failed to compare branches');
    });
  });
});
