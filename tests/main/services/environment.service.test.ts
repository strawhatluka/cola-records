// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module at the top level (ESM exports are non-configurable)
const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '');

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
  };
});

// Mock electron before importing the service
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/exe/path'),
  },
}));

import { EnvironmentService } from '../../../src/main/services/environment.service';

describe('EnvironmentService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('');
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('returns process.env value first', () => {
      process.env.TEST_KEY = 'from-env';
      const service = new EnvironmentService();
      expect(service.get('TEST_KEY')).toBe('from-env');
      delete process.env.TEST_KEY;
    });

    it('returns undefined for missing keys', () => {
      delete process.env.NONEXISTENT_KEY;
      const service = new EnvironmentService();
      expect(service.get('NONEXISTENT_KEY')).toBeUndefined();
    });
  });

  describe('getOrDefault', () => {
    it('returns default when key is missing', () => {
      delete process.env.MISSING;
      const service = new EnvironmentService();
      expect(service.getOrDefault('MISSING', 'fallback')).toBe('fallback');
    });

    it('returns value when key exists', () => {
      process.env.EXISTS = 'value';
      const service = new EnvironmentService();
      expect(service.getOrDefault('EXISTS', 'fallback')).toBe('value');
      delete process.env.EXISTS;
    });
  });

  describe('getRequired', () => {
    it('throws for missing required key', () => {
      delete process.env.REQUIRED;
      const service = new EnvironmentService();
      expect(() => service.getRequired('REQUIRED')).toThrow(
        "Required environment variable 'REQUIRED' is not set"
      );
    });

    it('returns value when key exists', () => {
      process.env.REQUIRED = 'present';
      const service = new EnvironmentService();
      expect(service.getRequired('REQUIRED')).toBe('present');
      delete process.env.REQUIRED;
    });
  });

  describe('getBoolean', () => {
    it('returns true for "true"', () => {
      process.env.BOOL_KEY = 'true';
      const service = new EnvironmentService();
      expect(service.getBoolean('BOOL_KEY')).toBe(true);
      delete process.env.BOOL_KEY;
    });

    it('returns true for "1"', () => {
      process.env.BOOL_KEY = '1';
      const service = new EnvironmentService();
      expect(service.getBoolean('BOOL_KEY')).toBe(true);
      delete process.env.BOOL_KEY;
    });

    it('returns false for other values', () => {
      process.env.BOOL_KEY = 'false';
      const service = new EnvironmentService();
      expect(service.getBoolean('BOOL_KEY')).toBe(false);
      delete process.env.BOOL_KEY;
    });

    it('returns default when key is missing', () => {
      delete process.env.BOOL_KEY;
      const service = new EnvironmentService();
      expect(service.getBoolean('BOOL_KEY', true)).toBe(true);
      expect(service.getBoolean('BOOL_KEY')).toBe(false);
    });
  });

  describe('getNumber', () => {
    it('parses integer values', () => {
      process.env.NUM_KEY = '42';
      const service = new EnvironmentService();
      expect(service.getNumber('NUM_KEY')).toBe(42);
      delete process.env.NUM_KEY;
    });

    it('returns default for NaN', () => {
      process.env.NUM_KEY = 'not-a-number';
      const service = new EnvironmentService();
      expect(service.getNumber('NUM_KEY', 10)).toBe(10);
      delete process.env.NUM_KEY;
    });

    it('returns default when key is missing', () => {
      delete process.env.NUM_KEY;
      const service = new EnvironmentService();
      expect(service.getNumber('NUM_KEY', 99)).toBe(99);
    });
  });

  describe('development/production', () => {
    it('reports development mode when app is not packaged', () => {
      const service = new EnvironmentService();
      expect(service.development).toBe(true);
      expect(service.production).toBe(false);
    });
  });

  describe('env file parsing', () => {
    it('parses KEY=VALUE from .env.local in development', () => {
      mockExistsSync.mockImplementation((p: any) => String(p).endsWith('.env.local'));
      mockReadFileSync.mockReturnValue(
        'APP_NAME=cola-records\nDEBUG=true\n# comment line\n\nQUOTED="hello world"\nSINGLE=\'single quotes\''
      );

      const service = new EnvironmentService();
      expect(service.get('APP_NAME')).toBe('cola-records');
      expect(service.get('DEBUG')).toBe('true');
      expect(service.get('QUOTED')).toBe('hello world');
      expect(service.get('SINGLE')).toBe('single quotes');
    });

    it('skips empty lines and comments', () => {
      mockExistsSync.mockImplementation((p: any) => String(p).endsWith('.env.local'));
      mockReadFileSync.mockReturnValue('# comment\n\nKEY=value\n');

      const service = new EnvironmentService();
      expect(service.get('KEY')).toBe('value');
    });
  });

  describe('getAll', () => {
    it('returns all loaded config', () => {
      mockExistsSync.mockImplementation((p: any) => String(p).endsWith('.env.local'));
      mockReadFileSync.mockReturnValue('A=1\nB=2');

      const service = new EnvironmentService();
      const all = service.getAll();
      expect(all['A']).toBe('1');
      expect(all['B']).toBe('2');
    });
  });

  describe('reload', () => {
    it('clears and reloads config', () => {
      const service = new EnvironmentService();
      service.reload();
      expect(service.getAll()).toBeDefined();
    });
  });
});
