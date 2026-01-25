import { graphql } from '@octokit/graphql';
import type { GitHubIssue } from '../ipc/channels';
import { env } from './environment.service';

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
      const token = env.get('GITHUB_TOKEN');
      if (!token) {
        throw new Error('GitHub token not configured. Please set GITHUB_TOKEN in settings.');
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
  async searchIssues(query: string, labels: string[] = ['good first issue']): Promise<GitHubIssue[]> {
    try {
      const client = this.getClient();

      // Build search query
      const labelQuery = labels.map(label => `label:"${label}"`).join(' ');
      const searchQuery = `${query} ${labelQuery} is:issue is:open sort:updated-desc`;

      const response: any = await client(
        `
        query searchIssues($query: String!, $first: Int!) {
          search(query: $query, type: ISSUE, first: $first) {
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
          query: searchQuery,
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
      console.error('GitHub GraphQL search error:', error);
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
      console.error('GitHub GraphQL repository error:', error);
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
    } catch (error) {
      console.error('GitHub token validation error:', error);
      return false;
    }
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser(): Promise<{ login: string; name: string; email: string }> {
    try {
      const client = this.getClient();

      const response: any = await client(
        `
        query {
          viewer {
            login
            name
            email
          }
        }
        `
      );

      return {
        login: response.viewer.login,
        name: response.viewer.name || '',
        email: response.viewer.email || '',
      };
    } catch (error) {
      console.error('GitHub user info error:', error);
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
      console.error('GitHub repository search error:', error);
      throw new Error(`Failed to search repositories: ${error}`);
    }
  }
}

// Export singleton instance
export const gitHubGraphQLService = new GitHubGraphQLService();
