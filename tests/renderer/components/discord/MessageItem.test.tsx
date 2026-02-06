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

import { MessageItem } from '../../../../src/renderer/components/discord/MessageItem';
import {
  createMockDiscordMessage,
  createMockDiscordUser,
  createMockDiscordAttachment,
  createMockDiscordEmbed,
  createMockDiscordReaction,
} from '../../../mocks/factories';

const defaultProps = () => ({
  currentUserId: '999',
  onReactionToggle: vi.fn(),
  onReply: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onEmojiPick: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageItem', () => {
  it('renders message content with the author display name', () => {
    const message = createMockDiscordMessage({
      content: 'Hello everyone!',
      author: createMockDiscordUser({ globalName: 'John Doe', username: 'johnd' }),
    });

    render(<MessageItem message={message} {...defaultProps()} />);

    expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('renders the author avatar image with CDN URL', () => {
    const author = createMockDiscordUser({
      id: '111222333',
      avatar: 'abc123',
      globalName: 'Avatar User',
    });
    const message = createMockDiscordMessage({ author });

    render(<MessageItem message={message} {...defaultProps()} />);

    const avatar = screen.getByAltText('Avatar User');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/avatars/111222333/abc123.png?size=64'
    );
  });

  it('renders the message timestamp', () => {
    // Use a fixed timestamp for "today" to get the "Today at HH:MM" format
    const now = new Date();
    const timestamp = now.toISOString();
    const message = createMockDiscordMessage({ timestamp });

    render(<MessageItem message={message} {...defaultProps()} />);

    // The formatted time should contain "Today at"
    const timeEl = screen.getByText(/Today at/);
    expect(timeEl).toBeInTheDocument();
  });

  it('renders image attachments as <img> elements', () => {
    const attachment = createMockDiscordAttachment({
      filename: 'screenshot.png',
      contentType: 'image/png',
      proxyUrl: 'https://media.discordapp.net/attachments/1/2/screenshot.png',
    });
    const message = createMockDiscordMessage({ attachments: [attachment] });

    render(<MessageItem message={message} {...defaultProps()} />);

    const img = screen.getByAltText('screenshot.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      'https://media.discordapp.net/attachments/1/2/screenshot.png'
    );
  });

  it('renders embeds with title and description', () => {
    const embed = createMockDiscordEmbed({
      title: 'Embed Title',
      description: 'Embed body text',
      url: 'https://example.com',
    });
    const message = createMockDiscordMessage({ embeds: [embed] });

    render(<MessageItem message={message} {...defaultProps()} />);

    const titleLink = screen.getByText('Embed Title');
    expect(titleLink).toBeInTheDocument();
    expect(titleLink.closest('a')).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByText('Embed body text')).toBeInTheDocument();
  });

  it('renders the reaction bar with emoji and count', () => {
    const reaction = createMockDiscordReaction({
      emoji: { id: null, name: '🔥' },
      count: 5,
      me: false,
    });
    const message = createMockDiscordMessage({ reactions: [reaction] });

    render(<MessageItem message={message} {...defaultProps()} />);

    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('falls back to username when globalName is null', () => {
    const author = createMockDiscordUser({ globalName: null, username: 'fallback_user' });
    const message = createMockDiscordMessage({ author });

    render(<MessageItem message={message} {...defaultProps()} />);

    expect(screen.getByText('fallback_user')).toBeInTheDocument();
  });

  it('renders system messages for non-standard message types', () => {
    const author = createMockDiscordUser({ globalName: 'Sys User' });
    const message = createMockDiscordMessage({ type: 7, author });

    render(<MessageItem message={message} {...defaultProps()} />);

    expect(screen.getByText(/joined the server/)).toBeInTheDocument();
  });
});
