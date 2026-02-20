export interface DiscordAPIUser {
  id: string;
  username: string;
  discriminator?: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordAPIGuild {
  id: string;
  name: string;
  icon: string | null;
  owner_id?: string;
}

export interface DiscordAPIChannelTag {
  id: string;
  name: string;
  moderated?: boolean;
  emoji_id?: string | null;
  emoji_name?: string | null;
}

export interface DiscordAPIChannel {
  id: string;
  name?: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
  available_tags?: DiscordAPIChannelTag[];
  recipients?: DiscordAPIUser[];
  last_message_id?: string | null;
}

export interface DiscordAPIEmojiRef {
  id: string | null;
  name: string;
}

export interface DiscordAPIReaction {
  emoji: DiscordAPIEmojiRef;
  count: number;
  me: boolean;
}

export interface DiscordAPIAttachment {
  id: string;
  filename: string;
  url: string;
  proxy_url?: string;
  size?: number;
  content_type?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface DiscordAPIEmbedMedia {
  url: string;
  proxy_url?: string;
  width?: number;
  height?: number;
}

export interface DiscordAPIEmbed {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  color?: number | null;
  type?: string | null;
  thumbnail?: DiscordAPIEmbedMedia | null;
  image?: DiscordAPIEmbedMedia | null;
  video?: DiscordAPIEmbedMedia | null;
  author?: { name: string; url?: string | null; icon_url?: string | null } | null;
  footer?: { text: string; icon_url?: string | null } | null;
  timestamp?: string | null;
  provider?: { name: string; url?: string | null } | null;
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface DiscordAPIStickerItem {
  id: string;
  name: string;
  format_type?: number;
}

export interface DiscordAPISticker {
  id: string;
  name: string;
  description?: string | null;
  tags?: string;
  format_type?: number;
  pack_id?: string | null;
  guild_id?: string | null;
}

export interface DiscordAPIStickerPack {
  id: string;
  name: string;
  description?: string;
  banner_asset_id?: string | null;
  stickers?: DiscordAPISticker[];
}

export interface DiscordAPIPollAnswer {
  answer_id: number;
  poll_media: {
    text?: string;
    emoji?: { id: string | null; name: string };
  };
}

export interface DiscordAPIPollAnswerCount {
  id: number;
  count: number;
  me_voted: boolean;
}

export interface DiscordAPIPoll {
  question: { text: string };
  answers: DiscordAPIPollAnswer[];
  expiry: string | null;
  allow_multiselect: boolean;
  layout_type: number;
  results?: {
    is_finalized: boolean;
    answer_counts: DiscordAPIPollAnswerCount[];
  };
}

export interface DiscordAPIMessage {
  id: string;
  content?: string;
  author: DiscordAPIUser;
  timestamp: string;
  edited_timestamp?: string | null;
  attachments?: DiscordAPIAttachment[];
  embeds?: DiscordAPIEmbed[];
  reactions?: DiscordAPIReaction[];
  referenced_message?: DiscordAPIMessage | null;
  mention_everyone?: boolean;
  mentions?: DiscordAPIUser[];
  pinned?: boolean;
  type?: number;
  sticker_items?: DiscordAPIStickerItem[];
  poll?: DiscordAPIPoll | null;
}

export interface DiscordAPIThreadMetadata {
  create_timestamp?: string | null;
  archive_timestamp?: string | null;
  archived?: boolean;
  locked?: boolean;
}

export interface DiscordAPIThread {
  id: string;
  name?: string;
  parent_id?: string;
  owner_id?: string;
  message_count?: number;
  thread_metadata?: DiscordAPIThreadMetadata;
  last_message_id?: string | null;
  applied_tags?: string[];
}

export interface DiscordAPIEmoji {
  id: string;
  name: string;
  animated?: boolean;
}

export interface DiscordAPIGif {
  url: string;
  preview?: string;
  gif_src?: string;
  width?: number;
  height?: number;
}

export interface DiscordAPIStickerPacksResponse {
  sticker_packs: DiscordAPIStickerPack[];
}

export interface DiscordAPIThreadSearchResponse {
  threads?: DiscordAPIThread[];
  has_more?: boolean;
  total_results?: number;
}

export interface DiscordAPIActiveThreadsResponse {
  threads?: DiscordAPIThread[];
}
