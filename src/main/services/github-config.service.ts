/**
 * GitHub Config Service
 *
 * Manages .github/ directory configurations: scan, CRUD, template deployment,
 * issue template parsing. Enforces GitHub-mandated directory structure.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  GitHubConfigFeature,
  GitHubConfigScanResult,
  GitHubConfigTemplate,
  GitHubConfigIssueTemplate,
  SetUpActionResult,
} from '../ipc/channels/types';

const log = createLogger('github-config');

// ── Feature Registry ──────────────────────────────────────────────────────────
// Defines all 12 GitHub config features with their paths and metadata.
// Features are categorised into two tiers: Repository (core dev) and Community.

interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  /** Relative path within .github/ — file or directory */
  path: string;
  /** Whether feature is a directory containing multiple files */
  isDirectory: boolean;
  /** Glob for files inside directory features (e.g. '*.yml') */
  fileGlob?: string;
  tier: 'repository' | 'community';
}

const FEATURES: FeatureDefinition[] = [
  // ── Repository tier ──
  {
    id: 'workflows',
    label: 'Workflows',
    description: 'GitHub Actions CI/CD workflows',
    path: 'workflows',
    isDirectory: true,
    fileGlob: '*.yml',
    tier: 'repository',
  },
  {
    id: 'dependabot',
    label: 'Dependabot',
    description: 'Automated dependency updates',
    path: 'dependabot.yml',
    isDirectory: false,
    tier: 'repository',
  },
  {
    id: 'release-notes',
    label: 'Release Notes',
    description: 'Auto-generated release note categories',
    path: 'release.yml',
    isDirectory: false,
    tier: 'repository',
  },
  {
    id: 'issue-templates',
    label: 'Issue Templates',
    description: 'Structured issue forms and config',
    path: 'ISSUE_TEMPLATE',
    isDirectory: true,
    fileGlob: '*.yml',
    tier: 'repository',
  },
  {
    id: 'pr-template',
    label: 'PR Template',
    description: 'Pull request description template',
    path: 'PULL_REQUEST_TEMPLATE.md',
    isDirectory: false,
    tier: 'repository',
  },
  {
    id: 'labeler',
    label: 'Labeler',
    description: 'Auto-label PRs by file path',
    path: 'labeler.yml',
    isDirectory: false,
    tier: 'repository',
  },
  {
    id: 'codeowners',
    label: 'CODEOWNERS',
    description: 'Automatic PR review assignment',
    path: 'CODEOWNERS',
    isDirectory: false,
    tier: 'repository',
  },
  // ── Community tier ──
  {
    id: 'auto-assign',
    label: 'Auto-Assign',
    description: 'Auto-assign reviewers to PRs',
    path: 'auto_assign.yml',
    isDirectory: false,
    tier: 'community',
  },
  {
    id: 'copilot-instructions',
    label: 'Copilot Instructions',
    description: 'AI coding assistant conventions',
    path: 'copilot-instructions.md',
    isDirectory: false,
    tier: 'community',
  },
  {
    id: 'funding',
    label: 'Funding',
    description: 'Sponsor button configuration',
    path: 'FUNDING.yml',
    isDirectory: false,
    tier: 'community',
  },
  {
    id: 'security',
    label: 'Security Policy',
    description: 'Vulnerability reporting instructions',
    path: 'SECURITY.md',
    isDirectory: false,
    tier: 'community',
  },
  {
    id: 'stale',
    label: 'Stale',
    description: 'Auto-close inactive issues and PRs',
    path: 'stale.yml',
    isDirectory: false,
    tier: 'community',
  },
];

// ── Templates ─────────────────────────────────────────────────────────────────
// String-literal templates with sensible solo-developer defaults.

function getTemplates(featureId: string): GitHubConfigTemplate[] {
  switch (featureId) {
    case 'workflows':
      return [
        {
          id: 'ci-node',
          label: 'CI (Node.js)',
          description: 'Lint, test, and build on push/PR',
          targetPath: 'workflows/ci.yml',
          content: `name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
`,
        },
        {
          id: 'release',
          label: 'Release',
          description: 'Build and publish on tag push',
          targetPath: 'workflows/release.yml',
          content: `name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
`,
        },
        {
          id: 'auto-close-issues',
          label: 'Auto-Close Issues',
          description: 'Close linked issues when branch merges',
          targetPath: 'workflows/auto-close-issues.yml',
          content: `name: Auto-Close Issues

on:
  pull_request:
    types: [closed]

jobs:
  close-issue:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Extract issue number from branch
        id: extract
        run: |
          BRANCH="\${{ github.event.pull_request.head.ref }}"
          ISSUE_NUM=$(echo "$BRANCH" | grep -oP '\\d+' | head -1)
          echo "issue_number=$ISSUE_NUM" >> "$GITHUB_OUTPUT"
      - name: Close issue
        if: steps.extract.outputs.issue_number != ''
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.update({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: Number('\${{ steps.extract.outputs.issue_number }}'),
              state: 'closed',
              state_reason: 'completed'
            });
`,
        },
      ];

    case 'dependabot':
      return [
        {
          id: 'dependabot-npm',
          label: 'npm Weekly',
          description: 'Weekly npm dependency updates, grouped minor/patch',
          targetPath: 'dependabot.yml',
          content: `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types:
          - minor
          - patch
    open-pull-requests-limit: 10
`,
        },
      ];

    case 'release-notes':
      return [
        {
          id: 'release-notes-default',
          label: 'Categorised Release Notes',
          description: 'Group changes by label (feature, fix, breaking, docs)',
          targetPath: 'release.yml',
          content: `changelog:
  categories:
    - title: "\u{1F680} Features"
      labels:
        - enhancement
        - feature
    - title: "\u{1F41B} Bug Fixes"
      labels:
        - bug
        - fix
    - title: "\u{1F4A5} Breaking Changes"
      labels:
        - breaking
    - title: "\u{1F4DA} Documentation"
      labels:
        - documentation
        - docs
    - title: "\u{1F4E6} Dependencies"
      labels:
        - dependencies
    - title: "\u{1F9F9} Maintenance"
      labels:
        - chore
        - maintenance
    - title: Other Changes
      labels:
        - "*"
`,
        },
      ];

    case 'issue-templates':
      return [
        {
          id: 'bug-report',
          label: 'Bug Report',
          description: 'Steps to reproduce, expected vs actual behaviour',
          targetPath: 'ISSUE_TEMPLATE/bug-report.yml',
          content: `name: Bug Report
description: Report a bug or unexpected behaviour
title: "[Bug]: "
labels: [bug]
body:
  - type: textarea
    id: description
    attributes:
      label: Describe the bug
      description: A clear description of what the bug is
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: How can we reproduce this?
      placeholder: |
        1. Go to ...
        2. Click on ...
        3. See error
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behaviour
      description: What did you expect to happen?
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual behaviour
      description: What actually happened?
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: Environment
      description: "OS, browser, app version, etc."
      placeholder: "Windows 11, Chrome 120, v1.0.0"
`,
        },
        {
          id: 'feature-request',
          label: 'Feature Request',
          description: 'Propose a new feature or improvement',
          targetPath: 'ISSUE_TEMPLATE/feature-request.yml',
          content: `name: Feature Request
description: Suggest a new feature or improvement
title: "[Feature]: "
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What problem does this solve?
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: How should this work?
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: What other approaches did you consider?
`,
        },
        {
          id: 'issue-config',
          label: 'Template Config',
          description: 'Enable/disable blank issues and add contact links',
          targetPath: 'ISSUE_TEMPLATE/config.yml',
          content: `blank_issues_enabled: true
contact_links: []
`,
        },
      ];

    case 'pr-template':
      return [
        {
          id: 'pr-template-default',
          label: 'PR Checklist',
          description: 'Summary, changes, test plan, breaking changes',
          targetPath: 'PULL_REQUEST_TEMPLATE.md',
          content: `## Summary

<!-- Brief description of what this PR does -->

## Changes

-

## Test Plan

- [ ] Tests pass locally
- [ ] Manual testing completed

## Screenshots

<!-- If applicable -->

## Breaking Changes

<!-- List any breaking changes, or write "None" -->
None
`,
        },
      ];

    case 'labeler':
      return [
        {
          id: 'labeler-default',
          label: 'Path-based Labels',
          description: 'Label PRs by changed file paths',
          targetPath: 'labeler.yml',
          content: `frontend:
  - changed-files:
      - any-glob-to-any-file: 'src/renderer/**'

backend:
  - changed-files:
      - any-glob-to-any-file: 'src/main/**'

tests:
  - changed-files:
      - any-glob-to-any-file: 'tests/**'

ci:
  - changed-files:
      - any-glob-to-any-file: '.github/**'

docs:
  - changed-files:
      - any-glob-to-any-file: '**/*.md'
`,
        },
      ];

    case 'codeowners':
      return [
        {
          id: 'codeowners-solo',
          label: 'Single Owner',
          description: 'Assign all files to yourself',
          targetPath: 'CODEOWNERS',
          content: `# Default owner for all files
* @OWNER
`,
        },
      ];

    case 'auto-assign':
      return [
        {
          id: 'auto-assign-self',
          label: 'Self-Assign',
          description: 'Auto-assign yourself as reviewer, skip drafts',
          targetPath: 'auto_assign.yml',
          content: `addReviewers: true
addAssignees: author
reviewers:
  - OWNER
numberOfReviewers: 1
skipDraft: true
`,
        },
      ];

    case 'copilot-instructions':
      return [
        {
          id: 'copilot-default',
          label: 'Project Conventions',
          description: 'TypeScript, React, Electron, Vitest patterns',
          targetPath: 'copilot-instructions.md',
          content: `# Copilot Instructions

## Project Stack
- Electron + React + TypeScript
- Vite for bundling
- Tailwind CSS for styling
- Vitest + React Testing Library for tests
- Zustand for state management

## Conventions
- Use functional components with hooks
- Prefer named exports over default exports
- Use \`ipc.invoke()\` for IPC calls from renderer
- Use \`handleIpc()\` for IPC handlers in main process
- Follow existing \`domain:action\` IPC channel naming
- Use \`createLogger(tag)\` for logging in services
- Return \`SetUpActionResult\` from write/delete operations

## Testing
- Write tests with Vitest and React Testing Library
- Mock IPC calls in component tests
- Mock fs in service tests
- Follow RED-GREEN-REFACTOR cycle
`,
        },
      ];

    case 'funding':
      return [
        {
          id: 'funding-github',
          label: 'GitHub Sponsors',
          description: 'Enable GitHub Sponsors button',
          targetPath: 'FUNDING.yml',
          content: `github: [OWNER]
`,
        },
      ];

    case 'security':
      return [
        {
          id: 'security-default',
          label: 'Security Policy',
          description: 'Vulnerability reporting instructions',
          targetPath: 'SECURITY.md',
          content: `# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email: [your-email@example.com]
3. Include: description, steps to reproduce, and potential impact

## Response Timeline

- **Acknowledgement:** Within 48 hours
- **Initial Assessment:** Within 1 week
- **Fix/Patch:** Depends on severity

Thank you for helping keep this project secure.
`,
        },
      ];

    case 'stale':
      return [
        {
          id: 'stale-default',
          label: 'Stale Bot',
          description: '60 days inactive → stale, 14 days → close',
          targetPath: 'stale.yml',
          content: `daysUntilStale: 60
daysUntilClose: 14
staleLabel: stale
markComment: >
  This issue has been automatically marked as stale because it has not had
  recent activity. It will be closed in 14 days if no further activity occurs.
closeComment: >
  This issue has been automatically closed due to inactivity.
  Feel free to reopen if it is still relevant.
exemptLabels:
  - pinned
  - security
  - in-progress
exemptMilestones: true
exemptAssignees: true
`,
        },
      ];

    default:
      return [];
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

class GitHubConfigService {
  /**
   * Scan the .github/ directory and return status for all 12 features.
   */
  async scan(workingDirectory: string): Promise<GitHubConfigScanResult> {
    const githubDir = path.join(workingDirectory, '.github');
    const features: GitHubConfigFeature[] = [];

    for (const def of FEATURES) {
      const fullPath = path.join(githubDir, def.path);
      let exists = false;
      let files: string[] = [];

      try {
        if (def.isDirectory) {
          const entries = await fs.readdir(fullPath);
          files = entries.filter((e) => {
            if (def.fileGlob === '*.yml') return e.endsWith('.yml') || e.endsWith('.yaml');
            return true;
          });
          exists = files.length > 0;
        } else {
          await fs.access(fullPath);
          exists = true;
          files = [def.path];
        }
      } catch {
        // File/dir doesn't exist
      }

      features.push({
        id: def.id,
        label: def.label,
        description: def.description,
        path: def.path,
        exists,
        files,
      });
    }

    return { features };
  }

  /**
   * Read a file from .github/ directory.
   */
  async readFile(workingDirectory: string, relativePath: string): Promise<string> {
    const fullPath = path.join(workingDirectory, '.github', relativePath);
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      log.warn(`File not found: ${relativePath}`);
      return '';
    }
  }

  /**
   * Write a file to .github/ directory, creating parent dirs as needed.
   */
  async writeFile(
    workingDirectory: string,
    relativePath: string,
    content: string
  ): Promise<SetUpActionResult> {
    const fullPath = path.join(workingDirectory, '.github', relativePath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      log.info(`Wrote: .github/${relativePath}`);
      return { success: true, message: `Saved .github/${relativePath}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Failed to write .github/${relativePath}: ${msg}`);
      return { success: false, message: msg };
    }
  }

  /**
   * Delete a file or directory from .github/.
   */
  async deleteFile(workingDirectory: string, relativePath: string): Promise<SetUpActionResult> {
    const fullPath = path.join(workingDirectory, '.github', relativePath);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }
      log.info(`Deleted: .github/${relativePath}`);
      return { success: true, message: `Deleted .github/${relativePath}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: true, message: 'Already deleted' };
      }
      log.error(`Failed to delete .github/${relativePath}: ${msg}`);
      return { success: false, message: msg };
    }
  }

  /**
   * Deploy a feature from a template.
   */
  async createFromTemplate(
    workingDirectory: string,
    featureId: string,
    templateId: string
  ): Promise<SetUpActionResult> {
    const templates = getTemplates(featureId);
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      return {
        success: false,
        message: `Template "${templateId}" not found for feature "${featureId}"`,
      };
    }

    const fullPath = path.join(workingDirectory, '.github', template.targetPath);

    // Don't overwrite existing files
    try {
      await fs.access(fullPath);
      return { success: false, message: `File already exists: .github/${template.targetPath}` };
    } catch {
      // Good — file doesn't exist
    }

    return this.writeFile(workingDirectory, template.targetPath, template.content);
  }

  /**
   * List available templates for a feature.
   */
  listTemplates(featureId: string): GitHubConfigTemplate[] {
    return getTemplates(featureId);
  }

  /**
   * Parse issue templates from .github/ISSUE_TEMPLATE/ directory.
   * Extracts YAML front-matter (name, description, title, labels).
   */
  async listIssueTemplates(workingDirectory: string): Promise<GitHubConfigIssueTemplate[]> {
    const templateDir = path.join(workingDirectory, '.github', 'ISSUE_TEMPLATE');
    const templates: GitHubConfigIssueTemplate[] = [];

    try {
      const entries = await fs.readdir(templateDir);
      const ymlFiles = entries.filter(
        (e) => (e.endsWith('.yml') || e.endsWith('.yaml')) && e !== 'config.yml'
      );

      for (const file of ymlFiles) {
        const content = await fs.readFile(path.join(templateDir, file), 'utf-8');
        templates.push(this.parseIssueTemplate(content, file));
      }
    } catch {
      // Directory doesn't exist or is empty
    }

    return templates;
  }

  /**
   * Parse a single issue template YAML file into structured data.
   * Uses simple line-based parsing (no YAML library dependency).
   */
  private parseIssueTemplate(content: string, fileName: string): GitHubConfigIssueTemplate {
    const lines = content.split('\n');
    let name = '';
    let description = '';
    let title = '';
    const labels: string[] = [];
    let inLabels = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('name:')) {
        name = trimmed
          .slice(5)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        inLabels = false;
      } else if (trimmed.startsWith('description:')) {
        description = trimmed
          .slice(12)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        inLabels = false;
      } else if (trimmed.startsWith('title:')) {
        title = trimmed
          .slice(6)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        inLabels = false;
      } else if (trimmed.startsWith('labels:')) {
        inLabels = true;
        // Inline array: labels: [bug, enhancement]
        const inline = trimmed.slice(7).trim();
        if (inline.startsWith('[')) {
          const items = inline
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
          labels.push(...items.filter(Boolean));
          inLabels = false;
        }
      } else if (inLabels && trimmed.startsWith('- ')) {
        labels.push(
          trimmed
            .slice(2)
            .trim()
            .replace(/^['"]|['"]$/g, '')
        );
      } else if (trimmed.startsWith('body:') || trimmed.startsWith('assignees:')) {
        inLabels = false;
      }
    }

    return { name, description, title, labels, body: content, fileName };
  }
}

export const githubConfigService = new GitHubConfigService();
