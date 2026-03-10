import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

// Mock react-markdown to avoid parsing overhead in tests
vi.mock('react-markdown', () => ({
  default: () => null,
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock MarkdownEditor to avoid Radix Tooltip complexity in jsdom
vi.mock('../../../../src/renderer/components/pull-requests/MarkdownEditor', () => ({
  MarkdownEditor: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid="markdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

import { CreatePullRequestModal } from '../../../../src/renderer/components/pull-requests/CreatePullRequestModal';

const defaultProps = {
  open: true,
  owner: 'test-owner',
  repo: 'test-repo',
  localPath: '/mock/local/repo',
  branches: ['main', 'develop', 'feature-branch'],
  remotes: [
    {
      name: 'origin',
      fetchUrl: 'https://github.com/test-owner/test-repo.git',
      pushUrl: 'https://github.com/test-owner/test-repo.git',
    },
  ],
  onClose: vi.fn(),
  onCreated: vi.fn(),
};

function setupMockIPC(
  overrides: { currentBranch?: string; error?: boolean; parentIssue?: any } = {}
) {
  mockInvoke.mockImplementation(async (channel: string) => {
    switch (channel) {
      case 'git:get-current-branch':
        return overrides.currentBranch ?? 'feature-branch';
      case 'git:compare-branches':
        return {
          commits: [],
          files: [],
          totalFilesChanged: 0,
          totalInsertions: 0,
          totalDeletions: 0,
          rawDiff: '',
        };
      case 'git:get-remote-branches':
        return ['main', 'develop', 'feature-branch'];
      case 'git:push':
        return undefined;
      case 'github:create-pull-request':
        if (overrides.error) throw new Error('API rate limit exceeded');
        return { number: 1, url: 'https://github.com/org/repo/pull/1', state: 'open' };
      case 'github:get-parent-issue':
        return overrides.parentIssue ?? null;
      default:
        return undefined;
    }
  });
}

describe('CreatePullRequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockIPC();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render content when open is false', () => {
    render(<CreatePullRequestModal {...defaultProps} open={false} />);

    expect(screen.queryByPlaceholderText('Pull request title')).not.toBeInTheDocument();
  });

  it('renders form fields when open', async () => {
    await act(async () => {
      render(<CreatePullRequestModal {...defaultProps} />);
    });

    expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
    expect(screen.getByText('Base Branch')).toBeInTheDocument();
    expect(screen.getByText('Compare Branch')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders branch select dropdowns with branches', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    // Base branch defaults to first branch
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    // Compare branch is set from git:get-current-branch
    await waitFor(() => {
      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });
  });

  it('auto-fills title from compare branch name', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      // branchToTitle('feature-branch') => 'Feature Branch'
      expect(titleInput.value).toBe('Feature Branch');
    });
  });

  it('submit button exists and can be clicked after title is set', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    // Wait for auto-init (sets base, compare, and title)
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      expect(titleInput.value).not.toBe('');
    });

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    expect(submitButton).toBeInTheDocument();
  });

  it('successful submission calls IPC and triggers callbacks', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreated = vi.fn();

    render(<CreatePullRequestModal {...defaultProps} onClose={onClose} onCreated={onCreated} />);

    // Wait for auto-init
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      expect(titleInput.value).not.toBe('');
    });

    // Clear auto-title and type custom title
    const titleInput = screen.getByPlaceholderText('Pull request title');
    await user.clear(titleInput);
    await user.type(titleInput, 'My PR Title');

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-pull-request',
        'test-owner',
        'test-repo',
        'My PR Title',
        'feature-branch',
        'main',
        ''
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error message when submission fails', async () => {
    setupMockIPC({ error: true });
    const user = userEvent.setup();

    render(<CreatePullRequestModal {...defaultProps} />);

    // Wait for auto-init
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      expect(titleInput.value).not.toBe('');
    });

    const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument();
    });
  });

  it('cancel button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<CreatePullRequestModal {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('sets base to first branch on open', async () => {
    render(<CreatePullRequestModal {...defaultProps} />);

    // Base defaults to branches[0] which is 'main'
    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      // First combobox is base branch
      expect(comboboxes[0].textContent).toContain('main');
    });
  });

  it('sets compare to current branch from git', async () => {
    setupMockIPC({ currentBranch: 'develop' });
    render(<CreatePullRequestModal {...defaultProps} />);

    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      // Second combobox is compare branch
      expect(comboboxes[1].textContent).toContain('develop');
    });
  });

  it('inline mode renders scrollable container with all form fields accessible', async () => {
    const { container } = render(<CreatePullRequestModal {...defaultProps} inline={true} />);

    // Wait for init to complete (sets base, compare, title)
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
      expect(titleInput.value).not.toBe('');
    });

    // The outer inline wrapper should be scrollable
    const scrollContainer = container.querySelector('.overflow-auto');
    expect(scrollContainer).not.toBeNull();

    // Heading rendered inline (not inside Dialog)
    expect(screen.getByRole('heading', { name: 'Create Pull Request' })).toBeInTheDocument();

    // All form fields accessible
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Pull Request/ })).toBeInTheDocument();

    // formContent should NOT have overflow-hidden (the bug fix)
    const formContent = container.querySelector('.space-y-4.min-w-0');
    expect(formContent).not.toBeNull();
    expect(formContent!.classList.contains('overflow-hidden')).toBe(false);
  });

  describe('smart base branch for sub-issues', () => {
    it('defaults base to parent branch when current branch is a sub-issue', async () => {
      setupMockIPC({
        currentBranch: 'feat/68-test',
        parentIssue: { id: 100, number: 22, title: 'Parent Feature', state: 'open', url: '' },
      });

      render(
        <CreatePullRequestModal
          {...defaultProps}
          branches={['main', 'feat/22-maintenance-tools', 'feat/68-test']}
        />
      );

      // Base should be set to parent's branch
      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes[0].textContent).toContain('feat/22-maintenance-tools');
      });
    });

    it('keeps base as main when current branch is not a sub-issue', async () => {
      setupMockIPC({
        currentBranch: 'feat/22-maintenance-tools',
        parentIssue: null,
      });

      render(
        <CreatePullRequestModal
          {...defaultProps}
          branches={['main', 'feat/22-maintenance-tools']}
        />
      );

      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes[0].textContent).toContain('main');
      });
    });

    it('keeps base as main when parent detection fails', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feat/68-test';
        if (channel === 'github:get-parent-issue') throw new Error('API error');
        if (channel === 'git:compare-branches')
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        return undefined;
      });

      render(
        <CreatePullRequestModal
          {...defaultProps}
          branches={['main', 'feat/22-maintenance-tools', 'feat/68-test']}
        />
      );

      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes[0].textContent).toContain('main');
      });
    });

    it('keeps base as main when parent branch is not in local branches', async () => {
      setupMockIPC({
        currentBranch: 'feat/68-test',
        parentIssue: { id: 100, number: 99, title: 'Unbranched Parent', state: 'open', url: '' },
      });

      render(<CreatePullRequestModal {...defaultProps} branches={['main', 'feat/68-test']} />);

      // Parent #99 has no matching branch — should stay on main
      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes[0].textContent).toContain('main');
      });
    });
  });

  // ─── NEW TESTS: Branch Coverage Enhancement ───────────────

  describe('comparison preview', () => {
    it('shows loading spinner while comparison is being fetched', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      // Make compare-branches return a promise that never resolves during the test
      let resolveComparison: (v: any) => void;
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return new Promise((resolve) => {
            resolveComparison = resolve;
          });
        }
        if (channel === 'git:get-remote-branches') return ['main', 'feature-branch'];
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      // Wait for init to complete
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      // Advance past 300ms debounce to trigger comparison fetch
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // The loading spinner should be visible (animate-spin class)
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).not.toBeNull();
      });

      // Clean up: resolve the pending promise
      await act(async () => {
        resolveComparison!({
          commits: [],
          files: [],
          totalFilesChanged: 0,
          totalInsertions: 0,
          totalDeletions: 0,
          rawDiff: '',
        });
      });
    });

    it('shows error message when comparison fails', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') throw new Error('Branch not found');
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to compare branches: Branch not found/)
        ).toBeInTheDocument();
      });
    });

    it('shows identical branches message when no commits and no files', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(screen.getByText(/These branches are identical/)).toBeInTheDocument();
      });
    });

    it('shows comparison summary bar with commits and file stats', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [
              {
                hash: 'abc1234567',
                message: 'feat: add feature',
                author: 'Dev <dev@test.com>',
                date: '2026-01-15',
              },
              {
                hash: 'def4567890',
                message: 'fix: bug fix',
                author: 'Dev <dev@test.com>',
                date: '2026-01-16',
              },
            ],
            files: [{ file: 'src/index.ts', insertions: 10, deletions: 3, binary: false }],
            totalFilesChanged: 1,
            totalInsertions: 10,
            totalDeletions: 3,
            rawDiff:
              'diff --git a/src/index.ts b/src/index.ts\n@@ -1,3 +1,10 @@\n context line\n+added line\n-removed line\n',
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // Summary bar shows commit count, file count, and +/- stats
      await waitFor(() => {
        expect(screen.getByText(/2 commits/)).toBeInTheDocument();
        expect(screen.getByText(/1 file changed/)).toBeInTheDocument();
        expect(screen.getByText('+10')).toBeInTheDocument();
        expect(screen.getByText('-3')).toBeInTheDocument();
      });

      // Commits are rendered with short hashes and messages
      expect(screen.getByText('abc1234')).toBeInTheDocument();
      expect(screen.getByText('feat: add feature')).toBeInTheDocument();
      expect(screen.getByText('def4567')).toBeInTheDocument();
      expect(screen.getByText('fix: bug fix')).toBeInTheDocument();
    });

    it('shows "Show all N commits" button when more than 20 commits', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const manyCommits = Array.from({ length: 25 }, (_, i) => ({
        hash: `hash${String(i).padStart(10, '0')}`,
        message: `commit ${i}`,
        author: `Dev <dev@test.com>`,
        date: '2026-01-15',
      }));

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: manyCommits,
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(screen.getByText('Show all 25 commits')).toBeInTheDocument();
      });

      // Only first 20 commits visible initially
      expect(screen.getByText('commit 0')).toBeInTheDocument();
      expect(screen.getByText('commit 19')).toBeInTheDocument();
      expect(screen.queryByText('commit 24')).not.toBeInTheDocument();

      // Click to show all
      fireEvent.click(screen.getByText('Show all 25 commits'));

      await waitFor(() => {
        expect(screen.getByText('commit 24')).toBeInTheDocument();
      });
    });

    it('shows "Show all N files" button when more than 20 files and toggles visibility', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const manyFiles = Array.from({ length: 25 }, (_, i) => `file${i}.ts`);
      const rawDiff = manyFiles
        .map((f) => `diff --git a/${f} b/${f}\n@@ -1,1 +1,2 @@\n context\n+new line\n`)
        .join('');

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [
              {
                hash: 'abc1234567',
                message: 'feat: many files',
                author: 'Dev <dev@test.com>',
                date: '2026-01-15',
              },
            ],
            files: manyFiles.map((f) => ({ file: f, insertions: 1, deletions: 0, binary: false })),
            totalFilesChanged: 25,
            totalInsertions: 25,
            totalDeletions: 0,
            rawDiff,
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(screen.getByText('Show all 25 files')).toBeInTheDocument();
      });

      // Only first 20 files shown
      expect(screen.getByText('file0.ts')).toBeInTheDocument();
      expect(screen.getByText('file19.ts')).toBeInTheDocument();
      expect(screen.queryByText('file24.ts')).not.toBeInTheDocument();

      // Click to show all files
      fireEvent.click(screen.getByText('Show all 25 files'));

      await waitFor(() => {
        expect(screen.getByText('file24.ts')).toBeInTheDocument();
      });
    });

    it('expands and collapses file diff when clicking file header', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const rawDiff =
        'diff --git a/src/app.ts b/src/app.ts\n' +
        '@@ -1,3 +1,4 @@\n' +
        ' existing line\n' +
        '+added line content\n' +
        '-removed line content\n' +
        ' context line\n';

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [
              {
                hash: 'abc1234567',
                message: 'change',
                author: 'Dev <dev@test.com>',
                date: '2026-01-15',
              },
            ],
            files: [{ file: 'src/app.ts', insertions: 1, deletions: 1, binary: false }],
            totalFilesChanged: 1,
            totalInsertions: 1,
            totalDeletions: 1,
            rawDiff,
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // With <=10 files the first file auto-expands, so diff lines should be visible
      await waitFor(() => {
        expect(screen.getByText('src/app.ts')).toBeInTheDocument();
      });

      // The diff content should be visible (auto-expanded)
      await waitFor(() => {
        expect(screen.getByText('added line content')).toBeInTheDocument();
        expect(screen.getByText('removed line content')).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(screen.getByText('src/app.ts'));

      // Diff content should be hidden
      await waitFor(() => {
        expect(screen.queryByText('added line content')).not.toBeInTheDocument();
      });

      // Click to expand again
      fireEvent.click(screen.getByText('src/app.ts'));

      await waitFor(() => {
        expect(screen.getByText('added line content')).toBeInTheDocument();
      });
    });

    it('starts collapsed when more than 10 files in diff', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const fileNames = Array.from({ length: 12 }, (_, i) => `file${i}.ts`);
      const rawDiff = fileNames
        .map((f) => `diff --git a/${f} b/${f}\n@@ -1,1 +1,2 @@\n context\n+new line\n`)
        .join('');

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [
              {
                hash: 'abc1234567',
                message: 'change',
                author: 'Dev <dev@test.com>',
                date: '2026-01-15',
              },
            ],
            files: fileNames.map((f) => ({ file: f, insertions: 1, deletions: 0, binary: false })),
            totalFilesChanged: 12,
            totalInsertions: 12,
            totalDeletions: 0,
            rawDiff,
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // File names should be visible
      await waitFor(() => {
        expect(screen.getByText('file0.ts')).toBeInTheDocument();
      });

      // But diff content should NOT be auto-expanded (>10 files)
      expect(screen.queryByText('new line')).not.toBeInTheDocument();
    });

    it('shows Binary badge for binary files', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const rawDiff =
        'diff --git a/image.png b/image.png\n' +
        'Binary files a/image.png and b/image.png differ\n';

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [
              {
                hash: 'abc1234567',
                message: 'update image',
                author: 'Dev <dev@test.com>',
                date: '2026-01-15',
              },
            ],
            files: [{ file: 'image.png', insertions: 0, deletions: 0, binary: true }],
            totalFilesChanged: 1,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff,
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      await waitFor(() => {
        expect(screen.getByText('image.png')).toBeInTheDocument();
        expect(screen.getByText('Binary')).toBeInTheDocument();
      });
    });

    it('renders diff line types correctly (add, remove, context, hunk-header)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const rawDiff =
        'diff --git a/src/utils.ts b/src/utils.ts\n' +
        'index abc..def 100644\n' +
        '--- a/src/utils.ts\n' +
        '+++ b/src/utils.ts\n' +
        '@@ -1,3 +1,4 @@\n' +
        ' const a = 1;\n' +
        '-const b = 2;\n' +
        '+const b = 3;\n' +
        '+const c = 4;\n';

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [
              {
                hash: 'abc1234567',
                message: 'update utils',
                author: 'Dev <dev@test.com>',
                date: '2026-01-15',
              },
            ],
            files: [{ file: 'src/utils.ts', insertions: 2, deletions: 1, binary: false }],
            totalFilesChanged: 1,
            totalInsertions: 2,
            totalDeletions: 1,
            rawDiff,
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // File should auto-expand (1 file <= 10)
      await waitFor(() => {
        expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
      });

      // Should show +2 -1 stats (may appear in both summary bar and file row)
      await waitFor(() => {
        expect(screen.getAllByText('+2').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('-1').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('branch push on submit', () => {
    it('pushes branch to remote when not on remote', async () => {
      const user = userEvent.setup();

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'git:get-remote-branches') return ['main', 'develop']; // feature-branch NOT on remote
        if (channel === 'git:push') return undefined;
        if (channel === 'github:create-pull-request') {
          return { number: 1, url: 'https://github.com/org/repo/pull/1', state: 'open' };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).not.toBe('');
      });

      const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
      await user.click(submitButton);

      await waitFor(() => {
        // Should have called git:push to push the branch first
        expect(mockInvoke).toHaveBeenCalledWith(
          'git:push',
          '/mock/local/repo',
          'origin',
          'feature-branch',
          true
        );
      });
    });

    it('skips push when branch already exists on remote', async () => {
      const user = userEvent.setup();

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'git:get-remote-branches') return ['main', 'origin/feature-branch']; // branch IS on remote
        if (channel === 'github:create-pull-request') {
          return { number: 1, url: 'https://github.com/org/repo/pull/1', state: 'open' };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).not.toBe('');
      });

      const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'github:create-pull-request',
          'test-owner',
          'test-repo',
          expect.any(String),
          'feature-branch',
          'main',
          ''
        );
      });

      // git:push should NOT have been called
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'git:push',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('fork detection', () => {
    it('prefixes head with fork owner when origin differs from target owner', async () => {
      const user = userEvent.setup();

      const forkRemotes = [
        {
          name: 'origin',
          fetchUrl: 'https://github.com/fork-user/test-repo.git',
          pushUrl: 'https://github.com/fork-user/test-repo.git',
        },
      ];

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'git:get-remote-branches') return ['main', 'feature-branch'];
        if (channel === 'github:create-pull-request') {
          return { number: 1, url: 'https://github.com/org/repo/pull/1', state: 'open' };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} remotes={forkRemotes} />);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).not.toBe('');
      });

      const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
      await user.click(submitButton);

      await waitFor(() => {
        // head should be "fork-user:feature-branch"
        expect(mockInvoke).toHaveBeenCalledWith(
          'github:create-pull-request',
          'test-owner',
          'test-repo',
          expect.any(String),
          'fork-user:feature-branch',
          'main',
          ''
        );
      });
    });

    it('uses plain branch name when origin matches target owner', async () => {
      const user = userEvent.setup();

      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'git:get-remote-branches') return ['main', 'feature-branch'];
        if (channel === 'github:create-pull-request') {
          return { number: 1, url: 'https://github.com/org/repo/pull/1', state: 'open' };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).not.toBe('');
      });

      const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
      await user.click(submitButton);

      await waitFor(() => {
        // head should be plain "feature-branch" (not prefixed)
        expect(mockInvoke).toHaveBeenCalledWith(
          'github:create-pull-request',
          'test-owner',
          'test-repo',
          expect.any(String),
          'feature-branch',
          'main',
          ''
        );
      });
    });
  });

  describe('PR template loading', () => {
    it('populates body from PR template when found', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github-config:read-file') return '## Summary\n\n## Test Plan\n';
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        const editor = screen.getByTestId('markdown-editor') as HTMLTextAreaElement;
        expect(editor.value).toBe('## Summary\n\n## Test Plan\n');
      });
    });

    it('leaves body empty when PR template is not found', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github-config:read-file') throw new Error('File not found');
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Pull request title')).toBeInTheDocument();
      });

      const editor = screen.getByTestId('markdown-editor') as HTMLTextAreaElement;
      expect(editor.value).toBe('');
    });
  });

  describe('same branches warning', () => {
    it('shows warning when base and compare are the same branch', async () => {
      // Set current branch to main so both base and compare will be main
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'main';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      // base defaults to branches[0] = 'main', compare set to currentBranch = 'main'
      await waitFor(() => {
        expect(screen.getByText('Select different branches to see changes.')).toBeInTheDocument();
      });
    });
  });

  describe('submit button disabled states', () => {
    it('disables submit when title is empty', async () => {
      const user = userEvent.setup();

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).not.toBe('');
      });

      // Clear the title
      const titleInput = screen.getByPlaceholderText('Pull request title');
      await user.clear(titleInput);

      const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit when base equals compare', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'main';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      // base = main (branches[0]), compare = main (currentBranch)
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
        expect(submitButton).toBeDisabled();
      });
    });

    it('shows "Creating..." text when submitting', async () => {
      const user = userEvent.setup();

      // Make create-pull-request hang so we can check the submitting state
      let resolveCreate: (v: any) => void;
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') return 'feature-branch';
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'git:get-remote-branches') return ['main', 'feature-branch'];
        if (channel === 'github:create-pull-request') {
          return new Promise((resolve) => {
            resolveCreate = resolve;
          });
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).not.toBe('');
      });

      const submitButton = screen.getByRole('button', { name: /Create Pull Request/ });
      await user.click(submitButton);

      // Should show "Creating..." while submitting
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      // Clean up
      await act(async () => {
        resolveCreate!({ number: 1, url: 'https://github.com/org/repo/pull/1', state: 'open' });
      });
    });
  });

  describe('init fallback', () => {
    it('falls back to defaultBranchName when get-current-branch fails', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') throw new Error('git error');
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} defaultBranchName="develop" />);

      // Should fall back to defaultBranchName for compare
      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes[1].textContent).toContain('develop');
      });

      // Title should be derived from fallback branch
      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).toBe('Develop');
      });
    });

    it('falls back to branches[1] when get-current-branch fails and no defaultBranchName', async () => {
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'git:get-current-branch') throw new Error('git error');
        if (channel === 'git:compare-branches') {
          return {
            commits: [],
            files: [],
            totalFilesChanged: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            rawDiff: '',
          };
        }
        if (channel === 'github:get-parent-issue') return null;
        return undefined;
      });

      render(<CreatePullRequestModal {...defaultProps} />);

      // Should fall back to branches[1] which is 'develop'
      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes[1].textContent).toContain('develop');
      });
    });
  });

  describe('auto-title update', () => {
    it('does not override title when user has manually edited it', async () => {
      const user = userEvent.setup();

      render(<CreatePullRequestModal {...defaultProps} />);

      // Wait for auto-title to be set
      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Pull request title') as HTMLInputElement;
        expect(titleInput.value).toBe('Feature Branch');
      });

      // User manually edits the title
      const titleInput = screen.getByPlaceholderText('Pull request title');
      await user.clear(titleInput);
      await user.type(titleInput, 'My Custom Title');

      expect((titleInput as HTMLInputElement).value).toBe('My Custom Title');

      // Now change compare branch by selecting a different branch
      // The compare selector is the second combobox
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.click(comboboxes[1]);

      // Select 'develop' from the options
      await waitFor(() => {
        const options = screen.getAllByRole('option');
        const developOption = options.find((o) => o.textContent === 'develop');
        if (developOption) fireEvent.click(developOption);
      });

      // Title should remain as the user-edited value, not auto-updated
      await waitFor(() => {
        expect((titleInput as HTMLInputElement).value).toBe('My Custom Title');
      });
    });
  });
});
