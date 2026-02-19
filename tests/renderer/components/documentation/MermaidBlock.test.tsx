import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock mermaid — use vi.hoisted so the variable is available in the hoisted vi.mock factory
const { mockRender, mockSanitize } = vi.hoisted(() => ({
  mockRender: vi.fn(),
  mockSanitize: vi.fn((html: string) => html),
}));
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: mockRender,
  },
}));
vi.mock('dompurify', () => ({
  default: {
    sanitize: mockSanitize,
  },
}));

import { MermaidBlock } from '../../../../src/renderer/components/documentation/MermaidBlock';

describe('MermaidBlock', () => {
  beforeEach(() => {
    mockRender.mockReset();
    mockSanitize.mockReset();
    mockSanitize.mockImplementation((html: string) => html);
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

  it('sanitizes SVG output before rendering', async () => {
    mockRender.mockResolvedValue({ svg: '<svg>safe-diagram</svg>' });

    render(<MermaidBlock content="graph TD; A-->B;" />);

    await waitFor(() => {
      expect(mockSanitize).toHaveBeenCalledWith('<svg>safe-diagram</svg>', {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['foreignObject'],
      });
    });
  });

  it('strips script tags from SVG', async () => {
    const maliciousSvg = '<svg><script>alert("xss")</script><rect/></svg>';
    mockRender.mockResolvedValue({ svg: maliciousSvg });
    mockSanitize.mockReturnValue('<svg><rect/></svg>');

    render(<MermaidBlock content="graph TD; A-->B;" />);

    await waitFor(() => {
      const container = document.querySelector('[data-testid="mermaid-diagram"]');
      expect(container?.innerHTML).toBe('<svg><rect/></svg>');
      expect(container?.innerHTML).not.toContain('<script>');
    });
  });

  it('strips event handler attributes from SVG', async () => {
    const maliciousSvg = '<svg onload="alert(\'xss\')"><rect/></svg>';
    mockRender.mockResolvedValue({ svg: maliciousSvg });
    mockSanitize.mockReturnValue('<svg><rect/></svg>');

    render(<MermaidBlock content="graph TD; A-->B;" />);

    await waitFor(() => {
      const container = document.querySelector('[data-testid="mermaid-diagram"]');
      expect(container?.innerHTML).toBe('<svg><rect/></svg>');
      expect(container?.innerHTML).not.toContain('onload');
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
