/**
 * Database Schema Definitions
 *
 * SQLite database schema for Cola Records
 */

export const SCHEMA_VERSION = 1;

/**
 * SQL statements to create all tables
 */
export const CREATE_TABLES = `
  -- Contributions table
  CREATE TABLE IF NOT EXISTS contributions (
    id TEXT PRIMARY KEY,
    repository_url TEXT NOT NULL,
    local_path TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    issue_title TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('in_progress', 'ready', 'submitted', 'merged')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Create index on status for faster filtering
  CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
  CREATE INDEX IF NOT EXISTS idx_contributions_created_at ON contributions(created_at);

  -- Application settings table
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- GitHub API cache table
  CREATE TABLE IF NOT EXISTS github_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- Create index on expiration for cleanup
  CREATE INDEX IF NOT EXISTS idx_github_cache_expires_at ON github_cache(expires_at);

  -- Schema version table
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );

  -- Insert initial schema version
  INSERT OR IGNORE INTO schema_version (version, applied_at)
  VALUES (${SCHEMA_VERSION}, ${Date.now()});
`;

/**
 * Migrations for future schema changes
 */
export const MIGRATIONS: Record<number, string> = {
  // Example: Version 2 migration
  // 2: `ALTER TABLE contributions ADD COLUMN pr_url TEXT;`,
};
