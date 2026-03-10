/**
 * EditorConfig Service
 *
 * Parse, write, and manage .editorconfig files with ecosystem-aware presets.
 * Uses simple INI-style parsing — no external dependencies.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  EditorConfigFile,
  EditorConfigSection,
  EditorConfigProperties,
  SetUpActionResult,
} from '../ipc/channels/types';

const logger = createLogger('editorconfig');

const KNOWN_BOOLEAN_PROPS = ['trim_trailing_whitespace', 'insert_final_newline'] as const;
const KNOWN_NUMBER_PROPS = ['indent_size', 'tab_width'] as const;
const KNOWN_ENUM_PROPS = ['indent_style', 'end_of_line', 'charset'] as const;

function parseBooleanValue(value: string): boolean | undefined {
  const lower = value.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  return undefined;
}

function parseProperties(raw: Record<string, string>): EditorConfigProperties {
  const props: EditorConfigProperties = {};

  for (const key of KNOWN_BOOLEAN_PROPS) {
    if (raw[key] !== undefined) {
      const val = parseBooleanValue(raw[key]);
      if (val !== undefined) {
        (props as Record<string, unknown>)[key] = val;
      }
    }
  }

  for (const key of KNOWN_NUMBER_PROPS) {
    if (raw[key] !== undefined) {
      const num = parseInt(raw[key], 10);
      if (!isNaN(num)) {
        (props as Record<string, unknown>)[key] = num;
      }
    }
  }

  for (const key of KNOWN_ENUM_PROPS) {
    if (raw[key] !== undefined) {
      (props as Record<string, unknown>)[key] = raw[key];
    }
  }

  // max_line_length: can be a number or "off"
  if (raw['max_line_length'] !== undefined) {
    const val = raw['max_line_length'];
    if (val === 'off') {
      props.max_line_length = 'off';
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        props.max_line_length = num;
      }
    }
  }

  return props;
}

function serializeProperties(props: EditorConfigProperties): string[] {
  const lines: string[] = [];
  const order: (keyof EditorConfigProperties)[] = [
    'indent_style',
    'indent_size',
    'tab_width',
    'end_of_line',
    'charset',
    'trim_trailing_whitespace',
    'insert_final_newline',
    'max_line_length',
  ];

  for (const key of order) {
    const val = props[key];
    if (val !== undefined) {
      lines.push(`${key} = ${val}`);
    }
  }

  return lines;
}

function serializeConfig(config: EditorConfigFile): string {
  const lines: string[] = ['# EditorConfig — https://editorconfig.org'];

  if (config.root) {
    lines.push('root = true');
  }

  for (const section of config.sections) {
    lines.push('');
    lines.push(`[${section.glob}]`);
    lines.push(...serializeProperties(section.properties));
  }

  lines.push('');
  return lines.join('\n');
}

function parseConfigContent(content: string): EditorConfigFile {
  const lines = content.split(/\r?\n/);
  let root = false;
  const sections: EditorConfigSection[] = [];
  let currentGlob: string | null = null;
  let currentProps: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip comments and empty lines
    if (line === '' || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    // Section header: [glob]
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      // Save previous section
      if (currentGlob !== null) {
        sections.push({ glob: currentGlob, properties: parseProperties(currentProps) });
      }
      currentGlob = sectionMatch[1];
      currentProps = {};
      continue;
    }

    // Key = value
    const kvMatch = line.match(/^([^=]+?)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim().toLowerCase();
      const value = kvMatch[2].trim();

      // root = true is a top-level property (before any section)
      if (key === 'root' && currentGlob === null) {
        root = value.toLowerCase() === 'true';
        continue;
      }

      if (currentGlob !== null) {
        currentProps[key] = value;
      }
    }
  }

  // Save last section
  if (currentGlob !== null) {
    sections.push({ glob: currentGlob, properties: parseProperties(currentProps) });
  }

  return { root, sections };
}

// ────────────────────────────────────────────────────────────
// Ecosystem Presets
// ────────────────────────────────────────────────────────────

function baseProps(indentStyle: 'tab' | 'space', indentSize: number): EditorConfigProperties {
  return {
    indent_style: indentStyle,
    indent_size: indentSize,
    end_of_line: 'lf',
    charset: 'utf-8',
    trim_trailing_whitespace: true,
    insert_final_newline: true,
  };
}

function getNodePreset(): EditorConfigSection[] {
  return [
    { glob: '*', properties: baseProps('space', 2) },
    { glob: '*.md', properties: { trim_trailing_whitespace: false } },
  ];
}

function getPythonPreset(): EditorConfigSection[] {
  return [
    { glob: '*', properties: baseProps('space', 4) },
    { glob: '*.md', properties: { trim_trailing_whitespace: false } },
  ];
}

function getGoPreset(): EditorConfigSection[] {
  return [
    {
      glob: '*',
      properties: {
        indent_style: 'tab',
        tab_width: 4,
        end_of_line: 'lf',
        charset: 'utf-8',
        trim_trailing_whitespace: true,
        insert_final_newline: true,
      },
    },
  ];
}

function getRustPreset(): EditorConfigSection[] {
  return [{ glob: '*', properties: baseProps('space', 4) }];
}

function getRubyPreset(): EditorConfigSection[] {
  return [{ glob: '*', properties: baseProps('space', 2) }];
}

function getPhpPreset(): EditorConfigSection[] {
  return [{ glob: '*', properties: baseProps('space', 4) }];
}

function getJavaPreset(): EditorConfigSection[] {
  return [{ glob: '*', properties: baseProps('space', 4) }];
}

function getDefaultPreset(): EditorConfigSection[] {
  return [
    { glob: '*', properties: baseProps('space', 2) },
    { glob: '*.md', properties: { trim_trailing_whitespace: false } },
  ];
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

class EditorConfigService {
  async readConfig(directory: string): Promise<EditorConfigFile> {
    const configPath = path.join(directory, '.editorconfig');
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return parseConfigContent(content);
    } catch {
      return { root: true, sections: [] };
    }
  }

  async writeConfig(directory: string, config: EditorConfigFile): Promise<SetUpActionResult> {
    const configPath = path.join(directory, '.editorconfig');
    try {
      const content = serializeConfig(config);
      await fs.writeFile(configPath, content, 'utf-8');
      logger.info(`Wrote .editorconfig to: ${directory}`);
      return { success: true, message: 'Saved .editorconfig' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write .editorconfig: ${msg}`);
      return { success: false, message: `Failed to save: ${msg}` };
    }
  }

  async createDefault(directory: string, ecosystem: Ecosystem): Promise<SetUpActionResult> {
    const configPath = path.join(directory, '.editorconfig');
    try {
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        return { success: false, message: '.editorconfig already exists' };
      }

      const sections = this.getPresets(ecosystem);
      const config: EditorConfigFile = { root: true, sections };
      const content = serializeConfig(config);
      await fs.writeFile(configPath, content, 'utf-8');
      logger.info(`Created default .editorconfig for ${ecosystem} in: ${directory}`);
      return { success: true, message: `Created .editorconfig (${ecosystem} preset)` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create .editorconfig: ${msg}`);
      return { success: false, message: `Failed to create: ${msg}` };
    }
  }

  async deleteConfig(directory: string): Promise<SetUpActionResult> {
    const configPath = path.join(directory, '.editorconfig');
    try {
      await fs.unlink(configPath);
      logger.info(`Deleted .editorconfig from: ${directory}`);
      return { success: true, message: 'Deleted .editorconfig' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to delete .editorconfig: ${msg}`);
      return { success: false, message: `Failed to delete: ${msg}` };
    }
  }

  getPresets(ecosystem: Ecosystem): EditorConfigSection[] {
    switch (ecosystem) {
      case 'node':
        return getNodePreset();
      case 'python':
        return getPythonPreset();
      case 'go':
        return getGoPreset();
      case 'rust':
        return getRustPreset();
      case 'ruby':
        return getRubyPreset();
      case 'php':
        return getPhpPreset();
      case 'java':
        return getJavaPreset();
      default:
        return getDefaultPreset();
    }
  }
}

export const editorconfigService = new EditorConfigService();
