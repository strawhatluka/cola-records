// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Mock fs/promises
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockRm = vi.fn();
const mockAccess = vi.fn();
const mockStat = vi.fn();
const mockUnlink = vi.fn();
vi.mock('fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  rm: (...args: unknown[]) => mockRm(...args),
  access: (...args: unknown[]) => mockAccess(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { githubConfigService } from '../../../src/main/services/github-config.service';

const WORK_DIR = '/test/project';
const GITHUB_DIR = path.join(WORK_DIR, '.github');

describe('GitHubConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  // ── scan ──

  describe('scan', () => {
    it('returns all 12 features with exists=false when .github/ is empty', async () => {
      // All readdir and access calls should fail (nothing exists)
      mockReaddir.mockRejectedValue(new Error('ENOENT'));
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.scan(WORK_DIR);

      expect(result.features).toHaveLength(12);
      for (const feature of result.features) {
        expect(feature.exists).toBe(false);
        expect(feature.files).toEqual([]);
      }
    });

    it('detects existing directory feature (workflows) with yml files', async () => {
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === path.join(GITHUB_DIR, 'workflows')) {
          return Promise.resolve(['ci.yml', 'release.yaml', 'README.md']);
        }
        return Promise.reject(new Error('ENOENT'));
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.scan(WORK_DIR);
      const workflows = result.features.find((f) => f.id === 'workflows');

      expect(workflows).toBeDefined();
      expect(workflows!.exists).toBe(true);
      // README.md should be filtered out (only .yml/.yaml)
      expect(workflows!.files).toEqual(['ci.yml', 'release.yaml']);
    });

    it('detects existing file feature (dependabot.yml)', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));
      mockAccess.mockImplementation((fullPath: string) => {
        if (fullPath === path.join(GITHUB_DIR, 'dependabot.yml')) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await githubConfigService.scan(WORK_DIR);
      const dependabot = result.features.find((f) => f.id === 'dependabot');

      expect(dependabot).toBeDefined();
      expect(dependabot!.exists).toBe(true);
      expect(dependabot!.files).toEqual(['dependabot.yml']);
    });

    it('marks directory feature as not existing when it has no matching files', async () => {
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === path.join(GITHUB_DIR, 'workflows')) {
          // Only non-yml files
          return Promise.resolve(['README.md', 'notes.txt']);
        }
        return Promise.reject(new Error('ENOENT'));
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.scan(WORK_DIR);
      const workflows = result.features.find((f) => f.id === 'workflows');

      expect(workflows!.exists).toBe(false);
      expect(workflows!.files).toEqual([]);
    });

    it('detects ISSUE_TEMPLATE directory feature', async () => {
      mockReaddir.mockImplementation((dir: string) => {
        if (dir === path.join(GITHUB_DIR, 'ISSUE_TEMPLATE')) {
          return Promise.resolve(['bug-report.yml', 'config.yml']);
        }
        return Promise.reject(new Error('ENOENT'));
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.scan(WORK_DIR);
      const issueTemplates = result.features.find((f) => f.id === 'issue-templates');

      expect(issueTemplates!.exists).toBe(true);
      expect(issueTemplates!.files).toEqual(['bug-report.yml', 'config.yml']);
    });

    it('includes correct metadata for each feature', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.scan(WORK_DIR);

      const workflows = result.features.find((f) => f.id === 'workflows');
      expect(workflows!.label).toBe('Workflows');
      expect(workflows!.description).toBe('GitHub Actions CI/CD workflows');
      expect(workflows!.path).toBe('workflows');

      const prTemplate = result.features.find((f) => f.id === 'pr-template');
      expect(prTemplate!.label).toBe('PR Template');
      expect(prTemplate!.path).toBe('PULL_REQUEST_TEMPLATE.md');
    });

    it('detects multiple file features existing simultaneously', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));
      mockAccess.mockImplementation((fullPath: string) => {
        const existingFiles = [
          path.join(GITHUB_DIR, 'dependabot.yml'),
          path.join(GITHUB_DIR, 'CODEOWNERS'),
          path.join(GITHUB_DIR, 'FUNDING.yml'),
        ];
        if (existingFiles.includes(fullPath)) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await githubConfigService.scan(WORK_DIR);

      expect(result.features.find((f) => f.id === 'dependabot')!.exists).toBe(true);
      expect(result.features.find((f) => f.id === 'codeowners')!.exists).toBe(true);
      expect(result.features.find((f) => f.id === 'funding')!.exists).toBe(true);
      expect(result.features.find((f) => f.id === 'pr-template')!.exists).toBe(false);
    });
  });

  // ── readFile ──

  describe('readFile', () => {
    it('reads a file from .github/ directory', async () => {
      mockReadFile.mockResolvedValue('name: CI\non: push\n');

      const content = await githubConfigService.readFile(WORK_DIR, 'workflows/ci.yml');

      expect(mockReadFile).toHaveBeenCalledWith(path.join(GITHUB_DIR, 'workflows/ci.yml'), 'utf-8');
      expect(content).toBe('name: CI\non: push\n');
    });

    it('returns empty string when file does not exist', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const content = await githubConfigService.readFile(WORK_DIR, 'nonexistent.yml');

      expect(content).toBe('');
    });

    it('returns empty string on permission error', async () => {
      mockReadFile.mockRejectedValue(new Error('EACCES'));

      const content = await githubConfigService.readFile(WORK_DIR, 'protected.yml');

      expect(content).toBe('');
    });
  });

  // ── writeFile ──

  describe('writeFile', () => {
    it('writes file and creates parent directories', async () => {
      const result = await githubConfigService.writeFile(
        WORK_DIR,
        'workflows/ci.yml',
        'name: CI\n'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Saved .github/workflows/ci.yml');
      expect(mockMkdir).toHaveBeenCalledWith(
        path.dirname(path.join(GITHUB_DIR, 'workflows/ci.yml')),
        { recursive: true }
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(GITHUB_DIR, 'workflows/ci.yml'),
        'name: CI\n',
        'utf-8'
      );
    });

    it('writes file at root of .github/', async () => {
      const result = await githubConfigService.writeFile(
        WORK_DIR,
        'dependabot.yml',
        'version: 2\n'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Saved .github/dependabot.yml');
    });

    it('returns error on mkdir failure', async () => {
      mockMkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await githubConfigService.writeFile(WORK_DIR, 'workflows/ci.yml', 'content');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Permission denied');
    });

    it('returns error on writeFile failure', async () => {
      mockWriteFile.mockRejectedValue(new Error('Disk full'));

      const result = await githubConfigService.writeFile(WORK_DIR, 'dependabot.yml', 'content');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Disk full');
    });

    it('handles non-Error thrown objects', async () => {
      mockWriteFile.mockRejectedValue('string error');

      const result = await githubConfigService.writeFile(WORK_DIR, 'dependabot.yml', 'content');

      expect(result.success).toBe(false);
      expect(result.message).toBe('string error');
    });
  });

  // ── deleteFile ──

  describe('deleteFile', () => {
    it('deletes a regular file using unlink', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => false });

      const result = await githubConfigService.deleteFile(WORK_DIR, 'dependabot.yml');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Deleted .github/dependabot.yml');
      expect(mockUnlink).toHaveBeenCalledWith(path.join(GITHUB_DIR, 'dependabot.yml'));
      expect(mockRm).not.toHaveBeenCalled();
    });

    it('deletes a directory using rm with recursive option', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => true });

      const result = await githubConfigService.deleteFile(WORK_DIR, 'workflows');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Deleted .github/workflows');
      expect(mockRm).toHaveBeenCalledWith(path.join(GITHUB_DIR, 'workflows'), { recursive: true });
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('returns success when file already deleted (ENOENT)', async () => {
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockStat.mockRejectedValue(enoentError);

      const result = await githubConfigService.deleteFile(WORK_DIR, 'nonexistent.yml');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Already deleted');
    });

    it('returns error on permission failure', async () => {
      const eaccesError = new Error('Permission denied') as NodeJS.ErrnoException;
      eaccesError.code = 'EACCES';
      mockStat.mockRejectedValue(eaccesError);

      const result = await githubConfigService.deleteFile(WORK_DIR, 'protected.yml');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Permission denied');
    });

    it('handles non-Error thrown objects', async () => {
      mockStat.mockRejectedValue('unexpected failure');

      const result = await githubConfigService.deleteFile(WORK_DIR, 'file.yml');

      expect(result.success).toBe(false);
      expect(result.message).toBe('unexpected failure');
    });

    it('returns error when unlink fails on a file', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => false });
      mockUnlink.mockRejectedValue(new Error('I/O error'));

      const result = await githubConfigService.deleteFile(WORK_DIR, 'broken.yml');

      expect(result.success).toBe(false);
      expect(result.message).toBe('I/O error');
    });
  });

  // ── createFromTemplate ──

  describe('createFromTemplate', () => {
    it('deploys a template to the correct path', async () => {
      // File does not exist yet
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.createFromTemplate(
        WORK_DIR,
        'dependabot',
        'dependabot-npm'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Saved .github/dependabot.yml');
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(GITHUB_DIR, 'dependabot.yml'),
        expect.stringContaining('package-ecosystem: npm'),
        'utf-8'
      );
    });

    it('refuses to overwrite existing file', async () => {
      // File already exists
      mockAccess.mockResolvedValue(undefined);

      const result = await githubConfigService.createFromTemplate(
        WORK_DIR,
        'dependabot',
        'dependabot-npm'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('File already exists: .github/dependabot.yml');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('returns error for unknown template id', async () => {
      const result = await githubConfigService.createFromTemplate(
        WORK_DIR,
        'dependabot',
        'nonexistent-template'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Template "nonexistent-template" not found');
      expect(result.message).toContain('feature "dependabot"');
    });

    it('returns error for unknown feature id', async () => {
      const result = await githubConfigService.createFromTemplate(
        WORK_DIR,
        'unknown-feature',
        'some-template'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Template "some-template" not found');
    });

    it('deploys workflow template to workflows/ subdirectory', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.createFromTemplate(WORK_DIR, 'workflows', 'ci-node');

      expect(result.success).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(GITHUB_DIR, 'workflows/ci.yml'),
        expect.stringContaining('name: CI'),
        'utf-8'
      );
    });

    it('deploys issue template to ISSUE_TEMPLATE/ subdirectory', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.createFromTemplate(
        WORK_DIR,
        'issue-templates',
        'bug-report'
      );

      expect(result.success).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(GITHUB_DIR, 'ISSUE_TEMPLATE/bug-report.yml'),
        expect.stringContaining('name: Bug Report'),
        'utf-8'
      );
    });

    it('deploys PR template as a markdown file', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await githubConfigService.createFromTemplate(
        WORK_DIR,
        'pr-template',
        'pr-template-default'
      );

      expect(result.success).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(GITHUB_DIR, 'PULL_REQUEST_TEMPLATE.md'),
        expect.stringContaining('## Summary'),
        'utf-8'
      );
    });

    it('propagates write errors from writeFile', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockRejectedValue(new Error('Read-only filesystem'));

      const result = await githubConfigService.createFromTemplate(
        WORK_DIR,
        'dependabot',
        'dependabot-npm'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Read-only filesystem');
    });
  });

  // ── listTemplates ──

  describe('listTemplates', () => {
    it('returns templates for workflows feature', () => {
      const templates = githubConfigService.listTemplates('workflows');

      expect(templates).toHaveLength(3);
      expect(templates.map((t) => t.id)).toEqual(['ci-node', 'release', 'auto-close-issues']);
    });

    it('returns templates for dependabot feature', () => {
      const templates = githubConfigService.listTemplates('dependabot');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('dependabot-npm');
      expect(templates[0].targetPath).toBe('dependabot.yml');
    });

    it('returns templates for issue-templates feature', () => {
      const templates = githubConfigService.listTemplates('issue-templates');

      expect(templates).toHaveLength(3);
      expect(templates.map((t) => t.id)).toEqual(['bug-report', 'feature-request', 'issue-config']);
    });

    it('returns templates for release-notes feature', () => {
      const templates = githubConfigService.listTemplates('release-notes');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('release-notes-default');
    });

    it('returns templates for pr-template feature', () => {
      const templates = githubConfigService.listTemplates('pr-template');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('pr-template-default');
      expect(templates[0].targetPath).toBe('PULL_REQUEST_TEMPLATE.md');
    });

    it('returns templates for labeler feature', () => {
      const templates = githubConfigService.listTemplates('labeler');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('labeler-default');
    });

    it('returns templates for codeowners feature', () => {
      const templates = githubConfigService.listTemplates('codeowners');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('codeowners-solo');
    });

    it('returns templates for auto-assign feature', () => {
      const templates = githubConfigService.listTemplates('auto-assign');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('auto-assign-self');
    });

    it('returns templates for copilot-instructions feature', () => {
      const templates = githubConfigService.listTemplates('copilot-instructions');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('copilot-default');
    });

    it('returns templates for funding feature', () => {
      const templates = githubConfigService.listTemplates('funding');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('funding-github');
    });

    it('returns templates for security feature', () => {
      const templates = githubConfigService.listTemplates('security');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('security-default');
    });

    it('returns templates for stale feature', () => {
      const templates = githubConfigService.listTemplates('stale');

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('stale-default');
    });

    it('returns empty array for unknown feature', () => {
      const templates = githubConfigService.listTemplates('unknown-feature');

      expect(templates).toEqual([]);
    });

    it('each template has required fields', () => {
      const allFeatureIds = [
        'workflows',
        'dependabot',
        'release-notes',
        'issue-templates',
        'pr-template',
        'labeler',
        'codeowners',
        'auto-assign',
        'copilot-instructions',
        'funding',
        'security',
        'stale',
      ];

      for (const featureId of allFeatureIds) {
        const templates = githubConfigService.listTemplates(featureId);
        for (const template of templates) {
          expect(template.id).toBeTruthy();
          expect(template.label).toBeTruthy();
          expect(template.description).toBeTruthy();
          expect(template.content).toBeTruthy();
          expect(template.targetPath).toBeTruthy();
        }
      }
    });
  });

  // ── listIssueTemplates ──

  describe('listIssueTemplates', () => {
    it('parses YAML front-matter from issue template files', async () => {
      mockReaddir.mockResolvedValue(['bug-report.yml', 'config.yml', 'feature-request.yml']);
      mockReadFile.mockImplementation((filePath: string) => {
        if (filePath.includes('bug-report.yml')) {
          return Promise.resolve(
            [
              'name: Bug Report',
              'description: Report a bug',
              'title: "[Bug]: "',
              'labels: [bug]',
              'body:',
              '  - type: textarea',
            ].join('\n')
          );
        }
        if (filePath.includes('feature-request.yml')) {
          return Promise.resolve(
            [
              'name: Feature Request',
              'description: Suggest a feature',
              'title: "[Feature]: "',
              'labels: [enhancement]',
              'body:',
              '  - type: textarea',
            ].join('\n')
          );
        }
        return Promise.resolve('');
      });

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      // config.yml should be excluded
      expect(templates).toHaveLength(2);

      const bugReport = templates.find((t) => t.name === 'Bug Report');
      expect(bugReport).toBeDefined();
      expect(bugReport!.description).toBe('Report a bug');
      expect(bugReport!.title).toBe('[Bug]: ');
      expect(bugReport!.labels).toEqual(['bug']);
      expect(bugReport!.fileName).toBe('bug-report.yml');

      const featureRequest = templates.find((t) => t.name === 'Feature Request');
      expect(featureRequest).toBeDefined();
      expect(featureRequest!.labels).toEqual(['enhancement']);
    });

    it('returns empty array when ISSUE_TEMPLATE directory does not exist', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates).toEqual([]);
    });

    it('returns empty array when directory is empty', async () => {
      mockReaddir.mockResolvedValue([]);

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates).toEqual([]);
    });

    it('excludes config.yml from parsed templates', async () => {
      mockReaddir.mockResolvedValue(['config.yml']);

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates).toEqual([]);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('includes .yaml files', async () => {
      mockReaddir.mockResolvedValue(['bug.yaml']);
      mockReadFile.mockResolvedValue('name: Bug\ndescription: A bug\ntitle: Bug\nlabels: [bug]\n');

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Bug');
    });

    it('excludes non-yml/yaml files', async () => {
      mockReaddir.mockResolvedValue(['bug-report.yml', 'README.md', 'notes.txt']);
      mockReadFile.mockResolvedValue('name: Bug Report\ndescription: A bug\n');

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates).toHaveLength(1);
    });

    it('parses labels in multi-line YAML list format', async () => {
      mockReaddir.mockResolvedValue(['multi.yml']);
      mockReadFile.mockResolvedValue(
        [
          'name: Multi Label',
          'description: Has multiple labels',
          'title: "[Multi]: "',
          'labels:',
          '  - bug',
          '  - high-priority',
          '  - needs-triage',
          'body:',
          '  - type: textarea',
        ].join('\n')
      );

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates).toHaveLength(1);
      expect(templates[0].labels).toEqual(['bug', 'high-priority', 'needs-triage']);
    });

    it('parses labels in inline array format', async () => {
      mockReaddir.mockResolvedValue(['inline.yml']);
      mockReadFile.mockResolvedValue(
        'name: Inline\ndescription: Inline labels\nlabels: [bug, enhancement]\n'
      );

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates[0].labels).toEqual(['bug', 'enhancement']);
    });

    it('handles template with no labels', async () => {
      mockReaddir.mockResolvedValue(['no-labels.yml']);
      mockReadFile.mockResolvedValue('name: No Labels\ndescription: No labels here\ntitle: Test\n');

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates[0].labels).toEqual([]);
    });

    it('strips quotes from parsed values', async () => {
      mockReaddir.mockResolvedValue(['quoted.yml']);
      mockReadFile.mockResolvedValue(
        [
          "name: 'Quoted Name'",
          'description: "Quoted Description"',
          "title: '[Quoted]: '",
          "labels: ['bug', 'fix']",
        ].join('\n')
      );

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates[0].name).toBe('Quoted Name');
      expect(templates[0].description).toBe('Quoted Description');
      expect(templates[0].title).toBe('[Quoted]: ');
      expect(templates[0].labels).toEqual(['bug', 'fix']);
    });

    it('includes full body content in result', async () => {
      const fullContent = 'name: Test\ndescription: Test desc\nbody:\n  - type: textarea\n';
      mockReaddir.mockResolvedValue(['test.yml']);
      mockReadFile.mockResolvedValue(fullContent);

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(templates[0].body).toBe(fullContent);
    });

    it('stops parsing labels when encountering body: or assignees:', async () => {
      mockReaddir.mockResolvedValue(['stop.yml']);
      mockReadFile.mockResolvedValue(
        [
          'name: Stop Parse',
          'description: Test',
          'labels:',
          '  - bug',
          'assignees:',
          '  - user1',
        ].join('\n')
      );

      const templates = await githubConfigService.listIssueTemplates(WORK_DIR);

      // Should only capture 'bug', not 'user1'
      expect(templates[0].labels).toEqual(['bug']);
    });

    it('reads from correct directory path', async () => {
      mockReaddir.mockResolvedValue([]);

      await githubConfigService.listIssueTemplates(WORK_DIR);

      expect(mockReaddir).toHaveBeenCalledWith(path.join(WORK_DIR, '.github', 'ISSUE_TEMPLATE'));
    });
  });
});
