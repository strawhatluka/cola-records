import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Mock useContributionWorkflow hook
const mockStartWorkflow = vi.fn();
const mockReset = vi.fn();
let mockState = {
  status: 'idle' as string,
  progress: 0,
  error: null as string | null,
  contribution: null as any,
};

vi.mock('../../../../src/renderer/hooks/useContributionWorkflow', () => ({
  useContributionWorkflow: () => ({
    state: mockState,
    startWorkflow: mockStartWorkflow,
    reset: mockReset,
  }),
}));

// Mock useSettingsStore
vi.mock('../../../../src/renderer/stores/useSettingsStore', () => ({
  useSettingsStore: Object.assign(() => ({ defaultClonePath: '/mock/path' }), {
    getState: () => ({ defaultClonePath: '/mock/path' }),
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}));

import { ContributionWorkflowModal } from '../../../../src/renderer/components/contributions/ContributionWorkflowModal';
import { createMockIssue, createMockContribution } from '../../../mocks/factories';

describe('ContributionWorkflowModal', () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnStartDev = vi.fn();
  const issue = createMockIssue();

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      status: 'idle',
      progress: 0,
      error: null,
      contribution: null,
    };
  });

  it('renders dialog with issue title when open', () => {
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Setting Up Contribution')).toBeDefined();
    expect(screen.getByText(/Preparing to work on/)).toBeDefined();
  });

  it('shows forking status message', () => {
    mockState = { status: 'forking', progress: 20, error: null, contribution: null };
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Forking repository to your GitHub account...')).toBeDefined();
    expect(screen.getByText('Please wait...')).toBeDefined();
  });

  it('shows cloning status message', () => {
    mockState = { status: 'cloning', progress: 40, error: null, contribution: null };
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Cloning repository to local machine...')).toBeDefined();
  });

  it('shows complete state with contribution info', () => {
    const contribution = createMockContribution({
      localPath: '/test/path',
      branchName: 'docs/42-good-first-issue-fix',
    });
    mockState = { status: 'complete', progress: 100, error: null, contribution };
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        onStartDev={mockOnStartDev}
      />
    );
    expect(screen.getByText('Setup complete! Repository is ready for development.')).toBeDefined();
    expect(screen.getByText('/test/path')).toBeDefined();
    expect(screen.getByText('docs/42-good-first-issue-fix')).toBeDefined();
    expect(screen.getByText('Start Dev')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
  });

  it('shows error state with close button', () => {
    mockState = { status: 'error', progress: 0, error: 'Fork failed', contribution: null };
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText('Fork failed')).toBeDefined();
    // Two "Close" buttons exist: the destructive close button + Dialog's sr-only X button
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    expect(closeButtons.length).toBe(2);
    // The destructive variant is the explicit close button
    expect(
      closeButtons.find((b) => b.getAttribute('data-variant') === 'destructive')
    ).toBeDefined();
  });

  it('shows helpful message for Windows-incompatible path errors', () => {
    mockState = { status: 'error', progress: 0, error: 'invalid path in repo', contribution: null };
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    expect(screen.getByText(/Windows-incompatible paths/)).toBeDefined();
  });

  it('calls onComplete and onStartDev when Start Dev is clicked', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution();
    mockState = { status: 'complete', progress: 100, error: null, contribution };
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        onStartDev={mockOnStartDev}
      />
    );
    await user.click(screen.getByText('Start Dev'));
    expect(mockOnComplete).toHaveBeenCalledWith(contribution);
    expect(mockOnStartDev).toHaveBeenCalledWith(contribution);
    expect(mockReset).toHaveBeenCalled();
  });

  it('calls reset and onClose when Done is clicked', async () => {
    const user = userEvent.setup();
    const contribution = createMockContribution();
    mockState = { status: 'complete', progress: 100, error: null, contribution };
    render(
      <ContributionWorkflowModal
        issue={issue}
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    await user.click(screen.getByText('Done'));
    // Done calls handleClose which only calls reset + onClose (not onComplete)
    expect(mockReset).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });
});
