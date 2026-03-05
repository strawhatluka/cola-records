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
});
