import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

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

import { EmojiPicker } from '../../../../src/renderer/components/discord/EmojiPicker';
import { useDiscordStore } from '../../../../src/renderer/stores/useDiscordStore';
import { createMockDiscordEmoji } from '../../../mocks/factories';

describe('EmojiPicker Custom Emoji Format', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up Discord store with custom emojis (static and animated)
    useDiscordStore.setState({
      connected: true,
      selectedGuildId: 'guild_1',
      guilds: [{ id: 'guild_1', name: 'Test Guild', icon: null, ownerId: '1', channels: [] }],
      guildEmojis: {
        guild_1: [
          createMockDiscordEmoji({
            id: '1458169000197361738',
            name: 'purpleheart',
            animated: false,
            guildId: 'guild_1',
          }),
          createMockDiscordEmoji({
            id: '9876543210',
            name: 'animated_wave',
            animated: true,
            guildId: 'guild_1',
          }),
        ],
      },
    });
  });

  describe('Message content format (forReaction=false)', () => {
    it('formats static custom emoji as <:name:id> for message content', () => {
      const onSelect = vi.fn();
      render(
        <EmojiPicker
          onSelect={onSelect}
          onClose={() => {}}
          customEmojis={useDiscordStore.getState().guildEmojis['guild_1']}
          guilds={useDiscordStore.getState().guilds}
          forReaction={false}
        />
      );

      // Find and click the custom emoji button
      const emojiButton = screen.getByTitle(':purpleheart:');
      fireEvent.click(emojiButton);

      // Should format as <:name:id> for message content
      expect(onSelect).toHaveBeenCalledWith('<:purpleheart:1458169000197361738>');
    });

    it('formats animated custom emoji as <a:name:id> for message content', () => {
      const onSelect = vi.fn();
      render(
        <EmojiPicker
          onSelect={onSelect}
          onClose={() => {}}
          customEmojis={useDiscordStore.getState().guildEmojis['guild_1']}
          guilds={useDiscordStore.getState().guilds}
          forReaction={false}
        />
      );

      // Find and click the animated emoji button
      const emojiButton = screen.getByTitle(':animated_wave:');
      fireEvent.click(emojiButton);

      // Should format as <a:name:id> for animated emojis in message content
      expect(onSelect).toHaveBeenCalledWith('<a:animated_wave:9876543210>');
    });

    it('defaults to message content format when forReaction is not specified', () => {
      const onSelect = vi.fn();
      render(
        <EmojiPicker
          onSelect={onSelect}
          onClose={() => {}}
          customEmojis={useDiscordStore.getState().guildEmojis['guild_1']}
          guilds={useDiscordStore.getState().guilds}
        />
      );

      // Find and click the custom emoji button
      const emojiButton = screen.getByTitle(':purpleheart:');
      fireEvent.click(emojiButton);

      // Should default to message content format <:name:id>
      expect(onSelect).toHaveBeenCalledWith('<:purpleheart:1458169000197361738>');
    });
  });

  describe('Reaction API format (forReaction=true)', () => {
    it('formats static custom emoji as name:id for reaction API', () => {
      const onSelect = vi.fn();
      render(
        <EmojiPicker
          onSelect={onSelect}
          onClose={() => {}}
          customEmojis={useDiscordStore.getState().guildEmojis['guild_1']}
          guilds={useDiscordStore.getState().guilds}
          forReaction={true}
        />
      );

      // Find and click the custom emoji button
      const emojiButton = screen.getByTitle(':purpleheart:');
      fireEvent.click(emojiButton);

      // Should format as name:id for reaction API (no angle brackets)
      expect(onSelect).toHaveBeenCalledWith('purpleheart:1458169000197361738');
    });

    it('formats animated custom emoji as name:id for reaction API', () => {
      const onSelect = vi.fn();
      render(
        <EmojiPicker
          onSelect={onSelect}
          onClose={() => {}}
          customEmojis={useDiscordStore.getState().guildEmojis['guild_1']}
          guilds={useDiscordStore.getState().guilds}
          forReaction={true}
        />
      );

      // Find and click the animated emoji button
      const emojiButton = screen.getByTitle(':animated_wave:');
      fireEvent.click(emojiButton);

      // Reaction API uses same format for animated emojis (name:id, no <a:>)
      expect(onSelect).toHaveBeenCalledWith('animated_wave:9876543210');
    });
  });

  describe('Standard Unicode emojis', () => {
    it('passes unicode emojis unchanged regardless of forReaction setting', () => {
      const onSelect = vi.fn();
      render(
        <EmojiPicker
          onSelect={onSelect}
          onClose={() => {}}
          customEmojis={[]}
          guilds={[]}
          forReaction={false}
        />
      );

      // Find and click a standard emoji (thumbs up from Frequently Used)
      // Use getAllByText since the emoji may appear multiple times
      const thumbsUpButtons = screen.getAllByText('\u{1F44D}');
      fireEvent.click(thumbsUpButtons[0]);

      // Standard emojis should pass through as unicode characters
      expect(onSelect).toHaveBeenCalledWith('\u{1F44D}');
    });
  });
});
