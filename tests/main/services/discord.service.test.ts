import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  okResponse,
  noContentResponse,
  rateLimitResponse,
  serverErrorResponse,
} from '../../mocks/fetch-helpers';

vi.mock('../../../src/main/services/secure-storage.service', () => ({
  secureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    getSetting: vi.fn(),
  },
}));

import { DiscordService } from '../../../src/main/services/discord.service';
import { secureStorage } from '../../../src/main/services/secure-storage.service';
import { database } from '../../../src/main/database';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

let service: DiscordService;
const mockFetch = vi.fn();

function setupToken(token = 'mock-token') {
  vi.mocked(secureStorage).getItem.mockResolvedValue(token);
}

function rawUser(overrides: Record<string, unknown> = {}) {
  return {
    id: '123',
    username: 'testuser',
    discriminator: '0',
    global_name: 'Test User',
    avatar: 'abc123',
    ...overrides,
  };
}

function rawMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_1',
    content: 'Hello',
    author: rawUser(),
    timestamp: '2026-01-01T00:00:00Z',
    edited_timestamp: null,
    attachments: [],
    embeds: [],
    reactions: [],
    referenced_message: null,
    mention_everyone: false,
    mentions: [],
    pinned: false,
    type: 0,
    sticker_items: [],
    poll: null,
    ...overrides,
  };
}

function rawChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ch_1',
    name: 'general',
    type: 0,
    parent_id: 'cat_1',
    position: 1,
    topic: 'General chat',
    available_tags: [],
    ...overrides,
  };
}

function rawThread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread_1',
    name: 'My Thread',
    parent_id: 'ch_1',
    owner_id: '123',
    message_count: 5,
    thread_metadata: {
      create_timestamp: '2026-01-01T00:00:00Z',
      archive_timestamp: '2026-02-01T00:00:00Z',
      archived: false,
      locked: false,
    },
    last_message_id: 'msg_99',
    applied_tags: ['tag_1'],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  service = new DiscordService();
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DiscordService', () => {
  // ──────────────────────────────────────────────────────────────
  // Connection & Auth
  // ──────────────────────────────────────────────────────────────
  describe('Connection & Auth', () => {
    it('isConnected returns true when secureStorage has token', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue('stored-token');

      const result = await service.isConnected();

      expect(result).toBe(true);
      expect(secureStorage.getItem).toHaveBeenCalledWith('discord_token');
    });

    it('isConnected returns true when database has token and syncs to secureStorage', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue(null);
      vi.mocked(database).getSetting.mockReturnValue('db-token');

      const result = await service.isConnected();

      expect(result).toBe(true);
      expect(database.getSetting).toHaveBeenCalledWith('discordToken');
      expect(secureStorage.setItem).toHaveBeenCalledWith('discord_token', 'db-token');
    });

    it('isConnected returns false when no token anywhere', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue(null);
      vi.mocked(database).getSetting.mockReturnValue(null);

      const result = await service.isConnected();

      expect(result).toBe(false);
    });

    it('connect validates token via GET /users/@me', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue('valid-token');
      mockFetch.mockResolvedValue(okResponse(rawUser()));

      const user = await service.connect();

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/users/@me`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'valid-token' }),
        })
      );
      expect(user).toEqual({
        id: '123',
        username: 'testuser',
        discriminator: '0',
        globalName: 'Test User',
        avatar: 'abc123',
      });
      expect(secureStorage.setItem).toHaveBeenCalledWith('discord_token', 'valid-token');
    });

    it('connect throws when no token configured', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue(null);
      vi.mocked(database).getSetting.mockReturnValue(null);

      await expect(service.connect()).rejects.toThrow(
        'Discord token not configured. Set it in Settings > API.'
      );
    });

    it('disconnect removes token from secureStorage', async () => {
      await service.disconnect();

      expect(secureStorage.removeItem).toHaveBeenCalledWith('discord_token');
    });

    it('initialize resolves as no-op', async () => {
      await expect(service.initialize()).resolves.toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // User & Guilds
  // ──────────────────────────────────────────────────────────────
  describe('User & Guilds', () => {
    it('getUser returns mapped user on success', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawUser()));

      const user = await service.getUser();

      expect(user).toEqual({
        id: '123',
        username: 'testuser',
        discriminator: '0',
        globalName: 'Test User',
        avatar: 'abc123',
      });
    });

    it('getUser returns null on error', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      const user = await service.getUser();

      expect(user).toBeNull();
    });

    it('getGuilds returns mapped guild list', async () => {
      setupToken();
      const rawGuilds = [
        { id: 'g_1', name: 'Guild One', icon: 'icon1', owner_id: 'owner_1' },
        { id: 'g_2', name: 'Guild Two', icon: null, owner_id: 'owner_2' },
      ];
      mockFetch.mockResolvedValue(okResponse(rawGuilds));

      const guilds = await service.getGuilds();

      expect(guilds).toEqual([
        { id: 'g_1', name: 'Guild One', icon: 'icon1', ownerId: 'owner_1', channels: [] },
        { id: 'g_2', name: 'Guild Two', icon: null, ownerId: 'owner_2', channels: [] },
      ]);
    });

    it('getGuildChannels returns mapped channels with availableTags', async () => {
      setupToken();
      const rawChannels = [
        rawChannel({
          available_tags: [
            { id: 'tag_1', name: 'Bug', moderated: true, emoji_id: 'e1', emoji_name: 'bug' },
          ],
        }),
      ];
      mockFetch.mockResolvedValue(okResponse(rawChannels));

      const channels = await service.getGuildChannels('g_1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/guilds/g_1/channels`,
        expect.any(Object)
      );
      expect(channels).toEqual([
        {
          id: 'ch_1',
          name: 'general',
          type: 0,
          parentId: 'cat_1',
          position: 1,
          topic: 'General chat',
          availableTags: [
            { id: 'tag_1', name: 'Bug', moderated: true, emojiId: 'e1', emojiName: 'bug' },
          ],
        },
      ]);
    });

    it('getGuildEmojis returns mapped emojis with guildId', async () => {
      setupToken();
      const rawEmojis = [
        { id: 'emoji_1', name: 'cool', animated: true },
        { id: 'emoji_2', name: 'nice', animated: false },
      ];
      mockFetch.mockResolvedValue(okResponse(rawEmojis));

      const emojis = await service.getGuildEmojis('g_1');

      expect(emojis).toEqual([
        { id: 'emoji_1', name: 'cool', animated: true, guildId: 'g_1' },
        { id: 'emoji_2', name: 'nice', animated: false, guildId: 'g_1' },
      ]);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // DMs
  // ──────────────────────────────────────────────────────────────
  describe('DMs', () => {
    it('getDMChannels returns mapped DM channels with recipients', async () => {
      setupToken();
      const rawDMs = [
        {
          id: 'dm_1',
          type: 1,
          recipients: [rawUser({ id: '456', username: 'friend' })],
          last_message_id: 'msg_50',
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawDMs));

      const dms = await service.getDMChannels();

      expect(dms).toEqual([
        {
          id: 'dm_1',
          type: 1,
          recipients: [
            {
              id: '456',
              username: 'friend',
              discriminator: '0',
              globalName: 'Test User',
              avatar: 'abc123',
            },
          ],
          lastMessageId: 'msg_50',
        },
      ]);
    });

    it('createDM sends recipient_id and returns channel', async () => {
      setupToken();
      const rawDM = {
        id: 'dm_2',
        type: 1,
        recipients: [rawUser({ id: '789' })],
        last_message_id: null,
      };
      mockFetch.mockResolvedValue(okResponse(rawDM));

      const dm = await service.createDM('789');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/users/@me/channels`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ recipient_id: '789' }),
        })
      );
      expect(dm.id).toBe('dm_2');
      expect(dm.recipients[0].id).toBe('789');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Messages
  // ──────────────────────────────────────────────────────────────
  describe('Messages', () => {
    it('getMessages passes limit and before params', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse([rawMessage()]));

      await service.getMessages('ch_1', 'msg_0', 25);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/channels/ch_1/messages?');
      expect(calledUrl).toContain('limit=25');
      expect(calledUrl).toContain('before=msg_0');
    });

    it('getMessages maps message with all fields including attachments, embeds, reactions, stickerItems, poll', async () => {
      setupToken();
      const fullMessage = rawMessage({
        attachments: [
          {
            id: 'att_1',
            filename: 'photo.png',
            url: 'https://cdn.discord.com/photo.png',
            proxy_url: 'https://proxy.discord.com/photo.png',
            size: 1024,
            content_type: 'image/png',
            width: 800,
            height: 600,
          },
        ],
        embeds: [
          {
            title: 'Embed Title',
            description: 'Embed Desc',
            url: 'https://example.com',
            color: 0x00ff00,
            type: 'rich',
            thumbnail: { url: 'https://thumb.com/img.png', width: 100, height: 100 },
            image: { url: 'https://img.com/big.png', width: 400, height: 300 },
            video: { url: 'https://vid.com/v.mp4', width: 1920, height: 1080 },
            author: {
              name: 'Author',
              url: 'https://author.com',
              icon_url: 'https://icon.com/a.png',
            },
            footer: { text: 'Footer text', icon_url: 'https://icon.com/f.png' },
            timestamp: '2026-01-01T00:00:00Z',
            provider: { name: 'Provider', url: 'https://provider.com' },
            fields: [{ name: 'Field 1', value: 'Value 1', inline: true }],
          },
        ],
        reactions: [{ emoji: { id: null, name: 'thumbsup' }, count: 5, me: true }],
        sticker_items: [{ id: 'stk_1', name: 'Wave', format_type: 2 }],
        poll: {
          question: { text: 'Favorite color?' },
          answers: [
            { answer_id: 1, poll_media: { text: 'Red', emoji: { id: null, name: 'red_circle' } } },
          ],
          expiry: '2026-02-01T00:00:00Z',
          allow_multiselect: true,
          layout_type: 1,
          results: {
            is_finalized: false,
            answer_counts: [{ id: 1, count: 3, me_voted: true }],
          },
        },
      });
      mockFetch.mockResolvedValue(okResponse([fullMessage]));

      const messages = await service.getMessages('ch_1');

      expect(messages).toHaveLength(1);
      const msg = messages[0];

      // Attachments
      expect(msg.attachments).toEqual([
        {
          id: 'att_1',
          filename: 'photo.png',
          url: 'https://cdn.discord.com/photo.png',
          proxyUrl: 'https://proxy.discord.com/photo.png',
          size: 1024,
          contentType: 'image/png',
          width: 800,
          height: 600,
        },
      ]);

      // Embeds
      expect(msg.embeds).toHaveLength(1);
      expect(msg.embeds[0].title).toBe('Embed Title');
      expect(msg.embeds[0].author).toEqual({
        name: 'Author',
        url: 'https://author.com',
        iconUrl: 'https://icon.com/a.png',
      });
      expect(msg.embeds[0].footer).toEqual({
        text: 'Footer text',
        iconUrl: 'https://icon.com/f.png',
      });
      expect(msg.embeds[0].fields).toEqual([{ name: 'Field 1', value: 'Value 1', inline: true }]);

      // Reactions
      expect(msg.reactions).toEqual([
        { emoji: { id: null, name: 'thumbsup' }, count: 5, me: true },
      ]);

      // Sticker items
      expect(msg.stickerItems).toEqual([{ id: 'stk_1', name: 'Wave', formatType: 2 }]);

      // Poll
      expect(msg.poll).toBeTruthy();
      expect(msg.poll!.question.text).toBe('Favorite color?');
      expect(msg.poll!.allowMultiselect).toBe(true);
      expect(msg.poll!.results?.answerCounts).toEqual([{ id: 1, count: 3, meVoted: true }]);
    });

    it('sendMessage posts content to channel', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage({ content: 'Hi there' })));

      const msg = await service.sendMessage('ch_1', 'Hi there');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/messages`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Hi there' }),
        })
      );
      expect(msg.content).toBe('Hi there');
    });

    it('sendMessage with replyToId includes message_reference', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage()));

      await service.sendMessage('ch_1', 'Reply', 'msg_0');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/messages`,
        expect.objectContaining({
          body: JSON.stringify({
            content: 'Reply',
            message_reference: { message_id: 'msg_0' },
          }),
        })
      );
    });

    it('editMessage patches message content', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage({ content: 'Edited' })));

      const msg = await service.editMessage('ch_1', 'msg_1', 'Edited');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/messages/msg_1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ content: 'Edited' }),
        })
      );
      expect(msg.content).toBe('Edited');
    });

    it('deleteMessage deletes message', async () => {
      setupToken();
      mockFetch.mockResolvedValue(noContentResponse());

      await service.deleteMessage('ch_1', 'msg_1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/messages/msg_1`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('getPinnedMessages returns mapped messages', async () => {
      setupToken();
      mockFetch.mockResolvedValue(
        okResponse([rawMessage({ pinned: true }), rawMessage({ id: 'msg_2', pinned: true })])
      );

      const pins = await service.getPinnedMessages('ch_1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/pins`,
        expect.any(Object)
      );
      expect(pins).toHaveLength(2);
      expect(pins[0].pinned).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Reactions
  // ──────────────────────────────────────────────────────────────
  describe('Reactions', () => {
    it('addReaction uses PUT with encoded emoji', async () => {
      setupToken();
      mockFetch.mockResolvedValue(noContentResponse());

      await service.addReaction('ch_1', 'msg_1', 'thumbs_up');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/messages/msg_1/reactions/${encodeURIComponent('thumbs_up')}/@me`,
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('removeReaction uses apiDeleteNoBody without Content-Type header', async () => {
      setupToken();
      mockFetch.mockResolvedValue(noContentResponse());

      await service.removeReaction('ch_1', 'msg_1', 'wave');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe(
        `${DISCORD_API_BASE}/channels/ch_1/messages/msg_1/reactions/${encodeURIComponent('wave')}/@me`
      );

      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(calledOptions.method).toBe('DELETE');
      // apiDeleteNoBody only sends Authorization, no Content-Type
      expect(calledOptions.headers).toEqual({ Authorization: 'mock-token' });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Channel operations
  // ──────────────────────────────────────────────────────────────
  describe('Channel operations', () => {
    it('getChannel returns mapped channel', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawChannel()));

      const channel = await service.getChannel('ch_1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1`,
        expect.any(Object)
      );
      expect(channel).toEqual({
        id: 'ch_1',
        name: 'general',
        type: 0,
        parentId: 'cat_1',
        position: 1,
        topic: 'General chat',
        availableTags: [],
      });
    });

    it('triggerTyping posts to typing endpoint', async () => {
      setupToken();
      mockFetch.mockResolvedValue(noContentResponse());

      await service.triggerTyping('ch_1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/typing`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  // GIFs
  // ──────────────────────────────────────────────────────────────
  describe('GIFs', () => {
    it('searchGifs passes query params and maps results', async () => {
      setupToken();
      const rawGifs = [
        {
          url: 'https://gif.com/1.gif',
          preview: 'https://gif.com/1_preview.gif',
          width: 300,
          height: 200,
        },
        {
          url: 'https://gif.com/2.gif',
          gif_src: 'https://gif.com/2_src.gif',
          width: 250,
          height: 150,
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawGifs));

      const gifs = await service.searchGifs('funny cat');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/gifs/search?');
      expect(calledUrl).toContain('q=funny+cat');
      expect(calledUrl).toContain('media_format=gif');
      expect(calledUrl).toContain('provider=tenor');
      expect(calledUrl).toContain('locale=en-US');

      expect(gifs).toEqual([
        {
          url: 'https://gif.com/1.gif',
          preview: 'https://gif.com/1_preview.gif',
          width: 300,
          height: 200,
        },
        {
          url: 'https://gif.com/2.gif',
          preview: 'https://gif.com/2_src.gif',
          width: 250,
          height: 150,
        },
      ]);
    });

    it('getTrendingGifs returns mapped trending gifs', async () => {
      setupToken();
      const rawGifs = [{ url: 'https://gif.com/trending.gif', width: 400, height: 300 }];
      mockFetch.mockResolvedValue(okResponse(rawGifs));

      const gifs = await service.getTrendingGifs();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/gifs/trending?');
      expect(gifs).toEqual([
        {
          url: 'https://gif.com/trending.gif',
          preview: 'https://gif.com/trending.gif',
          width: 400,
          height: 300,
        },
      ]);
    });

    it('searchGifs returns empty array on error', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      const gifs = await service.searchGifs('anything');

      expect(gifs).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Stickers
  // ──────────────────────────────────────────────────────────────
  describe('Stickers', () => {
    it('getStickerPacks returns mapped packs with stickers', async () => {
      setupToken();
      const rawPacks = {
        sticker_packs: [
          {
            id: 'pack_1',
            name: 'Wumpus Pack',
            description: 'Fun stickers',
            banner_asset_id: 'banner_1',
            stickers: [
              {
                id: 'stk_1',
                name: 'Wumpus Wave',
                description: 'A waving wumpus',
                tags: 'wave,hello',
                format_type: 1,
                pack_id: 'pack_1',
                guild_id: null,
              },
            ],
          },
        ],
      };
      mockFetch.mockResolvedValue(okResponse(rawPacks));

      const packs = await service.getStickerPacks();

      expect(packs).toEqual([
        {
          id: 'pack_1',
          name: 'Wumpus Pack',
          description: 'Fun stickers',
          bannerAssetId: 'banner_1',
          stickers: [
            {
              id: 'stk_1',
              name: 'Wumpus Wave',
              description: 'A waving wumpus',
              tags: 'wave,hello',
              formatType: 1,
              packId: 'pack_1',
              guildId: null,
            },
          ],
        },
      ]);
    });

    it('getGuildStickers returns mapped stickers', async () => {
      setupToken();
      const rawStickers = [
        {
          id: 'stk_g1',
          name: 'Guild Sticker',
          description: null,
          tags: 'custom',
          format_type: 2,
          pack_id: null,
          guild_id: 'g_1',
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawStickers));

      const stickers = await service.getGuildStickers('g_1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/guilds/g_1/stickers`,
        expect.any(Object)
      );
      expect(stickers).toEqual([
        {
          id: 'stk_g1',
          name: 'Guild Sticker',
          description: null,
          tags: 'custom',
          formatType: 2,
          packId: null,
          guildId: 'g_1',
        },
      ]);
    });

    it('sendSticker sends sticker_ids array', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage()));

      await service.sendSticker('ch_1', 'stk_1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/messages`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sticker_ids: ['stk_1'] }),
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Polls
  // ──────────────────────────────────────────────────────────────
  describe('Polls', () => {
    it('createPoll sends correct poll structure', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage()));

      await service.createPoll('ch_1', 'Best language?', ['TypeScript', 'Rust', 'Go'], 24, true);

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/messages`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            poll: {
              question: { text: 'Best language?' },
              answers: [
                { poll_media: { text: 'TypeScript' } },
                { poll_media: { text: 'Rust' } },
                { poll_media: { text: 'Go' } },
              ],
              duration: 24,
              allow_multiselect: true,
              layout_type: 1,
            },
          }),
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Forum Threads
  // ──────────────────────────────────────────────────────────────
  describe('Forum Threads', () => {
    it('getForumThreads passes sort/filter/offset params', async () => {
      setupToken();
      const rawResponse = {
        threads: [rawThread()],
        has_more: true,
        total_results: 50,
      };
      mockFetch.mockResolvedValue(okResponse(rawResponse));

      const result = await service.getForumThreads(
        'ch_1',
        'g_1',
        'creation_time',
        'asc',
        ['tag_1', 'tag_2'],
        25
      );

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/channels/ch_1/threads/search?');
      expect(calledUrl).toContain('sort_by=creation_time');
      expect(calledUrl).toContain('sort_order=asc');
      expect(calledUrl).toContain('limit=25');
      expect(calledUrl).toContain('offset=25');
      expect(calledUrl).toContain('tag_ids=tag_1');
      expect(calledUrl).toContain('tag_ids=tag_2');

      expect(result.hasMore).toBe(true);
      expect(result.totalResults).toBe(50);
      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]).toEqual({
        id: 'thread_1',
        name: 'My Thread',
        parentId: 'ch_1',
        ownerId: '123',
        messageCount: 5,
        createdTimestamp: '2026-01-01T00:00:00Z',
        archiveTimestamp: '2026-02-01T00:00:00Z',
        archived: false,
        locked: false,
        lastMessageId: 'msg_99',
        appliedTags: ['tag_1'],
      });
    });

    it('getForumThreads falls back to guild active threads on error', async () => {
      setupToken();
      // First call (thread search) fails
      mockFetch.mockResolvedValueOnce(serverErrorResponse());
      // Second call (guild active threads) succeeds
      const activeThreads = {
        threads: [
          rawThread({ parent_id: 'ch_1' }),
          rawThread({ id: 'thread_other', parent_id: 'ch_other' }),
        ],
      };
      mockFetch.mockResolvedValueOnce(okResponse(activeThreads));

      const result = await service.getForumThreads('ch_1', 'g_1');

      // Should have called guild active threads endpoint
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondUrl = mockFetch.mock.calls[1][0] as string;
      expect(secondUrl).toContain('/guilds/g_1/threads/active');

      // Should only return threads matching parent_id
      expect(result.threads).toHaveLength(1);
      expect(result.threads[0].id).toBe('thread_1');
      expect(result.hasMore).toBe(false);
    });

    it('getForumThreads returns empty on double failure', async () => {
      setupToken();
      mockFetch.mockResolvedValueOnce(serverErrorResponse());
      mockFetch.mockResolvedValueOnce(serverErrorResponse());

      const result = await service.getForumThreads('ch_1', 'g_1');

      expect(result).toEqual({ threads: [], hasMore: false, totalResults: 0 });
    });

    it('createForumThread sends name, message content, and applied_tags', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawThread()));

      const thread = await service.createForumThread('ch_1', 'New Thread', 'Thread body', [
        'tag_1',
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/threads`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'New Thread',
            message: { content: 'Thread body' },
            applied_tags: ['tag_1'],
          }),
        })
      );
      expect(thread.name).toBe('My Thread');
    });

    it('getThreadMessages delegates to getMessages', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse([rawMessage()]));

      const messages = await service.getThreadMessages('thread_1', 'msg_0', 10);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/channels/thread_1/messages?');
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).toContain('before=msg_0');
      expect(messages).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Rate Limiting
  // ──────────────────────────────────────────────────────────────
  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rate limited (429) request retries after Retry-After delay', async () => {
      setupToken();
      mockFetch
        .mockResolvedValueOnce(rateLimitResponse(2))
        .mockResolvedValueOnce(okResponse(rawUser()));

      const promise = service.getUser();
      // Advance past the 2-second retry delay
      await vi.advanceTimersByTimeAsync(2000);

      const user = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(user).toBeTruthy();
      expect(user!.id).toBe('123');
    });

    it('rate limiting respects max 3 retries then returns 429 response', async () => {
      setupToken();
      // Return 429 four times (initial + 3 retries = 4 calls, but only 3 retries allowed)
      mockFetch
        .mockResolvedValueOnce(rateLimitResponse(1))
        .mockResolvedValueOnce(rateLimitResponse(1))
        .mockResolvedValueOnce(rateLimitResponse(1))
        .mockResolvedValueOnce(rateLimitResponse(1));

      let caughtError: Error | null = null;
      const promise = service.getGuilds().catch((err: Error) => {
        caughtError = err;
      });

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(4000);
      await promise;

      expect(caughtError).toBeTruthy();
      expect(caughtError!.message).toContain('Discord API error: 429');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('sendMessageWithAttachments handles rate limiting', async () => {
      setupToken();
      mockFetch
        .mockResolvedValueOnce(rateLimitResponse(1))
        .mockResolvedValueOnce(okResponse(rawMessage()));

      const files = [{ name: 'test.txt', data: Buffer.from('hello'), contentType: 'text/plain' }];

      const promise = service.sendMessageWithAttachments('ch_1', 'File attached', files);
      await vi.advanceTimersByTimeAsync(1000);

      const msg = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(msg.id).toBe('msg_1');

      // Verify FormData was used (no Content-Type in headers, just Authorization)
      const firstCallOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(firstCallOptions.method).toBe('POST');
      expect(firstCallOptions.headers).toEqual({ Authorization: 'mock-token' });
      expect(firstCallOptions.body).toBeInstanceOf(FormData);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Token fallback
  // ──────────────────────────────────────────────────────────────
  describe('Token fallback', () => {
    it('getToken uses secureStorage first', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue('secure-token');

      mockFetch.mockResolvedValue(okResponse(rawUser()));

      await service.getUser();

      expect(secureStorage.getItem).toHaveBeenCalledWith('discord_token');
      // Should NOT fall back to database
      expect(database.getSetting).not.toHaveBeenCalled();

      // Verify token was used in fetch
      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = calledOptions.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('secure-token');
    });

    it('getToken falls back to database and syncs to secureStorage', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue(null);
      vi.mocked(database).getSetting.mockReturnValue('db-fallback-token');

      mockFetch.mockResolvedValue(okResponse(rawUser()));

      await service.getUser();

      expect(secureStorage.getItem).toHaveBeenCalledWith('discord_token');
      expect(database.getSetting).toHaveBeenCalledWith('discordToken');
      expect(secureStorage.setItem).toHaveBeenCalledWith('discord_token', 'db-fallback-token');

      // Verify the database token was used in fetch
      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = calledOptions.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('db-fallback-token');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Mapper edge cases (null/undefined fallback branches)
  // ──────────────────────────────────────────────────────────────
  describe('Mapper edge cases', () => {
    it('mapUser falls back when discriminator, global_name, avatar are missing', async () => {
      setupToken();
      mockFetch.mockResolvedValue(
        okResponse(rawUser({ discriminator: undefined, global_name: undefined, avatar: undefined }))
      );

      const user = await service.getUser();

      expect(user).toEqual({
        id: '123',
        username: 'testuser',
        discriminator: '0',
        globalName: null,
        avatar: null,
      });
    });

    it('mapChannel falls back when all optional fields are nullish', async () => {
      setupToken();
      const minimalChannel = {
        id: 'ch_min',
        type: 2,
        name: undefined,
        parent_id: undefined,
        position: undefined,
        topic: undefined,
        available_tags: undefined,
      };
      mockFetch.mockResolvedValue(okResponse(minimalChannel));

      const channel = await service.getChannel('ch_min');

      expect(channel).toEqual({
        id: 'ch_min',
        name: '',
        type: 2,
        parentId: null,
        position: 0,
        topic: null,
        availableTags: [],
      });
    });

    it('mapChannel maps tags with partial/nullish tag fields', async () => {
      setupToken();
      const channelWithPartialTags = rawChannel({
        available_tags: [
          {
            id: 'tag_1',
            name: 'Bug',
            moderated: undefined,
            emoji_id: undefined,
            emoji_name: undefined,
          },
          { id: 'tag_2', name: 'Feature', moderated: false, emoji_id: null, emoji_name: null },
        ],
      });
      mockFetch.mockResolvedValue(okResponse(channelWithPartialTags));

      const channel = await service.getChannel('ch_1');

      expect(channel.availableTags).toEqual([
        { id: 'tag_1', name: 'Bug', moderated: false, emojiId: null, emojiName: null },
        { id: 'tag_2', name: 'Feature', moderated: false, emojiId: null, emojiName: null },
      ]);
    });

    it('mapThread falls back when all optional fields and thread_metadata are missing', async () => {
      setupToken();
      const minimalThread = {
        id: 'thread_min',
        name: undefined,
        parent_id: undefined,
        owner_id: undefined,
        message_count: undefined,
        thread_metadata: undefined,
        last_message_id: undefined,
        applied_tags: undefined,
      };
      const searchResponse = { threads: [minimalThread], has_more: false, total_results: 1 };
      mockFetch.mockResolvedValue(okResponse(searchResponse));

      const result = await service.getForumThreads('ch_1', 'g_1');

      expect(result.threads[0]).toEqual({
        id: 'thread_min',
        name: '',
        parentId: '',
        ownerId: '',
        messageCount: 0,
        createdTimestamp: null,
        archiveTimestamp: null,
        archived: false,
        locked: false,
        lastMessageId: null,
        appliedTags: [],
      });
    });

    it('mapMessage falls back when all optional fields are missing/empty', async () => {
      setupToken();
      const minimalMessage = {
        id: 'msg_min',
        author: rawUser(),
        timestamp: '2026-01-01T00:00:00Z',
        content: undefined,
        edited_timestamp: undefined,
        attachments: undefined,
        embeds: undefined,
        reactions: undefined,
        referenced_message: undefined,
        mention_everyone: undefined,
        mentions: undefined,
        pinned: undefined,
        type: undefined,
        sticker_items: undefined,
        poll: undefined,
      };
      mockFetch.mockResolvedValue(okResponse([minimalMessage]));

      const messages = await service.getMessages('ch_1');

      expect(messages[0]).toEqual({
        id: 'msg_min',
        content: '',
        author: expect.objectContaining({ id: '123' }),
        timestamp: '2026-01-01T00:00:00Z',
        editedTimestamp: null,
        attachments: [],
        embeds: [],
        reactions: [],
        referencedMessage: null,
        mentionEveryone: false,
        mentions: [],
        pinned: false,
        type: 0,
        stickerItems: [],
        poll: null,
      });
    });

    it('mapMessage maps referenced_message recursively', async () => {
      setupToken();
      const referencedMsg = rawMessage({ id: 'msg_ref', content: 'Original' });
      const messageWithRef = rawMessage({
        id: 'msg_reply',
        content: 'Reply',
        referenced_message: referencedMsg,
      });
      mockFetch.mockResolvedValue(okResponse([messageWithRef]));

      const messages = await service.getMessages('ch_1');

      expect(messages[0].referencedMessage).not.toBeNull();
      expect(messages[0].referencedMessage!.id).toBe('msg_ref');
      expect(messages[0].referencedMessage!.content).toBe('Original');
    });

    it('mapAttachment falls back when proxy_url, content_type, width, height are missing', async () => {
      setupToken();
      const messageWithMinimalAttachment = rawMessage({
        attachments: [
          {
            id: 'att_min',
            filename: 'doc.pdf',
            url: 'https://cdn.discord.com/doc.pdf',
            proxy_url: undefined,
            size: undefined,
            content_type: undefined,
            width: undefined,
            height: undefined,
          },
        ],
      });
      mockFetch.mockResolvedValue(okResponse([messageWithMinimalAttachment]));

      const messages = await service.getMessages('ch_1');

      expect(messages[0].attachments[0]).toEqual({
        id: 'att_min',
        filename: 'doc.pdf',
        url: 'https://cdn.discord.com/doc.pdf',
        proxyUrl: 'https://cdn.discord.com/doc.pdf',
        size: 0,
        contentType: null,
        width: null,
        height: null,
      });
    });

    it('mapEmbed with minimal fields (all null optional sub-objects)', async () => {
      setupToken();
      const messageWithMinimalEmbed = rawMessage({
        embeds: [
          {
            title: undefined,
            description: undefined,
            url: undefined,
            color: undefined,
            type: undefined,
            thumbnail: undefined,
            image: undefined,
            video: undefined,
            author: undefined,
            footer: undefined,
            timestamp: undefined,
            provider: undefined,
            fields: undefined,
          },
        ],
      });
      mockFetch.mockResolvedValue(okResponse([messageWithMinimalEmbed]));

      const messages = await service.getMessages('ch_1');

      expect(messages[0].embeds[0]).toEqual({
        title: null,
        description: null,
        url: null,
        color: null,
        type: null,
        thumbnail: null,
        image: null,
        video: null,
        author: null,
        footer: null,
        timestamp: null,
        provider: null,
        fields: [],
      });
    });

    it('mapEmbed with partial sub-objects (author no url/icon, footer no icon, video proxy_url fallback)', async () => {
      setupToken();
      const messageWithPartialEmbed = rawMessage({
        embeds: [
          {
            title: 'Test',
            description: 'Desc',
            url: 'https://example.com',
            color: 0,
            type: 'rich',
            thumbnail: { url: 'https://thumb.com/img.png', width: undefined, height: undefined },
            image: { url: 'https://img.com/img.png', width: undefined, height: undefined },
            video: {
              url: undefined,
              proxy_url: 'https://proxy.com/vid.mp4',
              width: undefined,
              height: undefined,
            },
            author: { name: 'Author', url: undefined, icon_url: undefined },
            footer: { text: 'Footer', icon_url: undefined },
            timestamp: '2026-01-01T00:00:00Z',
            provider: { name: 'Provider', url: undefined },
            fields: [{ name: 'F1', value: 'V1', inline: undefined }],
          },
        ],
      });
      mockFetch.mockResolvedValue(okResponse([messageWithPartialEmbed]));

      const messages = await service.getMessages('ch_1');
      const embed = messages[0].embeds[0];

      expect(embed.thumbnail).toEqual({ url: 'https://thumb.com/img.png', width: 0, height: 0 });
      expect(embed.image).toEqual({ url: 'https://img.com/img.png', width: 0, height: 0 });
      expect(embed.video).toEqual({ url: 'https://proxy.com/vid.mp4', width: 0, height: 0 });
      expect(embed.author).toEqual({ name: 'Author', url: null, iconUrl: null });
      expect(embed.footer).toEqual({ text: 'Footer', iconUrl: null });
      expect(embed.provider).toEqual({ name: 'Provider', url: null });
      expect(embed.fields).toEqual([{ name: 'F1', value: 'V1', inline: false }]);
      expect(embed.color).toBe(0);
    });

    it('mapEmbed video falls back to empty string when both url and proxy_url are missing', async () => {
      setupToken();
      const messageWithVideoEmbed = rawMessage({
        embeds: [
          {
            video: { url: undefined, proxy_url: undefined, width: 320, height: 240 },
          },
        ],
      });
      mockFetch.mockResolvedValue(okResponse([messageWithVideoEmbed]));

      const messages = await service.getMessages('ch_1');
      const embed = messages[0].embeds[0];

      expect(embed.video).toEqual({ url: '', width: 320, height: 240 });
    });

    it('mapReaction falls back when emoji id, count, me are missing', async () => {
      setupToken();
      const messageWithMinimalReaction = rawMessage({
        reactions: [
          { emoji: { name: 'fire' }, count: undefined, me: undefined },
          { emoji: { id: undefined, name: undefined }, count: 0, me: false },
          { emoji: undefined, count: undefined, me: undefined },
        ],
      });
      mockFetch.mockResolvedValue(okResponse([messageWithMinimalReaction]));

      const messages = await service.getMessages('ch_1');

      expect(messages[0].reactions[0]).toEqual({
        emoji: { id: null, name: 'fire' },
        count: 0,
        me: false,
      });
      expect(messages[0].reactions[1]).toEqual({
        emoji: { id: null, name: '' },
        count: 0,
        me: false,
      });
    });

    it('mapSticker falls back when all optional fields are missing', async () => {
      setupToken();
      const rawStickers = [
        {
          id: 'stk_min',
          name: 'Minimal',
          description: undefined,
          tags: undefined,
          format_type: undefined,
          pack_id: undefined,
          guild_id: undefined,
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawStickers));

      const stickers = await service.getGuildStickers('g_1');

      expect(stickers[0]).toEqual({
        id: 'stk_min',
        name: 'Minimal',
        description: null,
        tags: '',
        formatType: 1,
        packId: null,
        guildId: null,
      });
    });

    it('mapPoll with no results, minimal answer data, and answers without emoji', async () => {
      setupToken();
      const messageWithMinimalPoll = rawMessage({
        poll: {
          question: { text: undefined },
          answers: [
            { answer_id: 1, poll_media: { text: undefined, emoji: undefined } },
            { answer_id: 2, poll_media: undefined },
          ],
          expiry: undefined,
          allow_multiselect: undefined,
          layout_type: undefined,
          results: undefined,
        },
      });
      mockFetch.mockResolvedValue(okResponse([messageWithMinimalPoll]));

      const messages = await service.getMessages('ch_1');
      const poll = messages[0].poll!;

      expect(poll.question.text).toBe('');
      expect(poll.answers[0].pollMedia).toEqual({ text: '', emoji: undefined });
      expect(poll.answers[1].pollMedia).toEqual({ text: '', emoji: undefined });
      expect(poll.expiry).toBeNull();
      expect(poll.allowMultiselect).toBe(false);
      expect(poll.layoutType).toBe(1);
      expect(poll.results).toBeUndefined();
    });

    it('mapPoll with results that have is_finalized and answer_counts fallbacks', async () => {
      setupToken();
      const messageWithPollResults = rawMessage({
        poll: {
          question: { text: 'Q' },
          answers: [],
          expiry: '2026-12-01T00:00:00Z',
          allow_multiselect: true,
          layout_type: 2,
          results: {
            is_finalized: undefined,
            answer_counts: [{ id: 1, count: undefined, me_voted: undefined }],
          },
        },
      });
      mockFetch.mockResolvedValue(okResponse([messageWithPollResults]));

      const messages = await service.getMessages('ch_1');
      const poll = messages[0].poll!;

      expect(poll.results).toBeDefined();
      expect(poll.results!.isFinalized).toBe(false);
      expect(poll.results!.answerCounts).toEqual([{ id: 1, count: 0, meVoted: false }]);
    });

    it('mapPoll answer with emoji containing id and name', async () => {
      setupToken();
      const messageWithPollEmoji = rawMessage({
        poll: {
          question: { text: 'Pick' },
          answers: [
            {
              answer_id: 1,
              poll_media: {
                text: 'Option A',
                emoji: { id: 'emoji_1', name: 'check' },
              },
            },
          ],
          results: null,
        },
      });
      mockFetch.mockResolvedValue(okResponse([messageWithPollEmoji]));

      const messages = await service.getMessages('ch_1');
      const poll = messages[0].poll!;

      expect(poll.answers[0].pollMedia.emoji).toEqual({ id: 'emoji_1', name: 'check' });
    });

    it('mapPoll answer emoji falls back when id/name are missing', async () => {
      setupToken();
      const messageWithPollEmojiNull = rawMessage({
        poll: {
          question: { text: 'Pick' },
          answers: [
            {
              answer_id: 1,
              poll_media: {
                text: 'Option B',
                emoji: { id: undefined, name: undefined },
              },
            },
          ],
          results: null,
        },
      });
      mockFetch.mockResolvedValue(okResponse([messageWithPollEmojiNull]));

      const messages = await service.getMessages('ch_1');
      const poll = messages[0].poll!;

      expect(poll.answers[0].pollMedia.emoji).toEqual({ id: null, name: '' });
    });

    it('mapMessage with sticker_items having missing format_type', async () => {
      setupToken();
      const messageWithMinimalSticker = rawMessage({
        sticker_items: [{ id: 'stk_1', name: 'Wave', format_type: undefined }],
      });
      mockFetch.mockResolvedValue(okResponse([messageWithMinimalSticker]));

      const messages = await service.getMessages('ch_1');

      expect(messages[0].stickerItems).toEqual([{ id: 'stk_1', name: 'Wave', formatType: 1 }]);
    });

    it('getDMChannels maps channels with missing recipients and last_message_id', async () => {
      setupToken();
      const rawDMs = [
        {
          id: 'dm_min',
          type: 1,
          recipients: undefined,
          last_message_id: undefined,
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawDMs));

      const dms = await service.getDMChannels();

      expect(dms[0]).toEqual({
        id: 'dm_min',
        type: 1,
        recipients: [],
        lastMessageId: null,
      });
    });

    it('getGuildEmojis maps emoji with missing animated field', async () => {
      setupToken();
      const rawEmojis = [{ id: 'emoji_1', name: 'cool', animated: undefined }];
      mockFetch.mockResolvedValue(okResponse(rawEmojis));

      const emojis = await service.getGuildEmojis('g_1');

      expect(emojis[0]).toEqual({
        id: 'emoji_1',
        name: 'cool',
        animated: false,
        guildId: 'g_1',
      });
    });

    it('getGuilds maps guild with missing owner_id', async () => {
      setupToken();
      const rawGuilds = [{ id: 'g_1', name: 'Guild', icon: null, owner_id: undefined }];
      mockFetch.mockResolvedValue(okResponse(rawGuilds));

      const guilds = await service.getGuilds();

      expect(guilds[0].ownerId).toBe('');
    });

    it('getStickerPacks maps packs with missing description, banner, and stickers', async () => {
      setupToken();
      const rawPacks = {
        sticker_packs: [
          {
            id: 'pack_min',
            name: 'Minimal Pack',
            description: undefined,
            banner_asset_id: undefined,
            stickers: undefined,
          },
        ],
      };
      mockFetch.mockResolvedValue(okResponse(rawPacks));

      const packs = await service.getStickerPacks();

      expect(packs[0]).toEqual({
        id: 'pack_min',
        name: 'Minimal Pack',
        description: '',
        bannerAssetId: null,
        stickers: [],
      });
    });

    it('getStickerPacks handles null data response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(null));

      const packs = await service.getStickerPacks();

      expect(packs).toEqual([]);
    });

    it('createDM maps channel with missing recipients', async () => {
      setupToken();
      const rawDM = {
        id: 'dm_no_recip',
        type: 1,
        recipients: undefined,
        last_message_id: undefined,
      };
      mockFetch.mockResolvedValue(okResponse(rawDM));

      const dm = await service.createDM('789');

      expect(dm.recipients).toEqual([]);
      expect(dm.lastMessageId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // API error handling
  // ──────────────────────────────────────────────────────────────
  describe('API error handling', () => {
    it('apiGet throws Discord API error on non-ok response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      await expect(service.getGuilds()).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });

    it('apiGet returns null for 204 response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(noContentResponse());

      const result = await service.getPinnedMessages('ch_1');

      // 204 returns null, then (null || []).map returns []
      expect(result).toEqual([]);
    });

    it('apiPost returns null for 204 response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(noContentResponse());

      await service.triggerTyping('ch_1');

      // triggerTyping calls apiPost which returns null on 204 -- no error
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('apiPost returns null for empty text body', async () => {
      setupToken();
      const emptyTextResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => null,
        text: async () => '',
        blob: async () => new Blob(['']),
        clone: () => emptyTextResponse,
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        bytes: async () => new Uint8Array(),
      } as Response;
      mockFetch.mockResolvedValue(emptyTextResponse);

      // triggerTyping uses apiPost -- with empty text body it returns null
      await service.triggerTyping('ch_1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('apiPost throws Discord API error on non-ok response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      await expect(service.sendMessage('ch_1', 'hello')).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });

    it('apiPut throws Discord API error on non-ok, non-204 response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      await expect(service.addReaction('ch_1', 'msg_1', 'thumbsup')).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });

    it('apiDelete throws Discord API error on non-ok, non-204 response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      await expect(service.deleteMessage('ch_1', 'msg_1')).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });

    it('apiDeleteNoBody throws Discord API error on non-ok, non-204 response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      await expect(service.removeReaction('ch_1', 'msg_1', 'wave')).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });

    it('apiPatch throws Discord API error on non-ok response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      await expect(service.editMessage('ch_1', 'msg_1', 'edited')).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });

    it('apiGetWithToken throws Discord API error on non-ok response', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue('token');
      mockFetch.mockResolvedValue(serverErrorResponse());

      await expect(service.connect()).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('cleanup resolves without error', () => {
      expect(() => service.cleanup()).not.toThrow();
    });

    it('sendThreadMessage delegates to sendMessage', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage({ content: 'Thread reply' })));

      const msg = await service.sendThreadMessage('thread_1', 'Thread reply');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/thread_1/messages`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Thread reply' }),
        })
      );
      expect(msg.content).toBe('Thread reply');
    });

    it('createForumThread without appliedTags omits applied_tags from body', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawThread()));

      await service.createForumThread('ch_1', 'No Tags Thread', 'Body');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/threads`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'No Tags Thread',
            message: { content: 'Body' },
          }),
        })
      );
    });

    it('createForumThread with empty appliedTags array omits applied_tags from body', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawThread()));

      await service.createForumThread('ch_1', 'Empty Tags Thread', 'Body', []);

      expect(mockFetch).toHaveBeenCalledWith(
        `${DISCORD_API_BASE}/channels/ch_1/threads`,
        expect.objectContaining({
          body: JSON.stringify({
            name: 'Empty Tags Thread',
            message: { content: 'Body' },
          }),
        })
      );
    });

    it('connect falls back to database token when secureStorage is empty', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue(null);
      vi.mocked(database).getSetting.mockReturnValue('db-connect-token');
      mockFetch.mockResolvedValue(okResponse(rawUser()));

      const user = await service.connect();

      expect(database.getSetting).toHaveBeenCalledWith('discordToken');
      expect(secureStorage.setItem).toHaveBeenCalledWith('discord_token', 'db-connect-token');
      expect(user.id).toBe('123');
    });

    it('getToken throws when no token in secureStorage or database', async () => {
      vi.mocked(secureStorage).getItem.mockResolvedValue(null);
      vi.mocked(database).getSetting.mockReturnValue(null);

      await expect(service.getGuilds()).rejects.toThrow('Not connected to Discord');
    });

    it('sendMessageWithAttachments throws on non-429 error response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      const files = [{ name: 'test.txt', data: Buffer.from('hello'), contentType: 'text/plain' }];

      await expect(service.sendMessageWithAttachments('ch_1', 'Fail', files)).rejects.toThrow(
        'Discord API error: 500 Internal Server Error'
      );
    });

    it('sendMessageWithAttachments includes message_reference when replyToId is provided', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage()));

      const files = [{ name: 'test.txt', data: Buffer.from('hello'), contentType: 'text/plain' }];

      await service.sendMessageWithAttachments('ch_1', 'Reply with file', files, 'msg_0');

      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const formData = calledOptions.body as FormData;
      const payloadJson = formData.get('payload_json') as string;
      const parsed = JSON.parse(payloadJson);

      expect(parsed).toEqual({
        content: 'Reply with file',
        message_reference: { message_id: 'msg_0' },
      });
    });

    it('sendMessageWithAttachments without replyToId omits message_reference', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(rawMessage()));

      const files = [{ name: 'test.txt', data: Buffer.from('hello'), contentType: 'text/plain' }];

      await service.sendMessageWithAttachments('ch_1', 'No reply', files);

      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const formData = calledOptions.body as FormData;
      const payloadJson = formData.get('payload_json') as string;
      const parsed = JSON.parse(payloadJson);

      expect(parsed).toEqual({ content: 'No reply' });
      expect(parsed.message_reference).toBeUndefined();
    });

    it('searchGifs maps gifs with no preview and no gif_src (falls back to url)', async () => {
      setupToken();
      const rawGifs = [
        {
          url: 'https://gif.com/1.gif',
          preview: undefined,
          gif_src: undefined,
          width: 300,
          height: 200,
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawGifs));

      const gifs = await service.searchGifs('test');

      expect(gifs[0]).toEqual({
        url: 'https://gif.com/1.gif',
        preview: 'https://gif.com/1.gif',
        width: 300,
        height: 200,
      });
    });

    it('searchGifs maps gifs with no width/height (defaults to 200)', async () => {
      setupToken();
      const rawGifs = [
        {
          url: 'https://gif.com/1.gif',
          preview: 'https://gif.com/1_p.gif',
          width: undefined,
          height: undefined,
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawGifs));

      const gifs = await service.searchGifs('test');

      expect(gifs[0]).toEqual({
        url: 'https://gif.com/1.gif',
        preview: 'https://gif.com/1_p.gif',
        width: 200,
        height: 200,
      });
    });

    it('getTrendingGifs returns empty array on error', async () => {
      setupToken();
      mockFetch.mockResolvedValue(serverErrorResponse());

      const gifs = await service.getTrendingGifs();

      expect(gifs).toEqual([]);
    });

    it('getTrendingGifs maps gifs with fallback preview and dimensions', async () => {
      setupToken();
      const rawGifs = [
        {
          url: 'https://gif.com/t.gif',
          preview: undefined,
          gif_src: 'https://gif.com/t_src.gif',
          width: undefined,
          height: undefined,
        },
      ];
      mockFetch.mockResolvedValue(okResponse(rawGifs));

      const gifs = await service.getTrendingGifs();

      expect(gifs[0]).toEqual({
        url: 'https://gif.com/t.gif',
        preview: 'https://gif.com/t_src.gif',
        width: 200,
        height: 200,
      });
    });

    it('getGuilds handles null API response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(null));

      const guilds = await service.getGuilds();

      expect(guilds).toEqual([]);
    });

    it('getGuildChannels handles null API response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(null));

      const channels = await service.getGuildChannels('g_1');

      expect(channels).toEqual([]);
    });

    it('getMessages handles null API response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(null));

      const messages = await service.getMessages('ch_1');

      expect(messages).toEqual([]);
    });

    it('getGuildEmojis handles null API response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(null));

      const emojis = await service.getGuildEmojis('g_1');

      expect(emojis).toEqual([]);
    });

    it('getGuildStickers handles null API response', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse(null));

      const stickers = await service.getGuildStickers('g_1');

      expect(stickers).toEqual([]);
    });

    it('getForumThreads with no tagIds and offset=0 does not set offset or tag_ids params', async () => {
      setupToken();
      const searchResponse = { threads: [], has_more: false, total_results: 0 };
      mockFetch.mockResolvedValue(okResponse(searchResponse));

      await service.getForumThreads('ch_1', 'g_1');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('offset=');
      expect(calledUrl).not.toContain('tag_ids=');
      expect(calledUrl).toContain('sort_by=last_message_time');
      expect(calledUrl).toContain('sort_order=desc');
    });

    it('getForumThreads fallback returns totalResults equal to thread count', async () => {
      setupToken();
      // First call (thread search) fails
      mockFetch.mockResolvedValueOnce(serverErrorResponse());
      // Second call (guild active threads) returns threads
      const activeThreads = {
        threads: [rawThread({ parent_id: 'ch_1' })],
      };
      mockFetch.mockResolvedValueOnce(okResponse(activeThreads));

      const result = await service.getForumThreads('ch_1', 'g_1');

      expect(result.totalResults).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('getForumThreads search response with missing has_more and total_results', async () => {
      setupToken();
      const searchResponse = {
        threads: [rawThread()],
        has_more: undefined,
        total_results: undefined,
      };
      mockFetch.mockResolvedValue(okResponse(searchResponse));

      const result = await service.getForumThreads('ch_1', 'g_1');

      expect(result.hasMore).toBe(false);
      expect(result.totalResults).toBe(1);
    });

    it('getMessages without before param does not include before in query', async () => {
      setupToken();
      mockFetch.mockResolvedValue(okResponse([rawMessage()]));

      await service.getMessages('ch_1');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('before=');
      expect(calledUrl).toContain('limit=50');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Rate limiting edge cases
  // ──────────────────────────────────────────────────────────────
  describe('Rate limiting edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('apiRequestWithToken defaults to 5000ms wait when no Retry-After header', async () => {
      setupToken();
      // Create a 429 response WITHOUT Retry-After header
      const rateLimitNoHeader = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Rate limited' }),
        text: async () => JSON.stringify({ message: 'Rate limited' }),
        blob: async () => new Blob(['']),
        clone: function () {
          return this;
        },
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        bytes: async () => new Uint8Array(),
      } as Response;

      const rawGuild = { id: 'g_1', name: 'Guild', icon: null, owner_id: 'owner_1' };
      mockFetch
        .mockResolvedValueOnce(rateLimitNoHeader)
        .mockResolvedValueOnce(okResponse([rawGuild]));

      const promise = service.getGuilds();

      // Should wait 5000ms (default when no Retry-After)
      await vi.advanceTimersByTimeAsync(5000);

      const guilds = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(guilds).toEqual([
        { id: 'g_1', name: 'Guild', icon: null, ownerId: 'owner_1', channels: [] },
      ]);
    });

    it('sendMessageWithAttachments defaults to 1000ms wait when 429 has no Retry-After', async () => {
      setupToken();
      const rateLimitNoHeader = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Rate limited' }),
        text: async () => JSON.stringify({ message: 'Rate limited' }),
        blob: async () => new Blob(['']),
        clone: function () {
          return this;
        },
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        formData: async () => new FormData(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        bytes: async () => new Uint8Array(),
      } as Response;

      mockFetch
        .mockResolvedValueOnce(rateLimitNoHeader)
        .mockResolvedValueOnce(okResponse(rawMessage()));

      const files = [{ name: 'test.txt', data: Buffer.from('hello'), contentType: 'text/plain' }];
      const promise = service.sendMessageWithAttachments('ch_1', 'Retry', files);

      // sendMessageWithAttachments uses 1000ms default
      await vi.advanceTimersByTimeAsync(1000);

      const msg = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(msg.id).toBe('msg_1');
    });
  });
});
