import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { DevScriptsTool } from '../../../../src/renderer/components/tools/DevScriptsTool';

describe('DevScriptsTool', () => {
  it('renders the Code icon', () => {
    render(<DevScriptsTool />);
    expect(screen.getByTestId('icon-code')).toBeDefined();
  });

  it('renders the title', () => {
    render(<DevScriptsTool />);
    expect(screen.getByText('Dev Scripts')).toBeDefined();
  });

  it('renders Coming soon placeholder', () => {
    render(<DevScriptsTool />);
    expect(screen.getByText('Coming soon')).toBeDefined();
  });

  it('renders description text', () => {
    render(<DevScriptsTool />);
    expect(
      screen.getByText('Quick access to npm scripts, build commands, and development utilities.')
    ).toBeDefined();
  });

  it('has correct container classes for centering', () => {
    const { container } = render(<DevScriptsTool />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('flex-col');
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
    expect(wrapper.className).toContain('h-full');
  });

  it('applies muted foreground color', () => {
    const { container } = render(<DevScriptsTool />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('text-muted-foreground');
  });
});
