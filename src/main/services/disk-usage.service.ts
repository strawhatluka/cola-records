/**
 * Disk Usage Service
 *
 * Scans a project directory for well-known artifact directories
 * and reports their sizes. Used by the Dev Tools Info section.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type { DiskUsageEntry, DiskUsageResult } from '../ipc/channels/types';

const logger = createLogger('disk-usage');

/** Well-known directories to measure across all ecosystems */
const SCAN_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'target',
  '__pycache__',
  '.next',
  '.nuxt',
  '.vite',
  'vendor',
  'out',
  '.cache',
];

/** Maximum recursion depth to prevent runaway scans */
const MAX_DEPTH = 20;

class DiskUsageService {
  async scan(projectPath: string): Promise<DiskUsageResult> {
    const start = Date.now();
    logger.info(`Scanning disk usage in: ${projectPath}`);

    const entries: DiskUsageEntry[] = [];

    for (const dir of SCAN_DIRECTORIES) {
      const dirPath = path.join(projectPath, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          const sizeBytes = await this.getDirectorySize(dirPath, 0);
          entries.push({ name: dir, path: dirPath, sizeBytes, exists: true });
        }
      } catch {
        // Directory doesn't exist — skip
      }
    }

    const totalBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    const scanDurationMs = Date.now() - start;

    logger.info(`Scan complete: ${entries.length} dirs, ${totalBytes} bytes, ${scanDurationMs}ms`);

    return { totalBytes, entries, scanDurationMs };
  }

  private async getDirectorySize(dirPath: string, depth: number): Promise<number> {
    if (depth >= MAX_DEPTH) return 0;

    let size = 0;
    try {
      const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of dirEntries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(entryPath, depth + 1);
        } else {
          try {
            const stat = await fs.stat(entryPath);
            size += stat.size;
          } catch {
            // Broken symlink or permission error — skip file
          }
        }
      }
    } catch {
      // Permission error or similar — return partial size
    }
    return size;
  }
}

export const diskUsageService = new DiskUsageService();
