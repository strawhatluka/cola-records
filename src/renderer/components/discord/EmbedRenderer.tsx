import type { DiscordEmbed } from '../../../main/ipc/channels';
import { DiscordMarkdown } from './DiscordMarkdown';

interface EmbedRendererProps {
  embed: DiscordEmbed;
}

export function EmbedRenderer({ embed }: EmbedRendererProps) {
  const borderColor = embed.color
    ? `#${embed.color.toString(16).padStart(6, '0')}`
    : 'hsl(var(--muted-foreground))';

  return (
    <div
      className="rounded bg-muted/50 overflow-hidden max-w-[360px] mt-1"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="p-2 space-y-1">
        {embed.author && (
          <div className="flex items-center gap-1.5">
            {embed.author.iconUrl && (
              <img src={embed.author.iconUrl} alt="" className="h-4 w-4 rounded-full" />
            )}
            <span className="text-xs font-medium">{embed.author.name}</span>
          </div>
        )}
        {embed.title && (
          <div className="text-xs font-semibold">
            {embed.url ? (
              <a href={embed.url} target="_blank" rel="noopener noreferrer" className="text-[#00AFF4] hover:underline">
                {embed.title}
              </a>
            ) : (
              embed.title
            )}
          </div>
        )}
        {embed.description && (
          <div className="text-xs text-muted-foreground">
            <DiscordMarkdown content={embed.description} />
          </div>
        )}
        {embed.fields.length > 0 && (
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {embed.fields.map((field, i) => (
              <div key={i} className={field.inline ? '' : 'col-span-full'}>
                <div className="text-[10px] font-semibold">{field.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  <DiscordMarkdown content={field.value} />
                </div>
              </div>
            ))}
          </div>
        )}
        {embed.image && (
          <img
            src={embed.image.url}
            alt=""
            className="rounded max-w-full max-h-[200px] object-contain"
          />
        )}
        {embed.thumbnail && !embed.image && (
          <img
            src={embed.thumbnail.url}
            alt=""
            className="rounded max-w-[80px] max-h-[80px] object-contain"
          />
        )}
      </div>
    </div>
  );
}
