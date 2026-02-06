import { create } from 'zustand';
import type {
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
  DiscordDMChannel,
  DiscordMessage,
  DiscordEmoji,
  DiscordSticker,
  DiscordStickerPack,
  DiscordThread,
  ForumTag,
} from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

type View = 'dms' | 'server' | 'messages' | 'forum' | 'thread';

interface DiscordState {
  connected: boolean;
  user: DiscordUser | null;
  guilds: DiscordGuild[];
  guildChannels: Record<string, DiscordChannel[]>;
  guildEmojis: Record<string, DiscordEmoji[]>;
  dmChannels: DiscordDMChannel[];
  messages: DiscordMessage[];
  loading: boolean;
  error: string | null;

  // Navigation state
  view: View;
  selectedGuildId: string | null;
  selectedChannelId: string | null;
  selectedChannelName: string | null;
  selectedChannelType: 'text' | 'dm' | 'voice' | 'forum';

  // Forum / Thread state
  forumThreads: DiscordThread[];
  forumHasMore: boolean;
  forumTotalResults: number;
  forumSortBy: string;
  forumSortOrder: string;
  forumFilterTags: string[];
  forumAvailableTags: ForumTag[];
  selectedForumChannelId: string | null;
  selectedForumChannelName: string | null;
  selectedThreadId: string | null;
  selectedThreadName: string | null;

  // Actions
  checkConnection: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  fetchGuilds: () => Promise<void>;
  fetchGuildChannels: (guildId: string) => Promise<void>;
  fetchGuildEmojis: (guildId: string) => Promise<void>;
  fetchDMChannels: () => Promise<void>;
  fetchMessages: (channelId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (channelId: string, content: string, replyToId?: string) => Promise<void>;
  editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
  addReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  removeReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  sendMessageWithAttachments: (
    channelId: string,
    content: string,
    files: { name: string; data: Buffer; contentType: string }[],
    replyToId?: string
  ) => Promise<void>;
  searchGifs: (
    query: string
  ) => Promise<{ url: string; preview: string; width: number; height: number }[]>;
  getTrendingGifs: () => Promise<{ url: string; preview: string; width: number; height: number }[]>;
  fetchPinnedMessages: (channelId: string) => Promise<void>;
  triggerTyping: (channelId: string) => Promise<void>;
  pinnedMessages: DiscordMessage[];
  stickerPacks: DiscordStickerPack[];
  guildStickers: Record<string, DiscordSticker[]>;
  fetchStickerPacks: () => Promise<void>;
  fetchGuildStickers: (guildId: string) => Promise<void>;
  sendSticker: (channelId: string, stickerId: string) => Promise<void>;
  createPoll: (
    channelId: string,
    question: string,
    answers: string[],
    duration: number,
    allowMultiselect: boolean
  ) => Promise<void>;

  // Forum / Thread actions
  fetchForumThreads: (
    channelId: string,
    sortBy?: string,
    sortOrder?: string,
    tagIds?: string[],
    offset?: number
  ) => Promise<void>;
  loadMoreForumThreads: () => Promise<void>;
  setForumSort: (sortBy: string, sortOrder: string) => void;
  toggleForumTag: (tagId: string) => void;
  createForumThread: (
    channelId: string,
    name: string,
    content: string,
    appliedTags?: string[]
  ) => Promise<DiscordThread>;
  openForumChannel: (channelId: string, channelName: string) => void;
  openThread: (threadId: string, threadName: string) => void;

  // Navigation
  selectGuild: (guildId: string) => void;
  selectDMs: () => void;
  openChannel: (channelId: string, channelName: string, type: 'text' | 'dm' | 'voice') => void;
  goBack: () => void;
}

export const useDiscordStore = create<DiscordState>((set, get) => ({
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
  selectedChannelType: 'text',

  checkConnection: async () => {
    try {
      const connected = await ipc.invoke('discord:is-connected');
      if (connected) {
        const user = await ipc.invoke('discord:get-user');
        set({ connected, user });
      } else {
        set({ connected: false, user: null });
      }
    } catch {
      set({ connected: false, user: null });
    }
  },

  connect: async () => {
    set({ loading: true, error: null });
    try {
      const user = await ipc.invoke('discord:connect');
      set({ connected: true, user, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  disconnect: async () => {
    try {
      await ipc.invoke('discord:disconnect');
      set({
        connected: false,
        user: null,
        guilds: [],
        guildChannels: {},
        guildEmojis: {},
        dmChannels: [],
        messages: [],
        view: 'dms',
        selectedGuildId: null,
        selectedChannelId: null,
        selectedChannelName: null,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchGuilds: async () => {
    try {
      const guilds = await ipc.invoke('discord:get-guilds');
      set({ guilds });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchGuildChannels: async (guildId) => {
    try {
      const channels = await ipc.invoke('discord:get-guild-channels', guildId);
      set((state) => ({
        guildChannels: { ...state.guildChannels, [guildId]: channels },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchGuildEmojis: async (guildId) => {
    try {
      const emojis = await ipc.invoke('discord:get-guild-emojis', guildId);
      set((state) => ({
        guildEmojis: { ...state.guildEmojis, [guildId]: emojis },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchDMChannels: async () => {
    try {
      const dmChannels = await ipc.invoke('discord:get-dm-channels');
      set({ dmChannels });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchMessages: async (channelId) => {
    try {
      const messages = await ipc.invoke('discord:get-messages', channelId, undefined, 50);
      set({ messages });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  loadMoreMessages: async () => {
    const { selectedChannelId, messages } = get();
    if (!selectedChannelId || messages.length === 0) return;

    const oldestId = messages[messages.length - 1].id;
    try {
      const older = await ipc.invoke('discord:get-messages', selectedChannelId, oldestId, 50);
      if (older.length > 0) {
        set({ messages: [...messages, ...older] });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  sendMessage: async (channelId, content, replyToId) => {
    try {
      const newMsg = await ipc.invoke('discord:send-message', channelId, content, replyToId);
      set((state) => ({ messages: [newMsg, ...state.messages] }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  editMessage: async (channelId, messageId, content) => {
    try {
      const updated = await ipc.invoke('discord:edit-message', channelId, messageId, content);
      set((state) => ({
        messages: state.messages.map((m) => (m.id === messageId ? updated : m)),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteMessage: async (channelId, messageId) => {
    try {
      await ipc.invoke('discord:delete-message', channelId, messageId);
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== messageId),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addReaction: async (channelId, messageId, emoji) => {
    try {
      await ipc.invoke('discord:add-reaction', channelId, messageId, emoji);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  removeReaction: async (channelId, messageId, emoji) => {
    try {
      await ipc.invoke('discord:remove-reaction', channelId, messageId, emoji);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  sendMessageWithAttachments: async (channelId, content, files, replyToId) => {
    try {
      const newMsg = await ipc.invoke(
        'discord:send-message-with-attachments',
        channelId,
        content,
        files,
        replyToId
      );
      set((state) => ({ messages: [newMsg, ...state.messages] }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  searchGifs: async (query) => {
    try {
      return await ipc.invoke('discord:search-gifs', query);
    } catch {
      return [];
    }
  },

  getTrendingGifs: async () => {
    try {
      return await ipc.invoke('discord:trending-gifs');
    } catch {
      return [];
    }
  },

  fetchPinnedMessages: async (channelId) => {
    try {
      const pinnedMessages = await ipc.invoke('discord:get-pinned-messages', channelId);
      set({ pinnedMessages });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  triggerTyping: async (channelId) => {
    try {
      await ipc.invoke('discord:typing', channelId);
    } catch {
      // Silently ignore typing errors
    }
  },

  fetchStickerPacks: async () => {
    try {
      const stickerPacks = await ipc.invoke('discord:get-sticker-packs');
      set({ stickerPacks });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchGuildStickers: async (guildId) => {
    try {
      const stickers = await ipc.invoke('discord:get-guild-stickers', guildId);
      set((state) => ({
        guildStickers: { ...state.guildStickers, [guildId]: stickers },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  sendSticker: async (channelId, stickerId) => {
    try {
      const newMsg = await ipc.invoke('discord:send-sticker', channelId, stickerId);
      set((state) => ({ messages: [newMsg, ...state.messages] }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createPoll: async (channelId, question, answers, duration, allowMultiselect) => {
    try {
      const newMsg = await ipc.invoke(
        'discord:create-poll',
        channelId,
        question,
        answers,
        duration,
        allowMultiselect
      );
      set((state) => ({ messages: [newMsg, ...state.messages] }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchForumThreads: async (channelId, sortBy, sortOrder, tagIds, offset) => {
    const { selectedGuildId, forumSortBy, forumSortOrder, forumFilterTags } = get();
    if (!selectedGuildId) return;
    const sb = sortBy || forumSortBy;
    const so = sortOrder || forumSortOrder;
    const tags = tagIds || forumFilterTags;
    const off = offset ?? 0;
    try {
      const result = await ipc.invoke(
        'discord:get-forum-threads',
        channelId,
        selectedGuildId,
        sb,
        so,
        tags.length > 0 ? tags : undefined,
        off
      );
      if (off > 0) {
        // Append for "load more"
        set((state) => ({
          forumThreads: [...state.forumThreads, ...result.threads],
          forumHasMore: result.hasMore,
          forumTotalResults: result.totalResults,
        }));
      } else {
        set({
          forumThreads: result.threads,
          forumHasMore: result.hasMore,
          forumTotalResults: result.totalResults,
        });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  loadMoreForumThreads: async () => {
    const { selectedForumChannelId, forumThreads } = get();
    if (!selectedForumChannelId) return;
    await get().fetchForumThreads(
      selectedForumChannelId,
      undefined,
      undefined,
      undefined,
      forumThreads.length
    );
  },

  setForumSort: (sortBy, sortOrder) => {
    const { selectedForumChannelId } = get();
    set({ forumSortBy: sortBy, forumSortOrder: sortOrder, forumThreads: [] });
    if (selectedForumChannelId) {
      get().fetchForumThreads(selectedForumChannelId, sortBy, sortOrder);
    }
  },

  toggleForumTag: (tagId) => {
    const { selectedForumChannelId, forumFilterTags } = get();
    const newTags = forumFilterTags.includes(tagId)
      ? forumFilterTags.filter((t) => t !== tagId)
      : [...forumFilterTags, tagId];
    set({ forumFilterTags: newTags, forumThreads: [] });
    if (selectedForumChannelId) {
      get().fetchForumThreads(selectedForumChannelId, undefined, undefined, newTags);
    }
  },

  createForumThread: async (channelId, name, content, appliedTags) => {
    const thread = await ipc.invoke(
      'discord:create-forum-thread',
      channelId,
      name,
      content,
      appliedTags
    );
    // Refresh thread list
    const { selectedForumChannelId } = get();
    if (selectedForumChannelId) {
      get().fetchForumThreads(selectedForumChannelId);
    }
    return thread;
  },

  openForumChannel: (channelId, channelName) => {
    // Resolve available tags from the channel data
    const { selectedGuildId, guildChannels } = get();
    const channels = selectedGuildId ? guildChannels[selectedGuildId] || [] : [];
    const channel = channels.find((ch) => ch.id === channelId);
    const availableTags = channel?.availableTags || [];

    set({
      view: 'forum',
      selectedForumChannelId: channelId,
      selectedForumChannelName: channelName,
      selectedChannelId: null,
      selectedChannelName: null,
      selectedChannelType: 'forum',
      selectedThreadId: null,
      selectedThreadName: null,
      forumThreads: [],
      forumHasMore: false,
      forumTotalResults: 0,
      forumFilterTags: [],
      forumAvailableTags: availableTags,
      messages: [],
    });
    get().fetchForumThreads(channelId);
  },

  openThread: (threadId, threadName) => {
    set({
      view: 'thread',
      selectedThreadId: threadId,
      selectedThreadName: threadName,
      selectedChannelId: threadId,
      selectedChannelName: threadName,
      messages: [],
    });
    get().fetchMessages(threadId);
  },

  selectGuild: (guildId) => {
    set({
      view: 'server',
      selectedGuildId: guildId,
      selectedChannelId: null,
      selectedChannelName: null,
      selectedForumChannelId: null,
      selectedForumChannelName: null,
      selectedThreadId: null,
      selectedThreadName: null,
      forumThreads: [],
      messages: [],
    });
    get().fetchGuildChannels(guildId);
  },

  selectDMs: () => {
    set({
      view: 'dms',
      selectedGuildId: null,
      selectedChannelId: null,
      selectedChannelName: null,
      selectedForumChannelId: null,
      selectedForumChannelName: null,
      selectedThreadId: null,
      selectedThreadName: null,
      forumThreads: [],
      messages: [],
    });
    get().fetchDMChannels();
  },

  openChannel: (channelId, channelName, type) => {
    set({
      view: 'messages',
      selectedChannelId: channelId,
      selectedChannelName: channelName,
      selectedChannelType: type,
      selectedForumChannelId: null,
      selectedForumChannelName: null,
      selectedThreadId: null,
      selectedThreadName: null,
      forumThreads: [],
      messages: [],
    });
    get().fetchMessages(channelId);
  },

  goBack: () => {
    const { selectedGuildId, view, selectedForumChannelId } = get();
    // From thread view, go back to forum
    if (view === 'thread' && selectedForumChannelId) {
      set({
        view: 'forum',
        selectedThreadId: null,
        selectedThreadName: null,
        selectedChannelId: null,
        selectedChannelName: null,
        messages: [],
      });
      get().fetchForumThreads(selectedForumChannelId);
      return;
    }
    if (selectedGuildId) {
      set({
        view: 'server',
        selectedChannelId: null,
        selectedChannelName: null,
        selectedForumChannelId: null,
        selectedForumChannelName: null,
        selectedThreadId: null,
        selectedThreadName: null,
        forumThreads: [],
        messages: [],
      });
    } else {
      set({
        view: 'dms',
        selectedChannelId: null,
        selectedChannelName: null,
        messages: [],
      });
    }
  },
}));
