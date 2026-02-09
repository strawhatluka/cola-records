/* eslint-disable @typescript-eslint/no-explicit-any -- GitHub REST API responses use Octokit's generic types */
import type { GitHubRepository } from '../ipc/channels';
import { Octokit } from '@octokit/rest';
import { env } from './environment.service';
import { database } from '../database';

/**
 * GitHub REST Service
 *
 * Provides GitHub API access via REST for operations not covered by GraphQL
 */
export class GitHubRestService {
  private client: Octokit | null = null;

  /**
   * Initialize the REST client with token
   */
  private getClient(): Octokit {
    if (!this.client) {
      // First check database settings, then fall back to environment
      const settings = database.getAllSettings();
      const token = settings.githubToken || env.get('GITHUB_TOKEN');

      if (!token) {
        throw new Error(
          'GitHub token not configured. Please set GITHUB_TOKEN in settings or .env file.'
        );
      }

      this.client = new Octokit({
        auth: token,
        userAgent: 'Cola Records v1.0.0',
        timeZone: 'UTC',
      });
    }

    return this.client;
  }

  /**
   * Reset client (useful when token changes)
   */
  resetClient(): void {
    this.client = null;
  }

  /**
   * Get issue details
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      return {
        id: response.data.id.toString(),
        number: response.data.number,
        title: response.data.title,
        body: response.data.body || '',
        url: response.data.html_url,
        state: response.data.state,
        labels: response.data.labels.map((label: any) =>
          typeof label === 'string' ? label : label.name
        ),
        createdAt: new Date(response.data.created_at),
        updatedAt: new Date(response.data.updated_at),
        author: response.data.user?.login || 'unknown',
        authorAvatarUrl: response.data.user?.avatar_url || '',
      };
    } catch (error) {
      throw new Error(`Failed to get issue ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  /**
   * Create a comment on an issue
   */
  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
    } catch (error) {
      throw new Error(`Failed to create comment on ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  /**
   * Update an issue (close, reopen, change state reason)
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: { state?: 'open' | 'closed'; state_reason?: 'completed' | 'not_planned' | 'reopened' }
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        ...updates,
      });
    } catch (error) {
      throw new Error(`Failed to update issue ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ): Promise<{ number: number; url: string }> {
    try {
      const client = this.getClient();
      const response = await client.issues.create({
        owner,
        repo,
        title,
        body,
        labels,
      });

      return {
        number: response.data.number,
        url: response.data.html_url,
      };
    } catch (error) {
      throw new Error(`Failed to create issue on ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * List issues for a repository (excludes pull requests)
   */
  async listIssues(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all' } = {}
  ): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.issues.listForRepo({
        owner,
        repo,
        state: options.state || 'open',
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      });

      // Filter out pull requests (GitHub includes PRs in the issues endpoint)
      return response.data
        .filter((item: any) => !item.pull_request)
        .map((issue: any) => ({
          number: issue.number,
          title: issue.title,
          body: issue.body || '',
          url: issue.html_url,
          state: issue.state,
          labels: issue.labels.map((label: any) =>
            typeof label === 'string' ? label : label.name
          ),
          createdAt: new Date(issue.created_at),
          updatedAt: new Date(issue.updated_at),
          author: issue.user?.login || 'unknown',
          authorAvatarUrl: issue.user?.avatar_url || '',
        }));
    } catch (error) {
      throw new Error(`Failed to list issues for ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * List comments on an issue
   */
  async listIssueComments(owner: string, repo: string, issueNumber: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      });

      return response.data.map((comment: any) => ({
        id: comment.id,
        body: comment.body || '',
        author: comment.user?.login || 'unknown',
        authorAvatarUrl: comment.user?.avatar_url || '',
        createdAt: new Date(comment.created_at),
        updatedAt: new Date(comment.updated_at),
      }));
    } catch (error) {
      throw new Error(`Failed to list comments for ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  /**
   * Fork a repository
   */
  async forkRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const client = this.getClient();
      const response = await client.repos.createFork({
        owner,
        repo,
      });

      return {
        id: response.data.id.toString(),
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description || '',
        url: response.data.clone_url, // Use clone_url instead of html_url for git operations
        language: response.data.language || 'Unknown',
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
      };
    } catch (error) {
      throw new Error(`Failed to fork ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string
  ): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body,
      });

      return {
        number: response.data.number,
        url: response.data.html_url,
        state: response.data.state,
      };
    } catch (error) {
      throw new Error(`Failed to create pull request on ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Get repository contents
   */
  async getRepositoryContents(owner: string, repo: string, filePath: string = ''): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.repos.getContent({
        owner,
        repo,
        path: filePath,
      });

      if (Array.isArray(response.data)) {
        return response.data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          url: item.html_url,
        }));
      }

      return [];
    } catch (error) {
      throw new Error(`Failed to get contents of ${owner}/${repo}/${filePath}: ${error}`);
    }
  }

  /**
   * Get user's repositories
   */
  async getUserRepositories(username?: string): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = username
        ? await client.repos.listForUser({ username, per_page: 100 })
        : await client.repos.listForAuthenticatedUser({ per_page: 100 });

      return response.data.map((repo: any) => ({
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        language: repo.language || 'Unknown',
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        private: repo.private,
      }));
    } catch (error) {
      throw new Error(`Failed to get repositories: ${error}`);
    }
  }

  /**
   * Check if user has starred a repository
   */
  async hasStarred(owner: string, repo: string): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.activity.checkRepoIsStarredByAuthenticatedUser({
        owner,
        repo,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Star a repository
   */
  async starRepository(owner: string, repo: string): Promise<void> {
    try {
      const client = this.getClient();
      await client.activity.starRepoForAuthenticatedUser({
        owner,
        repo,
      });
    } catch (error) {
      throw new Error(`Failed to star ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Unstar a repository
   */
  async unstarRepository(owner: string, repo: string): Promise<void> {
    try {
      const client = this.getClient();
      await client.activity.unstarRepoForAuthenticatedUser({
        owner,
        repo,
      });
    } catch (error) {
      throw new Error(`Failed to unstar ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.rateLimit.get();

      return {
        limit: response.data.rate.limit,
        remaining: response.data.rate.remaining,
        reset: new Date(response.data.rate.reset * 1000),
      };
    } catch (error) {
      throw new Error(`Failed to get rate limit: ${error}`);
    }
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.repos.get({
        owner,
        repo,
      });

      return {
        id: response.data.id.toString(),
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description || '',
        url: response.data.html_url,
        cloneUrl: response.data.clone_url,
        language: response.data.language || 'Unknown',
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
        fork: response.data.fork,
        parent: response.data.parent
          ? {
              id: response.data.parent.id.toString(),
              name: response.data.parent.name,
              full_name: response.data.parent.full_name,
              url: response.data.parent.html_url,
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to get repository ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Get pull request details
   */
  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      return {
        number: response.data.number,
        title: response.data.title,
        body: response.data.body || '',
        url: response.data.html_url,
        state: response.data.state,
        merged: response.data.merged,
        createdAt: new Date(response.data.created_at),
        updatedAt: new Date(response.data.updated_at),
        author: response.data.user?.login || 'unknown',
        headSha: response.data.head.sha,
      };
    } catch (error) {
      throw new Error(`Failed to get pull request ${owner}/${repo}#${prNumber}: ${error}`);
    }
  }

  /**
   * List pull requests for a repository
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options?: { state?: 'open' | 'closed' | 'all'; head?: string }
  ): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.pulls.list({
        owner,
        repo,
        state: options?.state || 'open',
        head: options?.head,
        per_page: 100,
      });

      return response.data.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state,
        merged: pr.merged_at !== null,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        author: pr.user?.login || 'unknown',
        headBranch: pr.head?.ref || '', // Add head branch name
      }));
    } catch (error) {
      throw new Error(`Failed to list pull requests for ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Check PR status for a specific branch
   */
  async checkPRStatus(
    owner: string,
    repo: string,
    headBranch: string
  ): Promise<{ number: number; url: string; status: 'open' | 'closed' | 'merged' } | null> {
    try {
      const prs = await this.listPullRequests(owner, repo, { state: 'all' });

      // Find PR matching the head branch by comparing branch names
      const pr = prs.find((p) => p.headBranch === headBranch);

      if (!pr) {
        return null;
      }

      const status = pr.merged ? 'merged' : (pr.state as 'open' | 'closed');
      return {
        number: pr.number,
        url: pr.url,
        status,
      };
    } catch {
      return null;
    }
  }
  /**
   * List comments on a pull request (uses issues API - GitHub treats PR comments as issue comments)
   */
  async listPRComments(owner: string, repo: string, prNumber: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
      });

      return response.data.map((comment: any) => ({
        id: comment.id,
        body: comment.body || '',
        author: comment.user?.login || 'unknown',
        authorAvatarUrl: comment.user?.avatar_url || '',
        createdAt: new Date(comment.created_at),
        updatedAt: new Date(comment.updated_at),
      }));
    } catch (error) {
      throw new Error(`Failed to list comments for ${owner}/${repo}#${prNumber}: ${error}`);
    }
  }

  /**
   * List reviews on a pull request
   */
  async listPRReviews(owner: string, repo: string, prNumber: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });

      return response.data.map((review: any) => ({
        id: review.id,
        body: review.body || '',
        state: review.state,
        author: review.user?.login || 'unknown',
        authorAvatarUrl: review.user?.avatar_url || '',
        submittedAt: review.submitted_at ? new Date(review.submitted_at) : new Date(),
      }));
    } catch (error) {
      throw new Error(`Failed to list reviews for ${owner}/${repo}#${prNumber}: ${error}`);
    }
  }

  /**
   * List review comments (inline code comments) on a pull request
   */
  async listPRReviewComments(owner: string, repo: string, prNumber: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });

      return response.data.map((comment: any) => ({
        id: comment.id,
        body: comment.body || '',
        author: comment.user?.login || 'unknown',
        authorAvatarUrl: comment.user?.avatar_url || '',
        path: comment.path,
        line: comment.line || comment.original_line || null,
        startLine: comment.start_line || comment.original_start_line || null,
        createdAt: new Date(comment.created_at),
        updatedAt: new Date(comment.updated_at),
        inReplyToId: comment.in_reply_to_id || null,
        diffHunk: comment.diff_hunk || null,
        htmlUrl: comment.html_url || null,
      }));
    } catch (error) {
      throw new Error(`Failed to list review comments for ${owner}/${repo}#${prNumber}: ${error}`);
    }
  }

  /**
   * Create a reply to a review comment
   */
  async createReviewCommentReply(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number,
    body: string
  ): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        comment_id: commentId,
        body,
      });

      return {
        id: response.data.id,
        body: response.data.body || '',
        author: response.data.user?.login || 'unknown',
        authorAvatarUrl: response.data.user?.avatar_url || '',
        path: response.data.path,
        line: response.data.line || response.data.original_line || null,
        startLine: response.data.start_line || response.data.original_start_line || null,
        createdAt: new Date(response.data.created_at),
        updatedAt: new Date(response.data.updated_at),
        inReplyToId: response.data.in_reply_to_id || null,
        diffHunk: response.data.diff_hunk || null,
        htmlUrl: response.data.html_url || null,
      };
    } catch (error) {
      throw new Error(`Failed to create reply for comment ${commentId}: ${error}`);
    }
  }

  /**
   * List reactions on a review comment
   */
  async listReviewCommentReactions(owner: string, repo: string, commentId: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.reactions.listForPullRequestReviewComment({
        owner,
        repo,
        comment_id: commentId,
        per_page: 100,
      });

      return response.data.map((r: any) => ({
        id: r.id,
        content: r.content,
        user: r.user?.login || 'unknown',
      }));
    } catch (error) {
      throw new Error(`Failed to list reactions for review comment ${commentId}: ${error}`);
    }
  }

  /**
   * Add a reaction to a review comment
   */
  async addReviewCommentReaction(
    owner: string,
    repo: string,
    commentId: number,
    content: string
  ): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.reactions.createForPullRequestReviewComment({
        owner,
        repo,
        comment_id: commentId,
        content: content as any,
      });

      return {
        id: response.data.id,
        content: response.data.content,
        user: response.data.user?.login || 'unknown',
      };
    } catch (error) {
      throw new Error(`Failed to add reaction to review comment ${commentId}: ${error}`);
    }
  }

  /**
   * Delete a reaction from a review comment
   */
  async deleteReviewCommentReaction(
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.reactions.deleteForPullRequestComment({
        owner,
        repo,
        comment_id: commentId,
        reaction_id: reactionId,
      });
    } catch (error) {
      throw new Error(`Failed to delete reaction from review comment ${commentId}: ${error}`);
    }
  }
  // ─── Reactions ───────────────────────────────────────────────

  async listIssueReactions(owner: string, repo: string, issueNumber: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.reactions.listForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      });

      return response.data.map((r: any) => ({
        id: r.id,
        content: r.content,
        user: r.user?.login || 'unknown',
      }));
    } catch (error) {
      throw new Error(`Failed to list reactions for ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  async addIssueReaction(
    owner: string,
    repo: string,
    issueNumber: number,
    content: string
  ): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.reactions.createForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        content: content as any,
      });

      return {
        id: response.data.id,
        content: response.data.content,
        user: response.data.user?.login || 'unknown',
      };
    } catch (error) {
      throw new Error(`Failed to add reaction to ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  async deleteIssueReaction(
    owner: string,
    repo: string,
    issueNumber: number,
    reactionId: number
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.reactions.deleteForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        reaction_id: reactionId,
      });
    } catch (error) {
      throw new Error(`Failed to delete reaction from ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  async listCommentReactions(owner: string, repo: string, commentId: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.reactions.listForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        per_page: 100,
      });

      return response.data.map((r: any) => ({
        id: r.id,
        content: r.content,
        user: r.user?.login || 'unknown',
      }));
    } catch (error) {
      throw new Error(`Failed to list reactions for comment ${commentId}: ${error}`);
    }
  }

  async addCommentReaction(
    owner: string,
    repo: string,
    commentId: number,
    content: string
  ): Promise<any> {
    try {
      const client = this.getClient();
      const response = await client.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        content: content as any,
      });

      return {
        id: response.data.id,
        content: response.data.content,
        user: response.data.user?.login || 'unknown',
      };
    } catch (error) {
      throw new Error(`Failed to add reaction to comment ${commentId}: ${error}`);
    }
  }

  async deleteCommentReaction(
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.reactions.deleteForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        reaction_id: reactionId,
      });
    } catch (error) {
      throw new Error(`Failed to delete reaction from comment ${commentId}: ${error}`);
    }
  }

  // ─── Sub-Issues ─────────────────────────────────────────────

  async listSubIssues(owner: string, repo: string, issueNumber: number): Promise<any[]> {
    try {
      const client = this.getClient();
      const response = await client.request(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
        {
          owner,
          repo,
          issue_number: issueNumber,
          per_page: 100,
        }
      );

      return (response.data as any[]).map((item: any) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state,
        url: item.html_url,
      }));
    } catch (error: any) {
      // Sub-issues API may not be available for all repos
      if (error.status === 404 || error.status === 403) {
        return [];
      }
      throw new Error(`Failed to list sub-issues for ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  async createSubIssue(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    title: string,
    body: string,
    labels?: string[]
  ): Promise<{ number: number; url: string }> {
    try {
      const client = this.getClient();

      // 1. Create the issue
      const issueResponse = await client.issues.create({
        owner,
        repo,
        title,
        body,
        labels,
      });

      const subIssueId = issueResponse.data.id;

      // 2. Link as sub-issue
      await client.request('POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues', {
        owner,
        repo,
        issue_number: parentIssueNumber,
        sub_issue_id: subIssueId,
      });

      return {
        number: issueResponse.data.number,
        url: issueResponse.data.html_url,
      };
    } catch (error) {
      throw new Error(
        `Failed to create sub-issue for ${owner}/${repo}#${parentIssueNumber}: ${error}`
      );
    }
  }

  async addExistingSubIssue(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    subIssueId: number
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.request('POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues', {
        owner,
        repo,
        issue_number: parentIssueNumber,
        sub_issue_id: subIssueId,
      });
    } catch (error) {
      throw new Error(`Failed to add sub-issue to ${owner}/${repo}#${parentIssueNumber}: ${error}`);
    }
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge',
    commitTitle?: string,
    commitMessage?: string
  ): Promise<{ sha: string; merged: boolean; message: string }> {
    try {
      const client = this.getClient();
      const response = await client.rest.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: mergeMethod,
        commit_title: commitTitle,
        commit_message: commitMessage,
      });

      return {
        sha: response.data.sha,
        merged: response.data.merged,
        message: response.data.message,
      };
    } catch (error: any) {
      // GitHub returns specific error messages for merge failures
      const message = error?.response?.data?.message || error?.message || String(error);
      throw new Error(`Failed to merge PR #${prNumber}: ${message}`);
    }
  }

  async closePullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<{ number: number; state: string }> {
    try {
      const client = this.getClient();
      const response = await client.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        state: 'closed',
      });

      return {
        number: response.data.number,
        state: response.data.state,
      };
    } catch (error) {
      throw new Error(`Failed to close PR #${prNumber}: ${error}`);
    }
  }

  // ─── PR Timeline Events ───────────────────────────────────────────────

  /**
   * List commits on a pull request
   */
  async listPRCommits(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<
    {
      sha: string;
      message: string;
      author: string;
      authorAvatarUrl: string;
      date: Date;
      url: string;
    }[]
  > {
    try {
      const client = this.getClient();
      const response = await client.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });

      return response.data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.author?.login || commit.commit.author?.name || 'unknown',
        authorAvatarUrl: commit.author?.avatar_url || '',
        date: new Date(commit.commit.author?.date || commit.commit.committer?.date || ''),
        url: commit.html_url,
      }));
    } catch (error) {
      throw new Error(`Failed to list commits for PR #${prNumber}: ${error}`);
    }
  }

  /**
   * List timeline events for a pull request (renamed, closed, reopened, merged, etc.)
   */
  async listPREvents(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<
    {
      id: number;
      event: string;
      actor: string;
      actorAvatarUrl: string;
      createdAt: Date;
      rename?: { from: string; to: string };
      label?: { name: string; color: string };
      commitId?: string;
    }[]
  > {
    try {
      const client = this.getClient();
      const response = await client.issues.listEvents({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
      });

      // Filter to relevant timeline events
      const relevantEvents = [
        'renamed',
        'closed',
        'reopened',
        'merged',
        'assigned',
        'unassigned',
        'labeled',
        'unlabeled',
        'head_ref_force_pushed',
        'base_ref_force_pushed',
        'review_requested',
        'review_request_removed',
        'ready_for_review',
        'converted_to_draft',
      ];

      return response.data
        .filter((event) => relevantEvents.includes(event.event))
        .map((event: any) => ({
          id: event.id,
          event: event.event,
          actor: event.actor?.login || 'unknown',
          actorAvatarUrl: event.actor?.avatar_url || '',
          createdAt: new Date(event.created_at),
          rename: event.rename ? { from: event.rename.from, to: event.rename.to } : undefined,
          label: event.label ? { name: event.label.name, color: event.label.color } : undefined,
          commitId: event.commit_id || undefined,
        }));
    } catch (error) {
      throw new Error(`Failed to list events for PR #${prNumber}: ${error}`);
    }
  }

  // ─── PR Check Status ───────────────────────────────────────────────

  /**
   * Get the combined check status for a commit (CI workflows)
   * Uses Combined Status API first, falls back to Check Suites for GitHub Actions
   */
  async getPRCheckStatus(
    owner: string,
    repo: string,
    sha: string
  ): Promise<{
    state: 'pending' | 'success' | 'failure' | 'unknown';
    total: number;
    passed: number;
    failed: number;
    pending: number;
  }> {
    try {
      const client = this.getClient();

      // Try Combined Status API first
      const statusResponse = await client.repos.getCombinedStatusForRef({
        owner,
        repo,
        ref: sha,
      });

      const statuses = statusResponse.data.statuses;

      // If we have statuses from the combined API, use them
      if (statuses.length > 0) {
        const passed = statuses.filter((s: any) => s.state === 'success').length;
        const failed = statuses.filter(
          (s: any) => s.state === 'failure' || s.state === 'error'
        ).length;
        const pending = statuses.filter((s: any) => s.state === 'pending').length;

        let state: 'pending' | 'success' | 'failure' | 'unknown' = 'unknown';
        if (failed > 0) {
          state = 'failure';
        } else if (pending > 0) {
          state = 'pending';
        } else if (passed > 0) {
          state = 'success';
        }

        return {
          state,
          total: statuses.length,
          passed,
          failed,
          pending,
        };
      }

      // Fall back to Check Suites API (for GitHub Actions)
      const checkSuitesResponse = await client.checks.listSuitesForRef({
        owner,
        repo,
        ref: sha,
      });

      const suites = checkSuitesResponse.data.check_suites;

      if (suites.length === 0) {
        return {
          state: 'unknown',
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
        };
      }

      // Aggregate check suite conclusions
      const passed = suites.filter(
        (s: any) =>
          s.conclusion === 'success' || s.conclusion === 'skipped' || s.conclusion === 'neutral'
      ).length;
      const failed = suites.filter(
        (s: any) =>
          s.conclusion === 'failure' ||
          s.conclusion === 'action_required' ||
          s.conclusion === 'timed_out' ||
          s.conclusion === 'cancelled'
      ).length;
      const pending = suites.filter(
        (s: any) => s.status === 'in_progress' || s.status === 'queued' || s.conclusion === null
      ).length;

      let state: 'pending' | 'success' | 'failure' | 'unknown' = 'unknown';
      if (failed > 0) {
        state = 'failure';
      } else if (pending > 0) {
        state = 'pending';
      } else if (passed > 0) {
        state = 'success';
      }

      return {
        state,
        total: suites.length,
        passed,
        failed,
        pending,
      };
    } catch (error) {
      // If we can't get status, return unknown rather than throwing
      return {
        state: 'unknown',
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
      };
    }
  }
}

// Export singleton instance
export const gitHubRestService = new GitHubRestService();
