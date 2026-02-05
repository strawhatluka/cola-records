import { useState } from 'react';
import { useDiscordStore } from '../../stores/useDiscordStore';
import {
  MessageSquareText,
  Archive,
  Lock,
  PanelLeftOpen,
  PanelLeftClose,
  Plus,
  ArrowUpDown,
  X,
} from 'lucide-react';

interface ForumThreadListProps {
  showChannelToggle?: boolean;
  channelSidebarOpen?: boolean;
  onToggleChannelSidebar?: () => void;
}

export function ForumThreadList({ showChannelToggle, channelSidebarOpen, onToggleChannelSidebar }: ForumThreadListProps = {}) {
  const {
    forumThreads,
    forumHasMore,
    forumTotalResults,
    forumSortBy,
    forumFilterTags,
    forumAvailableTags,
    selectedForumChannelId,
    selectedForumChannelName,
    openThread,
    loadMoreForumThreads,
    setForumSort,
    toggleForumTag,
    createForumThread,
  } = useDiscordStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const handleCreate = async () => {
    if (!selectedForumChannelId || !newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      const thread = await createForumThread(
        selectedForumChannelId,
        newTitle.trim(),
        newContent.trim(),
        newTags.length > 0 ? newTags : undefined,
      );
      setShowCreate(false);
      setNewTitle('');
      setNewContent('');
      setNewTags([]);
      openThread(thread.id, thread.name);
    } catch {
      // Error is set in the store
    } finally {
      setCreating(false);
    }
  };

  const getTagName = (tagId: string): string => {
    const tag = forumAvailableTags.find((t) => t.id === tagId);
    return tag?.name || tagId;
  };

  const sortLabel = forumSortBy === 'last_message_time' ? 'Recent Activity' : 'Creation Date';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-1.5">
          {showChannelToggle && onToggleChannelSidebar && (
            <button
              type="button"
              onClick={onToggleChannelSidebar}
              className="p-0.5 rounded hover:bg-muted transition-colors"
              title={channelSidebarOpen ? 'Hide channels' : 'Show channels'}
            >
              {channelSidebarOpen ? (
                <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
          <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold truncate flex-1">{selectedForumChannelName}</span>
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="New post"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sort + Tag filter bar */}
      <div className="px-3 py-1.5 border-b shrink-0 flex items-center gap-2 flex-wrap">
        {/* Sort button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
          >
            <ArrowUpDown className="h-2.5 w-2.5" />
            {sortLabel}
          </button>
          {showSortMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-md py-1 min-w-[140px]">
              <button
                type="button"
                onClick={() => { setForumSort('last_message_time', 'desc'); setShowSortMenu(false); }}
                className={`w-full text-left px-3 py-1 text-[10px] hover:bg-muted transition-colors ${forumSortBy === 'last_message_time' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              >
                Recent Activity
              </button>
              <button
                type="button"
                onClick={() => { setForumSort('creation_time', 'desc'); setShowSortMenu(false); }}
                className={`w-full text-left px-3 py-1 text-[10px] hover:bg-muted transition-colors ${forumSortBy === 'creation_time' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              >
                Creation Date
              </button>
            </div>
          )}
        </div>

        {/* Tag filters */}
        {forumAvailableTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {forumAvailableTags.map((tag) => {
              const active = forumFilterTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleForumTag(tag.id)}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tag.emojiName && <span className="mr-0.5">{tag.emojiName}</span>}
                  {tag.name}
                </button>
              );
            })}
            {forumFilterTags.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  for (const tagId of [...forumFilterTags]) toggleForumTag(tagId);
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground p-0.5"
                title="Clear filters"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}

        {forumTotalResults > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">{forumTotalResults} posts</span>
        )}
      </div>

      {/* Create new thread form */}
      {showCreate && (
        <div className="px-3 py-2 border-b shrink-0 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Post title..."
            className="w-full bg-muted/50 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            maxLength={100}
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your post content..."
            className="w-full bg-muted/50 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring resize-none min-h-[60px]"
            rows={3}
          />
          {forumAvailableTags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Tags:</span>
              {forumAvailableTags.map((tag) => {
                const selected = newTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setNewTags(selected ? newTags.filter((t) => t !== tag.id) : [...newTags, tag.id])}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tag.emojiName && <span className="mr-0.5">{tag.emojiName}</span>}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewTitle(''); setNewContent(''); setNewTags([]); }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newTitle.trim() || !newContent.trim()}
              className="text-[10px] bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Post'}
            </button>
          </div>
        </div>
      )}

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto py-1 discord-scroll">
        {forumThreads.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-8">No threads found</p>
        )}
        {forumThreads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => openThread(thread.id, thread.name)}
            className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border/30"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium truncate flex-1">{thread.name}</span>
              {thread.archived && <Archive className="h-3 w-3 text-muted-foreground shrink-0" />}
              {thread.locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {thread.appliedTags.length > 0 && (
                <div className="flex items-center gap-1">
                  {thread.appliedTags.map((tagId) => (
                    <span key={tagId} className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                      {getTagName(tagId)}
                    </span>
                  ))}
                </div>
              )}
              {thread.messageCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
                </span>
              )}
              {thread.archiveTimestamp && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(thread.archiveTimestamp).toLocaleDateString()}
                </span>
              )}
            </div>
          </button>
        ))}

        {/* Load more */}
        {forumHasMore && (
          <button
            type="button"
            onClick={loadMoreForumThreads}
            className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Load more posts...
          </button>
        )}
      </div>
    </div>
  );
}
