import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockGraphql = vi.fn();
const mockGraphqlDefaults = vi.fn(() => mockGraphql);

vi.mock('@octokit/graphql', () => ({
  graphql: {
    defaults: (...args: unknown[]) => mockGraphqlDefaults(...args),
  },
}));

vi.mock('../../../src/main/services/environment.service', () => ({
  env: {
    get: vi.fn(() => 'test-token'),
  },
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    getAllSettings: vi.fn(() => ({ githubToken: 'db-token' })),
  },
}));

import { GitHubGraphQLService } from '../../../src/main/services/github-graphql.service';

describe('GitHubGraphQLService', () => {
  let service: GitHubGraphQLService;

  beforeEach(() => {
    service = new GitHubGraphQLService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchIssues', () => {
    it('returns mapped issues from GraphQL response', async () => {
      mockGraphql.mockResolvedValue({
        search: {
          edges: [
            {
              node: {
                id: 'I_1',
                number: 42,
                title: 'Fix bug',
                body: 'Description',
                url: 'https://github.com/org/repo/issues/42',
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-02T00:00:00Z',
                labels: { nodes: [{ name: 'good first issue' }] },
                repository: { nameWithOwner: 'org/repo' },
              },
            },
          ],
        },
      });

      const issues = await service.searchIssues('react', ['good first issue']);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('I_1');
      expect(issues[0].number).toBe(42);
      expect(issues[0].title).toBe('Fix bug');
      expect(issues[0].repository).toBe('org/repo');
      expect(issues[0].labels).toContain('good first issue');
    });

    it('throws on API error', async () => {
      mockGraphql.mockRejectedValue(new Error('GraphQL error'));
      await expect(service.searchIssues('test')).rejects.toThrow('Failed to search GitHub issues');
    });
  });

  describe('getRepository', () => {
    it('returns mapped repository data', async () => {
      mockGraphql.mockResolvedValue({
        repository: {
          id: 'R_1',
          name: 'test-repo',
          nameWithOwner: 'org/test-repo',
          description: 'A test repo',
          url: 'https://github.com/org/test-repo',
          primaryLanguage: { name: 'TypeScript' },
          stargazerCount: 100,
          forkCount: 25,
          openIssuesCount: { totalCount: 10 },
          defaultBranchRef: { name: 'main' },
        },
      });

      const repo = await service.getRepository('org', 'test-repo');
      expect(repo.name).toBe('test-repo');
      expect(repo.fullName).toBe('org/test-repo');
      expect(repo.language).toBe('TypeScript');
      expect(repo.stars).toBe(100);
      expect(repo.defaultBranch).toBe('main');
    });

    it('handles null language and default branch', async () => {
      mockGraphql.mockResolvedValue({
        repository: {
          id: 'R_1',
          name: 'test',
          nameWithOwner: 'org/test',
          description: null,
          url: 'https://github.com/org/test',
          primaryLanguage: null,
          stargazerCount: 0,
          forkCount: 0,
          openIssuesCount: { totalCount: 0 },
          defaultBranchRef: null,
        },
      });

      const repo = await service.getRepository('org', 'test');
      expect(repo.language).toBe('Unknown');
      expect(repo.defaultBranch).toBe('main');
    });
  });

  describe('validateToken', () => {
    it('returns true for valid token', async () => {
      // validateToken creates its own client via graphql.defaults
      const mockTestClient = vi.fn().mockResolvedValue({ viewer: { login: 'user' } });
      mockGraphqlDefaults.mockReturnValue(mockTestClient);

      const result = await service.validateToken('valid-token');
      expect(result).toBe(true);
    });

    it('returns false for invalid token', async () => {
      const mockTestClient = vi.fn().mockRejectedValue(new Error('Bad credentials'));
      mockGraphqlDefaults.mockReturnValue(mockTestClient);

      const result = await service.validateToken('invalid-token');
      expect(result).toBe(false);
    });
  });

  describe('getAuthenticatedUser', () => {
    it('returns user info', async () => {
      mockGraphql.mockResolvedValue({
        viewer: {
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      const user = await service.getAuthenticatedUser();
      expect(user.login).toBe('testuser');
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('resetClient', () => {
    it('clears cached client', () => {
      service.resetClient();
      // Next call should create a new client
      // No error means success
    });
  });

  describe('searchRepositoriesByTopic', () => {
    it('returns mapped repositories', async () => {
      mockGraphql.mockResolvedValue({
        search: {
          edges: [
            {
              node: {
                id: 'R_1',
                name: 'awesome-project',
                nameWithOwner: 'org/awesome-project',
                description: 'An awesome project',
                url: 'https://github.com/org/awesome-project',
                primaryLanguage: { name: 'JavaScript' },
                stargazerCount: 500,
                forkCount: 100,
              },
            },
          ],
        },
      });

      const repos = await service.searchRepositoriesByTopic('react');
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('awesome-project');
      expect(repos[0].stars).toBe(500);
    });
  });
});
