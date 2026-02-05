import { useDiscordStore } from '../../stores/useDiscordStore';

function getAvatarUrl(userId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
  }
  const index = Number(BigInt(userId) >> BigInt(22)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function DMList() {
  const { dmChannels, openChannel } = useDiscordStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b shrink-0">
        <h3 className="text-xs font-semibold">Direct Messages</h3>
      </div>

      {/* DM list */}
      <div className="flex-1 overflow-y-auto py-1 discord-scroll">
        {dmChannels.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">No conversations yet</p>
        )}
        {dmChannels.map((dm) => {
          const recipient = dm.recipients[0];
          if (!recipient) return null;

          const displayName = recipient.globalName || recipient.username;
          const isGroup = dm.type === 3;
          const groupName = isGroup
            ? dm.recipients.map((r) => r.globalName || r.username).join(', ')
            : displayName;

          return (
            <button
              key={dm.id}
              type="button"
              onClick={() => openChannel(dm.id, isGroup ? groupName : displayName, 'dm')}
              className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-muted/50 transition-colors"
            >
              {isGroup ? (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                  {dm.recipients.length}
                </div>
              ) : (
                <img
                  src={getAvatarUrl(recipient.id, recipient.avatar)}
                  alt={displayName}
                  className="h-8 w-8 rounded-full shrink-0"
                />
              )}
              <div className="min-w-0 text-left">
                <p className="text-xs font-medium truncate">{groupName}</p>
                {isGroup && (
                  <p className="text-[10px] text-muted-foreground">
                    {dm.recipients.length} members
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
