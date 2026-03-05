/**
 * Workflow Service
 *
 * Orchestrates AI + git operations for automated content generation:
 * changelog entries and commit messages.
 */
import * as fs from 'fs';
import * as path from 'path';
import { gitService } from './git.service';
import { aiService } from './ai.service';

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
}

export const workflowService = new WorkflowService();
