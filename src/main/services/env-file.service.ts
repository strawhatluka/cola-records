/**
 * Env File Service
 *
 * Discover, create, read, write, and sync .env files. Works with the
 * env-scanner service for codebase scanning and .env.example generation.
 *
 * The .env.example output groups variables by service provider (Discord,
 * GitHub, PostgreSQL, etc.) and lists all source file occurrences in comments.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { envScannerService } from './env-scanner.service';
import type {
  Ecosystem,
  EnvFileInfo,
  EnvSyncResult,
  EnvVariable,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('env-file');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'vendor',
  'target',
  'coverage',
  'out',
  '__pycache__',
  '.next',
  '.nuxt',
  '.turbo',
]);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseEnvKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=/);
    if (match) keys.add(match[1].trim());
  }
  return keys;
}

/**
 * Parse env file content into a Map of key → value (everything after the first `=`).
 * Used to preserve existing values when rebuilding from the .env.example template.
 */
function parseEnvValues(content: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1);
      values.set(key, value);
    }
  }
  return values;
}

/**
 * Rebuild a sibling .env file using .env.example as a structural template.
 * Comments, section headers, blank lines, and key ordering all come from
 * the template. Existing values from the sibling file are preserved.
 */
function rebuildFromTemplate(templateContent: string, siblingContent: string): string {
  const existingValues = parseEnvValues(siblingContent);
  const rebuilt: string[] = [];

  for (const line of templateContent.split('\n')) {
    const trimmed = line.trim();

    // Comment or blank line — copy verbatim from template
    if (!trimmed || trimmed.startsWith('#')) {
      rebuilt.push(line);
      continue;
    }

    // KEY= or KEY=placeholder line — merge existing value if present
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      if (existingValues.has(key)) {
        rebuilt.push(`${key}=${existingValues.get(key)}`);
      } else {
        rebuilt.push(line);
      }
    } else {
      // Unexpected non-comment, non-key line — copy as-is
      rebuilt.push(line);
    }
  }

  return rebuilt.join('\n');
}

/**
 * Build the "found in" comment showing all source file locations.
 * Single location:  (found in lib/auth.ts:17)
 * Multiple:         (found in lib/auth.ts:17, lib/middleware.ts:42)
 */
function buildSourceComment(v: EnvVariable): string {
  const locations = v.sourceFiles.map((s) => `${s.file}:${s.line}`);
  return `(found in ${locations.join(', ')})`;
}

class EnvFileService {
  async discoverEnvFiles(directory: string): Promise<EnvFileInfo[]> {
    logger.info(`Discovering .env files in: ${directory}`);
    const files: EnvFileInfo[] = [];
    await this.walkForEnvFiles(directory, directory, files);
    return files;
  }

  async createEnvExample(directory: string, ecosystem: Ecosystem): Promise<SetUpActionResult> {
    const examplePath = path.join(directory, '.env.example');

    try {
      const scanResult = await envScannerService.scan(directory, ecosystem);
      if (scanResult.variables.length === 0) {
        await fs.writeFile(
          examplePath,
          '# Environment Variables\n# No env references found in codebase\n',
          'utf-8'
        );
        return { success: true, message: 'Created .env.example (no variables detected)' };
      }

      // Group by service provider
      const grouped: Record<string, EnvVariable[]> = {};
      for (const v of scanResult.variables) {
        if (!grouped[v.service]) grouped[v.service] = [];
        grouped[v.service].push(v);
      }

      // Sort service groups: named services first (alphabetical), "General" last
      const serviceNames = Object.keys(grouped).sort((a, b) => {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
      });

      const lines: string[] = [
        '# Environment Variables',
        `# Generated from codebase scan (${scanResult.variables.length} variables found)`,
        '',
      ];

      for (const serviceName of serviceNames) {
        const vars = grouped[serviceName];

        lines.push(`# ====================`);
        lines.push(`# ${serviceName}`);
        lines.push(`# ====================`);
        lines.push('');

        for (const v of vars) {
          lines.push(`# ${v.comment} ${buildSourceComment(v)}`);
          lines.push(`${v.name}=`);
          lines.push('');
        }
      }

      await fs.writeFile(examplePath, lines.join('\n'), 'utf-8');
      return {
        success: true,
        message: `Created .env.example with ${scanResult.variables.length} variables`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create .env.example: ${msg}`);
      return { success: false, message: `Failed to create .env.example: ${msg}` };
    }
  }

  async createEnvFile(directory: string, targetName: string): Promise<SetUpActionResult> {
    const targetPath = path.join(directory, targetName);
    const examplePath = path.join(directory, '.env.example');

    try {
      if (await fileExists(targetPath)) {
        // File exists — sync its structure from .env.example (preserving values)
        if (await fileExists(examplePath)) {
          const templateContent = await fs.readFile(examplePath, 'utf-8');
          const siblingContent = await fs.readFile(targetPath, 'utf-8');
          const rebuilt = rebuildFromTemplate(templateContent, siblingContent);
          if (rebuilt !== siblingContent) {
            await fs.writeFile(targetPath, rebuilt, 'utf-8');
            return { success: true, message: `Synced ${targetName} from .env.example` };
          }
          return { success: true, message: `${targetName} is already in sync` };
        }
        return {
          success: true,
          message: `${targetName} already exists (no .env.example to sync from)`,
        };
      }

      if (await fileExists(examplePath)) {
        await fs.copyFile(examplePath, targetPath);
        return { success: true, message: `Created ${targetName} from .env.example` };
      }

      await fs.writeFile(targetPath, '# Environment Variables\n', 'utf-8');
      return { success: true, message: `Created empty ${targetName}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Failed to create ${targetName}: ${msg}` };
    }
  }

  async readEnvFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeEnvFile(filePath: string, content: string): Promise<SetUpActionResult> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      const name = path.basename(filePath);
      return { success: true, message: `Saved ${name}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  async syncEnvFiles(directory: string, ecosystem: Ecosystem): Promise<EnvSyncResult> {
    logger.info(`Syncing env files in: ${directory}`);

    try {
      // Step 1: Rescan codebase and update .env.example
      const scanResult = await envScannerService.scan(directory, ecosystem);
      const examplePath = path.join(directory, '.env.example');
      let newVariablesFound = 0;
      const filesUpdated: string[] = [];

      if (!(await fileExists(examplePath))) {
        // Create .env.example first
        await this.createEnvExample(directory, ecosystem);
        newVariablesFound = scanResult.variables.length;
        filesUpdated.push('.env.example');
      } else {
        // Append new vars to .env.example
        const exampleContent = await fs.readFile(examplePath, 'utf-8');
        const existingKeys = parseEnvKeys(exampleContent);
        const newVars = scanResult.variables.filter((v) => !existingKeys.has(v.name));

        if (newVars.length > 0) {
          const additions = [
            '',
            '# ====================',
            '# Added by ENV Sync',
            '# ====================',
            '',
          ];
          for (const v of newVars) {
            additions.push(`# ${v.comment} ${buildSourceComment(v)}`);
            additions.push(`${v.name}=`);
            additions.push('');
          }
          await fs.writeFile(examplePath, exampleContent + additions.join('\n'), 'utf-8');
          newVariablesFound = newVars.length;
          filesUpdated.push('.env.example');
        }
      }

      // Step 2: Rebuild sibling .env* files using .env.example as structural template.
      // Comments, section headers, blank lines, and key ordering all mirror the
      // template. Existing values from each sibling file are preserved in place.
      const updatedExampleContent = await fs.readFile(examplePath, 'utf-8');

      const envFiles = await this.discoverEnvFiles(directory);
      for (const envFile of envFiles) {
        if (envFile.isExample) continue;

        const rebuilt = rebuildFromTemplate(updatedExampleContent, envFile.content);
        if (rebuilt !== envFile.content) {
          await fs.writeFile(envFile.absolutePath, rebuilt, 'utf-8');
          filesUpdated.push(envFile.relativePath);
        }
      }

      const message =
        newVariablesFound > 0
          ? `Found ${newVariablesFound} new variable${newVariablesFound === 1 ? '' : 's'}, updated ${filesUpdated.length} file${filesUpdated.length === 1 ? '' : 's'}`
          : filesUpdated.length > 0
            ? `Propagated keys to ${filesUpdated.length} file${filesUpdated.length === 1 ? '' : 's'}`
            : 'All env files are in sync';

      logger.info(`Sync complete: ${message}`);
      return { newVariablesFound, filesUpdated, message };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Sync failed: ${msg}`);
      return { newVariablesFound: 0, filesUpdated: [], message: `Sync failed: ${msg}` };
    }
  }

  private async walkForEnvFiles(dir: string, rootDir: string, files: EnvFileInfo[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const name = String(entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
        await this.walkForEnvFiles(path.join(dir, name), rootDir, files);
      } else if (entry.isFile() && name.startsWith('.env')) {
        const filePath = path.join(dir, name);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
          files.push({
            name,
            relativePath,
            absolutePath: filePath.split(path.sep).join('/'),
            content,
            isExample: name.includes('example'),
          });
        } catch {
          // Skip files we can't read
        }
      }
    }
  }
}

export const envFileService = new EnvFileService();
