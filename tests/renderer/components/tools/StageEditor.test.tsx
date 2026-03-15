import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import {
  StageEditor,
  buildFileGroups,
} from '../../../../src/renderer/components/tools/StageEditor';

describe('buildFileGroups', () => {
  it('should return all files as individual when no untracked files exist', () => {
    const result = buildFileGroups([
      { path: 'src/index.ts', index: 'M', working_dir: ' ' },
      { path: 'src/app.ts', index: 'A', working_dir: ' ' },
    ]);
    expect(result.individualFiles).toHaveLength(2);
    expect(result.directoryGroups.size).toBe(0);
  });

  it('should group fully untracked directory into one group', () => {
    const result = buildFileGroups([
      { path: '.claude/agents/foo.md', index: '?', working_dir: '?' },
      { path: '.claude/agents/bar.md', index: '?', working_dir: '?' },
      { path: '.claude/config.json', index: '?', working_dir: '?' },
    ]);
    expect(result.individualFiles).toHaveLength(0);
    expect(result.directoryGroups.size).toBe(1);
    expect(result.directoryGroups.has('.claude')).toBe(true);
    expect(result.directoryGroups.get('.claude')).toHaveLength(3);
  });

  it('should not compact directory with mixed tracked and untracked files', () => {
    const result = buildFileGroups([
      { path: 'src/index.ts', index: 'M', working_dir: ' ' },
      { path: 'src/new-file.ts', index: '?', working_dir: '?' },
    ]);
    expect(result.individualFiles).toHaveLength(2);
    expect(result.directoryGroups.size).toBe(0);
  });

  it('should keep root-level untracked files as individual', () => {
    const result = buildFileGroups([
      { path: 'README.md', index: '?', working_dir: '?' },
      { path: '.gitignore', index: '?', working_dir: '?' },
    ]);
    expect(result.individualFiles).toHaveLength(2);
    expect(result.directoryGroups.size).toBe(0);
  });

  it('should create multiple directory groups for separate untracked directories', () => {
    const result = buildFileGroups([
      { path: '.claude/foo.md', index: '?', working_dir: '?' },
      { path: '.claude/bar.md', index: '?', working_dir: '?' },
      { path: 'docs/readme.md', index: '?', working_dir: '?' },
      { path: 'docs/guide.md', index: '?', working_dir: '?' },
    ]);
    expect(result.individualFiles).toHaveLength(0);
    expect(result.directoryGroups.size).toBe(2);
    expect(result.directoryGroups.has('.claude')).toBe(true);
    expect(result.directoryGroups.has('docs')).toBe(true);
  });

  it('should not compact a directory with only one file', () => {
    const result = buildFileGroups([
      { path: 'config/settings.json', index: '?', working_dir: '?' },
    ]);
    expect(result.individualFiles).toHaveLength(1);
    expect(result.directoryGroups.size).toBe(0);
  });

  it('should handle empty file list', () => {
    const result = buildFileGroups([]);
    expect(result.individualFiles).toHaveLength(0);
    expect(result.directoryGroups.size).toBe(0);
  });

  it('should group nested paths under top-level directory', () => {
    const result = buildFileGroups([
      { path: 'vendor/lib/a.js', index: '?', working_dir: '?' },
      { path: 'vendor/lib/sub/b.js', index: '?', working_dir: '?' },
      { path: 'vendor/other/c.js', index: '?', working_dir: '?' },
    ]);
    expect(result.individualFiles).toHaveLength(0);
    expect(result.directoryGroups.size).toBe(1);
    expect(result.directoryGroups.has('vendor')).toBe(true);
    expect(result.directoryGroups.get('vendor')).toHaveLength(3);
  });
});

describe('StageEditor', () => {
  const defaultProps = {
    workingDirectory: '/test/project',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<StageEditor {...defaultProps} />);
    expect(screen.getByText('Scanning files...')).toBeDefined();
  });

  it('should display file list after loading', async () => {
    mockInvoke.mockResolvedValue({
      files: [
        { path: 'src/index.ts', index: 'M', working_dir: ' ' },
        { path: 'src/new.ts', index: '?', working_dir: '?' },
      ],
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('src/index.ts')).toBeDefined();
      expect(screen.getByText('src/new.ts')).toBeDefined();
    });
  });

  it('should show colored status badges', async () => {
    mockInvoke.mockResolvedValue({
      files: [
        { path: 'modified.ts', index: 'M', working_dir: ' ' },
        { path: 'added.ts', index: 'A', working_dir: ' ' },
        { path: 'deleted.ts', index: 'D', working_dir: ' ' },
      ],
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('modified.ts')).toBeDefined();
      expect(screen.getByText('added.ts')).toBeDefined();
      expect(screen.getByText('deleted.ts')).toBeDefined();
    });
  });

  it('should show "no changed files" when working tree is clean', async () => {
    mockInvoke.mockResolvedValue({ files: [] });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No changed files to stage.')).toBeDefined();
    });
  });

  it('should call git:add when Stage button is clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:status') {
        return Promise.resolve({
          files: [{ path: 'src/index.ts', index: 'M', working_dir: ' ' }],
        });
      }
      return Promise.resolve();
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('src/index.ts')).toBeDefined();
    });

    // Files are auto-selected, so the Stage button should be available
    const stageBtn = screen.getByText(/^Stage 1 file$/);
    await userEvent.click(stageBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:add', '/test/project', ['src/index.ts']);
    });
  });

  it('should call onClose after successful staging', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'git:status') {
        return Promise.resolve({
          files: [{ path: 'file.ts', index: 'M', working_dir: ' ' }],
        });
      }
      return Promise.resolve();
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('file.ts')).toBeDefined();
    });

    const stageBtn = screen.getByText(/^Stage 1 file$/);
    await userEvent.click(stageBtn);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should close when Close button is clicked', async () => {
    mockInvoke.mockResolvedValue({ files: [] });
    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No changed files to stage.')).toBeDefined();
    });

    const closeBtn = screen.getByTitle('Close');
    await userEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should toggle select all', async () => {
    mockInvoke.mockResolvedValue({
      files: [
        { path: 'a.ts', index: 'M', working_dir: ' ' },
        { path: 'b.ts', index: 'A', working_dir: ' ' },
      ],
    });

    render(<StageEditor {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('a.ts')).toBeDefined();
    });

    // Initially all selected (auto-select), click Deselect All
    const toggleBtn = screen.getByText(/Deselect All/);
    await userEvent.click(toggleBtn);

    // Now should show Select All
    expect(screen.getByText(/Select All/)).toBeDefined();
  });

  describe('directory compaction', () => {
    it('should render untracked directory as single collapsed row with file count', async () => {
      mockInvoke.mockResolvedValue({
        files: [
          { path: '.claude/agents/foo.md', index: '?', working_dir: '?' },
          { path: '.claude/agents/bar.md', index: '?', working_dir: '?' },
          { path: '.claude/config.json', index: '?', working_dir: '?' },
        ],
      });

      render(<StageEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('.claude/')).toBeDefined();
        expect(screen.getByText('(3 files)')).toBeDefined();
      });

      // Individual files should NOT be visible when collapsed
      expect(screen.queryByText('.claude/agents/foo.md')).toBeNull();
    });

    it('should expand directory to show child files when chevron clicked', async () => {
      mockInvoke.mockResolvedValue({
        files: [
          { path: 'docs/readme.md', index: '?', working_dir: '?' },
          { path: 'docs/guide.md', index: '?', working_dir: '?' },
        ],
      });

      render(<StageEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('docs/')).toBeDefined();
      });

      // Click expand button
      await userEvent.click(screen.getByTestId('dir-expand-docs'));

      await waitFor(() => {
        expect(screen.getByText('docs/readme.md')).toBeDefined();
        expect(screen.getByText('docs/guide.md')).toBeDefined();
      });
    });

    it('should select all child files when directory checkbox clicked', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'git:status') {
          return Promise.resolve({
            files: [
              { path: '.claude/a.md', index: '?', working_dir: '?' },
              { path: '.claude/b.md', index: '?', working_dir: '?' },
            ],
          });
        }
        return Promise.resolve();
      });

      render(<StageEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('.claude/')).toBeDefined();
      });

      // All auto-selected, deselect all first
      await userEvent.click(screen.getByText(/Deselect All/));

      // Now click directory checkbox to select its children
      await userEvent.click(screen.getByTestId('dir-checkbox-.claude'));

      // Stage button should reflect 2 selected
      expect(screen.getByText(/Stage 2 files/)).toBeDefined();
    });

    it('should show indeterminate state when some children deselected', async () => {
      mockInvoke.mockResolvedValue({
        files: [
          { path: 'lib/a.ts', index: '?', working_dir: '?' },
          { path: 'lib/b.ts', index: '?', working_dir: '?' },
          { path: 'lib/c.ts', index: '?', working_dir: '?' },
        ],
      });

      render(<StageEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('lib/')).toBeDefined();
      });

      // Expand directory
      await userEvent.click(screen.getByTestId('dir-expand-lib'));

      await waitFor(() => {
        expect(screen.getByText('lib/a.ts')).toBeDefined();
      });

      // Deselect one child file
      await userEvent.click(screen.getByText('lib/a.ts'));

      // Directory checkbox should show MinusSquare (indeterminate)
      const checkbox = screen.getByTestId('dir-checkbox-lib');
      expect(checkbox.querySelector('[data-testid="icon-minussquare"]')).toBeDefined();
    });

    it('should handle Select All with both individual files and directory groups', async () => {
      mockInvoke.mockResolvedValue({
        files: [
          { path: 'index.ts', index: 'M', working_dir: ' ' },
          { path: '.claude/a.md', index: '?', working_dir: '?' },
          { path: '.claude/b.md', index: '?', working_dir: '?' },
        ],
      });

      render(<StageEditor {...defaultProps} />);

      await waitFor(() => {
        // Should show total count including grouped files in the select all button
        expect(screen.getByText(/Deselect All/)).toBeDefined();
        expect(screen.getByText(/Stage 3 files/)).toBeDefined();
      });

      // Deselect all
      await userEvent.click(screen.getByText(/Deselect All/));
      expect(screen.getByText(/Select All/)).toBeDefined();

      // Re-select all
      await userEvent.click(screen.getByText(/Select All/));
      expect(screen.getByText(/Stage 3 files/)).toBeDefined();
    });

    it('should send all child paths to git:add when directory is staged', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'git:status') {
          return Promise.resolve({
            files: [
              { path: '.claude/a.md', index: '?', working_dir: '?' },
              { path: '.claude/b.md', index: '?', working_dir: '?' },
            ],
          });
        }
        return Promise.resolve();
      });

      render(<StageEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('.claude/')).toBeDefined();
      });

      const stageBtn = screen.getByText(/Stage 2 files/);
      await userEvent.click(stageBtn);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'git:add',
          '/test/project',
          expect.arrayContaining(['.claude/a.md', '.claude/b.md'])
        );
      });
    });

    it('should render tracked files individually alongside compacted directory', async () => {
      mockInvoke.mockResolvedValue({
        files: [
          { path: 'src/index.ts', index: 'M', working_dir: ' ' },
          { path: '.claude/a.md', index: '?', working_dir: '?' },
          { path: '.claude/b.md', index: '?', working_dir: '?' },
          { path: '.claude/c.md', index: '?', working_dir: '?' },
        ],
      });

      render(<StageEditor {...defaultProps} />);

      await waitFor(() => {
        // Tracked file shown individually
        expect(screen.getByText('src/index.ts')).toBeDefined();
        // Untracked directory compacted
        expect(screen.getByText('.claude/')).toBeDefined();
        expect(screen.getByText('(3 files)')).toBeDefined();
      });

      // Individual untracked files should NOT be visible when collapsed
      expect(screen.queryByText('.claude/a.md')).toBeNull();
    });
  });
});
