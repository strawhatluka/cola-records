import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { CREATE_TABLES, SCHEMA_VERSION, MIGRATIONS } from './schema';
import type { Contribution } from '../ipc/channels';

/** Database row type for contributions table */
interface ContributionRow {
  id: string;
  repository_url: string;
  local_path: string;
  issue_number: number | null;
  issue_title: string | null;
  branch_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  type: string | null;
  pr_url: string | null;
  pr_number: number | null;
  pr_status: string | null;
  upstream_url: string | null;
  is_fork: number | null;
  remotes_valid: number | null;
}

/**
 * Database Service
 *
 * Manages SQLite database connection and operations
 */
export class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'cola-records.db');
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');

      // Create tables
      this.db.exec(CREATE_TABLES);

      // Run migrations if needed
      await this.runMigrations();

      // Database initialized
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get the database instance (ensures it's initialized)
   */
  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    const db = this.getDb();

    // Get current schema version
    const currentVersion = db
      .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
      .get() as { version: number } | undefined;
    const version = currentVersion?.version || 0;
    // Run migrations from current version to target

    // Run all migrations after current version
    for (let v = version + 1; v <= SCHEMA_VERSION; v++) {
      if (MIGRATIONS[v]) {
        db.exec(MIGRATIONS[v]);
        db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
          v,
          Date.now()
        );
      }
    }
  }

  // ============================================
  // Contributions CRUD Operations
  // ============================================

  /**
   * Create a new contribution
   */
  createContribution(
    contribution: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt'>,
    createdAt?: Date
  ): Contribution {
    const db = this.getDb();
    const id = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const createdAtTimestamp = createdAt ? createdAt.getTime() : now;

    const stmt = db.prepare(`
      INSERT INTO contributions (
        id, repository_url, local_path, issue_number, issue_title, branch_name, status,
        created_at, updated_at, pr_url, pr_number, pr_status, upstream_url, is_fork, remotes_valid, type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      contribution.repositoryUrl,
      contribution.localPath,
      contribution.issueNumber ?? 0,
      contribution.issueTitle ?? '',
      contribution.branchName,
      contribution.status,
      createdAtTimestamp,
      now,
      contribution.prUrl || null,
      contribution.prNumber || null,
      contribution.prStatus || null,
      contribution.upstreamUrl || null,
      contribution.isFork ? 1 : 0,
      contribution.remotesValid ? 1 : 0,
      contribution.type || 'contribution'
    );

    return {
      id,
      ...contribution,
      createdAt: new Date(createdAtTimestamp),
      updatedAt: new Date(now),
    };
  }

  /**
   * Get all contributions
   */
  getAllContributions(): Contribution[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM contributions ORDER BY created_at DESC');
    const rows = stmt.all() as ContributionRow[];

    return rows.map(this.rowToContribution);
  }

  /**
   * Get contribution by ID
   */
  getContributionById(id: string): Contribution | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM contributions WHERE id = ?');
    const row = stmt.get(id) as ContributionRow | undefined;

    return row ? this.rowToContribution(row) : null;
  }

  /**
   * Update a contribution
   */
  updateContribution(id: string, updates: Partial<Contribution>): Contribution {
    const db = this.getDb();
    const current = this.getContributionById(id);

    if (!current) {
      throw new Error(`Contribution with id ${id} not found`);
    }

    const merged = { ...current, ...updates };
    const now = Date.now();
    const createdAtTimestamp = updates.createdAt
      ? updates.createdAt.getTime()
      : current.createdAt.getTime();

    const stmt = db.prepare(`
      UPDATE contributions
      SET repository_url = ?, local_path = ?, issue_number = ?, issue_title = ?, branch_name = ?, status = ?,
          pr_url = ?, pr_number = ?, pr_status = ?, upstream_url = ?, is_fork = ?, remotes_valid = ?,
          created_at = ?, updated_at = ?, type = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.repositoryUrl,
      merged.localPath,
      merged.issueNumber ?? 0,
      merged.issueTitle ?? '',
      merged.branchName,
      merged.status,
      merged.prUrl || null,
      merged.prNumber || null,
      merged.prStatus || null,
      merged.upstreamUrl || null,
      merged.isFork ? 1 : 0,
      merged.remotesValid ? 1 : 0,
      createdAtTimestamp,
      now,
      merged.type || 'contribution',
      id
    );

    return {
      ...merged,
      createdAt: new Date(createdAtTimestamp),
      updatedAt: new Date(now),
    };
  }

  /**
   * Delete a contribution
   */
  deleteContribution(id: string): void {
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM contributions WHERE id = ?');
    stmt.run(id);
  }

  // ============================================
  // Settings Operations
  // ============================================

  /**
   * Get a setting value
   */
  getSetting(key: string): string | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;

    return row?.value || null;
  }

  /**
   * Set a setting value
   */
  setSetting(key: string, value: string): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `);

    const now = Date.now();
    stmt.run(key, value, now, value, now);
  }

  /**
   * Get all settings
   */
  getAllSettings(): Record<string, string> {
    const db = this.getDb();
    const stmt = db.prepare('SELECT key, value FROM settings');
    const rows = stmt.all() as { key: string; value: string }[];

    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  // ============================================
  // GitHub Cache Operations
  // ============================================

  /**
   * Get cached value
   */
  getCacheValue(key: string): string | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT value, expires_at FROM github_cache WHERE key = ?');
    const row = stmt.get(key) as { value: string; expires_at: number } | undefined;

    if (!row) return null;

    // Check if expired
    if (row.expires_at < Date.now()) {
      this.deleteCacheValue(key);
      return null;
    }

    return row.value;
  }

  /**
   * Set cached value
   */
  setCacheValue(key: string, value: string, ttlMs: number): void {
    const db = this.getDb();
    const expiresAt = Date.now() + ttlMs;

    const stmt = db.prepare(`
      INSERT INTO github_cache (key, value, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, expires_at = ?
    `);

    stmt.run(key, value, expiresAt, value, expiresAt);
  }

  /**
   * Delete cached value
   */
  deleteCacheValue(key: string): void {
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM github_cache WHERE key = ?');
    stmt.run(key);
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache(): void {
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM github_cache WHERE expires_at < ?');
    stmt.run(Date.now());
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Convert database row to Contribution object
   */
  /**
   * Get contributions filtered by type
   */
  getContributionsByType(type: 'project' | 'contribution'): Contribution[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM contributions WHERE type = ? ORDER BY created_at DESC');
    const rows = stmt.all(type) as ContributionRow[];

    return rows.map(this.rowToContribution);
  }

  private rowToContribution(row: ContributionRow): Contribution {
    return {
      id: row.id,
      repositoryUrl: row.repository_url,
      localPath: row.local_path,
      issueNumber: row.issue_number || undefined,
      issueTitle: row.issue_title || undefined,
      branchName: row.branch_name,
      status: row.status as 'in_progress' | 'ready' | 'submitted' | 'merged',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      type: (row.type || 'contribution') as 'project' | 'contribution',
      prUrl: row.pr_url || undefined,
      prNumber: row.pr_number || undefined,
      prStatus: (row.pr_status || undefined) as 'open' | 'closed' | 'merged' | undefined,
      upstreamUrl: row.upstream_url || undefined,
      isFork: row.is_fork === 1,
      remotesValid: row.remotes_valid === 1,
    };
  }
}

// Export singleton instance
export const database = new DatabaseService();
