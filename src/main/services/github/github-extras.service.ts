/**
 * GitHub REST Service — Extras domain
 *
 * Standalone functions for comment reactions, repos, actions, releases,
 * search, user events, sub-issues, and miscellaneous operations.
 */
import type { Octokit } from '@octokit/rest';
import type { GitHubRepository } from '../../ipc/channels';

// ─── Comment Reactions ───────────────────────────────────────────────

export async function listCommentReactions(
  client: Octokit,
  owner: string,
  repo: string,
  commentId: number
) {
  try {
    const response = await client.reactions.listForIssueComment({
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
    throw new Error(`Failed to list reactions for comment ${commentId}: ${error}`);
  }
}

export async function addCommentReaction(
  client: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  content: string
) {
  try {
    const response = await client.reactions.createForIssueComment({
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
    throw new Error(`Failed to add reaction to comment ${commentId}: ${error}`);
  }
}

export async function deleteCommentReaction(
  client: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reactionId: number
): Promise<void> {
  try {
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

// ─── Repository Operations ───────────────────────────────────────────────

export async function forkRepository(
  client: Octokit,
  owner: string,
  repo: string
): Promise<GitHubRepository> {
  try {
    const response = await client.repos.createFork({ owner, repo });

    return {
      id: response.data.id.toString(),
      name: response.data.name,
      fullName: response.data.full_name,
      description: response.data.description || '',
      url: response.data.clone_url,
      language: response.data.language || 'Unknown',
      stars: response.data.stargazers_count,
      forks: response.data.forks_count,
    };
  } catch (error) {
    throw new Error(`Failed to fork ${owner}/${repo}: ${error}`);
  }
}

export async function getRepository(client: Octokit, owner: string, repo: string) {
  try {
    const response = await client.repos.get({ owner, repo });

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

export async function getRepositoryContents(
  client: Octokit,
  owner: string,
  repo: string,
  filePath: string = ''
) {
  try {
    const response = await client.repos.getContent({ owner, repo, path: filePath });

    if (Array.isArray(response.data)) {
      return response.data.map((item) => ({
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

export async function getUserRepositories(client: Octokit, username?: string) {
  try {
    const response = username
      ? await client.repos.listForUser({ username, per_page: 100 })
      : await client.repos.listForAuthenticatedUser({ per_page: 100 });

    return response.data.map((repo) => ({
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      url: repo.html_url,
      cloneUrl: repo.clone_url || '',
      language: repo.language || 'Unknown',
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      private: repo.private,
    }));
  } catch (error) {
    throw new Error(`Failed to get repositories: ${error}`);
  }
}

export async function hasStarred(client: Octokit, owner: string, repo: string): Promise<boolean> {
  try {
    await client.activity.checkRepoIsStarredByAuthenticatedUser({ owner, repo });
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      return false;
    }
    throw error;
  }
}

export async function starRepository(client: Octokit, owner: string, repo: string): Promise<void> {
  try {
    await client.activity.starRepoForAuthenticatedUser({ owner, repo });
  } catch (error) {
    throw new Error(`Failed to star ${owner}/${repo}: ${error}`);
  }
}

export async function unstarRepository(
  client: Octokit,
  owner: string,
  repo: string
): Promise<void> {
  try {
    await client.activity.unstarRepoForAuthenticatedUser({ owner, repo });
  } catch (error) {
    throw new Error(`Failed to unstar ${owner}/${repo}: ${error}`);
  }
}

export async function getRateLimit(client: Octokit) {
  try {
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

// ─── GitHub Actions ───────────────────────────────────────────────

export async function listWorkflowRuns(client: Octokit, owner: string, repo: string) {
  try {
    const response = await client.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 30,
    });

    return response.data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.name || '',
      displayTitle: run.display_title || run.name || '',
      status: run.status || '',
      conclusion: run.conclusion || null,
      headBranch: run.head_branch || '',
      headSha: run.head_sha || '',
      event: run.event || '',
      runNumber: run.run_number,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url,
      actor: run.actor?.login || 'unknown',
      actorAvatarUrl: run.actor?.avatar_url || '',
    }));
  } catch (error) {
    throw new Error(`Failed to list workflow runs for ${owner}/${repo}: ${error}`);
  }
}

export async function listWorkflowRunJobs(
  client: Octokit,
  owner: string,
  repo: string,
  runId: number
) {
  try {
    const response = await client.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
      filter: 'latest',
    });

    return response.data.jobs.map((job) => ({
      id: job.id,
      name: job.name || '',
      status: String(job.status || ''),
      conclusion: job.conclusion || null,
      startedAt: job.started_at || null,
      completedAt: job.completed_at || null,
      htmlUrl: job.html_url || '',
      runnerName: job.runner_name || null,
      labels: job.labels || [],
      steps: (job.steps || []).map((step) => ({
        name: step.name || '',
        status: step.status || '',
        conclusion: step.conclusion || null,
        number: step.number,
      })),
    }));
  } catch (error) {
    throw new Error(`Failed to list jobs for workflow run ${owner}/${repo}#${runId}: ${error}`);
  }
}

export async function getJobLogs(
  client: Octokit,
  owner: string,
  repo: string,
  jobId: number
): Promise<string> {
  try {
    const response = await client.rest.actions.downloadJobLogsForWorkflowRun({
      owner,
      repo,
      job_id: jobId,
    });

    return typeof response.data === 'string' ? response.data : String(response.data);
  } catch (error) {
    throw new Error(`Failed to get job logs for ${owner}/${repo} job ${jobId}: ${error}`);
  }
}

// ─── GitHub Releases ───────────────────────────────────────────────

export async function listReleases(client: Octokit, owner: string, repo: string) {
  try {
    const response = await client.rest.repos.listReleases({
      owner,
      repo,
      per_page: 30,
    });

    let foundLatest = false;
    return response.data.map((release) => {
      let isLatest = false;
      if (!foundLatest && !release.draft && !release.prerelease) {
        isLatest = true;
        foundLatest = true;
      }
      return {
        id: release.id,
        tagName: release.tag_name || '',
        name: release.name || '',
        body: release.body || '',
        draft: release.draft || false,
        prerelease: release.prerelease || false,
        createdAt: release.created_at,
        publishedAt: release.published_at || null,
        htmlUrl: release.html_url,
        author: release.author?.login || 'unknown',
        authorAvatarUrl: release.author?.avatar_url || '',
        isLatest,
      };
    });
  } catch (error) {
    throw new Error(`Failed to list releases for ${owner}/${repo}: ${error}`);
  }
}

export async function getRelease(client: Octokit, owner: string, repo: string, releaseId: number) {
  try {
    const response = await client.rest.repos.getRelease({
      owner,
      repo,
      release_id: releaseId,
    });

    const release = response.data;
    return {
      id: release.id,
      tagName: release.tag_name || '',
      name: release.name || '',
      body: release.body || '',
      draft: release.draft || false,
      prerelease: release.prerelease || false,
      createdAt: release.created_at,
      publishedAt: release.published_at || null,
      htmlUrl: release.html_url,
      author: release.author?.login || 'unknown',
      authorAvatarUrl: release.author?.avatar_url || '',
      targetCommitish: release.target_commitish || '',
      isLatest: !release.draft && !release.prerelease,
    };
  } catch (error) {
    throw new Error(`Failed to get release ${releaseId} for ${owner}/${repo}: ${error}`);
  }
}

export async function createRelease(
  client: Octokit,
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
  try {
    const response = await client.rest.repos.createRelease({
      owner,
      repo,
      tag_name: data.tagName,
      name: data.name,
      body: data.body,
      draft: data.draft,
      prerelease: data.prerelease,
      make_latest: data.makeLatest,
      ...(data.targetCommitish ? { target_commitish: data.targetCommitish } : {}),
    });

    const release = response.data;
    return {
      id: release.id,
      tagName: release.tag_name || '',
      name: release.name || '',
      body: release.body || '',
      draft: release.draft || false,
      prerelease: release.prerelease || false,
      htmlUrl: release.html_url,
    };
  } catch (error) {
    throw new Error(`Failed to create release for ${owner}/${repo}: ${error}`);
  }
}

export async function updateRelease(
  client: Octokit,
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
  try {
    const response = await client.rest.repos.updateRelease({
      owner,
      repo,
      release_id: releaseId,
      ...(data.tagName !== undefined ? { tag_name: data.tagName } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.draft !== undefined ? { draft: data.draft } : {}),
      ...(data.prerelease !== undefined ? { prerelease: data.prerelease } : {}),
      ...(data.makeLatest !== undefined ? { make_latest: data.makeLatest } : {}),
    });

    const release = response.data;
    return {
      id: release.id,
      tagName: release.tag_name || '',
      name: release.name || '',
      body: release.body || '',
      draft: release.draft || false,
      prerelease: release.prerelease || false,
      htmlUrl: release.html_url,
    };
  } catch (error) {
    throw new Error(`Failed to update release ${releaseId} for ${owner}/${repo}: ${error}`);
  }
}

export async function deleteRelease(
  client: Octokit,
  owner: string,
  repo: string,
  releaseId: number
): Promise<void> {
  try {
    await client.rest.repos.deleteRelease({
      owner,
      repo,
      release_id: releaseId,
    });
  } catch (error) {
    throw new Error(`Failed to delete release ${releaseId} for ${owner}/${repo}: ${error}`);
  }
}

// ─── Search ───────────────────────────────────────────────

export async function searchIssuesAndPullRequests(
  client: Octokit,
  query: string,
  perPage: number = 30
) {
  try {
    const { data } = await client.search.issuesAndPullRequests({
      q: query,
      per_page: perPage,
      sort: 'updated',
      order: 'desc',
    });
    return {
      totalCount: data.total_count,
      items: data.items.map((item) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state,
        htmlUrl: item.html_url,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        closedAt: item.closed_at,
        labels: item.labels?.map((l) => (typeof l === 'string' ? l : l.name || '')) || [],
        repoFullName: item.repository_url.replace('https://api.github.com/repos/', ''),
        isPullRequest: !!item.pull_request,
        author: item.user?.login || '',
        pullRequest: item.pull_request
          ? { mergedAt: item.pull_request.merged_at ?? null }
          : undefined,
      })),
    };
  } catch (error) {
    throw new Error(`Failed to search issues and pull requests: ${error}`);
  }
}

// ─── User Events ───────────────────────────────────────────────

export async function listUserEvents(client: Octokit, username: string, perPage: number = 30) {
  try {
    const { data } = await client.activity.listEventsForAuthenticatedUser({
      username,
      per_page: perPage,
    });
    return data.map((event) => {
      const payload = event.payload as
        | {
            action?: string;
            ref_type?: string;
            ref?: string;
            size?: number;
            pull_request?: { number?: number; title?: string };
            issue?: { number?: number; title?: string };
          }
        | undefined;
      return {
        id: event.id,
        type: event.type || '',
        repoName: event.repo?.name || '',
        createdAt: event.created_at || '',
        action: payload?.action || '',
        refType: payload?.ref_type || '',
        ref: payload?.ref || '',
        commitCount: payload?.size || 0,
        prNumber: payload?.pull_request?.number || null,
        prTitle: payload?.pull_request?.title || '',
        issueNumber: payload?.issue?.number || null,
        issueTitle: payload?.issue?.title || '',
      };
    });
  } catch (error) {
    throw new Error(`Failed to list user events: ${error}`);
  }
}

// ─── Sub-Issues ─────────────────────────────────────────────

export async function listSubIssues(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const response = await client.request(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
      {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
      }
    );

    return (
      response.data as {
        id: number;
        number: number;
        title: string;
        state: string;
        html_url: string;
      }[]
    ).map((item) => ({
      id: item.id,
      number: item.number,
      title: item.title,
      state: item.state,
      url: item.html_url,
    }));
  } catch (error: unknown) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status: number }).status
        : undefined;
    if (status === 404 || status === 403) {
      return [];
    }
    throw new Error(`Failed to list sub-issues for ${owner}/${repo}#${issueNumber}: ${error}`);
  }
}

export async function getParentIssue(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{ id: number; number: number; title: string; state: string; url: string } | null> {
  try {
    const response = await client.request(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/parent',
      {
        owner,
        repo,
        issue_number: issueNumber,
      }
    );

    const item = response.data as {
      id: number;
      number: number;
      title: string;
      state: string;
      html_url: string;
    };

    return {
      id: item.id,
      number: item.number,
      title: item.title,
      state: item.state,
      url: item.html_url,
    };
  } catch (error: unknown) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status: number }).status
        : undefined;
    if (status === 404 || status === 403) {
      return null;
    }
    throw new Error(`Failed to get parent issue for ${owner}/${repo}#${issueNumber}: ${error}`);
  }
}

export async function createSubIssue(
  client: Octokit,
  owner: string,
  repo: string,
  parentIssueNumber: number,
  title: string,
  body: string,
  labels?: string[]
): Promise<{ number: number; url: string }> {
  try {
    const issueResponse = await client.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    const subIssueId = issueResponse.data.id;

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

export async function addExistingSubIssue(
  client: Octokit,
  owner: string,
  repo: string,
  parentIssueNumber: number,
  subIssueId: number
): Promise<void> {
  try {
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
