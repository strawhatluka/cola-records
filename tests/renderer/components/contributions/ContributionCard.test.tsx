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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock StatusBadge
vi.mock('../../../../src/renderer/components/contributions/StatusBadge', () => ({
  StatusBadge: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}));

import { ContributionCard } from '../../../../src/renderer/components/contributions/ContributionCard';
import { createMockContribution } from '../../../mocks/factories';

describe('ContributionCard', () => {
  const mockOnDelete = vi.fn();
  const mockOnOpenProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: branches fetch returns current branch
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'git:get-branches') return ['main', 'fix-issue-42'];
      return undefined;
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders repo name from URL', () => {
    const contribution = createMockContribution({
      repositoryUrl: 'https://github.com/org/my-repo.git',
    });
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
    expect(screen.getByText('my-repo')).toBeDefined();
  });

  it('shows status badge', () => {
    const contribution = createMockContribution({ status: 'in_progress' });
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
    expect(screen.getByTestId('status-badge')).toBeDefined();
  });

  it('fetches branches on mount', async () => {
    const contribution = createMockContribution({ localPath: '/test/repo' });
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git:get-branches', '/test/repo');
    });
  });

  it('calls onOpenProject when Open Project is clicked', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution();
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
    await user.click(screen.getByText('Open Project'));
    expect(mockOnOpenProject).toHaveBeenCalledWith(contribution);
  });

  it('opens external link when View on GitHub is clicked', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution({
      repositoryUrl: 'https://github.com/org/repo',
    });
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
    await user.click(screen.getByText('View on GitHub'));
    expect(mockInvoke).toHaveBeenCalledWith('shell:open-external', 'https://github.com/org/repo');
  });

  it('shows PR status badge when prStatus is set', () => {
    const contribution = createMockContribution({
      prStatus: 'open',
      prNumber: 99,
    });
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
    expect(screen.getByText('PR #99 - open')).toBeDefined();
  });

  it('shows fork badge when isFork is true', () => {
    const contribution = createMockContribution({ isFork: true });
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
    expect(screen.getByText('Fork')).toBeDefined();
  });

  it('calls onDelete after confirmation', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution({ id: 'del-me' });
    render(
      <ContributionCard
        contribution={contribution}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
      />
    );
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
    it('shows blue PR badge for contribution with open PR', () => {
      const contribution = createMockContribution({
        type: 'contribution',
        prStatus: 'open',
        prNumber: 42,
      });
      render(
        <ContributionCard
          contribution={contribution}
          onDelete={mockOnDelete}
          onOpenProject={mockOnOpenProject}
        />
      );
      const badge = screen.getByText('PR #42 - open').closest('div');
      expect(badge?.className).toContain('bg-blue-500');
    });

    it('shows red PR badge for project with open PR', () => {
      const contribution = createMockContribution({
        type: 'project',
        prStatus: 'open',
        prNumber: 99,
      });
      render(
        <ContributionCard
          contribution={contribution}
          onDelete={mockOnDelete}
          onOpenProject={mockOnOpenProject}
        />
      );
      const badge = screen.getByText('PR #99 - open').closest('div');
      expect(badge?.className).toContain('bg-red-500');
    });

    it('shows default variant for merged PR (contribution)', () => {
      const contribution = createMockContribution({
        type: 'contribution',
        prStatus: 'merged',
        prNumber: 10,
      });
      render(
        <ContributionCard
          contribution={contribution}
          onDelete={mockOnDelete}
          onOpenProject={mockOnOpenProject}
        />
      );
      const badge = screen.getByText('PR #10 - merged').closest('div');
      // Default variant uses bg-primary
      expect(badge?.className).toContain('bg-primary');
    });

    it('shows default variant for merged PR (project)', () => {
      const contribution = createMockContribution({
        type: 'project',
        prStatus: 'merged',
        prNumber: 20,
      });
      render(
        <ContributionCard
          contribution={contribution}
          onDelete={mockOnDelete}
          onOpenProject={mockOnOpenProject}
        />
      );
      const badge = screen.getByText('PR #20 - merged').closest('div');
      // Default variant uses bg-primary
      expect(badge?.className).toContain('bg-primary');
    });

    it('shows outline variant for closed PR', () => {
      const contribution = createMockContribution({
        type: 'contribution',
        prStatus: 'closed',
        prNumber: 5,
      });
      render(
        <ContributionCard
          contribution={contribution}
          onDelete={mockOnDelete}
          onOpenProject={mockOnOpenProject}
        />
      );
      const badge = screen.getByText('PR #5 - closed').closest('div');
      // Outline variant doesn't have bg-* color, just text-foreground
      expect(badge?.className).not.toContain('bg-blue-500');
      expect(badge?.className).not.toContain('bg-red-500');
      expect(badge?.className).not.toContain('bg-primary');
    });

    it('defaults to blue for open PR when type is undefined (legacy data)', () => {
      const contribution = createMockContribution({
        prStatus: 'open',
        prNumber: 77,
      });
      // Explicitly remove type to simulate legacy data
      delete (contribution as any).type;

      render(
        <ContributionCard
          contribution={contribution}
          onDelete={mockOnDelete}
          onOpenProject={mockOnOpenProject}
        />
      );
      const badge = screen.getByText('PR #77 - open').closest('div');
      // Should default to contribution behavior (blue)
      expect(badge?.className).toContain('bg-blue-500');
    });
  });
});
