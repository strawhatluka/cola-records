import * as fs from 'fs';
import * as path from 'path';
import type { FileNode, FileContent } from '../ipc/channels';

/**
 * File System Service
 *
 * Provides file system operations for the application
 */
export class FileSystemService {
  /**
   * Read directory contents and return file tree
   */
  async readDirectory(dirPath: string): Promise<FileNode[]> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          const stats = await fs.promises.stat(fullPath);

          const node: FileNode = {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime,
          };

          // For directories, we don't load children yet (lazy loading)
          if (entry.isDirectory()) {
            node.children = [];
          }

          nodes.push(node);
        } catch (error) {
          // Skip files/directories we can't access
          console.warn(`Unable to access ${fullPath}:`, error);
        }
      }

      // Sort: directories first, then files, both alphabetically
      return nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error) {
      throw new Error(`Failed to read directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Read file contents
   */
  async readFile(filePath: string): Promise<FileContent> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return {
        path: filePath,
        content,
        encoding: 'utf-8',
      };
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  /**
   * Write file contents
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      await fs.promises.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error}`);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error}`);
    }
  }

  /**
   * Check if path exists
   */
  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.promises.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a directory
   */
  async isDirectory(targetPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(targetPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getStats(targetPath: string): Promise<fs.Stats> {
    try {
      return await fs.promises.stat(targetPath);
    } catch (error) {
      throw new Error(`Failed to get stats for ${targetPath}: ${error}`);
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Copy file
   */
  async copyFile(source: string, destination: string): Promise<void> {
    try {
      // Ensure destination directory exists
      const dir = path.dirname(destination);
      await fs.promises.mkdir(dir, { recursive: true });

      await fs.promises.copyFile(source, destination);
    } catch (error) {
      throw new Error(`Failed to copy file from ${source} to ${destination}: ${error}`);
    }
  }

  /**
   * Move/rename file
   */
  async moveFile(source: string, destination: string): Promise<void> {
    try {
      // Ensure destination directory exists
      const dir = path.dirname(destination);
      await fs.promises.mkdir(dir, { recursive: true });

      await fs.promises.rename(source, destination);
    } catch (error) {
      throw new Error(`Failed to move file from ${source} to ${destination}: ${error}`);
    }
  }

  /**
   * Get file extension
   */
  getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Get file name without extension
   */
  getBaseName(filePath: string, includeExtension = true): string {
    return includeExtension
      ? path.basename(filePath)
      : path.basename(filePath, path.extname(filePath));
  }

  /**
   * Get directory name
   */
  getDirName(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Join paths
   */
  joinPaths(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Normalize path
   */
  normalizePath(targetPath: string): string {
    return path.normalize(targetPath);
  }

  /**
   * Resolve absolute path
   */
  resolvePath(...paths: string[]): string {
    return path.resolve(...paths);
  }
}

// Export singleton instance
export const fileSystemService = new FileSystemService();
