import { Octokit } from '@octokit/rest';
import { env } from './environment.service';

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
      const token = env.get('GITHUB_TOKEN');
      if (!token) {
        throw new Error('GitHub token not configured. Please set GITHUB_TOKEN in settings.');
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
      };
    } catch (error) {
      console.error('GitHub REST get issue error:', error);
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
      console.error('GitHub REST create comment error:', error);
      throw new Error(`Failed to create comment on ${owner}/${repo}#${issueNumber}: ${error}`);
    }
  }

  /**
   * Fork a repository
   */
  async forkRepository(owner: string, repo: string): Promise<string> {
    try {
      const client = this.getClient();
      const response = await client.repos.createFork({
        owner,
        repo,
      });

      return response.data.clone_url;
    } catch (error) {
      console.error('GitHub REST fork error:', error);
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
      console.error('GitHub REST create PR error:', error);
      throw new Error(`Failed to create pull request on ${owner}/${repo}: ${error}`);
    }
  }

  /**
   * Get repository contents
   */
  async getRepositoryContents(
    owner: string,
    repo: string,
    filePath: string = ''
  ): Promise<any[]> {
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
      console.error('GitHub REST get contents error:', error);
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
      console.error('GitHub REST get repositories error:', error);
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
      console.error('GitHub REST star error:', error);
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
      console.error('GitHub REST unstar error:', error);
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
      console.error('GitHub REST rate limit error:', error);
      throw new Error(`Failed to get rate limit: ${error}`);
    }
  }
}

// Export singleton instance
export const gitHubRestService = new GitHubRestService();
