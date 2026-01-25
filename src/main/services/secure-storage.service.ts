import { safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * Secure Storage Service
 *
 * Provides encrypted storage for sensitive data like API tokens using Electron's safeStorage API.
 * Falls back to base64 encoding if encryption is not available (development mode).
 */
export class SecureStorageService {
  private storageDir: string;
  private storageFile: string;
  private cache: Map<string, string>;

  constructor() {
    // Store encrypted data in app's userData directory
    this.storageDir = app.getPath('userData');
    this.storageFile = path.join(this.storageDir, 'secure-storage.dat');
    this.cache = new Map();
    this.loadFromDisk();
  }

  /**
   * Check if encryption is available
   */
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Store a value securely
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      let encrypted: string;

      if (safeStorage.isEncryptionAvailable()) {
        // Use Electron's safeStorage for encryption
        const buffer = safeStorage.encryptString(value);
        encrypted = buffer.toString('base64');
      } else {
        // Fallback to base64 (not secure, for development only)
        console.warn('Encryption not available, using base64 encoding (NOT SECURE)');
        encrypted = Buffer.from(value).toString('base64');
      }

      this.cache.set(key, encrypted);
      await this.saveToDisk();
    } catch (error) {
      throw new Error(`Failed to store secure item: ${error}`);
    }
  }

  /**
   * Retrieve a value securely
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const encrypted = this.cache.get(key);
      if (!encrypted) {
        return null;
      }

      if (safeStorage.isEncryptionAvailable()) {
        // Decrypt using safeStorage
        const buffer = Buffer.from(encrypted, 'base64');
        return safeStorage.decryptString(buffer);
      } else {
        // Fallback from base64
        return Buffer.from(encrypted, 'base64').toString('utf-8');
      }
    } catch (error) {
      console.error(`Failed to retrieve secure item: ${error}`);
      return null;
    }
  }

  /**
   * Remove a value
   */
  async removeItem(key: string): Promise<void> {
    this.cache.delete(key);
    await this.saveToDisk();
  }

  /**
   * Clear all stored values
   */
  async clear(): Promise<void> {
    this.cache.clear();
    await this.saveToDisk();
  }

  /**
   * Check if a key exists
   */
  hasItem(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all keys
   */
  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Load encrypted data from disk
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = fs.readFileSync(this.storageFile, 'utf-8');
        const parsed = JSON.parse(data);
        this.cache = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load secure storage from disk:', error);
      this.cache = new Map();
    }
  }

  /**
   * Save encrypted data to disk
   */
  private async saveToDisk(): Promise<void> {
    try {
      // Ensure storage directory exists
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      const data = JSON.stringify(Object.fromEntries(this.cache));
      fs.writeFileSync(this.storageFile, data, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save secure storage to disk: ${error}`);
    }
  }
}

// Export singleton instance
export const secureStorage = new SecureStorageService();
