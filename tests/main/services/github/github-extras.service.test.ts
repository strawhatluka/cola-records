import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Octokit } from '@octokit/rest';
import {
  listCommentReactions,
  addCommentReaction,
  deleteCommentReaction,
  forkRepository,
  getRepository,
  getRepositoryContents,
  getUserRepositories,
  hasStarred,
  starRepository,
  unstarRepository,
  createRepository,
  getRateLimit,
  listWorkflowRuns,
  listWorkflowRunJobs,
  getJobLogs,
  listReleases,
  getRelease,
  createRelease,
  updateRelease,
  deleteRelease,
  searchIssuesAndPullRequests,
  listUserEvents,
  listSubIssues,
  getParentIssue,
  createSubIssue,
  addExistingSubIssue,
} from '../../../../src/main/services/github/github-extras.service';

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function createMockClient() {
  return {
    reactions: {
      listForIssueComment: vi.fn(),
      createForIssueComment: vi.fn(),
      deleteForIssueComment: vi.fn(),
    },
    repos: {
      createFork: vi.fn(),
      get: vi.fn(),
      getContent: vi.fn(),
      listForUser: vi.fn(),
      listForAuthenticatedUser: vi.fn(),
      createForAuthenticatedUser: vi.fn(),
    },
    activity: {
      checkRepoIsStarredByAuthenticatedUser: vi.fn(),
      starRepoForAuthenticatedUser: vi.fn(),
      unstarRepoForAuthenticatedUser: vi.fn(),
      listEventsForAuthenticatedUser: vi.fn(),
    },
    rateLimit: {
      get: vi.fn(),
    },
    rest: {
      actions: {
        listWorkflowRunsForRepo: vi.fn(),
        listJobsForWorkflowRun: vi.fn(),
        downloadJobLogsForWorkflowRun: vi.fn(),
      },
      repos: {
        listReleases: vi.fn(),
        getRelease: vi.fn(),
        createRelease: vi.fn(),
        updateRelease: vi.fn(),
        deleteRelease: vi.fn(),
      },
    },
    search: {
      issuesAndPullRequests: vi.fn(),
    },
    issues: {
      create: vi.fn(),
    },
    request: vi.fn(),
  } as unknown as Octokit;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Type-safe accessor for mock methods on the mock client. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mock(client: Octokit): any {
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('github-extras.service', () => {
  let client: Octokit;

  beforeEach(() => {
    client = createMockClient();
  });

  // ─── Comment Reactions ──────────────────────────────────────────

  describe('Comment Reactions', () => {
    describe('listCommentReactions', () => {
      it('should map reactions with user login', async () => {
        mock(client).reactions.listForIssueComment.mockResolvedValue({
          data: [
            { id: 1, content: '+1', user: { login: 'alice' } },
            { id: 2, content: 'heart', user: { login: 'bob' } },
          ],
        });

        const result = await listCommentReactions(client, 'owner', 'repo', 42);

        expect(result).toEqual([
          { id: 1, content: '+1', user: 'alice' },
          { id: 2, content: 'heart', user: 'bob' },
        ]);
        expect(mock(client).reactions.listForIssueComment).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          comment_id: 42,
          per_page: 100,
        });
      });

      it('should fallback user to unknown when user is null', async () => {
        mock(client).reactions.listForIssueComment.mockResolvedValue({
          data: [{ id: 1, content: 'laugh', user: null }],
        });

        const result = await listCommentReactions(client, 'owner', 'repo', 1);

        expect(result[0].user).toBe('unknown');
      });

      it('should fallback user to unknown when user.login is undefined', async () => {
        mock(client).reactions.listForIssueComment.mockResolvedValue({
          data: [{ id: 1, content: 'eyes', user: { login: undefined } }],
        });

        const result = await listCommentReactions(client, 'owner', 'repo', 1);

        expect(result[0].user).toBe('unknown');
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).reactions.listForIssueComment.mockRejectedValue(new Error('API down'));

        await expect(listCommentReactions(client, 'owner', 'repo', 99)).rejects.toThrow(
          'Failed to list reactions for comment 99'
        );
      });
    });

    describe('addCommentReaction', () => {
      it('should add reaction and return mapped result', async () => {
        mock(client).reactions.createForIssueComment.mockResolvedValue({
          data: { id: 10, content: 'rocket', user: { login: 'alice' } },
        });

        const result = await addCommentReaction(client, 'owner', 'repo', 5, 'rocket');

        expect(result).toEqual({ id: 10, content: 'rocket', user: 'alice' });
        expect(mock(client).reactions.createForIssueComment).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          comment_id: 5,
          content: 'rocket',
        });
      });

      it('should fallback user to unknown when user is null', async () => {
        mock(client).reactions.createForIssueComment.mockResolvedValue({
          data: { id: 10, content: '+1', user: null },
        });

        const result = await addCommentReaction(client, 'owner', 'repo', 5, '+1');

        expect(result.user).toBe('unknown');
      });

      it('should fallback user to unknown when user.login is undefined', async () => {
        mock(client).reactions.createForIssueComment.mockResolvedValue({
          data: { id: 10, content: '+1', user: { login: undefined } },
        });

        const result = await addCommentReaction(client, 'owner', 'repo', 5, '+1');

        expect(result.user).toBe('unknown');
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).reactions.createForIssueComment.mockRejectedValue(new Error('forbidden'));

        await expect(addCommentReaction(client, 'owner', 'repo', 7, '+1')).rejects.toThrow(
          'Failed to add reaction to comment 7'
        );
      });
    });

    describe('deleteCommentReaction', () => {
      it('should delete the reaction successfully', async () => {
        mock(client).reactions.deleteForIssueComment.mockResolvedValue({});

        await expect(
          deleteCommentReaction(client, 'owner', 'repo', 5, 99)
        ).resolves.toBeUndefined();
        expect(mock(client).reactions.deleteForIssueComment).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          comment_id: 5,
          reaction_id: 99,
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).reactions.deleteForIssueComment.mockRejectedValue(new Error('not found'));

        await expect(deleteCommentReaction(client, 'owner', 'repo', 5, 99)).rejects.toThrow(
          'Failed to delete reaction from comment 5'
        );
      });
    });
  });

  // ─── Repository Operations ─────────────────────────────────────

  describe('Repository Operations', () => {
    describe('forkRepository', () => {
      it('should return mapped GitHubRepository on success', async () => {
        mock(client).repos.createFork.mockResolvedValue({
          data: {
            id: 100,
            name: 'my-fork',
            full_name: 'alice/my-fork',
            description: 'A forked repo',
            clone_url: 'https://github.com/alice/my-fork.git',
            language: 'TypeScript',
            stargazers_count: 5,
            forks_count: 2,
          },
        });

        const result = await forkRepository(client, 'owner', 'repo');

        expect(result).toEqual({
          id: '100',
          name: 'my-fork',
          fullName: 'alice/my-fork',
          description: 'A forked repo',
          url: 'https://github.com/alice/my-fork.git',
          language: 'TypeScript',
          stars: 5,
          forks: 2,
        });
      });

      it('should fallback description to empty string and language to Unknown', async () => {
        mock(client).repos.createFork.mockResolvedValue({
          data: {
            id: 101,
            name: 'fork',
            full_name: 'alice/fork',
            description: null,
            clone_url: 'https://github.com/alice/fork.git',
            language: null,
            stargazers_count: 0,
            forks_count: 0,
          },
        });

        const result = await forkRepository(client, 'owner', 'repo');

        expect(result.description).toBe('');
        expect(result.language).toBe('Unknown');
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).repos.createFork.mockRejectedValue(new Error('rate limited'));

        await expect(forkRepository(client, 'owner', 'repo')).rejects.toThrow(
          'Failed to fork owner/repo'
        );
      });
    });

    describe('getRepository', () => {
      it('should return repository data with parent when present', async () => {
        mock(client).repos.get.mockResolvedValue({
          data: {
            id: 200,
            name: 'repo',
            full_name: 'owner/repo',
            description: 'Desc',
            html_url: 'https://github.com/owner/repo',
            clone_url: 'https://github.com/owner/repo.git',
            language: 'JavaScript',
            stargazers_count: 10,
            forks_count: 3,
            fork: true,
            parent: {
              id: 100,
              name: 'upstream',
              full_name: 'upstream-owner/upstream',
              html_url: 'https://github.com/upstream-owner/upstream',
            },
          },
        });

        const result = await getRepository(client, 'owner', 'repo');

        expect(result.parent).toEqual({
          id: '100',
          name: 'upstream',
          full_name: 'upstream-owner/upstream',
          url: 'https://github.com/upstream-owner/upstream',
        });
        expect(result.fork).toBe(true);
      });

      it('should return repository data without parent when absent', async () => {
        mock(client).repos.get.mockResolvedValue({
          data: {
            id: 200,
            name: 'repo',
            full_name: 'owner/repo',
            description: 'Desc',
            html_url: 'https://github.com/owner/repo',
            clone_url: 'https://github.com/owner/repo.git',
            language: 'Python',
            stargazers_count: 5,
            forks_count: 1,
            fork: false,
            parent: undefined,
          },
        });

        const result = await getRepository(client, 'owner', 'repo');

        expect(result.parent).toBeUndefined();
        expect(result.fork).toBe(false);
      });

      it('should fallback description and language', async () => {
        mock(client).repos.get.mockResolvedValue({
          data: {
            id: 200,
            name: 'repo',
            full_name: 'owner/repo',
            description: null,
            html_url: 'https://github.com/owner/repo',
            clone_url: 'https://github.com/owner/repo.git',
            language: null,
            stargazers_count: 0,
            forks_count: 0,
            fork: false,
            parent: null,
          },
        });

        const result = await getRepository(client, 'owner', 'repo');

        expect(result.description).toBe('');
        expect(result.language).toBe('Unknown');
        expect(result.parent).toBeUndefined();
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).repos.get.mockRejectedValue(new Error('not found'));

        await expect(getRepository(client, 'owner', 'repo')).rejects.toThrow(
          'Failed to get repository owner/repo'
        );
      });
    });

    describe('getRepositoryContents', () => {
      it('should return mapped items when response is an array', async () => {
        mock(client).repos.getContent.mockResolvedValue({
          data: [
            {
              name: 'README.md',
              path: 'README.md',
              type: 'file',
              size: 1024,
              html_url: 'https://github.com/owner/repo/blob/main/README.md',
            },
            {
              name: 'src',
              path: 'src',
              type: 'dir',
              size: 0,
              html_url: 'https://github.com/owner/repo/tree/main/src',
            },
          ],
        });

        const result = await getRepositoryContents(client, 'owner', 'repo', '');

        expect(result).toEqual([
          {
            name: 'README.md',
            path: 'README.md',
            type: 'file',
            size: 1024,
            url: 'https://github.com/owner/repo/blob/main/README.md',
          },
          {
            name: 'src',
            path: 'src',
            type: 'dir',
            size: 0,
            url: 'https://github.com/owner/repo/tree/main/src',
          },
        ]);
      });

      it('should return empty array when response is not an array (single file)', async () => {
        mock(client).repos.getContent.mockResolvedValue({
          data: {
            name: 'single-file.txt',
            path: 'single-file.txt',
            type: 'file',
            size: 512,
            content: 'base64content',
          },
        });

        const result = await getRepositoryContents(client, 'owner', 'repo', 'single-file.txt');

        expect(result).toEqual([]);
      });

      it('should use empty string as default filePath', async () => {
        mock(client).repos.getContent.mockResolvedValue({ data: [] });

        await getRepositoryContents(client, 'owner', 'repo');

        expect(mock(client).repos.getContent).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          path: '',
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).repos.getContent.mockRejectedValue(new Error('forbidden'));

        await expect(getRepositoryContents(client, 'owner', 'repo', 'secret')).rejects.toThrow(
          'Failed to get contents of owner/repo/secret'
        );
      });
    });

    describe('getUserRepositories', () => {
      it('should call listForUser when username is provided', async () => {
        mock(client).repos.listForUser.mockResolvedValue({
          data: [
            {
              id: 1,
              name: 'repo1',
              full_name: 'alice/repo1',
              description: 'Desc',
              html_url: 'https://github.com/alice/repo1',
              clone_url: 'https://github.com/alice/repo1.git',
              language: 'Go',
              stargazers_count: 10,
              forks_count: 2,
              private: false,
            },
          ],
        });

        const result = await getUserRepositories(client, 'alice');

        expect(mock(client).repos.listForUser).toHaveBeenCalledWith({
          username: 'alice',
          per_page: 100,
        });
        expect(mock(client).repos.listForAuthenticatedUser).not.toHaveBeenCalled();
        expect(result[0]).toEqual({
          id: '1',
          name: 'repo1',
          fullName: 'alice/repo1',
          description: 'Desc',
          url: 'https://github.com/alice/repo1',
          cloneUrl: 'https://github.com/alice/repo1.git',
          language: 'Go',
          stars: 10,
          forks: 2,
          private: false,
        });
      });

      it('should call listForAuthenticatedUser when username is undefined', async () => {
        mock(client).repos.listForAuthenticatedUser.mockResolvedValue({
          data: [
            {
              id: 2,
              name: 'myrepo',
              full_name: 'me/myrepo',
              description: null,
              html_url: 'https://github.com/me/myrepo',
              clone_url: null,
              language: null,
              stargazers_count: null,
              forks_count: null,
              private: true,
            },
          ],
        });

        const result = await getUserRepositories(client);

        expect(mock(client).repos.listForAuthenticatedUser).toHaveBeenCalledWith({
          per_page: 100,
        });
        expect(mock(client).repos.listForUser).not.toHaveBeenCalled();
        expect(result[0].description).toBe('');
        expect(result[0].cloneUrl).toBe('');
        expect(result[0].language).toBe('Unknown');
        expect(result[0].stars).toBe(0);
        expect(result[0].forks).toBe(0);
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).repos.listForAuthenticatedUser.mockRejectedValue(new Error('auth error'));

        await expect(getUserRepositories(client)).rejects.toThrow('Failed to get repositories');
      });
    });

    describe('hasStarred', () => {
      it('should return true when repo is starred (resolves)', async () => {
        mock(client).activity.checkRepoIsStarredByAuthenticatedUser.mockResolvedValue({});

        const result = await hasStarred(client, 'owner', 'repo');

        expect(result).toBe(true);
      });

      it('should return false when error has status 404', async () => {
        mock(client).activity.checkRepoIsStarredByAuthenticatedUser.mockRejectedValue({
          status: 404,
          message: 'Not Found',
        });

        const result = await hasStarred(client, 'owner', 'repo');

        expect(result).toBe(false);
      });

      it('should re-throw when error has non-404 status', async () => {
        const error = { status: 500, message: 'Server error' };
        mock(client).activity.checkRepoIsStarredByAuthenticatedUser.mockRejectedValue(error);

        await expect(hasStarred(client, 'owner', 'repo')).rejects.toBe(error);
      });

      it('should re-throw when error has no status property', async () => {
        const error = new Error('Network error');
        mock(client).activity.checkRepoIsStarredByAuthenticatedUser.mockRejectedValue(error);

        await expect(hasStarred(client, 'owner', 'repo')).rejects.toBe(error);
      });

      it('should re-throw when error is null', async () => {
        mock(client).activity.checkRepoIsStarredByAuthenticatedUser.mockRejectedValue(null);

        await expect(hasStarred(client, 'owner', 'repo')).rejects.toBeNull();
      });
    });

    describe('starRepository', () => {
      it('should star the repository successfully', async () => {
        mock(client).activity.starRepoForAuthenticatedUser.mockResolvedValue({});

        await expect(starRepository(client, 'owner', 'repo')).resolves.toBeUndefined();
        expect(mock(client).activity.starRepoForAuthenticatedUser).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).activity.starRepoForAuthenticatedUser.mockRejectedValue(new Error('fail'));

        await expect(starRepository(client, 'owner', 'repo')).rejects.toThrow(
          'Failed to star owner/repo'
        );
      });
    });

    describe('unstarRepository', () => {
      it('should unstar the repository successfully', async () => {
        mock(client).activity.unstarRepoForAuthenticatedUser.mockResolvedValue({});

        await expect(unstarRepository(client, 'owner', 'repo')).resolves.toBeUndefined();
        expect(mock(client).activity.unstarRepoForAuthenticatedUser).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).activity.unstarRepoForAuthenticatedUser.mockRejectedValue(new Error('x'));

        await expect(unstarRepository(client, 'owner', 'repo')).rejects.toThrow(
          'Failed to unstar owner/repo'
        );
      });
    });

    describe('createRepository', () => {
      it('should create repo with all options provided', async () => {
        mock(client).repos.createForAuthenticatedUser.mockResolvedValue({
          data: {
            id: 300,
            name: 'new-repo',
            full_name: 'me/new-repo',
            description: 'My new repo',
            clone_url: 'https://github.com/me/new-repo.git',
            html_url: 'https://github.com/me/new-repo',
            language: 'Rust',
            stargazers_count: 0,
            forks_count: 0,
          },
        });

        const result = await createRepository(client, 'new-repo', {
          description: 'My new repo',
          isPrivate: true,
          autoInit: true,
        });

        expect(mock(client).repos.createForAuthenticatedUser).toHaveBeenCalledWith({
          name: 'new-repo',
          description: 'My new repo',
          private: true,
          auto_init: true,
        });
        expect(result).toEqual({
          id: '300',
          name: 'new-repo',
          fullName: 'me/new-repo',
          description: 'My new repo',
          url: 'https://github.com/me/new-repo.git',
          language: 'Rust',
          stars: 0,
          forks: 0,
        });
      });

      it('should use defaults for isPrivate and autoInit', async () => {
        mock(client).repos.createForAuthenticatedUser.mockResolvedValue({
          data: {
            id: 301,
            name: 'repo',
            full_name: 'me/repo',
            description: null,
            clone_url: null,
            html_url: 'https://github.com/me/repo',
            language: null,
            stargazers_count: 0,
            forks_count: 0,
          },
        });

        const result = await createRepository(client, 'repo', {});

        expect(mock(client).repos.createForAuthenticatedUser).toHaveBeenCalledWith({
          name: 'repo',
          description: '',
          private: false,
          auto_init: false,
        });
        expect(result.description).toBe('');
        expect(result.url).toBe('https://github.com/me/repo');
        expect(result.language).toBe('Unknown');
      });

      it('should fallback url to html_url when clone_url is empty string', async () => {
        mock(client).repos.createForAuthenticatedUser.mockResolvedValue({
          data: {
            id: 302,
            name: 'r',
            full_name: 'me/r',
            description: '',
            clone_url: '',
            html_url: 'https://github.com/me/r',
            language: 'Go',
            stargazers_count: 0,
            forks_count: 0,
          },
        });

        const result = await createRepository(client, 'r', {});

        expect(result.url).toBe('https://github.com/me/r');
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).repos.createForAuthenticatedUser.mockRejectedValue(new Error('exists'));

        await expect(createRepository(client, 'dup', {})).rejects.toThrow(
          'Failed to create repository dup'
        );
      });
    });
  });

  // ─── Rate Limit ────────────────────────────────────────────────

  describe('Rate Limit', () => {
    describe('getRateLimit', () => {
      it('should return rate limit with Date for reset', async () => {
        mock(client).rateLimit.get.mockResolvedValue({
          data: {
            rate: {
              limit: 5000,
              remaining: 4999,
              reset: 1700000000,
            },
          },
        });

        const result = await getRateLimit(client);

        expect(result.limit).toBe(5000);
        expect(result.remaining).toBe(4999);
        expect(result.reset).toEqual(new Date(1700000000 * 1000));
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rateLimit.get.mockRejectedValue(new Error('down'));

        await expect(getRateLimit(client)).rejects.toThrow('Failed to get rate limit');
      });
    });
  });

  // ─── GitHub Actions ────────────────────────────────────────────

  describe('GitHub Actions', () => {
    describe('listWorkflowRuns', () => {
      it('should map workflow runs with all fields present', async () => {
        mock(client).rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
          data: {
            workflow_runs: [
              {
                id: 1,
                name: 'CI',
                display_title: 'Build CI',
                status: 'completed',
                conclusion: 'success',
                head_branch: 'main',
                head_sha: 'abc123',
                event: 'push',
                run_number: 42,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:05:00Z',
                html_url: 'https://github.com/owner/repo/actions/runs/1',
                actor: { login: 'alice', avatar_url: 'https://avatars.com/alice' },
              },
            ],
          },
        });

        const result = await listWorkflowRuns(client, 'owner', 'repo');

        expect(result).toEqual([
          {
            id: 1,
            name: 'CI',
            displayTitle: 'Build CI',
            status: 'completed',
            conclusion: 'success',
            headBranch: 'main',
            headSha: 'abc123',
            event: 'push',
            runNumber: 42,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:05:00Z',
            htmlUrl: 'https://github.com/owner/repo/actions/runs/1',
            actor: 'alice',
            actorAvatarUrl: 'https://avatars.com/alice',
          },
        ]);
      });

      it('should apply fallbacks when fields are null/undefined', async () => {
        mock(client).rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
          data: {
            workflow_runs: [
              {
                id: 2,
                name: null,
                display_title: null,
                status: null,
                conclusion: null,
                head_branch: null,
                head_sha: null,
                event: null,
                run_number: 1,
                created_at: '',
                updated_at: '',
                html_url: '',
                actor: null,
              },
            ],
          },
        });

        const result = await listWorkflowRuns(client, 'owner', 'repo');

        expect(result[0].name).toBe('');
        expect(result[0].displayTitle).toBe('');
        expect(result[0].status).toBe('');
        expect(result[0].conclusion).toBeNull();
        expect(result[0].headBranch).toBe('');
        expect(result[0].headSha).toBe('');
        expect(result[0].event).toBe('');
        expect(result[0].actor).toBe('unknown');
        expect(result[0].actorAvatarUrl).toBe('');
      });

      it('should use name as displayTitle fallback when display_title is null', async () => {
        mock(client).rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
          data: {
            workflow_runs: [
              {
                id: 3,
                name: 'CD Pipeline',
                display_title: null,
                status: 'queued',
                conclusion: null,
                head_branch: 'dev',
                head_sha: 'def456',
                event: 'pull_request',
                run_number: 10,
                created_at: '',
                updated_at: '',
                html_url: '',
                actor: { login: 'bot', avatar_url: '' },
              },
            ],
          },
        });

        const result = await listWorkflowRuns(client, 'owner', 'repo');

        expect(result[0].displayTitle).toBe('CD Pipeline');
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.actions.listWorkflowRunsForRepo.mockRejectedValue(new Error('fail'));

        await expect(listWorkflowRuns(client, 'owner', 'repo')).rejects.toThrow(
          'Failed to list workflow runs for owner/repo'
        );
      });
    });

    describe('listWorkflowRunJobs', () => {
      it('should map jobs and steps with all fields present', async () => {
        mock(client).rest.actions.listJobsForWorkflowRun.mockResolvedValue({
          data: {
            jobs: [
              {
                id: 10,
                name: 'build',
                status: 'completed',
                conclusion: 'success',
                started_at: '2024-01-01T00:00:00Z',
                completed_at: '2024-01-01T00:05:00Z',
                html_url: 'https://github.com/owner/repo/actions/runs/1/jobs/10',
                runner_name: 'ubuntu-latest',
                labels: ['self-hosted'],
                steps: [
                  {
                    name: 'Checkout',
                    status: 'completed',
                    conclusion: 'success',
                    number: 1,
                  },
                ],
              },
            ],
          },
        });

        const result = await listWorkflowRunJobs(client, 'owner', 'repo', 1);

        expect(result).toEqual([
          {
            id: 10,
            name: 'build',
            status: 'completed',
            conclusion: 'success',
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:05:00Z',
            htmlUrl: 'https://github.com/owner/repo/actions/runs/1/jobs/10',
            runnerName: 'ubuntu-latest',
            labels: ['self-hosted'],
            steps: [
              {
                name: 'Checkout',
                status: 'completed',
                conclusion: 'success',
                number: 1,
              },
            ],
          },
        ]);
      });

      it('should apply fallbacks when fields are null/undefined', async () => {
        mock(client).rest.actions.listJobsForWorkflowRun.mockResolvedValue({
          data: {
            jobs: [
              {
                id: 11,
                name: null,
                status: null,
                conclusion: null,
                started_at: null,
                completed_at: null,
                html_url: null,
                runner_name: null,
                labels: null,
                steps: null,
              },
            ],
          },
        });

        const result = await listWorkflowRunJobs(client, 'owner', 'repo', 1);

        expect(result[0].name).toBe('');
        expect(result[0].status).toBe('');
        expect(result[0].conclusion).toBeNull();
        expect(result[0].startedAt).toBeNull();
        expect(result[0].completedAt).toBeNull();
        expect(result[0].htmlUrl).toBe('');
        expect(result[0].runnerName).toBeNull();
        expect(result[0].labels).toEqual([]);
        expect(result[0].steps).toEqual([]);
      });

      it('should apply fallbacks to step fields', async () => {
        mock(client).rest.actions.listJobsForWorkflowRun.mockResolvedValue({
          data: {
            jobs: [
              {
                id: 12,
                name: 'test',
                status: 'in_progress',
                conclusion: null,
                started_at: '2024-01-01T00:00:00Z',
                completed_at: null,
                html_url: '',
                runner_name: null,
                labels: [],
                steps: [
                  {
                    name: null,
                    status: null,
                    conclusion: null,
                    number: 1,
                  },
                ],
              },
            ],
          },
        });

        const result = await listWorkflowRunJobs(client, 'owner', 'repo', 1);

        expect(result[0].steps[0].name).toBe('');
        expect(result[0].steps[0].status).toBe('');
        expect(result[0].steps[0].conclusion).toBeNull();
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.actions.listJobsForWorkflowRun.mockRejectedValue(new Error('err'));

        await expect(listWorkflowRunJobs(client, 'owner', 'repo', 99)).rejects.toThrow(
          'Failed to list jobs for workflow run owner/repo#99'
        );
      });
    });

    describe('getJobLogs', () => {
      it('should return string data directly', async () => {
        mock(client).rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
          data: 'log line 1\nlog line 2',
        });

        const result = await getJobLogs(client, 'owner', 'repo', 5);

        expect(result).toBe('log line 1\nlog line 2');
      });

      it('should convert non-string data to string', async () => {
        mock(client).rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
          data: 12345,
        });

        const result = await getJobLogs(client, 'owner', 'repo', 5);

        expect(result).toBe('12345');
      });

      it('should handle Buffer-like data by converting to string', async () => {
        mock(client).rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
          data: { type: 'Buffer', data: [104, 105] },
        });

        const result = await getJobLogs(client, 'owner', 'repo', 5);

        expect(typeof result).toBe('string');
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.actions.downloadJobLogsForWorkflowRun.mockRejectedValue(
          new Error('not found')
        );

        await expect(getJobLogs(client, 'owner', 'repo', 5)).rejects.toThrow(
          'Failed to get job logs for owner/repo job 5'
        );
      });
    });
  });

  // ─── Releases ──────────────────────────────────────────────────

  describe('Releases', () => {
    describe('listReleases', () => {
      it('should mark first non-draft non-prerelease as isLatest', async () => {
        mock(client).rest.repos.listReleases.mockResolvedValue({
          data: [
            {
              id: 1,
              tag_name: 'v2.0.0-beta',
              name: 'Beta',
              body: 'pre',
              draft: false,
              prerelease: true,
              created_at: '2024-02-01T00:00:00Z',
              published_at: '2024-02-01T00:00:00Z',
              html_url: 'https://github.com/owner/repo/releases/1',
              author: { login: 'alice', avatar_url: 'https://avatars.com/alice' },
            },
            {
              id: 2,
              tag_name: 'v1.0.0',
              name: 'Stable',
              body: 'stable release',
              draft: false,
              prerelease: false,
              created_at: '2024-01-01T00:00:00Z',
              published_at: '2024-01-01T00:00:00Z',
              html_url: 'https://github.com/owner/repo/releases/2',
              author: { login: 'bob', avatar_url: 'https://avatars.com/bob' },
            },
            {
              id: 3,
              tag_name: 'v0.9.0',
              name: 'Older',
              body: 'old',
              draft: false,
              prerelease: false,
              created_at: '2023-12-01T00:00:00Z',
              published_at: '2023-12-01T00:00:00Z',
              html_url: 'https://github.com/owner/repo/releases/3',
              author: { login: 'charlie', avatar_url: 'https://avatars.com/charlie' },
            },
          ],
        });

        const result = await listReleases(client, 'owner', 'repo');

        expect(result[0].isLatest).toBe(false); // prerelease
        expect(result[1].isLatest).toBe(true); // first stable
        expect(result[2].isLatest).toBe(false); // second stable, not latest
      });

      it('should set all isLatest to false when only drafts and prereleases exist', async () => {
        mock(client).rest.repos.listReleases.mockResolvedValue({
          data: [
            {
              id: 1,
              tag_name: 'v1.0.0-draft',
              name: 'Draft',
              body: '',
              draft: true,
              prerelease: false,
              created_at: '2024-01-01T00:00:00Z',
              published_at: null,
              html_url: 'https://github.com/owner/repo/releases/1',
              author: { login: 'alice', avatar_url: '' },
            },
            {
              id: 2,
              tag_name: 'v0.9.0-rc',
              name: 'RC',
              body: '',
              draft: false,
              prerelease: true,
              created_at: '2024-01-01T00:00:00Z',
              published_at: '2024-01-01T00:00:00Z',
              html_url: 'https://github.com/owner/repo/releases/2',
              author: null,
            },
          ],
        });

        const result = await listReleases(client, 'owner', 'repo');

        expect(result[0].isLatest).toBe(false);
        expect(result[1].isLatest).toBe(false);
      });

      it('should apply fallbacks when fields are null/undefined', async () => {
        mock(client).rest.repos.listReleases.mockResolvedValue({
          data: [
            {
              id: 10,
              tag_name: null,
              name: null,
              body: null,
              draft: null,
              prerelease: null,
              created_at: '2024-01-01T00:00:00Z',
              published_at: null,
              html_url: 'https://github.com/owner/repo/releases/10',
              author: null,
            },
          ],
        });

        const result = await listReleases(client, 'owner', 'repo');

        expect(result[0].tagName).toBe('');
        expect(result[0].name).toBe('');
        expect(result[0].body).toBe('');
        expect(result[0].draft).toBe(false);
        expect(result[0].prerelease).toBe(false);
        expect(result[0].publishedAt).toBeNull();
        expect(result[0].author).toBe('unknown');
        expect(result[0].authorAvatarUrl).toBe('');
        // draft=false, prerelease=false after fallback, so isLatest = true (first non-draft, non-pre)
        expect(result[0].isLatest).toBe(true);
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.repos.listReleases.mockRejectedValue(new Error('fail'));

        await expect(listReleases(client, 'owner', 'repo')).rejects.toThrow(
          'Failed to list releases for owner/repo'
        );
      });
    });

    describe('getRelease', () => {
      it('should return mapped release with isLatest true for non-draft non-prerelease', async () => {
        mock(client).rest.repos.getRelease.mockResolvedValue({
          data: {
            id: 1,
            tag_name: 'v1.0.0',
            name: 'Release 1',
            body: 'Notes',
            draft: false,
            prerelease: false,
            created_at: '2024-01-01T00:00:00Z',
            published_at: '2024-01-01T00:00:00Z',
            html_url: 'https://github.com/owner/repo/releases/1',
            author: { login: 'alice', avatar_url: 'https://avatars.com/alice' },
            target_commitish: 'main',
          },
        });

        const result = await getRelease(client, 'owner', 'repo', 1);

        expect(result.isLatest).toBe(true);
        expect(result.targetCommitish).toBe('main');
        expect(result.author).toBe('alice');
      });

      it('should return isLatest false for draft release', async () => {
        mock(client).rest.repos.getRelease.mockResolvedValue({
          data: {
            id: 2,
            tag_name: 'v2.0.0',
            name: 'Draft',
            body: '',
            draft: true,
            prerelease: false,
            created_at: '2024-01-01T00:00:00Z',
            published_at: null,
            html_url: '',
            author: null,
            target_commitish: null,
          },
        });

        const result = await getRelease(client, 'owner', 'repo', 2);

        expect(result.isLatest).toBe(false);
        expect(result.author).toBe('unknown');
        expect(result.authorAvatarUrl).toBe('');
        expect(result.targetCommitish).toBe('');
        expect(result.publishedAt).toBeNull();
      });

      it('should return isLatest false for prerelease', async () => {
        mock(client).rest.repos.getRelease.mockResolvedValue({
          data: {
            id: 3,
            tag_name: 'v3.0.0-rc1',
            name: 'RC',
            body: 'pre',
            draft: false,
            prerelease: true,
            created_at: '2024-01-01T00:00:00Z',
            published_at: '2024-01-01T00:00:00Z',
            html_url: '',
            author: { login: 'bob', avatar_url: '' },
            target_commitish: 'dev',
          },
        });

        const result = await getRelease(client, 'owner', 'repo', 3);

        expect(result.isLatest).toBe(false);
      });

      it('should apply fallbacks for null fields', async () => {
        mock(client).rest.repos.getRelease.mockResolvedValue({
          data: {
            id: 4,
            tag_name: null,
            name: null,
            body: null,
            draft: null,
            prerelease: null,
            created_at: '',
            published_at: null,
            html_url: '',
            author: null,
            target_commitish: null,
          },
        });

        const result = await getRelease(client, 'owner', 'repo', 4);

        expect(result.tagName).toBe('');
        expect(result.name).toBe('');
        expect(result.body).toBe('');
        expect(result.draft).toBe(false);
        expect(result.prerelease).toBe(false);
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.repos.getRelease.mockRejectedValue(new Error('nope'));

        await expect(getRelease(client, 'owner', 'repo', 99)).rejects.toThrow(
          'Failed to get release 99 for owner/repo'
        );
      });
    });

    describe('createRelease', () => {
      it('should create release with targetCommitish', async () => {
        mock(client).rest.repos.createRelease.mockResolvedValue({
          data: {
            id: 50,
            tag_name: 'v1.0.0',
            name: 'Release 1',
            body: 'Notes',
            draft: false,
            prerelease: false,
            html_url: 'https://github.com/owner/repo/releases/50',
          },
        });

        const result = await createRelease(client, 'owner', 'repo', {
          tagName: 'v1.0.0',
          name: 'Release 1',
          body: 'Notes',
          draft: false,
          prerelease: false,
          makeLatest: 'true',
          targetCommitish: 'main',
        });

        expect(mock(client).rest.repos.createRelease).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          tag_name: 'v1.0.0',
          name: 'Release 1',
          body: 'Notes',
          draft: false,
          prerelease: false,
          make_latest: 'true',
          target_commitish: 'main',
        });
        expect(result).toEqual({
          id: 50,
          tagName: 'v1.0.0',
          name: 'Release 1',
          body: 'Notes',
          draft: false,
          prerelease: false,
          htmlUrl: 'https://github.com/owner/repo/releases/50',
        });
      });

      it('should create release without targetCommitish when not provided', async () => {
        mock(client).rest.repos.createRelease.mockResolvedValue({
          data: {
            id: 51,
            tag_name: 'v2.0.0',
            name: 'R2',
            body: '',
            draft: false,
            prerelease: false,
            html_url: '',
          },
        });

        await createRelease(client, 'owner', 'repo', {
          tagName: 'v2.0.0',
          name: 'R2',
          body: '',
          draft: false,
          prerelease: false,
          makeLatest: 'false',
        });

        expect(mock(client).rest.repos.createRelease).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          tag_name: 'v2.0.0',
          name: 'R2',
          body: '',
          draft: false,
          prerelease: false,
          make_latest: 'false',
        });
      });

      it('should apply fallbacks for null fields in response', async () => {
        mock(client).rest.repos.createRelease.mockResolvedValue({
          data: {
            id: 52,
            tag_name: null,
            name: null,
            body: null,
            draft: null,
            prerelease: null,
            html_url: '',
          },
        });

        const result = await createRelease(client, 'owner', 'repo', {
          tagName: 'v3.0.0',
          name: '',
          body: '',
          draft: false,
          prerelease: false,
          makeLatest: 'legacy',
        });

        expect(result.tagName).toBe('');
        expect(result.name).toBe('');
        expect(result.body).toBe('');
        expect(result.draft).toBe(false);
        expect(result.prerelease).toBe(false);
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.repos.createRelease.mockRejectedValue(new Error('tag exists'));

        await expect(
          createRelease(client, 'owner', 'repo', {
            tagName: 'v1.0.0',
            name: 'x',
            body: 'x',
            draft: false,
            prerelease: false,
            makeLatest: 'true',
          })
        ).rejects.toThrow('Failed to create release for owner/repo');
      });
    });

    describe('updateRelease', () => {
      it('should include only defined fields in the API call', async () => {
        mock(client).rest.repos.updateRelease.mockResolvedValue({
          data: {
            id: 60,
            tag_name: 'v1.1.0',
            name: 'Updated',
            body: 'new body',
            draft: false,
            prerelease: false,
            html_url: '',
          },
        });

        await updateRelease(client, 'owner', 'repo', 60, {
          tagName: 'v1.1.0',
          body: 'new body',
        });

        expect(mock(client).rest.repos.updateRelease).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          release_id: 60,
          tag_name: 'v1.1.0',
          body: 'new body',
        });
      });

      it('should include all fields when all are defined', async () => {
        mock(client).rest.repos.updateRelease.mockResolvedValue({
          data: {
            id: 61,
            tag_name: 'v2.0.0',
            name: 'Full',
            body: 'full',
            draft: true,
            prerelease: true,
            html_url: '',
          },
        });

        await updateRelease(client, 'owner', 'repo', 61, {
          tagName: 'v2.0.0',
          name: 'Full',
          body: 'full',
          draft: true,
          prerelease: true,
          makeLatest: 'false',
        });

        expect(mock(client).rest.repos.updateRelease).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          release_id: 61,
          tag_name: 'v2.0.0',
          name: 'Full',
          body: 'full',
          draft: true,
          prerelease: true,
          make_latest: 'false',
        });
      });

      it('should send no optional fields when data is empty', async () => {
        mock(client).rest.repos.updateRelease.mockResolvedValue({
          data: {
            id: 62,
            tag_name: 'v1.0.0',
            name: 'Same',
            body: 'same',
            draft: false,
            prerelease: false,
            html_url: '',
          },
        });

        await updateRelease(client, 'owner', 'repo', 62, {});

        expect(mock(client).rest.repos.updateRelease).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          release_id: 62,
        });
      });

      it('should apply fallbacks for null response fields', async () => {
        mock(client).rest.repos.updateRelease.mockResolvedValue({
          data: {
            id: 63,
            tag_name: null,
            name: null,
            body: null,
            draft: null,
            prerelease: null,
            html_url: '',
          },
        });

        const result = await updateRelease(client, 'owner', 'repo', 63, { name: 'x' });

        expect(result.tagName).toBe('');
        expect(result.name).toBe('');
        expect(result.body).toBe('');
        expect(result.draft).toBe(false);
        expect(result.prerelease).toBe(false);
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.repos.updateRelease.mockRejectedValue(new Error('not found'));

        await expect(updateRelease(client, 'owner', 'repo', 99, {})).rejects.toThrow(
          'Failed to update release 99 for owner/repo'
        );
      });
    });

    describe('deleteRelease', () => {
      it('should delete the release successfully', async () => {
        mock(client).rest.repos.deleteRelease.mockResolvedValue({});

        await expect(deleteRelease(client, 'owner', 'repo', 1)).resolves.toBeUndefined();
        expect(mock(client).rest.repos.deleteRelease).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          release_id: 1,
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).rest.repos.deleteRelease.mockRejectedValue(new Error('nope'));

        await expect(deleteRelease(client, 'owner', 'repo', 5)).rejects.toThrow(
          'Failed to delete release 5 for owner/repo'
        );
      });
    });
  });

  // ─── Search ────────────────────────────────────────────────────

  describe('Search', () => {
    describe('searchIssuesAndPullRequests', () => {
      it('should map issues with string labels', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: {
            total_count: 1,
            items: [
              {
                id: 100,
                number: 1,
                title: 'Bug report',
                state: 'open',
                html_url: 'https://github.com/owner/repo/issues/1',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
                closed_at: null,
                labels: ['bug', 'urgent'],
                repository_url: 'https://api.github.com/repos/owner/repo',
                user: { login: 'alice' },
                pull_request: undefined,
              },
            ],
          },
        });

        const result = await searchIssuesAndPullRequests(client, 'is:issue is:open');

        expect(result.totalCount).toBe(1);
        expect(result.items[0].labels).toEqual(['bug', 'urgent']);
        expect(result.items[0].isPullRequest).toBe(false);
        expect(result.items[0].pullRequest).toBeUndefined();
        expect(result.items[0].repoFullName).toBe('owner/repo');
      });

      it('should map labels as objects with name property', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: {
            total_count: 1,
            items: [
              {
                id: 101,
                number: 2,
                title: 'Feature',
                state: 'open',
                html_url: 'https://github.com/owner/repo/issues/2',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
                closed_at: null,
                labels: [{ name: 'enhancement' }, { name: '' }, { name: 'good first issue' }],
                repository_url: 'https://api.github.com/repos/owner/repo',
                user: { login: 'bob' },
                pull_request: undefined,
              },
            ],
          },
        });

        const result = await searchIssuesAndPullRequests(client, 'is:issue');

        expect(result.items[0].labels).toEqual(['enhancement', '', 'good first issue']);
      });

      it('should handle label objects with undefined name', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: {
            total_count: 1,
            items: [
              {
                id: 102,
                number: 3,
                title: 'Test',
                state: 'open',
                html_url: '',
                created_at: '',
                updated_at: '',
                closed_at: null,
                labels: [{ name: undefined }],
                repository_url: 'https://api.github.com/repos/o/r',
                user: null,
                pull_request: undefined,
              },
            ],
          },
        });

        const result = await searchIssuesAndPullRequests(client, 'test');

        expect(result.items[0].labels).toEqual(['']);
        expect(result.items[0].author).toBe('');
      });

      it('should handle null labels array', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: {
            total_count: 1,
            items: [
              {
                id: 103,
                number: 4,
                title: 'No labels',
                state: 'open',
                html_url: '',
                created_at: '',
                updated_at: '',
                closed_at: null,
                labels: null,
                repository_url: 'https://api.github.com/repos/o/r',
                user: { login: 'charlie' },
                pull_request: undefined,
              },
            ],
          },
        });

        const result = await searchIssuesAndPullRequests(client, 'test');

        expect(result.items[0].labels).toEqual([]);
      });

      it('should map pull request items with merged_at', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: {
            total_count: 1,
            items: [
              {
                id: 200,
                number: 10,
                title: 'PR Title',
                state: 'closed',
                html_url: 'https://github.com/owner/repo/pull/10',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-03T00:00:00Z',
                closed_at: '2024-01-03T00:00:00Z',
                labels: [],
                repository_url: 'https://api.github.com/repos/owner/repo',
                user: { login: 'alice' },
                pull_request: { merged_at: '2024-01-03T00:00:00Z' },
              },
            ],
          },
        });

        const result = await searchIssuesAndPullRequests(client, 'is:pr');

        expect(result.items[0].isPullRequest).toBe(true);
        expect(result.items[0].pullRequest).toEqual({
          mergedAt: '2024-01-03T00:00:00Z',
        });
      });

      it('should handle pull_request with null merged_at', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: {
            total_count: 1,
            items: [
              {
                id: 201,
                number: 11,
                title: 'Open PR',
                state: 'open',
                html_url: '',
                created_at: '',
                updated_at: '',
                closed_at: null,
                labels: [],
                repository_url: 'https://api.github.com/repos/o/r',
                user: { login: 'bob' },
                pull_request: { merged_at: null },
              },
            ],
          },
        });

        const result = await searchIssuesAndPullRequests(client, 'is:pr is:open');

        expect(result.items[0].isPullRequest).toBe(true);
        expect(result.items[0].pullRequest).toEqual({ mergedAt: null });
      });

      it('should use custom perPage parameter', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: { total_count: 0, items: [] },
        });

        await searchIssuesAndPullRequests(client, 'query', 10);

        expect(mock(client).search.issuesAndPullRequests).toHaveBeenCalledWith({
          q: 'query',
          per_page: 10,
          sort: 'updated',
          order: 'desc',
        });
      });

      it('should use default perPage of 30', async () => {
        mock(client).search.issuesAndPullRequests.mockResolvedValue({
          data: { total_count: 0, items: [] },
        });

        await searchIssuesAndPullRequests(client, 'query');

        expect(mock(client).search.issuesAndPullRequests).toHaveBeenCalledWith({
          q: 'query',
          per_page: 30,
          sort: 'updated',
          order: 'desc',
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).search.issuesAndPullRequests.mockRejectedValue(new Error('rate limited'));

        await expect(searchIssuesAndPullRequests(client, 'q')).rejects.toThrow(
          'Failed to search issues and pull requests'
        );
      });
    });
  });

  // ─── User Events ───────────────────────────────────────────────

  describe('User Events', () => {
    describe('listUserEvents', () => {
      it('should map events with all payload fields present', async () => {
        mock(client).activity.listEventsForAuthenticatedUser.mockResolvedValue({
          data: [
            {
              id: '1',
              type: 'PushEvent',
              repo: { name: 'owner/repo' },
              created_at: '2024-01-01T00:00:00Z',
              payload: {
                action: 'completed',
                ref_type: 'branch',
                ref: 'main',
                size: 3,
                pull_request: { number: 5, title: 'PR Title' },
                issue: { number: 10, title: 'Issue Title' },
              },
            },
          ],
        });

        const result = await listUserEvents(client, 'alice');

        expect(result).toEqual([
          {
            id: '1',
            type: 'PushEvent',
            repoName: 'owner/repo',
            createdAt: '2024-01-01T00:00:00Z',
            action: 'completed',
            refType: 'branch',
            ref: 'main',
            commitCount: 3,
            prNumber: 5,
            prTitle: 'PR Title',
            issueNumber: 10,
            issueTitle: 'Issue Title',
          },
        ]);
      });

      it('should apply fallbacks when payload is undefined', async () => {
        mock(client).activity.listEventsForAuthenticatedUser.mockResolvedValue({
          data: [
            {
              id: '2',
              type: null,
              repo: null,
              created_at: null,
              payload: undefined,
            },
          ],
        });

        const result = await listUserEvents(client, 'bob');

        expect(result[0].type).toBe('');
        expect(result[0].repoName).toBe('');
        expect(result[0].createdAt).toBe('');
        expect(result[0].action).toBe('');
        expect(result[0].refType).toBe('');
        expect(result[0].ref).toBe('');
        expect(result[0].commitCount).toBe(0);
        expect(result[0].prNumber).toBeNull();
        expect(result[0].prTitle).toBe('');
        expect(result[0].issueNumber).toBeNull();
        expect(result[0].issueTitle).toBe('');
      });

      it('should apply fallbacks when payload fields are empty/undefined', async () => {
        mock(client).activity.listEventsForAuthenticatedUser.mockResolvedValue({
          data: [
            {
              id: '3',
              type: 'WatchEvent',
              repo: { name: 'owner/repo' },
              created_at: '2024-01-01T00:00:00Z',
              payload: {
                action: undefined,
                ref_type: undefined,
                ref: undefined,
                size: undefined,
                pull_request: undefined,
                issue: undefined,
              },
            },
          ],
        });

        const result = await listUserEvents(client, 'charlie');

        expect(result[0].action).toBe('');
        expect(result[0].refType).toBe('');
        expect(result[0].ref).toBe('');
        expect(result[0].commitCount).toBe(0);
        expect(result[0].prNumber).toBeNull();
        expect(result[0].prTitle).toBe('');
        expect(result[0].issueNumber).toBeNull();
        expect(result[0].issueTitle).toBe('');
      });

      it('should use custom perPage', async () => {
        mock(client).activity.listEventsForAuthenticatedUser.mockResolvedValue({
          data: [],
        });

        await listUserEvents(client, 'alice', 10);

        expect(mock(client).activity.listEventsForAuthenticatedUser).toHaveBeenCalledWith({
          username: 'alice',
          per_page: 10,
        });
      });

      it('should use default perPage of 30', async () => {
        mock(client).activity.listEventsForAuthenticatedUser.mockResolvedValue({
          data: [],
        });

        await listUserEvents(client, 'alice');

        expect(mock(client).activity.listEventsForAuthenticatedUser).toHaveBeenCalledWith({
          username: 'alice',
          per_page: 30,
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).activity.listEventsForAuthenticatedUser.mockRejectedValue(new Error('err'));

        await expect(listUserEvents(client, 'alice')).rejects.toThrow('Failed to list user events');
      });
    });
  });

  // ─── Sub-Issues ────────────────────────────────────────────────

  describe('Sub-Issues', () => {
    describe('listSubIssues', () => {
      it('should map sub-issues with labels as objects', async () => {
        mock(client).request.mockResolvedValue({
          data: [
            {
              id: 1,
              number: 10,
              title: 'Sub issue 1',
              state: 'open',
              html_url: 'https://github.com/owner/repo/issues/10',
              labels: [{ name: 'bug' }, { name: 'urgent' }],
            },
          ],
        });

        const result = await listSubIssues(client, 'owner', 'repo', 5);

        expect(result).toEqual([
          {
            id: 1,
            number: 10,
            title: 'Sub issue 1',
            state: 'open',
            url: 'https://github.com/owner/repo/issues/10',
            labels: ['bug', 'urgent'],
          },
        ]);
        expect(mock(client).request).toHaveBeenCalledWith(
          'GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
          {
            owner: 'owner',
            repo: 'repo',
            issue_number: 5,
            per_page: 100,
          }
        );
      });

      it('should map labels as strings', async () => {
        mock(client).request.mockResolvedValue({
          data: [
            {
              id: 2,
              number: 11,
              title: 'Sub 2',
              state: 'closed',
              html_url: '',
              labels: ['bug', 'fix'],
            },
          ],
        });

        const result = await listSubIssues(client, 'owner', 'repo', 5);

        expect(result[0].labels).toEqual(['bug', 'fix']);
      });

      it('should filter out empty label names', async () => {
        mock(client).request.mockResolvedValue({
          data: [
            {
              id: 3,
              number: 12,
              title: 'Sub 3',
              state: 'open',
              html_url: '',
              labels: [{ name: 'valid' }, { name: '' }, { name: undefined }],
            },
          ],
        });

        const result = await listSubIssues(client, 'owner', 'repo', 5);

        expect(result[0].labels).toEqual(['valid']);
      });

      it('should handle null labels array', async () => {
        mock(client).request.mockResolvedValue({
          data: [
            {
              id: 4,
              number: 13,
              title: 'Sub 4',
              state: 'open',
              html_url: '',
              labels: null,
            },
          ],
        });

        const result = await listSubIssues(client, 'owner', 'repo', 5);

        expect(result[0].labels).toEqual([]);
      });

      it('should return empty array on 404 error', async () => {
        mock(client).request.mockRejectedValue({ status: 404, message: 'Not Found' });

        const result = await listSubIssues(client, 'owner', 'repo', 5);

        expect(result).toEqual([]);
      });

      it('should return empty array on 403 error', async () => {
        mock(client).request.mockRejectedValue({ status: 403, message: 'Forbidden' });

        const result = await listSubIssues(client, 'owner', 'repo', 5);

        expect(result).toEqual([]);
      });

      it('should throw with descriptive message on other errors with status', async () => {
        mock(client).request.mockRejectedValue({ status: 500, message: 'Server Error' });

        await expect(listSubIssues(client, 'owner', 'repo', 5)).rejects.toThrow(
          'Failed to list sub-issues for owner/repo#5'
        );
      });

      it('should throw with descriptive message on errors without status', async () => {
        mock(client).request.mockRejectedValue(new Error('Network error'));

        await expect(listSubIssues(client, 'owner', 'repo', 5)).rejects.toThrow(
          'Failed to list sub-issues for owner/repo#5'
        );
      });

      it('should throw when error is null (no status property)', async () => {
        mock(client).request.mockRejectedValue(null);

        await expect(listSubIssues(client, 'owner', 'repo', 5)).rejects.toThrow(
          'Failed to list sub-issues for owner/repo#5'
        );
      });
    });

    describe('getParentIssue', () => {
      it('should return mapped parent issue on success', async () => {
        mock(client).request.mockResolvedValue({
          data: {
            id: 100,
            number: 1,
            title: 'Parent Issue',
            state: 'open',
            html_url: 'https://github.com/owner/repo/issues/1',
            labels: [{ name: 'epic' }],
          },
        });

        const result = await getParentIssue(client, 'owner', 'repo', 10);

        expect(result).toEqual({
          id: 100,
          number: 1,
          title: 'Parent Issue',
          state: 'open',
          url: 'https://github.com/owner/repo/issues/1',
          labels: ['epic'],
        });
        expect(mock(client).request).toHaveBeenCalledWith(
          'GET /repos/{owner}/{repo}/issues/{issue_number}/parent',
          {
            owner: 'owner',
            repo: 'repo',
            issue_number: 10,
          }
        );
      });

      it('should handle string labels', async () => {
        mock(client).request.mockResolvedValue({
          data: {
            id: 101,
            number: 2,
            title: 'Parent',
            state: 'closed',
            html_url: '',
            labels: ['feature', 'v2'],
          },
        });

        const result = await getParentIssue(client, 'owner', 'repo', 20);

        expect(result!.labels).toEqual(['feature', 'v2']);
      });

      it('should filter out empty label names', async () => {
        mock(client).request.mockResolvedValue({
          data: {
            id: 102,
            number: 3,
            title: 'Parent',
            state: 'open',
            html_url: '',
            labels: [{ name: 'valid' }, { name: '' }, { name: undefined }],
          },
        });

        const result = await getParentIssue(client, 'owner', 'repo', 30);

        expect(result!.labels).toEqual(['valid']);
      });

      it('should handle null labels', async () => {
        mock(client).request.mockResolvedValue({
          data: {
            id: 103,
            number: 4,
            title: 'Parent',
            state: 'open',
            html_url: '',
            labels: null,
          },
        });

        const result = await getParentIssue(client, 'owner', 'repo', 40);

        expect(result!.labels).toEqual([]);
      });

      it('should return null on 404 error', async () => {
        mock(client).request.mockRejectedValue({ status: 404, message: 'Not Found' });

        const result = await getParentIssue(client, 'owner', 'repo', 10);

        expect(result).toBeNull();
      });

      it('should return null on 403 error', async () => {
        mock(client).request.mockRejectedValue({ status: 403, message: 'Forbidden' });

        const result = await getParentIssue(client, 'owner', 'repo', 10);

        expect(result).toBeNull();
      });

      it('should throw with descriptive message on other errors with status', async () => {
        mock(client).request.mockRejectedValue({ status: 500, message: 'Server Error' });

        await expect(getParentIssue(client, 'owner', 'repo', 10)).rejects.toThrow(
          'Failed to get parent issue for owner/repo#10'
        );
      });

      it('should throw with descriptive message on errors without status', async () => {
        mock(client).request.mockRejectedValue(new Error('Network failure'));

        await expect(getParentIssue(client, 'owner', 'repo', 10)).rejects.toThrow(
          'Failed to get parent issue for owner/repo#10'
        );
      });

      it('should throw when error is null (no status property)', async () => {
        mock(client).request.mockRejectedValue(null);

        await expect(getParentIssue(client, 'owner', 'repo', 10)).rejects.toThrow(
          'Failed to get parent issue for owner/repo#10'
        );
      });
    });

    describe('createSubIssue', () => {
      it('should create issue and link as sub-issue with labels', async () => {
        mock(client).issues.create.mockResolvedValue({
          data: {
            id: 500,
            number: 50,
            html_url: 'https://github.com/owner/repo/issues/50',
          },
        });
        mock(client).request.mockResolvedValue({});

        const result = await createSubIssue(
          client,
          'owner',
          'repo',
          1,
          'Sub issue title',
          'Sub issue body',
          ['bug', 'urgent']
        );

        expect(mock(client).issues.create).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          title: 'Sub issue title',
          body: 'Sub issue body',
          labels: ['bug', 'urgent'],
        });
        expect(mock(client).request).toHaveBeenCalledWith(
          'POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
          {
            owner: 'owner',
            repo: 'repo',
            issue_number: 1,
            sub_issue_id: 500,
          }
        );
        expect(result).toEqual({
          number: 50,
          url: 'https://github.com/owner/repo/issues/50',
        });
      });

      it('should create issue without labels when labels is undefined', async () => {
        mock(client).issues.create.mockResolvedValue({
          data: {
            id: 501,
            number: 51,
            html_url: 'https://github.com/owner/repo/issues/51',
          },
        });
        mock(client).request.mockResolvedValue({});

        await createSubIssue(client, 'owner', 'repo', 1, 'Title', 'Body');

        expect(mock(client).issues.create).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          title: 'Title',
          body: 'Body',
          labels: undefined,
        });
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).issues.create.mockRejectedValue(new Error('forbidden'));

        await expect(createSubIssue(client, 'owner', 'repo', 1, 'Title', 'Body')).rejects.toThrow(
          'Failed to create sub-issue for owner/repo#1'
        );
      });
    });

    describe('addExistingSubIssue', () => {
      it('should link existing issue as sub-issue', async () => {
        mock(client).request.mockResolvedValue({});

        await expect(addExistingSubIssue(client, 'owner', 'repo', 1, 999)).resolves.toBeUndefined();
        expect(mock(client).request).toHaveBeenCalledWith(
          'POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
          {
            owner: 'owner',
            repo: 'repo',
            issue_number: 1,
            sub_issue_id: 999,
          }
        );
      });

      it('should throw with descriptive message on error', async () => {
        mock(client).request.mockRejectedValue(new Error('not found'));

        await expect(addExistingSubIssue(client, 'owner', 'repo', 1, 999)).rejects.toThrow(
          'Failed to add sub-issue to owner/repo#1'
        );
      });
    });
  });
});
