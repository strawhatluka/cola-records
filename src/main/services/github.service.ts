import type { GitHubIssue, GitHubRepository } from '../ipc/channels';
import { gitHubGraphQLService } from './github-graphql.service';
import { gitHubRestService } from './github-rest.service';
import { database } from '../database';
import { env } from './environment.service';

/**
 * GitHub Service
 *
 * Unified GitHub API service with caching
 */
export class GitHubService {
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 24 * 60 * 60 * 1000; // 24 hours in ms

  constructor() {
    // Load cache TTL from environment
    const ttlHours = env.getNumber('CACHE_TTL_HOURS', 24);
    this.cacheTTL = ttlHours * 60 * 60 * 1000;
  }

  /**
   * Get cache key for a query
   */
  private getCacheKey(prefix: string, ...params: any[]): string {
    return `${prefix}:${params.join(':')}`;
  }

  /**
   * Get cached value or fetch from API
   */
  private async getCached<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    skipCache = false
  ): Promise<T> {
    // Check cache first (unless skipped)
    if (this.cacheEnabled && !skipCache) {
      const cached = database.getCacheValue(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch (error) {
          console.error('Failed to parse cached value:', error);
        }
      }
    }

    // Fetch from API
    const result = await fetchFn();

    // Store in cache
    if (this.cacheEnabled) {
      try {
        database.setCacheValue(cacheKey, JSON.stringify(result), this.cacheTTL);
      } catch (error) {
        console.error('Failed to cache value:', error);
      }
    }

    return result;
  }

  /**
   * Search for GitHub issues
   */
  async searchIssues(
    query: string,
    labels: string[] = ['good first issue'],
    skipCache = false
  ): Promise<GitHubIssue[]> {
    const cacheKey = this.getCacheKey('issues', query, labels.join(','));

    return this.getCached(
      cacheKey,
      () => gitHubGraphQLService.searchIssues(query, labels),
      skipCache
    );
  }

  /**
   * Get repository information
   */
  async getRepository(
    owner: string,
    repo: string,
    skipCache = false
  ): Promise<GitHubRepository> {
    const cacheKey = this.getCacheKey('repo', owner, repo);

    return this.getCached(
      cacheKey,
      () => gitHubGraphQLService.getRepository(owner, repo),
      skipCache
    );
  }

  /**
   * Validate GitHub token
   */
  async validateToken(token: string): Promise<boolean> {
    return gitHubGraphQLService.validateToken(token);
  }

  /**
   * Get authenticated user
   */
  async getAuthenticatedUser(): Promise<{ login: string; name: string; email: string }> {
    const cacheKey = this.getCacheKey('user', 'authenticated');

    return this.getCached(
      cacheKey,
      () => gitHubGraphQLService.getAuthenticatedUser(),
      false
    );
  }

  /**
   * Get issue details
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    skipCache = false
  ): Promise<any> {
    const cacheKey = this.getCacheKey('issue', owner, repo, issueNumber);

    return this.getCached(
      cacheKey,
      () => gitHubRestService.getIssue(owner, repo, issueNumber),
      skipCache
    );
  }

  /**
   * Create issue comment
   */
  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    await gitHubRestService.createIssueComment(owner, repo, issueNumber, body);
    // Invalidate issue cache
    const cacheKey = this.getCacheKey('issue', owner, repo, issueNumber);
    database.deleteCacheValue(cacheKey);
  }

  /**
   * Fork repository
   */
  async forkRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return gitHubRestService.forkRepository(owner, repo);
  }

  /**
   * Create pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string
  ): Promise<any> {
    return gitHubRestService.createPullRequest(owner, repo, title, head, base, body);
  }

  /**
   * Get user repositories
   */
  async getUserRepositories(username?: string, skipCache = false): Promise<any[]> {
    const cacheKey = this.getCacheKey('repos', username || 'authenticated');

    return this.getCached(
      cacheKey,
      () => gitHubRestService.getUserRepositories(username),
      skipCache
    );
  }

  /**
   * Search repositories by topic
   */
  async searchRepositoriesByTopic(
    topic: string,
    limit = 20,
    skipCache = false
  ): Promise<any[]> {
    const cacheKey = this.getCacheKey('repos-topic', topic, limit);

    return this.getCached(
      cacheKey,
      () => gitHubGraphQLService.searchRepositoriesByTopic(topic, limit),
      skipCache
    );
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<any> {
    return gitHubRestService.getRateLimit();
  }

  /**
   * Clear all GitHub cache
   */
  clearCache(): void {
    // Note: This would need a more sophisticated implementation
    // to only clear GitHub-related cache entries
    console.log('Cache clearing not fully implemented - cleaning expired cache');
    database.cleanupExpiredCache();
  }

  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }

  /**
   * Get repository file tree
   */
  async getRepositoryTree(owner: string, repo: string, branch: string = 'main'): Promise<any> {
    const cacheKey = this.getCacheKey('tree', owner, repo, branch);

    return this.getCached(
      cacheKey,
      () => gitHubGraphQLService.getRepositoryTree(owner, repo, branch),
      false
    );
  }

  /**
   * Reset API clients (useful when token changes)
   */
  resetClients(): void {
    gitHubGraphQLService.resetClient();
    gitHubRestService.resetClient();
  }
}

// Export singleton instance
export const gitHubService = new GitHubService();
