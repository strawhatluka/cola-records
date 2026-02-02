import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Octokit method fns
const mockIssuesGet = vi.fn();
const mockIssuesCreateComment = vi.fn();
const mockReposCreateFork = vi.fn();
const mockPullsCreate = vi.fn();
const mockPullsGet = vi.fn();
const mockPullsList = vi.fn();
const mockReposGetContent = vi.fn();
const mockReposListForUser = vi.fn();
const mockReposListForAuthenticatedUser = vi.fn();
const mockReposGet = vi.fn();
const mockActivityCheckStar = vi.fn();
const mockActivityStar = vi.fn();
const mockActivityUnstar = vi.fn();
const mockRateLimitGet = vi.fn();

// Use a class so `new Octokit(...)` works
vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    issues = {
      get: mockIssuesGet,
      createComment: mockIssuesCreateComment,
    };
    repos = {
      createFork: mockReposCreateFork,
      getContent: mockReposGetContent,
      listForUser: mockReposListForUser,
      listForAuthenticatedUser: mockReposListForAuthenticatedUser,
      get: mockReposGet,
    };
    pulls = {
      create: mockPullsCreate,
      get: mockPullsGet,
      list: mockPullsList,
    };
    activity = {
      checkRepoIsStarredByAuthenticatedUser: mockActivityCheckStar,
      starRepoForAuthenticatedUser: mockActivityStar,
      unstarRepoForAuthenticatedUser: mockActivityUnstar,
    };
    rateLimit = {
      get: mockRateLimitGet,
    };
  },
}));

vi.mock('../../../src/main/services/environment.service', () => ({
  env: { get: vi.fn(() => 'test-token') },
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    getAllSettings: vi.fn(() => ({ githubToken: 'db-token' })),
  },
}));

import { GitHubRestService } from '../../../src/main/services/github-rest.service';

describe('GitHubRestService', () => {
  let service: GitHubRestService;

  beforeEach(() => {
    service = new GitHubRestService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIssue', () => {
    it('returns mapped issue', async () => {
      mockIssuesGet.mockResolvedValue({
        data: {
          id: 1,
          number: 42,
          title: 'Bug report',
          body: 'Description',
          html_url: 'https://github.com/org/repo/issues/42',
          state: 'open',
          labels: [{ name: 'bug' }],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          user: { login: 'reporter' },
        },
      });

      const issue = await service.getIssue('org', 'repo', 42);
      expect(issue.number).toBe(42);
      expect(issue.title).toBe('Bug report');
      expect(issue.author).toBe('reporter');
      expect(issue.labels).toContain('bug');
    });
  });

  describe('createIssueComment', () => {
    it('creates comment via API', async () => {
      mockIssuesCreateComment.mockResolvedValue({});
      await service.createIssueComment('org', 'repo', 42, 'test comment');
      expect(mockIssuesCreateComment).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        issue_number: 42,
        body: 'test comment',
      });
    });
  });

  describe('forkRepository', () => {
    it('returns mapped fork data', async () => {
      mockReposCreateFork.mockResolvedValue({
        data: {
          id: 123,
          name: 'repo',
          full_name: 'user/repo',
          description: 'A repo',
          clone_url: 'https://github.com/user/repo.git',
          language: 'TypeScript',
          stargazers_count: 0,
          forks_count: 0,
        },
      });

      const fork = await service.forkRepository('org', 'repo');
      expect(fork.name).toBe('repo');
      expect(fork.fullName).toBe('user/repo');
      expect(fork.url).toBe('https://github.com/user/repo.git');
    });
  });

  describe('createPullRequest', () => {
    it('returns PR data', async () => {
      mockPullsCreate.mockResolvedValue({
        data: {
          number: 1,
          html_url: 'https://github.com/org/repo/pull/1',
          state: 'open',
        },
      });

      const pr = await service.createPullRequest('org', 'repo', 'Fix bug', 'feature', 'main', 'PR body');
      expect(pr.number).toBe(1);
      expect(pr.state).toBe('open');
    });
  });

  describe('getUserRepositories', () => {
    it('lists repos for authenticated user when no username', async () => {
      mockReposListForAuthenticatedUser.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'my-repo',
            full_name: 'user/my-repo',
            description: 'My repo',
            html_url: 'https://github.com/user/my-repo',
            clone_url: 'https://github.com/user/my-repo.git',
            language: 'TypeScript',
            stargazers_count: 5,
            forks_count: 1,
            private: false,
          },
        ],
      });

      const repos = await service.getUserRepositories();
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('my-repo');
    });

    it('lists repos for specific user', async () => {
      mockReposListForUser.mockResolvedValue({
        data: [
          {
            id: 2,
            name: 'other-repo',
            full_name: 'other/other-repo',
            description: '',
            html_url: 'https://github.com/other/other-repo',
            clone_url: 'https://github.com/other/other-repo.git',
            language: null,
            stargazers_count: 0,
            forks_count: 0,
            private: true,
          },
        ],
      });

      const repos = await service.getUserRepositories('other');
      expect(repos).toHaveLength(1);
      expect(repos[0].language).toBe('Unknown');
    });
  });

  describe('hasStarred', () => {
    it('returns true when repo is starred', async () => {
      mockActivityCheckStar.mockResolvedValue({});
      expect(await service.hasStarred('org', 'repo')).toBe(true);
    });

    it('returns false when repo is not starred (404)', async () => {
      mockActivityCheckStar.mockRejectedValue({ status: 404 });
      expect(await service.hasStarred('org', 'repo')).toBe(false);
    });

    it('throws on non-404 errors', async () => {
      mockActivityCheckStar.mockRejectedValue({ status: 500 });
      await expect(service.hasStarred('org', 'repo')).rejects.toBeDefined();
    });
  });

  describe('getRateLimit', () => {
    it('returns rate limit info', async () => {
      mockRateLimitGet.mockResolvedValue({
        data: {
          rate: {
            limit: 5000,
            remaining: 4999,
            reset: 1700000000,
          },
        },
      });

      const rateLimit = await service.getRateLimit();
      expect(rateLimit.limit).toBe(5000);
      expect(rateLimit.remaining).toBe(4999);
    });
  });

  describe('resetClient', () => {
    it('clears cached client', () => {
      service.resetClient();
    });
  });

  describe('checkPRStatus', () => {
    it('returns PR status for matching branch', async () => {
      mockPullsList.mockResolvedValue({
        data: [
          {
            number: 5,
            title: 'Feature PR',
            html_url: 'https://github.com/org/repo/pull/5',
            state: 'open',
            merged_at: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            user: { login: 'dev' },
            head: { ref: 'feature-branch' },
          },
        ],
      });

      const status = await service.checkPRStatus('org', 'repo', 'feature-branch');
      expect(status).not.toBeNull();
      expect(status!.number).toBe(5);
      expect(status!.status).toBe('open');
    });

    it('returns null when no PR for branch', async () => {
      mockPullsList.mockResolvedValue({
        data: [],
      });

      const status = await service.checkPRStatus('org', 'repo', 'no-pr-branch');
      expect(status).toBeNull();
    });
  });
});
