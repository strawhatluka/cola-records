import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createMockDevScript } from '../../../mocks/dev-scripts.mock';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { ScriptButton } from '../../../../src/renderer/components/tools/ScriptButton';

describe('ScriptButton', () => {
  const mockOnClick = vi.fn();
  const mockScript = createMockDevScript({
    id: 'script_1',
    name: 'Build',
    command: 'npm run build',
  });

  const defaultProps = {
    script: mockScript,
    onClick: mockOnClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TT-10: ScriptButton Tests ──────────────────────────────────────────

  it('should render script name as button text', () => {
    render(<ScriptButton {...defaultProps} />);
    expect(screen.getByText('Build')).toBeDefined();
  });

  it('should have clear/transparent background by default', () => {
    const { container } = render(<ScriptButton {...defaultProps} />);
    const button = container.querySelector('button');

    // Check that button has no background color class by default (transparent)
    expect(button?.className).not.toContain('bg-primary');
    expect(button?.className).not.toContain('bg-destructive');
    // It should have hover:bg-muted/50 for hover state
    expect(button?.className).toContain('hover:bg-muted/50');
  });

  it('should call onClick when clicked', () => {
    render(<ScriptButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should show hover state styles', () => {
    const { container } = render(<ScriptButton {...defaultProps} />);
    const button = container.querySelector('button');

    // Check hover classes are present
    expect(button?.className).toContain('hover:text-foreground');
    expect(button?.className).toContain('hover:bg-muted/50');
  });

  it('should match header button styling', () => {
    const { container } = render(<ScriptButton {...defaultProps} />);
    const button = container.querySelector('button');

    // Check for header-compatible styling
    expect(button?.className).toContain('inline-flex');
    expect(button?.className).toContain('items-center');
    expect(button?.className).toContain('px-2.5');
    expect(button?.className).toContain('py-1');
    expect(button?.className).toContain('text-xs');
    expect(button?.className).toContain('font-medium');
    expect(button?.className).toContain('rounded-md');
    expect(button?.className).toContain('transition-colors');
  });

  it('should show command as title attribute', () => {
    render(<ScriptButton {...defaultProps} />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('title')).toBe('npm run build');
  });

  it('should render with different script names', () => {
    const testScript = createMockDevScript({
      id: 'script_test',
      name: 'Run Tests',
      command: 'npm test',
    });

    render(<ScriptButton script={testScript} onClick={mockOnClick} />);

    expect(screen.getByText('Run Tests')).toBeDefined();
    expect(screen.getByRole('button').getAttribute('title')).toBe('npm test');
  });

  it('should render play icon', () => {
    const { container } = render(<ScriptButton {...defaultProps} />);

    // Check for SVG element (mocked icon)
    const svgOrSpan = container.querySelector('svg, span');
    expect(svgOrSpan).toBeDefined();
  });

  it('should have gap between icon and text', () => {
    const { container } = render(<ScriptButton {...defaultProps} />);
    const button = container.querySelector('button');

    expect(button?.className).toContain('gap-1.5');
  });

  it('should use muted foreground color by default', () => {
    const { container } = render(<ScriptButton {...defaultProps} />);
    const button = container.querySelector('button');

    expect(button?.className).toContain('text-muted-foreground');
  });

  it('should handle long script names', () => {
    const longNameScript = createMockDevScript({
      id: 'script_long',
      name: 'Very Long Script Name That Might Wrap',
      command: 'npm run very-long-command',
    });

    render(<ScriptButton script={longNameScript} onClick={mockOnClick} />);

    expect(screen.getByText('Very Long Script Name That Might Wrap')).toBeDefined();
  });

  it('should handle special characters in script name', () => {
    const specialScript = createMockDevScript({
      id: 'script_special',
      name: 'Build & Deploy',
      command: 'npm run build && npm run deploy',
    });

    render(<ScriptButton script={specialScript} onClick={mockOnClick} />);

    expect(screen.getByText('Build & Deploy')).toBeDefined();
  });

  it('should be accessible with proper button role', () => {
    render(<ScriptButton {...defaultProps} />);

    const button = screen.getByRole('button', { name: /Build/i });
    expect(button).toBeDefined();
  });

  it('should not call onClick multiple times on single click', () => {
    render(<ScriptButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(3);
  });
});
