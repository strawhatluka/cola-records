import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardScreen } from '../../../src/renderer/screens/DashboardScreen';

describe('DashboardScreen', () => {
  it('renders welcome message', () => {
    render(<DashboardScreen />);
    expect(screen.getByText('Welcome to Cola Records')).toBeDefined();
  });

  it('renders active contributions card', () => {
    render(<DashboardScreen />);
    expect(screen.getByText('Active Contributions')).toBeDefined();
  });

  it('renders issues viewed card', () => {
    render(<DashboardScreen />);
    expect(screen.getByText('Issues Viewed')).toBeDefined();
  });

  it('renders getting started guide', () => {
    render(<DashboardScreen />);
    expect(screen.getByText('Getting Started')).toBeDefined();
    expect(screen.getByText(/Navigate to/)).toBeDefined();
    expect(screen.getByText(/Configure your GitHub token/)).toBeDefined();
  });

  it('shows zero counts initially', () => {
    render(<DashboardScreen />);
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(2);
  });
});
