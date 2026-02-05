import type { DiscordReaction } from '../../../main/ipc/channels';

interface ReactionBarProps {
  reactions: DiscordReaction[];
  onToggle: (emoji: string) => void;
}

export function ReactionBar({ reactions, onToggle }: ReactionBarProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction, i) => {
        const emojiStr = reaction.emoji.id
          ? `${reaction.emoji.name}:${reaction.emoji.id}`
          : reaction.emoji.name;

        const isCustom = !!reaction.emoji.id;

        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(emojiStr)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
              reaction.me
                ? 'border-[#5865F2]/50 bg-[#5865F2]/10 text-[#5865F2]'
                : 'border-transparent bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            {isCustom ? (
              <img
                src={`https://cdn.discordapp.com/emojis/${reaction.emoji.id}.png`}
                alt={reaction.emoji.name}
                className="h-3.5 w-3.5"
                loading="lazy"
              />
            ) : (
              <span>{reaction.emoji.name}</span>
            )}
            <span>{reaction.count}</span>
          </button>
        );
      })}
    </div>
  );
}
