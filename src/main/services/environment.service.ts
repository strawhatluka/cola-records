import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * Environment Configuration Service
 *
 * Loads and manages environment variables from .env files
 */
export class EnvironmentService {
  private config: Map<string, string>;
  private isDevelopment: boolean;

  constructor() {
    this.config = new Map();
    this.isDevelopment = !app.isPackaged;
    this.loadEnvironmentVariables();
  }

  /**
   * Get an environment variable
   */
  get(key: string): string | undefined {
    // First check process.env (takes precedence)
    if (process.env[key]) {
      return process.env[key];
    }

    // Then check loaded config
    return this.config.get(key);
  }

  /**
   * Get an environment variable with a default value
   */
  getOrDefault(key: string, defaultValue: string): string {
    return this.get(key) ?? defaultValue;
  }

  /**
   * Get a required environment variable (throws if not found)
   */
  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required environment variable '${key}' is not set`);
    }
    return value;
  }

  /**
   * Get a boolean environment variable
   */
  getBoolean(key: string, defaultValue = false): boolean {
    const value = this.get(key);
    if (!value) return defaultValue;

    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Get a number environment variable
   */
  getNumber(key: string, defaultValue = 0): number {
    const value = this.get(key);
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Check if running in development mode
   */
  get development(): boolean {
    return this.isDevelopment;
  }

  /**
   * Check if running in production mode
   */
  get production(): boolean {
    return !this.isDevelopment;
  }

  /**
   * Get the application version
   */
  get version(): string {
    return app.getVersion();
  }

  /**
   * Get the current platform
   */
  get platform(): NodeJS.Platform {
    return process.platform;
  }

  /**
   * Get environment-aware configuration
   */
  getConfig(): {
    updatesEnabled: boolean;
    devToolsEnabled: boolean;
    loggingLevel: 'error' | 'warn' | 'info' | 'debug';
  } {
    return {
      updatesEnabled: this.production,
      devToolsEnabled: this.development,
      loggingLevel: this.production ? 'error' : 'debug',
    };
  }

  /**
   * Get all environment variables as an object
   */
  getAll(): Record<string, string> {
    return Object.fromEntries(this.config);
  }

  /**
   * Reload environment variables from .env file
   */
  reload(): void {
    this.config.clear();
    this.loadEnvironmentVariables();
  }

  /**
   * Load environment variables from .env file
   */
  private loadEnvironmentVariables(): void {
    try {
      // Determine the root directory
      const rootDir = this.isDevelopment ? process.cwd() : path.dirname(app.getPath('exe'));

      // In development, prioritize .env.local over .env
      if (this.isDevelopment) {
        const envLocalPath = path.join(rootDir, '.env.local');
        const envPath = path.join(rootDir, '.env');

        if (fs.existsSync(envLocalPath)) {
          const envContent = fs.readFileSync(envLocalPath, 'utf-8');
          this.parseEnvFile(envContent);
        } else if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          this.parseEnvFile(envContent);
        }
      } else {
        // In production, only use .env
        const envPath = path.join(rootDir, '.env');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          this.parseEnvFile(envContent);
        }
      }

      // Also load from process.env
      this.loadFromProcessEnv();
    } catch {
      // Environment loading failed — will use defaults
    }
  }

  /**
   * Parse .env file content
   */
  private parseEnvFile(content: string): void {
    const lines = content.split('\n');

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        this.config.set(key, value);
      }
    }
  }

  /**
   * Load specific variables from process.env
   */
  private loadFromProcessEnv(): void {
    const envVars = [
      'NODE_ENV',
      'GITHUB_TOKEN',
      'DEFAULT_CLONE_PATH',
      'AUTO_FETCH_ENABLED',
      'GITHUB_API_TIMEOUT',
      'CACHE_TTL_HOURS',
      'MAX_RETRIES',
      'LOG_LEVEL',
    ];

    for (const key of envVars) {
      const value = process.env[key];
      if (value) {
        this.config.set(key, value);
      }
    }
  }
}

// Export singleton instance
export const env = new EnvironmentService();
