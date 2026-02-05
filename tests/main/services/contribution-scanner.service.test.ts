// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock scanner-pool
const mockScan = vi.fn();
const mockTerminate = vi.fn();

vi.mock('../../../src/main/workers/scanner-pool', () => ({
  scannerPool: {
    scan: (...args: unknown[]) => mockScan(...args),
    terminate: () => mockTerminate(),
  },
}));

// Mock github-rest.service
const mockGetIssue = vi.fn();

vi.mock('../../../src/main/services/github-rest.service', () => ({
  gitHubRestService: {
    getIssue: (...args: unknown[]) => mockGetIssue(...args),
  },
}));

// Mock database
const mockGetAllSettings = vi.fn();

vi.mock('../../../src/main/database', () => ({
  database: {
    getAllSettings: () => mockGetAllSettings(),
  },
}));

import { contributionScannerService } from '../../../src/main/services/contribution-scanner.service';

describe('ContributionScannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllSettings.mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scanDirectory', () => {
    it('delegates to scannerPool.scan with directory and token', async () => {
      mockGetAllSettings.mockReturnValue({ githubToken: 'gh_test_token' });
      mockScan.mockResolvedValue([
        {
          localPath: '/contributions/repo1',
          repositoryUrl: 'https://github.com/user/repo1',
          branchName: 'main',
          remotes: { origin: 'https://github.com/user/repo1.git' },
          isFork: false,
          remotesValid: true,
        },
      ]);

      const result = await contributionScannerService.scanDirectory('/contributions');
      expect(mockScan).toHaveBeenCalledWith('/contributions', 'gh_test_token');
      expect(result).toHaveLength(1);
      expect(result[0].localPath).toBe('/contributions/repo1');
    });

    it('passes null token when no token configured', async () => {
      mockGetAllSettings.mockReturnValue({});
      mockScan.mockResolvedValue([]);

      await contributionScannerService.scanDirectory('/contributions');
      expect(mockScan).toHaveBeenCalledWith('/contributions', null);
    });

    it('falls back to env token when database has no token', async () => {
      mockGetAllSettings.mockReturnValue({});
      const originalEnv = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'env_token';

      mockScan.mockResolvedValue([]);
      await contributionScannerService.scanDirectory('/contributions');
      expect(mockScan).toHaveBeenCalledWith('/contributions', 'env_token');

      process.env.GITHUB_TOKEN = originalEnv;
    });

    it('returns empty array from worker', async () => {
      mockScan.mockResolvedValue([]);
      const result = await contributionScannerService.scanDirectory('/empty');
      expect(result).toEqual([]);
    });

    it('propagates worker errors', async () => {
      mockScan.mockRejectedValue(new Error('Scanner worker timed out after 30s'));
      await expect(contributionScannerService.scanDirectory('/bad')).rejects.toThrow(
        'Scanner worker timed out after 30s'
      );
    });

    it('handles database read failure gracefully', async () => {
      mockGetAllSettings.mockImplementation(() => {
        throw new Error('DB not initialized');
      });
      const originalEnv = process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_TOKEN;
      mockScan.mockResolvedValue([]);

      await contributionScannerService.scanDirectory('/contributions');
      // Should fall back to null token when DB fails and no env var
      expect(mockScan).toHaveBeenCalledWith('/contributions', null);

      process.env.GITHUB_TOKEN = originalEnv;
    });
  });

  describe('extractRepoInfo', () => {
    it('extracts owner/repo from HTTPS URL', () => {
      const result = contributionScannerService.extractRepoInfo(
        'https://github.com/owner/repo.git'
      );
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('extracts owner/repo from SSH URL', () => {
      const result = contributionScannerService.extractRepoInfo(
        'git@github.com:owner/repo.git'
      );
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('handles URL without .git suffix', () => {
      const result = contributionScannerService.extractRepoInfo(
        'https://github.com/owner/repo'
      );
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('returns null for non-GitHub URL', () => {
      const result = contributionScannerService.extractRepoInfo(
        'https://gitlab.com/owner/repo.git'
      );
      expect(result).toBeNull();
    });

    it('returns null for invalid URL', () => {
      const result = contributionScannerService.extractRepoInfo('not-a-url');
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
