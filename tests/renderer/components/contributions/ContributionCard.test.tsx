import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock StatusBadge
vi.mock('../../../../src/renderer/components/contributions/StatusBadge', () => ({
  StatusBadge: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}));

import { ContributionCard } from '../../../../src/renderer/components/contributions/ContributionCard';
import { createMockContribution } from '../../../mocks/factories';

// Helper: render and flush async useEffect (branch fetch)
async function renderCard(props: {
  contribution: ReturnType<typeof createMockContribution>;
  onDelete: (id: string) => void;
  onOpenProject: (contribution: any) => void;
}) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ContributionCard
        contribution={props.contribution}
        onDelete={props.onDelete}
        onOpenProject={props.onOpenProject}
      />
    );
  });
  return result!;
}

describe('ContributionCard', () => {
  const mockOnDelete = vi.fn();
  const mockOnOpenProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: branches fetch returns branches and current branch
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'git:get-branches') return ['main', 'fix-issue-42'];
      if (channel === 'git:get-current-branch') return 'main';
      return undefined;
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders repo name from URL', async () => {
    const contribution = createMockContribution({
      repositoryUrl: 'https://github.com/org/my-repo.git',
    });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.getByText('my-repo')).toBeDefined();
  });

  it('decodes URL-encoded repo names with spaces', async () => {
    const contribution = createMockContribution({
      repositoryUrl: 'https://github.com/org/my%20repo.git',
    });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.getByText('my repo')).toBeDefined();
  });

  it('shows status badge', async () => {
    const contribution = createMockContribution({ status: 'in_progress' });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.getByTestId('status-badge')).toBeDefined();
  });

  it('fetches branches on mount', async () => {
    const contribution = createMockContribution({ localPath: '/test/repo' });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(mockInvoke).toHaveBeenCalledWith('git:get-branches', '/test/repo');
  });

  it('calls onOpenProject when Open Project is clicked', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution();
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    await user.click(screen.getByText('Open Project'));
    expect(mockOnOpenProject).toHaveBeenCalledWith(contribution);
  });

  it('opens external link when View on GitHub is clicked', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution({
      repositoryUrl: 'https://github.com/org/repo',
    });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    await user.click(screen.getByText('View on GitHub'));
    expect(mockInvoke).toHaveBeenCalledWith('shell:open-external', 'https://github.com/org/repo');
  });

  it('shows PR status badge when prStatus is set', async () => {
    const contribution = createMockContribution({
      prStatus: 'open',
      prNumber: 99,
    });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.getByText('PR #99 - open')).toBeDefined();
  });

  it('shows fork badge when isFork is true', async () => {
    const contribution = createMockContribution({ isFork: true });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.getByText('Fork')).toBeDefined();
  });

  it('calls onDelete after confirmation', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution({ id: 'del-me' });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    // Click the delete button (Trash2 icon button — last button)
    const deleteIcon = screen.getAllByTestId('icon-trash2');
    // The standalone trash icon (not the one in sync button)
    await user.click(deleteIcon[deleteIcon.length - 1].closest('button')!);
    expect(mockOnDelete).toHaveBeenCalledWith('del-me');
  });

  // ============================================
  // PR Badge Color Tests
  // ============================================
  describe('PR Badge Colors', () => {
    it('shows blue PR badge for contribution with open PR', async () => {
      const contribution = createMockContribution({
        type: 'contribution',
        prStatus: 'open',
        prNumber: 42,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      const badge = screen.getByText('PR #42 - open').closest('div');
      expect(badge?.className).toContain('bg-blue-500');
    });

    it('shows red PR badge for project with open PR', async () => {
      const contribution = createMockContribution({
        type: 'project',
        prStatus: 'open',
        prNumber: 99,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      const badge = screen.getByText('PR #99 - open').closest('div');
      expect(badge?.className).toContain('bg-red-500');
    });

    it('shows default variant for merged PR (contribution)', async () => {
      const contribution = createMockContribution({
        type: 'contribution',
        prStatus: 'merged',
        prNumber: 10,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      const badge = screen.getByText('PR #10 - merged').closest('div');
      // Default variant uses bg-primary
      expect(badge?.className).toContain('bg-primary');
    });

    it('shows default variant for merged PR (project)', async () => {
      const contribution = createMockContribution({
        type: 'project',
        prStatus: 'merged',
        prNumber: 20,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      const badge = screen.getByText('PR #20 - merged').closest('div');
      // Default variant uses bg-primary
      expect(badge?.className).toContain('bg-primary');
    });

    it('shows outline variant for closed PR', async () => {
      const contribution = createMockContribution({
        type: 'contribution',
        prStatus: 'closed',
        prNumber: 5,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      const badge = screen.getByText('PR #5 - closed').closest('div');
      // Outline variant doesn't have bg-* color, just text-foreground
      expect(badge?.className).not.toContain('bg-blue-500');
      expect(badge?.className).not.toContain('bg-red-500');
      expect(badge?.className).not.toContain('bg-primary');
    });

    it('defaults to blue for open PR when type is undefined (legacy data)', async () => {
      const contribution = createMockContribution({
        prStatus: 'open',
        prNumber: 77,
      });
      // Explicitly remove type to simulate legacy data
      delete (contribution as any).type;

      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      const badge = screen.getByText('PR #77 - open').closest('div');
      // Should default to contribution behavior (blue)
      expect(badge?.className).toContain('bg-blue-500');
    });
  });

  // ============================================
  // Fork & Remotes Badge Branches
  // ============================================
  describe('Fork and Remote Badges', () => {
    it('shows "Not a Fork" badge when isFork is false', async () => {
      const contribution = createMockContribution({ isFork: false });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      expect(screen.getByText('Not a Fork')).toBeDefined();
    });

    it('does not show fork badge when isFork is undefined', async () => {
      const contribution = createMockContribution();
      // Ensure isFork is undefined
      delete (contribution as any).isFork;
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      expect(screen.queryByText('Fork')).toBeNull();
      expect(screen.queryByText('Not a Fork')).toBeNull();
    });

    it('shows "Remotes Valid" badge when isFork=true and remotesValid=true', async () => {
      const contribution = createMockContribution({
        isFork: true,
        remotesValid: true,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      expect(screen.getByText('Remotes Valid')).toBeDefined();
    });

    it('shows "Remotes Invalid" badge when isFork=true and remotesValid=false', async () => {
      const contribution = createMockContribution({
        isFork: true,
        remotesValid: false,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      expect(screen.getByText('Remotes Invalid')).toBeDefined();
    });

    it('does not show remotes badge when isFork=false even if remotesValid is set', async () => {
      const contribution = createMockContribution({
        isFork: false,
        remotesValid: true,
      });
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      expect(screen.queryByText('Remotes Valid')).toBeNull();
      expect(screen.queryByText('Remotes Invalid')).toBeNull();
    });

    it('does not show remotes badge when remotesValid is undefined', async () => {
      const contribution = createMockContribution({ isFork: true });
      // Ensure remotesValid is undefined
      delete (contribution as any).remotesValid;
      await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
      expect(screen.queryByText('Remotes Valid')).toBeNull();
      expect(screen.queryByText('Remotes Invalid')).toBeNull();
    });
  });

  // ============================================
  // PR Status Badge absent
  // ============================================
  it('does not show PR badge when prStatus is undefined', async () => {
    const contribution = createMockContribution();
    delete (contribution as any).prStatus;
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.queryByText(/PR #/)).toBeNull();
  });

  // ============================================
  // getRepoInfo fallback (non-matching URL)
  // ============================================
  it('shows raw URL when repositoryUrl does not match github pattern', async () => {
    const contribution = createMockContribution({
      repositoryUrl: 'https://gitlab.com/user/project',
    });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.getByText('https://gitlab.com/user/project')).toBeDefined();
  });

  // ============================================
  // Branch loading and failure states
  // ============================================
  it('shows loading text while branches are being fetched', async () => {
    // Make branch fetch hang forever
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    const contribution = createMockContribution();
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );

    expect(screen.getByText('Loading branches...')).toBeDefined();
  });

  it('falls back to stored branch when branch fetch fails', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'git:get-branches') throw new Error('Directory not found');
      if (channel === 'git:get-current-branch') throw new Error('Directory not found');
      return undefined;
    });

    const contribution = createMockContribution({ branchName: 'my-feature' });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });
    expect(screen.getByText('my-feature')).toBeDefined();
  });

  // ============================================
  // Current branch highlight
  // ============================================
  it('highlights current branch with primary styling', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'git:get-branches') return ['main', 'develop'];
      if (channel === 'git:get-current-branch') return 'develop';
      return undefined;
    });

    const contribution = createMockContribution();
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });

    const developBranch = screen.getByText('develop');
    expect(developBranch.className).toContain('bg-primary');

    const mainBranch = screen.getByText('main');
    expect(mainBranch.className).not.toContain('bg-primary');
  });

  // ============================================
  // handleDelete confirmation rejected
  // ============================================
  it('does not call onDelete when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const contribution = createMockContribution({ id: 'keep-me' });
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });

    const deleteIcon = screen.getAllByTestId('icon-trash2');
    await user.click(deleteIcon[deleteIcon.length - 1].closest('button')!);
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  // ============================================
  // handleSyncPRStatus error
  // ============================================
  it('shows alert when sync PR status fails', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'git:get-branches') return ['main'];
      if (channel === 'git:get-current-branch') return 'main';
      if (channel === 'contribution:sync-with-github') throw new Error('Token invalid');
      return undefined;
    });

    const user = userEvent.setup();
    const contribution = createMockContribution();
    await renderCard({ contribution, onDelete: mockOnDelete, onOpenProject: mockOnOpenProject });

    const syncButton = screen.getByTitle('Sync PR status with GitHub');
    await user.click(syncButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Failed to sync PR status. Make sure your GitHub token is valid.'
      );
    });
  });
});
