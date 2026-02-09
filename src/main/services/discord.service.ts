/* eslint-disable @typescript-eslint/no-explicit-any -- Discord API responses are untyped */
import { secureStorage } from './secure-storage.service';
import { database } from '../database';
import type {
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
  DiscordDMChannel,
  DiscordMessage,
  DiscordEmoji,
  DiscordAttachment,
  DiscordEmbed,
  DiscordReaction,
  DiscordSticker,
  DiscordStickerPack,
  DiscordPoll,
  DiscordThread,
} from '../ipc/channels';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const STORAGE_KEY = 'discord_token';

export class DiscordService {
  async initialize(): Promise<void> {
    // Token is loaded on-demand from SecureStorageService
  }

  async isConnected(): Promise<boolean> {
    // Check SecureStorage first, then fall back to database
    const secureToken = await secureStorage.getItem(STORAGE_KEY);
    if (secureToken) return true;

    // If SecureStorage is empty but database has a token, sync it
    const dbToken = database.getSetting('discordToken');
    if (dbToken) {
      await secureStorage.setItem(STORAGE_KEY, dbToken);
      return true;
    }
    return false;
  }

  async connect(): Promise<DiscordUser> {
    // Try SecureStorage first, then database
    let token = await secureStorage.getItem(STORAGE_KEY);
    if (!token) {
      token = database.getSetting('discordToken');
    }
    if (!token) {
      throw new Error('Discord token not configured. Set it in Settings > API.');
    }

    // Validate token by calling /users/@me
    const user = await this.apiGetWithToken('/users/@me', token);
    // Token is valid — store it in SecureStorage
    await secureStorage.setItem(STORAGE_KEY, token);
    return this.mapUser(user);
  }

  async disconnect(): Promise<void> {
    await secureStorage.removeItem(STORAGE_KEY);
  }

  async getUser(): Promise<DiscordUser | null> {
    try {
      const data = await this.apiGet('/users/@me');
      return this.mapUser(data);
    } catch {
      return null;
    }
  }

  async getGuilds(): Promise<DiscordGuild[]> {
    const data = await this.apiGet('/users/@me/guilds');
    return (data || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      ownerId: g.owner_id || '',
      channels: [],
    }));
  }

  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    const data = await this.apiGet(`/guilds/${guildId}/channels`);
    return (data || []).map((ch: any) => this.mapChannel(ch));
  }

  async getGuildEmojis(guildId: string): Promise<DiscordEmoji[]> {
    const data = await this.apiGet(`/guilds/${guildId}/emojis`);
    return (data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      animated: e.animated || false,
      guildId,
    }));
  }

  async getDMChannels(): Promise<DiscordDMChannel[]> {
    const data = await this.apiGet('/users/@me/channels');
    return (data || []).map((ch: any) => ({
      id: ch.id,
      type: ch.type,
      recipients: (ch.recipients || []).map((r: any) => this.mapUser(r)),
      lastMessageId: ch.last_message_id || null,
    }));
  }

  async getMessages(channelId: string, before?: string, limit = 50): Promise<DiscordMessage[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    const data = await this.apiGet(`/channels/${channelId}/messages?${params.toString()}`);
    return (data || []).map((m: any) => this.mapMessage(m));
  }

  async sendMessage(
    channelId: string,
    content: string,
    replyToId?: string
  ): Promise<DiscordMessage> {
    const body: Record<string, unknown> = { content };
    if (replyToId) {
      body.message_reference = { message_id: replyToId };
    }
    const data = await this.apiPost(`/channels/${channelId}/messages`, body);
    return this.mapMessage(data);
  }

  async editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<DiscordMessage> {
    const data = await this.apiPatch(`/channels/${channelId}/messages/${messageId}`, { content });
    return this.mapMessage(data);
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.apiDelete(`/channels/${channelId}/messages/${messageId}`);
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.apiPut(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`
    );
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.apiDeleteNoBody(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`
    );
  }

  async getChannel(channelId: string): Promise<DiscordChannel> {
    const data = await this.apiGet(`/channels/${channelId}`);
    return this.mapChannel(data);
  }

  async triggerTyping(channelId: string): Promise<void> {
    await this.apiPost(`/channels/${channelId}/typing`);
  }

  async getPinnedMessages(channelId: string): Promise<DiscordMessage[]> {
    const data = await this.apiGet(`/channels/${channelId}/pins`);
    return (data || []).map((m: any) => this.mapMessage(m));
  }

  async createDM(userId: string): Promise<DiscordDMChannel> {
    const data = await this.apiPost('/users/@me/channels', { recipient_id: userId });
    return {
      id: data.id,
      type: data.type,
      recipients: (data.recipients || []).map((r: any) => this.mapUser(r)),
      lastMessageId: data.last_message_id || null,
    };
  }

  async sendMessageWithAttachments(
    channelId: string,
    content: string,
    files: { name: string; data: Buffer; contentType: string }[],
    replyToId?: string
  ): Promise<DiscordMessage> {
    const token = await this.getToken();
    const formData = new FormData();

    const payload: Record<string, unknown> = { content };
    if (replyToId) {
      payload.message_reference = { message_id: replyToId };
    }
    formData.append('payload_json', JSON.stringify(payload));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blob = new Blob([new Uint8Array(file.data)], { type: file.contentType });
      formData.append(`files[${i}]`, blob, file.name);
    }

    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.sendMessageWithAttachments(channelId, content, files, replyToId);
    }

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapMessage(data);
  }

  async searchGifs(
    query: string
  ): Promise<{ url: string; preview: string; width: number; height: number }[]> {
    // Use Discord's built-in GIF search (Tenor via Discord proxy)
    const token = await this.getToken();
    const params = new URLSearchParams({
      q: query,
      media_format: 'gif',
      provider: 'tenor',
      locale: 'en-US',
    });
    const response = await fetch(`${DISCORD_API_BASE}/gifs/search?${params.toString()}`, {
      headers: { Authorization: token },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data || []).map((g: any) => ({
      url: g.url,
      preview: g.preview || g.gif_src || g.url,
      width: g.width || 200,
      height: g.height || 200,
    }));
  }

  async getTrendingGifs(): Promise<
    { url: string; preview: string; width: number; height: number }[]
  > {
    const token = await this.getToken();
    const params = new URLSearchParams({ media_format: 'gif', provider: 'tenor', locale: 'en-US' });
    const response = await fetch(`${DISCORD_API_BASE}/gifs/trending?${params.toString()}`, {
      headers: { Authorization: token },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data || []).map((g: any) => ({
      url: g.url,
      preview: g.preview || g.gif_src || g.url,
      width: g.width || 200,
      height: g.height || 200,
    }));
  }

  async getStickerPacks(): Promise<DiscordStickerPack[]> {
    const data = await this.apiGet('/sticker-packs');
    return (data?.sticker_packs || []).map((pack: any) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description || '',
      bannerAssetId: pack.banner_asset_id || null,
      stickers: (pack.stickers || []).map((s: any) => this.mapSticker(s)),
    }));
  }

  async getGuildStickers(guildId: string): Promise<DiscordSticker[]> {
    const data = await this.apiGet(`/guilds/${guildId}/stickers`);
    return (data || []).map((s: any) => this.mapSticker(s));
  }

  async sendSticker(channelId: string, stickerId: string): Promise<DiscordMessage> {
    const data = await this.apiPost(`/channels/${channelId}/messages`, {
      sticker_ids: [stickerId],
    });
    return this.mapMessage(data);
  }

  async createPoll(
    channelId: string,
    question: string,
    answers: string[],
    duration: number,
    allowMultiselect: boolean
  ): Promise<DiscordMessage> {
    const data = await this.apiPost(`/channels/${channelId}/messages`, {
      poll: {
        question: { text: question },
        answers: answers.map((text) => ({
          poll_media: { text },
        })),
        duration,
        allow_multiselect: allowMultiselect,
        layout_type: 1,
      },
    });
    return this.mapMessage(data);
  }

  async getForumThreads(
    channelId: string,
    _guildId: string,
    sortBy = 'last_message_time',
    sortOrder = 'desc',
    tagIds?: string[],
    offset = 0
  ): Promise<{ threads: DiscordThread[]; hasMore: boolean; totalResults: number }> {
    const params = new URLSearchParams();
    params.set('sort_by', sortBy);
    params.set('sort_order', sortOrder);
    params.set('limit', '25');
    if (offset > 0) params.set('offset', String(offset));
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        params.append('tag_ids', tagId);
      }
    }

    try {
      const data = await this.apiGet(`/channels/${channelId}/threads/search?${params.toString()}`);
      const threads = (data?.threads || []).map((t: any) => this.mapThread(t));
      return {
        threads,
        hasMore: data?.has_more || false,
        totalResults: data?.total_results || threads.length,
      };
    } catch {
      // Fallback: try the guild active threads endpoint
      try {
        const active = await this.apiGet(`/guilds/${_guildId}/threads/active`);
        const threads = (active?.threads || [])
          .filter((t: any) => t.parent_id === channelId)
          .map((t: any) => this.mapThread(t));
        return { threads, hasMore: false, totalResults: threads.length };
      } catch {
        return { threads: [], hasMore: false, totalResults: 0 };
      }
    }
  }

  async createForumThread(
    channelId: string,
    name: string,
    content: string,
    appliedTags?: string[]
  ): Promise<DiscordThread> {
    const body: any = {
      name,
      message: { content },
    };
    if (appliedTags && appliedTags.length > 0) {
      body.applied_tags = appliedTags;
    }
    const data = await this.apiPost(`/channels/${channelId}/threads`, body);
    return this.mapThread(data);
  }

  async getThreadMessages(
    threadId: string,
    before?: string,
    limit = 50
  ): Promise<DiscordMessage[]> {
    // Threads are just channels, so reuse getMessages
    return this.getMessages(threadId, before, limit);
  }

  async sendThreadMessage(threadId: string, content: string): Promise<DiscordMessage> {
    // Threads are just channels, so reuse sendMessage
    return this.sendMessage(threadId, content);
  }

  cleanup(): void {
    // No server to clean up (unlike Spotify's callback server)
  }

  // --- Private helpers ---

  private mapUser(u: any): DiscordUser {
    return {
      id: u.id,
      username: u.username,
      discriminator: u.discriminator || '0',
      globalName: u.global_name || null,
      avatar: u.avatar || null,
    };
  }

  private mapChannel(ch: any): DiscordChannel {
    return {
      id: ch.id,
      name: ch.name || '',
      type: ch.type,
      parentId: ch.parent_id || null,
      position: ch.position || 0,
      topic: ch.topic || null,
      availableTags: (ch.available_tags || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        moderated: t.moderated || false,
        emojiId: t.emoji_id || null,
        emojiName: t.emoji_name || null,
      })),
    };
  }

  private mapThread(t: any): DiscordThread {
    return {
      id: t.id,
      name: t.name || '',
      parentId: t.parent_id || '',
      ownerId: t.owner_id || '',
      messageCount: t.message_count || 0,
      createdTimestamp: t.thread_metadata?.create_timestamp || null,
      archiveTimestamp: t.thread_metadata?.archive_timestamp || null,
      archived: t.thread_metadata?.archived || false,
      locked: t.thread_metadata?.locked || false,
      lastMessageId: t.last_message_id || null,
      appliedTags: t.applied_tags || [],
    };
  }

  private mapMessage(m: any): DiscordMessage {
    return {
      id: m.id,
      content: m.content || '',
      author: this.mapUser(m.author),
      timestamp: m.timestamp,
      editedTimestamp: m.edited_timestamp || null,
      attachments: (m.attachments || []).map((a: any) => this.mapAttachment(a)),
      embeds: (m.embeds || []).map((e: any) => this.mapEmbed(e)),
      reactions: (m.reactions || []).map((r: any) => this.mapReaction(r)),
      referencedMessage: m.referenced_message ? this.mapMessage(m.referenced_message) : null,
      mentionEveryone: m.mention_everyone || false,
      mentions: (m.mentions || []).map((u: any) => this.mapUser(u)),
      pinned: m.pinned || false,
      type: m.type || 0,
      stickerItems: (m.sticker_items || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        formatType: s.format_type || 1,
      })),
      poll: m.poll ? this.mapPoll(m.poll) : null,
    };
  }

  private mapAttachment(a: any): DiscordAttachment {
    return {
      id: a.id,
      filename: a.filename,
      url: a.url,
      proxyUrl: a.proxy_url || a.url,
      size: a.size || 0,
      contentType: a.content_type || null,
      width: a.width || null,
      height: a.height || null,
    };
  }

  private mapEmbed(e: any): DiscordEmbed {
    return {
      title: e.title || null,
      description: e.description || null,
      url: e.url || null,
      color: e.color ?? null,
      type: e.type || null,
      thumbnail: e.thumbnail
        ? { url: e.thumbnail.url, width: e.thumbnail.width || 0, height: e.thumbnail.height || 0 }
        : null,
      image: e.image
        ? { url: e.image.url, width: e.image.width || 0, height: e.image.height || 0 }
        : null,
      video: e.video
        ? {
            url: e.video.url || e.video.proxy_url,
            width: e.video.width || 0,
            height: e.video.height || 0,
          }
        : null,
      author: e.author
        ? { name: e.author.name, url: e.author.url || null, iconUrl: e.author.icon_url || null }
        : null,
      footer: e.footer ? { text: e.footer.text, iconUrl: e.footer.icon_url || null } : null,
      timestamp: e.timestamp || null,
      provider: e.provider ? { name: e.provider.name, url: e.provider.url || null } : null,
      fields: (e.fields || []).map((f: any) => ({
        name: f.name,
        value: f.value,
        inline: f.inline || false,
      })),
    };
  }

  private mapReaction(r: any): DiscordReaction {
    return {
      emoji: { id: r.emoji?.id || null, name: r.emoji?.name || '' },
      count: r.count || 0,
      me: r.me || false,
    };
  }

  private mapSticker(s: any): DiscordSticker {
    return {
      id: s.id,
      name: s.name,
      description: s.description || null,
      tags: s.tags || '',
      formatType: s.format_type || 1,
      packId: s.pack_id || null,
      guildId: s.guild_id || null,
    };
  }

  private mapPoll(p: any): DiscordPoll {
    return {
      question: { text: p.question?.text || '' },
      answers: (p.answers || []).map((a: any) => ({
        answerId: a.answer_id,
        pollMedia: {
          text: a.poll_media?.text || '',
          emoji: a.poll_media?.emoji
            ? { id: a.poll_media.emoji.id || null, name: a.poll_media.emoji.name || '' }
            : undefined,
        },
      })),
      expiry: p.expiry || null,
      allowMultiselect: p.allow_multiselect || false,
      layoutType: p.layout_type || 1,
      results: p.results
        ? {
            isFinalized: p.results.is_finalized || false,
            answerCounts: (p.results.answer_counts || []).map((ac: any) => ({
              id: ac.id,
              count: ac.count || 0,
              meVoted: ac.me_voted || false,
            })),
          }
        : undefined,
    };
  }

  private async getToken(): Promise<string> {
    let token = await secureStorage.getItem(STORAGE_KEY);
    if (!token) {
      token = database.getSetting('discordToken');
      if (token) {
        await secureStorage.setItem(STORAGE_KEY, token);
      }
    }
    if (!token) {
      throw new Error('Not connected to Discord');
    }
    return token;
  }

  private async apiRequest(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await this.getToken();
    return this.apiRequestWithToken(method, path, token, body);
  }

  private async apiRequestWithToken(
    method: string,
    path: string,
    token: string,
    body?: unknown,
    retries = 0
  ): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${DISCORD_API_BASE}${path}`, options);

    // Handle rate limiting with max 3 retries
    if (response.status === 429 && retries < 3) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.apiRequestWithToken(method, path, token, body, retries + 1);
    }

    return response;
  }

  private async apiGetWithToken(path: string, token: string): Promise<any> {
    const response = await this.apiRequestWithToken('GET', path, token);
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private async apiGet(path: string): Promise<any> {
    const response = await this.apiRequest('GET', path);
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private async apiPost(path: string, body?: unknown): Promise<any> {
    const response = await this.apiRequest('POST', path, body);
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private async apiPut(path: string, body?: unknown): Promise<void> {
    const response = await this.apiRequest('PUT', path, body);
    if (!response.ok && response.status !== 204) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
  }

  private async apiPatch(path: string, body?: unknown): Promise<any> {
    const response = await this.apiRequest('PATCH', path, body);
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private async apiDelete(path: string, body?: unknown): Promise<void> {
    const response = await this.apiRequest('DELETE', path, body);
    if (!response.ok && response.status !== 204) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
  }

  private async apiDeleteNoBody(path: string): Promise<void> {
    const token = await this.getToken();
    const response = await fetch(`${DISCORD_API_BASE}${path}`, {
      method: 'DELETE',
      headers: { Authorization: token },
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
  }
}

export const discordService = new DiscordService();
