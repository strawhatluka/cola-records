import { MessageSquare } from 'lucide-react';
import { useDiscordStore } from '../../stores/useDiscordStore';

export function ServerList() {
  const { guilds, selectedGuildId, view, selectGuild, selectDMs } = useDiscordStore();
  const isDMsActive = view === 'dms' || (view === 'messages' && !selectedGuildId);

  return (
    <div className="w-14 bg-muted/30 border-r flex flex-col items-center py-2 gap-1.5 overflow-y-auto shrink-0 styled-scroll">
      {/* DM button */}
      <button
        type="button"
        onClick={selectDMs}
        className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-[border-radius,background-color] ${
          isDMsActive
            ? 'bg-[#5865F2] text-white rounded-xl'
            : 'bg-muted hover:bg-muted/80 hover:rounded-xl text-muted-foreground'
        }`}
        title="Direct Messages"
      >
        {isDMsActive && (
          <div className="absolute left-[-6px] w-1 h-6 bg-foreground rounded-r" />
        )}
        <MessageSquare className="h-4 w-4" />
      </button>

      {/* Divider */}
      <div className="w-6 h-px bg-border my-0.5" />

      {/* Server icons */}
      {guilds.map((guild) => {
        const isActive = selectedGuildId === guild.id;
        const iconUrl = guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
          : null;
        const initials = guild.name
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <button
            key={guild.id}
            type="button"
            onClick={() => selectGuild(guild.id)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-2xl transition-[border-radius,background-color] overflow-hidden ${
              isActive
                ? 'rounded-xl ring-2 ring-[#5865F2]'
                : 'hover:rounded-xl'
            }`}
            title={guild.name}
          >
            {isActive && (
              <div className="absolute left-[-6px] w-1 h-6 bg-foreground rounded-r" />
            )}
            {iconUrl ? (
              <img src={iconUrl} alt={guild.name} className="h-10 w-10 object-cover" loading="lazy" />
            ) : (
              <div className="h-10 w-10 bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                {initials}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
