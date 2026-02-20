/**
 * Integration IPC channel definitions (Spotify + Discord)
 */
import type {
  SpotifyTrack,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
  DiscordEmoji,
  DiscordDMChannel,
  DiscordMessage,
  DiscordStickerPack,
  DiscordSticker,
  DiscordThread,
} from './types';

export interface IntegrationChannels {
  // Spotify Channels
  'spotify:is-connected': () => boolean;
  'spotify:start-auth': () => void;
  'spotify:disconnect': () => void;
  'spotify:get-playback-state': () => SpotifyPlaybackState | null;
  'spotify:play': (uri?: string, contextUri?: string) => void;
  'spotify:pause': () => void;
  'spotify:next': () => void;
  'spotify:previous': () => void;
  'spotify:set-shuffle': (state: boolean) => void;
  'spotify:set-volume': (volumePercent: number) => void;
  'spotify:get-playlists': () => SpotifyPlaylist[];
  'spotify:play-playlist': (playlistUri: string) => void;
  'spotify:search': (query: string) => { tracks: SpotifyTrack[] };
  'spotify:add-to-queue': (trackUri: string) => void;
  'spotify:save-track': (trackId: string) => void;
  'spotify:remove-track': (trackId: string) => void;
  'spotify:is-track-saved': (trackId: string) => boolean;
  'spotify:seek': (positionMs: number) => void;

  // Discord Channels
  'discord:is-connected': () => boolean;
  'discord:connect': () => DiscordUser;
  'discord:disconnect': () => void;
  'discord:get-user': () => DiscordUser | null;
  'discord:get-guilds': () => DiscordGuild[];
  'discord:get-guild-channels': (guildId: string) => DiscordChannel[];
  'discord:get-guild-emojis': (guildId: string) => DiscordEmoji[];
  'discord:get-dm-channels': () => DiscordDMChannel[];
  'discord:get-messages': (channelId: string, before?: string, limit?: number) => DiscordMessage[];
  'discord:send-message': (
    channelId: string,
    content: string,
    replyToId?: string
  ) => DiscordMessage;
  'discord:edit-message': (channelId: string, messageId: string, content: string) => DiscordMessage;
  'discord:delete-message': (channelId: string, messageId: string) => void;
  'discord:add-reaction': (channelId: string, messageId: string, emoji: string) => void;
  'discord:remove-reaction': (channelId: string, messageId: string, emoji: string) => void;
  'discord:get-channel': (channelId: string) => DiscordChannel;
  'discord:typing': (channelId: string) => void;
  'discord:get-pinned-messages': (channelId: string) => DiscordMessage[];
  'discord:create-dm': (userId: string) => DiscordDMChannel;
  'discord:send-message-with-attachments': (
    channelId: string,
    content: string,
    files: { name: string; data: Buffer; contentType: string }[],
    replyToId?: string
  ) => DiscordMessage;
  'discord:search-gifs': (
    query: string
  ) => { url: string; preview: string; width: number; height: number }[];
  'discord:trending-gifs': () => { url: string; preview: string; width: number; height: number }[];
  'discord:get-sticker-packs': () => DiscordStickerPack[];
  'discord:get-guild-stickers': (guildId: string) => DiscordSticker[];
  'discord:send-sticker': (channelId: string, stickerId: string) => DiscordMessage;
  'discord:create-poll': (
    channelId: string,
    question: string,
    answers: string[],
    duration: number,
    allowMultiselect: boolean
  ) => DiscordMessage;
  'discord:get-forum-threads': (
    channelId: string,
    guildId: string,
    sortBy?: string,
    sortOrder?: string,
    tagIds?: string[],
    offset?: number
  ) => { threads: DiscordThread[]; hasMore: boolean; totalResults: number };
  'discord:get-thread-messages': (
    threadId: string,
    before?: string,
    limit?: number
  ) => DiscordMessage[];
  'discord:send-thread-message': (threadId: string, content: string) => DiscordMessage;
  'discord:create-forum-thread': (
    channelId: string,
    name: string,
    content: string,
    appliedTags?: string[]
  ) => DiscordThread;
}
