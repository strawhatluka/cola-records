import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock ThemeProvider (needed by ThemeToggle)
vi.mock('../../../../src/renderer/providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
  }),
}));

import { AppBar } from '../../../../src/renderer/components/layout/AppBar';

describe('AppBar', () => {
  it('renders the title', () => {
    render(<AppBar title="My App" />);
    expect(screen.getByText('My App')).toBeDefined();
  });

  it('renders ThemeToggle button', () => {
    render(<AppBar title="Test" />);
    expect(screen.getByText('Toggle theme')).toBeDefined();
  });

  it('renders as a header element', () => {
    const { container } = render(<AppBar title="Test" />);
    expect(container.querySelector('header')).toBeDefined();
  });
});
