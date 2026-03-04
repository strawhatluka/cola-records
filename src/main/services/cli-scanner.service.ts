/**
 * CLI Scanner Service
 *
 * Scans PATH directories for executables, groups by source
 * (system, npm global, pip, cargo, etc.), and parses --help
 * output for dynamic CLI discovery.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import type { CLIGroup, CLIEntry, CLIHelpResult } from '../ipc/channels/types';

const HELP_TIMEOUT = 5000;

/** Map ecosystem to the CLI source groups that are relevant */
const ECOSYSTEM_GROUPS: Record<string, string[]> = {
  node: ['Node.js', 'System'],
  python: ['Python', 'System'],
  rust: ['Rust', 'System'],
  go: ['Go', 'System'],
  ruby: ['Ruby', 'System'],
};

/** Core system tools always included regardless of ecosystem */
const CORE_SYSTEM_TOOLS = new Set([
  'git',
  'ssh',
  'scp',
  'curl',
  'wget',
  'docker',
  'docker-compose',
  'node',
  'npm',
  'npx',
  'yarn',
  'pnpm',
  'bun',
  'python',
  'python3',
  'pip',
  'pip3',
  'cargo',
  'rustc',
  'rustup',
  'go',
  'make',
  'cmake',
  'gh',
  'code',
  'claude',
  'tar',
  'zip',
  'unzip',
  'grep',
  'find',
  'ls',
  'cat',
  'chmod',
  'chown',
  'cp',
  'mv',
  'rm',
  'mkdir',
]);

export class CLIScannerService {
  scanCLIs(ecosystem?: string): CLIGroup[] {
    const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const groups = new Map<string, CLIEntry[]>();
    const seen = new Set<string>();

    for (const dir of pathDirs) {
      if (!fs.existsSync(dir)) continue;

      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        continue;
      }

      const source = this.classifySource(dir);

      for (const entry of entries) {
        if (seen.has(entry)) continue;

        const fullPath = path.join(dir, entry);
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) continue;

          // Check if executable (Unix) or has common extensions (Windows)
          const isExecutable =
            process.platform === 'win32'
              ? /\.(exe|cmd|bat|ps1)$/i.test(entry)
              : (stat.mode & 0o111) !== 0;

          if (!isExecutable) continue;

          // Skip hidden files and common non-CLI binaries
          if (entry.startsWith('.') || entry.startsWith('_')) continue;

          seen.add(entry);

          const name =
            process.platform === 'win32' ? entry.replace(/\.(exe|cmd|bat|ps1)$/i, '') : entry;

          let groupEntries = groups.get(source);
          if (!groupEntries) {
            groupEntries = [];
            groups.set(source, groupEntries);
          }
          groupEntries.push({ name, path: fullPath });
        } catch {
          continue;
        }
      }
    }

    // Filter by ecosystem if provided
    const relevantSources = ecosystem ? ECOSYSTEM_GROUPS[ecosystem] : undefined;

    const result: CLIGroup[] = [];
    for (const [source, entries] of groups) {
      let filteredEntries = entries;

      if (relevantSources) {
        if (relevantSources.includes(source)) {
          // Relevant ecosystem group — include all entries
          filteredEntries = entries;
        } else if (source === 'System' || source === 'Homebrew' || source === 'Other') {
          // System/other groups — only include core tools
          filteredEntries = entries.filter((e) => CORE_SYSTEM_TOOLS.has(e.name));
        } else {
          // Irrelevant ecosystem group — skip entirely
          continue;
        }
      }

      if (filteredEntries.length === 0) continue;
      filteredEntries.sort((a, b) => a.name.localeCompare(b.name));
      result.push({ source, entries: filteredEntries });
    }
    result.sort((a, b) => a.source.localeCompare(b.source));

    return result;
  }

  getCLIHelp(cliPath: string, subcommand?: string): Promise<CLIHelpResult> {
    return new Promise((resolve) => {
      const args = subcommand ? [subcommand, '--help'] : ['--help'];
      const command = path.basename(cliPath);

      execFile(cliPath, args, { timeout: HELP_TIMEOUT }, (error, stdout, stderr) => {
        // Many CLIs output help to stderr or exit with code 1
        const rawOutput = stdout || stderr || (error?.message ?? '');

        if (!rawOutput) {
          resolve({
            description: `${command}: no help available`,
            usage: '',
            subcommands: [],
            flags: [],
            rawOutput: '',
          });
          return;
        }

        resolve({
          description: this.parseDescription(rawOutput, command),
          usage: this.parseUsage(rawOutput),
          subcommands: this.parseSubcommands(rawOutput),
          flags: this.parseFlags(rawOutput),
          rawOutput: rawOutput.slice(0, 4000),
        });
      });
    });
  }

  private classifySource(dir: string): string {
    const lower = dir.toLowerCase();

    if (lower.includes('node_modules/.bin') || lower.includes('npm')) return 'Node.js';
    if (lower.includes('.cargo/bin')) return 'Rust';
    if (lower.includes('pip') || lower.includes('python') || lower.includes('conda'))
      return 'Python';
    if (lower.includes('go/bin') || lower.includes('gopath')) return 'Go';
    if (lower.includes('.rbenv') || lower.includes('ruby') || lower.includes('gem')) return 'Ruby';
    if (lower.includes('/usr/local/bin') || lower.includes('/usr/bin') || lower.includes('/bin'))
      return 'System';
    if (lower.includes('homebrew') || lower.includes('/opt/homebrew')) return 'Homebrew';
    if (lower.includes('snap')) return 'Snap';

    return 'Other';
  }

  private parseDescription(output: string, command: string): string {
    // Try to find a description line (usually first non-empty line or after "DESCRIPTION")
    const lines = output
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Check for DESCRIPTION section
    const descIdx = lines.findIndex((l) => /^description:?$/i.test(l));
    if (descIdx !== -1 && lines[descIdx + 1]) {
      return lines[descIdx + 1];
    }

    // First line often has the description
    if (lines[0] && !lines[0].startsWith('-') && !lines[0].startsWith('Usage')) {
      return lines[0].replace(new RegExp(`^${command}\\s*[-:]\\s*`, 'i'), '');
    }

    return `${command} command`;
  }

  private parseUsage(output: string): string {
    const match = output.match(/(?:Usage|USAGE):?\s*(.+)/i);
    return match?.[1]?.trim() ?? '';
  }

  private parseSubcommands(output: string): { name: string; description: string }[] {
    const subcommands: { name: string; description: string }[] = [];
    const lines = output.split('\n');

    let inSubcommands = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect section headers containing "commands" or "subcommands" anywhere
      if (/\bcommands?\b|\bsubcommands?\b/i.test(trimmed) && trimmed.endsWith(':')) {
        inSubcommands = true;
        continue;
      }

      // Git-style: detect lowercase section headers like "start a working area (see also: ...)"
      // These are non-indented, lowercase lines followed by indented command lines
      if (!inSubcommands && /^[a-z]/.test(trimmed) && trimmed.length > 0) {
        const nextLine = lines[i + 1];
        if (nextLine && /^\s{2,}\S+\s{2,}/.test(nextLine)) {
          inSubcommands = true;
          continue;
        }
      }

      if (inSubcommands) {
        // Match indented subcommand lines: 2+ spaces, name, 2+ spaces, description
        const match = line.match(/^\s{2,}(\S+)\s{2,}(.+)/);
        if (match) {
          // Skip flag-like entries (starting with -)
          if (!match[1].startsWith('-')) {
            subcommands.push({ name: match[1], description: match[2].trim() });
          }
          continue;
        }

        // Empty line or non-indented text — possible section boundary
        if (trimmed === '') {
          // Allow gaps between sections (git has blank lines between groups)
          continue;
        }

        // Non-indented lowercase text = new section header (git-style grouping)
        if (/^[a-z]/.test(trimmed)) {
          continue;
        }

        // Uppercase or other non-matching line — end of subcommands area
        if (/^[A-Z]/.test(trimmed) || trimmed.startsWith("'")) {
          if (subcommands.length > 0) break;
          inSubcommands = false;
        }
      }
    }

    return subcommands;
  }

  private parseFlags(output: string): { flag: string; description: string; required: boolean }[] {
    const flags: { flag: string; description: string; required: boolean }[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match patterns like:  -f, --flag  Description  or  --flag=VALUE  Description
      const match = line.match(/^\s+(--?\S+(?:[=]\S+)?(?:\s*,\s*--?\S+(?:[=]\S+)?)?)\s{2,}(.+)/);
      if (match) {
        flags.push({
          flag: match[1].trim(),
          description: match[2].trim(),
          required: /required/i.test(match[2]),
        });
      }
    }

    return flags;
  }
}

export const cliScannerService = new CLIScannerService();
