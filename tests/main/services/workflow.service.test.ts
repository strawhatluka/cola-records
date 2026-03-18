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
      expect(aiService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('NO blank lines between bullet entries'),
        })
      );
    });

    it('should pass through AI output without normalizing blank lines between bullets', async () => {
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
        content: '### Fixed\n- Fix A\n\n- Fix B',
        tokensUsed: 100,
        model: 'gemini-2.5-flash',
      });

      const result = await workflowService.generateChangelog('/test/repo');

      // generateChangelog should NOT normalize spacing — user can edit in textarea
      expect(result.entry).toBe('### Fixed\n- Fix A\n\n- Fix B');
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
      // New entry should appear before existing bullets, with blank line between heading and bullets preserved
      expect(written).toContain('### Added\n\n- New feature\n- Existing feature');
      // Fix entry should appear under ### Fixed with blank line after heading
      expect(written).toContain('### Fixed\n\n- Fix a bug');
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
      // New category should have blank line between heading and bullets
      expect(written).toContain('### Security\n\n- Fix vulnerability');
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
      // Entry must appear between [Unreleased] and [1.0.0], not under [1.0.0]
      const unreleasedIdx = written.indexOf('## [Unreleased]');
      const v100Idx = written.indexOf('## [1.0.0]');
      const newFeatureIdx = written.indexOf('- New feature');
      expect(newFeatureIdx).toBeGreaterThan(unreleasedIdx);
      expect(newFeatureIdx).toBeLessThan(v100Idx);
      // Released section must remain untouched
      expect(written.indexOf('- Old')).toBeGreaterThan(v100Idx);
    });

    it('should insert under [Unreleased] category, not matching released version category', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# Changelog\n\n## [Unreleased]\n\n### Changed\n\n- Existing change\n\n## [1.1.0]\n\n### Added\n\n- Old feature\n\n### Changed\n\n- Old change\n'
      );

      await workflowService.applyChangelog(
        '/test/repo',
        '### Added\n- New feature\n### Changed\n- New change'
      );

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const unreleasedIdx = written.indexOf('## [Unreleased]');
      const v110Idx = written.indexOf('## [1.1.0]');
      const newFeatureIdx = written.indexOf('- New feature');
      const newChangeIdx = written.indexOf('- New change');
      // Both entries must be in [Unreleased], not in [1.1.0]
      expect(newFeatureIdx).toBeGreaterThan(unreleasedIdx);
      expect(newFeatureIdx).toBeLessThan(v110Idx);
      expect(newChangeIdx).toBeGreaterThan(unreleasedIdx);
      expect(newChangeIdx).toBeLessThan(v110Idx);
      // Released section must remain untouched
      expect(written.indexOf('- Old feature')).toBeGreaterThan(v110Idx);
      expect(written.indexOf('- Old change')).toBeGreaterThan(v110Idx);
    });

    it('should not modify released version sections when [Unreleased] is empty', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# Changelog\n\n## [Unreleased]\n\n## [1.0.0]\n\n### Added\n\n- Old feature\n'
      );

      await workflowService.applyChangelog('/test/repo', '### Added\n- New feature');

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const unreleasedIdx = written.indexOf('## [Unreleased]');
      const v100Idx = written.indexOf('## [1.0.0]');
      const newFeatureIdx = written.indexOf('- New feature');
      // New entry in [Unreleased], not in [1.0.0]
      expect(newFeatureIdx).toBeGreaterThan(unreleasedIdx);
      expect(newFeatureIdx).toBeLessThan(v100Idx);
      // Old feature stays under [1.0.0]
      expect(written.indexOf('- Old feature')).toBeGreaterThan(v100Idx);
    });

    it('should handle multiple categories with some existing in [Unreleased] and some only in released', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Existing fix\n\n## [1.0.0]\n\n### Added\n\n- Old\n'
      );

      await workflowService.applyChangelog(
        '/test/repo',
        '### Added\n- New feature\n### Fixed\n- Another fix'
      );

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const unreleasedIdx = written.indexOf('## [Unreleased]');
      const v100Idx = written.indexOf('## [1.0.0]');
      // ### Added created as new section under [Unreleased]
      const newFeatureIdx = written.indexOf('- New feature');
      expect(newFeatureIdx).toBeGreaterThan(unreleasedIdx);
      expect(newFeatureIdx).toBeLessThan(v100Idx);
      // ### Fixed merged into existing [Unreleased] > ### Fixed
      const anotherFixIdx = written.indexOf('- Another fix');
      expect(anotherFixIdx).toBeGreaterThan(unreleasedIdx);
      expect(anotherFixIdx).toBeLessThan(v100Idx);
      // Existing fix still in [Unreleased]
      const existingFixIdx = written.indexOf('- Existing fix');
      expect(existingFixIdx).toBeGreaterThan(unreleasedIdx);
      expect(existingFixIdx).toBeLessThan(v100Idx);
      // Released section untouched
      expect(written.indexOf('- Old')).toBeGreaterThan(v100Idx);
    });

    it('should normalize spacing to one blank line when injecting bullets (regression test for extra blank lines)', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Changelog with EXTRA blank lines after heading (malformed source)
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# Changelog\n\n## [Unreleased]\n\n### Added\n\n\n- Existing feature\n\n## [1.0.0]\n'
      );

      await workflowService.applyChangelog('/test/repo', '### Added\n- New feature');

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;

      // Extract the ### Added section from [Unreleased]
      const addedHeadingIdx = written.indexOf('### Added');
      const nextSectionIdx = written.indexOf('## [1.0.0]', addedHeadingIdx);
      const addedSection = written.slice(addedHeadingIdx, nextSectionIdx);

      // Verify exactly ONE blank line after heading, then bullets with no blank lines between them
      const expectedSpacing = '### Added\n\n- New feature\n- Existing feature\n';
      expect(addedSection).toContain(expectedSpacing);

      // Verify no double newlines between bullets
      expect(addedSection).not.toContain('- New feature\n\n- Existing feature');
    });

    it('should normalize AI-generated content with blank lines between bullets', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Existing fix\n\n## [1.0.0]\n'
      );

      // AI generates with blank lines between bullets (common AI output format)
      await workflowService.applyChangelog(
        '/test/repo',
        '### Fixed\n- New fix A\n\n- New fix B\n\n- New fix C'
      );

      const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;

      const fixedIdx = written.indexOf('### Fixed');
      const v100Idx = written.indexOf('## [1.0.0]', fixedIdx);
      const fixedSection = written.slice(fixedIdx, v100Idx);

      // Verify all bullets are present with NO blank lines between them
      expect(fixedSection).toContain('- New fix A\n- New fix B\n- New fix C\n- Existing fix');

      // Verify no double newlines between any bullets
      expect(fixedSection).not.toMatch(/- [^\n]+\n\n- /);
    });
  });
});
