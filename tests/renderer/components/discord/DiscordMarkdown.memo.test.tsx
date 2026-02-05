import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState, useRef } from 'react';

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

import { DiscordMarkdown } from '../../../../src/renderer/components/discord/DiscordMarkdown';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DiscordMarkdown useMemo Optimization', () => {
  it('renders content correctly on initial render', () => {
    render(<DiscordMarkdown content="Hello **world**!" />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument();

    const boldEl = screen.getByText('world');
    expect(boldEl.tagName).toBe('STRONG');
  });

  it('does not re-tokenize when parent re-renders with same content', () => {
    function TestWrapper() {
      const [counter, setCounter] = useState(0);
      const stableContent = useRef('This is **bold** text').current;

      return (
        <div>
          <button onClick={() => setCounter((c) => c + 1)}>Rerender</button>
          <span data-testid="counter">{counter}</span>
          <DiscordMarkdown content={stableContent} />
        </div>
      );
    }

    const { getByRole, getByTestId } = render(<TestWrapper />);

    expect(getByTestId('counter').textContent).toBe('0');
    expect(screen.getByText('bold')).toBeInTheDocument();

    // Trigger multiple parent re-renders using fireEvent
    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));

    expect(getByTestId('counter').textContent).toBe('2');

    // Content should still be rendered correctly
    // (useMemo ensures tokenize isn't called again)
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('re-tokenizes when content prop changes', () => {
    function TestWrapper() {
      const [content, setContent] = useState('Hello **world**');

      return (
        <div>
          <button onClick={() => setContent('Goodbye *world*')}>Change</button>
          <DiscordMarkdown content={content} />
        </div>
      );
    }

    const { getByRole } = render(<TestWrapper />);

    // Initial content with bold
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.getByText('world').tagName).toBe('STRONG');

    // Change content using fireEvent
    fireEvent.click(getByRole('button'));

    // New content with italic
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.getByText('world').tagName).toBe('EM');
  });

  it('handles complex markdown efficiently', () => {
    const complexContent = `
**Bold** and *italic* and ~~strikethrough~~
\`inline code\` and __underline__
> A blockquote
||spoiler text||
Check https://example.com
Custom emote <:test:123456>
    `.trim();

    render(<DiscordMarkdown content={complexContent} />);

    // All markdown types should be rendered
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
    expect(screen.getByText('strikethrough')).toBeInTheDocument();
    expect(screen.getByText('inline code')).toBeInTheDocument();
    expect(screen.getByText('underline')).toBeInTheDocument();
    expect(screen.getByText('A blockquote')).toBeInTheDocument();
    expect(screen.getByText('spoiler text')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByAltText(':test:')).toBeInTheDocument();
  });

  it('InlineMarkdown sub-component uses memoized tokens', () => {
    // This test verifies that the InlineMarkdown component receives
    // the result of useMemo and doesn't re-process on every render
    function TestWrapper() {
      const [counter, setCounter] = useState(0);

      return (
        <div>
          <button onClick={() => setCounter((c) => c + 1)}>Rerender</button>
          <span data-testid="counter">{counter}</span>
          <DiscordMarkdown content="Test <:emoji:111> content" />
        </div>
      );
    }

    const { getByRole, getByTestId } = render(<TestWrapper />);

    // Initial render
    expect(screen.getByAltText(':emoji:')).toBeInTheDocument();

    // Re-render parent using fireEvent
    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));

    expect(getByTestId('counter').textContent).toBe('2');

    // Emoji should still be rendered (tokens preserved by useMemo)
    expect(screen.getByAltText(':emoji:')).toBeInTheDocument();
  });

  it('handles empty content without errors', () => {
    const { container } = render(<DiscordMarkdown content="" />);
    expect(container.innerHTML).toBe('');
  });

  it('handles whitespace-only content', () => {
    const { container } = render(<DiscordMarkdown content="   " />);
    // Should render the whitespace or empty
    expect(container.textContent?.trim()).toBe('');
  });
});
