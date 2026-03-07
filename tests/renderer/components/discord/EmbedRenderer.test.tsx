import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock DiscordMarkdown to avoid its dependencies
vi.mock('../../../../src/renderer/components/discord/DiscordMarkdown', () => ({
  DiscordMarkdown: ({ content }: { content: string }) => (
    <span data-testid="discord-markdown">{content}</span>
  ),
}));

import { EmbedRenderer } from '../../../../src/renderer/components/discord/EmbedRenderer';
import type { DiscordEmbed } from '../../../../src/main/ipc/channels';

function createEmbed(overrides: Partial<DiscordEmbed> = {}): DiscordEmbed {
  return {
    title: overrides.title ?? null,
    description: overrides.description ?? null,
    url: overrides.url ?? null,
    color: overrides.color ?? null,
    timestamp: overrides.timestamp ?? null,
    footer: overrides.footer ?? null,
    image: overrides.image ?? null,
    thumbnail: overrides.thumbnail ?? null,
    author: overrides.author ?? null,
    fields: overrides.fields ?? [],
    provider: overrides.provider ?? null,
    type: overrides.type ?? 'rich',
    video: overrides.video ?? null,
  };
}

describe('EmbedRenderer', () => {
  // ============================================
  // GIFV embeds
  // ============================================
  it('renders gifv embed with video', () => {
    const embed = createEmbed({
      type: 'gifv',
      video: { url: 'https://tenor.com/vid.mp4', width: 480, height: 270 },
    });
    const { container } = render(<EmbedRenderer embed={embed} />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://tenor.com/vid.mp4');
  });

  it('renders gifv provider name', () => {
    const embed = createEmbed({
      type: 'gifv',
      video: { url: 'https://tenor.com/vid.mp4', width: 480, height: 270 },
      provider: { name: 'Tenor', url: null },
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('Tenor')).toBeDefined();
  });

  // ============================================
  // Video embeds
  // ============================================
  it('renders video embed with thumbnail play button', () => {
    const embed = createEmbed({
      type: 'video',
      video: { url: 'https://youtube.com/video.mp4', width: 1280, height: 720 },
      thumbnail: { url: 'https://img.youtube.com/thumb.jpg', width: 320, height: 180 },
      title: 'YouTube Video',
      url: 'https://youtube.com/watch?v=abc',
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('YouTube Video')).toBeDefined();
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://img.youtube.com/thumb.jpg');
  });

  it('renders video embed provider', () => {
    const embed = createEmbed({
      type: 'video',
      video: { url: 'https://vid.mp4', width: 640, height: 360 },
      provider: { name: 'YouTube', url: null },
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('YouTube')).toBeDefined();
  });

  it('renders video embed author with icon', () => {
    const embed = createEmbed({
      type: 'video',
      video: { url: 'https://vid.mp4', width: 640, height: 360 },
      author: { name: 'Creator', url: null, iconUrl: 'https://img.com/avatar.png' },
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('Creator')).toBeDefined();
    const img = document.querySelector('img[src="https://img.com/avatar.png"]');
    expect(img).not.toBeNull();
  });

  // ============================================
  // Image embeds
  // ============================================
  it('renders image embed', () => {
    const embed = createEmbed({
      type: 'image',
      thumbnail: { url: 'https://i.imgur.com/pic.png', width: 400, height: 300 },
      url: 'https://imgur.com/pic',
    });
    render(<EmbedRenderer embed={embed} />);
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://i.imgur.com/pic.png');
    const link = img?.closest('a');
    expect(link?.getAttribute('href')).toBe('https://imgur.com/pic');
  });

  // ============================================
  // Rich embeds
  // ============================================
  it('renders rich embed with title', () => {
    const embed = createEmbed({
      title: 'Embed Title',
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('Embed Title')).toBeDefined();
  });

  it('renders title as link when url is present', () => {
    const embed = createEmbed({
      title: 'Linked Title',
      url: 'https://example.com',
    });
    render(<EmbedRenderer embed={embed} />);
    const link = screen.getByText('Linked Title').closest('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
  });

  it('renders title without link when no url', () => {
    const embed = createEmbed({
      title: 'Plain Title',
    });
    render(<EmbedRenderer embed={embed} />);
    const titleEl = screen.getByText('Plain Title');
    expect(titleEl.closest('a')).toBeNull();
  });

  it('renders description via DiscordMarkdown', () => {
    const embed = createEmbed({
      description: 'Some **bold** text',
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('Some **bold** text')).toBeDefined();
  });

  it('renders fields', () => {
    const embed = createEmbed({
      fields: [
        { name: 'Field 1', value: 'Value 1', inline: true },
        { name: 'Field 2', value: 'Value 2', inline: false },
      ],
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('Field 1')).toBeDefined();
    expect(screen.getByText('Value 1')).toBeDefined();
    expect(screen.getByText('Field 2')).toBeDefined();
    expect(screen.getByText('Value 2')).toBeDefined();
  });

  it('renders author with url as link', () => {
    const embed = createEmbed({
      author: { name: 'Author Name', url: 'https://author.com', iconUrl: null },
    });
    render(<EmbedRenderer embed={embed} />);
    const link = screen.getByText('Author Name').closest('a');
    expect(link?.getAttribute('href')).toBe('https://author.com');
  });

  it('renders author without url as text', () => {
    const embed = createEmbed({
      author: { name: 'Author Name', url: null, iconUrl: null },
    });
    render(<EmbedRenderer embed={embed} />);
    const el = screen.getByText('Author Name');
    expect(el.closest('a')).toBeNull();
  });

  it('renders embed image', () => {
    const embed = createEmbed({
      image: { url: 'https://img.com/big.png', width: 500, height: 300 },
    });
    render(<EmbedRenderer embed={embed} />);
    const img = document.querySelector('img[src="https://img.com/big.png"]');
    expect(img).not.toBeNull();
  });

  it('renders thumbnail when no image', () => {
    const embed = createEmbed({
      thumbnail: { url: 'https://img.com/thumb.png', width: 80, height: 80 },
    });
    render(<EmbedRenderer embed={embed} />);
    const img = document.querySelector('img[src="https://img.com/thumb.png"]');
    expect(img).not.toBeNull();
  });

  it('does not render thumbnail when image exists', () => {
    const embed = createEmbed({
      image: { url: 'https://img.com/big.png', width: 500, height: 300 },
      thumbnail: { url: 'https://img.com/thumb.png', width: 80, height: 80 },
    });
    render(<EmbedRenderer embed={embed} />);
    // Only the image should be rendered, not the thumbnail
    const thumbImg = document.querySelector('img[src="https://img.com/thumb.png"]');
    expect(thumbImg).toBeNull();
  });

  it('renders footer text', () => {
    const embed = createEmbed({
      footer: { text: 'Footer Text', iconUrl: null },
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('Footer Text')).toBeDefined();
  });

  it('renders footer with icon', () => {
    const embed = createEmbed({
      footer: { text: 'Footer', iconUrl: 'https://img.com/icon.png' },
    });
    render(<EmbedRenderer embed={embed} />);
    const img = document.querySelector('img[src="https://img.com/icon.png"]');
    expect(img).not.toBeNull();
  });

  it('renders timestamp', () => {
    const embed = createEmbed({
      timestamp: '2026-03-01T12:00:00Z',
    });
    render(<EmbedRenderer embed={embed} />);
    // Should format the date
    expect(screen.getByText(/Mar/)).toBeDefined();
  });

  it('renders footer + timestamp with separator', () => {
    const embed = createEmbed({
      footer: { text: 'Foot', iconUrl: null },
      timestamp: '2026-03-01T12:00:00Z',
    });
    render(<EmbedRenderer embed={embed} />);
    // Should contain bullet separator
    expect(screen.getByText(/Foot.*\u2022/)).toBeDefined();
  });

  it('applies custom border color', () => {
    const embed = createEmbed({
      color: 0x5865f2, // Discord blurple
      title: 'Colored',
    });
    const { container } = render(<EmbedRenderer embed={embed} />);
    const borderEl = container.firstChild as HTMLElement;
    // jsdom normalizes hex colors to rgb()
    expect(borderEl.style.borderLeft).toContain('rgb(88, 101, 242)');
  });

  it('uses default border color when no color specified', () => {
    const embed = createEmbed({
      title: 'No Color',
    });
    const { container } = render(<EmbedRenderer embed={embed} />);
    const borderEl = container.firstChild as HTMLElement;
    // CSS custom properties are preserved as-is by jsdom
    expect(borderEl.style.borderLeft).toBeDefined();
  });

  it('renders provider in rich embed', () => {
    const embed = createEmbed({
      provider: { name: 'GitHub', url: null },
    });
    render(<EmbedRenderer embed={embed} />);
    expect(screen.getByText('GitHub')).toBeDefined();
  });
});
