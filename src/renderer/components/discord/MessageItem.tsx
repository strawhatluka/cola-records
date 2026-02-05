import { memo, useState } from 'react';
import { SmilePlus, Reply, Pencil, Trash2, Copy } from 'lucide-react';
import type { DiscordMessage, DiscordStickerItem } from '../../../main/ipc/channels';
import { DiscordMarkdown } from './DiscordMarkdown';
import { EmbedRenderer } from './EmbedRenderer';
import { AttachmentRenderer } from './AttachmentRenderer';
import { ReactionBar } from './ReactionBar';
import { PollRenderer } from './PollRenderer';

interface MessageItemProps {
  message: DiscordMessage;
  currentUserId: string | null;
  onReactionToggle: (messageId: string, emoji: string) => void;
  onReply: (message: DiscordMessage) => void;
  onEdit: (message: DiscordMessage) => void;
  onDelete: (messageId: string) => void;
  onEmojiPick: (messageId: string) => void;
}

function getAvatarUrl(userId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
  }
  const index = Number(BigInt(userId) >> BigInt(22)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

export const MessageItem = memo(function MessageItem({
  message,
  currentUserId,
  onReactionToggle,
  onReply,
  onEdit,
  onDelete,
  onEmojiPick,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const displayName = message.author.globalName || message.author.username;
  const isOwnMessage = currentUserId === message.author.id;

  // System messages (joins, pins, etc.)
  if (message.type !== 0 && message.type !== 19) {
    return (
      <div className="px-3 py-0.5 text-xs text-muted-foreground italic">
        {displayName} {getSystemMessageText(message.type)}
      </div>
    );
  }

  return (
    <div
      className="relative flex gap-2 px-3 py-1 hover:bg-muted/30 group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <img
        src={getAvatarUrl(message.author.id, message.author.avatar)}
        alt={displayName}
        className="h-8 w-8 rounded-full shrink-0 mt-0.5"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold">{displayName}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatMessageTime(message.timestamp)}
            {message.editedTimestamp && ' (edited)'}
          </span>
        </div>

        {/* Reply reference */}
        {message.referencedMessage && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <span className="text-muted-foreground/60">↩</span>
            <span className="font-medium">
              {message.referencedMessage.author.globalName || message.referencedMessage.author.username}
            </span>
            <span className="truncate max-w-[200px]">
              {message.referencedMessage.content}
            </span>
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div className="text-xs">
            <DiscordMarkdown content={message.content} />
          </div>
        )}

        {/* Stickers */}
        {message.stickerItems?.map((sticker) => (
          <StickerRenderer key={sticker.id} sticker={sticker} />
        ))}

        {/* Attachments */}
        {message.attachments.map((att) => (
          <AttachmentRenderer key={att.id} attachment={att} />
        ))}

        {/* Embeds */}
        {message.embeds.map((embed, i) => (
          <EmbedRenderer key={i} embed={embed} />
        ))}

        {/* Poll */}
        {message.poll && <PollRenderer poll={message.poll} />}

        {/* Reactions */}
        <ReactionBar
          reactions={message.reactions}
          onToggle={(emoji) => onReactionToggle(message.id, emoji)}
        />
      </div>

      {/* Hover action bar */}
      {showActions && (
        <div className="absolute right-2 -top-3 flex items-center bg-background border rounded shadow-sm z-10">
          <ActionButton
            icon={<SmilePlus className="h-3.5 w-3.5" />}
            title="Add Reaction"
            onClick={() => onEmojiPick(message.id)}
          />
          <ActionButton
            icon={<Reply className="h-3.5 w-3.5" />}
            title="Reply"
            onClick={() => onReply(message)}
          />
          <ActionButton
            icon={<Copy className="h-3.5 w-3.5" />}
            title="Copy Text"
            onClick={() => navigator.clipboard.writeText(message.content)}
          />
          {isOwnMessage && (
            <>
              <ActionButton
                icon={<Pencil className="h-3.5 w-3.5" />}
                title="Edit"
                onClick={() => onEdit(message)}
              />
              <ActionButton
                icon={<Trash2 className="h-3.5 w-3.5 text-destructive" />}
                title="Delete"
                onClick={() => onDelete(message.id)}
                className="hover:bg-destructive/10"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
});

function ActionButton({
  icon,
  title,
  onClick,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${className}`}
    >
      {icon}
    </button>
  );
}

function StickerRenderer({ sticker }: { sticker: DiscordStickerItem }) {
  // format_type: 1=PNG, 2=APNG, 3=LOTTIE, 4=GIF
  if (sticker.formatType === 3) {
    // Lottie stickers can't be rendered as images — show placeholder
    return (
      <div className="mt-1 h-24 w-24 rounded bg-muted/50 flex items-center justify-center" title={sticker.name}>
        <span className="text-[10px] text-muted-foreground">{sticker.name}</span>
      </div>
    );
  }

  const ext = sticker.formatType === 4 ? 'gif' : 'png';
  const url = `https://media.discordapp.net/stickers/${sticker.id}.${ext}?size=160`;

  return (
    <img
      src={url}
      alt={sticker.name}
      title={sticker.name}
      className="mt-1 h-24 w-24 object-contain"
      loading="lazy"
    />
  );
}

function getSystemMessageText(type: number): string {
  switch (type) {
    case 1: return 'added someone to the group.';
    case 2: return 'removed someone from the group.';
    case 3: return 'started a call.';
    case 4: return 'changed the channel name.';
    case 5: return 'changed the channel icon.';
    case 6: return 'pinned a message.';
    case 7: return 'joined the server.';
    case 8: return 'boosted the server!';
    default: return 'performed an action.';
  }
}
