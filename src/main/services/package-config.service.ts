/**
 * PackageConfigService
 *
 * Multi-ecosystem read/write for package configuration files.
 * Tier 1 (JSON): Fully parsed with indent preservation (node, php).
 * Tier 2/3 (TOML, go.mod, etc.): Raw text read/write.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Ecosystem, PackageConfigData, SetUpActionResult } from '../ipc/channels/types';

const CONFIG_FILES: Record<Ecosystem, string> = {
  node: 'package.json',
  php: 'composer.json',
  python: 'pyproject.toml',
  rust: 'Cargo.toml',
  go: 'go.mod',
  ruby: 'Gemfile',
  java: 'pom.xml',
  unknown: 'package.json',
};

const JSON_ECOSYSTEMS: Ecosystem[] = ['node', 'php'];

function detectIndent(raw: string): string | number {
  const match = raw.match(/^[ \t]+/m);
  if (!match) return 2;
  const ws = match[0];
  if (ws.startsWith('\t')) return '\t';
  return ws.length;
}

export class PackageConfigService {
  getConfigFileName(ecosystem: Ecosystem): string {
    return CONFIG_FILES[ecosystem] ?? CONFIG_FILES.unknown;
  }

  async read(workingDirectory: string, ecosystem: Ecosystem): Promise<PackageConfigData | null> {
    const fileName = this.getConfigFileName(ecosystem);
    const filePath = path.join(workingDirectory, fileName);

    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }

    const isJson = JSON_ECOSYSTEMS.includes(ecosystem);
    let structured: Record<string, unknown> | null = null;
    let indent: string | number = 2;

    if (isJson) {
      try {
        structured = JSON.parse(raw);
        indent = detectIndent(raw);
      } catch {
        // Malformed JSON — fall back to raw-only mode
      }
    }

    return { ecosystem, fileName, structured, raw, indent };
  }

  async write(
    workingDirectory: string,
    ecosystem: Ecosystem,
    data: PackageConfigData
  ): Promise<SetUpActionResult> {
    const fileName = this.getConfigFileName(ecosystem);
    const filePath = path.join(workingDirectory, fileName);

    try {
      const isJson = JSON_ECOSYSTEMS.includes(ecosystem);
      let content: string;

      if (isJson && data.structured) {
        content = JSON.stringify(data.structured, null, data.indent) + '\n';
      } else {
        content = data.raw;
      }

      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, message: `${fileName} saved` };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Write failed';
      return { success: false, message };
    }
  }
}

export const packageConfigService = new PackageConfigService();
