/**
 * Database Schema Definitions
 *
 * SQLite database schema for Cola Records
 */

export const SCHEMA_VERSION = 9;

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

  -- Insert initial schema version (version 1 - base schema)
  INSERT OR IGNORE INTO schema_version (version, applied_at)
  VALUES (1, ${Date.now()});
`;

/**
 * Migrations for future schema changes
 */
export const MIGRATIONS: Record<number, string> = {
  // Version 2: Add PR tracking and fork validation columns
  2: `
    ALTER TABLE contributions ADD COLUMN pr_url TEXT;
    ALTER TABLE contributions ADD COLUMN pr_number INTEGER;
    ALTER TABLE contributions ADD COLUMN pr_status TEXT CHECK(pr_status IN ('open', 'closed', 'merged'));
    ALTER TABLE contributions ADD COLUMN upstream_url TEXT;
    ALTER TABLE contributions ADD COLUMN is_fork INTEGER DEFAULT 0;
    ALTER TABLE contributions ADD COLUMN remotes_valid INTEGER DEFAULT 0;
  `,
  // Version 3: Add type column to distinguish projects from contributions
  3: `
    ALTER TABLE contributions ADD COLUMN type TEXT DEFAULT 'contribution';
  `,
  // Version 4: Add dev_scripts table for custom script buttons
  4: `
    CREATE TABLE IF NOT EXISTS dev_scripts (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_path, name)
    );
    CREATE INDEX IF NOT EXISTS idx_dev_scripts_project_path ON dev_scripts(project_path);
  `,
  // Version 5: Add commands column (JSON array) to support multiple commands per script
  5: `
    ALTER TABLE dev_scripts ADD COLUMN commands TEXT;
  `,
  // Version 6: Add terminals column (JSON array) for multi-terminal scripts
  6: `
    ALTER TABLE dev_scripts ADD COLUMN terminals TEXT;
  `,
  // Version 7: Add toggle column (JSON) for toggle-mode scripts
  7: `
    ALTER TABLE dev_scripts ADD COLUMN toggle TEXT;
  `,
  // Version 8: Add notifications table for notification persistence
  8: `
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      dedupe_key TEXT NOT NULL,
      action_label TEXT,
      action_screen TEXT,
      action_context TEXT,
      group_key TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON notifications(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
  `,
  // Version 9: Add project creation metadata columns
  9: `
    ALTER TABLE contributions ADD COLUMN ecosystem TEXT;
    ALTER TABLE contributions ADD COLUMN framework TEXT;
    ALTER TABLE contributions ADD COLUMN package_manager TEXT;
    ALTER TABLE contributions ADD COLUMN is_monorepo INTEGER DEFAULT 0;
    ALTER TABLE contributions ADD COLUMN monorepo_tool TEXT;
    ALTER TABLE contributions ADD COLUMN database_engine TEXT;
    ALTER TABLE contributions ADD COLUMN database_orm TEXT;
  `,
};
