import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

// Mock ThemeProvider
const mockSetTheme = vi.fn();
vi.mock('../../../src/renderer/providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: mockSetTheme,
    resolvedTheme: 'light',
  }),
}));

import { ThemeToggle } from '../../../src/renderer/components/ThemeToggle';

describe('ThemeToggle', () => {
  it('renders toggle button with sr-only text', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Toggle theme')).toBeDefined();
  });

  it('renders sun and moon icons', () => {
    render(<ThemeToggle />);
    expect(screen.getByTestId('icon-sun')).toBeDefined();
    expect(screen.getByTestId('icon-moon')).toBeDefined();
  });

  it('shows dropdown menu items when clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByText('Toggle theme').closest('button')!);

    expect(screen.getByText('Light')).toBeDefined();
    expect(screen.getByText('Dark')).toBeDefined();
    expect(screen.getByText('System')).toBeDefined();
  });

  it('calls setTheme with "dark" when Dark is clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByText('Toggle theme').closest('button')!);
    await user.click(screen.getByText('Dark'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with "light" when Light is clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByText('Toggle theme').closest('button')!);
    await user.click(screen.getByText('Light'));

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});
