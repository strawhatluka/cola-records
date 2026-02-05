import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Hash, Volume2, Megaphone, MessageSquareText } from 'lucide-react';
import { useDiscordStore } from '../../stores/useDiscordStore';
import type { DiscordChannel } from '../../../main/ipc/channels';

export function ChannelList() {
  const { guilds, selectedGuildId, selectedChannelId, selectedForumChannelId, guildChannels, openChannel, openForumChannel } = useDiscordStore();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const guild = guilds.find((g) => g.id === selectedGuildId);
  const channels = selectedGuildId ? (guildChannels[selectedGuildId] || []) : [];

  // Group channels by category
  const categories = channels.filter((ch) => ch.type === 4).sort((a, b) => a.position - b.position);
  const uncategorized = channels.filter(
    (ch) => ch.type !== 4 && !ch.parentId
  ).sort((a, b) => a.position - b.position);

  const toggleCategory = (id: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getChannelsByParent = (parentId: string): DiscordChannel[] =>
    channels.filter((ch) => ch.parentId === parentId && ch.type !== 4)
      .sort((a, b) => a.position - b.position);

  // text, announcement, voice, forum are all clickable
  const isClickable = (type: number) => type === 0 || type === 5 || type === 2 || type === 15;

  const handleChannelClick = (ch: DiscordChannel) => {
    if (ch.type === 15) {
      // Forum channel — open forum thread list
      openForumChannel(ch.id, ch.name);
    } else if (ch.type === 2) {
      // Voice channel — open text chat for the voice channel
      openChannel(ch.id, ch.name, 'voice');
    } else {
      openChannel(ch.id, ch.name, 'text');
    }
  };

  const isActive = (ch: DiscordChannel) =>
    ch.id === selectedChannelId || ch.id === selectedForumChannelId;

  return (
    <div className="flex flex-col h-full">
      {/* Server name header */}
      <div className="px-3 py-2 border-b shrink-0">
        <h3 className="text-xs font-semibold truncate">{guild?.name || 'Server'}</h3>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-1 discord-scroll">
        {/* Uncategorized channels */}
        {uncategorized.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            clickable={isClickable(ch.type)}
            active={isActive(ch)}
            onClick={() => handleChannelClick(ch)}
          />
        ))}

        {/* Categorized channels */}
        {categories.map((cat) => {
          const isCollapsed = collapsedCategories.has(cat.id);
          const children = getChannelsByParent(cat.id);

          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="flex items-center gap-0.5 w-full px-1 py-1 text-[10px] font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-2.5 w-2.5" />
                ) : (
                  <ChevronDown className="h-2.5 w-2.5" />
                )}
                {cat.name}
              </button>
              {!isCollapsed &&
                children.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    clickable={isClickable(ch.type)}
                    active={isActive(ch)}
                    onClick={() => handleChannelClick(ch)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChannelItem = memo(function ChannelItem({
  channel,
  clickable,
  active,
  onClick,
}: {
  channel: DiscordChannel;
  clickable: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = getChannelIcon(channel.type);

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`flex items-center gap-1.5 w-full px-3 py-1 text-xs transition-colors rounded-sm mx-0.5 ${
        active
          ? 'bg-muted text-foreground font-medium'
          : clickable
            ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer'
            : 'text-muted-foreground/50 cursor-default'
      }`}
      style={{ width: 'calc(100% - 4px)' }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{channel.name}</span>
    </button>
  );
});

function getChannelIcon(type: number) {
  switch (type) {
    case 2:
    case 13:
      return Volume2; // voice / stage
    case 5:
      return Megaphone; // announcement
    case 15:
      return MessageSquareText; // forum
    default:
      return Hash; // text
  }
}
