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

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

// Mock RepositoryFileTree to avoid its side effects
vi.mock('../../../../src/renderer/components/issues/RepositoryFileTree', () => ({
  RepositoryFileTree: ({ repository }: any) => <div data-testid="file-tree">{repository}</div>,
}));

import { IssueDetailModal } from '../../../../src/renderer/components/issues/IssueDetailModal';
import { createMockIssue } from '../../../mocks/factories';

describe('IssueDetailModal', () => {
  const mockOnClose = vi.fn();
  const mockOnContribute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when issue is null', () => {
    const { container } = render(<IssueDetailModal issue={null} onClose={mockOnClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders issue title and metadata', () => {
    const issue = createMockIssue({
      title: 'Fix docs typo',
      repository: 'org/repo',
      number: 42,
    });
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    expect(screen.getByText('Fix docs typo')).toBeDefined();
    expect(screen.getByText('org/repo • #42')).toBeDefined();
  });

  it('renders issue labels as badges', () => {
    const issue = createMockIssue({
      labels: ['bug', 'help wanted'],
    });
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    expect(screen.getByText('bug')).toBeDefined();
    expect(screen.getByText('help wanted')).toBeDefined();
  });

  it('renders issue body as markdown', () => {
    const issue = createMockIssue({ body: 'Fix the **typo**' });
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    expect(screen.getByTestId('markdown')).toBeDefined();
    expect(screen.getByText('Fix the **typo**')).toBeDefined();
  });

  it('shows "No description provided" for empty body', () => {
    const issue = createMockIssue({ body: '' });
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    expect(screen.getByText('No description provided')).toBeDefined();
  });

  it('renders repository file tree', () => {
    const issue = createMockIssue({ repository: 'org/repo' });
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    expect(screen.getByTestId('file-tree')).toBeDefined();
    expect(screen.getByText('Repository File Structure')).toBeDefined();
  });

  it('renders View on GitHub button', () => {
    const issue = createMockIssue();
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    expect(screen.getByText('View on GitHub')).toBeDefined();
  });

  it('opens external link when View on GitHub is clicked', async () => {
    const user = userEvent.setup();
    const issue = createMockIssue({ url: 'https://github.com/org/repo/issues/42' });
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    await user.click(screen.getByText('View on GitHub'));
    expect(mockInvoke).toHaveBeenCalledWith(
      'shell:open-external',
      'https://github.com/org/repo/issues/42'
    );
  });

  it('shows Contribute button when onContribute is provided', () => {
    const issue = createMockIssue();
    render(
      <IssueDetailModal issue={issue} onClose={mockOnClose} onContribute={mockOnContribute} />
    );
    expect(screen.getByText('Contribute to this Issue')).toBeDefined();
  });

  it('does not show Contribute button when onContribute is not provided', () => {
    const issue = createMockIssue();
    render(<IssueDetailModal issue={issue} onClose={mockOnClose} />);
    expect(screen.queryByText('Contribute to this Issue')).toBeNull();
  });

  it('calls onContribute when Contribute button is clicked', async () => {
    const user = userEvent.setup();
    const issue = createMockIssue();
    render(
      <IssueDetailModal issue={issue} onClose={mockOnClose} onContribute={mockOnContribute} />
    );
    await user.click(screen.getByText('Contribute to this Issue'));
    expect(mockOnContribute).toHaveBeenCalledWith(issue);
  });
});
