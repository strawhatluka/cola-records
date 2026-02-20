/**
 * GitHub REST Service — Issues domain
 *
 * Standalone functions for issue CRUD, comments, assignees, and issue reactions.
 */
import type { Octokit } from '@octokit/rest';

export async function getIssue(client: Octokit, owner: string, repo: string, issueNumber: number) {
  try {
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
      labels: response.data.labels.map((label) =>
        typeof label === 'string' ? label : label.name || ''
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

export async function listIssues(
  client: Octokit,
  owner: string,
  repo: string,
  options: { state?: 'open' | 'closed' | 'all' } = {}
) {
  try {
    const response = await client.issues.listForRepo({
      owner,
      repo,
      state: options.state || 'open',
      per_page: 100,
      sort: 'updated',
      direction: 'desc',
    });

    return response.data
      .filter((item) => !item.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        url: issue.html_url,
        state: issue.state,
        labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name || '')),
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at),
        author: issue.user?.login || 'unknown',
        authorAvatarUrl: issue.user?.avatar_url || '',
      }));
  } catch (error) {
    throw new Error(`Failed to list issues for ${owner}/${repo}: ${error}`);
  }
}

export async function createIssue(
  client: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[]
): Promise<{ number: number; url: string }> {
  try {
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

export async function updateIssue(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  updates: { state?: 'open' | 'closed'; state_reason?: 'completed' | 'not_planned' | 'reopened' }
): Promise<void> {
  try {
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

export async function addAssignees(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  assignees: string[]
): Promise<void> {
  try {
    await client.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees,
    });
  } catch (error) {
    throw new Error(`Failed to add assignees to issue #${issueNumber}: ${error}`);
  }
}

export async function listIssueComments(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const response = await client.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
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
    throw new Error(`Failed to list comments for ${owner}/${repo}#${issueNumber}: ${error}`);
  }
}

export async function createIssueComment(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  try {
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

export async function listIssueReactions(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const response = await client.reactions.listForIssue({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    return response.data.map((r) => ({
      id: r.id,
      content: r.content,
      user: r.user?.login || 'unknown',
    }));
  } catch (error) {
    throw new Error(`Failed to list reactions for ${owner}/${repo}#${issueNumber}: ${error}`);
  }
}

export async function addIssueReaction(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  content: string
) {
  try {
    const response = await client.reactions.createForIssue({
      owner,
      repo,
      issue_number: issueNumber,
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
    throw new Error(`Failed to add reaction to ${owner}/${repo}#${issueNumber}: ${error}`);
  }
}

export async function deleteIssueReaction(
  client: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  reactionId: number
): Promise<void> {
  try {
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
