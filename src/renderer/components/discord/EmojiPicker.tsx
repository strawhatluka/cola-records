import { useState, useRef, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import type { DiscordEmoji, DiscordGuild } from '../../../main/ipc/channels';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  customEmojis?: DiscordEmoji[];
  guilds?: DiscordGuild[];
}

const STANDARD_CATEGORIES: { id: string; name: string; icon: string; emojis: string[] }[] = [
  {
    id: 'frequent',
    name: 'Frequently Used',
    icon: '\u{1F552}',
    emojis: [
      '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F622}', '\u{1F621}',
      '\u{1F44E}', '\u{1F440}', '\u{1F525}', '\u{2705}', '\u{274C}',
      '\u{1F389}', '\u{1F914}', '\u{1F60D}', '\u{1F60E}', '\u{1F631}',
    ],
  },
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: '\u{1F600}',
    emojis: [
      '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F605}',
      '\u{1F606}', '\u{1F923}', '\u{1F602}', '\u{1F642}', '\u{1F643}',
      '\u{1F609}', '\u{1F60A}', '\u{1F607}', '\u{1F970}', '\u{1F60D}',
      '\u{1F929}', '\u{1F618}', '\u{1F617}', '\u{1F61A}', '\u{1F619}',
      '\u{1F60B}', '\u{1F61B}', '\u{1F61C}', '\u{1F92A}', '\u{1F61D}',
      '\u{1F911}', '\u{1F917}', '\u{1F92D}', '\u{1F92B}', '\u{1F914}',
      '\u{1F910}', '\u{1F928}', '\u{1F610}', '\u{1F611}', '\u{1F636}',
      '\u{1F60F}', '\u{1F612}', '\u{1F644}', '\u{1F62C}', '\u{1F925}',
      '\u{1F60C}', '\u{1F614}', '\u{1F62A}', '\u{1F924}', '\u{1F634}',
      '\u{1F637}', '\u{1F912}', '\u{1F915}', '\u{1F922}', '\u{1F92E}',
      '\u{1F927}', '\u{1F975}', '\u{1F976}', '\u{1F974}', '\u{1F635}',
      '\u{1F62F}', '\u{1F632}', '\u{1F633}', '\u{1F97A}', '\u{1F626}',
      '\u{1F627}', '\u{1F628}', '\u{1F630}', '\u{1F625}', '\u{1F622}',
      '\u{1F62D}', '\u{1F631}', '\u{1F616}', '\u{1F623}', '\u{1F61E}',
      '\u{1F613}', '\u{1F629}', '\u{1F62B}', '\u{1F624}', '\u{1F621}',
      '\u{1F620}', '\u{1F92C}', '\u{1F608}', '\u{1F47F}', '\u{1F480}',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures & Body',
    icon: '\u{1F44B}',
    emojis: [
      '\u{1F44D}', '\u{1F44E}', '\u{1F44A}', '\u{270A}', '\u{1F91B}',
      '\u{1F91C}', '\u{1F44F}', '\u{1F64C}', '\u{1F450}', '\u{1F932}',
      '\u{1F91D}', '\u{1F64F}', '\u{270D}\u{FE0F}', '\u{1F485}', '\u{1F933}',
      '\u{1F4AA}', '\u{1F9B6}', '\u{1F9B5}', '\u{1F442}', '\u{1F443}',
      '\u{1F44B}', '\u{1F91A}', '\u{1F590}\u{FE0F}', '\u{270B}', '\u{1F596}',
      '\u{1F44C}', '\u{1F90C}', '\u{1F90F}', '\u{270C}\u{FE0F}', '\u{1F91E}',
      '\u{1F91F}', '\u{1F918}', '\u{1F919}', '\u{1F448}', '\u{1F449}',
      '\u{1F446}', '\u{1F595}', '\u{1F447}', '\u{261D}\u{FE0F}', '\u{1FAF5}',
    ],
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    icon: '\u{1F43E}',
    emojis: [
      '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}',
      '\u{1F98A}', '\u{1F43B}', '\u{1F43C}', '\u{1F428}', '\u{1F42F}',
      '\u{1F981}', '\u{1F42E}', '\u{1F437}', '\u{1F438}', '\u{1F435}',
      '\u{1F412}', '\u{1F414}', '\u{1F427}', '\u{1F426}', '\u{1F985}',
      '\u{1F989}', '\u{1F987}', '\u{1F43A}', '\u{1F417}', '\u{1F434}',
      '\u{1F984}', '\u{1F41D}', '\u{1F41B}', '\u{1F98B}', '\u{1F40C}',
      '\u{1F41E}', '\u{1F41C}', '\u{1F99F}', '\u{1F997}', '\u{1F577}\u{FE0F}',
      '\u{1F339}', '\u{1F33B}', '\u{1F337}', '\u{1F332}', '\u{1F334}',
      '\u{1F335}', '\u{1F33F}', '\u{2618}\u{FE0F}', '\u{1F340}', '\u{1F341}',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '\u{1F354}',
    emojis: [
      '\u{1F34E}', '\u{1F34F}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}',
      '\u{1F349}', '\u{1F347}', '\u{1F353}', '\u{1FAD0}', '\u{1F348}',
      '\u{1F352}', '\u{1F351}', '\u{1F96D}', '\u{1F34D}', '\u{1F965}',
      '\u{1F354}', '\u{1F355}', '\u{1F32E}', '\u{1F32F}', '\u{1F959}',
      '\u{1F9C6}', '\u{1F96A}', '\u{1F373}', '\u{1F958}', '\u{1F372}',
      '\u{1F35C}', '\u{1F363}', '\u{1F371}', '\u{1F364}', '\u{1F35F}',
      '\u{2615}', '\u{1F375}', '\u{1F376}', '\u{1F37A}', '\u{1F37B}',
      '\u{1F377}', '\u{1F378}', '\u{1F379}', '\u{1F9CB}', '\u{1F9C3}',
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts & Symbols',
    icon: '\u{2764}\u{FE0F}',
    emojis: [
      '\u{2764}\u{FE0F}', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}',
      '\u{1F49C}', '\u{1F5A4}', '\u{1F90D}', '\u{1F90E}', '\u{1F498}',
      '\u{1F49D}', '\u{1F496}', '\u{1F497}', '\u{1F493}', '\u{1F49E}',
      '\u{1F495}', '\u{1F49F}', '\u{2763}\u{FE0F}', '\u{1F494}', '\u{2B50}',
      '\u{1F31F}', '\u{1F4AB}', '\u{2728}', '\u{1F525}', '\u{1F4A5}',
      '\u{1F4A2}', '\u{1F4A6}', '\u{1F4A8}', '\u{1F573}\u{FE0F}', '\u{1F4A3}',
      '\u{1F4AC}', '\u{1F4AD}', '\u{1F5EF}\u{FE0F}', '\u{1F4A4}', '\u{1F44B}',
    ],
  },
  {
    id: 'objects',
    name: 'Objects & Activities',
    icon: '\u{1F3AE}',
    emojis: [
      '\u{1F389}', '\u{1F38A}', '\u{1F388}', '\u{1F381}', '\u{1F3C6}',
      '\u{1F3C5}', '\u{1F947}', '\u{1F948}', '\u{1F949}', '\u{26BD}',
      '\u{1F3AE}', '\u{1F3B5}', '\u{1F3B6}', '\u{1F3A4}', '\u{1F3A7}',
      '\u{1F4BB}', '\u{1F4F1}', '\u{1F4A1}', '\u{1F4D6}', '\u{2705}',
      '\u{274C}', '\u{2757}', '\u{2753}', '\u{1F4AF}', '\u{1F6A9}',
      '\u{1F3C0}', '\u{1F3C8}', '\u{26BE}', '\u{1F3BE}', '\u{1F3D0}',
      '\u{1F3B3}', '\u{1F3CF}', '\u{1F3D1}', '\u{1F3D2}', '\u{1F94F}',
      '\u{1F3D3}', '\u{1F94E}', '\u{1F94D}', '\u{1F3AF}', '\u{1FA80}',
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: '\u{1F3F3}\u{FE0F}',
    emojis: [
      '\u{1F1FA}\u{1F1F8}', '\u{1F1EC}\u{1F1E7}', '\u{1F1E8}\u{1F1E6}', '\u{1F1E6}\u{1F1FA}', '\u{1F1E9}\u{1F1EA}',
      '\u{1F1EB}\u{1F1F7}', '\u{1F1EE}\u{1F1F9}', '\u{1F1EA}\u{1F1F8}', '\u{1F1E7}\u{1F1F7}', '\u{1F1EF}\u{1F1F5}',
      '\u{1F1F0}\u{1F1F7}', '\u{1F1F2}\u{1F1FD}', '\u{1F1F7}\u{1F1FA}', '\u{1F1EE}\u{1F1F3}', '\u{1F1E8}\u{1F1F3}',
      '\u{1F3F4}', '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}', '\u{1F3F3}\u{FE0F}\u{200D}\u{26A7}\u{FE0F}', '\u{1F3F4}\u{200D}\u{2620}\u{FE0F}', '\u{1F6A9}',
    ],
  },
];

function getGuildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=32`;
}

export function EmojiPicker({ onSelect, onClose, customEmojis = [], guilds = [] }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string>('frequent');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lowerSearch = search.toLowerCase();

  // Group custom emojis by guild
  const guildEmojiGroups = useMemo(() => {
    const groups: { guildId: string; guildName: string; guildIcon: string | null; emojis: DiscordEmoji[] }[] = [];
    const byGuild = new Map<string, DiscordEmoji[]>();

    for (const emoji of customEmojis) {
      const existing = byGuild.get(emoji.guildId);
      if (existing) {
        existing.push(emoji);
      } else {
        byGuild.set(emoji.guildId, [emoji]);
      }
    }

    for (const [guildId, emojis] of byGuild) {
      const guild = guilds.find((g) => g.id === guildId);
      groups.push({
        guildId,
        guildName: guild?.name || 'Server',
        guildIcon: guild?.icon || null,
        emojis,
      });
    }

    return groups;
  }, [customEmojis, guilds]);

  // Filter
  const filteredGuildGroups = search
    ? guildEmojiGroups.map((g) => ({
        ...g,
        emojis: g.emojis.filter((e) => e.name.toLowerCase().includes(lowerSearch)),
      })).filter((g) => g.emojis.length > 0)
    : guildEmojiGroups;

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = sectionRefs.current[sectionId];
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Track which section is visible on scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    let closest = activeSection;
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
  };

  return (
    <div className="absolute bottom-14 right-2 w-[25vw] min-w-[300px] bg-background border rounded-lg shadow-lg z-20 flex flex-col h-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-xs font-semibold">Emoji</span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5 bg-muted rounded px-2">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="flex-1 bg-transparent py-1 text-xs placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — server/category icons */}
        {!search && (
          <div className="w-9 border-r flex flex-col items-center py-1 gap-0.5 overflow-y-auto shrink-0">
            {/* Server emoji groups */}
            {guildEmojiGroups.map((group) => {
              const iconUrl = getGuildIconUrl(group.guildId, group.guildIcon);
              return (
                <button
                  key={group.guildId}
                  type="button"
                  onClick={() => scrollToSection(`guild-${group.guildId}`)}
                  className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${activeSection === `guild-${group.guildId}` ? 'bg-[#5865F2]/20 ring-1 ring-[#5865F2]/40' : 'hover:bg-muted'}`}
                  title={group.guildName}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {group.guildName.slice(0, 2)}
                    </span>
                  )}
                </button>
              );
            })}

            {guildEmojiGroups.length > 0 && (
              <div className="w-5 border-t border-border/50 my-0.5" />
            )}

            {/* Standard categories */}
            {STANDARD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => scrollToSection(cat.id)}
                className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${activeSection === cat.id ? 'bg-[#5865F2]/20 ring-1 ring-[#5865F2]/40' : 'hover:bg-muted'}`}
                title={cat.name}
              >
                <span className="text-sm">{cat.icon}</span>
              </button>
            ))}
          </div>
        )}

        {/* Emoji grid */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-1.5 pb-1.5"
        >
          {/* Custom server emoji groups */}
          {filteredGuildGroups.map((group) => (
            <div
              key={group.guildId}
              ref={(el) => { sectionRefs.current[`guild-${group.guildId}`] = el; }}
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1 py-1.5 sticky top-0 bg-background z-10">
                {group.guildName}
              </p>
              <div className="grid grid-cols-7 gap-0.5">
                {group.emojis.map((emoji) => {
                  const ext = emoji.animated ? 'gif' : 'png';
                  const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=48`;
                  const emojiStr = `${emoji.name}:${emoji.id}`;
                  return (
                    <button
                      key={emoji.id}
                      type="button"
                      onClick={() => onSelect(emojiStr)}
                      className="flex items-center justify-center h-9 w-9 rounded hover:bg-muted transition-colors"
                      title={`:${emoji.name}:`}
                    >
                      <img src={url} alt={emoji.name} className="h-6 w-6 object-contain" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Standard categories */}
          {STANDARD_CATEGORIES.map((category) => {
            const filtered = search
              ? category.emojis.filter(() => category.name.toLowerCase().includes(lowerSearch))
              : category.emojis;
            if (filtered.length === 0 && search) return null;
            const emojis = search ? filtered : category.emojis;

            return (
              <div
                key={category.id}
                ref={(el) => { sectionRefs.current[category.id] = el; }}
              >
                <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1 py-1.5 sticky top-0 bg-background z-10">
                  {category.name}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {emojis.map((emoji, i) => (
                    <button
                      key={`${emoji}-${i}`}
                      type="button"
                      onClick={() => onSelect(emoji)}
                      className="flex items-center justify-center h-9 w-9 rounded hover:bg-muted transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
