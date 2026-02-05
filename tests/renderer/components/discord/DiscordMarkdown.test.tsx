import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

describe('DiscordMarkdown', () => {
  it('renders plain text unchanged', () => {
    render(<DiscordMarkdown content="Hello, world!" />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders bold text wrapped in <strong>', () => {
    render(<DiscordMarkdown content="This is **bold** text" />);
    const boldEl = screen.getByText('bold');
    expect(boldEl.tagName).toBe('STRONG');
  });

  it('renders italic text wrapped in <em>', () => {
    render(<DiscordMarkdown content="This is *italic* text" />);
    const italicEl = screen.getByText('italic');
    expect(italicEl.tagName).toBe('EM');
  });

  it('renders strikethrough text wrapped in <s>', () => {
    render(<DiscordMarkdown content="This is ~~strikethrough~~ text" />);
    const strikeEl = screen.getByText('strikethrough');
    expect(strikeEl.tagName).toBe('S');
  });

  it('renders underline text wrapped in <u>', () => {
    render(<DiscordMarkdown content="This is __underline__ text" />);
    const underlineEl = screen.getByText('underline');
    expect(underlineEl.tagName).toBe('U');
  });

  it('renders inline code in a <code> element', () => {
    render(<DiscordMarkdown content="Use `console.log` here" />);
    const codeEl = screen.getByText('console.log');
    expect(codeEl.tagName).toBe('CODE');
  });

  it('renders fenced code blocks in <pre><code>', () => {
    const content = '```js\nconst x = 1;\n```';
    const { container } = render(<DiscordMarkdown content={content} />);
    const preEl = container.querySelector('pre');
    expect(preEl).toBeInTheDocument();
    const codeEl = preEl!.querySelector('code');
    expect(codeEl).toBeInTheDocument();
    expect(codeEl!.textContent?.trim()).toBe('const x = 1;');
    expect(codeEl!.className).toContain('language-js');
  });

  it('renders blockquotes with a left border', () => {
    render(<DiscordMarkdown content="> This is a quote" />);
    const quoteEl = screen.getByText('This is a quote');
    expect(quoteEl.className).toContain('border-l-2');
  });

  it('renders spoiler text as a clickable button that reveals on click', () => {
    render(<DiscordMarkdown content="Secret: ||hidden text||" />);
    const spoilerEl = screen.getByRole('button');
    expect(spoilerEl.textContent).toBe('hidden text');
    // Before click, the spoiler should have text-transparent class
    expect(spoilerEl.className).toContain('text-transparent');
    fireEvent.click(spoilerEl);
    // After click, the text-transparent class should be removed
    expect(spoilerEl.className).not.toContain('text-transparent');
  });

  it('renders custom emotes as images with CDN URL', () => {
    render(<DiscordMarkdown content="Look <:pepehappy:123456>" />);
    const img = screen.getByAltText(':pepehappy:');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://cdn.discordapp.com/emojis/123456.png');
  });

  it('renders URLs as clickable links with target _blank', () => {
    render(<DiscordMarkdown content="Visit https://example.com today" />);
    const link = screen.getByText('https://example.com');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('returns null for empty content', () => {
    const { container } = render(<DiscordMarkdown content="" />);
    expect(container.innerHTML).toBe('');
  });
});
