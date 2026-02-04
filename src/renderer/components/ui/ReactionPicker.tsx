import { useEffect, useRef, useState } from 'react';
import type { Reaction, ReactionContent } from '../../../main/ipc/channels';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';

const REACTION_EMOJI: Record<ReactionContent, string> = {
  '+1': '👍',
  '-1': '👎',
  'laugh': '😄',
  'confused': '😕',
  'heart': '❤️',
  'hooray': '🎉',
  'rocket': '🚀',
  'eyes': '👀',
};

const REACTION_OPTIONS: ReactionContent[] = ['+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes'];

interface ReactionDisplayProps {
  reactions: Reaction[];
  currentUser: string;
  onAdd: (content: ReactionContent) => Promise<void>;
  onRemove: (reactionId: number) => Promise<void>;
}

interface GroupedReaction {
  content: ReactionContent;
  count: number;
  users: string[];
  userReactionId: number | null;
}

function groupReactions(reactions: Reaction[], currentUser: string): GroupedReaction[] {
  const groups = new Map<ReactionContent, GroupedReaction>();

  for (const r of reactions) {
    const existing = groups.get(r.content);
    if (existing) {
      existing.count++;
      existing.users.push(r.user);
      if (r.user === currentUser) existing.userReactionId = r.id;
    } else {
      groups.set(r.content, {
        content: r.content,
        count: 1,
        users: [r.user],
        userReactionId: r.user === currentUser ? r.id : null,
      });
    }
  }

  return Array.from(groups.values());
}

export function ReactionDisplay({ reactions, currentUser, onAdd, onRemove }: ReactionDisplayProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const grouped = groupReactions(reactions, currentUser);

  const handleToggle = async (group: GroupedReaction) => {
    if (loading) return;
    setLoading(true);
    try {
      if (group.userReactionId) {
        await onRemove(group.userReactionId);
      } else {
        await onAdd(group.content);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePickerSelect = async (content: ReactionContent) => {
    setPickerOpen(false);
    if (loading) return;
    setLoading(true);
    try {
      // Check if user already reacted with this type
      const existing = grouped.find((g) => g.content === content && g.userReactionId);
      if (existing) {
        await onRemove(existing.userReactionId!);
      } else {
        await onAdd(content);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="not-prose flex items-center gap-1 flex-wrap mt-2">
        {grouped.map((group) => (
          <Tooltip key={group.content}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleToggle(group)}
                disabled={loading}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors h-6 ${
                  group.userReactionId
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-muted/50 border-border/50 text-muted-foreground hover:border-border'
                } disabled:opacity-50`}
              >
                <span style={{ fontSize: '14px', lineHeight: 1 }}>{REACTION_EMOJI[group.content]}</span>
                <span className="text-xs leading-none">{group.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {group.users.join(', ')} reacted with {group.content}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Add reaction button */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            disabled={loading}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>😀</span>
          </button>

          {pickerOpen && (
            <div className="absolute bottom-full mb-1 left-0 z-[100] bg-popover border rounded-lg shadow-lg p-2 w-[152px]">
              <div className="grid grid-cols-4 gap-1">
                {REACTION_OPTIONS.map((content) => (
                  <button
                    key={content}
                    onClick={() => handlePickerSelect(content)}
                    className="w-[34px] h-[34px] flex items-center justify-center rounded hover:bg-accent transition-colors"
                  >
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>{REACTION_EMOJI[content]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
