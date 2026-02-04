import { describe, it, expect, vi } from 'vitest';
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

// Mock IssueCard to isolate IssueList behavior
vi.mock('../../../../src/renderer/components/issues/IssueCard', () => ({
  IssueCard: ({ issue, onViewDetails }: any) => (
    <div data-testid={`issue-${issue.number}`} onClick={onViewDetails}>
      {issue.title}
    </div>
  ),
}));

import { IssueList } from '../../../../src/renderer/components/issues/IssueList';
import { createMockIssue } from '../../../mocks/factories';

describe('IssueList', () => {
  const mockOnIssueSelect = vi.fn();

  it('shows skeletons when loading', () => {
    const { container } = render(
      <IssueList issues={[]} onIssueSelect={mockOnIssueSelect} loading={true} />
    );
    expect(container.querySelectorAll('.h-24').length).toBe(4);
  });

  it('shows empty message when no issues', () => {
    render(
      <IssueList issues={[]} onIssueSelect={mockOnIssueSelect} loading={false} />
    );
    expect(screen.getByText('No issues found. Try adjusting your filters.')).toBeDefined();
  });

  it('renders issue cards', () => {
    const issues = [
      createMockIssue({ number: 1, title: 'First issue' }),
      createMockIssue({ number: 2, title: 'Second issue' }),
    ];
    render(
      <IssueList issues={issues} onIssueSelect={mockOnIssueSelect} loading={false} />
    );
    expect(screen.getByText('First issue')).toBeDefined();
    expect(screen.getByText('Second issue')).toBeDefined();
  });

  it('calls onIssueSelect when issue card is clicked', async () => {
    const user = userEvent.setup();
    const issue = createMockIssue({ number: 42, title: 'Test issue' });
    render(
      <IssueList issues={[issue]} onIssueSelect={mockOnIssueSelect} loading={false} />
    );
    await user.click(screen.getByText('Test issue'));
    expect(mockOnIssueSelect).toHaveBeenCalledWith(issue);
  });
});
