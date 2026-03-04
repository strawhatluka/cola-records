import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    create: () => ({
      scope: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ isFile: () => true })),
  mkdirSync: vi.fn(),
}));

// Mock git service
vi.mock('../../../src/main/services/git.service', () => ({
  gitService: {
    getStatus: vi.fn(),
    getDiff: vi.fn(),
    getDiffStaged: vi.fn(),
    compareBranches: vi.fn(),
  },
}));

// Mock AI service
vi.mock('../../../src/main/services/ai.service', () => ({
  aiService: {
    complete: vi.fn(),
    getConfig: vi.fn(),
  },
}));

// Mock database
vi.mock('../../../src/main/database', () => ({
  database: {
    getSetting: vi.fn(),
  },
}));

import { workflowService } from '../../../src/main/services/workflow.service';
import { gitService } from '../../../src/main/services/git.service';
import { aiService } from '../../../src/main/services/ai.service';

describe('WorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiService.getConfig).mockReturnValue({
      provider: 'gemini',
      apiKey: 'key',
      model: 'gemini-2.5-flash',
    });
  });

  describe('generateChangelog', () => {
    it('should return no changes when diff is empty', async () => {
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      });
      vi.mocked(gitService.getDiff).mockResolvedValue('');

      const result = await workflowService.generateChangelog('/test/repo');

      expect(result.hasChanges).toBe(false);
      expect(result.entry).toBe('');
    });

    it('should generate changelog entry from diff', async () => {
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/index.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(gitService.getDiff).mockResolvedValue(
        'diff --git a/src/index.ts b/src/index.ts\n+new line'
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# Changelog\n## [Unreleased]');

      vi.mocked(aiService.complete).mockResolvedValue({
        content: '### Added\n- New feature',
        tokensUsed: 100,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateChangelog('/test/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.entry).toBe('### Added\n- New feature');
      expect(aiService.complete).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringContaining('Keep a Changelog') })
      );
    });

    it('should strip conversational preamble from AI response', async () => {
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/index.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(gitService.getDiff).mockResolvedValue('diff content');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(aiService.complete).mockResolvedValue({
        content: 'Here are the changelog entries based on the diff:\n\n### Added\n- New feature',
        tokensUsed: 100,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateChangelog('/test/repo');

      expect(result.entry).toBe('### Added\n- New feature');
    });

    it('should drop incomplete trailing bullet from truncated AI response', async () => {
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/index.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(gitService.getDiff).mockResolvedValue('diff content');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '### Added\n- Add new feature\n- Add CHANGELOG.md to',
        tokensUsed: 1024,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateChangelog('/test/repo');

      expect(result.entry).toBe('### Added\n- Add new feature');
    });

    it('should strip code fences from AI response', async () => {
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/index.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(gitService.getDiff).mockResolvedValue('diff content');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '```markdown\n### Added\n- New feature\n```',
        tokensUsed: 100,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateChangelog('/test/repo');

      expect(result.entry).toBe('### Added\n- New feature');
    });

    it('should include issue number in prompt when provided', async () => {
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'file.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(gitService.getDiff).mockResolvedValue('diff content');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '### Fixed\n- Fix #42',
        tokensUsed: 50,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateChangelog('/test/repo', '42', 'fix/bug');

      expect(result.hasChanges).toBe(true);
      expect(aiService.complete).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringContaining('#42') })
      );
    });
  });

  describe('generateReadmeUpdate', () => {
    it('should return no changes when diff is empty and README exists', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# Existing Project\nSome content');

      const result = await workflowService.generateReadmeUpdate('/test/repo');

      expect(result.hasChanges).toBe(false);
    });

    it('should strip conversational preamble before first heading', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('diff --git a/src/api.ts b/src/api.ts');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/api.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# My Project\nOld content');
      vi.mocked(aiService.complete).mockResolvedValue({
        content:
          'Based on the git diff, here is the updated README:\n\n# My Project\nUpdated content',
        tokensUsed: 200,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateReadmeUpdate('/test/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.content).toBe('# My Project\nUpdated content');
    });

    it('should strip code fences from readme response', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('diff --git a/src/api.ts b/src/api.ts');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/api.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# My Project\nOld content');
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '```markdown\n# My Project\nUpdated content\n```',
        tokensUsed: 200,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateReadmeUpdate('/test/repo');

      expect(result.content).toBe('# My Project\nUpdated content');
    });

    it('should detect NO_CHANGES_NEEDED in response', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('diff content');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/api.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# My Project\nContent');
      vi.mocked(aiService.complete).mockResolvedValue({
        content: 'After analysis, NO_CHANGES_NEEDED for this diff.',
        tokensUsed: 20,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateReadmeUpdate('/test/repo');

      expect(result.hasChanges).toBe(false);
    });

    it('should generate readme update', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('diff --git a/src/api.ts b/src/api.ts');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/api.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# My Project\nOld content');
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '# My Project\nUpdated content',
        tokensUsed: 200,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateReadmeUpdate('/test/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.content).toBe('# My Project\nUpdated content');
      expect(result.currentReadme).toBe('# My Project\nOld content');
    });

    it('should generate new README when file does not exist', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '# New Project\n\nA brand new project.\n\n## Getting Started\n\nnpm install',
        tokensUsed: 300,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateReadmeUpdate('/test/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.content).toContain('# New Project');
      expect(result.currentReadme).toBe('');
      expect(aiService.complete).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringContaining('README.md file generator') })
      );
    });

    it('should generate new README when file exists but is blank', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('   \n  ');
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '# Fresh README\n\nProject description',
        tokensUsed: 200,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateReadmeUpdate('/test/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.content).toContain('# Fresh README');
    });
  });

  describe('generateDocsUpdate', () => {
    it('should return no changes when diff is empty', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue('');
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [],
      });

      const result = await workflowService.generateDocsUpdate('/test/repo');

      expect(result.hasChanges).toBe(false);
      expect(result.updates).toEqual([]);
    });

    it('should generate docs update entries', async () => {
      vi.mocked(gitService.getDiff).mockResolvedValue(
        'diff --git a/src/api.ts b/src/api.ts\n+export function newEndpoint()'
      );
      vi.mocked(gitService.getStatus).mockResolvedValue({
        current: 'main',
        tracking: null,
        ahead: 0,
        behind: 0,
        files: [{ path: 'src/api.ts', index: 'M', working_dir: ' ' }],
      });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(aiService.complete).mockResolvedValue({
        content: JSON.stringify({
          updates: [{ path: 'docs/api.md', content: '# API\n## newEndpoint', action: 'create' }],
          hasChanges: true,
        }),
        tokensUsed: 150,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateDocsUpdate('/test/repo');

      expect(result.hasChanges).toBe(true);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].path).toBe('docs/api.md');
      expect(result.updates[0].action).toBe('create');
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate commit message from staged diff', async () => {
      vi.mocked(gitService.getDiffStaged).mockResolvedValue(
        'diff --git a/src/auth.ts b/src/auth.ts\n+export function login()'
      );
      vi.mocked(aiService.complete).mockResolvedValue({
        content: 'feat(auth): add login function',
        tokensUsed: 30,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateCommitMessage('/test/repo');

      expect(result).toBe('feat(auth): add login function');
    });

    it('should take only first line from multi-line AI response', async () => {
      vi.mocked(gitService.getDiffStaged).mockResolvedValue('diff content');
      vi.mocked(aiService.complete).mockResolvedValue({
        content:
          'feat(auth): add login function\n\nThis commit adds the login function to the auth module.',
        tokensUsed: 30,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateCommitMessage('/test/repo');

      expect(result).toBe('feat(auth): add login function');
    });

    it('should return empty message when nothing is staged', async () => {
      vi.mocked(gitService.getDiffStaged).mockResolvedValue('');

      const result = await workflowService.generateCommitMessage('/test/repo');

      expect(result).toBe('');
    });

    it('should extract issue number from branch name when not explicitly provided', async () => {
      vi.mocked(gitService.getDiffStaged).mockResolvedValue('diff content');
      vi.mocked(aiService.complete).mockResolvedValue({
        content: 'feat(tools): add CLI explorer (#22)',
        tokensUsed: 30,
        model: 'gemini-2.5-flash',
      });

      await workflowService.generateCommitMessage(
        '/test/repo',
        undefined,
        'feat/22-maintenance-tools'
      );

      expect(aiService.complete).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringContaining('#22') })
      );
    });

    it('should omit issue reference when branch has no issue number', async () => {
      vi.mocked(gitService.getDiffStaged).mockResolvedValue('diff content');
      vi.mocked(aiService.complete).mockResolvedValue({
        content: 'chore: update dependencies',
        tokensUsed: 20,
        model: 'gemini-2.5-flash',
      });

      await workflowService.generateCommitMessage('/test/repo', undefined, 'chore/update-deps');

      const prompt = vi.mocked(aiService.complete).mock.calls[0][0].prompt;
      expect(prompt).not.toContain('End with');
    });

    it('should prefer explicit issue number over branch-extracted one', async () => {
      vi.mocked(gitService.getDiffStaged).mockResolvedValue('diff content');
      vi.mocked(aiService.complete).mockResolvedValue({
        content: 'fix(auth): resolve login bug (#99)',
        tokensUsed: 30,
        model: 'gemini-2.5-flash',
      });

      await workflowService.generateCommitMessage('/test/repo', '99', 'feat/22-maintenance-tools');

      expect(aiService.complete).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringContaining('#99') })
      );
      const prompt = vi.mocked(aiService.complete).mock.calls[0][0].prompt;
      expect(prompt).not.toContain('#22');
    });
  });

  describe('generatePRDescription', () => {
    it('should generate PR description from branch comparison', async () => {
      vi.mocked(gitService.compareBranches).mockResolvedValue({
        commits: [
          {
            hash: 'abc',
            message: 'feat: add feature',
            author: 'dev',
            date: new Date('2026-01-01'),
          },
        ],
        files: [{ file: 'src/feature.ts', insertions: 50, deletions: 10, binary: false }],
        totalFilesChanged: 5,
        totalInsertions: 100,
        totalDeletions: 20,
        rawDiff: 'diff content here',
      });
      vi.mocked(aiService.complete).mockResolvedValue({
        content: '## Summary\nAdded new feature\n## Changes\n- Feature added',
        tokensUsed: 80,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generatePRDescription(
        '/test/repo',
        'main',
        'feature-branch'
      );

      expect(result).toContain('Summary');
      expect(gitService.compareBranches).toHaveBeenCalledWith(
        '/test/repo',
        'main',
        'feature-branch'
      );
    });
  });

  describe('applyChangelog', () => {
    it('should merge entries into existing ### category sections in [Unreleased]', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Existing feature\n\n### Changed\n\n### Fixed\n\n## [1.0.0] - 2026-01-01\n'
      );

      await workflowService.applyChangelog(
        '/test/repo',
        '### Added\n- New feature\n### Fixed\n- Fix a bug'
      );

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // New entry should appear under ### Added (right after heading)
      expect(written).toContain('### Added\n- New feature');
      // Fix entry should appear under ### Fixed
      expect(written).toContain('### Fixed\n- Fix a bug');
      // Version section should be preserved
      expect(written).toContain('## [1.0.0] - 2026-01-01');
    });

    it('should add new category section when it does not exist in [Unreleased]', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Existing\n\n## [1.0.0]\n'
      );

      await workflowService.applyChangelog('/test/repo', '### Security\n- Fix vulnerability');

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('### Security\n- Fix vulnerability');
      expect(written).toContain('### Added');
      expect(written).toContain('## [1.0.0]');
    });

    it('should create CHANGELOG.md with Keep a Changelog template if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await workflowService.applyChangelog('/test/repo', '### Added\n- New feature');

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('# Changelog');
      expect(written).toContain('Keep a Changelog');
      expect(written).toContain('## [Unreleased]');
      expect(written).toContain('### Added\n- New feature');
    });

    it('should add [Unreleased] section when changelog exists without one', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# Changelog\n\n## [1.0.0]\n\n### Added\n- Old\n');

      await workflowService.applyChangelog('/test/repo', '### Added\n- New feature');

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('## [Unreleased]');
      expect(written).toContain('### Added\n- New feature');
    });
  });

  describe('applyReadme', () => {
    it('should write content to README.md', async () => {
      await workflowService.applyReadme('/test/repo', '# Updated README');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        '# Updated README'
      );
    });
  });

  describe('applyDocsUpdate', () => {
    it('should write docs update to file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await workflowService.applyDocsUpdate('/test/repo', {
        path: 'docs/api.md',
        content: '# API Docs',
        action: 'create',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('api.md'),
        '# API Docs'
      );
    });
  });
});
