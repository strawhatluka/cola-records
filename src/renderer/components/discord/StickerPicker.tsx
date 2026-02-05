import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { useDiscordStore } from '../../stores/useDiscordStore';
import type { DiscordSticker, DiscordGuild } from '../../../main/ipc/channels';

interface StickerPickerProps {
  onSelect: (stickerId: string) => void;
  onClose: () => void;
  embedded?: boolean;
  guilds?: DiscordGuild[];
}

function getGuildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=64`;
}

export function StickerPicker({ onSelect, onClose, embedded = false, guilds = [] }: StickerPickerProps) {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { stickerPacks, guildStickers, guilds: storeGuilds, fetchStickerPacks, fetchGuildStickers } = useDiscordStore();
  const fetchedRef = useRef<Set<string>>(new Set());

  const allGuilds = guilds.length > 0 ? guilds : storeGuilds;

  useEffect(() => {
    fetchStickerPacks();
    for (const guild of allGuilds) {
      if (!fetchedRef.current.has(guild.id)) {
        fetchedRef.current.add(guild.id);
        fetchGuildStickers(guild.id);
      }
    }
  }, [fetchStickerPacks, fetchGuildStickers, allGuilds]);

  // Group guild stickers by server
  const guildStickerGroups = useMemo(() => {
    const groups: { guildId: string; guildName: string; guildIcon: string | null; stickers: DiscordSticker[] }[] = [];
    for (const [guildId, stickers] of Object.entries(guildStickers)) {
      if (stickers.length === 0) continue;
      const guild = allGuilds.find((g) => g.id === guildId);
      groups.push({
        guildId,
        guildName: guild?.name || 'Server',
        guildIcon: guild?.icon || null,
        stickers,
      });
    }
    return groups;
  }, [guildStickers, allGuilds]);

  // All sections: guild stickers + sticker packs
  const allSections = useMemo(() => {
    const sections: { id: string; label: string; guildIcon?: string | null; stickers: DiscordSticker[] }[] = [];

    for (const group of guildStickerGroups) {
      sections.push({
        id: `guild-${group.guildId}`,
        label: group.guildName,
        guildIcon: group.guildIcon,
        stickers: group.stickers,
      });
    }

    for (const pack of stickerPacks) {
      sections.push({
        id: `pack-${pack.id}`,
        label: pack.name,
        stickers: pack.stickers,
      });
    }

    return sections;
  }, [guildStickerGroups, stickerPacks]);

  // Filter
  const filtered = query.trim()
    ? allSections.map((section) => ({
        ...section,
        stickers: section.stickers.filter((s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.tags.toLowerCase().includes(query.toLowerCase())
        ),
      })).filter((s) => s.stickers.length > 0)
    : allSections;

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = sectionRefs.current[sectionId];
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // RAF-throttled scroll handler
  const scrollRafRef = useRef(0);
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      if (!scrollRef.current) return;
      const scrollTop = scrollRef.current.scrollTop;
      let closest: string | null = null;
      let closestDist = Infinity;

      for (const [id, el] of Object.entries(sectionRefs.current)) {
        if (!el) continue;
        const dist = Math.abs(el.offsetTop - scrollRef.current.offsetTop - scrollTop);
        if (dist < closestDist) {
          closestDist = dist;
          closest = id;
        }
      }
      if (closest !== activeSection) {
        setActiveSection(closest);
      }
    });
  }, [activeSection]);

  const content = (
    <>
      {/* Search */}
      <div className="px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5 bg-muted rounded px-2">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stickers..."
            className="flex-1 bg-transparent py-1 text-xs placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — server/pack icons */}
        {!query && allSections.length > 0 && (
          <div className="w-11 border-r flex flex-col items-center py-1 gap-0.5 overflow-y-auto shrink-0 styled-scroll">
            {allSections.map((section) => {
              const isGuild = section.id.startsWith('guild-');
              const guildId = isGuild ? section.id.replace('guild-', '') : null;
              const iconUrl = guildId ? getGuildIconUrl(guildId, section.guildIcon || null) : null;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors ${activeSection === section.id ? 'bg-[#5865F2]/20 ring-1 ring-[#5865F2]/40' : 'hover:bg-muted'}`}
                  title={section.label}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt="" className="w-6 h-6 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-[8px] font-bold text-muted-foreground leading-tight text-center">
                      {section.label.slice(0, 3)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Sticker grid */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-1.5 pb-1.5 styled-scroll"
        >
          {filtered.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-4">No stickers found</p>
          )}
          {filtered.map((section) => (
            <div
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el; }}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1 py-1.5 sticky top-0 bg-background z-10">
                {section.label}
              </p>
              <div className="grid grid-cols-4 gap-1">
                {section.stickers.map((sticker) => {
                  const ext = sticker.formatType === 4 ? 'gif' : 'png';
                  const url = `https://media.discordapp.net/stickers/${sticker.id}.${ext}?size=96`;
                  const isLottie = sticker.formatType === 3;

                  return (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => onSelect(sticker.id)}
                      className="flex items-center justify-center h-16 w-full rounded hover:bg-muted transition-colors p-1"
                      title={sticker.name}
                    >
                      {isLottie ? (
                        <span className="text-[9px] text-muted-foreground text-center">{sticker.name}</span>
                      ) : (
                        <img
                          src={url}
                          alt={sticker.name}
                          className="max-h-14 max-w-14 object-contain"
                          loading="lazy"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <>{content}</>;
  }

  return (
    <div className="absolute bottom-14 right-2 w-[28vw] min-w-[340px] bg-background border rounded-lg shadow-lg z-20 flex flex-col h-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold">Stickers</span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {content}
    </div>
  );
}
