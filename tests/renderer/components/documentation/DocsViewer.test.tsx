import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock MermaidBlock
vi.mock('../../../../src/renderer/components/documentation/MermaidBlock', () => ({
  MermaidBlock: ({ content }: { content: string }) => (
    <div data-testid="mermaid-block">{content}</div>
  ),
}));

import { DocsViewer } from '../../../../src/renderer/components/documentation/DocsViewer';

describe('DocsViewer', () => {
  it('renders markdown content with headings and paragraphs', () => {
    const md = '# Hello\n\nThis is a paragraph.';
    render(<DocsViewer content={md} title="Test" loading={false} />);
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('This is a paragraph.')).toBeDefined();
  });

  it('delegates mermaid code blocks to MermaidBlock', () => {
    const md = '```mermaid\ngraph TD; A-->B;\n```';
    render(<DocsViewer content={md} title="Test" loading={false} />);
    expect(screen.getByTestId('mermaid-block')).toBeDefined();
    expect(screen.getByTestId('mermaid-block').textContent).toContain('graph TD; A-->B;');
  });

  it('renders regular code blocks normally', () => {
    const md = '```javascript\nconsole.log("hi");\n```';
    render(<DocsViewer content={md} title="Test" loading={false} />);
    expect(screen.getByText('console.log("hi");')).toBeDefined();
    // Should NOT have a mermaid-block
    expect(screen.queryByTestId('mermaid-block')).toBeNull();
  });

  it('shows placeholder when no content', () => {
    render(<DocsViewer content={null} title="" loading={false} />);
    expect(screen.getByText(/select a document/i)).toBeDefined();
  });

  it('shows loading state', () => {
    render(<DocsViewer content={null} title="" loading={true} />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('renders the document title', () => {
    render(<DocsViewer content="# Heading" title="My Document" loading={false} />);
    expect(screen.getByText('My Document')).toBeDefined();
  });
});
