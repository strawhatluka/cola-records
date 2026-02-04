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
const mockIssuesListComments = vi.fn();
const mockIssuesListForRepo = vi.fn();
const mockPullsListReviewComments = vi.fn();
const mockPullsListReviews = vi.fn();
const mockIssuesUpdate = vi.fn();
const mockIssuesCreate = vi.fn();
const mockReactionsListForIssue = vi.fn();
const mockReactionsCreateForIssue = vi.fn();
const mockReactionsDeleteForIssue = vi.fn();
const mockReactionsListForIssueComment = vi.fn();
const mockReactionsCreateForIssueComment = vi.fn();
const mockReactionsDeleteForIssueComment = vi.fn();
const mockRequest = vi.fn();

// Use a class so `new Octokit(...)` works
vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    request = mockRequest;
    issues = {
      get: mockIssuesGet,
      create: mockIssuesCreate,
      update: mockIssuesUpdate,
      createComment: mockIssuesCreateComment,
      listComments: mockIssuesListComments,
      listForRepo: mockIssuesListForRepo,
    };
    reactions = {
      listForIssue: mockReactionsListForIssue,
      createForIssue: mockReactionsCreateForIssue,
      deleteForIssue: mockReactionsDeleteForIssue,
      listForIssueComment: mockReactionsListForIssueComment,
      createForIssueComment: mockReactionsCreateForIssueComment,
      deleteForIssueComment: mockReactionsDeleteForIssueComment,
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
      listReviews: mockPullsListReviews,
      listReviewComments: mockPullsListReviewComments,
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

  describe('getPullRequest', () => {
    it('maps fields correctly', async () => {
      mockPullsGet.mockResolvedValue({
        data: {
          number: 10,
          title: 'PR Title',
          body: 'PR Body',
          html_url: 'https://github.com/org/repo/pull/10',
          state: 'open',
          merged: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          user: { login: 'author' },
        },
      });

      const pr = await service.getPullRequest('org', 'repo', 10);
      expect(pr.number).toBe(10);
      expect(pr.title).toBe('PR Title');
      expect(pr.body).toBe('PR Body');
      expect(pr.url).toBe('https://github.com/org/repo/pull/10');
      expect(pr.state).toBe('open');
      expect(pr.merged).toBe(false);
      expect(pr.author).toBe('author');
      expect(pr.createdAt).toBeInstanceOf(Date);
      expect(pr.updatedAt).toBeInstanceOf(Date);
    });

    it('handles null body', async () => {
      mockPullsGet.mockResolvedValue({
        data: {
          number: 11,
          title: 'No Body PR',
          body: null,
          html_url: 'https://github.com/org/repo/pull/11',
          state: 'open',
          merged: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          user: { login: 'author' },
        },
      });

      const pr = await service.getPullRequest('org', 'repo', 11);
      expect(pr.body).toBe('');
    });

    it('handles null user', async () => {
      mockPullsGet.mockResolvedValue({
        data: {
          number: 12,
          title: 'Ghost PR',
          body: '',
          html_url: 'https://github.com/org/repo/pull/12',
          state: 'closed',
          merged: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          user: null,
        },
      });

      const pr = await service.getPullRequest('org', 'repo', 12);
      expect(pr.author).toBe('unknown');
    });
  });

  describe('listPRComments', () => {
    it('maps fields correctly', async () => {
      mockIssuesListComments.mockResolvedValue({
        data: [
          {
            id: 101,
            body: 'comment body',
            user: { login: 'commenter', avatar_url: 'https://avatar.url/1' },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      });

      const comments = await service.listPRComments('org', 'repo', 10);
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(101);
      expect(comments[0].body).toBe('comment body');
      expect(comments[0].author).toBe('commenter');
      expect(comments[0].authorAvatarUrl).toBe('https://avatar.url/1');
      expect(comments[0].createdAt).toBeInstanceOf(Date);
      expect(comments[0].updatedAt).toBeInstanceOf(Date);
    });

    it('handles null user', async () => {
      mockIssuesListComments.mockResolvedValue({
        data: [
          {
            id: 102,
            body: 'ghost comment',
            user: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      });

      const comments = await service.listPRComments('org', 'repo', 10);
      expect(comments[0].author).toBe('unknown');
      expect(comments[0].authorAvatarUrl).toBe('');
    });

    it('throws on API error', async () => {
      mockIssuesListComments.mockRejectedValue(new Error('API failure'));
      await expect(service.listPRComments('org', 'repo', 10)).rejects.toThrow(
        'Failed to list comments'
      );
    });
  });

  describe('listPRReviews', () => {
    it('maps fields correctly', async () => {
      mockPullsListReviews.mockResolvedValue({
        data: [
          {
            id: 201,
            body: 'review body',
            state: 'APPROVED',
            user: { login: 'reviewer', avatar_url: 'https://avatar.url/2' },
            submitted_at: '2026-01-03T00:00:00Z',
          },
        ],
      });

      const reviews = await service.listPRReviews('org', 'repo', 10);
      expect(reviews).toHaveLength(1);
      expect(reviews[0].id).toBe(201);
      expect(reviews[0].body).toBe('review body');
      expect(reviews[0].state).toBe('APPROVED');
      expect(reviews[0].author).toBe('reviewer');
      expect(reviews[0].authorAvatarUrl).toBe('https://avatar.url/2');
      expect(reviews[0].submittedAt).toBeInstanceOf(Date);
    });

    it('handles null submitted_at with current date fallback', async () => {
      const before = Date.now();
      mockPullsListReviews.mockResolvedValue({
        data: [
          {
            id: 202,
            body: '',
            state: 'PENDING',
            user: { login: 'reviewer' },
            submitted_at: null,
          },
        ],
      });

      const reviews = await service.listPRReviews('org', 'repo', 10);
      const after = Date.now();
      expect(reviews[0].submittedAt).toBeInstanceOf(Date);
      expect(reviews[0].submittedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(reviews[0].submittedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('throws on API error', async () => {
      mockPullsListReviews.mockRejectedValue(new Error('API failure'));
      await expect(service.listPRReviews('org', 'repo', 10)).rejects.toThrow(
        'Failed to list reviews'
      );
    });
  });

  describe('listPRReviewComments', () => {
    it('maps fields correctly', async () => {
      mockPullsListReviewComments.mockResolvedValue({
        data: [
          {
            id: 301,
            body: 'inline comment',
            user: { login: 'reviewer', avatar_url: 'https://avatar.url/3' },
            path: 'src/foo.ts',
            line: 42,
            original_line: 40,
            created_at: '2026-01-04T00:00:00Z',
            in_reply_to_id: null,
          },
        ],
      });

      const comments = await service.listPRReviewComments('org', 'repo', 10);
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(301);
      expect(comments[0].body).toBe('inline comment');
      expect(comments[0].author).toBe('reviewer');
      expect(comments[0].authorAvatarUrl).toBe('https://avatar.url/3');
      expect(comments[0].path).toBe('src/foo.ts');
      expect(comments[0].line).toBe(42);
      expect(comments[0].createdAt).toBeInstanceOf(Date);
      expect(comments[0].inReplyToId).toBeNull();
    });

    it('uses original_line fallback when line is null', async () => {
      mockPullsListReviewComments.mockResolvedValue({
        data: [
          {
            id: 302,
            body: 'outdated comment',
            user: { login: 'reviewer' },
            path: 'src/bar.ts',
            line: null,
            original_line: 40,
            created_at: '2026-01-04T00:00:00Z',
            in_reply_to_id: null,
          },
        ],
      });

      const comments = await service.listPRReviewComments('org', 'repo', 10);
      expect(comments[0].line).toBe(40);
    });

    it('returns null line when both line and original_line are null', async () => {
      mockPullsListReviewComments.mockResolvedValue({
        data: [
          {
            id: 303,
            body: 'no line info',
            user: { login: 'reviewer' },
            path: 'src/baz.ts',
            line: null,
            original_line: null,
            created_at: '2026-01-04T00:00:00Z',
            in_reply_to_id: 301,
          },
        ],
      });

      const comments = await service.listPRReviewComments('org', 'repo', 10);
      expect(comments[0].line).toBeNull();
      expect(comments[0].inReplyToId).toBe(301);
    });

    it('throws on API error', async () => {
      mockPullsListReviewComments.mockRejectedValue(new Error('API failure'));
      await expect(service.listPRReviewComments('org', 'repo', 10)).rejects.toThrow(
        'Failed to list review comments'
      );
    });
  });

  describe('listIssues', () => {
    it('maps fields correctly and filters out PRs', async () => {
      mockIssuesListForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Bug report',
            body: 'Something broke',
            html_url: 'https://github.com/org/repo/issues/1',
            state: 'open',
            labels: [{ name: 'bug' }],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            user: { login: 'reporter', avatar_url: 'https://avatar.url/1' },
          },
          {
            number: 2,
            title: 'A PR disguised as issue',
            body: 'PR body',
            html_url: 'https://github.com/org/repo/issues/2',
            state: 'open',
            labels: [],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            user: { login: 'author' },
            pull_request: { url: 'https://api.github.com/repos/org/repo/pulls/2' },
          },
        ],
      });

      const issues = await service.listIssues('org', 'repo');
      expect(issues).toHaveLength(1);
      expect(issues[0].number).toBe(1);
      expect(issues[0].title).toBe('Bug report');
      expect(issues[0].body).toBe('Something broke');
      expect(issues[0].url).toBe('https://github.com/org/repo/issues/1');
      expect(issues[0].state).toBe('open');
      expect(issues[0].labels).toEqual(['bug']);
      expect(issues[0].author).toBe('reporter');
      expect(issues[0].authorAvatarUrl).toBe('https://avatar.url/1');
      expect(issues[0].createdAt).toBeInstanceOf(Date);
    });

    it('handles null user and string labels', async () => {
      mockIssuesListForRepo.mockResolvedValue({
        data: [
          {
            number: 3,
            title: 'Ghost issue',
            body: null,
            html_url: 'https://github.com/org/repo/issues/3',
            state: 'open',
            labels: ['enhancement'],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            user: null,
          },
        ],
      });

      const issues = await service.listIssues('org', 'repo');
      expect(issues[0].author).toBe('unknown');
      expect(issues[0].authorAvatarUrl).toBe('');
      expect(issues[0].body).toBe('');
      expect(issues[0].labels).toEqual(['enhancement']);
    });

    it('passes state option to API', async () => {
      mockIssuesListForRepo.mockResolvedValue({ data: [] });

      await service.listIssues('org', 'repo', { state: 'closed' });
      expect(mockIssuesListForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' })
      );
    });

    it('throws on API error', async () => {
      mockIssuesListForRepo.mockRejectedValue(new Error('API failure'));
      await expect(service.listIssues('org', 'repo')).rejects.toThrow(
        'Failed to list issues'
      );
    });
  });

  describe('listIssueComments', () => {
    it('maps fields correctly', async () => {
      mockIssuesListComments.mockResolvedValue({
        data: [
          {
            id: 501,
            body: 'issue comment body',
            user: { login: 'commenter', avatar_url: 'https://avatar.url/5' },
            created_at: '2026-01-03T00:00:00Z',
            updated_at: '2026-01-04T00:00:00Z',
          },
        ],
      });

      const comments = await service.listIssueComments('org', 'repo', 1);
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(501);
      expect(comments[0].body).toBe('issue comment body');
      expect(comments[0].author).toBe('commenter');
      expect(comments[0].authorAvatarUrl).toBe('https://avatar.url/5');
      expect(comments[0].createdAt).toBeInstanceOf(Date);
      expect(comments[0].updatedAt).toBeInstanceOf(Date);
    });

    it('handles null user', async () => {
      mockIssuesListComments.mockResolvedValue({
        data: [
          {
            id: 502,
            body: null,
            user: null,
            created_at: '2026-01-03T00:00:00Z',
            updated_at: '2026-01-04T00:00:00Z',
          },
        ],
      });

      const comments = await service.listIssueComments('org', 'repo', 1);
      expect(comments[0].author).toBe('unknown');
      expect(comments[0].authorAvatarUrl).toBe('');
      expect(comments[0].body).toBe('');
    });

    it('throws on API error', async () => {
      mockIssuesListComments.mockRejectedValue(new Error('API failure'));
      await expect(service.listIssueComments('org', 'repo', 1)).rejects.toThrow(
        'Failed to list comments'
      );
    });
  });

  describe('updateIssue', () => {
    it('calls issues.update with correct params', async () => {
      mockIssuesUpdate.mockResolvedValue({});
      await service.updateIssue('org', 'repo', 42, { state: 'closed', state_reason: 'completed' });
      expect(mockIssuesUpdate).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        issue_number: 42,
        state: 'closed',
        state_reason: 'completed',
      });
    });

    it('throws on API error', async () => {
      mockIssuesUpdate.mockRejectedValue(new Error('API failure'));
      await expect(service.updateIssue('org', 'repo', 42, { state: 'closed' })).rejects.toThrow(
        'Failed to update issue'
      );
    });
  });

  describe('createIssue', () => {
    it('returns created issue number and url', async () => {
      mockIssuesCreate.mockResolvedValue({
        data: {
          number: 99,
          html_url: 'https://github.com/org/repo/issues/99',
          id: 12345,
        },
      });

      const result = await service.createIssue('org', 'repo', 'New Issue', 'Issue body', ['bug']);
      expect(result.number).toBe(99);
      expect(result.url).toBe('https://github.com/org/repo/issues/99');
      expect(mockIssuesCreate).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        title: 'New Issue',
        body: 'Issue body',
        labels: ['bug'],
      });
    });

    it('throws on API error', async () => {
      mockIssuesCreate.mockRejectedValue(new Error('API failure'));
      await expect(service.createIssue('org', 'repo', 'Title', 'Body')).rejects.toThrow(
        'Failed to create issue'
      );
    });
  });

  describe('getRepository', () => {
    it('maps repository fields correctly', async () => {
      mockReposGet.mockResolvedValue({
        data: {
          id: 123,
          name: 'repo',
          full_name: 'org/repo',
          description: 'A repo',
          html_url: 'https://github.com/org/repo',
          clone_url: 'https://github.com/org/repo.git',
          language: 'TypeScript',
          stargazers_count: 50,
          forks_count: 10,
          fork: false,
          parent: null,
        },
      });

      const repo = await service.getRepository('org', 'repo');
      expect(repo.id).toBe('123');
      expect(repo.name).toBe('repo');
      expect(repo.fullName).toBe('org/repo');
      expect(repo.description).toBe('A repo');
      expect(repo.cloneUrl).toBe('https://github.com/org/repo.git');
      expect(repo.language).toBe('TypeScript');
      expect(repo.stars).toBe(50);
      expect(repo.forks).toBe(10);
      expect(repo.fork).toBe(false);
      expect(repo.parent).toBeUndefined();
    });

    it('maps parent when repo is a fork', async () => {
      mockReposGet.mockResolvedValue({
        data: {
          id: 456,
          name: 'forked-repo',
          full_name: 'user/forked-repo',
          description: null,
          html_url: 'https://github.com/user/forked-repo',
          clone_url: 'https://github.com/user/forked-repo.git',
          language: null,
          stargazers_count: 0,
          forks_count: 0,
          fork: true,
          parent: {
            id: 123,
            name: 'repo',
            full_name: 'org/repo',
            html_url: 'https://github.com/org/repo',
          },
        },
      });

      const repo = await service.getRepository('user', 'forked-repo');
      expect(repo.fork).toBe(true);
      expect(repo.parent).toEqual({
        id: '123',
        name: 'repo',
        full_name: 'org/repo',
        url: 'https://github.com/org/repo',
      });
      expect(repo.description).toBe('');
      expect(repo.language).toBe('Unknown');
    });

    it('throws on API error', async () => {
      mockReposGet.mockRejectedValue(new Error('API failure'));
      await expect(service.getRepository('org', 'repo')).rejects.toThrow(
        'Failed to get repository'
      );
    });
  });

  describe('getRepositoryContents', () => {
    it('maps directory contents', async () => {
      mockReposGetContent.mockResolvedValue({
        data: [
          {
            name: 'src',
            path: 'src',
            type: 'dir',
            size: 0,
            html_url: 'https://github.com/org/repo/tree/main/src',
          },
          {
            name: 'README.md',
            path: 'README.md',
            type: 'file',
            size: 1024,
            html_url: 'https://github.com/org/repo/blob/main/README.md',
          },
        ],
      });

      const contents = await service.getRepositoryContents('org', 'repo', '');
      expect(contents).toHaveLength(2);
      expect(contents[0].name).toBe('src');
      expect(contents[0].type).toBe('dir');
      expect(contents[1].name).toBe('README.md');
      expect(contents[1].size).toBe(1024);
    });

    it('returns empty array for single file response', async () => {
      mockReposGetContent.mockResolvedValue({
        data: { name: 'file.ts', path: 'file.ts', type: 'file', size: 100, html_url: '' },
      });

      const contents = await service.getRepositoryContents('org', 'repo', 'file.ts');
      expect(contents).toEqual([]);
    });

    it('throws on API error', async () => {
      mockReposGetContent.mockRejectedValue(new Error('API failure'));
      await expect(service.getRepositoryContents('org', 'repo')).rejects.toThrow(
        'Failed to get contents'
      );
    });
  });

  describe('starRepository', () => {
    it('calls star API', async () => {
      mockActivityStar.mockResolvedValue({});
      await service.starRepository('org', 'repo');
      expect(mockActivityStar).toHaveBeenCalledWith({ owner: 'org', repo: 'repo' });
    });

    it('throws on API error', async () => {
      mockActivityStar.mockRejectedValue(new Error('API failure'));
      await expect(service.starRepository('org', 'repo')).rejects.toThrow('Failed to star');
    });
  });

  describe('unstarRepository', () => {
    it('calls unstar API', async () => {
      mockActivityUnstar.mockResolvedValue({});
      await service.unstarRepository('org', 'repo');
      expect(mockActivityUnstar).toHaveBeenCalledWith({ owner: 'org', repo: 'repo' });
    });

    it('throws on API error', async () => {
      mockActivityUnstar.mockRejectedValue(new Error('API failure'));
      await expect(service.unstarRepository('org', 'repo')).rejects.toThrow('Failed to unstar');
    });
  });

  describe('listPullRequests', () => {
    it('maps PR list fields correctly', async () => {
      mockPullsList.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'PR 1',
            html_url: 'https://github.com/org/repo/pull/1',
            state: 'open',
            merged_at: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            user: { login: 'dev' },
            head: { ref: 'feature' },
          },
        ],
      });

      const prs = await service.listPullRequests('org', 'repo');
      expect(prs).toHaveLength(1);
      expect(prs[0].number).toBe(1);
      expect(prs[0].title).toBe('PR 1');
      expect(prs[0].merged).toBe(false);
      expect(prs[0].headBranch).toBe('feature');
      expect(prs[0].author).toBe('dev');
    });

    it('detects merged PRs via merged_at', async () => {
      mockPullsList.mockResolvedValue({
        data: [
          {
            number: 2,
            title: 'Merged PR',
            html_url: 'https://github.com/org/repo/pull/2',
            state: 'closed',
            merged_at: '2026-01-03T00:00:00Z',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-03T00:00:00Z',
            user: null,
            head: null,
          },
        ],
      });

      const prs = await service.listPullRequests('org', 'repo', { state: 'closed' });
      expect(prs[0].merged).toBe(true);
      expect(prs[0].author).toBe('unknown');
      expect(prs[0].headBranch).toBe('');
    });

    it('throws on API error', async () => {
      mockPullsList.mockRejectedValue(new Error('API failure'));
      await expect(service.listPullRequests('org', 'repo')).rejects.toThrow(
        'Failed to list pull requests'
      );
    });
  });

  // ─── Reactions ───────────────────────────────────────────────

  describe('listIssueReactions', () => {
    it('maps reaction fields', async () => {
      mockReactionsListForIssue.mockResolvedValue({
        data: [
          { id: 1, content: '+1', user: { login: 'user1' } },
          { id: 2, content: 'heart', user: null },
        ],
      });

      const reactions = await service.listIssueReactions('org', 'repo', 42);
      expect(reactions).toHaveLength(2);
      expect(reactions[0]).toEqual({ id: 1, content: '+1', user: 'user1' });
      expect(reactions[1]).toEqual({ id: 2, content: 'heart', user: 'unknown' });
    });

    it('throws on API error', async () => {
      mockReactionsListForIssue.mockRejectedValue(new Error('API failure'));
      await expect(service.listIssueReactions('org', 'repo', 42)).rejects.toThrow(
        'Failed to list reactions'
      );
    });
  });

  describe('addIssueReaction', () => {
    it('returns created reaction', async () => {
      mockReactionsCreateForIssue.mockResolvedValue({
        data: { id: 10, content: 'rocket', user: { login: 'me' } },
      });

      const reaction = await service.addIssueReaction('org', 'repo', 42, 'rocket');
      expect(reaction).toEqual({ id: 10, content: 'rocket', user: 'me' });
      expect(mockReactionsCreateForIssue).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        issue_number: 42,
        content: 'rocket',
      });
    });

    it('throws on API error', async () => {
      mockReactionsCreateForIssue.mockRejectedValue(new Error('API failure'));
      await expect(service.addIssueReaction('org', 'repo', 42, '+1')).rejects.toThrow(
        'Failed to add reaction'
      );
    });
  });

  describe('deleteIssueReaction', () => {
    it('calls delete API', async () => {
      mockReactionsDeleteForIssue.mockResolvedValue({});
      await service.deleteIssueReaction('org', 'repo', 42, 10);
      expect(mockReactionsDeleteForIssue).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        issue_number: 42,
        reaction_id: 10,
      });
    });

    it('throws on API error', async () => {
      mockReactionsDeleteForIssue.mockRejectedValue(new Error('API failure'));
      await expect(service.deleteIssueReaction('org', 'repo', 42, 10)).rejects.toThrow(
        'Failed to delete reaction'
      );
    });
  });

  describe('listCommentReactions', () => {
    it('maps reaction fields', async () => {
      mockReactionsListForIssueComment.mockResolvedValue({
        data: [
          { id: 3, content: 'laugh', user: { login: 'user2' } },
        ],
      });

      const reactions = await service.listCommentReactions('org', 'repo', 501);
      expect(reactions).toHaveLength(1);
      expect(reactions[0]).toEqual({ id: 3, content: 'laugh', user: 'user2' });
    });

    it('throws on API error', async () => {
      mockReactionsListForIssueComment.mockRejectedValue(new Error('API failure'));
      await expect(service.listCommentReactions('org', 'repo', 501)).rejects.toThrow(
        'Failed to list reactions for comment'
      );
    });
  });

  describe('addCommentReaction', () => {
    it('returns created reaction', async () => {
      mockReactionsCreateForIssueComment.mockResolvedValue({
        data: { id: 20, content: 'eyes', user: { login: 'me' } },
      });

      const reaction = await service.addCommentReaction('org', 'repo', 501, 'eyes');
      expect(reaction).toEqual({ id: 20, content: 'eyes', user: 'me' });
      expect(mockReactionsCreateForIssueComment).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        comment_id: 501,
        content: 'eyes',
      });
    });

    it('throws on API error', async () => {
      mockReactionsCreateForIssueComment.mockRejectedValue(new Error('API failure'));
      await expect(service.addCommentReaction('org', 'repo', 501, '+1')).rejects.toThrow(
        'Failed to add reaction to comment'
      );
    });
  });

  describe('deleteCommentReaction', () => {
    it('calls delete API', async () => {
      mockReactionsDeleteForIssueComment.mockResolvedValue({});
      await service.deleteCommentReaction('org', 'repo', 501, 20);
      expect(mockReactionsDeleteForIssueComment).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        comment_id: 501,
        reaction_id: 20,
      });
    });

    it('throws on API error', async () => {
      mockReactionsDeleteForIssueComment.mockRejectedValue(new Error('API failure'));
      await expect(service.deleteCommentReaction('org', 'repo', 501, 20)).rejects.toThrow(
        'Failed to delete reaction from comment'
      );
    });
  });

  // ─── Sub-Issues ─────────────────────────────────────────────

  describe('listSubIssues', () => {
    it('maps sub-issue fields', async () => {
      mockRequest.mockResolvedValue({
        data: [
          {
            id: 100,
            number: 43,
            title: 'Sub-issue 1',
            state: 'open',
            html_url: 'https://github.com/org/repo/issues/43',
          },
        ],
      });

      const subIssues = await service.listSubIssues('org', 'repo', 42);
      expect(subIssues).toHaveLength(1);
      expect(subIssues[0]).toEqual({
        id: 100,
        number: 43,
        title: 'Sub-issue 1',
        state: 'open',
        url: 'https://github.com/org/repo/issues/43',
      });
      expect(mockRequest).toHaveBeenCalledWith(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
        expect.objectContaining({
          owner: 'org',
          repo: 'repo',
          issue_number: 42,
        })
      );
    });

    it('returns empty array on 404 (sub-issues not available)', async () => {
      mockRequest.mockRejectedValue({ status: 404 });
      const subIssues = await service.listSubIssues('org', 'repo', 42);
      expect(subIssues).toEqual([]);
    });

    it('returns empty array on 403', async () => {
      mockRequest.mockRejectedValue({ status: 403 });
      const subIssues = await service.listSubIssues('org', 'repo', 42);
      expect(subIssues).toEqual([]);
    });

    it('throws on other errors', async () => {
      mockRequest.mockRejectedValue({ status: 500 });
      await expect(service.listSubIssues('org', 'repo', 42)).rejects.toThrow(
        'Failed to list sub-issues'
      );
    });
  });

  describe('createSubIssue', () => {
    it('creates issue and links as sub-issue', async () => {
      mockIssuesCreate.mockResolvedValue({
        data: {
          id: 999,
          number: 44,
          html_url: 'https://github.com/org/repo/issues/44',
        },
      });
      mockRequest.mockResolvedValue({});

      const result = await service.createSubIssue('org', 'repo', 42, 'Sub Title', 'Sub Body', ['enhancement']);
      expect(result).toEqual({
        number: 44,
        url: 'https://github.com/org/repo/issues/44',
      });
      expect(mockIssuesCreate).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        title: 'Sub Title',
        body: 'Sub Body',
        labels: ['enhancement'],
      });
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
        expect.objectContaining({
          owner: 'org',
          repo: 'repo',
          issue_number: 42,
          sub_issue_id: 999,
        })
      );
    });

    it('throws on API error', async () => {
      mockIssuesCreate.mockRejectedValue(new Error('API failure'));
      await expect(
        service.createSubIssue('org', 'repo', 42, 'Title', 'Body')
      ).rejects.toThrow('Failed to create sub-issue');
    });
  });

  describe('addExistingSubIssue', () => {
    it('links existing issue as sub-issue', async () => {
      mockRequest.mockResolvedValue({});
      await service.addExistingSubIssue('org', 'repo', 42, 999);
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
        expect.objectContaining({
          owner: 'org',
          repo: 'repo',
          issue_number: 42,
          sub_issue_id: 999,
        })
      );
    });

    it('throws on API error', async () => {
      mockRequest.mockRejectedValue(new Error('API failure'));
      await expect(service.addExistingSubIssue('org', 'repo', 42, 999)).rejects.toThrow(
        'Failed to add sub-issue'
      );
    });
  });
});
