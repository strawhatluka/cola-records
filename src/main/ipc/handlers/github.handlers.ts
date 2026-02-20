/**
 * GitHub IPC Handlers
 *
 * Registers all github:* handlers for GitHub REST API, GraphQL,
 * reactions, reviews, releases, actions, search, and sub-issues.
 */
import { handleIpc } from '../handlers';

export function setupGitHubHandlers(): void {
  handleIpc('github:get-authenticated-user', async () => {
    const { gitHubService } = await import('../../services');
    return await gitHubService.getAuthenticatedUser();
  });

  handleIpc('github:search-issues', async (_event, query, labels) => {
    const { gitHubService } = await import('../../services');
    return await gitHubService.searchIssues(query, labels);
  });

  handleIpc('github:get-repository', async (_event, owner, repo) => {
    const { gitHubService } = await import('../../services');
    return await gitHubService.getRepository(owner, repo);
  });

  handleIpc('github:validate-token', async (_event, token) => {
    const { gitHubService } = await import('../../services');
    return await gitHubService.validateToken(token);
  });

  handleIpc('github:fork-repository', async (_event, repoFullName) => {
    const { gitHubService } = await import('../../services');
    const [owner, repo] = repoFullName.split('/');
    return await gitHubService.forkRepository(owner, repo);
  });

  handleIpc('github:get-repository-tree', async (_event, owner, repo, branch) => {
    const { gitHubService } = await import('../../services');
    return await gitHubService.getRepositoryTree(owner, repo, branch || 'main');
  });

  handleIpc('github:list-pull-requests', async (_event, owner, repo, state) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listPullRequests(owner, repo, { state: state || 'all' });
  });

  // PR Detail handlers
  handleIpc('github:get-pull-request', async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.getPullRequest(owner, repo, prNumber);
  });

  handleIpc('github:list-pr-comments', async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listPRComments(owner, repo, prNumber);
  });

  handleIpc('github:list-pr-reviews', async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listPRReviews(owner, repo, prNumber);
  });

  handleIpc('github:list-pr-review-comments', async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listPRReviewComments(owner, repo, prNumber);
  });

  handleIpc('github:create-pr-comment', async (_event, owner, repo, prNumber, body) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    await gitHubRestService.createIssueComment(owner, repo, prNumber, body);
  });

  // Issue Detail handlers
  handleIpc('github:list-issues', async (_event, owner, repo, state) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listIssues(owner, repo, { state: state || 'open' });
  });

  handleIpc('github:get-issue', async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.getIssue(owner, repo, issueNumber);
  });

  handleIpc('github:add-assignees', async (_event, owner, repo, issueNumber, assignees) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    await gitHubRestService.addAssignees(owner, repo, issueNumber, assignees);
  });

  handleIpc('github:list-issue-comments', async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listIssueComments(owner, repo, issueNumber);
  });

  handleIpc('github:create-issue-comment', async (_event, owner, repo, issueNumber, body) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    await gitHubRestService.createIssueComment(owner, repo, issueNumber, body);
  });

  handleIpc('github:update-issue', async (_event, owner, repo, issueNumber, updates) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    await gitHubRestService.updateIssue(owner, repo, issueNumber, updates);
  });

  handleIpc('github:create-issue', async (_event, owner, repo, title, body, labels) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.createIssue(owner, repo, title, body, labels);
  });

  handleIpc('github:create-pull-request', async (_event, owner, repo, title, head, base, body) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.createPullRequest(owner, repo, title, head, base, body);
  });

  handleIpc(
    'github:merge-pull-request',
    async (_event, owner, repo, prNumber, mergeMethod, commitTitle, commitMessage) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      return await gitHubRestService.mergePullRequest(
        owner,
        repo,
        prNumber,
        mergeMethod,
        commitTitle,
        commitMessage
      );
    }
  );

  handleIpc('github:close-pull-request', async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.closePullRequest(owner, repo, prNumber);
  });

  // Reaction handlers
  handleIpc('github:list-issue-reactions', async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listIssueReactions(owner, repo, issueNumber);
  });

  handleIpc('github:add-issue-reaction', async (_event, owner, repo, issueNumber, content) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.addIssueReaction(owner, repo, issueNumber, content);
  });

  handleIpc(
    'github:delete-issue-reaction',
    async (_event, owner, repo, issueNumber, reactionId) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      await gitHubRestService.deleteIssueReaction(owner, repo, issueNumber, reactionId);
    }
  );

  handleIpc('github:list-comment-reactions', async (_event, owner, repo, commentId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listCommentReactions(owner, repo, commentId);
  });

  handleIpc('github:add-comment-reaction', async (_event, owner, repo, commentId, content) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.addCommentReaction(owner, repo, commentId, content);
  });

  handleIpc(
    'github:delete-comment-reaction',
    async (_event, owner, repo, commentId, reactionId) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      await gitHubRestService.deleteCommentReaction(owner, repo, commentId, reactionId);
    }
  );

  // Review comment reply handler
  handleIpc(
    'github:create-review-comment-reply',
    async (_event, owner, repo, prNumber, commentId, body) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      return await gitHubRestService.createReviewCommentReply(
        owner,
        repo,
        prNumber,
        commentId,
        body
      );
    }
  );

  // Review comment reaction handlers
  handleIpc('github:list-review-comment-reactions', async (_event, owner, repo, commentId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listReviewCommentReactions(owner, repo, commentId);
  });

  handleIpc(
    'github:add-review-comment-reaction',
    async (_event, owner, repo, commentId, content) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      return await gitHubRestService.addReviewCommentReaction(owner, repo, commentId, content);
    }
  );

  handleIpc(
    'github:delete-review-comment-reaction',
    async (_event, owner, repo, commentId, reactionId) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      await gitHubRestService.deleteReviewCommentReaction(owner, repo, commentId, reactionId);
    }
  );

  // Review thread resolution handlers (GraphQL)
  handleIpc('github:get-pr-review-threads', async (_event, owner, repo, prNumber) => {
    const { gitHubGraphQLService } = await import('../../services/github-graphql.service');
    return await gitHubGraphQLService.getPRReviewThreads(owner, repo, prNumber);
  });

  handleIpc('github:resolve-review-thread', async (_event, threadId) => {
    const { gitHubGraphQLService } = await import('../../services/github-graphql.service');
    await gitHubGraphQLService.resolveReviewThread(threadId);
  });

  handleIpc('github:unresolve-review-thread', async (_event, threadId) => {
    const { gitHubGraphQLService } = await import('../../services/github-graphql.service');
    await gitHubGraphQLService.unresolveReviewThread(threadId);
  });

  // PR Timeline Events handlers
  handleIpc('github:list-pr-commits', async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listPRCommits(owner, repo, prNumber);
  });

  handleIpc('github:list-pr-events', async (_event, owner, repo, prNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listPREvents(owner, repo, prNumber);
  });

  // GitHub Actions handlers
  handleIpc('github:list-workflow-runs', async (_event, owner, repo) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listWorkflowRuns(owner, repo);
  });

  handleIpc('github:list-workflow-run-jobs', async (_event, owner, repo, runId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listWorkflowRunJobs(owner, repo, runId);
  });

  handleIpc('github:get-job-logs', async (_event, owner, repo, jobId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.getJobLogs(owner, repo, jobId);
  });

  // GitHub Search handler
  handleIpc('github:search-issues-and-prs', async (_event, query, perPage) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.searchIssuesAndPullRequests(query, perPage);
  });

  // GitHub User Events handler
  handleIpc('github:list-user-events', async (_event, username, perPage) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listUserEvents(username, perPage);
  });

  // GitHub User Repos handler
  handleIpc('github:list-user-repos', async () => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.getUserRepositories();
  });

  // GitHub Releases handlers
  handleIpc('github:list-releases', async (_event, owner, repo) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listReleases(owner, repo);
  });

  handleIpc('github:get-release', async (_event, owner, repo, releaseId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.getRelease(owner, repo, releaseId);
  });

  handleIpc('github:create-release', async (_event, owner, repo, data) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.createRelease(owner, repo, data);
  });

  handleIpc('github:update-release', async (_event, owner, repo, releaseId, data) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.updateRelease(owner, repo, releaseId, data);
  });

  handleIpc('github:delete-release', async (_event, owner, repo, releaseId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.deleteRelease(owner, repo, releaseId);
  });

  handleIpc('github:publish-release', async (_event, owner, repo, releaseId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.updateRelease(owner, repo, releaseId, { draft: false });
  });

  // PR Check Status handler
  handleIpc('github:get-pr-check-status', async (_event, owner, repo, sha) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.getPRCheckStatus(owner, repo, sha);
  });

  // Sub-issue handlers
  handleIpc('github:list-sub-issues', async (_event, owner, repo, issueNumber) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    return await gitHubRestService.listSubIssues(owner, repo, issueNumber);
  });

  handleIpc(
    'github:create-sub-issue',
    async (_event, owner, repo, parentIssueNumber, title, body, labels) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      return await gitHubRestService.createSubIssue(
        owner,
        repo,
        parentIssueNumber,
        title,
        body,
        labels
      );
    }
  );

  handleIpc(
    'github:add-existing-sub-issue',
    async (_event, owner, repo, parentIssueNumber, subIssueId) => {
      const { gitHubRestService } = await import('../../services/github-rest.service');
      await gitHubRestService.addExistingSubIssue(owner, repo, parentIssueNumber, subIssueId);
    }
  );
}
