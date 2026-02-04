import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock ContributionCard to isolate ContributionList behavior
vi.mock('../../../../src/renderer/components/contributions/ContributionCard', () => ({
  ContributionCard: (props: any) => <div data-testid={`card-${props.contribution.id}`}>{props.contribution.branchName}</div>,
}));

import { ContributionList } from '../../../../src/renderer/components/contributions/ContributionList';
import { createMockContribution } from '../../../mocks/factories';

describe('ContributionList', () => {
  const mockOnDelete = vi.fn();
  const mockOnOpenProject = vi.fn();

  it('shows skeletons when loading', () => {
    const { container } = render(
      <ContributionList
        contributions={[]}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
        loading={true}
      />
    );
    expect(container.querySelectorAll('.h-40').length).toBe(3);
  });

  it('shows default empty message when no contributions', () => {
    render(
      <ContributionList
        contributions={[]}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
        loading={false}
      />
    );
    expect(screen.getByText('No contributions yet')).toBeDefined();
  });

  it('shows custom empty message', () => {
    render(
      <ContributionList
        contributions={[]}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
        loading={false}
        emptyMessage={{ title: 'Nothing here', subtitle: 'Add something' }}
      />
    );
    expect(screen.getByText('Nothing here')).toBeDefined();
    expect(screen.getByText('Add something')).toBeDefined();
  });

  it('renders contribution cards for each item', () => {
    const contributions = [
      createMockContribution({ id: 'c1', branchName: 'fix-1' }),
      createMockContribution({ id: 'c2', branchName: 'fix-2' }),
    ];
    render(
      <ContributionList
        contributions={contributions}
        onDelete={mockOnDelete}
        onOpenProject={mockOnOpenProject}
        loading={false}
      />
    );
    expect(screen.getByTestId('card-c1')).toBeDefined();
    expect(screen.getByTestId('card-c2')).toBeDefined();
  });
});
