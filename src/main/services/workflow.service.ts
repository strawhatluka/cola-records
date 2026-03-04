/**
 * Workflow Service
 *
 * Orchestrates AI + git operations for automated content generation:
 * changelog entries, README updates, docs updates, commit messages,
 * and PR descriptions.
 */
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';
import { gitService } from './git.service';
import { aiService } from './ai.service';
import type { DocsUpdateEntry } from '../ipc/channels/types';

const logger = log.create({ logId: 'WorkflowService' }).scope('workflow');

export class WorkflowService {
  /**
   * Extract issue number from a branch name following conventional patterns.
   * E.g. "feat/22-maintenance-tools" → "22", "fix/bug-123" → "123"
   * Returns undefined if no issue number found.
   */
  private extractIssueFromBranch(branchName?: string): string | undefined {
    if (!branchName) return undefined;
    // Match number after prefix slash: feat/22-foo, fix/123-bar
    const slashMatch = branchName.match(/\/(\d+)[-/]/);
    if (slashMatch) return slashMatch[1];
    // Match number at end after dash: feature-42
    const dashMatch = branchName.match(/-(\d+)$/);
    if (dashMatch) return dashMatch[1];
    return undefined;
  }

  /**
   * Resolve the issue number: use explicit value if provided, else extract from branch.
   */
  private resolveIssueNumber(issueNumber?: string, branchName?: string): string | undefined {
    if (issueNumber && issueNumber !== '0' && issueNumber !== 'undefined') return issueNumber;
    return this.extractIssueFromBranch(branchName);
  }

  /**
   * Read package.json from a repo path and return parsed content.
   */
  private readPackageJson(repoPath: string): Record<string, unknown> | null {
    const pkgPath = path.join(repoPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Scan directory structure for top-level directories and key files.
   */
  private scanProjectStructure(repoPath: string): string {
    try {
      const entries = fs.readdirSync(repoPath, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => `${e.name}/`);
      const files = entries.filter((e) => e.isFile()).map((e) => e.name);
      return `Directories: ${dirs.join(', ')}\nFiles: ${files.join(', ')}`;
    } catch {
      return '';
    }
  }

  /**
   * Remove the last line if it appears truncated mid-sentence by token limits.
   * Detects bullets ending with prepositions, articles, conjunctions, or commas
   * that indicate the sentence was cut off.
   */
  private trimIncompleteTrailingLine(text: string): string {
    const lines = text.split('\n');
    if (lines.length === 0) return text;

    const lastLine = lines[lines.length - 1].trim();
    // Drop bullet lines that end with words/chars suggesting mid-sentence cutoff
    if (
      lastLine.startsWith('- ') &&
      /(\b(?:to|the|a|an|and|or|for|in|on|of|with|from|by|as|at|is|are|was|were|be|that|this|it)\s*$|,\s*$|:\s*$)/.test(
        lastLine
      )
    ) {
      lines.pop();
    }
    return lines.join('\n').trimEnd();
  }

  /**
   * Build a per-file change summary from git diff output.
   * Splits diff into per-file hunks and summarizes each file's changes
   * so the AI prompt includes ALL changed files, not just a truncated diff.
   */
  private buildFileChangeSummary(diff: string, maxPerFile: number = 1500): string {
    if (!diff) return '';

    const fileSections: string[] = [];
    const filePattern = /^diff --git a\/(.+?) b\/(.+?)$/gm;
    const matches = [...diff.matchAll(filePattern)];

    for (let i = 0; i < matches.length; i++) {
      const filePath = matches[i][2];
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? diff.length) : diff.length;
      const fileDiff = diff.slice(start, end);

      // Extract only added/removed lines for a compact summary
      const addedLines: string[] = [];
      const removedLines: string[] = [];
      for (const line of fileDiff.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          addedLines.push(line.slice(1).trim());
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          removedLines.push(line.slice(1).trim());
        }
      }

      let summary = `FILE: ${filePath}\n`;
      if (removedLines.length > 0) {
        summary += `REMOVED:\n${removedLines.join('\n').slice(0, maxPerFile / 2)}\n`;
      }
      if (addedLines.length > 0) {
        summary += `ADDED:\n${addedLines.join('\n').slice(0, maxPerFile / 2)}\n`;
      }
      fileSections.push(summary);
    }

    return fileSections.join('\n---\n');
  }

  async generateChangelog(
    repoPath: string,
    issueNumber?: string,
    branchName?: string
  ): Promise<{ entry: string; hasChanges: boolean }> {
    const diff = await gitService.getDiff(repoPath);
    const status = await gitService.getStatus(repoPath);

    if (!diff && status.files.length === 0) {
      return { entry: '', hasChanges: false };
    }

    let existingChangelog = '';
    const changelogPath = path.join(repoPath, 'CHANGELOG.md');
    if (fs.existsSync(changelogPath)) {
      existingChangelog = fs.readFileSync(changelogPath, 'utf-8');
    }

    // Build per-file change summary so AI sees ALL changed files
    const fileChangeSummary = this.buildFileChangeSummary(diff);

    // Build file list with status indicators
    const fileList = status.files
      .map((f) => {
        const indicator =
          f.index === '?' ? 'NEW' : f.index === 'D' || f.working_dir === 'D' ? 'DEL' : 'MOD';
        return `  ${indicator} ${f.path}`;
      })
      .join('\n');

    const resolvedIssue = this.resolveIssueNumber(issueNumber, branchName);

    const prompt = `OUTPUT ONLY raw markdown changelog entries following Keep a Changelog format (keepachangelog.com).

RULES:
1. Output ONLY ### category headings with bullet entries beneath them. No other text.
2. Do NOT include any explanation, commentary, preamble, or code fences.
3. Use ONLY these 6 category headings (include only categories with actual changes):
   ### Added — for new features, files, or capabilities
   ### Changed — for changes in existing functionality
   ### Deprecated — for soon-to-be removed features
   ### Removed — for removed features or files
   ### Fixed — for bug fixes
   ### Security — for vulnerability fixes
4. Each entry starts with "- " (bullet)
5. Use imperative mood ("Add X" not "Added X")
6. Be specific — mention component names, file names, or feature names
7. One bullet per distinct change. Cover ALL files listed below.
8. No version numbers, no dates, no ## headings
${resolvedIssue ? `9. Reference issue #${resolvedIssue} where relevant` : ''}
${branchName ? `10. Branch context: ${branchName}` : ''}

EXISTING CHANGELOG STYLE (match this tone and detail level):
${existingChangelog.slice(0, 800)}

ALL CHANGED FILES (you MUST cover every file):
${fileList}

PER-FILE CHANGES:
${fileChangeSummary.slice(0, 24000)}`;

    const response = await aiService.complete({ prompt, maxTokens: 8192 });
    let entry = response.content.trim();

    // Strip code fences if AI wrapped output
    entry = entry.replace(/^```(?:markdown|md)?\n/i, '').replace(/\n```\s*$/, '');

    // Strip preamble before first ### heading
    const sectionIndex = entry.indexOf('### ');
    if (sectionIndex > 0) {
      entry = entry.slice(sectionIndex);
    }

    // Drop incomplete trailing bullet (token limit cutoff)
    entry = this.trimIncompleteTrailingLine(entry);

    return { entry: entry.trim(), hasChanges: true };
  }

  async generateReadmeUpdate(
    repoPath: string
  ): Promise<{ content: string; hasChanges: boolean; currentReadme: string }> {
    const diff = await gitService.getDiff(repoPath);
    const status = await gitService.getStatus(repoPath);

    const readmePath = path.join(repoPath, 'README.md');
    let currentReadme = '';
    if (fs.existsSync(readmePath)) {
      currentReadme = fs.readFileSync(readmePath, 'utf-8').trim();
    }

    // If README is missing or blank, generate a new one from project info
    if (!currentReadme) {
      const pkg = this.readPackageJson(repoPath);
      const structure = this.scanProjectStructure(repoPath);

      const prompt = `You are a README.md file generator. OUTPUT ONLY the raw README.md content. No explanation, no commentary, no code fences.

Generate a complete README.md for this project. Include these sections:
- Project title and description
- Features (if discernible from the codebase)
- Getting Started / Installation
- Usage
- Scripts (if package.json has scripts)
- License (if detectable)

PROJECT INFO:
${pkg ? `Name: ${(pkg.name as string) ?? 'unknown'}\nDescription: ${(pkg.description as string) ?? ''}\nScripts: ${Object.keys((pkg.scripts as Record<string, string>) ?? {}).join(', ')}\nDependencies: ${Object.keys((pkg.dependencies as Record<string, string>) ?? {}).join(', ')}` : 'No package.json found'}

STRUCTURE:
${structure}

${diff ? `RECENT CHANGES:\n${diff.slice(0, 8000)}` : ''}

OUTPUT ONLY the raw README.md content.`;

      const response = await aiService.complete({ prompt, maxTokens: 8192 });
      let content = response.content.trim();
      content = content.replace(/^```(?:markdown|md)?\n/i, '').replace(/\n```\s*$/, '');
      const headingIndex = content.indexOf('# ');
      if (headingIndex > 0) content = content.slice(headingIndex);
      content = this.trimIncompleteTrailingLine(content);

      return { content: content.trim(), hasChanges: true, currentReadme: '' };
    }

    // Existing README — check if diff warrants updates
    if (!diff && status.files.length === 0) {
      return { content: '', hasChanges: false, currentReadme };
    }

    const prompt = `You are a README.md file generator. Your output will be written directly to README.md. OUTPUT ONLY the raw file content — no explanation, no commentary, no analysis, no preamble, no "Here's the updated README" text. Do NOT wrap output in code fences.

If the git diff below requires README changes, output the COMPLETE updated README.md file content ready to save. Preserve all existing sections, formatting, and content that are still accurate. Only modify sections affected by the code changes.

If no README changes are needed, respond with exactly: NO_CHANGES_NEEDED

CURRENT README.md:
${currentReadme.slice(0, 10000)}

GIT DIFF:
${diff.slice(0, 12000)}

FILES CHANGED: ${status.files.map((f) => f.path).join(', ')}

REMEMBER: Output ONLY the raw README.md content. No commentary.`;

    const response = await aiService.complete({ prompt, maxTokens: 8192 });
    let content = response.content.trim();

    if (content === 'NO_CHANGES_NEEDED' || content.includes('NO_CHANGES_NEEDED')) {
      return { content: '', hasChanges: false, currentReadme };
    }

    // Strip code fences if AI wrapped output in ```markdown ... ```
    content = content.replace(/^```(?:markdown|md)?\n/i, '').replace(/\n```\s*$/, '');

    // Strip conversational preamble before first markdown heading
    const headingIndex = content.indexOf('# ');
    if (headingIndex > 0) {
      content = content.slice(headingIndex);
    }

    // Drop incomplete trailing line (token limit cutoff)
    content = this.trimIncompleteTrailingLine(content);

    return { content: content.trim(), hasChanges: true, currentReadme };
  }

  async generateDocsUpdate(
    repoPath: string
  ): Promise<{ updates: DocsUpdateEntry[]; hasChanges: boolean }> {
    logger.info('generateDocsUpdate: starting for %s', repoPath);
    const diff = await gitService.getDiff(repoPath);
    const status = await gitService.getStatus(repoPath);
    logger.info('generateDocsUpdate: diff=%d chars, files=%d', diff.length, status.files.length);

    // Gather existing docs
    const docsDir = path.join(repoPath, 'docs');
    const existingDocs: string[] = [];
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir, { recursive: true });
      for (const file of files) {
        const filePath = path.join(docsDir, String(file));
        if (fs.statSync(filePath).isFile() && filePath.endsWith('.md')) {
          existingDocs.push(`${file}: ${fs.readFileSync(filePath, 'utf-8').slice(0, 1000)}`);
        }
      }
    }

    const contributingPath = path.join(repoPath, 'CONTRIBUTING.md');
    const contributingContent = fs.existsSync(contributingPath)
      ? fs.readFileSync(contributingPath, 'utf-8').slice(0, 2000)
      : '';

    logger.info(
      'generateDocsUpdate: existingDocs=%d, contributingContent=%s',
      existingDocs.length,
      contributingContent ? 'yes' : 'no'
    );

    // If no docs exist, generate initial documentation from project info
    if (existingDocs.length === 0 && !contributingContent) {
      logger.info('generateDocsUpdate: no existing docs — generating initial docs');
      const pkg = this.readPackageJson(repoPath);
      const structure = this.scanProjectStructure(repoPath);

      const prompt = `OUTPUT ONLY valid JSON. No explanation, no commentary, no code fences, no preamble.

Generate initial project documentation. Create 2-3 documentation files for this project based on its structure. Each "content" field must contain complete markdown file content ready to write to disk.

IMPORTANT path rules:
- CONTRIBUTING.md and LICENSE.md must use root paths: "CONTRIBUTING.md", "LICENSE.md"
- All other documentation files must go into the docs/ directory: "docs/filename.md"

Required JSON format:
{"updates":[{"path":"docs/filename.md","content":"full file content","action":"create"}],"hasChanges":true}

Suggested files:
- docs/getting-started.md — Installation, setup, and first steps
- docs/architecture.md — Project structure and design decisions (if meaningful codebase)
- CONTRIBUTING.md — Contributing guidelines (root path, not docs/)

PROJECT INFO:
${pkg ? `Name: ${(pkg.name as string) ?? 'unknown'}\nDescription: ${(pkg.description as string) ?? ''}\nScripts: ${Object.keys((pkg.scripts as Record<string, string>) ?? {}).join(', ')}\nDependencies: ${Object.keys((pkg.dependencies as Record<string, string>) ?? {}).join(', ')}` : 'No package.json found'}

STRUCTURE:
${structure}

${diff ? `RECENT CHANGES:\n${diff.slice(0, 6000)}` : ''}

Files: ${status.files.map((f) => f.path).join(', ')}`;

      const response = await aiService.complete({ prompt, maxTokens: 8192 });
      logger.info(
        'generateDocsUpdate: initial docs AI response length=%d, tokens=%d',
        response.content.length,
        response.tokensUsed
      );
      try {
        const jsonStr = response.content
          .replace(/```json?\n?/g, '')
          .replace(/```/g, '')
          .trim();
        const parsed = JSON.parse(jsonStr) as { updates: DocsUpdateEntry[]; hasChanges: boolean };
        logger.info(
          'generateDocsUpdate: initial docs parsed — updates=%d, hasChanges=%s',
          parsed.updates.length,
          parsed.hasChanges
        );
        return parsed;
      } catch (parseErr) {
        logger.warn(
          'generateDocsUpdate: JSON parse failed for initial docs — %s',
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        );
        return { updates: [], hasChanges: false };
      }
    }

    // Existing docs — check if diff warrants updates
    if (!diff && status.files.length === 0) {
      logger.info('generateDocsUpdate: no diff and no changed files — returning no changes');
      return { updates: [], hasChanges: false };
    }

    logger.info('generateDocsUpdate: existing docs found — checking if diff warrants updates');

    const prompt = `OUTPUT ONLY valid JSON. No explanation, no commentary, no code fences, no preamble.

Determine if the git diff requires documentation updates. Each "content" field must contain the complete file content ready to be written to disk.

IMPORTANT path rules:
- CONTRIBUTING.md and LICENSE.md must use root paths: "CONTRIBUTING.md", "LICENSE.md"
- All other documentation files must go into the docs/ directory: "docs/filename.md"

Required JSON format:
{"updates":[{"path":"docs/filename.md","content":"full file content","action":"create|update"}],"hasChanges":true}

If no changes needed:
{"updates":[],"hasChanges":false}

Existing docs:
${existingDocs.join('\n---\n').slice(0, 4000)}

${contributingContent ? `CONTRIBUTING.md:\n${contributingContent}` : ''}

Diff:
${diff.slice(0, 12000)}

Files: ${status.files.map((f) => f.path).join(', ')}`;

    const response = await aiService.complete({ prompt, maxTokens: 8192 });
    logger.info(
      'generateDocsUpdate: update AI response length=%d, tokens=%d',
      response.content.length,
      response.tokensUsed
    );

    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonStr = response.content
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(jsonStr) as { updates: DocsUpdateEntry[]; hasChanges: boolean };
      logger.info(
        'generateDocsUpdate: update parsed — updates=%d, hasChanges=%s',
        parsed.updates.length,
        parsed.hasChanges
      );
      return parsed;
    } catch (parseErr) {
      logger.warn(
        'generateDocsUpdate: JSON parse failed — %s, raw=%s',
        parseErr instanceof Error ? parseErr.message : String(parseErr),
        response.content.slice(0, 200)
      );
      return { updates: [], hasChanges: false };
    }
  }

  async generateCommitMessage(
    repoPath: string,
    issueNumber?: string,
    branchName?: string
  ): Promise<string> {
    const diff = await gitService.getDiffStaged(repoPath);

    if (!diff) {
      return '';
    }

    const resolvedIssue = this.resolveIssueNumber(issueNumber, branchName);

    const prompt = `OUTPUT ONLY a single conventional commit message. No explanation, no options, no commentary.

Format: type(scope): description
Types: feat, fix, refactor, chore, docs, style, test, perf, ci, build
Max 72 characters. Imperative mood. Be specific.
${resolvedIssue ? `End with (#${resolvedIssue})` : ''}
${branchName ? `Branch: ${branchName}` : ''}

Diff:
${diff.slice(0, 12000)}`;

    const response = await aiService.complete({ prompt, maxTokens: 512, temperature: 0.3 });
    // Take only the first line and strip surrounding quotes
    const firstLine = response.content.trim().split('\n')[0];
    return firstLine.replace(/^["'`]|["'`]$/g, '');
  }

  async generatePRDescription(
    repoPath: string,
    baseBranch: string,
    headBranch: string,
    issueNumber?: string
  ): Promise<string> {
    const comparison = await gitService.compareBranches(repoPath, baseBranch, headBranch);
    const resolvedIssue = this.resolveIssueNumber(issueNumber, headBranch);

    const commitList = comparison.commits.map((c) => `- ${c.message}`).join('\n');

    // Build file list for the Changes table
    const fileList = comparison.files
      .map((f) => `${f.file} (+${f.insertions} -${f.deletions})`)
      .join('\n');

    const prompt = `OUTPUT ONLY the PR description in markdown. No preamble, no "Here's the PR description" text, no code fences around the output.

Merging "${headBranch}" into "${baseBranch}". Use this EXACT format:

## Summary

- [1-2 sentence description of the primary change]
- [Key behavioral details]
- [Notable design decisions]

## Changes

| File | Change |
|------|--------|
(one row per changed file, mark new files with **New**, describe what changed)

## Test plan

- [How to verify these changes]
- [Count of automated tests added/modified]
${resolvedIssue ? `\nCloses #${resolvedIssue}` : ''}

KEY PRINCIPLES: Use tables over prose. Be specific about what changed in each file. Summary should be bullet points, not paragraphs.

Commits:
${commitList}

Changed files:
${fileList}

Stats: ${comparison.totalFilesChanged} files, +${comparison.totalInsertions} -${comparison.totalDeletions}

Diff:
${comparison.rawDiff.slice(0, 16000)}`;

    const response = await aiService.complete({ prompt, maxTokens: 8192 });
    let description = response.content.trim();

    // Strip code fences
    description = description.replace(/^```(?:markdown|md)?\n/i, '').replace(/\n```\s*$/, '');

    // Strip preamble before first ## heading
    const summaryIndex = description.indexOf('## ');
    if (summaryIndex > 0) {
      description = description.slice(summaryIndex);
    }

    // Drop incomplete trailing line (token limit cutoff)
    description = this.trimIncompleteTrailingLine(description);

    return description.trim();
  }

  /**
   * Parse changelog entries from AI output into category → bullets map.
   * E.g. "### Added\n- X\n- Y\n### Fixed\n- Z" → { Added: ["- X", "- Y"], Fixed: ["- Z"] }
   */
  private parseChangelogSections(entry: string): Map<string, string[]> {
    const sections = new Map<string, string[]>();
    let currentCategory = '';

    for (const line of entry.split('\n')) {
      const headingMatch = line.match(/^### (Added|Changed|Deprecated|Removed|Fixed|Security)/);
      if (headingMatch) {
        currentCategory = headingMatch[1];
        if (!sections.has(currentCategory)) {
          sections.set(currentCategory, []);
        }
      } else if (currentCategory && line.trim().startsWith('- ')) {
        sections.get(currentCategory)?.push(line);
      }
    }

    return sections;
  }

  async applyChangelog(repoPath: string, entry: string): Promise<void> {
    const changelogPath = path.join(repoPath, 'CHANGELOG.md');

    if (!fs.existsSync(changelogPath)) {
      fs.writeFileSync(
        changelogPath,
        `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n## [Unreleased]\n\n${entry}\n`
      );
      return;
    }

    let content = fs.readFileSync(changelogPath, 'utf-8');

    // Ensure [Unreleased] section exists
    if (!content.includes('## [Unreleased]')) {
      const firstHeadingEnd = content.indexOf('\n') + 1;
      content =
        content.slice(0, firstHeadingEnd) +
        '\n## [Unreleased]\n\n' +
        content.slice(firstHeadingEnd);
    }

    // Parse new entries by category
    const newSections = this.parseChangelogSections(entry);

    // Merge each category's bullets into the matching ### heading
    for (const [category, bullets] of newSections) {
      const heading = `### ${category}`;
      const headingIndex = content.indexOf(heading);
      const bulletText = '\n' + bullets.join('\n');

      if (headingIndex !== -1) {
        // Find end of heading line, insert bullets right after
        const endOfLine = content.indexOf('\n', headingIndex);
        content = content.slice(0, endOfLine) + bulletText + content.slice(endOfLine);
      } else {
        // Category doesn't exist — add it at end of [Unreleased] section
        const nextVersionIndex = content.indexOf('\n## [', content.indexOf('## [Unreleased]') + 1);
        const insertAt = nextVersionIndex === -1 ? content.length : nextVersionIndex;
        content =
          content.slice(0, insertAt).trimEnd() +
          '\n\n' +
          heading +
          bulletText +
          '\n' +
          content.slice(insertAt);
      }
    }

    fs.writeFileSync(changelogPath, content);
  }

  async applyReadme(repoPath: string, content: string): Promise<void> {
    const readmePath = path.join(repoPath, 'README.md');
    fs.writeFileSync(readmePath, content);
  }

  async applyDocsUpdate(repoPath: string, update: DocsUpdateEntry): Promise<void> {
    // Enforce path rules: CONTRIBUTING.md and LICENSE.md go to root, everything else to docs/
    const basename = path.basename(update.path).toUpperCase();
    const ROOT_FILES = ['CONTRIBUTING.MD', 'LICENSE.MD', 'LICENSE'];
    let resolvedPath = update.path;
    if (ROOT_FILES.includes(basename)) {
      // Ensure root-level placement even if AI returned "docs/CONTRIBUTING.md"
      resolvedPath = path.basename(update.path);
    } else if (!update.path.startsWith('docs/') && !update.path.startsWith('docs\\')) {
      // Ensure non-root files go into docs/
      resolvedPath = path.join('docs', update.path);
    }

    const fullPath = path.join(repoPath, resolvedPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, update.content);
  }
}

export const workflowService = new WorkflowService();
