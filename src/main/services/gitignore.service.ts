import ignore, { Ignore } from 'ignore';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GitIgnore Service
 *
 * Parses and evaluates .gitignore patterns for file filtering
 */
export class GitIgnoreService {
  private ignoreCache: Map<string, Ignore>;

  constructor() {
    this.ignoreCache = new Map();
  }

  /**
   * Load .gitignore file and create ignore instance
   */
  private async loadGitIgnore(repoPath: string): Promise<Ignore> {
    const gitignorePath = path.join(repoPath, '.gitignore');
    const ig = ignore();

    // Always ignore .git directory
    ig.add('.git');

    try {
      if (fs.existsSync(gitignorePath)) {
        const content = await fs.promises.readFile(gitignorePath, 'utf-8');
        const patterns = content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#')); // Remove empty lines and comments

        ig.add(patterns);
      }
    } catch {
      // .gitignore loading is best-effort
    }

    return ig;
  }

  /**
   * Get or create ignore instance for a repository
   */
  private async getIgnore(repoPath: string): Promise<Ignore> {
    if (!this.ignoreCache.has(repoPath)) {
      const ig = await this.loadGitIgnore(repoPath);
      this.ignoreCache.set(repoPath, ig);
    }

    return this.ignoreCache.get(repoPath)!;
  }

  /**
   * Check if a file path is ignored by .gitignore
   */
  async isIgnored(repoPath: string, filePath: string): Promise<boolean> {
    try {
      const ig = await this.getIgnore(repoPath);

      // Convert absolute path to relative path from repo root
      const relativePath = path.relative(repoPath, filePath);

      // Normalize path separators for ignore library (always use forward slashes)
      const normalizedPath = relativePath.split(path.sep).join('/');

      return ig.ignores(normalizedPath);
    } catch {
      return false;
    }
  }

  /**
   * Get all gitignore patterns for a repository
   */
  async getPatterns(repoPath: string): Promise<string[]> {
    const gitignorePath = path.join(repoPath, '.gitignore');

    try {
      if (fs.existsSync(gitignorePath)) {
        const content = await fs.promises.readFile(gitignorePath, 'utf-8');
        return content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'));
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Filter an array of file paths, removing ignored files
   */
  async filterIgnored(repoPath: string, filePaths: string[]): Promise<string[]> {
    const ig = await this.getIgnore(repoPath);

    return filePaths.filter((filePath) => {
      const relativePath = path.relative(repoPath, filePath);
      const normalizedPath = relativePath.split(path.sep).join('/');
      return !ig.ignores(normalizedPath);
    });
  }

  /**
   * Reload gitignore patterns for a repository
   */
  async reload(repoPath: string): Promise<void> {
    this.ignoreCache.delete(repoPath);
    await this.loadGitIgnore(repoPath);
  }

  /**
   * Clear all cached gitignore patterns
   */
  clearCache(): void {
    this.ignoreCache.clear();
  }

  /**
   * Check if .gitignore file exists
   */
  async hasGitIgnore(repoPath: string): Promise<boolean> {
    const gitignorePath = path.join(repoPath, '.gitignore');
    try {
      await fs.promises.access(gitignorePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const gitIgnoreService = new GitIgnoreService();
