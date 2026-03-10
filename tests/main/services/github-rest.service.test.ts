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
const mockPullsMerge = vi.fn();
const mockPullsUpdate = vi.fn();
const mockReposGetCombinedStatusForRef = vi.fn();
const mockChecksListSuitesForRef = vi.fn();
const mockActionsListWorkflowRunsForRepo = vi.fn();
const mockActionsListJobsForWorkflowRun = vi.fn();
const mockActionsDownloadJobLogsForWorkflowRun = vi.fn();
const mockReposListReleases = vi.fn();
const mockReposGetRelease = vi.fn();
const mockReposCreateRelease = vi.fn();
const mockReposUpdateRelease = vi.fn();
const mockReposDeleteRelease = vi.fn();
const mockIssuesAddAssignees = vi.fn();
const mockSearchIssuesAndPullRequests = vi.fn();
const mockActivityListEventsForAuthenticatedUser = vi.fn();

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
      addAssignees: mockIssuesAddAssignees,
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
      getCombinedStatusForRef: mockReposGetCombinedStatusForRef,
    };
    checks = {
      listSuitesForRef: mockChecksListSuitesForRef,
    };
    pulls = {
      create: mockPullsCreate,
      get: mockPullsGet,
      list: mockPullsList,
      listReviews: mockPullsListReviews,
      listReviewComments: mockPullsListReviewComments,
      merge: mockPullsMerge,
      update: mockPullsUpdate,
    };
    // The service calls client.rest for merge/close and actions operations
    rest = {
      pulls: {
        merge: mockPullsMerge,
        update: mockPullsUpdate,
      },
      actions: {
        listWorkflowRunsForRepo: mockActionsListWorkflowRunsForRepo,
        listJobsForWorkflowRun: mockActionsListJobsForWorkflowRun,
        downloadJobLogsForWorkflowRun: mockActionsDownloadJobLogsForWorkflowRun,
      },
      repos: {
        listReleases: mockReposListReleases,
        getRelease: mockReposGetRelease,
        createRelease: mockReposCreateRelease,
        updateRelease: mockReposUpdateRelease,
        deleteRelease: mockReposDeleteRelease,
        getCombinedStatusForRef: mockReposGetCombinedStatusForRef,
      },
    };
    search = {
      issuesAndPullRequests: mockSearchIssuesAndPullRequests,
    };
    activity = {
      checkRepoIsStarredByAuthenticatedUser: mockActivityCheckStar,
      starRepoForAuthenticatedUser: mockActivityStar,
      unstarRepoForAuthenticatedUser: mockActivityUnstar,
      listEventsForAuthenticatedUser: mockActivityListEventsForAuthenticatedUser,
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

      const pr = await service.createPullRequest(
        'org',
        'repo',
        'Fix bug',
        'feature',
        'main',
        'PR body'
      );
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
          head: { sha: 'abc123def456' },
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
      expect(pr.headSha).toBe('abc123def456');
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
          head: { sha: 'def456' },
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
          head: { sha: 'ghi789' },
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
      await expect(service.listIssues('org', 'repo')).rejects.toThrow('Failed to list issues');
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
        data: [{ id: 3, content: 'laugh', user: { login: 'user2' } }],
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
        labels: [],
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

      const result = await service.createSubIssue('org', 'repo', 42, 'Sub Title', 'Sub Body', [
        'enhancement',
      ]);
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
      await expect(service.createSubIssue('org', 'repo', 42, 'Title', 'Body')).rejects.toThrow(
        'Failed to create sub-issue'
      );
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

  describe('getParentIssue', () => {
    it('returns parent issue when API responds with data', async () => {
      mockRequest.mockResolvedValue({
        data: {
          id: 50,
          number: 3,
          title: 'Parent Issue',
          state: 'open',
          html_url: 'https://github.com/org/repo/issues/3',
        },
      });

      const parent = await service.getParentIssue('org', 'repo', 43);
      expect(parent).toEqual({
        id: 50,
        number: 3,
        title: 'Parent Issue',
        state: 'open',
        url: 'https://github.com/org/repo/issues/3',
        labels: [],
      });
      expect(mockRequest).toHaveBeenCalledWith(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/parent',
        expect.objectContaining({
          owner: 'org',
          repo: 'repo',
          issue_number: 43,
        })
      );
    });

    it('returns null on 404 (not a sub-issue)', async () => {
      mockRequest.mockRejectedValue({ status: 404 });
      const parent = await service.getParentIssue('org', 'repo', 43);
      expect(parent).toBeNull();
    });

    it('returns null on 403', async () => {
      mockRequest.mockRejectedValue({ status: 403 });
      const parent = await service.getParentIssue('org', 'repo', 43);
      expect(parent).toBeNull();
    });

    it('throws on other errors', async () => {
      mockRequest.mockRejectedValue({ status: 500 });
      await expect(service.getParentIssue('org', 'repo', 43)).rejects.toThrow(
        'Failed to get parent issue'
      );
    });
  });

  // ─── Merge and Close PRs ─────────────────────────────────────────

  describe('mergePullRequest', () => {
    it('merges PR with merge method and returns result', async () => {
      mockPullsMerge.mockResolvedValue({
        data: {
          sha: 'abc123def456',
          merged: true,
          message: 'Pull Request successfully merged',
        },
      });

      const result = await service.mergePullRequest('org', 'repo', 42, 'merge');
      expect(result.sha).toBe('abc123def456');
      expect(result.merged).toBe(true);
      expect(result.message).toBe('Pull Request successfully merged');
      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        merge_method: 'merge',
      });
    });

    it('merges PR with squash method', async () => {
      mockPullsMerge.mockResolvedValue({
        data: {
          sha: 'squash123',
          merged: true,
          message: 'Pull Request successfully squashed',
        },
      });

      const result = await service.mergePullRequest('org', 'repo', 42, 'squash');
      expect(result.sha).toBe('squash123');
      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        merge_method: 'squash',
      });
    });

    it('merges PR with rebase method', async () => {
      mockPullsMerge.mockResolvedValue({
        data: {
          sha: 'rebase123',
          merged: true,
          message: 'Pull Request successfully rebased',
        },
      });

      const result = await service.mergePullRequest('org', 'repo', 42, 'rebase');
      expect(result.sha).toBe('rebase123');
      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        merge_method: 'rebase',
      });
    });

    it('passes commit title and message when provided', async () => {
      mockPullsMerge.mockResolvedValue({
        data: {
          sha: 'custom123',
          merged: true,
          message: 'Merged with custom message',
        },
      });

      await service.mergePullRequest(
        'org',
        'repo',
        42,
        'squash',
        'Custom Title',
        'Custom body message'
      );
      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        merge_method: 'squash',
        commit_title: 'Custom Title',
        commit_message: 'Custom body message',
      });
    });

    it('throws on API error', async () => {
      mockPullsMerge.mockRejectedValue(new Error('API failure'));
      await expect(service.mergePullRequest('org', 'repo', 42, 'merge')).rejects.toThrow(
        'Failed to merge PR #42'
      );
    });
  });

  describe('closePullRequest', () => {
    it('closes PR and returns result', async () => {
      mockPullsUpdate.mockResolvedValue({
        data: {
          number: 42,
          state: 'closed',
        },
      });

      const result = await service.closePullRequest('org', 'repo', 42);
      expect(result.number).toBe(42);
      expect(result.state).toBe('closed');
    });

    it('calls pulls.update with state closed', async () => {
      mockPullsUpdate.mockResolvedValue({
        data: {
          number: 42,
          state: 'closed',
        },
      });

      await service.closePullRequest('org', 'repo', 42);
      expect(mockPullsUpdate).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        state: 'closed',
      });
    });

    it('throws on API error', async () => {
      mockPullsUpdate.mockRejectedValue(new Error('API failure'));
      await expect(service.closePullRequest('org', 'repo', 42)).rejects.toThrow(
        'Failed to close PR #42'
      );
    });
  });

  // ─── PR Check Status ─────────────────────────────────────────

  describe('getPRCheckStatus', () => {
    it('returns success when all combined statuses pass', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: {
          statuses: [
            { state: 'success', context: 'CI' },
            { state: 'success', context: 'Build' },
          ],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('success');
      expect(status.total).toBe(2);
      expect(status.passed).toBe(2);
      expect(status.failed).toBe(0);
      expect(status.pending).toBe(0);
    });

    it('returns pending when some statuses are pending', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: {
          statuses: [
            { state: 'success', context: 'CI' },
            { state: 'pending', context: 'Build' },
          ],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('pending');
      expect(status.total).toBe(2);
      expect(status.passed).toBe(1);
      expect(status.pending).toBe(1);
    });

    it('returns failure when any status fails', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: {
          statuses: [
            { state: 'success', context: 'CI' },
            { state: 'failure', context: 'Build' },
          ],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('failure');
      expect(status.total).toBe(2);
      expect(status.passed).toBe(1);
      expect(status.failed).toBe(1);
    });

    it('returns failure when any status errors', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: {
          statuses: [{ state: 'error', context: 'CI' }],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('failure');
      expect(status.failed).toBe(1);
    });

    it('falls back to check suites when no combined statuses', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });
      mockChecksListSuitesForRef.mockResolvedValue({
        data: {
          check_suites: [
            { status: 'completed', conclusion: 'success' },
            { status: 'completed', conclusion: 'success' },
          ],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('success');
      expect(status.total).toBe(2);
      expect(status.passed).toBe(2);
    });

    it('returns pending for in_progress check suites', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });
      mockChecksListSuitesForRef.mockResolvedValue({
        data: {
          check_suites: [
            { status: 'in_progress', conclusion: null },
            { status: 'completed', conclusion: 'success' },
          ],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('pending');
      expect(status.pending).toBe(1);
      expect(status.passed).toBe(1);
    });

    it('returns failure for failed check suites', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });
      mockChecksListSuitesForRef.mockResolvedValue({
        data: {
          check_suites: [
            { status: 'completed', conclusion: 'failure' },
            { status: 'completed', conclusion: 'success' },
          ],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('failure');
      expect(status.failed).toBe(1);
      expect(status.passed).toBe(1);
    });

    it('treats skipped and neutral as passed', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });
      mockChecksListSuitesForRef.mockResolvedValue({
        data: {
          check_suites: [
            { status: 'completed', conclusion: 'skipped' },
            { status: 'completed', conclusion: 'neutral' },
          ],
        },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('success');
      expect(status.passed).toBe(2);
    });

    it('returns unknown when no statuses or check suites', async () => {
      mockReposGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });
      mockChecksListSuitesForRef.mockResolvedValue({
        data: { check_suites: [] },
      });

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('unknown');
      expect(status.total).toBe(0);
    });

    it('returns unknown on API error (graceful degradation)', async () => {
      mockReposGetCombinedStatusForRef.mockRejectedValue(new Error('API failure'));

      const status = await service.getPRCheckStatus('org', 'repo', 'abc123');
      expect(status.state).toBe('unknown');
      expect(status.total).toBe(0);
    });
  });

  // ─── GitHub Actions ─────────────────────────────────────────

  describe('listWorkflowRuns', () => {
    it('returns normalized workflow runs', async () => {
      mockActionsListWorkflowRunsForRepo.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 1001,
              name: 'CI',
              display_title: 'Fix tests',
              status: 'completed',
              conclusion: 'success',
              head_branch: 'main',
              head_sha: 'abc123',
              event: 'push',
              run_number: 42,
              created_at: '2026-02-01T00:00:00Z',
              updated_at: '2026-02-01T01:00:00Z',
              html_url: 'https://github.com/org/repo/actions/runs/1001',
              actor: { login: 'dev', avatar_url: 'https://avatar.url/dev' },
            },
          ],
        },
      });

      const runs = await service.listWorkflowRuns('org', 'repo');
      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe(1001);
      expect(runs[0].name).toBe('CI');
      expect(runs[0].displayTitle).toBe('Fix tests');
      expect(runs[0].status).toBe('completed');
      expect(runs[0].conclusion).toBe('success');
      expect(runs[0].headBranch).toBe('main');
      expect(runs[0].headSha).toBe('abc123');
      expect(runs[0].event).toBe('push');
      expect(runs[0].runNumber).toBe(42);
      expect(runs[0].htmlUrl).toBe('https://github.com/org/repo/actions/runs/1001');
      expect(runs[0].actor).toBe('dev');
      expect(runs[0].actorAvatarUrl).toBe('https://avatar.url/dev');
    });

    it('returns empty array when no runs', async () => {
      mockActionsListWorkflowRunsForRepo.mockResolvedValue({
        data: { workflow_runs: [] },
      });

      const runs = await service.listWorkflowRuns('org', 'repo');
      expect(runs).toEqual([]);
    });

    it('throws descriptive error on API failure', async () => {
      mockActionsListWorkflowRunsForRepo.mockRejectedValue(new Error('API failure'));
      await expect(service.listWorkflowRuns('org', 'repo')).rejects.toThrow(
        'Failed to list workflow runs'
      );
    });
  });

  describe('listWorkflowRunJobs', () => {
    it('returns normalized jobs with steps', async () => {
      mockActionsListJobsForWorkflowRun.mockResolvedValue({
        data: {
          jobs: [
            {
              id: 2001,
              name: 'build',
              status: 'completed',
              conclusion: 'success',
              started_at: '2026-02-01T00:00:00Z',
              completed_at: '2026-02-01T00:05:00Z',
              html_url: 'https://github.com/org/repo/actions/runs/1001/jobs/2001',
              runner_name: 'ubuntu-latest',
              labels: ['ubuntu-latest'],
              steps: [
                {
                  name: 'Checkout',
                  status: 'completed',
                  conclusion: 'success',
                  number: 1,
                },
                {
                  name: 'Run tests',
                  status: 'completed',
                  conclusion: 'failure',
                  number: 2,
                },
              ],
            },
          ],
        },
      });

      const jobs = await service.listWorkflowRunJobs('org', 'repo', 1001);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(2001);
      expect(jobs[0].name).toBe('build');
      expect(jobs[0].status).toBe('completed');
      expect(jobs[0].conclusion).toBe('success');
      expect(jobs[0].startedAt).toBe('2026-02-01T00:00:00Z');
      expect(jobs[0].completedAt).toBe('2026-02-01T00:05:00Z');
      expect(jobs[0].htmlUrl).toBe('https://github.com/org/repo/actions/runs/1001/jobs/2001');
      expect(jobs[0].runnerName).toBe('ubuntu-latest');
      expect(jobs[0].labels).toEqual(['ubuntu-latest']);
      expect(jobs[0].steps).toHaveLength(2);
      expect(jobs[0].steps[0].name).toBe('Checkout');
      expect(jobs[0].steps[0].conclusion).toBe('success');
      expect(jobs[0].steps[1].name).toBe('Run tests');
      expect(jobs[0].steps[1].conclusion).toBe('failure');
    });

    it('returns empty array when no jobs', async () => {
      mockActionsListJobsForWorkflowRun.mockResolvedValue({
        data: { jobs: [] },
      });

      const jobs = await service.listWorkflowRunJobs('org', 'repo', 1001);
      expect(jobs).toEqual([]);
    });

    it('throws descriptive error on API failure', async () => {
      mockActionsListJobsForWorkflowRun.mockRejectedValue(new Error('API failure'));
      await expect(service.listWorkflowRunJobs('org', 'repo', 1001)).rejects.toThrow(
        'Failed to list jobs for workflow run'
      );
    });
  });

  describe('getJobLogs', () => {
    it('returns log content as string', async () => {
      mockActionsDownloadJobLogsForWorkflowRun.mockResolvedValue({
        data: '2026-02-01T00:00:00Z Running tests...\n2026-02-01T00:01:00Z Tests passed',
      });

      const logs = await service.getJobLogs('org', 'repo', 2001);
      expect(logs).toContain('Running tests');
      expect(logs).toContain('Tests passed');
    });

    it('throws descriptive error on API failure', async () => {
      mockActionsDownloadJobLogsForWorkflowRun.mockRejectedValue(new Error('API failure'));
      await expect(service.getJobLogs('org', 'repo', 2001)).rejects.toThrow(
        'Failed to get job logs'
      );
    });

    it('handles empty log response', async () => {
      mockActionsDownloadJobLogsForWorkflowRun.mockResolvedValue({
        data: '',
      });

      const logs = await service.getJobLogs('org', 'repo', 2001);
      expect(logs).toBe('');
    });
  });

  // ─── GitHub Releases ─────────────────────────────────────────

  describe('listReleases', () => {
    it('returns normalized releases with isLatest flag', async () => {
      mockReposListReleases.mockResolvedValue({
        data: [
          {
            id: 3001,
            tag_name: 'v1.2.0',
            name: 'Release 1.2.0',
            body: '## Changes',
            draft: false,
            prerelease: false,
            created_at: '2026-02-15T00:00:00Z',
            published_at: '2026-02-15T00:00:00Z',
            html_url: 'https://github.com/org/repo/releases/tag/v1.2.0',
            author: { login: 'dev', avatar_url: 'https://avatar.url/dev' },
          },
          {
            id: 3002,
            tag_name: 'v1.1.0',
            name: 'Release 1.1.0',
            body: '## Old release',
            draft: false,
            prerelease: false,
            created_at: '2026-02-01T00:00:00Z',
            published_at: '2026-02-01T00:00:00Z',
            html_url: 'https://github.com/org/repo/releases/tag/v1.1.0',
            author: { login: 'dev', avatar_url: '' },
          },
          {
            id: 3003,
            tag_name: 'v2.0.0-beta',
            name: 'Beta 2.0',
            body: '## Beta',
            draft: true,
            prerelease: false,
            created_at: '2026-02-10T00:00:00Z',
            published_at: null,
            html_url: 'https://github.com/org/repo/releases/tag/v2.0.0-beta',
            author: { login: 'dev', avatar_url: '' },
          },
        ],
      });

      const releases = await service.listReleases('org', 'repo');
      expect(releases).toHaveLength(3);
      // First non-draft non-prerelease is latest
      expect(releases[0].isLatest).toBe(true);
      expect(releases[0].tagName).toBe('v1.2.0');
      // Second non-draft non-prerelease is NOT latest
      expect(releases[1].isLatest).toBe(false);
      // Draft is never latest
      expect(releases[2].isLatest).toBe(false);
      expect(releases[2].draft).toBe(true);
      expect(releases[2].publishedAt).toBeNull();
    });

    it('returns empty array when no releases', async () => {
      mockReposListReleases.mockResolvedValue({ data: [] });
      const releases = await service.listReleases('org', 'repo');
      expect(releases).toEqual([]);
    });

    it('throws descriptive error on API failure', async () => {
      mockReposListReleases.mockRejectedValue(new Error('API failure'));
      await expect(service.listReleases('org', 'repo')).rejects.toThrow('Failed to list releases');
    });
  });

  describe('getRelease', () => {
    it('returns full release details with targetCommitish', async () => {
      mockReposGetRelease.mockResolvedValue({
        data: {
          id: 3001,
          tag_name: 'v1.2.0',
          name: 'Release 1.2.0',
          body: '## Changes',
          draft: false,
          prerelease: false,
          created_at: '2026-02-15T00:00:00Z',
          published_at: '2026-02-15T00:00:00Z',
          html_url: 'https://github.com/org/repo/releases/tag/v1.2.0',
          author: { login: 'dev', avatar_url: 'https://avatar.url/dev' },
          target_commitish: 'main',
        },
      });

      const release = await service.getRelease('org', 'repo', 3001);
      expect(release.id).toBe(3001);
      expect(release.tagName).toBe('v1.2.0');
      expect(release.name).toBe('Release 1.2.0');
      expect(release.targetCommitish).toBe('main');
      expect(release.author).toBe('dev');
      expect(release.isLatest).toBe(true);
    });

    it('throws descriptive error on API failure', async () => {
      mockReposGetRelease.mockRejectedValue(new Error('API failure'));
      await expect(service.getRelease('org', 'repo', 3001)).rejects.toThrow(
        'Failed to get release'
      );
    });

    it('handles release with null published_at (draft)', async () => {
      mockReposGetRelease.mockResolvedValue({
        data: {
          id: 3003,
          tag_name: 'v2.0.0-beta',
          name: 'Beta 2.0',
          body: '## Beta',
          draft: true,
          prerelease: false,
          created_at: '2026-02-10T00:00:00Z',
          published_at: null,
          html_url: 'https://github.com/org/repo/releases/tag/v2.0.0-beta',
          author: { login: 'dev', avatar_url: '' },
          target_commitish: 'develop',
        },
      });

      const release = await service.getRelease('org', 'repo', 3003);
      expect(release.publishedAt).toBeNull();
      expect(release.draft).toBe(true);
      expect(release.isLatest).toBe(false); // draft is not latest
    });
  });

  describe('createRelease', () => {
    it('creates release and returns normalized result', async () => {
      mockReposCreateRelease.mockResolvedValue({
        data: {
          id: 3010,
          tag_name: 'v1.3.0',
          name: 'Release 1.3.0',
          body: '## New release',
          draft: true,
          prerelease: false,
          html_url: 'https://github.com/org/repo/releases/tag/v1.3.0',
        },
      });

      const release = await service.createRelease('org', 'repo', {
        tagName: 'v1.3.0',
        name: 'Release 1.3.0',
        body: '## New release',
        draft: true,
        prerelease: false,
        makeLatest: 'true',
      });

      expect(release.id).toBe(3010);
      expect(release.tagName).toBe('v1.3.0');
      expect(release.draft).toBe(true);
      expect(mockReposCreateRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'org',
          repo: 'repo',
          tag_name: 'v1.3.0',
          make_latest: 'true',
        })
      );
    });

    it('passes target_commitish when provided', async () => {
      mockReposCreateRelease.mockResolvedValue({
        data: {
          id: 3011,
          tag_name: 'v1.4.0',
          name: 'Release 1.4.0',
          body: '',
          draft: true,
          prerelease: false,
          html_url: 'https://github.com/org/repo/releases/tag/v1.4.0',
        },
      });

      await service.createRelease('org', 'repo', {
        tagName: 'v1.4.0',
        name: 'Release 1.4.0',
        body: '',
        draft: true,
        prerelease: false,
        makeLatest: 'false',
        targetCommitish: 'develop',
      });

      expect(mockReposCreateRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          target_commitish: 'develop',
        })
      );
    });

    it('throws descriptive error on API failure', async () => {
      mockReposCreateRelease.mockRejectedValue(new Error('API failure'));
      await expect(
        service.createRelease('org', 'repo', {
          tagName: 'v1.0.0',
          name: 'test',
          body: '',
          draft: true,
          prerelease: false,
          makeLatest: 'true',
        })
      ).rejects.toThrow('Failed to create release');
    });
  });

  describe('updateRelease', () => {
    it('updates release and returns normalized result', async () => {
      mockReposUpdateRelease.mockResolvedValue({
        data: {
          id: 3001,
          tag_name: 'v1.2.1',
          name: 'Updated Release',
          body: '## Updated',
          draft: false,
          prerelease: false,
          html_url: 'https://github.com/org/repo/releases/tag/v1.2.1',
        },
      });

      const release = await service.updateRelease('org', 'repo', 3001, {
        tagName: 'v1.2.1',
        name: 'Updated Release',
        body: '## Updated',
      });

      expect(release.id).toBe(3001);
      expect(release.tagName).toBe('v1.2.1');
      expect(release.name).toBe('Updated Release');
    });

    it('only sends provided fields (partial update)', async () => {
      mockReposUpdateRelease.mockResolvedValue({
        data: {
          id: 3001,
          tag_name: 'v1.2.0',
          name: 'Release 1.2.0',
          body: '## Updated body only',
          draft: false,
          prerelease: false,
          html_url: 'https://github.com/org/repo/releases/tag/v1.2.0',
        },
      });

      await service.updateRelease('org', 'repo', 3001, {
        body: '## Updated body only',
      });

      const calledWith = mockReposUpdateRelease.mock.calls[0][0];
      expect(calledWith.body).toBe('## Updated body only');
      expect(calledWith.owner).toBe('org');
      expect(calledWith.repo).toBe('repo');
      expect(calledWith.release_id).toBe(3001);
      // Should NOT have tag_name, name, draft, prerelease, make_latest
      expect(calledWith.tag_name).toBeUndefined();
      expect(calledWith.name).toBeUndefined();
      expect(calledWith.draft).toBeUndefined();
    });

    it('throws descriptive error on API failure', async () => {
      mockReposUpdateRelease.mockRejectedValue(new Error('API failure'));
      await expect(service.updateRelease('org', 'repo', 3001, { name: 'test' })).rejects.toThrow(
        'Failed to update release'
      );
    });
  });

  describe('deleteRelease', () => {
    it('deletes release successfully', async () => {
      mockReposDeleteRelease.mockResolvedValue({ status: 204 });
      await expect(service.deleteRelease('org', 'repo', 3001)).resolves.toBeUndefined();
    });

    it('throws descriptive error on API failure', async () => {
      mockReposDeleteRelease.mockRejectedValue(new Error('API failure'));
      await expect(service.deleteRelease('org', 'repo', 3001)).rejects.toThrow(
        'Failed to delete release'
      );
    });

    it('calls correct Octokit method with release_id', async () => {
      mockReposDeleteRelease.mockResolvedValue({ status: 204 });
      await service.deleteRelease('org', 'repo', 3001);
      expect(mockReposDeleteRelease).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        release_id: 3001,
      });
    });
  });

  // ─── GitHub Search ─────────────────────────────────────────

  describe('searchIssuesAndPullRequests', () => {
    it('returns normalized search results', async () => {
      mockSearchIssuesAndPullRequests.mockResolvedValue({
        data: {
          total_count: 2,
          items: [
            {
              id: 100,
              number: 10,
              title: 'Open PR',
              state: 'open',
              html_url: 'https://github.com/org/repo/pull/10',
              created_at: '2026-02-01T00:00:00Z',
              updated_at: '2026-02-02T00:00:00Z',
              closed_at: null,
              labels: [{ name: 'enhancement' }],
              repository_url: 'https://api.github.com/repos/org/repo',
              pull_request: { merged_at: null },
              user: { login: 'dev' },
            },
            {
              id: 101,
              number: 5,
              title: 'Open Issue',
              state: 'open',
              html_url: 'https://github.com/org/repo/issues/5',
              created_at: '2026-01-15T00:00:00Z',
              updated_at: '2026-02-01T00:00:00Z',
              closed_at: null,
              labels: ['bug'],
              repository_url: 'https://api.github.com/repos/org/repo',
              pull_request: undefined,
              user: null,
            },
          ],
        },
      });

      const result = await service.searchIssuesAndPullRequests('author:dev type:pr is:open');
      expect(result.totalCount).toBe(2);
      expect(result.items).toHaveLength(2);

      expect(result.items[0].id).toBe(100);
      expect(result.items[0].number).toBe(10);
      expect(result.items[0].title).toBe('Open PR');
      expect(result.items[0].repoFullName).toBe('org/repo');
      expect(result.items[0].isPullRequest).toBe(true);
      expect(result.items[0].author).toBe('dev');
      expect(result.items[0].labels).toEqual(['enhancement']);
      expect(result.items[0].pullRequest).toEqual({ mergedAt: null });

      expect(result.items[1].isPullRequest).toBe(false);
      expect(result.items[1].author).toBe('');
      expect(result.items[1].labels).toEqual(['bug']);
      expect(result.items[1].pullRequest).toBeUndefined();
    });

    it('passes query and perPage to API', async () => {
      mockSearchIssuesAndPullRequests.mockResolvedValue({
        data: { total_count: 0, items: [] },
      });

      await service.searchIssuesAndPullRequests('assignee:user type:issue', 10);
      expect(mockSearchIssuesAndPullRequests).toHaveBeenCalledWith({
        q: 'assignee:user type:issue',
        per_page: 10,
        sort: 'updated',
        order: 'desc',
      });
    });

    it('returns empty items for no results', async () => {
      mockSearchIssuesAndPullRequests.mockResolvedValue({
        data: { total_count: 0, items: [] },
      });

      const result = await service.searchIssuesAndPullRequests('author:nobody');
      expect(result.totalCount).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('throws on API error', async () => {
      mockSearchIssuesAndPullRequests.mockRejectedValue(new Error('API failure'));
      await expect(service.searchIssuesAndPullRequests('author:dev')).rejects.toThrow(
        'Failed to search issues and pull requests'
      );
    });
  });

  // ─── User Events ─────────────────────────────────────────

  describe('listUserEvents', () => {
    it('returns normalized events', async () => {
      mockActivityListEventsForAuthenticatedUser.mockResolvedValue({
        data: [
          {
            id: '1',
            type: 'PushEvent',
            repo: { name: 'org/repo' },
            created_at: '2026-02-18T10:00:00Z',
            payload: { size: 3, ref: 'refs/heads/main', ref_type: '' },
          },
          {
            id: '2',
            type: 'PullRequestEvent',
            repo: { name: 'org/repo' },
            created_at: '2026-02-18T09:00:00Z',
            payload: {
              action: 'opened',
              pull_request: { number: 42, title: 'New feature' },
            },
          },
          {
            id: '3',
            type: 'IssuesEvent',
            repo: { name: 'org/other' },
            created_at: '2026-02-18T08:00:00Z',
            payload: {
              action: 'opened',
              issue: { number: 7, title: 'Bug report' },
            },
          },
        ],
      });

      const events = await service.listUserEvents('dev');
      expect(events).toHaveLength(3);

      expect(events[0].id).toBe('1');
      expect(events[0].type).toBe('PushEvent');
      expect(events[0].repoName).toBe('org/repo');
      expect(events[0].commitCount).toBe(3);
      expect(events[0].ref).toBe('refs/heads/main');

      expect(events[1].type).toBe('PullRequestEvent');
      expect(events[1].action).toBe('opened');
      expect(events[1].prNumber).toBe(42);
      expect(events[1].prTitle).toBe('New feature');

      expect(events[2].type).toBe('IssuesEvent');
      expect(events[2].action).toBe('opened');
      expect(events[2].issueNumber).toBe(7);
      expect(events[2].issueTitle).toBe('Bug report');
    });

    it('passes username and perPage to API', async () => {
      mockActivityListEventsForAuthenticatedUser.mockResolvedValue({ data: [] });

      await service.listUserEvents('testuser', 10);
      expect(mockActivityListEventsForAuthenticatedUser).toHaveBeenCalledWith({
        username: 'testuser',
        per_page: 10,
      });
    });

    it('handles events with missing fields gracefully', async () => {
      mockActivityListEventsForAuthenticatedUser.mockResolvedValue({
        data: [
          {
            id: '4',
            type: null,
            repo: null,
            created_at: null,
            payload: null,
          },
        ],
      });

      const events = await service.listUserEvents('dev');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('');
      expect(events[0].repoName).toBe('');
      expect(events[0].createdAt).toBe('');
      expect(events[0].action).toBe('');
      expect(events[0].commitCount).toBe(0);
      expect(events[0].prNumber).toBeNull();
      expect(events[0].issueNumber).toBeNull();
    });

    it('returns empty array for no events', async () => {
      mockActivityListEventsForAuthenticatedUser.mockResolvedValue({ data: [] });

      const events = await service.listUserEvents('dev');
      expect(events).toEqual([]);
    });

    it('throws on API error', async () => {
      mockActivityListEventsForAuthenticatedUser.mockRejectedValue(new Error('API failure'));
      await expect(service.listUserEvents('dev')).rejects.toThrow('Failed to list user events');
    });
  });

  describe('addAssignees', () => {
    it('calls client.issues.addAssignees with correct params', async () => {
      mockIssuesAddAssignees.mockResolvedValue({ data: {} });

      await service.addAssignees('owner', 'repo', 42, ['testuser']);

      expect(mockIssuesAddAssignees).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 42,
        assignees: ['testuser'],
      });
    });

    it('throws on API error', async () => {
      mockIssuesAddAssignees.mockRejectedValue(new Error('Forbidden'));
      await expect(service.addAssignees('owner', 'repo', 42, ['testuser'])).rejects.toThrow(
        'Failed to add assignees to issue #42'
      );
    });
  });
});
