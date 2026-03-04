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

/** Known aliases that should deduplicate to a single tool */
const KNOWN_ALIASES: Record<string, string> = {
  nodejs: 'node',
  python3: 'python',
  pip3: 'pip',
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

          const name =
            process.platform === 'win32' ? entry.replace(/\.(exe|cmd|bat|ps1)$/i, '') : entry;

          // Normalize known aliases (python3→python, nodejs→node, pip3→pip)
          const canonical = KNOWN_ALIASES[name] ?? name;
          if (seen.has(canonical)) continue;
          seen.add(canonical);

          let groupEntries = groups.get(source);
          if (!groupEntries) {
            groupEntries = [];
            groups.set(source, groupEntries);
          }
          groupEntries.push({ name: canonical, path: fullPath });
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
    const command = path.basename(cliPath);

    // For subcommands, use -h (brief help) to avoid opening browser/man pages (e.g. git)
    // For top-level, try --help first, then fall back to -h if no useful output
    const argsList = subcommand
      ? [
          [subcommand, '-h'],
          [subcommand, '--help'],
        ]
      : [['--help'], ['-h'], ['help']];

    return this.tryHelpArgs(cliPath, command, argsList);
  }

  private async tryHelpArgs(
    cliPath: string,
    command: string,
    argsList: string[][]
  ): Promise<CLIHelpResult> {
    let bestRaw = '';

    for (const args of argsList) {
      const result = await this.execHelp(cliPath, args);
      if (result) {
        // Keep the longest raw output as fallback
        if (result.length > bestRaw.length) bestRaw = result;

        const parsed: CLIHelpResult = {
          description: this.parseDescription(result, command),
          usage: this.parseUsage(result),
          subcommands: this.parseSubcommands(result),
          flags: this.parseFlags(result),
          rawOutput: result.slice(0, 4000),
        };
        // Accept if we got any useful parsed data (subcommands or flags)
        if (parsed.subcommands.length > 0 || parsed.flags.length > 0 || parsed.usage) {
          return parsed;
        }
      }
    }

    // Nothing structured found — return raw output so the UI can still show something
    if (bestRaw) {
      return {
        description: this.parseDescription(bestRaw, command),
        usage: this.parseUsage(bestRaw),
        subcommands: [],
        flags: [],
        rawOutput: bestRaw.slice(0, 4000),
      };
    }

    return {
      description: `${command}: no help available`,
      usage: '',
      subcommands: [],
      flags: [],
      rawOutput: '',
    };
  }

  private execHelp(cliPath: string, args: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      // shell: true is required on Windows to execute .cmd/.bat wrappers
      // (Node.js global tools like claude, npm, npx are .cmd scripts on Windows)
      const opts = { timeout: HELP_TIMEOUT, shell: process.platform === 'win32' };
      execFile(cliPath, args, opts, (error, stdout, stderr) => {
        // Many CLIs output help to stderr or exit with code 1
        const rawOutput = stdout || stderr || (error?.message ?? '');
        resolve(rawOutput || null);
      });
    });
  }

  private classifySource(dir: string): string {
    const lower = dir.toLowerCase();

    // Code-server paths are duplicates of system tools — classify as System
    if (lower.includes('code-server')) return 'System';
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
        // Match indented subcommand lines: 2+ spaces, name (with optional args), 2+ spaces, description
        const match = line.match(/^\s{2,}(\S+)(?:\s+(?:<[^>]+>|\[[^\]]+\]|\S+))*\s{2,}(.+)/);
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
      // Match patterns like:
      //   -f, --flag  Description
      //   --flag=VALUE  Description
      //   --flag <value>  Description
      //   -c, --continue  Description
      const match = line.match(
        /^\s+(--?\S+(?:[=]\S+)?(?:\s+<[^>]+>|\s+\[[^\]]+\])?(?:\s*,\s*--?\S+(?:[=]\S+)?(?:\s+<[^>]+>|\s+\[[^\]]+\])?)?)\s{2,}(.+)/
      );
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
