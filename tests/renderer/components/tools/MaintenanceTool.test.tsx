import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { MaintenanceTool } from '../../../../src/renderer/components/tools/MaintenanceTool';

describe('MaintenanceTool', () => {
  it('renders the Wrench icon', () => {
    render(<MaintenanceTool />);
    expect(screen.getByTestId('icon-wrench')).toBeDefined();
  });

  it('renders the title', () => {
    render(<MaintenanceTool />);
    expect(screen.getByText('Maintenance')).toBeDefined();
  });

  it('renders Coming soon placeholder', () => {
    render(<MaintenanceTool />);
    expect(screen.getByText('Coming soon')).toBeDefined();
  });

  it('renders description text', () => {
    render(<MaintenanceTool />);
    expect(
      screen.getByText('System maintenance, cache management, logs, and diagnostic tools.')
    ).toBeDefined();
  });

  it('has correct container classes for centering', () => {
    const { container } = render(<MaintenanceTool />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('flex-col');
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
    expect(wrapper.className).toContain('h-full');
  });

  it('applies muted foreground color', () => {
    const { container } = render(<MaintenanceTool />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('text-muted-foreground');
  });
});
