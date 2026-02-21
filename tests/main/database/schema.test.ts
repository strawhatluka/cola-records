import { describe, it, expect } from 'vitest';
import { CREATE_TABLES, SCHEMA_VERSION, MIGRATIONS } from '../../../src/main/database/schema';

describe('Database Schema', () => {
  describe('SCHEMA_VERSION', () => {
    it('is a positive integer', () => {
      expect(SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    });

    it('is currently version 7', () => {
      expect(SCHEMA_VERSION).toBe(7);
    });
  });

  describe('CREATE_TABLES', () => {
    it('is a non-empty string', () => {
      expect(typeof CREATE_TABLES).toBe('string');
      expect(CREATE_TABLES.length).toBeGreaterThan(0);
    });

    it('creates contributions table', () => {
      expect(CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS contributions');
    });

    it('creates settings table', () => {
      expect(CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS settings');
    });

    it('creates github_cache table', () => {
      expect(CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS github_cache');
    });

    it('creates schema_version table', () => {
      expect(CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS schema_version');
    });

    it('creates indexes for contributions', () => {
      expect(CREATE_TABLES).toContain('idx_contributions_status');
      expect(CREATE_TABLES).toContain('idx_contributions_created_at');
    });

    it('creates index for github_cache expiration', () => {
      expect(CREATE_TABLES).toContain('idx_github_cache_expires_at');
    });

    it('enforces status CHECK constraint on contributions', () => {
      expect(CREATE_TABLES).toContain(
        "CHECK(status IN ('in_progress', 'ready', 'submitted', 'merged'))"
      );
    });

    it('inserts initial schema version', () => {
      expect(CREATE_TABLES).toContain('INSERT OR IGNORE INTO schema_version');
    });
  });

  describe('MIGRATIONS', () => {
    it('is an object', () => {
      expect(typeof MIGRATIONS).toBe('object');
    });

    it('has migration for version 2', () => {
      expect(MIGRATIONS[2]).toBeDefined();
      expect(typeof MIGRATIONS[2]).toBe('string');
    });

    it('version 2 adds PR tracking columns', () => {
      const migration = MIGRATIONS[2];
      expect(migration).toContain('pr_url');
      expect(migration).toContain('pr_number');
      expect(migration).toContain('pr_status');
    });

    it('version 2 adds fork validation columns', () => {
      const migration = MIGRATIONS[2];
      expect(migration).toContain('upstream_url');
      expect(migration).toContain('is_fork');
      expect(migration).toContain('remotes_valid');
    });

    it('has migrations for all versions between 2 and SCHEMA_VERSION', () => {
      for (let v = 2; v <= SCHEMA_VERSION; v++) {
        expect(MIGRATIONS[v]).toBeDefined();
      }
    });

    it('version 3 adds type column for project/contribution discrimination', () => {
      const migration = MIGRATIONS[3];
      expect(migration).toContain('type');
      expect(migration).toContain('contribution');
    });

    it('version 4 adds dev_scripts table', () => {
      const migration = MIGRATIONS[4];
      expect(migration).toContain('dev_scripts');
      expect(migration).toContain('project_path');
      expect(migration).toContain('command');
    });

    it('does not have migration for version 1 (base schema)', () => {
      expect(MIGRATIONS[1]).toBeUndefined();
    });

    it('version 5 adds commands column to dev_scripts', () => {
      const migration = MIGRATIONS[5];
      expect(migration).toContain('commands');
      expect(migration).toContain('ALTER TABLE dev_scripts');
    });

    it('version 6 adds terminals column to dev_scripts for multi-terminal support', () => {
      const migration = MIGRATIONS[6];
      expect(migration).toContain('terminals');
      expect(migration).toContain('ALTER TABLE dev_scripts');
    });

    it('version 7 adds toggle column to dev_scripts for toggle-mode scripts', () => {
      const migration = MIGRATIONS[7];
      expect(migration).toContain('toggle');
      expect(migration).toContain('ALTER TABLE dev_scripts');
    });
  });
});
