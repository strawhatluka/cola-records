/**
 * Format Config Service
 *
 * Detect project formatters, read/write config files (JSON for Prettier,
 * line-based TOML for Ruff/rustfmt), provide ecosystem presets, and
 * create ignore files. No external parsing dependencies.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  FormatterType,
  FormatterInfo,
  FormatterConfig,
  PrettierConfig,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('format-config');

// ────────────────────────────────────────────────────────────
// Detection
// ────────────────────────────────────────────────────────────

interface DetectionEntry {
  formatter: FormatterType;
  files: string[];
  packageJsonKey?: string;
  pyprojectSection?: string;
}

const DETECTION_MAP: Record<string, DetectionEntry[]> = {
  node: [
    {
      formatter: 'prettier',
      files: [
        '.prettierrc.json',
        '.prettierrc',
        '.prettierrc.js',
        '.prettierrc.cjs',
        '.prettierrc.mjs',
        '.prettierrc.yaml',
        '.prettierrc.yml',
        '.prettierrc.toml',
        'prettier.config.js',
        'prettier.config.cjs',
        'prettier.config.mjs',
      ],
      packageJsonKey: 'prettier',
    },
  ],
  python: [
    {
      formatter: 'ruff',
      files: ['ruff.toml'],
      pyprojectSection: '[tool.ruff]',
    },
    {
      formatter: 'black',
      files: [],
      pyprojectSection: '[tool.black]',
    },
  ],
  rust: [
    {
      formatter: 'rustfmt',
      files: ['rustfmt.toml', '.rustfmt.toml'],
    },
  ],
  go: [
    {
      formatter: 'gofmt',
      files: [],
    },
  ],
  ruby: [
    {
      formatter: 'rubocop',
      files: ['.rubocop.yml'],
    },
  ],
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectInEcosystem(
  directory: string,
  entries: DetectionEntry[],
  isTargetEcosystem: boolean = false
): Promise<FormatterInfo> {
  for (const entry of entries) {
    // gofmt has no config file — only detected when Go is the target ecosystem
    if (entry.formatter === 'gofmt') {
      if (isTargetEcosystem) {
        return { formatter: 'gofmt', configPath: null, hasConfig: false };
      }
      continue;
    }

    // Check config files
    for (const file of entry.files) {
      const fullPath = path.join(directory, file);
      if (await fileExists(fullPath)) {
        return { formatter: entry.formatter, configPath: fullPath, hasConfig: true };
      }
    }

    // Check package.json "prettier" key (Node)
    if (entry.packageJsonKey) {
      const pkgPath = path.join(directory, 'package.json');
      if (await fileExists(pkgPath)) {
        try {
          const pkgContent = await fs.readFile(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          if (pkg[entry.packageJsonKey]) {
            return { formatter: entry.formatter, configPath: pkgPath, hasConfig: true };
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Check pyproject.toml sections (Python)
    if (entry.pyprojectSection) {
      const pyprojectPath = path.join(directory, 'pyproject.toml');
      if (await fileExists(pyprojectPath)) {
        try {
          const content = await fs.readFile(pyprojectPath, 'utf-8');
          if (content.includes(entry.pyprojectSection)) {
            return { formatter: entry.formatter, configPath: pyprojectPath, hasConfig: true };
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  return { formatter: null, configPath: null, hasConfig: false };
}

// ────────────────────────────────────────────────────────────
// Config read/write
// ────────────────────────────────────────────────────────────

function parsePrettierJson(content: string): PrettierConfig {
  const raw = JSON.parse(content);
  const config: PrettierConfig = {};

  const boolKeys: (keyof PrettierConfig)[] = [
    'semi',
    'singleQuote',
    'useTabs',
    'bracketSpacing',
    'jsxSingleQuote',
  ];
  const numberKeys: (keyof PrettierConfig)[] = ['printWidth', 'tabWidth'];
  const stringKeys: (keyof PrettierConfig)[] = [
    'trailingComma',
    'arrowParens',
    'endOfLine',
    'quoteProps',
    'proseWrap',
  ];

  for (const key of boolKeys) {
    if (typeof raw[key] === 'boolean') {
      (config as Record<string, unknown>)[key] = raw[key];
    }
  }
  for (const key of numberKeys) {
    if (typeof raw[key] === 'number') {
      (config as Record<string, unknown>)[key] = raw[key];
    }
  }
  for (const key of stringKeys) {
    if (typeof raw[key] === 'string') {
      (config as Record<string, unknown>)[key] = raw[key];
    }
  }

  return config;
}

function parseSimpleToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('[')) continue;

    const match = line.match(/^([^=]+?)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      let value: unknown = match[2].trim();

      // Parse value types
      const strValue = value as string;
      if (strValue === 'true') value = true;
      else if (strValue === 'false') value = false;
      else if (/^\d+$/.test(strValue)) value = parseInt(strValue, 10);
      else if (strValue.startsWith('"') && strValue.endsWith('"')) {
        value = strValue.slice(1, -1);
      }

      result[key] = value;
    }
  }

  return result;
}

function serializeSimpleToml(config: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue;
    if (typeof value === 'string') {
      lines.push(`${key} = "${value}"`);
    } else {
      lines.push(`${key} = ${String(value)}`);
    }
  }
  return lines.join('\n') + '\n';
}

// ────────────────────────────────────────────────────────────
// Presets
// ────────────────────────────────────────────────────────────

function getPrettierPreset(): PrettierConfig {
  return {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    arrowParens: 'always',
    endOfLine: 'lf',
  };
}

function getRuffPreset(): Record<string, unknown> {
  return {
    'line-length': 88,
    'indent-width': 4,
  };
}

function getBlackPreset(): Record<string, unknown> {
  return {
    'line-length': 88,
    'target-version': 'py311',
  };
}

function getRustfmtPreset(): Record<string, unknown> {
  return {
    max_width: 100,
    tab_spaces: 4,
    edition: '2021',
  };
}

function getRubocopPreset(): Record<string, unknown> {
  return {};
}

// ────────────────────────────────────────────────────────────
// Ignore files
// ────────────────────────────────────────────────────────────

const PRETTIER_IGNORE = `# Dependencies
node_modules/

# Build output
dist/
build/
out/

# Coverage
coverage/

# Generated
*.min.js
*.min.css

# Package lock files
package-lock.json
pnpm-lock.yaml
yarn.lock
`;

const RUFF_IGNORE = `# Build output
__pycache__/
*.pyc
dist/
build/
*.egg-info/

# Virtual environments
.venv/
venv/
`;

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

class FormatConfigService {
  async detectFormatter(directory: string, ecosystem: Ecosystem): Promise<FormatterInfo> {
    // Try ecosystem-specific detection first
    const entries = DETECTION_MAP[ecosystem];
    if (entries) {
      const result = await detectInEcosystem(directory, entries, true);
      if (result.formatter) return result;
    }

    // Fall back: check all known config files across all ecosystems
    for (const [eco, ecoEntries] of Object.entries(DETECTION_MAP)) {
      if (eco === ecosystem) continue; // Already checked
      const result = await detectInEcosystem(directory, ecoEntries, false);
      if (result.formatter) return result;
    }

    return { formatter: null, configPath: null, hasConfig: false };
  }

  async readConfig(configPath: string, formatter: FormatterType): Promise<FormatterConfig> {
    const content = await fs.readFile(configPath, 'utf-8');

    if (formatter === 'prettier') {
      // Handle package.json "prettier" key
      const basename = path.basename(configPath);
      if (basename === 'package.json') {
        const pkg = JSON.parse(content);
        return {
          formatter,
          config: pkg.prettier as PrettierConfig,
          configPath,
        };
      }

      return {
        formatter,
        config: parsePrettierJson(content),
        configPath,
      };
    }

    // TOML-based formatters (ruff, rustfmt)
    if (formatter === 'ruff' || formatter === 'rustfmt') {
      return {
        formatter,
        config: parseSimpleToml(content),
        configPath,
      };
    }

    // Generic fallback — return raw content as a single "content" key
    return {
      formatter,
      config: { _raw: content },
      configPath,
    };
  }

  async writeConfig(
    directory: string,
    formatter: FormatterType,
    config: PrettierConfig | Record<string, unknown>
  ): Promise<SetUpActionResult> {
    try {
      if (formatter === 'prettier') {
        const configPath = path.join(directory, '.prettierrc.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        logger.info(`Wrote .prettierrc.json to: ${directory}`);
        return { success: true, message: 'Saved .prettierrc.json' };
      }

      if (formatter === 'ruff') {
        const configPath = path.join(directory, 'ruff.toml');
        await fs.writeFile(
          configPath,
          serializeSimpleToml(config as Record<string, unknown>),
          'utf-8'
        );
        logger.info(`Wrote ruff.toml to: ${directory}`);
        return { success: true, message: 'Saved ruff.toml' };
      }

      if (formatter === 'rustfmt') {
        const configPath = path.join(directory, 'rustfmt.toml');
        await fs.writeFile(
          configPath,
          serializeSimpleToml(config as Record<string, unknown>),
          'utf-8'
        );
        logger.info(`Wrote rustfmt.toml to: ${directory}`);
        return { success: true, message: 'Saved rustfmt.toml' };
      }

      return { success: false, message: `Write not supported for ${formatter}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write ${formatter} config: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  getPresets(
    ecosystem: Ecosystem,
    formatter: FormatterType | null
  ): PrettierConfig | Record<string, unknown> {
    if (formatter === 'prettier' || (!formatter && ecosystem === 'node')) {
      return getPrettierPreset();
    }
    if (formatter === 'ruff') return getRuffPreset();
    if (formatter === 'black') return getBlackPreset();
    if (formatter === 'rustfmt') return getRustfmtPreset();
    if (formatter === 'rubocop') return getRubocopPreset();

    // Default to Prettier presets for unknown
    return getPrettierPreset();
  }

  getIgnoreFileName(formatter: FormatterType): string | null {
    if (formatter === 'prettier') return '.prettierignore';
    if (formatter === 'ruff') return '.ruff_ignore';
    return null;
  }

  async readIgnoreFile(directory: string, formatter: FormatterType): Promise<string> {
    const fileName = this.getIgnoreFileName(formatter);
    if (!fileName) return '';
    const filePath = path.join(directory, fileName);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  async writeIgnoreFile(
    directory: string,
    formatter: FormatterType,
    content: string
  ): Promise<SetUpActionResult> {
    const fileName = this.getIgnoreFileName(formatter);
    if (!fileName) {
      return { success: false, message: `Ignore file not supported for ${formatter}` };
    }
    try {
      const filePath = path.join(directory, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Wrote ${fileName} in: ${directory}`);
      return { success: true, message: `Saved ${fileName}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write ignore file: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  async createIgnoreFile(directory: string, formatter: FormatterType): Promise<SetUpActionResult> {
    try {
      let fileName: string;
      let content: string;

      if (formatter === 'prettier') {
        fileName = '.prettierignore';
        content = PRETTIER_IGNORE;
      } else if (formatter === 'ruff') {
        fileName = '.ruff_ignore';
        content = RUFF_IGNORE;
      } else {
        return { success: false, message: `Ignore file not supported for ${formatter}` };
      }

      const filePath = path.join(directory, fileName);
      if (await fileExists(filePath)) {
        return { success: false, message: `${fileName} already exists` };
      }

      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Created ${fileName} in: ${directory}`);
      return { success: true, message: `Created ${fileName}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create ignore file: ${msg}`);
      return { success: false, message: `Failed to create: ${msg}` };
    }
  }
}

export const formatConfigService = new FormatConfigService();
