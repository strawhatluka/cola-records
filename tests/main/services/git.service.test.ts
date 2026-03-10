import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

// Mock the database module
vi.mock('../../../src/main/database', () => ({
  database: {
    getAllSettings: vi.fn(() => ({})),
    getSetting: vi.fn(() => null),
    setSetting: vi.fn(),
  },
}));

// Mock environment service
vi.mock('../../../src/main/services/environment.service', () => ({
  env: {
    get: vi.fn(() => null),
  },
}));

// Mock os module for migrateFromHostCredentials
vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

// Mock fs module for syncTokenToGitCredentials
const mockExistsSync = vi.fn((_p: string) => false);
const mockReadFileSync = vi.fn((_p: string, _enc?: string) => '');
const mockWriteFileSync = vi.fn((_p: string, _data: string, _opts?: object) => {});
const mockUnlinkSync = vi.fn((_p: string) => {});
vi.mock('fs', () => ({
  existsSync: (p: string) => mockExistsSync(p),
  readFileSync: (p: string, enc?: string) => mockReadFileSync(p, enc),
  writeFileSync: (p: string, data: string, opts?: object) => mockWriteFileSync(p, data, opts),
  unlinkSync: (p: string) => mockUnlinkSync(p),
}));

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
const mockRemote = vi.fn();
const mockBranch = vi.fn();
const mockRaw = vi.fn();

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
  remote: mockRemote,
  branch: mockBranch,
  raw: mockRaw,
  tag: vi.fn(),
  pushTags: vi.fn(),
};

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGitInstance),
}));

import path from 'path';
import { GitService } from '../../../src/main/services/git.service';

// Expected paths (cross-platform via path.join)
const APP_CRED_PATH = path.join('/mock/user/data', 'git-credentials');
const HOST_CRED_PATH = path.join('/mock/home', '.git-credentials');

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
        files: [{ path: 'src/index.ts', index: 'M', working_dir: ' ' }],
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
    beforeEach(() => {
      // Mock getRemotes for withAuthenticatedRemote (no remotes = no auth rewriting)
      mockGetRemotes.mockResolvedValue([]);
    });

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
    beforeEach(() => {
      // Mock getRemotes for withAuthenticatedRemote (no remotes = no auth rewriting)
      mockGetRemotes.mockResolvedValue([]);
    });

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

    it('returns null on error', async () => {
      mockGetRemotes.mockRejectedValue(new Error('git error'));
      const url = await service.getRemoteUrl('/repo');
      expect(url).toBeNull();
    });
  });

  describe('fetch', () => {
    beforeEach(() => {
      // Mock getRemotes for withAuthenticatedRemote (no remotes = no auth rewriting)
      mockGetRemotes.mockResolvedValue([]);
    });

    it('fetches from remote', async () => {
      mockFetch.mockResolvedValue(undefined);
      await service.fetch('/repo', 'origin');
      expect(mockFetch).toHaveBeenCalledWith('origin');
    });

    it('throws on error', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'));
      await expect(service.fetch('/repo', 'origin')).rejects.toThrow('Failed to fetch from');
    });
  });

  describe('addRemote', () => {
    it('adds a remote', async () => {
      mockAddRemote.mockResolvedValue(undefined);
      await service.addRemote('/repo', 'upstream', 'https://github.com/upstream/repo.git');
      expect(mockAddRemote).toHaveBeenCalledWith(
        'upstream',
        'https://github.com/upstream/repo.git'
      );
    });

    it('throws on error', async () => {
      mockAddRemote.mockRejectedValue(new Error('remote exists'));
      await expect(service.addRemote('/repo', 'upstream', 'url')).rejects.toThrow(
        'Failed to add remote'
      );
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
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/user/repo.git',
            push: 'https://github.com/user/repo.git',
          },
        },
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
        files: [{ file: 'src/new.ts', insertions: 10, deletions: 2, binary: false }],
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
      await expect(service.compareBranches('/repo', 'main', 'bad')).rejects.toThrow(
        'Failed to compare branches'
      );
    });
  });

  describe('deleteBranch', () => {
    it('deletes branch with safe delete by default', async () => {
      // Mock current branch check
      mockStatus.mockResolvedValue({ current: 'main' });
      mockBranch.mockResolvedValue(undefined);

      await service.deleteBranch('/repo', 'feature');
      expect(mockBranch).toHaveBeenCalledWith(['-d', 'feature']);
    });

    it('force deletes branch when force is true', async () => {
      mockStatus.mockResolvedValue({ current: 'main' });
      mockBranch.mockResolvedValue(undefined);

      await service.deleteBranch('/repo', 'feature', true);
      expect(mockBranch).toHaveBeenCalledWith(['-D', 'feature']);
    });

    it('throws error when trying to delete current branch', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });

      await expect(service.deleteBranch('/repo', 'feature')).rejects.toThrow(
        'Cannot delete the currently checked out branch'
      );
    });

    it('throws error when trying to delete protected branch main', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });

      await expect(service.deleteBranch('/repo', 'main')).rejects.toThrow(
        'Cannot delete protected branch: main'
      );
    });

    it('throws error when trying to delete protected branch dev', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });

      await expect(service.deleteBranch('/repo', 'dev')).rejects.toThrow(
        'Cannot delete protected branch: dev'
      );
    });

    it('throws error when trying to delete protected branch master', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });

      await expect(service.deleteBranch('/repo', 'master')).rejects.toThrow(
        'Cannot delete protected branch: master'
      );
    });

    it('throws error when trying to delete protected branch develop', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });

      await expect(service.deleteBranch('/repo', 'develop')).rejects.toThrow(
        'Cannot delete protected branch: develop'
      );
    });
  });

  describe('getBranchInfo', () => {
    it('returns branch info with ahead/behind stats', async () => {
      // Mock current branch
      mockStatus.mockResolvedValue({ current: 'main' });

      // Mock last commit
      mockLog.mockImplementation((args) => {
        if (Array.isArray(args) && args.includes('-1')) {
          return Promise.resolve({
            all: [
              {
                hash: 'abc123def456',
                message: 'Latest commit',
                author_name: 'Test User',
                date: '2026-01-15T10:00:00Z',
              },
            ],
            total: 1,
          });
        }
        // Branch log for commit count
        return Promise.resolve({ all: [], total: 25 });
      });

      // Mock branches for findBaseBranch
      mockBranchLocal.mockResolvedValue({ all: ['main', 'feature', 'dev'] });

      // Mock ahead/behind
      mockRaw.mockResolvedValue('3\t5');

      const info = await service.getBranchInfo('/repo', 'feature');

      expect(info.name).toBe('feature');
      expect(info.isCurrent).toBe(false);
      expect(info.isProtected).toBe(false);
      expect(info.lastCommit.hash).toBe('abc123def456');
      expect(info.lastCommit.message).toBe('Latest commit');
      expect(info.lastCommit.author).toBe('Test User');
      expect(info.commitCount).toBe(25);
      expect(info.ahead).toBe(5);
      expect(info.behind).toBe(3);
    });

    it('returns isCurrent true when branch is checked out', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });
      mockLog.mockResolvedValue({
        all: [{ hash: 'abc', message: 'test', author_name: 'User', date: '2026-01-01' }],
        total: 10,
      });
      mockBranchLocal.mockResolvedValue({ all: ['main', 'feature'] });
      mockRaw.mockResolvedValue('0\t0');

      const info = await service.getBranchInfo('/repo', 'feature');
      expect(info.isCurrent).toBe(true);
    });

    it('returns isProtected true for protected branches', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });
      mockLog.mockResolvedValue({
        all: [{ hash: 'abc', message: 'test', author_name: 'User', date: '2026-01-01' }],
        total: 10,
      });
      mockBranchLocal.mockResolvedValue({ all: ['main', 'feature'] });
      mockRaw.mockResolvedValue('0\t0');

      const mainInfo = await service.getBranchInfo('/repo', 'main');
      expect(mainInfo.isProtected).toBe(true);
    });

    it('handles missing ahead/behind gracefully', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });
      mockLog.mockResolvedValue({
        all: [{ hash: 'abc', message: 'test', author_name: 'User', date: '2026-01-01' }],
        total: 10,
      });
      mockBranchLocal.mockResolvedValue({ all: ['main', 'feature'] });
      mockRaw.mockRejectedValue(new Error('no common ancestor'));

      const info = await service.getBranchInfo('/repo', 'feature');
      expect(info.ahead).toBe(0);
      expect(info.behind).toBe(0);
    });

    it('throws on error', async () => {
      mockStatus.mockRejectedValue(new Error('not a repo'));

      await expect(service.getBranchInfo('/repo', 'feature')).rejects.toThrow(
        'Failed to get branch info'
      );
    });

    it('uses master as base branch when main does not exist', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });
      mockLog.mockResolvedValue({
        all: [{ hash: 'abc', message: 'test', author_name: 'User', date: '2026-01-01' }],
        total: 10,
      });
      // Return branches without 'main' but with 'master'
      mockBranchLocal.mockResolvedValue({ all: ['master', 'feature', 'develop'] });
      mockRaw.mockResolvedValue('2\t3');

      const info = await service.getBranchInfo('/repo', 'feature');
      expect(info.ahead).toBe(3);
      expect(info.behind).toBe(2);
    });

    it('uses dev as base branch when main and master do not exist', async () => {
      mockStatus.mockResolvedValue({ current: 'feature' });
      mockLog.mockResolvedValue({
        all: [{ hash: 'abc', message: 'test', author_name: 'User', date: '2026-01-01' }],
        total: 10,
      });
      // Return branches without 'main' or 'master', but with 'dev'
      mockBranchLocal.mockResolvedValue({ all: ['dev', 'feature'] });
      mockRaw.mockResolvedValue('1\t4');

      const info = await service.getBranchInfo('/repo', 'feature');
      expect(info.ahead).toBe(4);
      expect(info.behind).toBe(1);
    });

    it('uses first branch as base when no standard branches exist', async () => {
      mockStatus.mockResolvedValue({ current: 'feature-2' });
      mockLog.mockResolvedValue({
        all: [{ hash: 'abc', message: 'test', author_name: 'User', date: '2026-01-01' }],
        total: 10,
      });
      // Return branches without any standard base branches
      mockBranchLocal.mockResolvedValue({ all: ['feature-1', 'feature-2'] });
      mockRaw.mockResolvedValue('0\t5');

      const info = await service.getBranchInfo('/repo', 'feature-2');
      expect(info.ahead).toBe(5);
      expect(info.behind).toBe(0);
    });

    it('handles when branch is same as base branch', async () => {
      mockStatus.mockResolvedValue({ current: 'main' });
      mockLog.mockResolvedValue({
        all: [{ hash: 'abc', message: 'test', author_name: 'User', date: '2026-01-01' }],
        total: 10,
      });
      mockBranchLocal.mockResolvedValue({ all: ['main'] });

      const info = await service.getBranchInfo('/repo', 'main');
      // When branch is same as base, no git rev-list should be called
      expect(info.ahead).toBe(0);
      expect(info.behind).toBe(0);
      expect(mockRaw).not.toHaveBeenCalled();
    });
  });

  describe('getCredentialsPath', () => {
    it('returns path inside app userData directory', () => {
      const credPath = service.getCredentialsPath();
      expect(credPath).toBe(APP_CRED_PATH);
    });
  });

  describe('syncTokenToGitCredentials', () => {
    it('writes token to app userData git-credentials file', () => {
      mockExistsSync.mockReturnValue(false);

      service.syncTokenToGitCredentials('ghp_test123');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        APP_CRED_PATH,
        'https://x-access-token:ghp_test123@github.com\n',
        { mode: 0o600 }
      );
    });

    it('does not write to host ~/.git-credentials', () => {
      mockExistsSync.mockReturnValue(false);

      service.syncTokenToGitCredentials('ghp_test123');

      const writePath = mockWriteFileSync.mock.calls[0][0] as string;
      expect(writePath).not.toContain('home');
      expect(writePath).toContain('user');
    });

    it('removes github entry when null token passed', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'https://x-access-token:old@github.com\nhttps://gitlab.com/token\n'
      );

      service.syncTokenToGitCredentials(null);

      expect(mockWriteFileSync).toHaveBeenCalledWith(APP_CRED_PATH, 'https://gitlab.com/token\n', {
        mode: 0o600,
      });
    });

    it('preserves non-github entries in existing file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'https://x-access-token:old@github.com\nhttps://bitbucket.org/token\n'
      );

      service.syncTokenToGitCredentials('ghp_new');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        APP_CRED_PATH,
        'https://bitbucket.org/token\nhttps://x-access-token:ghp_new@github.com\n',
        { mode: 0o600 }
      );
    });
  });

  describe('migrateFromHostCredentials', () => {
    it('removes x-access-token github.com line from host ~/.git-credentials', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'https://x-access-token:ghp_abc@github.com\nhttps://bitbucket.org/cred\n'
      );

      service.migrateFromHostCredentials();

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        HOST_CRED_PATH,
        'https://bitbucket.org/cred\n',
        { mode: 0o600 }
      );
    });

    it('deletes host file when only entry was x-access-token', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('https://x-access-token:ghp_abc@github.com\n');

      service.migrateFromHostCredentials();

      expect(mockUnlinkSync).toHaveBeenCalledWith(HOST_CRED_PATH);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('does nothing when host file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      service.migrateFromHostCredentials();

      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('does nothing when no x-access-token line present', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('https://user:pass@github.com\n');

      service.migrateFromHostCredentials();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('preserves non-x-access-token github entries', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'https://user:pat@github.com\nhttps://x-access-token:ghp_abc@github.com\n'
      );

      service.migrateFromHostCredentials();

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        HOST_CRED_PATH,
        'https://user:pat@github.com\n',
        { mode: 0o600 }
      );
    });

    it('does not throw on fs errors', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => service.migrateFromHostCredentials()).not.toThrow();
    });
  });

  describe('getDiff', () => {
    it('returns unstaged diff with ANSI codes stripped', async () => {
      mockDiff.mockResolvedValue(
        '\x1B[31m-removed line\x1B[0m\n\x1B[32m+added line\x1B[0m\ndiff --git a/file.ts'
      );

      const diff = await service.getDiff('/repo');

      expect(diff).toBe('-removed line\n+added line\ndiff --git a/file.ts');
      expect(mockDiff).toHaveBeenCalledWith(['--no-color']);
    });

    it('returns empty string when no changes', async () => {
      mockDiff.mockResolvedValue('');

      const diff = await service.getDiff('/repo');

      expect(diff).toBe('');
    });

    it('throws on error', async () => {
      mockDiff.mockRejectedValue(new Error('diff failed'));

      await expect(service.getDiff('/repo')).rejects.toThrow('Failed to get diff');
    });
  });

  describe('getDiffStaged', () => {
    it('returns staged diff with ANSI codes stripped', async () => {
      mockDiff.mockResolvedValue(
        '\x1B[31m-old content\x1B[0m\n\x1B[32m+new content\x1B[0m\ndiff --git a/staged.ts'
      );

      const diff = await service.getDiffStaged('/repo');

      expect(diff).toBe('-old content\n+new content\ndiff --git a/staged.ts');
      expect(mockDiff).toHaveBeenCalledWith(['--cached', '--no-color']);
    });

    it('returns empty string when no staged changes', async () => {
      mockDiff.mockResolvedValue('');

      const diff = await service.getDiffStaged('/repo');

      expect(diff).toBe('');
    });

    it('throws on error', async () => {
      mockDiff.mockRejectedValue(new Error('diff failed'));

      await expect(service.getDiffStaged('/repo')).rejects.toThrow('Failed to get staged diff');
    });
  });

  describe('tag', () => {
    beforeEach(() => {
      mockGitInstance.tag.mockReset();
    });

    const mockTag = mockGitInstance.tag;

    it('creates annotated tag with message', async () => {
      mockTag.mockResolvedValue(undefined);

      await service.tag('/repo', 'v1.0.0', 'Release version 1.0.0');

      expect(mockTag).toHaveBeenCalledWith(['-a', 'v1.0.0', '-m', 'Release version 1.0.0']);
    });

    it('creates lightweight tag without message', async () => {
      mockTag.mockResolvedValue(undefined);

      await service.tag('/repo', 'v1.0.1');

      expect(mockTag).toHaveBeenCalledWith(['v1.0.1']);
    });

    it('throws on error', async () => {
      mockTag.mockRejectedValue(new Error('tag already exists'));

      await expect(service.tag('/repo', 'v1.0.0')).rejects.toThrow('Failed to create tag');
    });
  });

  describe('pushTags', () => {
    beforeEach(() => {
      mockGitInstance.pushTags.mockReset();
      // Mock getRemotes for withAuthenticatedRemote
      mockGetRemotes.mockResolvedValue([]);
    });

    const mockPushTags = mockGitInstance.pushTags;

    it('pushes tags to default remote', async () => {
      mockPushTags.mockResolvedValue(undefined);

      await service.pushTags('/repo');

      expect(mockPushTags).toHaveBeenCalledWith('origin');
    });

    it('pushes tags to specified remote', async () => {
      mockPushTags.mockResolvedValue(undefined);

      await service.pushTags('/repo', 'upstream');

      expect(mockPushTags).toHaveBeenCalledWith('upstream');
    });

    it('throws on error', async () => {
      mockPushTags.mockRejectedValue(new Error('push failed'));

      await expect(service.pushTags('/repo')).rejects.toThrow('Failed to push tags');
    });
  });
});
