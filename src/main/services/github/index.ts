/**
 * GitHub REST Service — Facade
 *
 * Extends GitHubRestServiceBase and delegates every public method
 * to the standalone functions in the domain modules.
 * This preserves the original class API while splitting implementation
 * into focused, testable units.
 */
import type { GitHubRepository } from '../../ipc/channels';
import { GitHubRestServiceBase } from './github-rest-base.service';
import * as issues from './github-issues.service';
import * as pullRequests from './github-pull-requests.service';
import * as extras from './github-extras.service';

export class GitHubRestService extends GitHubRestServiceBase {
  // ─── Issues ─────────────────────────────────────────────────

  async getIssue(owner: string, repo: string, issueNumber: number) {
    return issues.getIssue(this.getClient(), owner, repo, issueNumber);
  }

  async listIssues(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all' } = {}
  ) {
    return issues.listIssues(this.getClient(), owner, repo, options);
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ): Promise<{ number: number; url: string }> {
    return issues.createIssue(this.getClient(), owner, repo, title, body, labels);
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: { state?: 'open' | 'closed'; state_reason?: 'completed' | 'not_planned' | 'reopened' }
  ): Promise<void> {
    return issues.updateIssue(this.getClient(), owner, repo, issueNumber, updates);
  }

  async addAssignees(
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[]
  ): Promise<void> {
    return issues.addAssignees(this.getClient(), owner, repo, issueNumber, assignees);
  }

  async listIssueComments(owner: string, repo: string, issueNumber: number) {
    return issues.listIssueComments(this.getClient(), owner, repo, issueNumber);
  }

  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    return issues.createIssueComment(this.getClient(), owner, repo, issueNumber, body);
  }

  async listIssueReactions(owner: string, repo: string, issueNumber: number) {
    return issues.listIssueReactions(this.getClient(), owner, repo, issueNumber);
  }

  async addIssueReaction(owner: string, repo: string, issueNumber: number, content: string) {
    return issues.addIssueReaction(this.getClient(), owner, repo, issueNumber, content);
  }

  async deleteIssueReaction(
    owner: string,
    repo: string,
    issueNumber: number,
    reactionId: number
  ): Promise<void> {
    return issues.deleteIssueReaction(this.getClient(), owner, repo, issueNumber, reactionId);
  }

  // ─── Pull Requests ──────────────────────────────────────────

  async getPullRequest(owner: string, repo: string, prNumber: number) {
    return pullRequests.getPullRequest(this.getClient(), owner, repo, prNumber);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    options?: { state?: 'open' | 'closed' | 'all'; head?: string }
  ) {
    return pullRequests.listPullRequests(this.getClient(), owner, repo, options);
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string
  ) {
    return pullRequests.createPullRequest(this.getClient(), owner, repo, title, head, base, body);
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge',
    commitTitle?: string,
    commitMessage?: string
  ): Promise<{ sha: string; merged: boolean; message: string }> {
    return pullRequests.mergePullRequest(
      this.getClient(),
      owner,
      repo,
      prNumber,
      mergeMethod,
      commitTitle,
      commitMessage
    );
  }

  async closePullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<{ number: number; state: string }> {
    return pullRequests.closePullRequest(this.getClient(), owner, repo, prNumber);
  }

  async checkPRStatus(
    owner: string,
    repo: string,
    headBranch: string
  ): Promise<{ number: number; url: string; status: 'open' | 'closed' | 'merged' } | null> {
    return pullRequests.checkPRStatus(this.getClient(), owner, repo, headBranch);
  }

  async listPRComments(owner: string, repo: string, prNumber: number) {
    return pullRequests.listPRComments(this.getClient(), owner, repo, prNumber);
  }

  async listPRReviews(owner: string, repo: string, prNumber: number) {
    return pullRequests.listPRReviews(this.getClient(), owner, repo, prNumber);
  }

  async listPRReviewComments(owner: string, repo: string, prNumber: number) {
    return pullRequests.listPRReviewComments(this.getClient(), owner, repo, prNumber);
  }

  async createReviewCommentReply(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number,
    body: string
  ) {
    return pullRequests.createReviewCommentReply(
      this.getClient(),
      owner,
      repo,
      prNumber,
      commentId,
      body
    );
  }

  async listReviewCommentReactions(owner: string, repo: string, commentId: number) {
    return pullRequests.listReviewCommentReactions(this.getClient(), owner, repo, commentId);
  }

  async addReviewCommentReaction(owner: string, repo: string, commentId: number, content: string) {
    return pullRequests.addReviewCommentReaction(this.getClient(), owner, repo, commentId, content);
  }

  async deleteReviewCommentReaction(
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number
  ): Promise<void> {
    return pullRequests.deleteReviewCommentReaction(
      this.getClient(),
      owner,
      repo,
      commentId,
      reactionId
    );
  }

  async listPRCommits(owner: string, repo: string, prNumber: number) {
    return pullRequests.listPRCommits(this.getClient(), owner, repo, prNumber);
  }

  async listPREvents(owner: string, repo: string, prNumber: number) {
    return pullRequests.listPREvents(this.getClient(), owner, repo, prNumber);
  }

  async getPRCheckStatus(owner: string, repo: string, sha: string) {
    return pullRequests.getPRCheckStatus(this.getClient(), owner, repo, sha);
  }

  // ─── Comment Reactions ──────────────────────────────────────

  async listCommentReactions(owner: string, repo: string, commentId: number) {
    return extras.listCommentReactions(this.getClient(), owner, repo, commentId);
  }

  async addCommentReaction(owner: string, repo: string, commentId: number, content: string) {
    return extras.addCommentReaction(this.getClient(), owner, repo, commentId, content);
  }

  async deleteCommentReaction(
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number
  ): Promise<void> {
    return extras.deleteCommentReaction(this.getClient(), owner, repo, commentId, reactionId);
  }

  // ─── Repository Operations ──────────────────────────────────

  async forkRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return extras.forkRepository(this.getClient(), owner, repo);
  }

  async getRepository(owner: string, repo: string) {
    return extras.getRepository(this.getClient(), owner, repo);
  }

  async getRepositoryContents(owner: string, repo: string, filePath: string = '') {
    return extras.getRepositoryContents(this.getClient(), owner, repo, filePath);
  }

  async getUserRepositories(username?: string) {
    return extras.getUserRepositories(this.getClient(), username);
  }

  async hasStarred(owner: string, repo: string): Promise<boolean> {
    return extras.hasStarred(this.getClient(), owner, repo);
  }

  async starRepository(owner: string, repo: string): Promise<void> {
    return extras.starRepository(this.getClient(), owner, repo);
  }

  async unstarRepository(owner: string, repo: string): Promise<void> {
    return extras.unstarRepository(this.getClient(), owner, repo);
  }

  async getRateLimit() {
    return extras.getRateLimit(this.getClient());
  }

  // ─── GitHub Actions ─────────────────────────────────────────

  async listWorkflowRuns(owner: string, repo: string) {
    return extras.listWorkflowRuns(this.getClient(), owner, repo);
  }

  async listWorkflowRunJobs(owner: string, repo: string, runId: number) {
    return extras.listWorkflowRunJobs(this.getClient(), owner, repo, runId);
  }

  async getJobLogs(owner: string, repo: string, jobId: number): Promise<string> {
    return extras.getJobLogs(this.getClient(), owner, repo, jobId);
  }

  // ─── GitHub Releases ────────────────────────────────────────

  async listReleases(owner: string, repo: string) {
    return extras.listReleases(this.getClient(), owner, repo);
  }

  async getRelease(owner: string, repo: string, releaseId: number) {
    return extras.getRelease(this.getClient(), owner, repo, releaseId);
  }

  async createRelease(
    owner: string,
    repo: string,
    data: {
      tagName: string;
      name: string;
      body: string;
      draft: boolean;
      prerelease: boolean;
      makeLatest: 'true' | 'false' | 'legacy';
      targetCommitish?: string;
    }
  ) {
    return extras.createRelease(this.getClient(), owner, repo, data);
  }

  async updateRelease(
    owner: string,
    repo: string,
    releaseId: number,
    data: {
      tagName?: string;
      name?: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
      makeLatest?: 'true' | 'false' | 'legacy';
    }
  ) {
    return extras.updateRelease(this.getClient(), owner, repo, releaseId, data);
  }

  async deleteRelease(owner: string, repo: string, releaseId: number): Promise<void> {
    return extras.deleteRelease(this.getClient(), owner, repo, releaseId);
  }

  // ─── Search ─────────────────────────────────────────────────

  async searchIssuesAndPullRequests(query: string, perPage: number = 30) {
    return extras.searchIssuesAndPullRequests(this.getClient(), query, perPage);
  }

  // ─── User Events ────────────────────────────────────────────

  async listUserEvents(username: string, perPage: number = 30) {
    return extras.listUserEvents(this.getClient(), username, perPage);
  }

  // ─── Sub-Issues ─────────────────────────────────────────────

  async listSubIssues(owner: string, repo: string, issueNumber: number) {
    return extras.listSubIssues(this.getClient(), owner, repo, issueNumber);
  }

  async getParentIssue(owner: string, repo: string, issueNumber: number) {
    return extras.getParentIssue(this.getClient(), owner, repo, issueNumber);
  }

  async createSubIssue(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    title: string,
    body: string,
    labels?: string[]
  ): Promise<{ number: number; url: string }> {
    return extras.createSubIssue(
      this.getClient(),
      owner,
      repo,
      parentIssueNumber,
      title,
      body,
      labels
    );
  }

  async addExistingSubIssue(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    subIssueId: number
  ): Promise<void> {
    return extras.addExistingSubIssue(this.getClient(), owner, repo, parentIssueNumber, subIssueId);
  }
}

export const gitHubRestService = new GitHubRestService();
