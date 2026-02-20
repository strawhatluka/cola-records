/**
 * Integration IPC Handlers
 *
 * Registers handlers for: spotify:*, discord:*
 */
import { handleIpc } from '../handlers';
import { spotifyService } from '../../services/spotify.service';
import { discordService } from '../../services/discord.service';

export function setupIntegrationHandlers(): void {
  // Spotify handlers
  handleIpc('spotify:is-connected', async () => {
    return await spotifyService.isConnected();
  });

  handleIpc('spotify:start-auth', async () => {
    await spotifyService.startAuthFlow();
  });

  handleIpc('spotify:disconnect', async () => {
    await spotifyService.disconnect();
  });

  handleIpc('spotify:get-playback-state', async () => {
    return await spotifyService.getPlaybackState();
  });

  handleIpc('spotify:play', async (_event, uri, contextUri) => {
    await spotifyService.play(uri, contextUri);
  });

  handleIpc('spotify:pause', async () => {
    await spotifyService.pause();
  });

  handleIpc('spotify:next', async () => {
    await spotifyService.next();
  });

  handleIpc('spotify:previous', async () => {
    await spotifyService.previous();
  });

  handleIpc('spotify:set-shuffle', async (_event, state) => {
    await spotifyService.setShuffle(state);
  });

  handleIpc('spotify:set-volume', async (_event, volumePercent) => {
    await spotifyService.setVolume(volumePercent);
  });

  handleIpc('spotify:get-playlists', async () => {
    return await spotifyService.getPlaylists();
  });

  handleIpc('spotify:play-playlist', async (_event, playlistUri) => {
    await spotifyService.playPlaylist(playlistUri);
  });

  handleIpc('spotify:search', async (_event, query) => {
    return await spotifyService.search(query);
  });

  handleIpc('spotify:add-to-queue', async (_event, trackUri) => {
    await spotifyService.addToQueue(trackUri);
  });

  handleIpc('spotify:save-track', async (_event, trackId) => {
    await spotifyService.saveTrack(trackId);
  });

  handleIpc('spotify:remove-track', async (_event, trackId) => {
    await spotifyService.removeTrack(trackId);
  });

  handleIpc('spotify:is-track-saved', async (_event, trackId) => {
    return await spotifyService.isTrackSaved(trackId);
  });

  handleIpc('spotify:seek', async (_event, positionMs) => {
    await spotifyService.seek(positionMs);
  });

  // Discord handlers
  handleIpc('discord:is-connected', async () => {
    return await discordService.isConnected();
  });

  handleIpc('discord:connect', async () => {
    return await discordService.connect();
  });

  handleIpc('discord:disconnect', async () => {
    await discordService.disconnect();
  });

  handleIpc('discord:get-user', async () => {
    return await discordService.getUser();
  });

  handleIpc('discord:get-guilds', async () => {
    return await discordService.getGuilds();
  });

  handleIpc('discord:get-guild-channels', async (_event, guildId) => {
    return await discordService.getGuildChannels(guildId);
  });

  handleIpc('discord:get-guild-emojis', async (_event, guildId) => {
    return await discordService.getGuildEmojis(guildId);
  });

  handleIpc('discord:get-dm-channels', async () => {
    return await discordService.getDMChannels();
  });

  handleIpc('discord:get-messages', async (_event, channelId, before, limit) => {
    return await discordService.getMessages(channelId, before, limit);
  });

  handleIpc('discord:send-message', async (_event, channelId, content, replyToId) => {
    return await discordService.sendMessage(channelId, content, replyToId);
  });

  handleIpc('discord:edit-message', async (_event, channelId, messageId, content) => {
    return await discordService.editMessage(channelId, messageId, content);
  });

  handleIpc('discord:delete-message', async (_event, channelId, messageId) => {
    await discordService.deleteMessage(channelId, messageId);
  });

  handleIpc('discord:add-reaction', async (_event, channelId, messageId, emoji) => {
    await discordService.addReaction(channelId, messageId, emoji);
  });

  handleIpc('discord:remove-reaction', async (_event, channelId, messageId, emoji) => {
    await discordService.removeReaction(channelId, messageId, emoji);
  });

  handleIpc('discord:get-channel', async (_event, channelId) => {
    return await discordService.getChannel(channelId);
  });

  handleIpc('discord:typing', async (_event, channelId) => {
    await discordService.triggerTyping(channelId);
  });

  handleIpc('discord:get-pinned-messages', async (_event, channelId) => {
    return await discordService.getPinnedMessages(channelId);
  });

  handleIpc('discord:create-dm', async (_event, userId) => {
    return await discordService.createDM(userId);
  });

  handleIpc(
    'discord:send-message-with-attachments',
    async (_event, channelId, content, files, replyToId) => {
      return await discordService.sendMessageWithAttachments(channelId, content, files, replyToId);
    }
  );

  handleIpc('discord:search-gifs', async (_event, query) => {
    return await discordService.searchGifs(query);
  });

  handleIpc('discord:trending-gifs', async () => {
    return await discordService.getTrendingGifs();
  });

  handleIpc('discord:get-sticker-packs', async () => {
    return await discordService.getStickerPacks();
  });

  handleIpc('discord:get-guild-stickers', async (_event, guildId) => {
    return await discordService.getGuildStickers(guildId);
  });

  handleIpc('discord:send-sticker', async (_event, channelId, stickerId) => {
    return await discordService.sendSticker(channelId, stickerId);
  });

  handleIpc(
    'discord:create-poll',
    async (_event, channelId, question, answers, duration, allowMultiselect) => {
      return await discordService.createPoll(
        channelId,
        question,
        answers,
        duration,
        allowMultiselect
      );
    }
  );

  handleIpc(
    'discord:get-forum-threads',
    async (_event, channelId, guildId, sortBy, sortOrder, tagIds, offset) => {
      return await discordService.getForumThreads(
        channelId,
        guildId,
        sortBy,
        sortOrder,
        tagIds,
        offset
      );
    }
  );

  handleIpc('discord:get-thread-messages', async (_event, threadId, before, limit) => {
    return await discordService.getThreadMessages(threadId, before, limit);
  });

  handleIpc('discord:send-thread-message', async (_event, threadId, content) => {
    return await discordService.sendThreadMessage(threadId, content);
  });

  handleIpc(
    'discord:create-forum-thread',
    async (_event, channelId, name, content, appliedTags) => {
      return await discordService.createForumThread(channelId, name, content, appliedTags);
    }
  );
}
