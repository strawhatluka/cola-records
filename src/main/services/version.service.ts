/**
 * Version Service
 *
 * Detects version files in a project (package.json, Cargo.toml, etc.),
 * reads current versions, and writes updated versions. Pure semver
 * bumping utility included.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { VersionInfo, SetUpActionResult } from '../ipc/channels/types';

const VERSION_FILES: { glob: string; manager: string }[] = [
  { glob: 'package.json', manager: 'npm' },
  { glob: 'package-lock.json', manager: 'npm' },
  { glob: 'Cargo.toml', manager: 'cargo' },
  { glob: 'pyproject.toml', manager: 'pip' },
  { glob: 'setup.py', manager: 'pip' },
  { glob: 'build.gradle', manager: 'gradle' },
  { glob: 'pom.xml', manager: 'maven' },
];

export class VersionService {
  detectVersions(repoPath: string): VersionInfo[] {
    const versions: VersionInfo[] = [];

    // Scan root-level version files
    for (const vf of VERSION_FILES) {
      const filePath = path.join(repoPath, vf.glob);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const version = this.extractVersion(content, vf.glob);

      if (version) {
        versions.push({
          file: filePath,
          relativePath: vf.glob,
          currentVersion: version,
          packageManager: vf.manager,
        });
      }
    }

    // Scan npm/yarn workspace directories
    const rootPkgPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(rootPkgPath)) {
      try {
        const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
        const workspaces: string[] = Array.isArray(rootPkg.workspaces)
          ? rootPkg.workspaces
          : (rootPkg.workspaces?.packages ?? []);

        for (const pattern of workspaces) {
          const parentDir = path.join(repoPath, pattern.replace(/\/?\*$/, ''));
          if (!fs.existsSync(parentDir)) continue;

          let entries: string[];
          try {
            entries = fs.readdirSync(parentDir);
          } catch {
            continue;
          }

          for (const entry of entries) {
            const wsDir = path.join(parentDir, entry);
            try {
              if (!fs.statSync(wsDir).isDirectory()) continue;
            } catch {
              continue;
            }

            const wsPkgPath = path.join(wsDir, 'package.json');
            if (!fs.existsSync(wsPkgPath)) continue;

            const content = fs.readFileSync(wsPkgPath, 'utf-8');
            const version = this.extractVersion(content, 'package.json');
            if (!version) continue;

            const relativePath = path.relative(repoPath, wsPkgPath).replace(/\\/g, '/');
            if (versions.some((v) => v.relativePath === relativePath)) continue;

            versions.push({
              file: wsPkgPath,
              relativePath,
              currentVersion: version,
              packageManager: 'npm',
            });
          }
        }
      } catch {
        // Root package.json parse failure — skip workspace scan
      }
    }

    return versions;
  }

  bumpVersion(current: string, type: 'major' | 'minor' | 'patch'): string {
    // Strip leading 'v' if present
    const clean = current.replace(/^v/, '');
    const parts = clean.split('.').map(Number);
    const major = parts[0] || 0;
    const minor = parts[1] || 0;
    const patch = parts[2] || 0;

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  updateVersion(repoPath: string, newVersion: string, files: string[]): SetUpActionResult {
    try {
      for (const filePath of files) {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(repoPath, filePath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        const fileName = path.basename(fullPath);
        const updated = this.replaceVersion(content, fileName, newVersion);
        fs.writeFileSync(fullPath, updated);
      }

      return { success: true, message: `Updated version to ${newVersion}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update version',
      };
    }
  }

  private extractVersion(content: string, fileName: string): string | null {
    if (fileName === 'package.json' || fileName === 'package-lock.json') {
      try {
        const json = JSON.parse(content);
        return json.version || null;
      } catch {
        return null;
      }
    }

    if (fileName === 'Cargo.toml') {
      const match = content.match(/^\[package\][^[]*?version\s*=\s*"([^"]+)"/ms);
      return match?.[1] || null;
    }

    if (fileName === 'pyproject.toml') {
      const match = content.match(/version\s*=\s*"([^"]+)"/);
      return match?.[1] || null;
    }

    if (fileName === 'setup.py') {
      const match = content.match(/version\s*=\s*['"]([^'"]+)['"]/);
      return match?.[1] || null;
    }

    if (fileName === 'build.gradle') {
      const match = content.match(/version\s*=?\s*['"]([^'"]+)['"]/);
      return match?.[1] || null;
    }

    if (fileName === 'pom.xml') {
      // Match the first <version> under <project> (not inside <dependency>)
      const match = content.match(/<project[^>]*>[\s\S]*?<version>([^<]+)<\/version>/);
      return match?.[1] || null;
    }

    return null;
  }

  private replaceVersion(content: string, fileName: string, newVersion: string): string {
    if (fileName === 'package.json' || fileName === 'package-lock.json') {
      try {
        const json = JSON.parse(content);
        json.version = newVersion;
        if (fileName === 'package-lock.json' && json.packages?.['']) {
          json.packages[''].version = newVersion;
        }
        // Preserve original indentation
        const indent = content.match(/^(\s+)"/)?.[1] || '  ';
        return JSON.stringify(json, null, indent) + '\n';
      } catch {
        return content;
      }
    }

    if (fileName === 'Cargo.toml') {
      return content.replace(/(^\[package\][^[]*?version\s*=\s*)"[^"]+"/ms, `$1"${newVersion}"`);
    }

    if (fileName === 'pyproject.toml') {
      return content.replace(/(version\s*=\s*)"[^"]+"/, `$1"${newVersion}"`);
    }

    if (fileName === 'setup.py') {
      return content.replace(/(version\s*=\s*)['"][^'"]+['"]/, `$1'${newVersion}'`);
    }

    if (fileName === 'build.gradle') {
      return content.replace(/(version\s*=?\s*)['"][^'"]+['"]/, `$1'${newVersion}'`);
    }

    if (fileName === 'pom.xml') {
      return content.replace(
        /(<project[^>]*>[\s\S]*?<version>)[^<]+(<\/version>)/,
        `$1${newVersion}$2`
      );
    }

    return content;
  }
}

export const versionService = new VersionService();
