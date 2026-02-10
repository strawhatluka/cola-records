// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { CREATE_TABLES, MIGRATIONS } from '../../../src/main/database/schema';
import { createMockDevScript } from '../../mocks/dev-scripts.mock';

// Mock electron before importing DatabaseService
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user-data'),
  },
}));

describe('DevScripts Database Operations', () => {
  let db: Database.Database;
  let dbService: any;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_TABLES);

    // Apply all migrations (including version 4 for dev_scripts)
    for (const [, sql] of Object.entries(MIGRATIONS)) {
      db.exec(sql);
    }

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

  // ── Schema Tests (TT-02) ──────────────────────────────────────────

  describe('Schema', () => {
    it('should create dev_scripts table on initialization', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dev_scripts'")
        .all();
      expect(tables).toHaveLength(1);
    });

    it('should have correct column types and constraints', () => {
      const columns = db.prepare("PRAGMA table_info('dev_scripts')").all() as {
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }[];

      const columnMap = new Map(columns.map((c) => [c.name, c]));

      // Check primary key
      expect(columnMap.get('id')?.pk).toBe(1);
      expect(columnMap.get('id')?.type).toBe('TEXT');

      // Check required columns
      expect(columnMap.get('project_path')?.notnull).toBe(1);
      expect(columnMap.get('name')?.notnull).toBe(1);
      expect(columnMap.get('command')?.notnull).toBe(1);
      expect(columnMap.get('created_at')?.notnull).toBe(1);
      expect(columnMap.get('updated_at')?.notnull).toBe(1);
    });

    it('should enforce unique constraint on (project_path, name)', () => {
      const projectPath = '/test/project';
      const scriptName = 'Build';

      // Insert first script
      db.prepare(
        'INSERT INTO dev_scripts (id, project_path, name, command, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('script_1', projectPath, scriptName, 'npm run build', Date.now(), Date.now());

      // Attempt to insert duplicate should throw
      expect(() => {
        db.prepare(
          'INSERT INTO dev_scripts (id, project_path, name, command, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run('script_2', projectPath, scriptName, 'npm run build:prod', Date.now(), Date.now());
      }).toThrow(/UNIQUE constraint failed/);
    });

    it('should allow same name in different projects', () => {
      const scriptName = 'Build';

      // Insert first script
      db.prepare(
        'INSERT INTO dev_scripts (id, project_path, name, command, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('script_1', '/project/a', scriptName, 'npm run build', Date.now(), Date.now());

      // Insert second script with same name but different project - should succeed
      expect(() => {
        db.prepare(
          'INSERT INTO dev_scripts (id, project_path, name, command, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run('script_2', '/project/b', scriptName, 'npm run build', Date.now(), Date.now());
      }).not.toThrow();
    });

    it('should have index on project_path for efficient queries', () => {
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='dev_scripts' AND name='idx_dev_scripts_project_path'"
        )
        .all();
      expect(indexes).toHaveLength(1);
    });
  });

  // ── getDevScripts Tests (TT-03) ──────────────────────────────────────────

  describe('getDevScripts', () => {
    it('should return empty array when no scripts exist', () => {
      const result = dbService.getDevScripts('/test/project');
      expect(result).toEqual([]);
    });

    it('should return scripts filtered by project path', () => {
      const projectPath = '/test/project';

      // Insert scripts for our project
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_1',
          projectPath,
          name: 'Build',
          command: 'npm run build',
        })
      );
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_2',
          projectPath,
          name: 'Test',
          command: 'npm test',
        })
      );

      const result = dbService.getDevScripts(projectPath);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Build');
      expect(result[1].name).toBe('Test');
    });

    it('should not return scripts from other projects', () => {
      // Insert script for different project
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_other',
          projectPath: '/other/project',
          name: 'Build',
          command: 'npm run build',
        })
      );

      const result = dbService.getDevScripts('/test/project');
      expect(result).toEqual([]);
    });

    it('should return scripts ordered by name ASC', () => {
      const projectPath = '/test/project';

      // Insert in non-alphabetical order
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_3',
          projectPath,
          name: 'Zeta',
          command: 'npm run zeta',
        })
      );
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_1',
          projectPath,
          name: 'Alpha',
          command: 'npm run alpha',
        })
      );
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_2',
          projectPath,
          name: 'Beta',
          command: 'npm run beta',
        })
      );

      const result = dbService.getDevScripts(projectPath);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Beta');
      expect(result[2].name).toBe('Zeta');
    });

    it('should return scripts with correct property names (camelCase)', () => {
      const projectPath = '/test/project';

      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_test',
          projectPath,
          name: 'Test',
          command: 'npm test',
        })
      );

      const result = dbService.getDevScripts(projectPath);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('projectPath');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('command');
      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('updatedAt');

      // Should NOT have snake_case properties
      expect(result[0]).not.toHaveProperty('project_path');
      expect(result[0]).not.toHaveProperty('created_at');
      expect(result[0]).not.toHaveProperty('updated_at');
    });

    it('should return timestamps as ISO strings', () => {
      const projectPath = '/test/project';

      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_test',
          projectPath,
          name: 'Test',
          command: 'npm test',
        })
      );

      const result = dbService.getDevScripts(projectPath);

      expect(typeof result[0].createdAt).toBe('string');
      expect(typeof result[0].updatedAt).toBe('string');
      // Should be valid ISO date strings
      expect(new Date(result[0].createdAt).toISOString()).toBe(result[0].createdAt);
      expect(new Date(result[0].updatedAt).toISOString()).toBe(result[0].updatedAt);
    });
  });

  // ── saveDevScript Tests (TT-03) ──────────────────────────────────────────

  describe('saveDevScript', () => {
    it('should insert new script with provided id', () => {
      const script = createMockDevScript({
        id: 'script_new',
        projectPath: '/test/project',
        name: 'Build',
        command: 'npm run build',
      });

      dbService.saveDevScript(script);

      const result = dbService.getDevScripts('/test/project');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('script_new');
      expect(result[0].name).toBe('Build');
      expect(result[0].command).toBe('npm run build');
    });

    it('should update existing script by id', () => {
      const projectPath = '/test/project';
      const scriptId = 'script_update';

      // Insert initial script
      dbService.saveDevScript(
        createMockDevScript({
          id: scriptId,
          projectPath,
          name: 'Build',
          command: 'npm run build',
        })
      );

      // Update the script
      dbService.saveDevScript(
        createMockDevScript({
          id: scriptId,
          projectPath,
          name: 'Build Production',
          command: 'npm run build:prod',
        })
      );

      const result = dbService.getDevScripts(projectPath);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Build Production');
      expect(result[0].command).toBe('npm run build:prod');
    });

    it('should set created_at and updated_at timestamps on insert', () => {
      const beforeInsert = Date.now();

      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_time',
          projectPath: '/test/project',
          name: 'Test',
          command: 'npm test',
        })
      );

      const afterInsert = Date.now();
      const result = dbService.getDevScripts('/test/project');

      const createdAt = new Date(result[0].createdAt).getTime();
      const updatedAt = new Date(result[0].updatedAt).getTime();

      expect(createdAt).toBeGreaterThanOrEqual(beforeInsert);
      expect(createdAt).toBeLessThanOrEqual(afterInsert);
      expect(updatedAt).toBe(createdAt);
    });

    it('should update updated_at timestamp on update without changing created_at', async () => {
      const projectPath = '/test/project';
      const scriptId = 'script_time_update';

      // Insert initial script
      dbService.saveDevScript(
        createMockDevScript({
          id: scriptId,
          projectPath,
          name: 'Test',
          command: 'npm test',
        })
      );

      const insertedResult = dbService.getDevScripts(projectPath);
      const originalCreatedAt = insertedResult[0].createdAt;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update the script
      dbService.saveDevScript(
        createMockDevScript({
          id: scriptId,
          projectPath,
          name: 'Test Updated',
          command: 'npm test -- --watch',
        })
      );

      const updatedResult = dbService.getDevScripts(projectPath);

      // created_at should not change
      expect(updatedResult[0].createdAt).toBe(originalCreatedAt);

      // updated_at should be newer
      const originalUpdatedAt = new Date(insertedResult[0].updatedAt).getTime();
      const newUpdatedAt = new Date(updatedResult[0].updatedAt).getTime();
      expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should throw on duplicate (project_path, name) with different id', () => {
      const projectPath = '/test/project';

      // Insert first script
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_1',
          projectPath,
          name: 'Build',
          command: 'npm run build',
        })
      );

      // Attempt to insert second script with same name (different id) - should throw
      expect(() => {
        dbService.saveDevScript(
          createMockDevScript({
            id: 'script_2',
            projectPath,
            name: 'Build',
            command: 'npm run build:other',
          })
        );
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  // ── deleteDevScript Tests (TT-03) ──────────────────────────────────────────

  describe('deleteDevScript', () => {
    it('should remove script by id', () => {
      const projectPath = '/test/project';
      const scriptId = 'script_to_delete';

      // Insert script
      dbService.saveDevScript(
        createMockDevScript({
          id: scriptId,
          projectPath,
          name: 'Test',
          command: 'npm test',
        })
      );

      // Verify it exists
      expect(dbService.getDevScripts(projectPath)).toHaveLength(1);

      // Delete it
      dbService.deleteDevScript(scriptId);

      // Verify it's gone
      expect(dbService.getDevScripts(projectPath)).toHaveLength(0);
    });

    it('should not throw when script does not exist', () => {
      expect(() => {
        dbService.deleteDevScript('nonexistent_id');
      }).not.toThrow();
    });

    it('should only delete the specified script', () => {
      const projectPath = '/test/project';

      // Insert multiple scripts
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_1',
          projectPath,
          name: 'Build',
          command: 'npm run build',
        })
      );
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_2',
          projectPath,
          name: 'Test',
          command: 'npm test',
        })
      );
      dbService.saveDevScript(
        createMockDevScript({
          id: 'script_3',
          projectPath,
          name: 'Lint',
          command: 'npm run lint',
        })
      );

      // Delete the middle one
      dbService.deleteDevScript('script_2');

      const result = dbService.getDevScripts(projectPath);
      expect(result).toHaveLength(2);
      expect(result.map((s: any) => s.id)).toContain('script_1');
      expect(result.map((s: any) => s.id)).toContain('script_3');
      expect(result.map((s: any) => s.id)).not.toContain('script_2');
    });
  });

  // ── Multi-Terminal Support Tests (v6 migration) ──────────────────────────────────────────

  describe('Multi-Terminal Support', () => {
    it('should save and retrieve scripts with terminals array', () => {
      const projectPath = '/test/project';
      const terminals = [
        { name: 'Frontend', commands: ['npm run dev'] },
        { name: 'Backend', commands: ['npm run server'] },
      ];

      dbService.saveDevScript({
        id: 'script_multi',
        projectPath,
        name: 'Full Stack',
        command: 'npm run dev',
        commands: ['npm run dev'],
        terminals,
      });

      const result = dbService.getDevScripts(projectPath);
      expect(result).toHaveLength(1);
      expect(result[0].terminals).toEqual(terminals);
    });

    it('should return undefined terminals for legacy scripts', () => {
      const projectPath = '/test/project';

      // Insert a script without terminals using raw SQL (simulating legacy script)
      db.prepare(
        'INSERT INTO dev_scripts (id, project_path, name, command, commands, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'script_legacy',
        projectPath,
        'Legacy Script',
        'npm run build',
        JSON.stringify(['npm run build']),
        Date.now(),
        Date.now()
      );

      const result = dbService.getDevScripts(projectPath);
      expect(result).toHaveLength(1);
      expect(result[0].terminals).toBeUndefined();
    });

    it('should handle scripts with empty terminals array', () => {
      const projectPath = '/test/project';

      dbService.saveDevScript({
        id: 'script_empty_terminals',
        projectPath,
        name: 'Single Mode',
        command: 'npm test',
        commands: ['npm test'],
        terminals: [],
      });

      const result = dbService.getDevScripts(projectPath);
      expect(result).toHaveLength(1);
      // Empty array should be stored as null and returned as undefined
      expect(result[0].terminals).toBeUndefined();
    });

    it('should preserve terminals array on script update', async () => {
      const projectPath = '/test/project';
      const scriptId = 'script_update_terminals';
      const terminals = [
        { name: 'Dev', commands: ['npm run dev'] },
        { name: 'Watch', commands: ['npm run watch'] },
      ];

      // Insert script with terminals
      dbService.saveDevScript({
        id: scriptId,
        projectPath,
        name: 'Dev Setup',
        command: 'npm run dev',
        commands: ['npm run dev'],
        terminals,
      });

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update the script with new terminals
      const newTerminals = [
        { name: 'Frontend', commands: ['npm run dev:frontend'] },
        { name: 'Backend', commands: ['npm run dev:backend'] },
        { name: 'Worker', commands: ['npm run worker'] },
      ];

      dbService.saveDevScript({
        id: scriptId,
        projectPath,
        name: 'Dev Setup Updated',
        command: 'npm run dev:frontend',
        commands: ['npm run dev:frontend'],
        terminals: newTerminals,
      });

      const result = dbService.getDevScripts(projectPath);
      expect(result).toHaveLength(1);
      expect(result[0].terminals).toEqual(newTerminals);
      expect(result[0].terminals).toHaveLength(3);
    });

    it('should handle malformed terminals JSON gracefully', () => {
      const projectPath = '/test/project';

      // Insert a script with malformed terminals JSON directly
      db.prepare(
        'INSERT INTO dev_scripts (id, project_path, name, command, commands, terminals, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'script_malformed',
        projectPath,
        'Malformed',
        'npm test',
        JSON.stringify(['npm test']),
        'not valid json{',
        Date.now(),
        Date.now()
      );

      // Should not throw, should return undefined terminals
      const result = dbService.getDevScripts(projectPath);
      expect(result).toHaveLength(1);
      expect(result[0].terminals).toBeUndefined();
    });

    it('should correctly serialize terminals with multiple commands per terminal', () => {
      const projectPath = '/test/project';
      const terminals = [
        { name: 'Setup', commands: ['npm install', 'npm run migrate', 'npm run seed'] },
        { name: 'Dev', commands: ['npm run dev'] },
      ];

      dbService.saveDevScript({
        id: 'script_complex',
        projectPath,
        name: 'Complex Setup',
        command: 'npm install',
        commands: ['npm install'],
        terminals,
      });

      const result = dbService.getDevScripts(projectPath);
      expect(result[0].terminals).toEqual(terminals);
      expect(result[0].terminals).toBeDefined();
      expect(result[0].terminals?.[0].commands).toHaveLength(3);
      expect(result[0].terminals?.[1].commands).toHaveLength(1);
    });
  });
});
