import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock mermaid — use vi.hoisted so the variable is available in the hoisted vi.mock factory
const { mockRender } = vi.hoisted(() => ({
  mockRender: vi.fn(),
}));
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: mockRender,
  },
}));

import { MermaidBlock } from '../../../../src/renderer/components/documentation/MermaidBlock';

describe('MermaidBlock', () => {
  beforeEach(() => {
    mockRender.mockReset();
  });

  it('renders SVG output for valid mermaid diagram', async () => {
    mockRender.mockResolvedValue({ svg: '<svg>diagram</svg>' });

    render(<MermaidBlock content="graph TD; A-->B;" />);

    await waitFor(() => {
      const container = document.querySelector('[data-testid="mermaid-diagram"]');
      expect(container).toBeDefined();
      expect(container?.innerHTML).toContain('<svg>diagram</svg>');
    });
  });

  it('shows error message for invalid mermaid syntax', async () => {
    mockRender.mockRejectedValue(new Error('Parse error'));

    render(<MermaidBlock content="invalid syntax!!!" />);

    await waitFor(() => {
      expect(screen.getByText(/failed to render diagram/i)).toBeDefined();
    });
  });

  it('handles empty content gracefully', () => {
    const { container } = render(<MermaidBlock content="" />);
    expect(container.textContent).toBe('');
  });
});
