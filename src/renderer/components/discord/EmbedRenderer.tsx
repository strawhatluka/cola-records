import type { DiscordEmbed } from '../../../main/ipc/channels';
import { DiscordMarkdown } from './DiscordMarkdown';

interface EmbedRendererProps {
  embed: DiscordEmbed;
}

export function EmbedRenderer({ embed }: EmbedRendererProps) {
  const borderColor = embed.color
    ? `#${embed.color.toString(16).padStart(6, '0')}`
    : 'hsl(var(--muted-foreground))';

  // gifv embeds (Tenor, Giphy, etc.)
  if (embed.type === 'gifv' && embed.video) {
    return (
      <div className="mt-1 max-w-[320px]">
        <video
          src={embed.video.url}
          autoPlay
          loop
          muted
          playsInline
          className="rounded max-w-full max-h-[250px]"
        />
        {embed.provider && (
          <span className="text-[9px] text-muted-foreground">{embed.provider.name}</span>
        )}
      </div>
    );
  }

  // Video embeds (YouTube, etc.)
  if (embed.type === 'video' && embed.video) {
    return (
      <div className="mt-1 max-w-[360px]">
        <div
          className="rounded bg-muted/50 overflow-hidden"
          style={{ borderLeft: `3px solid ${borderColor}` }}
        >
          <div className="p-2 space-y-1">
            {embed.provider && (
              <span className="text-[10px] text-muted-foreground">{embed.provider.name}</span>
            )}
            {embed.author && (
              <div className="flex items-center gap-1.5">
                {embed.author.iconUrl && (
                  <img
                    src={embed.author.iconUrl}
                    alt=""
                    className="h-4 w-4 rounded-full"
                    loading="lazy"
                  />
                )}
                <span className="text-xs font-medium">{embed.author.name}</span>
              </div>
            )}
            {embed.title && (
              <div className="text-xs font-semibold">
                {embed.url ? (
                  <a
                    href={embed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00AFF4] hover:underline"
                  >
                    {embed.title}
                  </a>
                ) : (
                  embed.title
                )}
              </div>
            )}
          </div>
          {embed.thumbnail && (
            <a
              href={embed.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative"
            >
              <img
                src={embed.thumbnail.url}
                alt=""
                className="w-full max-h-[200px] object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white ml-0.5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Image-only embeds
  if (embed.type === 'image' && embed.thumbnail) {
    return (
      <a href={embed.url || '#'} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={embed.thumbnail.url}
          alt=""
          className="rounded max-w-[320px] max-h-[300px] object-contain"
          loading="lazy"
        />
      </a>
    );
  }

  // Standard rich embeds
  return (
    <div
      className="rounded bg-muted/50 overflow-hidden max-w-[360px] mt-1"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="p-2 space-y-1">
        {embed.provider && (
          <span className="text-[10px] text-muted-foreground">{embed.provider.name}</span>
        )}
        {embed.author && (
          <div className="flex items-center gap-1.5">
            {embed.author.iconUrl && (
              <img
                src={embed.author.iconUrl}
                alt=""
                className="h-4 w-4 rounded-full"
                loading="lazy"
              />
            )}
            {embed.author.url ? (
              <a
                href={embed.author.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium hover:underline"
              >
                {embed.author.name}
              </a>
            ) : (
              <span className="text-xs font-medium">{embed.author.name}</span>
            )}
          </div>
        )}
        {embed.title && (
          <div className="text-xs font-semibold">
            {embed.url ? (
              <a
                href={embed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00AFF4] hover:underline"
              >
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
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          >
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
            loading="lazy"
          />
        )}
        {embed.thumbnail && !embed.image && (
          <img
            src={embed.thumbnail.url}
            alt=""
            className="rounded max-w-[80px] max-h-[80px] object-contain float-right ml-2"
            loading="lazy"
          />
        )}

        {/* Footer + timestamp */}
        {(embed.footer || embed.timestamp) && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/30 clear-both">
            {embed.footer?.iconUrl && (
              <img
                src={embed.footer.iconUrl}
                alt=""
                className="h-4 w-4 rounded-full shrink-0"
                loading="lazy"
              />
            )}
            <span className="text-[10px] text-muted-foreground">
              {embed.footer?.text}
              {embed.footer?.text && embed.timestamp && ' \u2022 '}
              {embed.timestamp && formatEmbedTimestamp(embed.timestamp)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatEmbedTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
