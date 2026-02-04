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
});
