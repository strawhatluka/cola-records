import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sub-services
const mockSearchIssues = vi.fn();
const mockGetRepository = vi.fn();
const mockValidateToken = vi.fn();
const mockGetAuthenticatedUser = vi.fn();
const mockSearchRepositoriesByTopic = vi.fn();
const mockGetRepositoryTree = vi.fn();
const mockResetGraphQLClient = vi.fn();
const mockResetRestClient = vi.fn();

vi.mock('../../../src/main/services/github-graphql.service', () => ({
  gitHubGraphQLService: {
    searchIssues: (...args: unknown[]) => mockSearchIssues(...args),
    getRepository: (...args: unknown[]) => mockGetRepository(...args),
    validateToken: (...args: unknown[]) => mockValidateToken(...args),
    getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
    searchRepositoriesByTopic: (...args: unknown[]) => mockSearchRepositoriesByTopic(...args),
    getRepositoryTree: (...args: unknown[]) => mockGetRepositoryTree(...args),
    resetClient: () => mockResetGraphQLClient(),
  },
}));

const mockRestGetIssue = vi.fn();
const mockRestCreateIssueComment = vi.fn();
const mockRestForkRepository = vi.fn();
const mockRestCreatePullRequest = vi.fn();
const mockRestGetUserRepositories = vi.fn();
const mockRestGetRateLimit = vi.fn();

vi.mock('../../../src/main/services/github-rest.service', () => ({
  gitHubRestService: {
    getIssue: (...args: unknown[]) => mockRestGetIssue(...args),
    createIssueComment: (...args: unknown[]) => mockRestCreateIssueComment(...args),
    forkRepository: (...args: unknown[]) => mockRestForkRepository(...args),
    createPullRequest: (...args: unknown[]) => mockRestCreatePullRequest(...args),
    getUserRepositories: (...args: unknown[]) => mockRestGetUserRepositories(...args),
    getRateLimit: (...args: unknown[]) => mockRestGetRateLimit(...args),
    resetClient: () => mockResetRestClient(),
  },
}));

const mockGetCacheValue = vi.fn();
const mockSetCacheValue = vi.fn();
const mockDeleteCacheValue = vi.fn();
const mockCleanupExpiredCache = vi.fn();

vi.mock('../../../src/main/database', () => ({
  database: {
    getCacheValue: (...args: unknown[]) => mockGetCacheValue(...args),
    setCacheValue: (...args: unknown[]) => mockSetCacheValue(...args),
    deleteCacheValue: (...args: unknown[]) => mockDeleteCacheValue(...args),
    cleanupExpiredCache: () => mockCleanupExpiredCache(),
  },
}));

vi.mock('../../../src/main/services/environment.service', () => ({
  env: {
    getNumber: vi.fn(() => 24),
  },
}));

import { GitHubService } from '../../../src/main/services/github.service';

describe('GitHubService', () => {
  let service: GitHubService;

  beforeEach(() => {
    service = new GitHubService();
    vi.clearAllMocks();
    mockGetCacheValue.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchIssues', () => {
    it('fetches from API and caches result', async () => {
      const issues = [{ id: 'I_1', title: 'Bug' }];
      mockSearchIssues.mockResolvedValue(issues);

      const result = await service.searchIssues('react');
      expect(result).toEqual(issues);
      expect(mockSearchIssues).toHaveBeenCalledWith('react', ['good first issue']);
      expect(mockSetCacheValue).toHaveBeenCalled();
    });

    it('returns cached value when available', async () => {
      const cached = [{ id: 'I_cached', title: 'Cached' }];
      mockGetCacheValue.mockReturnValue(JSON.stringify(cached));

      const result = await service.searchIssues('react');
      expect(result).toEqual(cached);
      expect(mockSearchIssues).not.toHaveBeenCalled();
    });

    it('skips cache when skipCache=true', async () => {
      const cached = [{ id: 'I_cached' }];
      mockGetCacheValue.mockReturnValue(JSON.stringify(cached));
      const fresh = [{ id: 'I_fresh' }];
      mockSearchIssues.mockResolvedValue(fresh);

      const result = await service.searchIssues('react', ['good first issue'], true);
      expect(result).toEqual(fresh);
      expect(mockSearchIssues).toHaveBeenCalled();
    });
  });

  describe('getRepository', () => {
    it('fetches and caches repository', async () => {
      const repo = { id: 'R_1', name: 'test' };
      mockGetRepository.mockResolvedValue(repo);

      const result = await service.getRepository('org', 'test');
      expect(result).toEqual(repo);
    });
  });

  describe('validateToken', () => {
    it('delegates to GraphQL service', async () => {
      mockValidateToken.mockResolvedValue(true);
      const result = await service.validateToken('token');
      expect(result).toBe(true);
    });
  });

  describe('createIssueComment', () => {
    it('creates comment and invalidates cache', async () => {
      mockRestCreateIssueComment.mockResolvedValue(undefined);
      await service.createIssueComment('org', 'repo', 42, 'comment');
      expect(mockRestCreateIssueComment).toHaveBeenCalledWith('org', 'repo', 42, 'comment');
      expect(mockDeleteCacheValue).toHaveBeenCalled();
    });
  });

  describe('forkRepository', () => {
    it('delegates to REST service', async () => {
      const fork = { name: 'repo', fullName: 'user/repo' };
      mockRestForkRepository.mockResolvedValue(fork);

      const result = await service.forkRepository('org', 'repo');
      expect(result).toEqual(fork);
    });
  });

  describe('clearCache', () => {
    it('cleans up expired cache', () => {
      service.clearCache();
      expect(mockCleanupExpiredCache).toHaveBeenCalled();
    });
  });

  describe('setCacheEnabled', () => {
    it('disables caching', async () => {
      service.setCacheEnabled(false);
      const issues = [{ id: 'I_1' }];
      mockSearchIssues.mockResolvedValue(issues);

      await service.searchIssues('test');
      // Should not try to read from or write to cache
      expect(mockGetCacheValue).not.toHaveBeenCalled();
      expect(mockSetCacheValue).not.toHaveBeenCalled();
    });
  });

  describe('resetClients', () => {
    it('resets both GraphQL and REST clients', () => {
      service.resetClients();
      expect(mockResetGraphQLClient).toHaveBeenCalled();
      expect(mockResetRestClient).toHaveBeenCalled();
    });
  });
});
