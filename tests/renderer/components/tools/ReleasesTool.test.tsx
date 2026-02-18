import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  });
});
