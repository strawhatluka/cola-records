// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs
const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readdirSync: (...args: any[]) => mockReaddirSync(...args),
    statSync: (...args: any[]) => mockStatSync(...args),
  };
});

// Mock simple-git
const mockCheckIsRepo = vi.fn();
const mockRevparse = vi.fn();
const mockGetRemotes = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: () => ({
    checkIsRepo: mockCheckIsRepo,
    revparse: mockRevparse,
    getRemotes: mockGetRemotes,
  }),
}));

// Mock github-rest.service
const mockGetRepository = vi.fn();
const mockCheckPRStatus = vi.fn();
const mockGetIssue = vi.fn();

vi.mock('../../../src/main/services/github-rest.service', () => ({
  gitHubRestService: {
    getRepository: (...args: unknown[]) => mockGetRepository(...args),
    checkPRStatus: (...args: unknown[]) => mockCheckPRStatus(...args),
    getIssue: (...args: unknown[]) => mockGetIssue(...args),
  },
}));

import { contributionScannerService } from '../../../src/main/services/contribution-scanner.service';

describe('ContributionScannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatSync.mockReturnValue({ birthtime: new Date('2026-01-01') });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scanDirectory', () => {
    it('returns empty array if directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await contributionScannerService.scanDirectory('/nonexistent');
      expect(result).toEqual([]);
    });

    it('scans subdirectories for git repos', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        { name: 'repo1', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ]);
      mockCheckIsRepo.mockResolvedValue(true);
      mockRevparse.mockResolvedValue('main');
      mockGetRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo1.git' } },
      ]);
      mockGetRepository.mockRejectedValue(new Error('Not found'));

      const result = await contributionScannerService.scanDirectory('/contributions');
      expect(result).toHaveLength(1);
      expect(result[0].localPath).toContain('repo1');
      expect(result[0].branchName).toBe('main');
    });

    it('returns empty array when no subdirectories', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([]);
      const result = await contributionScannerService.scanDirectory('/empty');
      expect(result).toEqual([]);
    });
  });

  describe('scanRepository', () => {
    it('returns contribution data for a valid git repo', async () => {
      mockCheckIsRepo.mockResolvedValue(true);
      mockRevparse.mockResolvedValue('feature-branch');
      mockGetRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } },
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git' } },
      ]);
      mockGetRepository.mockResolvedValue({
        fork: true,
        parent: { full_name: 'org/repo' },
      });
      mockCheckPRStatus.mockResolvedValue(null);

      const result = await contributionScannerService.scanRepository('/contributions/repo');
      expect(result).not.toBeNull();
      expect(result!.branchName).toBe('feature-branch');
      expect(result!.remotes.origin).toBe('https://github.com/user/repo.git');
      expect(result!.remotes.upstream).toBe('https://github.com/org/repo.git');
      expect(result!.isFork).toBe(true);
      expect(result!.remotesValid).toBe(true);
    });

    it('extracts issue number from branch name', async () => {
      mockCheckIsRepo.mockResolvedValue(true);
      mockRevparse.mockResolvedValue('issue-42');
      mockGetRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } },
      ]);
      mockGetRepository.mockRejectedValue(new Error('Not found'));

      const result = await contributionScannerService.scanRepository('/contributions/repo');
      expect(result).not.toBeNull();
      expect(result!.issueNumber).toBe(42);
    });

    it('handles non-git directory gracefully', async () => {
      mockCheckIsRepo.mockResolvedValue(false);
      mockGetRemotes.mockResolvedValue([]);

      const result = await contributionScannerService.scanRepository('/contributions/not-git');
      expect(result).not.toBeNull();
      expect(result!.branchName).toBe('main'); // default
    });

    it('checks PR status when both remotes exist', async () => {
      mockCheckIsRepo.mockResolvedValue(true);
      mockRevparse.mockResolvedValue('fix-bug');
      mockGetRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } },
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git' } },
      ]);
      mockGetRepository.mockResolvedValue({ fork: true, parent: { full_name: 'org/repo' } });
      mockCheckPRStatus.mockResolvedValue({
        number: 5,
        url: 'https://github.com/org/repo/pull/5',
        status: 'open',
      });

      const result = await contributionScannerService.scanRepository('/contributions/repo');
      expect(result!.prNumber).toBe(5);
      expect(result!.prUrl).toBe('https://github.com/org/repo/pull/5');
      expect(result!.prStatus).toBe('open');
    });

    it('returns null on unexpected error', async () => {
      mockCheckIsRepo.mockRejectedValue(new Error('Unexpected'));
      const result = await contributionScannerService.scanRepository('/bad/path');
      expect(result).toBeNull();
    });
  });

  describe('getIssueTitle', () => {
    it('returns issue title from API', async () => {
      mockGetIssue.mockResolvedValue({ title: 'Fix the bug' });
      const title = await contributionScannerService.getIssueTitle('org', 'repo', 42);
      expect(title).toBe('Fix the bug');
    });

    it('returns undefined on API error', async () => {
      mockGetIssue.mockRejectedValue(new Error('Not found'));
      const title = await contributionScannerService.getIssueTitle('org', 'repo', 999);
      expect(title).toBeUndefined();
    });
  });
});
