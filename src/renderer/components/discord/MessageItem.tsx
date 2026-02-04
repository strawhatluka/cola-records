import type { DiscordMessage } from '../../../main/ipc/channels';
import { DiscordMarkdown } from './DiscordMarkdown';
import { EmbedRenderer } from './EmbedRenderer';
import { AttachmentRenderer } from './AttachmentRenderer';
import { ReactionBar } from './ReactionBar';

interface MessageItemProps {
  message: DiscordMessage;
  onReactionToggle: (messageId: string, emoji: string) => void;
}

function getAvatarUrl(userId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
  }
  // Default avatar based on user ID
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

export function MessageItem({ message, onReactionToggle }: MessageItemProps) {
  const displayName = message.author.globalName || message.author.username;

  // System messages (joins, pins, etc.)
  if (message.type !== 0 && message.type !== 19) {
    return (
      <div className="px-3 py-0.5 text-xs text-muted-foreground italic">
        {displayName} {getSystemMessageText(message.type)}
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-3 py-1 hover:bg-muted/30 group">
      <img
        src={getAvatarUrl(message.author.id, message.author.avatar)}
        alt={displayName}
        className="h-8 w-8 rounded-full shrink-0 mt-0.5"
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

        {/* Attachments */}
        {message.attachments.map((att) => (
          <AttachmentRenderer key={att.id} attachment={att} />
        ))}

        {/* Embeds */}
        {message.embeds.map((embed, i) => (
          <EmbedRenderer key={i} embed={embed} />
        ))}

        {/* Reactions */}
        <ReactionBar
          reactions={message.reactions}
          onToggle={(emoji) => onReactionToggle(message.id, emoji)}
        />
      </div>
    </div>
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
