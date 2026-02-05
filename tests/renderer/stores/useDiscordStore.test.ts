import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  createMockDiscordUser,
  createMockDiscordGuild,
  createMockDiscordChannel,
  createMockDiscordDMChannel,
  createMockDiscordMessage,
  createMockDiscordEmoji,
  createMockDiscordThread,
  createMockForumTag,
} from '../../mocks/factories';

const mockInvoke = vi.fn();

vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

import { useDiscordStore } from '../../../src/renderer/stores/useDiscordStore';

function resetStore() {
  useDiscordStore.setState({
    connected: false,
    user: null,
    guilds: [],
    guildChannels: {},
    guildEmojis: {},
    dmChannels: [],
    messages: [],
    pinnedMessages: [],
    stickerPacks: [],
    guildStickers: {},
    loading: false,
    error: null,
    view: 'dms',
    selectedGuildId: null,
    selectedChannelId: null,
    selectedChannelName: null,
    selectedChannelType: 'text',
    forumThreads: [],
    forumHasMore: false,
    forumTotalResults: 0,
    forumSortBy: 'last_message_time',
    forumSortOrder: 'desc',
    forumFilterTags: [],
    forumAvailableTags: [],
    selectedForumChannelId: null,
    selectedForumChannelName: null,
    selectedThreadId: null,
    selectedThreadName: null,
  });
}

describe('useDiscordStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('checkConnection', () => {
    it('sets connected and user when connected', async () => {
      const user = createMockDiscordUser();
      mockInvoke.mockResolvedValueOnce(true); // is-connected
      mockInvoke.mockResolvedValueOnce(user); // get-user

      await act(async () => {
        await useDiscordStore.getState().checkConnection();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:is-connected');
      expect(mockInvoke).toHaveBeenCalledWith('discord:get-user');
      expect(useDiscordStore.getState().connected).toBe(true);
      expect(useDiscordStore.getState().user).toEqual(user);
    });

    it('sets not connected when disconnected', async () => {
      mockInvoke.mockResolvedValueOnce(false);

      await act(async () => {
        await useDiscordStore.getState().checkConnection();
      });

      expect(useDiscordStore.getState().connected).toBe(false);
      expect(useDiscordStore.getState().user).toBeNull();
    });

    it('handles error gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('IPC error'));

      await act(async () => {
        await useDiscordStore.getState().checkConnection();
      });

      expect(useDiscordStore.getState().connected).toBe(false);
      expect(useDiscordStore.getState().user).toBeNull();
    });
  });

  describe('connect', () => {
    it('connects and stores user', async () => {
      const user = createMockDiscordUser();
      mockInvoke.mockResolvedValueOnce(user);

      await act(async () => {
        await useDiscordStore.getState().connect();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:connect');
      expect(useDiscordStore.getState().connected).toBe(true);
      expect(useDiscordStore.getState().user).toEqual(user);
      expect(useDiscordStore.getState().loading).toBe(false);
    });

    it('sets error on failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Token invalid'));

      await act(async () => {
        await useDiscordStore.getState().connect();
      });

      expect(useDiscordStore.getState().error).toBe('Error: Token invalid');
      expect(useDiscordStore.getState().loading).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('clears all state', async () => {
      useDiscordStore.setState({
        connected: true,
        user: createMockDiscordUser(),
        guilds: [createMockDiscordGuild()],
        dmChannels: [createMockDiscordDMChannel()],
        messages: [createMockDiscordMessage()],
      });
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useDiscordStore.getState().disconnect();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:disconnect');
      const state = useDiscordStore.getState();
      expect(state.connected).toBe(false);
      expect(state.user).toBeNull();
      expect(state.guilds).toEqual([]);
      expect(state.dmChannels).toEqual([]);
      expect(state.messages).toEqual([]);
      expect(state.view).toBe('dms');
    });
  });

  describe('fetchGuilds', () => {
    it('fetches and stores guilds', async () => {
      const guilds = [createMockDiscordGuild(), createMockDiscordGuild({ id: 'guild_2', name: 'Second' })];
      mockInvoke.mockResolvedValueOnce(guilds);

      await act(async () => {
        await useDiscordStore.getState().fetchGuilds();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-guilds');
      expect(useDiscordStore.getState().guilds).toEqual(guilds);
    });
  });

  describe('fetchGuildChannels', () => {
    it('stores channels keyed by guildId', async () => {
      const channels = [createMockDiscordChannel(), createMockDiscordChannel({ id: 'ch_2', name: 'dev' })];
      mockInvoke.mockResolvedValueOnce(channels);

      await act(async () => {
        await useDiscordStore.getState().fetchGuildChannels('guild_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-guild-channels', 'guild_1');
      expect(useDiscordStore.getState().guildChannels['guild_1']).toEqual(channels);
    });
  });

  describe('fetchGuildEmojis', () => {
    it('stores emojis keyed by guildId', async () => {
      const emojis = [createMockDiscordEmoji()];
      mockInvoke.mockResolvedValueOnce(emojis);

      await act(async () => {
        await useDiscordStore.getState().fetchGuildEmojis('guild_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-guild-emojis', 'guild_1');
      expect(useDiscordStore.getState().guildEmojis['guild_1']).toEqual(emojis);
    });
  });

  describe('fetchDMChannels', () => {
    it('fetches DM channels', async () => {
      const dms = [createMockDiscordDMChannel()];
      mockInvoke.mockResolvedValueOnce(dms);

      await act(async () => {
        await useDiscordStore.getState().fetchDMChannels();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-dm-channels');
      expect(useDiscordStore.getState().dmChannels).toEqual(dms);
    });
  });

  describe('fetchMessages', () => {
    it('fetches messages for a channel', async () => {
      const messages = [createMockDiscordMessage(), createMockDiscordMessage({ id: 'msg_2' })];
      mockInvoke.mockResolvedValueOnce(messages);

      await act(async () => {
        await useDiscordStore.getState().fetchMessages('channel_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-messages', 'channel_1', undefined, 50);
      expect(useDiscordStore.getState().messages).toEqual(messages);
    });
  });

  describe('loadMoreMessages', () => {
    it('appends older messages', async () => {
      const existing = [createMockDiscordMessage({ id: 'msg_1' }), createMockDiscordMessage({ id: 'msg_2' })];
      useDiscordStore.setState({ selectedChannelId: 'channel_1', messages: existing });

      const older = [createMockDiscordMessage({ id: 'msg_3' })];
      mockInvoke.mockResolvedValueOnce(older);

      await act(async () => {
        await useDiscordStore.getState().loadMoreMessages();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-messages', 'channel_1', 'msg_2', 50);
      expect(useDiscordStore.getState().messages).toHaveLength(3);
    });

    it('does nothing without selected channel', async () => {
      await act(async () => {
        await useDiscordStore.getState().loadMoreMessages();
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does nothing when messages are empty', async () => {
      useDiscordStore.setState({ selectedChannelId: 'channel_1', messages: [] });

      await act(async () => {
        await useDiscordStore.getState().loadMoreMessages();
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('sends and prepends message', async () => {
      const existing = [createMockDiscordMessage({ id: 'msg_old' })];
      useDiscordStore.setState({ messages: existing });

      const newMsg = createMockDiscordMessage({ id: 'msg_new', content: 'Hello' });
      mockInvoke.mockResolvedValueOnce(newMsg);

      await act(async () => {
        await useDiscordStore.getState().sendMessage('channel_1', 'Hello');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:send-message', 'channel_1', 'Hello', undefined);
      const messages = useDiscordStore.getState().messages;
      expect(messages[0].id).toBe('msg_new');
      expect(messages).toHaveLength(2);
    });

    it('sends with replyToId', async () => {
      const newMsg = createMockDiscordMessage();
      mockInvoke.mockResolvedValueOnce(newMsg);

      await act(async () => {
        await useDiscordStore.getState().sendMessage('channel_1', 'Reply', 'msg_original');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:send-message', 'channel_1', 'Reply', 'msg_original');
    });
  });

  describe('editMessage', () => {
    it('replaces message in list', async () => {
      const original = createMockDiscordMessage({ id: 'msg_1', content: 'old' });
      useDiscordStore.setState({ messages: [original] });

      const updated = createMockDiscordMessage({ id: 'msg_1', content: 'new' });
      mockInvoke.mockResolvedValueOnce(updated);

      await act(async () => {
        await useDiscordStore.getState().editMessage('channel_1', 'msg_1', 'new');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:edit-message', 'channel_1', 'msg_1', 'new');
      expect(useDiscordStore.getState().messages[0].content).toBe('new');
    });
  });

  describe('deleteMessage', () => {
    it('removes message from list', async () => {
      const messages = [createMockDiscordMessage({ id: 'msg_1' }), createMockDiscordMessage({ id: 'msg_2' })];
      useDiscordStore.setState({ messages });
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useDiscordStore.getState().deleteMessage('channel_1', 'msg_1');
      });

      expect(useDiscordStore.getState().messages).toHaveLength(1);
      expect(useDiscordStore.getState().messages[0].id).toBe('msg_2');
    });
  });

  describe('addReaction / removeReaction', () => {
    it('invokes add-reaction', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useDiscordStore.getState().addReaction('ch_1', 'msg_1', '👍');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:add-reaction', 'ch_1', 'msg_1', '👍');
    });

    it('invokes remove-reaction', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useDiscordStore.getState().removeReaction('ch_1', 'msg_1', '👍');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:remove-reaction', 'ch_1', 'msg_1', '👍');
    });
  });

  describe('searchGifs / getTrendingGifs', () => {
    it('returns gif results', async () => {
      const gifs = [{ url: 'https://gif.url', preview: 'https://preview', width: 200, height: 200 }];
      mockInvoke.mockResolvedValueOnce(gifs);

      let result: any[];
      await act(async () => {
        result = await useDiscordStore.getState().searchGifs('funny');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:search-gifs', 'funny');
      expect(result!).toEqual(gifs);
    });

    it('returns empty array on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));

      let result: any[];
      await act(async () => {
        result = await useDiscordStore.getState().searchGifs('test');
      });

      expect(result!).toEqual([]);
    });

    it('fetches trending gifs', async () => {
      const gifs = [{ url: 'https://gif.url', preview: 'https://preview', width: 200, height: 200 }];
      mockInvoke.mockResolvedValueOnce(gifs);

      let result: any[];
      await act(async () => {
        result = await useDiscordStore.getState().getTrendingGifs();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:trending-gifs');
      expect(result!).toEqual(gifs);
    });
  });

  describe('fetchPinnedMessages', () => {
    it('fetches pinned messages', async () => {
      const pinned = [createMockDiscordMessage({ pinned: true })];
      mockInvoke.mockResolvedValueOnce(pinned);

      await act(async () => {
        await useDiscordStore.getState().fetchPinnedMessages('channel_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-pinned-messages', 'channel_1');
      expect(useDiscordStore.getState().pinnedMessages).toEqual(pinned);
    });
  });

  describe('triggerTyping', () => {
    it('invokes typing silently', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useDiscordStore.getState().triggerTyping('channel_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:typing', 'channel_1');
    });

    it('silently ignores typing errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));

      await act(async () => {
        await useDiscordStore.getState().triggerTyping('channel_1');
      });

      expect(useDiscordStore.getState().error).toBeNull();
    });
  });

  describe('stickers', () => {
    it('fetches sticker packs', async () => {
      const packs = [{ id: 'pack_1', name: 'Pack', description: '', stickers: [], bannerAssetId: null }];
      mockInvoke.mockResolvedValueOnce(packs);

      await act(async () => {
        await useDiscordStore.getState().fetchStickerPacks();
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:get-sticker-packs');
      expect(useDiscordStore.getState().stickerPacks).toEqual(packs);
    });

    it('fetches guild stickers', async () => {
      const stickers = [{ id: 's1', name: 'sticker', description: null, tags: '', formatType: 1, packId: null, guildId: 'guild_1' }];
      mockInvoke.mockResolvedValueOnce(stickers);

      await act(async () => {
        await useDiscordStore.getState().fetchGuildStickers('guild_1');
      });

      expect(useDiscordStore.getState().guildStickers['guild_1']).toEqual(stickers);
    });

    it('sends sticker and prepends message', async () => {
      const newMsg = createMockDiscordMessage({ id: 'sticker_msg' });
      mockInvoke.mockResolvedValueOnce(newMsg);

      await act(async () => {
        await useDiscordStore.getState().sendSticker('channel_1', 'sticker_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:send-sticker', 'channel_1', 'sticker_1');
      expect(useDiscordStore.getState().messages[0].id).toBe('sticker_msg');
    });
  });

  describe('createPoll', () => {
    it('creates poll and prepends message', async () => {
      const newMsg = createMockDiscordMessage({ id: 'poll_msg' });
      mockInvoke.mockResolvedValueOnce(newMsg);

      await act(async () => {
        await useDiscordStore.getState().createPoll('channel_1', 'Best color?', ['Red', 'Blue'], 24, false);
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:create-poll', 'channel_1', 'Best color?', ['Red', 'Blue'], 24, false);
      expect(useDiscordStore.getState().messages[0].id).toBe('poll_msg');
    });
  });

  describe('forum threads', () => {
    it('fetches forum threads', async () => {
      useDiscordStore.setState({ selectedGuildId: 'guild_1' });
      const result = {
        threads: [createMockDiscordThread()],
        hasMore: true,
        totalResults: 10,
      };
      mockInvoke.mockResolvedValueOnce(result);

      await act(async () => {
        await useDiscordStore.getState().fetchForumThreads('forum_ch');
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'discord:get-forum-threads', 'forum_ch', 'guild_1', 'last_message_time', 'desc', undefined, 0
      );
      expect(useDiscordStore.getState().forumThreads).toEqual(result.threads);
      expect(useDiscordStore.getState().forumHasMore).toBe(true);
    });

    it('appends threads on load more (offset > 0)', async () => {
      const existing = [createMockDiscordThread({ id: 'thread_1' })];
      useDiscordStore.setState({
        selectedGuildId: 'guild_1',
        forumThreads: existing,
        selectedForumChannelId: 'forum_ch',
      });

      const moreResult = {
        threads: [createMockDiscordThread({ id: 'thread_2' })],
        hasMore: false,
        totalResults: 2,
      };
      mockInvoke.mockResolvedValueOnce(moreResult);

      await act(async () => {
        await useDiscordStore.getState().loadMoreForumThreads();
      });

      expect(useDiscordStore.getState().forumThreads).toHaveLength(2);
    });

    it('does nothing without selectedGuildId', async () => {
      await act(async () => {
        await useDiscordStore.getState().fetchForumThreads('forum_ch');
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('setForumSort clears threads and re-fetches', async () => {
      useDiscordStore.setState({
        selectedGuildId: 'guild_1',
        selectedForumChannelId: 'forum_ch',
        forumThreads: [createMockDiscordThread()],
      });
      mockInvoke.mockResolvedValueOnce({ threads: [], hasMore: false, totalResults: 0 });

      act(() => {
        useDiscordStore.getState().setForumSort('creation_time', 'asc');
      });

      expect(useDiscordStore.getState().forumSortBy).toBe('creation_time');
      expect(useDiscordStore.getState().forumSortOrder).toBe('asc');
    });

    it('toggleForumTag adds and removes tags', async () => {
      useDiscordStore.setState({
        selectedGuildId: 'guild_1',
        selectedForumChannelId: 'forum_ch',
      });
      mockInvoke.mockResolvedValue({ threads: [], hasMore: false, totalResults: 0 });

      act(() => {
        useDiscordStore.getState().toggleForumTag('tag_1');
      });
      expect(useDiscordStore.getState().forumFilterTags).toEqual(['tag_1']);

      act(() => {
        useDiscordStore.getState().toggleForumTag('tag_1');
      });
      expect(useDiscordStore.getState().forumFilterTags).toEqual([]);
    });

    it('createForumThread invokes IPC and refreshes', async () => {
      useDiscordStore.setState({
        selectedGuildId: 'guild_1',
        selectedForumChannelId: 'forum_ch',
      });

      const thread = createMockDiscordThread({ id: 'new_thread' });
      mockInvoke.mockResolvedValueOnce(thread); // create
      mockInvoke.mockResolvedValueOnce({ threads: [thread], hasMore: false, totalResults: 1 }); // refresh

      let result: any;
      await act(async () => {
        result = await useDiscordStore.getState().createForumThread('forum_ch', 'Title', 'Content', ['tag_1']);
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:create-forum-thread', 'forum_ch', 'Title', 'Content', ['tag_1']);
      expect(result.id).toBe('new_thread');
    });
  });

  describe('navigation', () => {
    it('selectGuild sets view and fetches channels', async () => {
      mockInvoke.mockResolvedValueOnce([]); // fetchGuildChannels

      act(() => {
        useDiscordStore.getState().selectGuild('guild_1');
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('server');
      expect(state.selectedGuildId).toBe('guild_1');
      expect(state.selectedChannelId).toBeNull();
      expect(state.forumThreads).toEqual([]);
      expect(state.messages).toEqual([]);
      expect(mockInvoke).toHaveBeenCalledWith('discord:get-guild-channels', 'guild_1');
    });

    it('selectDMs resets to DM view', async () => {
      useDiscordStore.setState({ view: 'server', selectedGuildId: 'guild_1' });
      mockInvoke.mockResolvedValueOnce([]); // fetchDMChannels

      act(() => {
        useDiscordStore.getState().selectDMs();
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('dms');
      expect(state.selectedGuildId).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith('discord:get-dm-channels');
    });

    it('openChannel sets messages view and fetches', async () => {
      mockInvoke.mockResolvedValueOnce([]); // fetchMessages

      act(() => {
        useDiscordStore.getState().openChannel('ch_1', 'general', 'text');
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('messages');
      expect(state.selectedChannelId).toBe('ch_1');
      expect(state.selectedChannelName).toBe('general');
      expect(state.selectedChannelType).toBe('text');
      expect(mockInvoke).toHaveBeenCalledWith('discord:get-messages', 'ch_1', undefined, 50);
    });

    it('openForumChannel sets forum view with tags', async () => {
      const tags = [createMockForumTag()];
      useDiscordStore.setState({
        selectedGuildId: 'guild_1',
        guildChannels: {
          guild_1: [createMockDiscordChannel({ id: 'forum_ch', type: 15, availableTags: tags })],
        },
      });
      mockInvoke.mockResolvedValueOnce({ threads: [], hasMore: false, totalResults: 0 });

      act(() => {
        useDiscordStore.getState().openForumChannel('forum_ch', 'forum-channel');
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('forum');
      expect(state.selectedForumChannelId).toBe('forum_ch');
      expect(state.selectedForumChannelName).toBe('forum-channel');
      expect(state.forumAvailableTags).toEqual(tags);
      expect(state.selectedChannelType).toBe('forum');
    });

    it('openThread sets thread view and fetches messages', async () => {
      mockInvoke.mockResolvedValueOnce([]); // fetchMessages

      act(() => {
        useDiscordStore.getState().openThread('thread_1', 'My Thread');
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('thread');
      expect(state.selectedThreadId).toBe('thread_1');
      expect(state.selectedThreadName).toBe('My Thread');
      expect(state.selectedChannelId).toBe('thread_1');
      expect(mockInvoke).toHaveBeenCalledWith('discord:get-messages', 'thread_1', undefined, 50);
    });

    it('goBack from thread returns to forum', async () => {
      useDiscordStore.setState({
        view: 'thread',
        selectedGuildId: 'guild_1',
        selectedForumChannelId: 'forum_ch',
        selectedForumChannelName: 'forum',
        selectedThreadId: 'thread_1',
      });
      mockInvoke.mockResolvedValueOnce({ threads: [], hasMore: false, totalResults: 0 });

      act(() => {
        useDiscordStore.getState().goBack();
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('forum');
      expect(state.selectedThreadId).toBeNull();
    });

    it('goBack from messages in guild returns to server', () => {
      useDiscordStore.setState({
        view: 'messages',
        selectedGuildId: 'guild_1',
        selectedChannelId: 'ch_1',
      });

      act(() => {
        useDiscordStore.getState().goBack();
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('server');
      expect(state.selectedChannelId).toBeNull();
    });

    it('goBack from messages in DMs returns to DMs', () => {
      useDiscordStore.setState({
        view: 'messages',
        selectedGuildId: null,
        selectedChannelId: 'dm_1',
      });

      act(() => {
        useDiscordStore.getState().goBack();
      });

      const state = useDiscordStore.getState();
      expect(state.view).toBe('dms');
      expect(state.selectedChannelId).toBeNull();
    });
  });

  describe('sendMessageWithAttachments', () => {
    it('sends and prepends message', async () => {
      const newMsg = createMockDiscordMessage({ id: 'attach_msg' });
      mockInvoke.mockResolvedValueOnce(newMsg);

      const files = [{ name: 'test.png', data: Buffer.from('data'), contentType: 'image/png' }];
      await act(async () => {
        await useDiscordStore.getState().sendMessageWithAttachments('ch_1', 'with file', files);
      });

      expect(mockInvoke).toHaveBeenCalledWith('discord:send-message-with-attachments', 'ch_1', 'with file', files, undefined);
      expect(useDiscordStore.getState().messages[0].id).toBe('attach_msg');
    });
  });
});
