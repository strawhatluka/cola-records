import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { CREATE_TABLES } from '../../../src/main/database/schema';

// Mock electron before importing DatabaseService
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user-data'),
  },
}));

// We test with a real in-memory SQLite database for accuracy
describe('DatabaseService', () => {
  let db: Database.Database;
  let dbService: any;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_TABLES);

    // Dynamically import and create a fresh instance
    const { DatabaseService } = await import('../../../src/main/database/database.service');
    dbService = new DatabaseService();
    // Inject our in-memory database directly
    (dbService as any).db = db;
  });

  afterEach(() => {
    if (db) db.close();
    vi.restoreAllMocks();
  });

  // ── Contribution CRUD ──────────────────────────────────────────

  describe('createContribution', () => {
    it('creates a contribution and returns it with an id', () => {
      const input = {
        repositoryUrl: 'https://github.com/test/repo',
        localPath: '/test/repo',
        issueNumber: 1,
        issueTitle: 'Test issue',
        branchName: 'fix-1',
        status: 'in_progress' as const,
      };

      const result = dbService.createContribution(input);

      expect(result.id).toMatch(/^contrib_/);
      expect(result.repositoryUrl).toBe(input.repositoryUrl);
      expect(result.issueNumber).toBe(1);
      expect(result.status).toBe('in_progress');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('accepts custom createdAt', () => {
      const customDate = new Date('2025-06-15T00:00:00Z');
      const result = dbService.createContribution(
        {
          repositoryUrl: 'https://github.com/test/repo',
          localPath: '/test/repo',
          issueNumber: 2,
          issueTitle: 'Test',
          branchName: 'fix-2',
          status: 'ready' as const,
        },
        customDate
      );

      expect(result.createdAt.getTime()).toBe(customDate.getTime());
    });
  });

  describe('getAllContributions', () => {
    it('returns empty array when no contributions exist', () => {
      const result = dbService.getAllContributions();
      expect(result).toEqual([]);
    });

    it('returns all contributions ordered by created_at DESC', () => {
      dbService.createContribution({
        repositoryUrl: 'https://github.com/test/first',
        localPath: '/test/first',
        issueNumber: 1,
        issueTitle: 'First',
        branchName: 'fix-1',
        status: 'in_progress' as const,
      }, new Date('2025-01-01'));

      dbService.createContribution({
        repositoryUrl: 'https://github.com/test/second',
        localPath: '/test/second',
        issueNumber: 2,
        issueTitle: 'Second',
        branchName: 'fix-2',
        status: 'ready' as const,
      }, new Date('2025-06-01'));

      const all = dbService.getAllContributions();
      expect(all).toHaveLength(2);
      // Most recent first
      expect(all[0].issueTitle).toBe('Second');
      expect(all[1].issueTitle).toBe('First');
    });
  });

  describe('getContributionById', () => {
    it('returns null for non-existent id', () => {
      expect(dbService.getContributionById('nonexistent')).toBeNull();
    });

    it('returns the correct contribution', () => {
      const created = dbService.createContribution({
        repositoryUrl: 'https://github.com/test/repo',
        localPath: '/test/repo',
        issueNumber: 1,
        issueTitle: 'Test',
        branchName: 'fix-1',
        status: 'in_progress' as const,
      });

      const found = dbService.getContributionById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.repositoryUrl).toBe(created.repositoryUrl);
    });
  });

  describe('updateContribution', () => {
    it('updates fields and returns merged result', () => {
      const created = dbService.createContribution({
        repositoryUrl: 'https://github.com/test/repo',
        localPath: '/test/repo',
        issueNumber: 1,
        issueTitle: 'Test',
        branchName: 'fix-1',
        status: 'in_progress' as const,
      });

      const updated = dbService.updateContribution(created.id, {
        status: 'ready' as const,
        prUrl: 'https://github.com/test/repo/pull/1',
        prNumber: 1,
      });

      expect(updated.status).toBe('ready');
      expect(updated.prUrl).toBe('https://github.com/test/repo/pull/1');
      expect(updated.prNumber).toBe(1);
      expect(updated.repositoryUrl).toBe(created.repositoryUrl); // unchanged
    });

    it('throws for non-existent id', () => {
      expect(() =>
        dbService.updateContribution('nonexistent', { status: 'ready' as const })
      ).toThrow('not found');
    });
  });

  describe('deleteContribution', () => {
    it('removes the contribution', () => {
      const created = dbService.createContribution({
        repositoryUrl: 'https://github.com/test/repo',
        localPath: '/test/repo',
        issueNumber: 1,
        issueTitle: 'Test',
        branchName: 'fix-1',
        status: 'in_progress' as const,
      });

      dbService.deleteContribution(created.id);
      expect(dbService.getContributionById(created.id)).toBeNull();
    });

    it('does not throw for non-existent id', () => {
      expect(() => dbService.deleteContribution('nonexistent')).not.toThrow();
    });
  });

  // ── Settings ───────────────────────────────────────────────────

  describe('getSetting', () => {
    it('returns null for non-existent key', () => {
      expect(dbService.getSetting('nonexistent')).toBeNull();
    });

    it('returns the stored value', () => {
      dbService.setSetting('theme', 'dark');
      expect(dbService.getSetting('theme')).toBe('dark');
    });
  });

  describe('setSetting', () => {
    it('creates a new setting', () => {
      dbService.setSetting('key1', 'value1');
      expect(dbService.getSetting('key1')).toBe('value1');
    });

    it('updates an existing setting (upsert)', () => {
      dbService.setSetting('key1', 'value1');
      dbService.setSetting('key1', 'value2');
      expect(dbService.getSetting('key1')).toBe('value2');
    });
  });

  describe('getAllSettings', () => {
    it('returns empty object when no settings exist', () => {
      expect(dbService.getAllSettings()).toEqual({});
    });

    it('returns all settings as key-value pairs', () => {
      dbService.setSetting('theme', 'dark');
      dbService.setSetting('autoFetch', 'true');

      const settings = dbService.getAllSettings();
      expect(settings).toEqual({
        theme: 'dark',
        autoFetch: 'true',
      });
    });
  });

  // ── GitHub Cache ───────────────────────────────────────────────

  describe('getCacheValue', () => {
    it('returns null for non-existent key', () => {
      expect(dbService.getCacheValue('nonexistent')).toBeNull();
    });

    it('returns cached value within TTL', () => {
      dbService.setCacheValue('key1', '{"data": true}', 60_000); // 60s TTL
      expect(dbService.getCacheValue('key1')).toBe('{"data": true}');
    });

    it('returns null and deletes expired cache', () => {
      // Set with very short TTL, then advance time
      const originalNow = Date.now;
      const baseTime = Date.now();

      Date.now = () => baseTime;
      dbService.setCacheValue('key1', 'value', 100); // 100ms TTL

      // Fast-forward past expiry
      Date.now = () => baseTime + 200;
      expect(dbService.getCacheValue('key1')).toBeNull();

      Date.now = originalNow;
    });
  });

  describe('setCacheValue', () => {
    it('stores a value with expiration', () => {
      dbService.setCacheValue('key1', 'value1', 5000);
      expect(dbService.getCacheValue('key1')).toBe('value1');
    });

    it('overwrites existing cached value', () => {
      dbService.setCacheValue('key1', 'old', 5000);
      dbService.setCacheValue('key1', 'new', 5000);
      expect(dbService.getCacheValue('key1')).toBe('new');
    });
  });

  describe('deleteCacheValue', () => {
    it('removes cached value', () => {
      dbService.setCacheValue('key1', 'value', 5000);
      dbService.deleteCacheValue('key1');
      expect(dbService.getCacheValue('key1')).toBeNull();
    });
  });

  describe('cleanupExpiredCache', () => {
    it('removes all expired entries', () => {
      const originalNow = Date.now;
      const baseTime = Date.now();

      Date.now = () => baseTime;
      dbService.setCacheValue('fresh', 'value', 60_000); // Not expired
      dbService.setCacheValue('stale', 'value', 100);    // Will expire

      Date.now = () => baseTime + 200;
      dbService.cleanupExpiredCache();

      expect(dbService.getCacheValue('fresh')).toBe('value');
      // stale was already cleaned up
      Date.now = originalNow;
    });
  });

  // ── Error Handling ─────────────────────────────────────────────

  describe('getDb() guard', () => {
    it('throws when database is not initialized', async () => {
      const { DatabaseService } = await import('../../../src/main/database/database.service');
      const uninitializedDb = new DatabaseService();
      // db is null since we didn't call initialize()
      expect(() => uninitializedDb.getAllContributions()).toThrow('Database not initialized');
    });
  });

  describe('close', () => {
    it('closes the database connection', () => {
      dbService.close();
      expect(() => dbService.getAllContributions()).toThrow();
    });

    it('can be called multiple times without error', () => {
      dbService.close();
      expect(() => dbService.close()).not.toThrow();
    });
  });
});
