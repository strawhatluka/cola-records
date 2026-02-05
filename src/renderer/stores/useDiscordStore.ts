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
} from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

type View = 'dms' | 'server' | 'messages';

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
  selectedChannelType: 'text' | 'dm';

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
  sendMessageWithAttachments: (channelId: string, content: string, files: { name: string; data: Buffer; contentType: string }[], replyToId?: string) => Promise<void>;
  searchGifs: (query: string) => Promise<{ url: string; preview: string; width: number; height: number }[]>;
  getTrendingGifs: () => Promise<{ url: string; preview: string; width: number; height: number }[]>;
  fetchPinnedMessages: (channelId: string) => Promise<void>;
  triggerTyping: (channelId: string) => Promise<void>;
  pinnedMessages: DiscordMessage[];
  stickerPacks: DiscordStickerPack[];
  guildStickers: Record<string, DiscordSticker[]>;
  fetchStickerPacks: () => Promise<void>;
  fetchGuildStickers: (guildId: string) => Promise<void>;
  sendSticker: (channelId: string, stickerId: string) => Promise<void>;
  createPoll: (channelId: string, question: string, answers: string[], duration: number, allowMultiselect: boolean) => Promise<void>;

  // Navigation
  selectGuild: (guildId: string) => void;
  selectDMs: () => void;
  openChannel: (channelId: string, channelName: string, type: 'text' | 'dm') => void;
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
      const newMsg = await ipc.invoke('discord:send-message-with-attachments', channelId, content, files, replyToId);
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
      const newMsg = await ipc.invoke('discord:create-poll', channelId, question, answers, duration, allowMultiselect);
      set((state) => ({ messages: [newMsg, ...state.messages] }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  selectGuild: (guildId) => {
    set({
      view: 'server',
      selectedGuildId: guildId,
      selectedChannelId: null,
      selectedChannelName: null,
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
      messages: [],
    });
    get().fetchMessages(channelId);
  },

  goBack: () => {
    const { selectedGuildId } = get();
    if (selectedGuildId) {
      set({ view: 'server', selectedChannelId: null, selectedChannelName: null, messages: [] });
    } else {
      set({ view: 'dms', selectedChannelId: null, selectedChannelName: null, messages: [] });
    }
  },
}));
