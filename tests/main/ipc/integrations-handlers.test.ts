import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockHandleIpc: vi.fn(),
  // Spotify
  mockIsConnected: vi.fn(),
  mockStartAuthFlow: vi.fn(),
  mockDisconnect: vi.fn(),
  mockGetPlaybackState: vi.fn(),
  mockPlay: vi.fn(),
  mockPause: vi.fn(),
  mockNext: vi.fn(),
  mockPrevious: vi.fn(),
  mockSetShuffle: vi.fn(),
  mockSetVolume: vi.fn(),
  mockGetPlaylists: vi.fn(),
  mockPlayPlaylist: vi.fn(),
  mockSearch: vi.fn(),
  mockAddToQueue: vi.fn(),
  mockSaveTrack: vi.fn(),
  mockRemoveTrack: vi.fn(),
  mockIsTrackSaved: vi.fn(),
  mockSeek: vi.fn(),
  // Discord
  mockDiscordIsConnected: vi.fn(),
  mockConnect: vi.fn(),
  mockDiscordDisconnect: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetGuilds: vi.fn(),
  mockGetGuildChannels: vi.fn(),
  mockGetGuildEmojis: vi.fn(),
  mockGetDMChannels: vi.fn(),
  mockGetMessages: vi.fn(),
  mockSendMessage: vi.fn(),
  mockEditMessage: vi.fn(),
  mockDeleteMessage: vi.fn(),
  mockAddReaction: vi.fn(),
  mockRemoveReaction: vi.fn(),
  mockGetChannel: vi.fn(),
  mockTriggerTyping: vi.fn(),
  mockGetPinnedMessages: vi.fn(),
  mockCreateDM: vi.fn(),
  mockSendMessageWithAttachments: vi.fn(),
  mockSearchGifs: vi.fn(),
  mockGetTrendingGifs: vi.fn(),
  mockGetStickerPacks: vi.fn(),
  mockGetGuildStickers: vi.fn(),
  mockSendSticker: vi.fn(),
  mockCreatePoll: vi.fn(),
  mockGetForumThreads: vi.fn(),
  mockGetThreadMessages: vi.fn(),
  mockSendThreadMessage: vi.fn(),
  mockCreateForumThread: vi.fn(),
}));

vi.mock('../../../src/main/ipc/handlers', () => ({
  handleIpc: mocks.mockHandleIpc,
  removeAllIpcHandlers: vi.fn(),
  removeIpcHandler: vi.fn(),
}));

vi.mock('../../../src/main/services/spotify.service', () => ({
  spotifyService: {
    isConnected: mocks.mockIsConnected,
    startAuthFlow: mocks.mockStartAuthFlow,
    disconnect: mocks.mockDisconnect,
    getPlaybackState: mocks.mockGetPlaybackState,
    play: mocks.mockPlay,
    pause: mocks.mockPause,
    next: mocks.mockNext,
    previous: mocks.mockPrevious,
    setShuffle: mocks.mockSetShuffle,
    setVolume: mocks.mockSetVolume,
    getPlaylists: mocks.mockGetPlaylists,
    playPlaylist: mocks.mockPlayPlaylist,
    search: mocks.mockSearch,
    addToQueue: mocks.mockAddToQueue,
    saveTrack: mocks.mockSaveTrack,
    removeTrack: mocks.mockRemoveTrack,
    isTrackSaved: mocks.mockIsTrackSaved,
    seek: mocks.mockSeek,
  },
}));

vi.mock('../../../src/main/services/discord.service', () => ({
  discordService: {
    isConnected: mocks.mockDiscordIsConnected,
    connect: mocks.mockConnect,
    disconnect: mocks.mockDiscordDisconnect,
    getUser: mocks.mockGetUser,
    getGuilds: mocks.mockGetGuilds,
    getGuildChannels: mocks.mockGetGuildChannels,
    getGuildEmojis: mocks.mockGetGuildEmojis,
    getDMChannels: mocks.mockGetDMChannels,
    getMessages: mocks.mockGetMessages,
    sendMessage: mocks.mockSendMessage,
    editMessage: mocks.mockEditMessage,
    deleteMessage: mocks.mockDeleteMessage,
    addReaction: mocks.mockAddReaction,
    removeReaction: mocks.mockRemoveReaction,
    getChannel: mocks.mockGetChannel,
    triggerTyping: mocks.mockTriggerTyping,
    getPinnedMessages: mocks.mockGetPinnedMessages,
    createDM: mocks.mockCreateDM,
    sendMessageWithAttachments: mocks.mockSendMessageWithAttachments,
    searchGifs: mocks.mockSearchGifs,
    getTrendingGifs: mocks.mockGetTrendingGifs,
    getStickerPacks: mocks.mockGetStickerPacks,
    getGuildStickers: mocks.mockGetGuildStickers,
    sendSticker: mocks.mockSendSticker,
    createPoll: mocks.mockCreatePoll,
    getForumThreads: mocks.mockGetForumThreads,
    getThreadMessages: mocks.mockGetThreadMessages,
    sendThreadMessage: mocks.mockSendThreadMessage,
    createForumThread: mocks.mockCreateForumThread,
  },
}));

import { setupIntegrationHandlers } from '../../../src/main/ipc/handlers/integrations.handlers';

function getHandler(channel: string) {
  const call = mocks.mockHandleIpc.mock.calls.find((c: unknown[]) => c[0] === channel);
  return call?.[1] as ((...args: unknown[]) => Promise<unknown>) | undefined;
}

describe('integrations.handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupIntegrationHandlers();
  });

  it('registers all integration handlers', () => {
    const channels = mocks.mockHandleIpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(channels.length).toBeGreaterThanOrEqual(47);
    // Spot check
    expect(channels).toContain('spotify:is-connected');
    expect(channels).toContain('spotify:seek');
    expect(channels).toContain('discord:is-connected');
    expect(channels).toContain('discord:create-forum-thread');
  });

  // ── Spotify ──

  it('spotify:is-connected delegates', async () => {
    mocks.mockIsConnected.mockResolvedValue(true);
    const result = await getHandler('spotify:is-connected')!({});
    expect(result).toBe(true);
  });

  it('spotify:start-auth delegates', async () => {
    await getHandler('spotify:start-auth')!({});
    expect(mocks.mockStartAuthFlow).toHaveBeenCalled();
  });

  it('spotify:disconnect delegates', async () => {
    await getHandler('spotify:disconnect')!({});
    expect(mocks.mockDisconnect).toHaveBeenCalled();
  });

  it('spotify:get-playback-state delegates', async () => {
    const state = { isPlaying: true, track: 'Song' };
    mocks.mockGetPlaybackState.mockResolvedValue(state);
    const result = await getHandler('spotify:get-playback-state')!({});
    expect(result).toBe(state);
  });

  it('spotify:play delegates with uri and contextUri', async () => {
    await getHandler('spotify:play')!({}, 'spotify:track:123', 'spotify:playlist:456');
    expect(mocks.mockPlay).toHaveBeenCalledWith('spotify:track:123', 'spotify:playlist:456');
  });

  it('spotify:pause delegates', async () => {
    await getHandler('spotify:pause')!({});
    expect(mocks.mockPause).toHaveBeenCalled();
  });

  it('spotify:next delegates', async () => {
    await getHandler('spotify:next')!({});
    expect(mocks.mockNext).toHaveBeenCalled();
  });

  it('spotify:previous delegates', async () => {
    await getHandler('spotify:previous')!({});
    expect(mocks.mockPrevious).toHaveBeenCalled();
  });

  it('spotify:set-shuffle delegates', async () => {
    await getHandler('spotify:set-shuffle')!({}, true);
    expect(mocks.mockSetShuffle).toHaveBeenCalledWith(true);
  });

  it('spotify:set-volume delegates', async () => {
    await getHandler('spotify:set-volume')!({}, 75);
    expect(mocks.mockSetVolume).toHaveBeenCalledWith(75);
  });

  it('spotify:get-playlists delegates', async () => {
    mocks.mockGetPlaylists.mockResolvedValue([]);
    await getHandler('spotify:get-playlists')!({});
    expect(mocks.mockGetPlaylists).toHaveBeenCalled();
  });

  it('spotify:play-playlist delegates', async () => {
    await getHandler('spotify:play-playlist')!({}, 'spotify:playlist:123');
    expect(mocks.mockPlayPlaylist).toHaveBeenCalledWith('spotify:playlist:123');
  });

  it('spotify:search delegates', async () => {
    mocks.mockSearch.mockResolvedValue({ tracks: [] });
    const result = await getHandler('spotify:search')!({}, 'query');
    expect(mocks.mockSearch).toHaveBeenCalledWith('query');
    expect(result).toEqual({ tracks: [] });
  });

  it('spotify:add-to-queue delegates', async () => {
    await getHandler('spotify:add-to-queue')!({}, 'spotify:track:789');
    expect(mocks.mockAddToQueue).toHaveBeenCalledWith('spotify:track:789');
  });

  it('spotify:save-track delegates', async () => {
    await getHandler('spotify:save-track')!({}, 'trackId');
    expect(mocks.mockSaveTrack).toHaveBeenCalledWith('trackId');
  });

  it('spotify:remove-track delegates', async () => {
    await getHandler('spotify:remove-track')!({}, 'trackId');
    expect(mocks.mockRemoveTrack).toHaveBeenCalledWith('trackId');
  });

  it('spotify:is-track-saved delegates', async () => {
    mocks.mockIsTrackSaved.mockResolvedValue(true);
    const result = await getHandler('spotify:is-track-saved')!({}, 'trackId');
    expect(mocks.mockIsTrackSaved).toHaveBeenCalledWith('trackId');
    expect(result).toBe(true);
  });

  it('spotify:seek delegates', async () => {
    await getHandler('spotify:seek')!({}, 30000);
    expect(mocks.mockSeek).toHaveBeenCalledWith(30000);
  });

  // ── Discord ──

  it('discord:is-connected delegates', async () => {
    mocks.mockDiscordIsConnected.mockResolvedValue(true);
    const result = await getHandler('discord:is-connected')!({});
    expect(result).toBe(true);
  });

  it('discord:connect delegates', async () => {
    mocks.mockConnect.mockResolvedValue({ user: 'Bot' });
    const result = await getHandler('discord:connect')!({});
    expect(result).toEqual({ user: 'Bot' });
  });

  it('discord:disconnect delegates', async () => {
    await getHandler('discord:disconnect')!({});
    expect(mocks.mockDiscordDisconnect).toHaveBeenCalled();
  });

  it('discord:get-user delegates', async () => {
    mocks.mockGetUser.mockResolvedValue({ username: 'user' });
    await getHandler('discord:get-user')!({});
    expect(mocks.mockGetUser).toHaveBeenCalled();
  });

  it('discord:get-guilds delegates', async () => {
    mocks.mockGetGuilds.mockResolvedValue([]);
    await getHandler('discord:get-guilds')!({});
    expect(mocks.mockGetGuilds).toHaveBeenCalled();
  });

  it('discord:get-guild-channels delegates', async () => {
    mocks.mockGetGuildChannels.mockResolvedValue([]);
    await getHandler('discord:get-guild-channels')!({}, 'guild-id');
    expect(mocks.mockGetGuildChannels).toHaveBeenCalledWith('guild-id');
  });

  it('discord:get-guild-emojis delegates', async () => {
    mocks.mockGetGuildEmojis.mockResolvedValue([]);
    await getHandler('discord:get-guild-emojis')!({}, 'guild-id');
    expect(mocks.mockGetGuildEmojis).toHaveBeenCalledWith('guild-id');
  });

  it('discord:get-dm-channels delegates', async () => {
    mocks.mockGetDMChannels.mockResolvedValue([]);
    await getHandler('discord:get-dm-channels')!({});
    expect(mocks.mockGetDMChannels).toHaveBeenCalled();
  });

  it('discord:get-messages delegates', async () => {
    mocks.mockGetMessages.mockResolvedValue([]);
    await getHandler('discord:get-messages')!({}, 'ch-id', 'before-id', 50);
    expect(mocks.mockGetMessages).toHaveBeenCalledWith('ch-id', 'before-id', 50);
  });

  it('discord:send-message delegates', async () => {
    mocks.mockSendMessage.mockResolvedValue({ id: 'msg1' });
    await getHandler('discord:send-message')!({}, 'ch-id', 'hello', 'reply-to');
    expect(mocks.mockSendMessage).toHaveBeenCalledWith('ch-id', 'hello', 'reply-to');
  });

  it('discord:edit-message delegates', async () => {
    mocks.mockEditMessage.mockResolvedValue({ id: 'msg1' });
    await getHandler('discord:edit-message')!({}, 'ch-id', 'msg-id', 'new content');
    expect(mocks.mockEditMessage).toHaveBeenCalledWith('ch-id', 'msg-id', 'new content');
  });

  it('discord:delete-message delegates', async () => {
    await getHandler('discord:delete-message')!({}, 'ch-id', 'msg-id');
    expect(mocks.mockDeleteMessage).toHaveBeenCalledWith('ch-id', 'msg-id');
  });

  it('discord:add-reaction delegates', async () => {
    await getHandler('discord:add-reaction')!({}, 'ch-id', 'msg-id', '👍');
    expect(mocks.mockAddReaction).toHaveBeenCalledWith('ch-id', 'msg-id', '👍');
  });

  it('discord:remove-reaction delegates', async () => {
    await getHandler('discord:remove-reaction')!({}, 'ch-id', 'msg-id', '👍');
    expect(mocks.mockRemoveReaction).toHaveBeenCalledWith('ch-id', 'msg-id', '👍');
  });

  it('discord:get-channel delegates', async () => {
    mocks.mockGetChannel.mockResolvedValue({ id: 'ch-id' });
    await getHandler('discord:get-channel')!({}, 'ch-id');
    expect(mocks.mockGetChannel).toHaveBeenCalledWith('ch-id');
  });

  it('discord:typing delegates', async () => {
    await getHandler('discord:typing')!({}, 'ch-id');
    expect(mocks.mockTriggerTyping).toHaveBeenCalledWith('ch-id');
  });

  it('discord:get-pinned-messages delegates', async () => {
    mocks.mockGetPinnedMessages.mockResolvedValue([]);
    await getHandler('discord:get-pinned-messages')!({}, 'ch-id');
    expect(mocks.mockGetPinnedMessages).toHaveBeenCalledWith('ch-id');
  });

  it('discord:create-dm delegates', async () => {
    mocks.mockCreateDM.mockResolvedValue({ id: 'dm-ch' });
    await getHandler('discord:create-dm')!({}, 'user-id');
    expect(mocks.mockCreateDM).toHaveBeenCalledWith('user-id');
  });

  it('discord:send-message-with-attachments delegates', async () => {
    const files = [{ name: 'file.txt', data: 'content' }];
    mocks.mockSendMessageWithAttachments.mockResolvedValue({ id: 'msg2' });
    await getHandler('discord:send-message-with-attachments')!(
      {},
      'ch-id',
      'hello',
      files,
      'reply'
    );
    expect(mocks.mockSendMessageWithAttachments).toHaveBeenCalledWith(
      'ch-id',
      'hello',
      files,
      'reply'
    );
  });

  it('discord:search-gifs delegates', async () => {
    mocks.mockSearchGifs.mockResolvedValue([]);
    await getHandler('discord:search-gifs')!({}, 'cat');
    expect(mocks.mockSearchGifs).toHaveBeenCalledWith('cat');
  });

  it('discord:trending-gifs delegates', async () => {
    mocks.mockGetTrendingGifs.mockResolvedValue([]);
    await getHandler('discord:trending-gifs')!({});
    expect(mocks.mockGetTrendingGifs).toHaveBeenCalled();
  });

  it('discord:get-sticker-packs delegates', async () => {
    mocks.mockGetStickerPacks.mockResolvedValue([]);
    await getHandler('discord:get-sticker-packs')!({});
    expect(mocks.mockGetStickerPacks).toHaveBeenCalled();
  });

  it('discord:get-guild-stickers delegates', async () => {
    mocks.mockGetGuildStickers.mockResolvedValue([]);
    await getHandler('discord:get-guild-stickers')!({}, 'guild-id');
    expect(mocks.mockGetGuildStickers).toHaveBeenCalledWith('guild-id');
  });

  it('discord:send-sticker delegates', async () => {
    mocks.mockSendSticker.mockResolvedValue({ id: 'msg3' });
    await getHandler('discord:send-sticker')!({}, 'ch-id', 'sticker-id');
    expect(mocks.mockSendSticker).toHaveBeenCalledWith('ch-id', 'sticker-id');
  });

  it('discord:create-poll delegates', async () => {
    mocks.mockCreatePoll.mockResolvedValue({ id: 'poll1' });
    await getHandler('discord:create-poll')!({}, 'ch-id', 'Question?', ['A', 'B'], 24, true);
    expect(mocks.mockCreatePoll).toHaveBeenCalledWith('ch-id', 'Question?', ['A', 'B'], 24, true);
  });

  it('discord:get-forum-threads delegates', async () => {
    mocks.mockGetForumThreads.mockResolvedValue([]);
    await getHandler('discord:get-forum-threads')!(
      {},
      'ch-id',
      'guild-id',
      'latest',
      'desc',
      ['tag1'],
      0
    );
    expect(mocks.mockGetForumThreads).toHaveBeenCalledWith(
      'ch-id',
      'guild-id',
      'latest',
      'desc',
      ['tag1'],
      0
    );
  });

  it('discord:get-thread-messages delegates', async () => {
    mocks.mockGetThreadMessages.mockResolvedValue([]);
    await getHandler('discord:get-thread-messages')!({}, 'thread-id', 'before', 25);
    expect(mocks.mockGetThreadMessages).toHaveBeenCalledWith('thread-id', 'before', 25);
  });

  it('discord:send-thread-message delegates', async () => {
    mocks.mockSendThreadMessage.mockResolvedValue({ id: 'msg4' });
    await getHandler('discord:send-thread-message')!({}, 'thread-id', 'message');
    expect(mocks.mockSendThreadMessage).toHaveBeenCalledWith('thread-id', 'message');
  });

  it('discord:create-forum-thread delegates', async () => {
    mocks.mockCreateForumThread.mockResolvedValue({ id: 'thread1' });
    await getHandler('discord:create-forum-thread')!({}, 'ch-id', 'Thread Title', 'content', [
      'tag1',
    ]);
    expect(mocks.mockCreateForumThread).toHaveBeenCalledWith('ch-id', 'Thread Title', 'content', [
      'tag1',
    ]);
  });
});
