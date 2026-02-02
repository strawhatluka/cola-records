// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Top-level mock functions for fs
const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => '{}');
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  };
});

// Mock electron with inline values (no external variable references due to hoisting)
const mockIsEncryptionAvailable = vi.fn(() => false);
const mockEncryptString = vi.fn((value: string) => Buffer.from(`encrypted:${value}`));
const mockDecryptString = vi.fn((buffer: Buffer) => {
  const str = buffer.toString();
  return str.replace('encrypted:', '');
});

vi.mock('electron', () => ({
  app: {
    getPath: () => '/mock/userData',
  },
  safeStorage: {
    isEncryptionAvailable: () => mockIsEncryptionAvailable(),
    encryptString: (value: string) => mockEncryptString(value),
    decryptString: (buffer: Buffer) => mockDecryptString(buffer),
  },
}));

import { SecureStorageService } from '../../../src/main/services/secure-storage.service';

describe('SecureStorageService', () => {
  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockWriteFileSync.mockClear();
    mockMkdirSync.mockClear();
    mockIsEncryptionAvailable.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs with empty cache when no file exists', () => {
    const service = new SecureStorageService();
    expect(service.getAllKeys()).toEqual([]);
  });

  it('loads existing data from disk on construction', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ key1: 'val1' }));

    const service = new SecureStorageService();
    expect(service.hasItem('key1')).toBe(true);
  });

  describe('setItem / getItem (fallback mode)', () => {
    it('stores and retrieves values using base64 when encryption unavailable', async () => {
      const service = new SecureStorageService();
      await service.setItem('token', 'my-secret-token');

      const result = await service.getItem('token');
      expect(result).toBe('my-secret-token');
    });

    it('returns null for missing keys', async () => {
      const service = new SecureStorageService();
      expect(await service.getItem('nonexistent')).toBeNull();
    });

    it('persists to disk on setItem', async () => {
      const service = new SecureStorageService();
      await service.setItem('key', 'value');

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('setItem / getItem (encrypted mode)', () => {
    it('uses safeStorage when encryption is available', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      const service = new SecureStorageService();

      await service.setItem('secret', 'encrypted-value');
      expect(mockEncryptString).toHaveBeenCalledWith('encrypted-value');

      const result = await service.getItem('secret');
      expect(mockDecryptString).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('removeItem', () => {
    it('removes item from cache and saves', async () => {
      const service = new SecureStorageService();
      await service.setItem('key', 'value');
      expect(service.hasItem('key')).toBe(true);

      await service.removeItem('key');
      expect(service.hasItem('key')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all items', async () => {
      const service = new SecureStorageService();
      await service.setItem('a', '1');
      await service.setItem('b', '2');
      expect(service.getAllKeys()).toHaveLength(2);

      await service.clear();
      expect(service.getAllKeys()).toHaveLength(0);
    });
  });

  describe('hasItem', () => {
    it('returns true for existing keys', async () => {
      const service = new SecureStorageService();
      await service.setItem('exists', 'yes');
      expect(service.hasItem('exists')).toBe(true);
      expect(service.hasItem('nope')).toBe(false);
    });
  });

  describe('getAllKeys', () => {
    it('returns all stored keys', async () => {
      const service = new SecureStorageService();
      await service.setItem('a', '1');
      await service.setItem('b', '2');
      await service.setItem('c', '3');

      const keys = service.getAllKeys();
      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain('c');
      expect(keys).toHaveLength(3);
    });
  });

  describe('isEncryptionAvailable', () => {
    it('delegates to safeStorage', () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      const service = new SecureStorageService();
      expect(service.isEncryptionAvailable()).toBe(true);

      mockIsEncryptionAvailable.mockReturnValue(false);
      expect(service.isEncryptionAvailable()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('handles corrupt disk data gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json');

      // Should not throw, just start with empty cache
      const service = new SecureStorageService();
      expect(service.getAllKeys()).toEqual([]);
    });
  });
});
