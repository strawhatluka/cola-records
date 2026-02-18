import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock all widget components to avoid async IPC side-effects.
// Each widget is tested in its own dedicated test file.
vi.mock('../../../src/renderer/components/dashboard/ContributionStatusWidget', () => ({
  ContributionStatusWidget: () => (
    <div data-testid="widget-contribution-status">ContributionStatusWidget</div>
  ),
}));
vi.mock('../../../src/renderer/components/dashboard/GitHubProfileWidget', () => ({
  GitHubProfileWidget: () => <div data-testid="widget-github-profile">GitHubProfileWidget</div>,
}));
vi.mock('../../../src/renderer/components/dashboard/PRsNeedingAttentionWidget', () => ({
  PRsNeedingAttentionWidget: () => <div data-testid="widget-prs">PRsNeedingAttentionWidget</div>,
}));
vi.mock('../../../src/renderer/components/dashboard/OpenIssuesWidget', () => ({
  OpenIssuesWidget: () => <div data-testid="widget-open-issues">OpenIssuesWidget</div>,
}));
vi.mock('../../../src/renderer/components/dashboard/RecentActivityWidget', () => ({
  RecentActivityWidget: () => <div data-testid="widget-recent-activity">RecentActivityWidget</div>,
}));
vi.mock('../../../src/renderer/components/dashboard/CICDStatusWidget', () => ({
  CICDStatusWidget: () => <div data-testid="widget-cicd">CICDStatusWidget</div>,
}));

import { DashboardScreen } from '../../../src/renderer/screens/DashboardScreen';

describe('DashboardScreen', () => {
  it('renders the dashboard header', () => {
    render(<DashboardScreen />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Your contribution activity at a glance')).toBeDefined();
  });

  it('renders all 6 widget components', () => {
    render(<DashboardScreen />);

    expect(screen.getByTestId('widget-contribution-status')).toBeDefined();
    expect(screen.getByTestId('widget-github-profile')).toBeDefined();
    expect(screen.getByTestId('widget-prs')).toBeDefined();
    expect(screen.getByTestId('widget-open-issues')).toBeDefined();
    expect(screen.getByTestId('widget-recent-activity')).toBeDefined();
    expect(screen.getByTestId('widget-cicd')).toBeDefined();
  });

  it('renders a grid layout', () => {
    const { container } = render(<DashboardScreen />);
    const grid = container.querySelector('.grid.grid-cols-1');
    expect(grid).not.toBeNull();
  });

  it('renders all 6 widgets inside the grid', () => {
    const { container } = render(<DashboardScreen />);
    const grid = container.querySelector('.grid.grid-cols-1');
    expect(grid).not.toBeNull();
    expect(grid!.children.length).toBe(6);
  });

  it('renders scrollable content area', () => {
    const { container } = render(<DashboardScreen />);
    const scrollable = container.querySelector('.overflow-y-auto');
    expect(scrollable).not.toBeNull();
  });

  it('renders header outside scrollable area', () => {
    const { container } = render(<DashboardScreen />);
    const header = screen.getByText('Dashboard');
    const scrollable = container.querySelector('.overflow-y-auto');
    expect(scrollable!.contains(header)).toBe(false);
  });
});
