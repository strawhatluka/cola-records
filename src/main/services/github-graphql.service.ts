/* eslint-disable @typescript-eslint/no-explicit-any -- GitHub GraphQL API responses are dynamically typed */
import { graphql } from '@octokit/graphql';
import type { GitHubIssue } from '../ipc/channels';
import { env } from './environment.service';
import { database } from '../database';

/**
 * GitHub GraphQL Service
 *
 * Provides GitHub API access via GraphQL for efficient queries
 */
export class GitHubGraphQLService {
  private client: typeof graphql | null = null;

  /**
   * Initialize the GraphQL client with token
   */
  private getClient(): typeof graphql {
    if (!this.client) {
      // First check database settings, then fall back to environment
      const settings = database.getAllSettings();
      const token = settings.githubToken || env.get('GITHUB_TOKEN');

      if (!token) {
        throw new Error(
          'GitHub token not configured. Please set GITHUB_TOKEN in settings or .env file.'
        );
      }

      this.client = graphql.defaults({
        headers: {
          authorization: `token ${token}`,
        },
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
   * Search for GitHub issues with good first issue label
   */
  async searchIssues(
    query: string,
    labels: string[] = ['good first issue']
  ): Promise<GitHubIssue[]> {
    try {
      const client = this.getClient();

      // Build search query
      const labelQuery = labels.map((label) => `label:"${label}"`).join(' ');
      const searchQuery = `${query} ${labelQuery} is:issue is:open sort:updated-desc`;

      const response: any = await client(
        `
        query searchIssues($searchQuery: String!, $first: Int!) {
          search(query: $searchQuery, type: ISSUE, first: $first) {
            issueCount
            edges {
              node {
                ... on Issue {
                  id
                  number
                  title
                  body
                  url
                  createdAt
                  updatedAt
                  labels(first: 10) {
                    nodes {
                      name
                    }
                  }
                  repository {
                    nameWithOwner
                  }
                }
              }
            }
          }
        }
        `,
        {
          searchQuery: searchQuery,
          first: 50, // Limit to 50 results
        }
      );

      return response.search.edges.map((edge: any) => {
        const issue = edge.node;
        return {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body || '',
          url: issue.url,
          repository: issue.repository.nameWithOwner,
          labels: issue.labels.nodes.map((label: any) => label.name),
          createdAt: new Date(issue.createdAt),
          updatedAt: new Date(issue.updatedAt),
        };
      });
    } catch (error) {
      throw new Error(`Failed to search GitHub issues: ${error}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const client = this.getClient();

      const response: any = await client(
        `
        query getRepository($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            id
            name
            nameWithOwner
            description
            url
            primaryLanguage {
              name
            }
            stargazerCount
            forkCount
            openIssuesCount: issues(states: OPEN) {
              totalCount
            }
            defaultBranchRef {
              name
            }
          }
        }
        `,
        {
          owner,
          name: repo,
        }
      );

      const repository = response.repository;
      return {
        id: repository.id,
        name: repository.name,
        fullName: repository.nameWithOwner,
        description: repository.description || '',
        url: repository.url,
        language: repository.primaryLanguage?.name || 'Unknown',
        stars: repository.stargazerCount,
        forks: repository.forkCount,
        openIssues: repository.openIssuesCount.totalCount,
        defaultBranch: repository.defaultBranchRef?.name || 'main',
      };
    } catch (error) {
      throw new Error(`Failed to get repository ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Validate GitHub token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const testClient = graphql.defaults({
        headers: {
          authorization: `token ${token}`,
        },
      });

      await testClient(
        `
        query {
          viewer {
            login
          }
        }
        `
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser(): Promise<{
    login: string;
    name: string;
    email: string;
    avatarUrl: string;
    bio: string;
    followers: number;
    following: number;
    createdAt: string;
    location: string;
    company: string;
  }> {
    try {
      const client = this.getClient();

      const response: any = await client(
        `
        query {
          viewer {
            login
            name
            email
            avatarUrl
            bio
            followers { totalCount }
            following { totalCount }
            createdAt
            location
            company
          }
        }
        `
      );

      return {
        login: response.viewer.login,
        name: response.viewer.name || '',
        email: response.viewer.email || '',
        avatarUrl: response.viewer.avatarUrl || '',
        bio: response.viewer.bio || '',
        followers: response.viewer.followers?.totalCount ?? 0,
        following: response.viewer.following?.totalCount ?? 0,
        createdAt: response.viewer.createdAt || '',
        location: response.viewer.location || '',
        company: response.viewer.company || '',
      };
    } catch (error) {
      throw new Error(`Failed to get authenticated user: ${error}`);
    }
  }

  /**
   * Search repositories by topic
   */
  async searchRepositoriesByTopic(topic: string, limit = 20): Promise<any[]> {
    try {
      const client = this.getClient();

      const response: any = await client(
        `
        query searchRepos($query: String!, $first: Int!) {
          search(query: $query, type: REPOSITORY, first: $first) {
            edges {
              node {
                ... on Repository {
                  id
                  name
                  nameWithOwner
                  description
                  url
                  primaryLanguage {
                    name
                  }
                  stargazerCount
                  forkCount
                }
              }
            }
          }
        }
        `,
        {
          query: `topic:${topic} sort:stars-desc`,
          first: limit,
        }
      );

      return response.search.edges.map((edge: any) => {
        const repo = edge.node;
        return {
          id: repo.id,
          name: repo.name,
          fullName: repo.nameWithOwner,
          description: repo.description || '',
          url: repo.url,
          language: repo.primaryLanguage?.name || 'Unknown',
          stars: repo.stargazerCount,
          forks: repo.forkCount,
        };
      });
    } catch (error) {
      throw new Error(`Failed to search repositories: ${error}`);
    }
  }
  /**
   * Get repository file tree
   */
  /**
   * Get repository file tree
   */
  async getRepositoryTree(owner: string, repo: string, branch: string = 'main'): Promise<any> {
    try {
      const client = this.getClient();

      const query = `
        query($owner: String!, $repo: String!, $expression: String!) {
          repository(owner: $owner, name: $repo) {
            object(expression: $expression) {
              ... on Tree {
                entries {
                  name
                  type
                  mode
                  object {
                    ... on Tree {
                      entries {
                        name
                        type
                      }
                    }
                    ... on Blob {
                      byteSize
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result: any = await client(query, {
        owner,
        repo,
        expression: `${branch}:`,
      });

      return result.repository?.object?.entries || [];
    } catch (error) {
      throw new Error(`Failed to get repository tree for ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Resolve a pull request review thread
   */
  async resolveReviewThread(threadId: string): Promise<void> {
    try {
      const client = this.getClient();

      await client(
        `
        mutation resolveReviewThread($threadId: ID!) {
          resolveReviewThread(input: { threadId: $threadId }) {
            thread {
              id
              isResolved
            }
          }
        }
        `,
        {
          threadId,
        }
      );
    } catch (error) {
      throw new Error(`Failed to resolve review thread ${threadId}: ${error}`);
    }
  }

  /**
   * Unresolve a pull request review thread
   */
  async unresolveReviewThread(threadId: string): Promise<void> {
    try {
      const client = this.getClient();

      await client(
        `
        mutation unresolveReviewThread($threadId: ID!) {
          unresolveReviewThread(input: { threadId: $threadId }) {
            thread {
              id
              isResolved
            }
          }
        }
        `,
        {
          threadId,
        }
      );
    } catch (error) {
      throw new Error(`Failed to unresolve review thread ${threadId}: ${error}`);
    }
  }

  /**
   * Get pull request review threads with their resolution status
   * Returns threads with their GraphQL node IDs needed for resolve/unresolve mutations
   */
  async getPRReviewThreads(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<{ id: string; isResolved: boolean; comments: { databaseId: number }[] }[]> {
    try {
      const client = this.getClient();

      const response: any = await client(
        `
        query getPRReviewThreads($owner: String!, $repo: String!, $prNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $prNumber) {
              reviewThreads(first: 100) {
                nodes {
                  id
                  isResolved
                  comments(first: 1) {
                    nodes {
                      databaseId
                    }
                  }
                }
              }
            }
          }
        }
        `,
        {
          owner,
          repo,
          prNumber,
        }
      );

      const threads = response.repository?.pullRequest?.reviewThreads?.nodes || [];
      return threads.map((thread: any) => ({
        id: thread.id,
        isResolved: thread.isResolved,
        comments: thread.comments.nodes.map((c: any) => ({ databaseId: c.databaseId })),
      }));
    } catch (error) {
      throw new Error(`Failed to get review threads for ${owner}/${repo}#${prNumber}: ${error}`);
    }
  }
}

// Export singleton instance
export const gitHubGraphQLService = new GitHubGraphQLService();
