import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  // gitHubService (from services barrel)
  mockGetAuthenticatedUser: vi.fn(),
  mockSearchIssues: vi.fn(),
  mockGetRepository: vi.fn(),
  mockValidateToken: vi.fn(),
  mockForkRepository: vi.fn(),
  mockGetRepositoryTree: vi.fn(),
  // gitHubRestService
  mockListPullRequests: vi.fn(),
  mockGetPullRequest: vi.fn(),
  mockListPRComments: vi.fn(),
  mockListPRReviews: vi.fn(),
  mockListPRReviewComments: vi.fn(),
  mockCreateIssueComment: vi.fn(),
  mockListIssues: vi.fn(),
  mockGetIssue: vi.fn(),
  mockAddAssignees: vi.fn(),
  mockListIssueComments: vi.fn(),
  mockUpdateIssue: vi.fn(),
  mockCreateIssue: vi.fn(),
  mockCreatePullRequest: vi.fn(),
  mockMergePullRequest: vi.fn(),
  mockClosePullRequest: vi.fn(),
  mockListIssueReactions: vi.fn(),
  mockAddIssueReaction: vi.fn(),
  mockDeleteIssueReaction: vi.fn(),
  mockListCommentReactions: vi.fn(),
  mockAddCommentReaction: vi.fn(),
  mockDeleteCommentReaction: vi.fn(),
  mockCreateReviewCommentReply: vi.fn(),
  mockListReviewCommentReactions: vi.fn(),
  mockAddReviewCommentReaction: vi.fn(),
  mockDeleteReviewCommentReaction: vi.fn(),
  mockListPRCommits: vi.fn(),
  mockListPREvents: vi.fn(),
  mockListWorkflowRuns: vi.fn(),
  mockListWorkflowRunJobs: vi.fn(),
  mockGetJobLogs: vi.fn(),
  mockSearchIssuesAndPullRequests: vi.fn(),
  mockListUserEvents: vi.fn(),
  mockGetUserRepositories: vi.fn(),
  mockListReleases: vi.fn(),
  mockGetRelease: vi.fn(),
  mockCreateRelease: vi.fn(),
  mockUpdateRelease: vi.fn(),
  mockDeleteRelease: vi.fn(),
  mockGetPRCheckStatus: vi.fn(),
  mockListSubIssues: vi.fn(),
  mockGetParentIssue: vi.fn(),
  mockCreateSubIssue: vi.fn(),
  mockAddExistingSubIssue: vi.fn(),
  // gitHubGraphQLService
  mockGetPRReviewThreads: vi.fn(),
  mockResolveReviewThread: vi.fn(),
  mockUnresolveReviewThread: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services', () => ({
  gitHubService: {
    getAuthenticatedUser: mocks.mockGetAuthenticatedUser,
    searchIssues: mocks.mockSearchIssues,
    getRepository: mocks.mockGetRepository,
    validateToken: mocks.mockValidateToken,
    forkRepository: mocks.mockForkRepository,
    getRepositoryTree: mocks.mockGetRepositoryTree,
  },
}));

vi.mock('../../../src/main/services/github-rest.service', () => ({
  gitHubRestService: {
    listPullRequests: mocks.mockListPullRequests,
    getPullRequest: mocks.mockGetPullRequest,
    listPRComments: mocks.mockListPRComments,
    listPRReviews: mocks.mockListPRReviews,
    listPRReviewComments: mocks.mockListPRReviewComments,
    createIssueComment: mocks.mockCreateIssueComment,
    listIssues: mocks.mockListIssues,
    getIssue: mocks.mockGetIssue,
    addAssignees: mocks.mockAddAssignees,
    listIssueComments: mocks.mockListIssueComments,
    updateIssue: mocks.mockUpdateIssue,
    createIssue: mocks.mockCreateIssue,
    createPullRequest: mocks.mockCreatePullRequest,
    mergePullRequest: mocks.mockMergePullRequest,
    closePullRequest: mocks.mockClosePullRequest,
    listIssueReactions: mocks.mockListIssueReactions,
    addIssueReaction: mocks.mockAddIssueReaction,
    deleteIssueReaction: mocks.mockDeleteIssueReaction,
    listCommentReactions: mocks.mockListCommentReactions,
    addCommentReaction: mocks.mockAddCommentReaction,
    deleteCommentReaction: mocks.mockDeleteCommentReaction,
    createReviewCommentReply: mocks.mockCreateReviewCommentReply,
    listReviewCommentReactions: mocks.mockListReviewCommentReactions,
    addReviewCommentReaction: mocks.mockAddReviewCommentReaction,
    deleteReviewCommentReaction: mocks.mockDeleteReviewCommentReaction,
    listPRCommits: mocks.mockListPRCommits,
    listPREvents: mocks.mockListPREvents,
    listWorkflowRuns: mocks.mockListWorkflowRuns,
    listWorkflowRunJobs: mocks.mockListWorkflowRunJobs,
    getJobLogs: mocks.mockGetJobLogs,
    searchIssuesAndPullRequests: mocks.mockSearchIssuesAndPullRequests,
    listUserEvents: mocks.mockListUserEvents,
    getUserRepositories: mocks.mockGetUserRepositories,
    listReleases: mocks.mockListReleases,
    getRelease: mocks.mockGetRelease,
    createRelease: mocks.mockCreateRelease,
    updateRelease: mocks.mockUpdateRelease,
    deleteRelease: mocks.mockDeleteRelease,
    getPRCheckStatus: mocks.mockGetPRCheckStatus,
    listSubIssues: mocks.mockListSubIssues,
    getParentIssue: mocks.mockGetParentIssue,
    createSubIssue: mocks.mockCreateSubIssue,
    addExistingSubIssue: mocks.mockAddExistingSubIssue,
  },
}));

vi.mock('../../../src/main/services/github-graphql.service', () => ({
  gitHubGraphQLService: {
    getPRReviewThreads: mocks.mockGetPRReviewThreads,
    resolveReviewThread: mocks.mockResolveReviewThread,
    unresolveReviewThread: mocks.mockUnresolveReviewThread,
  },
}));

import { setupGitHubHandlers } from '../../../src/main/ipc/handlers/github.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('github.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGitHubHandlers();
  });

  // ── Registration ──

  it('registers all GitHub handlers', () => {
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels.length).toBeGreaterThanOrEqual(50);
    expect(channels).toContain('github:get-authenticated-user');
    expect(channels).toContain('github:list-pull-requests');
    expect(channels).toContain('github:list-issues');
    expect(channels).toContain('github:list-releases');
    expect(channels).toContain('github:list-sub-issues');
  });

  // ── gitHubService (barrel import) ──

  it('github:get-authenticated-user delegates to gitHubService', async () => {
    mocks.mockGetAuthenticatedUser.mockResolvedValue({ login: 'user' });
    const result = await getHandler('github:get-authenticated-user')!({});
    expect(mocks.mockGetAuthenticatedUser).toHaveBeenCalled();
    expect(result).toEqual({ login: 'user' });
  });

  it('github:search-issues delegates to gitHubService', async () => {
    mocks.mockSearchIssues.mockResolvedValue([]);
    const result = await getHandler('github:search-issues')!({}, 'bug', ['bug']);
    expect(mocks.mockSearchIssues).toHaveBeenCalledWith('bug', ['bug']);
    expect(result).toEqual([]);
  });

  it('github:get-repository delegates to gitHubService', async () => {
    mocks.mockGetRepository.mockResolvedValue({ name: 'repo' });
    const result = await getHandler('github:get-repository')!({}, 'owner', 'repo');
    expect(mocks.mockGetRepository).toHaveBeenCalledWith('owner', 'repo');
    expect(result).toEqual({ name: 'repo' });
  });

  it('github:validate-token delegates to gitHubService', async () => {
    mocks.mockValidateToken.mockResolvedValue(true);
    const result = await getHandler('github:validate-token')!({}, 'ghp_test');
    expect(mocks.mockValidateToken).toHaveBeenCalledWith('ghp_test');
    expect(result).toBe(true);
  });

  it('github:fork-repository splits repoFullName and delegates', async () => {
    mocks.mockForkRepository.mockResolvedValue({ url: 'https://...' });
    const result = await getHandler('github:fork-repository')!({}, 'owner/repo');
    expect(mocks.mockForkRepository).toHaveBeenCalledWith('owner', 'repo');
    expect(result).toEqual({ url: 'https://...' });
  });

  it('github:get-repository-tree defaults branch to main', async () => {
    mocks.mockGetRepositoryTree.mockResolvedValue([]);
    await getHandler('github:get-repository-tree')!({}, 'owner', 'repo', undefined);
    expect(mocks.mockGetRepositoryTree).toHaveBeenCalledWith('owner', 'repo', 'main');
  });

  it('github:get-repository-tree uses provided branch', async () => {
    mocks.mockGetRepositoryTree.mockResolvedValue([]);
    await getHandler('github:get-repository-tree')!({}, 'owner', 'repo', 'dev');
    expect(mocks.mockGetRepositoryTree).toHaveBeenCalledWith('owner', 'repo', 'dev');
  });

  // ── gitHubRestService: PRs ──

  it('github:list-pull-requests defaults state to all', async () => {
    mocks.mockListPullRequests.mockResolvedValue([]);
    await getHandler('github:list-pull-requests')!({}, 'o', 'r', undefined);
    expect(mocks.mockListPullRequests).toHaveBeenCalledWith('o', 'r', { state: 'all' });
  });

  it('github:get-pull-request delegates', async () => {
    mocks.mockGetPullRequest.mockResolvedValue({ number: 1 });
    const result = await getHandler('github:get-pull-request')!({}, 'o', 'r', 1);
    expect(mocks.mockGetPullRequest).toHaveBeenCalledWith('o', 'r', 1);
    expect(result).toEqual({ number: 1 });
  });

  it('github:list-pr-comments delegates', async () => {
    mocks.mockListPRComments.mockResolvedValue([]);
    await getHandler('github:list-pr-comments')!({}, 'o', 'r', 1);
    expect(mocks.mockListPRComments).toHaveBeenCalledWith('o', 'r', 1);
  });

  it('github:list-pr-reviews delegates', async () => {
    mocks.mockListPRReviews.mockResolvedValue([]);
    await getHandler('github:list-pr-reviews')!({}, 'o', 'r', 1);
    expect(mocks.mockListPRReviews).toHaveBeenCalledWith('o', 'r', 1);
  });

  it('github:list-pr-review-comments delegates', async () => {
    mocks.mockListPRReviewComments.mockResolvedValue([]);
    await getHandler('github:list-pr-review-comments')!({}, 'o', 'r', 1);
    expect(mocks.mockListPRReviewComments).toHaveBeenCalledWith('o', 'r', 1);
  });

  it('github:create-pr-comment delegates to createIssueComment', async () => {
    await getHandler('github:create-pr-comment')!({}, 'o', 'r', 1, 'comment body');
    expect(mocks.mockCreateIssueComment).toHaveBeenCalledWith('o', 'r', 1, 'comment body');
  });

  it('github:create-pull-request delegates', async () => {
    mocks.mockCreatePullRequest.mockResolvedValue({ number: 42 });
    const result = await getHandler('github:create-pull-request')!(
      {},
      'o',
      'r',
      'title',
      'head',
      'base',
      'body'
    );
    expect(mocks.mockCreatePullRequest).toHaveBeenCalledWith(
      'o',
      'r',
      'title',
      'head',
      'base',
      'body'
    );
    expect(result).toEqual({ number: 42 });
  });

  it('github:merge-pull-request delegates', async () => {
    mocks.mockMergePullRequest.mockResolvedValue({ merged: true });
    const result = await getHandler('github:merge-pull-request')!(
      {},
      'o',
      'r',
      1,
      'squash',
      'title',
      'msg'
    );
    expect(mocks.mockMergePullRequest).toHaveBeenCalledWith('o', 'r', 1, 'squash', 'title', 'msg');
    expect(result).toEqual({ merged: true });
  });

  it('github:close-pull-request delegates', async () => {
    mocks.mockClosePullRequest.mockResolvedValue({ state: 'closed' });
    const result = await getHandler('github:close-pull-request')!({}, 'o', 'r', 1);
    expect(mocks.mockClosePullRequest).toHaveBeenCalledWith('o', 'r', 1);
    expect(result).toEqual({ state: 'closed' });
  });

  // ── Issues ──

  it('github:list-issues defaults state to open', async () => {
    mocks.mockListIssues.mockResolvedValue([]);
    await getHandler('github:list-issues')!({}, 'o', 'r', undefined);
    expect(mocks.mockListIssues).toHaveBeenCalledWith('o', 'r', { state: 'open' });
  });

  it('github:get-issue delegates', async () => {
    mocks.mockGetIssue.mockResolvedValue({ number: 5 });
    await getHandler('github:get-issue')!({}, 'o', 'r', 5);
    expect(mocks.mockGetIssue).toHaveBeenCalledWith('o', 'r', 5);
  });

  it('github:add-assignees delegates', async () => {
    await getHandler('github:add-assignees')!({}, 'o', 'r', 5, ['user1']);
    expect(mocks.mockAddAssignees).toHaveBeenCalledWith('o', 'r', 5, ['user1']);
  });

  it('github:list-issue-comments delegates', async () => {
    mocks.mockListIssueComments.mockResolvedValue([]);
    await getHandler('github:list-issue-comments')!({}, 'o', 'r', 5);
    expect(mocks.mockListIssueComments).toHaveBeenCalledWith('o', 'r', 5);
  });

  it('github:create-issue-comment delegates', async () => {
    await getHandler('github:create-issue-comment')!({}, 'o', 'r', 5, 'body');
    expect(mocks.mockCreateIssueComment).toHaveBeenCalledWith('o', 'r', 5, 'body');
  });

  it('github:update-issue delegates', async () => {
    await getHandler('github:update-issue')!({}, 'o', 'r', 5, { state: 'closed' });
    expect(mocks.mockUpdateIssue).toHaveBeenCalledWith('o', 'r', 5, { state: 'closed' });
  });

  it('github:create-issue delegates', async () => {
    mocks.mockCreateIssue.mockResolvedValue({ number: 10 });
    const result = await getHandler('github:create-issue')!({}, 'o', 'r', 'title', 'body', ['bug']);
    expect(mocks.mockCreateIssue).toHaveBeenCalledWith('o', 'r', 'title', 'body', ['bug']);
    expect(result).toEqual({ number: 10 });
  });

  // ── Reactions ──

  it('github:list-issue-reactions delegates', async () => {
    mocks.mockListIssueReactions.mockResolvedValue([]);
    await getHandler('github:list-issue-reactions')!({}, 'o', 'r', 5);
    expect(mocks.mockListIssueReactions).toHaveBeenCalledWith('o', 'r', 5);
  });

  it('github:add-issue-reaction delegates', async () => {
    mocks.mockAddIssueReaction.mockResolvedValue({ id: 1 });
    await getHandler('github:add-issue-reaction')!({}, 'o', 'r', 5, '+1');
    expect(mocks.mockAddIssueReaction).toHaveBeenCalledWith('o', 'r', 5, '+1');
  });

  it('github:delete-issue-reaction delegates', async () => {
    await getHandler('github:delete-issue-reaction')!({}, 'o', 'r', 5, 123);
    expect(mocks.mockDeleteIssueReaction).toHaveBeenCalledWith('o', 'r', 5, 123);
  });

  it('github:list-comment-reactions delegates', async () => {
    mocks.mockListCommentReactions.mockResolvedValue([]);
    await getHandler('github:list-comment-reactions')!({}, 'o', 'r', 100);
    expect(mocks.mockListCommentReactions).toHaveBeenCalledWith('o', 'r', 100);
  });

  it('github:add-comment-reaction delegates', async () => {
    mocks.mockAddCommentReaction.mockResolvedValue({ id: 2 });
    await getHandler('github:add-comment-reaction')!({}, 'o', 'r', 100, 'heart');
    expect(mocks.mockAddCommentReaction).toHaveBeenCalledWith('o', 'r', 100, 'heart');
  });

  it('github:delete-comment-reaction delegates', async () => {
    await getHandler('github:delete-comment-reaction')!({}, 'o', 'r', 100, 456);
    expect(mocks.mockDeleteCommentReaction).toHaveBeenCalledWith('o', 'r', 100, 456);
  });

  // ── Review comment reactions ──

  it('github:create-review-comment-reply delegates', async () => {
    mocks.mockCreateReviewCommentReply.mockResolvedValue({ id: 99 });
    await getHandler('github:create-review-comment-reply')!({}, 'o', 'r', 1, 50, 'reply body');
    expect(mocks.mockCreateReviewCommentReply).toHaveBeenCalledWith('o', 'r', 1, 50, 'reply body');
  });

  it('github:list-review-comment-reactions delegates', async () => {
    mocks.mockListReviewCommentReactions.mockResolvedValue([]);
    await getHandler('github:list-review-comment-reactions')!({}, 'o', 'r', 50);
    expect(mocks.mockListReviewCommentReactions).toHaveBeenCalledWith('o', 'r', 50);
  });

  it('github:add-review-comment-reaction delegates', async () => {
    mocks.mockAddReviewCommentReaction.mockResolvedValue({ id: 3 });
    await getHandler('github:add-review-comment-reaction')!({}, 'o', 'r', 50, '+1');
    expect(mocks.mockAddReviewCommentReaction).toHaveBeenCalledWith('o', 'r', 50, '+1');
  });

  it('github:delete-review-comment-reaction delegates', async () => {
    await getHandler('github:delete-review-comment-reaction')!({}, 'o', 'r', 50, 789);
    expect(mocks.mockDeleteReviewCommentReaction).toHaveBeenCalledWith('o', 'r', 50, 789);
  });

  // ── GraphQL: Review threads ──

  it('github:get-pr-review-threads delegates to GraphQL service', async () => {
    mocks.mockGetPRReviewThreads.mockResolvedValue([]);
    await getHandler('github:get-pr-review-threads')!({}, 'o', 'r', 1);
    expect(mocks.mockGetPRReviewThreads).toHaveBeenCalledWith('o', 'r', 1);
  });

  it('github:resolve-review-thread delegates to GraphQL service', async () => {
    await getHandler('github:resolve-review-thread')!({}, 'thread-id');
    expect(mocks.mockResolveReviewThread).toHaveBeenCalledWith('thread-id');
  });

  it('github:unresolve-review-thread delegates to GraphQL service', async () => {
    await getHandler('github:unresolve-review-thread')!({}, 'thread-id');
    expect(mocks.mockUnresolveReviewThread).toHaveBeenCalledWith('thread-id');
  });

  // ── PR Timeline ──

  it('github:list-pr-commits delegates', async () => {
    mocks.mockListPRCommits.mockResolvedValue([]);
    await getHandler('github:list-pr-commits')!({}, 'o', 'r', 1);
    expect(mocks.mockListPRCommits).toHaveBeenCalledWith('o', 'r', 1);
  });

  it('github:list-pr-events delegates', async () => {
    mocks.mockListPREvents.mockResolvedValue([]);
    await getHandler('github:list-pr-events')!({}, 'o', 'r', 1);
    expect(mocks.mockListPREvents).toHaveBeenCalledWith('o', 'r', 1);
  });

  // ── Actions ──

  it('github:list-workflow-runs delegates', async () => {
    mocks.mockListWorkflowRuns.mockResolvedValue([]);
    await getHandler('github:list-workflow-runs')!({}, 'o', 'r');
    expect(mocks.mockListWorkflowRuns).toHaveBeenCalledWith('o', 'r');
  });

  it('github:list-workflow-run-jobs delegates', async () => {
    mocks.mockListWorkflowRunJobs.mockResolvedValue([]);
    await getHandler('github:list-workflow-run-jobs')!({}, 'o', 'r', 123);
    expect(mocks.mockListWorkflowRunJobs).toHaveBeenCalledWith('o', 'r', 123);
  });

  it('github:get-job-logs delegates', async () => {
    mocks.mockGetJobLogs.mockResolvedValue('log output');
    await getHandler('github:get-job-logs')!({}, 'o', 'r', 456);
    expect(mocks.mockGetJobLogs).toHaveBeenCalledWith('o', 'r', 456);
  });

  // ── Search & User ──

  it('github:search-issues-and-prs delegates', async () => {
    mocks.mockSearchIssuesAndPullRequests.mockResolvedValue([]);
    await getHandler('github:search-issues-and-prs')!({}, 'query', 30);
    expect(mocks.mockSearchIssuesAndPullRequests).toHaveBeenCalledWith('query', 30);
  });

  it('github:list-user-events delegates', async () => {
    mocks.mockListUserEvents.mockResolvedValue([]);
    await getHandler('github:list-user-events')!({}, 'username', 10);
    expect(mocks.mockListUserEvents).toHaveBeenCalledWith('username', 10);
  });

  it('github:list-user-repos delegates', async () => {
    mocks.mockGetUserRepositories.mockResolvedValue([]);
    await getHandler('github:list-user-repos')!({});
    expect(mocks.mockGetUserRepositories).toHaveBeenCalled();
  });

  // ── Releases ──

  it('github:list-releases delegates', async () => {
    mocks.mockListReleases.mockResolvedValue([]);
    await getHandler('github:list-releases')!({}, 'o', 'r');
    expect(mocks.mockListReleases).toHaveBeenCalledWith('o', 'r');
  });

  it('github:get-release delegates', async () => {
    mocks.mockGetRelease.mockResolvedValue({ id: 1 });
    await getHandler('github:get-release')!({}, 'o', 'r', 1);
    expect(mocks.mockGetRelease).toHaveBeenCalledWith('o', 'r', 1);
  });

  it('github:create-release delegates', async () => {
    const data = { tag_name: 'v1.0.0' };
    mocks.mockCreateRelease.mockResolvedValue({ id: 2 });
    await getHandler('github:create-release')!({}, 'o', 'r', data);
    expect(mocks.mockCreateRelease).toHaveBeenCalledWith('o', 'r', data);
  });

  it('github:update-release delegates', async () => {
    const data = { name: 'Updated' };
    mocks.mockUpdateRelease.mockResolvedValue({ id: 1 });
    await getHandler('github:update-release')!({}, 'o', 'r', 1, data);
    expect(mocks.mockUpdateRelease).toHaveBeenCalledWith('o', 'r', 1, data);
  });

  it('github:delete-release delegates', async () => {
    await getHandler('github:delete-release')!({}, 'o', 'r', 1);
    expect(mocks.mockDeleteRelease).toHaveBeenCalledWith('o', 'r', 1);
  });

  it('github:publish-release calls updateRelease with draft:false', async () => {
    mocks.mockUpdateRelease.mockResolvedValue({ id: 1, draft: false });
    await getHandler('github:publish-release')!({}, 'o', 'r', 1);
    expect(mocks.mockUpdateRelease).toHaveBeenCalledWith('o', 'r', 1, { draft: false });
  });

  // ── PR Check Status ──

  it('github:get-pr-check-status delegates', async () => {
    mocks.mockGetPRCheckStatus.mockResolvedValue({ state: 'success' });
    await getHandler('github:get-pr-check-status')!({}, 'o', 'r', 'sha123');
    expect(mocks.mockGetPRCheckStatus).toHaveBeenCalledWith('o', 'r', 'sha123');
  });

  // ── Sub-issues ──

  it('github:list-sub-issues delegates', async () => {
    mocks.mockListSubIssues.mockResolvedValue([]);
    await getHandler('github:list-sub-issues')!({}, 'o', 'r', 5);
    expect(mocks.mockListSubIssues).toHaveBeenCalledWith('o', 'r', 5);
  });

  it('github:get-parent-issue delegates', async () => {
    mocks.mockGetParentIssue.mockResolvedValue({ number: 1 });
    await getHandler('github:get-parent-issue')!({}, 'o', 'r', 5);
    expect(mocks.mockGetParentIssue).toHaveBeenCalledWith('o', 'r', 5);
  });

  it('github:create-sub-issue delegates', async () => {
    mocks.mockCreateSubIssue.mockResolvedValue({ number: 6 });
    await getHandler('github:create-sub-issue')!({}, 'o', 'r', 5, 'sub title', 'sub body', [
      'task',
    ]);
    expect(mocks.mockCreateSubIssue).toHaveBeenCalledWith('o', 'r', 5, 'sub title', 'sub body', [
      'task',
    ]);
  });

  it('github:add-existing-sub-issue delegates', async () => {
    await getHandler('github:add-existing-sub-issue')!({}, 'o', 'r', 5, 99);
    expect(mocks.mockAddExistingSubIssue).toHaveBeenCalledWith('o', 'r', 5, 99);
  });
});
