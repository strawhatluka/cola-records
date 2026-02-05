import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

import { MessageItem } from '../../../../src/renderer/components/discord/MessageItem';
import { DiscordMarkdown } from '../../../../src/renderer/components/discord/DiscordMarkdown';
import { EmbedRenderer } from '../../../../src/renderer/components/discord/EmbedRenderer';
import { AttachmentRenderer } from '../../../../src/renderer/components/discord/AttachmentRenderer';
import { ReactionBar } from '../../../../src/renderer/components/discord/ReactionBar';
import {
  createMockDiscordMessage,
  createMockDiscordUser,
  createMockDiscordAttachment,
  createMockDiscordEmbed,
  createMockDiscordReaction,
} from '../../../mocks/factories';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Discord Components Image Lazy Loading', () => {
  describe('MessageItem', () => {
    const defaultProps = () => ({
      currentUserId: '999',
      onReactionToggle: vi.fn(),
      onReply: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onEmojiPick: vi.fn(),
    });

    it('avatar image has loading="lazy"', () => {
      const author = createMockDiscordUser({ id: '111222333', avatar: 'abc123', globalName: 'Test User' });
      const message = createMockDiscordMessage({ author });

      render(<MessageItem message={message} {...defaultProps()} />);

      const avatar = screen.getByAltText('Test User');
      expect(avatar).toHaveAttribute('loading', 'lazy');
    });

    it('sticker image has loading="lazy"', () => {
      const message = createMockDiscordMessage({
        stickerItems: [{ id: 'sticker_1', name: 'Test Sticker', formatType: 1 }],
      });

      render(<MessageItem message={message} {...defaultProps()} />);

      const sticker = screen.getByAltText('Test Sticker');
      expect(sticker).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('DiscordMarkdown', () => {
    it('custom emote images have loading="lazy"', () => {
      render(<DiscordMarkdown content="Look <:pepehappy:123456>" />);

      const emote = screen.getByAltText(':pepehappy:');
      expect(emote).toHaveAttribute('loading', 'lazy');
    });

    it('animated emote images have loading="lazy"', () => {
      render(<DiscordMarkdown content="Look <a:dancing:789012>" />);

      const emote = screen.getByAltText(':dancing:');
      expect(emote).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('EmbedRenderer', () => {
    it('thumbnail image has loading="lazy"', () => {
      const embed = createMockDiscordEmbed({
        title: 'Test Embed',
        thumbnail: { url: 'https://example.com/thumb.png', width: 100, height: 100, proxyUrl: '' },
      });

      const { container } = render(<EmbedRenderer embed={embed} />);

      // Images with alt="" are decorative and have role="presentation", use querySelectorAll
      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThan(0);
      images.forEach((img) => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });

    it('main image has loading="lazy"', () => {
      const embed = createMockDiscordEmbed({
        title: 'Test Embed',
        image: { url: 'https://example.com/image.png', width: 400, height: 300, proxyUrl: '' },
      });

      const { container } = render(<EmbedRenderer embed={embed} />);

      // Images with alt="" are decorative and have role="presentation", use querySelectorAll
      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThan(0);
      images.forEach((img) => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });

    it('author icon has loading="lazy"', () => {
      const embed = createMockDiscordEmbed({
        title: 'Test Embed',
        author: { name: 'Author', url: null, iconUrl: 'https://example.com/icon.png' },
      });

      const { container } = render(<EmbedRenderer embed={embed} />);

      // Author icon uses alt="" so is decorative, use querySelectorAll
      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThan(0);
      images.forEach((img) => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });

  describe('AttachmentRenderer', () => {
    it('image attachment has loading="lazy"', () => {
      const attachment = createMockDiscordAttachment({
        filename: 'screenshot.png',
        contentType: 'image/png',
        proxyUrl: 'https://media.discordapp.net/attachments/1/2/screenshot.png',
      });

      render(<AttachmentRenderer attachment={attachment} />);

      const img = screen.getByAltText('screenshot.png');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('ReactionBar', () => {
    const defaultProps = () => ({
      onReactionToggle: vi.fn(),
      onOpenEmojiPicker: vi.fn(),
    });

    it('custom emoji reaction images have loading="lazy"', () => {
      const reaction = createMockDiscordReaction({
        emoji: { id: '123456', name: 'custom_emoji' },
        count: 3,
        me: false,
      });

      render(<ReactionBar reactions={[reaction]} {...defaultProps()} />);

      // ReactionBar uses alt={reaction.emoji.name} without colons
      const emoji = screen.getByAltText('custom_emoji');
      expect(emoji).toHaveAttribute('loading', 'lazy');
    });
  });
});
