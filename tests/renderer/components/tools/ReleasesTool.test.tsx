import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    createElement('div', { 'data-testid': 'markdown' }, children),
}));
vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('rehype-raw', () => ({ default: () => {} }));

// Mock MarkdownEditor
vi.mock('../../../../src/renderer/components/pull-requests/MarkdownEditor', () => ({
  MarkdownEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) =>
    createElement('textarea', {
      'data-testid': 'markdown-editor',
      value,
      onChange: (e: any) => onChange(e.target.value),
      placeholder,
    }),
}));

import { ReleasesTool } from '../../../../src/renderer/components/tools/ReleasesTool';
import { createMockContribution } from '../../../mocks/factories';

const mockReleases = [
  {
    id: 3001,
    tagName: 'v1.2.0',
    name: 'Release 1.2.0',
    body: '## Changes\n- Bug fix',
    draft: false,
    prerelease: false,
    createdAt: '2026-02-15T00:00:00Z',
    publishedAt: '2026-02-15T00:00:00Z',
    htmlUrl: 'https://github.com/org/repo/releases/tag/v1.2.0',
    author: 'dev',
    authorAvatarUrl: 'https://avatar.url/dev',
    isLatest: true,
  },
  {
    id: 3002,
    tagName: 'v1.1.0',
    name: 'Release 1.1.0',
    body: '## Old release',
    draft: false,
    prerelease: false,
    createdAt: '2026-02-01T00:00:00Z',
    publishedAt: '2026-02-01T00:00:00Z',
    htmlUrl: 'https://github.com/org/repo/releases/tag/v1.1.0',
    author: 'dev',
    authorAvatarUrl: '',
    isLatest: false,
  },
  {
    id: 3003,
    tagName: 'v2.0.0-beta',
    name: 'Beta 2.0',
    body: '## Beta notes',
    draft: true,
    prerelease: false,
    createdAt: '2026-02-10T00:00:00Z',
    publishedAt: null,
    htmlUrl: 'https://github.com/org/repo/releases/tag/v2.0.0-beta',
    author: 'dev',
    authorAvatarUrl: '',
    isLatest: false,
  },
  {
    id: 3004,
    tagName: 'v1.3.0-rc1',
    name: 'RC1',
    body: '## RC notes',
    draft: false,
    prerelease: true,
    createdAt: '2026-02-12T00:00:00Z',
    publishedAt: '2026-02-12T00:00:00Z',
    htmlUrl: 'https://github.com/org/repo/releases/tag/v1.3.0-rc1',
    author: 'contributor',
    authorAvatarUrl: '',
    isLatest: false,
  },
];

const defaultProps = {
  contribution: createMockContribution({
    upstreamUrl: 'https://github.com/upstream/repo.git',
  }),
};

function setupMocks(releases = mockReleases) {
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'github:list-releases') return releases;
    if (channel === 'github:delete-release') return undefined;
    if (channel === 'github:update-release')
      return {
        id: 1,
        tagName: 'v1',
        name: 'test',
        body: '',
        draft: false,
        prerelease: false,
        htmlUrl: '',
      };
    if (channel === 'github:publish-release')
      return { id: 1, tagName: 'v1', name: 'test', htmlUrl: '' };
    if (channel === 'github:create-release')
      return {
        id: 1,
        tagName: 'v1',
        name: 'test',
        body: '',
        draft: true,
        prerelease: false,
        htmlUrl: '',
      };
    return undefined;
  });
}

describe('ReleasesTool', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  describe('List view', () => {
    it('renders loading state then releases', async () => {
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
        expect(screen.getByText('Release 1.1.0')).toBeDefined();
      });
    });

    it('shows release count after loading', async () => {
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('(4)')).toBeDefined();
      });
    });

    it('shows Latest badge for latest release', async () => {
      setupMocks([mockReleases[0]]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Latest')).toBeDefined();
      });
    });

    it('shows Draft badge for draft releases', async () => {
      setupMocks([mockReleases[2]]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeDefined();
      });
    });

    it('shows Pre-release badge for pre-releases', async () => {
      setupMocks([mockReleases[3]]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Pre-release')).toBeDefined();
      });
    });

    it('shows error state with retry button', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeDefined();
        expect(screen.getByText('Retry')).toBeDefined();
      });
    });

    it('shows empty state when no releases', async () => {
      setupMocks([]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No releases found')).toBeDefined();
      });
    });

    it('shows no GitHub repo message when not linked', () => {
      render(
        <ReleasesTool
          contribution={createMockContribution({
            repositoryUrl: '',
            upstreamUrl: undefined,
          })}
        />
      );

      expect(screen.getByText('No GitHub repository linked to this project')).toBeDefined();
    });

    it('refresh button calls fetch again', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      // Click refresh
      const refreshIcon = screen.getByTestId('icon-refreshcw');
      const refreshButton = refreshIcon.closest('button');
      expect(refreshButton).not.toBeNull();
      await user.click(refreshButton as HTMLButtonElement);

      // Should have called list-releases twice (initial + refresh)
      const calls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'github:list-releases'
      );
      expect(calls.length).toBe(2);
    });
  });

  describe('Detail view', () => {
    it('navigates to detail when published release clicked', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('v1.2.0')).toBeDefined();
        expect(screen.getByText(/dev/)).toBeDefined();
      });
    });

    it('shows release summary (tag, author, date)', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('v1.2.0')).toBeDefined();
        // The detail view shows "Latest" badge
        expect(screen.getByText('Latest')).toBeDefined();
      });
    });

    it('renders markdown body', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        const markdown = screen.getByTestId('markdown');
        expect(markdown.textContent).toContain('## Changes');
      });
    });

    it('open in GitHub calls shell:open-external', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeDefined();
      });

      await user.click(screen.getByText('GitHub'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'shell:open-external',
        'https://github.com/org/repo/releases/tag/v1.2.0'
      );
    });

    it('back button returns to list', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('v1.2.0')).toBeDefined();
      });

      // Click back button
      const backIcon = screen.getByTestId('icon-arrowleft');
      const backButton = backIcon.closest('button');
      await user.click(backButton as HTMLButtonElement);

      // Should be back to list view
      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
        expect(screen.getByText('Release 1.1.0')).toBeDefined();
      });
    });

    it('delete button calls delete after confirm', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('Delete Release')).toBeDefined();
      });

      await user.click(screen.getByText('Delete Release'));

      expect(window.confirm).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith('github:delete-release', 'upstream', 'repo', 3001);
    });
  });

  describe('Draft edit view', () => {
    it('navigates to draft edit when draft release clicked', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Edit Draft')).toBeDefined();
      });
    });

    it('pre-populates form fields from release data', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        // Tag name and release title inputs should be pre-populated
        const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
        const tagInput = inputs.find((i) => i.value === 'v2.0.0-beta');
        const nameInput = inputs.find((i) => i.value === 'Beta 2.0');
        expect(tagInput).toBeDefined();
        expect(nameInput).toBeDefined();
      });
    });

    it('save draft calls update-release with form data', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Save Draft')).toBeDefined();
      });

      await user.click(screen.getByText('Save Draft'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'github:update-release',
        'upstream',
        'repo',
        3003,
        expect.objectContaining({
          tagName: 'v2.0.0-beta',
          name: 'Beta 2.0',
        })
      );
    });

    it('publish calls publish-release', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Publish')).toBeDefined();
      });

      await user.click(screen.getByText('Publish'));

      expect(mockInvoke).toHaveBeenCalledWith('github:publish-release', 'upstream', 'repo', 3003);
    });
  });

  describe('Create view', () => {
    it('navigates to create when New Draft button clicked', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      // Click the Plus button to create new
      const plusIcon = screen.getByTestId('icon-plus');
      const plusButton = plusIcon.closest('button');
      await user.click(plusButton as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });
    });

    it('create draft button disabled when tag name empty', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      const plusIcon = screen.getByTestId('icon-plus');
      const plusButton = plusIcon.closest('button');
      await user.click(plusButton as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });

      const createButton = screen.getByText('Create Draft');
      expect((createButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('create calls create-release with form data', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      const plusIcon = screen.getByTestId('icon-plus');
      const plusButton = plusIcon.closest('button');
      await user.click(plusButton as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });

      // Fill in tag name (first text input after "Tag Name *" label)
      const tagInput = screen.getByPlaceholderText('v1.0.0');
      await user.type(tagInput, 'v3.0.0');

      // Fill in title
      const titleInput = screen.getByPlaceholderText('Release title');
      await user.type(titleInput, 'Version 3.0');

      // Click create
      await user.click(screen.getByText('Create Draft'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-release',
        'upstream',
        'repo',
        expect.objectContaining({
          tagName: 'v3.0.0',
          name: 'Version 3.0',
          draft: true,
        })
      );
    });

    it('create sends empty target as undefined', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      const plusIcon = screen.getByTestId('icon-plus');
      const plusButton = plusIcon.closest('button');
      await user.click(plusButton as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });

      const tagInput = screen.getByPlaceholderText('v1.0.0');
      await user.type(tagInput, 'v4.0.0');

      // Clear the target branch field to make it empty
      const targetInput = screen.getByPlaceholderText('main');
      await user.clear(targetInput);

      await user.click(screen.getByText('Create Draft'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-release',
        'upstream',
        'repo',
        expect.objectContaining({
          tagName: 'v4.0.0',
          targetCommitish: undefined,
        })
      );
    });

    it('create draft error shows alert with Error message', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:create-release') throw new Error('Create failed');
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      const plusIcon = screen.getByTestId('icon-plus');
      await user.click(plusIcon.closest('button') as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });

      const tagInput = screen.getByPlaceholderText('v1.0.0');
      await user.type(tagInput, 'v5.0.0');
      await user.click(screen.getByText('Create Draft'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to create draft: Create failed');
      });
    });

    it('create draft error shows alert with non-Error string', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:create-release') throw 'string error';
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      const plusIcon = screen.getByTestId('icon-plus');
      await user.click(plusIcon.closest('button') as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });

      const tagInput = screen.getByPlaceholderText('v1.0.0');
      await user.type(tagInput, 'v5.0.0');
      await user.click(screen.getByText('Create Draft'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to create draft: string error');
      });
    });

    it('toggles prerelease and makeLatest checkboxes in create view', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      const plusIcon = screen.getByTestId('icon-plus');
      await user.click(plusIcon.closest('button') as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });

      // Pre-release checkbox should be unchecked, make-latest should be checked
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      const prereleaseCheckbox = checkboxes[0];
      const makeLatestCheckbox = checkboxes[1];

      expect(prereleaseCheckbox.checked).toBe(false);
      expect(makeLatestCheckbox.checked).toBe(true);

      // Toggle prerelease on (use fireEvent to avoid label double-click)
      fireEvent.click(prereleaseCheckbox);
      expect(prereleaseCheckbox.checked).toBe(true);

      // Toggle makeLatest off
      fireEvent.click(makeLatestCheckbox);
      expect(makeLatestCheckbox.checked).toBe(false);

      // Fill tag and create to verify makeLatest='false' branch
      const tagInput = screen.getByPlaceholderText('v1.0.0');
      await user.type(tagInput, 'v6.0.0');
      await user.click(screen.getByText('Create Draft'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'github:create-release',
        'upstream',
        'repo',
        expect.objectContaining({
          prerelease: true,
          makeLatest: 'false',
        })
      );
    });

    it('back button in create view returns to list', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      const plusIcon = screen.getByTestId('icon-plus');
      await user.click(plusIcon.closest('button') as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('New Release')).toBeDefined();
      });

      const backIcon = screen.getByTestId('icon-arrowleft');
      await user.click(backIcon.closest('button') as HTMLButtonElement);

      await waitFor(() => {
        expect(screen.getByText('Releases')).toBeDefined();
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });
    });
  });

  describe('Branch coverage - error handling', () => {
    it('fetch error with non-Error object shows stringified error', async () => {
      mockInvoke.mockRejectedValue('plain string error');
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('plain string error')).toBeDefined();
      });
    });

    it('delete does nothing when confirm returns false', async () => {
      const user = userEvent.setup();
      setupMocks();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('Delete Release')).toBeDefined();
      });

      await user.click(screen.getByText('Delete Release'));

      expect(window.confirm).toHaveBeenCalled();
      // delete-release should NOT have been called
      const deleteCalls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'github:delete-release'
      );
      expect(deleteCalls.length).toBe(0);
    });

    it('delete error shows alert with Error message', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:delete-release') throw new Error('Delete failed');
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('Delete Release')).toBeDefined();
      });

      await user.click(screen.getByText('Delete Release'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to delete release: Delete failed');
      });
    });

    it('delete error shows alert with non-Error string', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:delete-release') throw 'delete string error';
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.2.0'));

      await waitFor(() => {
        expect(screen.getByText('Delete Release')).toBeDefined();
      });

      await user.click(screen.getByText('Delete Release'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to delete release: delete string error');
      });
    });

    it('save draft error shows alert with Error message', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:update-release') throw new Error('Save failed');
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Save Draft')).toBeDefined();
      });

      await user.click(screen.getByText('Save Draft'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to save draft: Save failed');
      });
    });

    it('save draft error shows alert with non-Error string', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:update-release') throw 'save string error';
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Save Draft')).toBeDefined();
      });

      await user.click(screen.getByText('Save Draft'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to save draft: save string error');
      });
    });

    it('publish error shows alert with Error message', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:publish-release') throw new Error('Publish failed');
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Publish')).toBeDefined();
      });

      await user.click(screen.getByText('Publish'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to publish release: Publish failed');
      });
    });

    it('publish error shows alert with non-Error string', async () => {
      const user = userEvent.setup();
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') return mockReleases;
        if (channel === 'github:publish-release') throw 'publish string error';
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Publish')).toBeDefined();
      });

      await user.click(screen.getByText('Publish'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          'Failed to publish release: publish string error'
        );
      });
    });
  });

  describe('Branch coverage - detail view edge cases', () => {
    it('shows tagName when release name is empty in detail header', async () => {
      const user = userEvent.setup();
      const releaseNoName = {
        id: 3010,
        tagName: 'v9.0.0',
        name: '',
        body: 'Some notes',
        draft: false,
        prerelease: false,
        createdAt: '2026-02-20T00:00:00Z',
        publishedAt: '2026-02-20T00:00:00Z',
        htmlUrl: 'https://github.com/org/repo/releases/tag/v9.0.0',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([releaseNoName]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        // In list view, should show tagName when name is empty
        expect(screen.getByText('v9.0.0')).toBeDefined();
      });

      await user.click(screen.getByText('v9.0.0'));

      await waitFor(() => {
        // Detail view header should show tagName as fallback
        const headerTexts = screen.getAllByText('v9.0.0');
        expect(headerTexts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows "No release notes" when body is empty in detail view', async () => {
      const user = userEvent.setup();
      const releaseEmptyBody = {
        id: 3011,
        tagName: 'v10.0.0',
        name: 'Empty Body Release',
        body: '',
        draft: false,
        prerelease: false,
        createdAt: '2026-02-21T00:00:00Z',
        publishedAt: '2026-02-21T00:00:00Z',
        htmlUrl: 'https://github.com/org/repo/releases/tag/v10.0.0',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([releaseEmptyBody]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Empty Body Release')).toBeDefined();
      });

      await user.click(screen.getByText('Empty Body Release'));

      await waitFor(() => {
        expect(screen.getByText('No release notes')).toBeDefined();
      });
    });

    it('shows "No release notes" when body is whitespace-only in detail view', async () => {
      const user = userEvent.setup();
      const releaseWhitespaceBody = {
        id: 3012,
        tagName: 'v10.1.0',
        name: 'Whitespace Body',
        body: '   \n  ',
        draft: false,
        prerelease: false,
        createdAt: '2026-02-21T00:00:00Z',
        publishedAt: '2026-02-21T00:00:00Z',
        htmlUrl: 'https://github.com/org/repo/releases/tag/v10.1.0',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([releaseWhitespaceBody]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Whitespace Body')).toBeDefined();
      });

      await user.click(screen.getByText('Whitespace Body'));

      await waitFor(() => {
        expect(screen.getByText('No release notes')).toBeDefined();
      });
    });

    it('shows Pre-release badge in detail view for prerelease', async () => {
      const user = userEvent.setup();
      setupMocks([mockReleases[3]]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('RC1')).toBeDefined();
      });

      await user.click(screen.getByText('RC1'));

      await waitFor(() => {
        expect(screen.getByText('Pre-release')).toBeDefined();
      });
    });

    it('uses createdAt when publishedAt is null in detail view', async () => {
      const user = userEvent.setup();
      const releaseNoPubDate = {
        id: 3013,
        tagName: 'v11.0.0',
        name: 'No Pub Date',
        body: 'Some notes',
        draft: false,
        prerelease: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        publishedAt: null,
        htmlUrl: 'https://github.com/org/repo/releases/tag/v11.0.0',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([releaseNoPubDate]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No Pub Date')).toBeDefined();
      });

      await user.click(screen.getByText('No Pub Date'));

      await waitFor(() => {
        // Should show relative time based on createdAt
        expect(screen.getByText(/1h ago/)).toBeDefined();
      });
    });

    it('detail view does not show Latest badge when isLatest is false', async () => {
      const user = userEvent.setup();
      setupMocks([mockReleases[1]]); // Release 1.1.0, isLatest: false
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Release 1.1.0')).toBeDefined();
      });

      await user.click(screen.getByText('Release 1.1.0'));

      await waitFor(() => {
        expect(screen.getByText('v1.1.0')).toBeDefined();
        expect(screen.queryByText('Latest')).toBeNull();
      });
    });
  });

  describe('Branch coverage - draft edit view edge cases', () => {
    it('toggles prerelease and makeLatest checkboxes in draft edit', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Edit Draft')).toBeDefined();
      });

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      const prereleaseCheckbox = checkboxes[0];
      const makeLatestCheckbox = checkboxes[1];

      // makeLatest defaults to true when entering draft edit
      expect(makeLatestCheckbox.checked).toBe(true);

      // Toggle makeLatest off and save to hit makeLatest='false' branch (use fireEvent to avoid label double-click)
      fireEvent.click(makeLatestCheckbox);
      expect(makeLatestCheckbox.checked).toBe(false);

      // Toggle prerelease on
      fireEvent.click(prereleaseCheckbox);
      expect(prereleaseCheckbox.checked).toBe(true);

      await user.click(screen.getByText('Save Draft'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'github:update-release',
        'upstream',
        'repo',
        3003,
        expect.objectContaining({
          prerelease: true,
          makeLatest: 'false',
        })
      );
    });

    it('opens external link from draft edit view', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeDefined();
      });

      await user.click(screen.getByText('GitHub'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'shell:open-external',
        'https://github.com/org/repo/releases/tag/v2.0.0-beta'
      );
    });

    it('delete from draft edit view works', async () => {
      const user = userEvent.setup();
      setupMocks();
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Beta 2.0')).toBeDefined();
      });

      await user.click(screen.getByText('Beta 2.0'));

      await waitFor(() => {
        expect(screen.getByText('Delete Draft')).toBeDefined();
      });

      await user.click(screen.getByText('Delete Draft'));

      expect(window.confirm).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith('github:delete-release', 'upstream', 'repo', 3003);
    });
  });

  describe('Branch coverage - repositoryUrl fallback', () => {
    it('uses repositoryUrl when upstreamUrl is not set', async () => {
      setupMocks();
      render(
        <ReleasesTool
          contribution={createMockContribution({
            repositoryUrl: 'https://github.com/myorg/myrepo.git',
            upstreamUrl: undefined,
          })}
        />
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('github:list-releases', 'myorg', 'myrepo');
      });
    });
  });

  describe('Branch coverage - list view badges and display', () => {
    it('shows release with no name in list using tagName', async () => {
      const releaseNoName = {
        id: 3020,
        tagName: 'v99.0.0',
        name: '',
        body: '',
        draft: false,
        prerelease: false,
        createdAt: '2026-02-25T00:00:00Z',
        publishedAt: '2026-02-25T00:00:00Z',
        htmlUrl: 'https://github.com/org/repo/releases/tag/v99.0.0',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([releaseNoName]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        // Should display tagName when name is empty
        expect(screen.getByText('v99.0.0')).toBeDefined();
      });
    });

    it('uses createdAt when publishedAt is null in list item', async () => {
      const releaseNoPub = {
        id: 3021,
        tagName: 'v0.0.1',
        name: 'NoPubDate List',
        body: '',
        draft: true,
        prerelease: false,
        createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        publishedAt: null,
        htmlUrl: 'https://github.com/org/repo/releases/tag/v0.0.1',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([releaseNoPub]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('NoPubDate List')).toBeDefined();
        // Should show relative time from createdAt
        expect(screen.getByText(/2m ago/)).toBeDefined();
      });
    });

    it('shows release with all badges (latest + draft + prerelease) in list', async () => {
      const releaseAllBadges = {
        id: 3022,
        tagName: 'v0.0.2',
        name: 'All Badges',
        body: '',
        draft: true,
        prerelease: true,
        createdAt: '2026-02-25T00:00:00Z',
        publishedAt: null,
        htmlUrl: 'https://github.com/org/repo/releases/tag/v0.0.2',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: true,
      };
      setupMocks([releaseAllBadges]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Latest')).toBeDefined();
        expect(screen.getByText('Draft')).toBeDefined();
        expect(screen.getByText('Pre-release')).toBeDefined();
      });
    });
  });

  describe('Branch coverage - formatRelativeTime paths', () => {
    it('shows "just now" for very recent releases', async () => {
      const recentRelease = {
        id: 3030,
        tagName: 'v0.0.3',
        name: 'Just Now',
        body: '',
        draft: false,
        prerelease: false,
        createdAt: new Date().toISOString(), // now
        publishedAt: new Date().toISOString(),
        htmlUrl: 'https://github.com/org/repo/releases/tag/v0.0.3',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([recentRelease]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/just now/)).toBeDefined();
      });
    });

    it('shows minutes ago for releases within the hour', async () => {
      const minutesAgoRelease = {
        id: 3031,
        tagName: 'v0.0.4',
        name: 'Minutes Ago',
        body: '',
        draft: false,
        prerelease: false,
        createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
        publishedAt: new Date(Date.now() - 1800000).toISOString(),
        htmlUrl: 'https://github.com/org/repo/releases/tag/v0.0.4',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([minutesAgoRelease]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/30m ago/)).toBeDefined();
      });
    });

    it('shows hours ago for releases within the day', async () => {
      const hoursAgoRelease = {
        id: 3032,
        tagName: 'v0.0.5',
        name: 'Hours Ago',
        body: '',
        draft: false,
        prerelease: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        publishedAt: new Date(Date.now() - 7200000).toISOString(),
        htmlUrl: 'https://github.com/org/repo/releases/tag/v0.0.5',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([hoursAgoRelease]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/2h ago/)).toBeDefined();
      });
    });

    it('shows days ago for releases older than a day', async () => {
      const daysAgoRelease = {
        id: 3033,
        tagName: 'v0.0.6',
        name: 'Days Ago',
        body: '',
        draft: false,
        prerelease: false,
        createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        publishedAt: new Date(Date.now() - 259200000).toISOString(),
        htmlUrl: 'https://github.com/org/repo/releases/tag/v0.0.6',
        author: 'dev',
        authorAvatarUrl: '',
        isLatest: false,
      };
      setupMocks([daysAgoRelease]);
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/3d ago/)).toBeDefined();
      });
    });
  });

  describe('Branch coverage - retry after error', () => {
    it('retry button refetches releases after error', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'github:list-releases') {
          callCount++;
          if (callCount === 1) throw new Error('Temporary error');
          return mockReleases;
        }
        return undefined;
      });
      render(<ReleasesTool {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Temporary error')).toBeDefined();
      });

      await user.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Release 1.2.0')).toBeDefined();
      });
    });
  });
});
