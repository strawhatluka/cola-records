import { useMemo, useState, type ReactNode } from 'react';

interface DiscordMarkdownProps {
  content: string;
}

// Parse Discord-flavored markdown into React elements
export function DiscordMarkdown({ content }: DiscordMarkdownProps) {
  if (!content) return null;

  // First handle code blocks (``` ```) to avoid processing markdown inside them
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3);
          const newlineIndex = inner.indexOf('\n');
          const lang = newlineIndex > 0 ? inner.slice(0, newlineIndex).trim() : '';
          const code = newlineIndex > 0 ? inner.slice(newlineIndex + 1) : inner;
          return (
            <pre key={i} className="bg-muted rounded px-2 py-1.5 my-1 text-xs overflow-x-auto">
              <code className={lang ? `language-${lang}` : ''}>{code}</code>
            </pre>
          );
        }
        return <InlineMarkdown key={i} text={part} />;
      })}
    </span>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Process inline patterns in order of precedence
  const tokens = useMemo(() => tokenize(text), [text]);
  return <>{tokens.map((token, i) => renderToken(token, i))}</>;
}

interface Token {
  type:
    | 'text'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'code'
    | 'spoiler'
    | 'blockquote'
    | 'emote'
    | 'animatedEmote'
    | 'userMention'
    | 'channelMention'
    | 'roleMention'
    | 'timestamp'
    | 'link';
  content: string;
  extra?: string; // For emotes: id, for timestamps: format
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Combined regex for all inline patterns
  const regex =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|( ~~(.+?)~~)|(``(.+?)``)|(`(.+?)`)|(\|\|(.+?)\|\|)|(<a?:(\w+):(\d+)>)|(<@!?(\d+)>)|(<#(\d+)>)|(<@&(\d+)>)|(<t:(\d+)(?::([tTdDfFR]))?>)|(https?:\/\/[^\s<]+)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      tokens.push({ type: 'bold', content: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'italic', content: match[4] });
    } else if (match[5]) {
      tokens.push({ type: 'underline', content: match[6] });
    } else if (match[7]) {
      tokens.push({ type: 'strikethrough', content: match[8] });
    } else if (match[9]) {
      tokens.push({ type: 'code', content: match[10] });
    } else if (match[11]) {
      tokens.push({ type: 'code', content: match[12] });
    } else if (match[13]) {
      tokens.push({ type: 'spoiler', content: match[14] });
    } else if (match[15]) {
      const isAnimated = match[15].startsWith('<a:');
      tokens.push({
        type: isAnimated ? 'animatedEmote' : 'emote',
        content: match[16],
        extra: match[17],
      });
    } else if (match[18]) {
      tokens.push({ type: 'userMention', content: match[19] });
    } else if (match[20]) {
      tokens.push({ type: 'channelMention', content: match[21] });
    } else if (match[22]) {
      tokens.push({ type: 'roleMention', content: match[23] });
    } else if (match[24]) {
      tokens.push({ type: 'timestamp', content: match[25], extra: match[26] || 'f' });
    } else if (match[27]) {
      tokens.push({ type: 'link', content: match[27] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return tokens;
}

function renderToken(token: Token, key: number): ReactNode {
  switch (token.type) {
    case 'text': {
      // Handle blockquotes in text
      const lines = token.content.split('\n');
      return (
        <span key={key}>
          {lines.map((line, i) => {
            const isQuote = line.startsWith('> ');
            return (
              <span key={i}>
                {i > 0 && <br />}
                {isQuote ? (
                  <span className="border-l-2 border-muted-foreground/40 pl-2 text-muted-foreground">
                    {line.slice(2)}
                  </span>
                ) : (
                  line
                )}
              </span>
            );
          })}
        </span>
      );
    }
    case 'bold':
      return <strong key={key}>{token.content}</strong>;
    case 'italic':
      return <em key={key}>{token.content}</em>;
    case 'underline':
      return <u key={key}>{token.content}</u>;
    case 'strikethrough':
      return <s key={key}>{token.content}</s>;
    case 'code':
      return (
        <code key={key} className="bg-muted px-1 py-0.5 rounded text-xs">
          {token.content}
        </code>
      );
    case 'spoiler':
      return <SpoilerText key={key} content={token.content} />;
    case 'emote':
      return (
        <img
          key={key}
          src={`https://cdn.discordapp.com/emojis/${token.extra}.png`}
          alt={`:${token.content}:`}
          title={`:${token.content}:`}
          className="inline-block h-5 w-5 align-text-bottom"
          loading="lazy"
        />
      );
    case 'animatedEmote':
      return (
        <img
          key={key}
          src={`https://cdn.discordapp.com/emojis/${token.extra}.gif`}
          alt={`:${token.content}:`}
          title={`:${token.content}:`}
          className="inline-block h-5 w-5 align-text-bottom"
          loading="lazy"
        />
      );
    case 'userMention':
      return (
        <span key={key} className="bg-[#5865F2]/20 text-[#5865F2] rounded px-1 text-xs font-medium">
          @user
        </span>
      );
    case 'channelMention':
      return (
        <span key={key} className="bg-[#5865F2]/20 text-[#5865F2] rounded px-1 text-xs font-medium">
          #channel
        </span>
      );
    case 'roleMention':
      return (
        <span key={key} className="bg-[#5865F2]/20 text-[#5865F2] rounded px-1 text-xs font-medium">
          @role
        </span>
      );
    case 'timestamp': {
      const epoch = parseInt(token.content, 10);
      const date = new Date(epoch * 1000);
      return (
        <span key={key} className="bg-muted px-1 rounded text-xs" title={date.toISOString()}>
          {formatTimestamp(date, token.extra || 'f')}
        </span>
      );
    }
    case 'link':
      return (
        <a
          key={key}
          href={token.content}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00AFF4] hover:underline"
        >
          {token.content}
        </a>
      );
    default:
      return <span key={key}>{token.content}</span>;
  }
}

function SpoilerText({ content }: { content: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setRevealed(true)}
      onKeyDown={(e) => e.key === 'Enter' && setRevealed(true)}
      className={`rounded px-1 cursor-pointer transition-colors ${
        revealed ? 'bg-muted' : 'bg-foreground/80 text-transparent hover:bg-foreground/60'
      }`}
    >
      {content}
    </span>
  );
}

function formatTimestamp(date: Date, format: string): string {
  switch (format) {
    case 't':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'T':
      return date.toLocaleTimeString();
    case 'd':
      return date.toLocaleDateString();
    case 'D':
      return date.toLocaleDateString([], { dateStyle: 'long' });
    case 'f':
      return date.toLocaleString([], { dateStyle: 'long', timeStyle: 'short' });
    case 'F':
      return date.toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });
    case 'R': {
      const diff = Date.now() - date.getTime();
      const seconds = Math.floor(Math.abs(diff) / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const suffix = diff > 0 ? 'ago' : 'from now';
      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${suffix}`;
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${suffix}`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ${suffix}`;
      return `${seconds} second${seconds !== 1 ? 's' : ''} ${suffix}`;
    }
    default:
      return date.toLocaleString();
  }
}
