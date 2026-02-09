import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../../../../src/renderer/components/layout/Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    currentScreen: 'dashboard' as const,
    onScreenChange: vi.fn(),
    collapsed: false,
    onToggle: vi.fn(),
  };

  it('renders all nav items when expanded', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Issues')).toBeDefined();
    expect(screen.getByText('Contributions')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders app title when expanded', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Cola Records')).toBeDefined();
  });

  it('hides labels when collapsed', () => {
    render(<Sidebar {...defaultProps} collapsed={true} />);

    // Labels should not be visible when collapsed
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('Cola Records')).toBeNull();
  });

  it('calls onScreenChange when nav item clicked', async () => {
    const user = userEvent.setup();
    const onScreenChange = vi.fn();
    render(<Sidebar {...defaultProps} onScreenChange={onScreenChange} />);

    await user.click(screen.getByText('Issues'));
    expect(onScreenChange).toHaveBeenCalledWith('issues');
  });

  it('calls onToggle when toggle button clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Sidebar {...defaultProps} onToggle={onToggle} />);

    // Find the toggle button (it's a ghost button with chevron icon)
    const buttons = screen.getAllByRole('button');
    // The first button in the header area is the toggle
    await user.click(buttons[0]);
    expect(onToggle).toHaveBeenCalled();
  });

  it('highlights active screen', () => {
    render(<Sidebar {...defaultProps} currentScreen="issues" />);

    // The "Issues" button should have the secondary variant (active)
    const issuesButton = screen.getByText('Issues').closest('button');
    expect(issuesButton?.getAttribute('data-variant')).toBe('secondary');

    // Dashboard should have ghost variant (inactive)
    const dashboardButton = screen.getByText('Dashboard').closest('button');
    expect(dashboardButton?.getAttribute('data-variant')).toBe('ghost');
  });
});
