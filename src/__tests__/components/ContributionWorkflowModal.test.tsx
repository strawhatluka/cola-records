import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContributionWorkflowModal } from '../../renderer/components/contributions/ContributionWorkflowModal';
import type { GitHubIssue, Contribution } from '../../main/ipc/channels';

const mockStartWorkflow = vi.fn();
const mockReset = vi.fn();

let mockState = {
  status: 'idle' as any,
  progress: 0,
  error: null as string | null,
  contribution: null as Contribution | null,
};

vi.mock('../../renderer/hooks/useContributionWorkflow', () => ({
  useContributionWorkflow: () => ({
    state: mockState,
    startWorkflow: mockStartWorkflow,
    reset: mockReset,
  }),
}));

describe('ContributionWorkflowModal', () => {
  const mockIssue: GitHubIssue = {
    id: 'issue-1',
    number: 123,
    title: 'Test Issue',
    body: 'Test body',
    url: 'https://github.com/owner/repo/issues/123',
    repository: 'owner/repo',
    labels: ['good first issue'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      status: 'idle',
      progress: 0,
      error: null,
      contribution: null,
    };
  });

  it('should not render when closed', () => {
    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={false}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.queryByText('Setting Up Contribution')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Setting Up Contribution')).toBeInTheDocument();
  });

  it('should display issue title in description', () => {
    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText(/Preparing to work on: Test Issue/)).toBeInTheDocument();
  });

  it('should start workflow when opened with issue', async () => {
    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    await waitFor(() => {
      expect(mockStartWorkflow).toHaveBeenCalledWith(mockIssue);
    });
  });

  it('should display forking status', () => {
    mockState.status = 'forking';
    mockState.progress = 25;

    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Forking repository to your GitHub account...')).toBeInTheDocument();
  });

  it('should display completion status with contribution details', () => {
    mockState.status = 'complete';
    mockState.progress = 100;
    mockState.contribution = {
      id: '1',
      repositoryUrl: 'https://github.com/user/repo',
      localPath: '/path/to/repo',
      issueNumber: 123,
      issueTitle: 'Test Issue',
      branchName: 'fix-issue-123',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Setup complete! Repository is ready for development.')).toBeInTheDocument();
    expect(screen.getByText('/path/to/repo')).toBeInTheDocument();
    expect(screen.getByText('fix-issue-123')).toBeInTheDocument();
  });

  it('should display error status', () => {
    mockState.status = 'error';
    mockState.error = 'Failed to fork repository';

    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Error: Failed to fork repository')).toBeInTheDocument();
  });

  it('should call onComplete when "Open in IDE" clicked', async () => {
    const user = userEvent.setup();
    const mockContribution: Contribution = {
      id: '1',
      repositoryUrl: 'https://github.com/user/repo',
      localPath: '/path/to/repo',
      issueNumber: 123,
      issueTitle: 'Test Issue',
      branchName: 'fix-issue-123',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockState.status = 'complete';
    mockState.progress = 100;
    mockState.contribution = mockContribution;

    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const button = screen.getByRole('button', { name: /Open in IDE/i });
    await user.click(button);

    expect(mockOnComplete).toHaveBeenCalledWith(mockContribution);
    expect(mockReset).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose and reset when "Done" clicked', async () => {
    const user = userEvent.setup();

    mockState.status = 'complete';
    mockState.progress = 100;
    mockState.contribution = {
      id: '1',
      repositoryUrl: 'https://github.com/user/repo',
      localPath: '/path/to/repo',
      issueNumber: 123,
      issueTitle: 'Test Issue',
      branchName: 'fix-issue-123',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ContributionWorkflowModal
        issue={mockIssue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const button = screen.getByRole('button', { name: /Done/i });
    await user.click(button);

    expect(mockReset).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });
});
