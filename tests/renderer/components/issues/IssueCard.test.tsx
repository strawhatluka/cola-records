import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssueCard } from '../../../../src/renderer/components/issues/IssueCard';
import { createMockIssue } from '../../../mocks/factories';

describe('IssueCard', () => {
  const defaultProps = {
    issue: createMockIssue(),
    onViewDetails: vi.fn(),
  };

  it('renders issue title', () => {
    render(<IssueCard {...defaultProps} />);
    expect(screen.getByText('Good first issue: Fix documentation typo')).toBeDefined();
  });

  it('renders repository name', () => {
    render(<IssueCard {...defaultProps} />);
    expect(screen.getByText('test-org/test-repo')).toBeDefined();
  });

  it('renders labels as badges', () => {
    render(<IssueCard {...defaultProps} />);
    expect(screen.getByText('good first issue')).toBeDefined();
    expect(screen.getByText('documentation')).toBeDefined();
  });

  it('shows +N for more than 3 labels', () => {
    const issue = createMockIssue({
      labels: ['one', 'two', 'three', 'four', 'five'],
    });
    render(<IssueCard {...defaultProps} issue={issue} />);
    expect(screen.getByText('+2')).toBeDefined();
  });

  it('calls onViewDetails when clicked', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    render(<IssueCard {...defaultProps} onViewDetails={onViewDetails} />);

    // Click on the card
    await user.click(screen.getByText('Good first issue: Fix documentation typo'));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('renders created date', () => {
    render(<IssueCard {...defaultProps} />);
    // Date format depends on locale, just check it contains "Opened"
    expect(screen.getByText(/Opened/)).toBeDefined();
  });
});
