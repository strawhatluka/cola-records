/**
 * GitHub REST Service — Pull Requests domain
 *
 * Standalone functions for PR CRUD, reviews, merge, timeline, and review comment reactions.
 */
import type { Octokit } from '@octokit/rest';

export async function getPullRequest(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
) {
  try {
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

export async function listPullRequests(
  client: Octokit,
  owner: string,
  repo: string,
  options?: { state?: 'open' | 'closed' | 'all'; head?: string }
) {
  try {
    const response = await client.pulls.list({
      owner,
      repo,
      state: options?.state || 'open',
      head: options?.head,
      per_page: 100,
    });

    return response.data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      state: pr.state,
      merged: pr.merged_at !== null,
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      author: pr.user?.login || 'unknown',
      headBranch: pr.head?.ref || '',
    }));
  } catch (error) {
    throw new Error(`Failed to list pull requests for ${owner}/${repo}: ${error}`);
  }
}

export async function createPullRequest(
  client: Octokit,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string
) {
  try {
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

export async function mergePullRequest(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge',
  commitTitle?: string,
  commitMessage?: string
): Promise<{ sha: string; merged: boolean; message: string }> {
  try {
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
  } catch (error: unknown) {
    const err = error as Record<string, unknown> | undefined;
    const response = err?.response as Record<string, unknown> | undefined;
    const data = response?.data as Record<string, unknown> | undefined;
    const message = (data?.message as string) || (err?.message as string) || String(error);
    throw new Error(`Failed to merge PR #${prNumber}: ${message}`);
  }
}

export async function closePullRequest(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ number: number; state: string }> {
  try {
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

export async function checkPRStatus(
  client: Octokit,
  owner: string,
  repo: string,
  headBranch: string
): Promise<{ number: number; url: string; status: 'open' | 'closed' | 'merged' } | null> {
  try {
    const prs = await listPullRequests(client, owner, repo, { state: 'all' });
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

export async function listPRComments(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
) {
  try {
    const response = await client.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    return response.data.map((comment) => ({
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

export async function listPRReviews(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
) {
  try {
    const response = await client.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    return response.data.map((review) => ({
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

export async function listPRReviewComments(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
) {
  try {
    const response = await client.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    return response.data.map((comment) => ({
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

export async function createReviewCommentReply(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  commentId: number,
  body: string
) {
  try {
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

export async function listReviewCommentReactions(
  client: Octokit,
  owner: string,
  repo: string,
  commentId: number
) {
  try {
    const response = await client.reactions.listForPullRequestReviewComment({
      owner,
      repo,
      comment_id: commentId,
      per_page: 100,
    });

    return response.data.map((r) => ({
      id: r.id,
      content: r.content,
      user: r.user?.login || 'unknown',
    }));
  } catch (error) {
    throw new Error(`Failed to list reactions for review comment ${commentId}: ${error}`);
  }
}

export async function addReviewCommentReaction(
  client: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  content: string
) {
  try {
    const response = await client.reactions.createForPullRequestReviewComment({
      owner,
      repo,
      comment_id: commentId,
      content: content as
        | '+1'
        | '-1'
        | 'laugh'
        | 'confused'
        | 'heart'
        | 'hooray'
        | 'rocket'
        | 'eyes',
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

export async function deleteReviewCommentReaction(
  client: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reactionId: number
): Promise<void> {
  try {
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

export async function listPRCommits(
  client: Octokit,
  owner: string,
  repo: string,
  prNumber: number
) {
  try {
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

export async function listPREvents(client: Octokit, owner: string, repo: string, prNumber: number) {
  try {
    const response = await client.issues.listEvents({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

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
      .map((event) => {
        const evt = event as typeof event & {
          rename?: { from: string; to: string };
          label?: { name: string; color: string };
        };
        return {
          id: evt.id,
          event: evt.event,
          actor: evt.actor?.login || 'unknown',
          actorAvatarUrl: evt.actor?.avatar_url || '',
          createdAt: new Date(evt.created_at),
          rename: evt.rename ? { from: evt.rename.from, to: evt.rename.to } : undefined,
          label: evt.label ? { name: evt.label.name, color: evt.label.color } : undefined,
          commitId: evt.commit_id || undefined,
        };
      });
  } catch (error) {
    throw new Error(`Failed to list events for PR #${prNumber}: ${error}`);
  }
}

export async function getPRCheckStatus(
  client: Octokit,
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
    const statusResponse = await client.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref: sha,
    });

    const statuses = statusResponse.data.statuses;

    if (statuses.length > 0) {
      const passed = statuses.filter((s) => s.state === 'success').length;
      const failed = statuses.filter((s) => s.state === 'failure' || s.state === 'error').length;
      const pending = statuses.filter((s) => s.state === 'pending').length;

      let state: 'pending' | 'success' | 'failure' | 'unknown' = 'unknown';
      if (failed > 0) state = 'failure';
      else if (pending > 0) state = 'pending';
      else if (passed > 0) state = 'success';

      return { state, total: statuses.length, passed, failed, pending };
    }

    const checkSuitesResponse = await client.checks.listSuitesForRef({
      owner,
      repo,
      ref: sha,
    });

    const suites = checkSuitesResponse.data.check_suites;

    if (suites.length === 0) {
      return { state: 'unknown', total: 0, passed: 0, failed: 0, pending: 0 };
    }

    const passed = suites.filter(
      (s) => s.conclusion === 'success' || s.conclusion === 'skipped' || s.conclusion === 'neutral'
    ).length;
    const failed = suites.filter(
      (s) =>
        s.conclusion === 'failure' ||
        s.conclusion === 'action_required' ||
        s.conclusion === 'timed_out' ||
        s.conclusion === 'cancelled'
    ).length;
    const pending = suites.filter(
      (s) => s.status === 'in_progress' || s.status === 'queued' || s.conclusion === null
    ).length;

    let state: 'pending' | 'success' | 'failure' | 'unknown' = 'unknown';
    if (failed > 0) state = 'failure';
    else if (pending > 0) state = 'pending';
    else if (passed > 0) state = 'success';

    return { state, total: suites.length, passed, failed, pending };
  } catch {
    return { state: 'unknown', total: 0, passed: 0, failed: 0, pending: 0 };
  }
}
