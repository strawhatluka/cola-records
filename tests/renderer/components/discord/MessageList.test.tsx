import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock child components to avoid deep dependency trees
vi.mock('../../../../src/renderer/components/discord/MessageItem', () => ({
  MessageItem: ({
    message,
    onReply,
    onEdit,
    onDelete,
    onEmojiPick,
  }: {
    message: { id: string; content: string };
    currentUserId: string | null;
    onReactionToggle: (id: string, emoji: string) => void;
    onReply: (m: any) => void;
    onEdit: (m: any) => void;
    onDelete: (id: string) => void;
    onEmojiPick: (id: string) => void;
  }) => (
    <div data-testid={`message-${message.id}`}>
      <span>{message.content}</span>
      <button data-testid={`reply-${message.id}`} onClick={() => onReply(message)}>
        Reply
      </button>
      <button data-testid={`edit-${message.id}`} onClick={() => onEdit(message)}>
        Edit
      </button>
      <button data-testid={`delete-${message.id}`} onClick={() => onDelete(message.id)}>
        Delete
      </button>
      <button data-testid={`emoji-${message.id}`} onClick={() => onEmojiPick(message.id)}>
        Emoji
      </button>
    </div>
  ),
}));

vi.mock('../../../../src/renderer/components/discord/MessageInput', () => ({
  MessageInput: ({
    channelName,
    onSend,
    onEdit,
    replyingTo,
    onCancelReply,
    onCreatePoll,
    onSendSticker,
  }: {
    channelName: string;
    onSend: (content: string) => void;
    onSendWithAttachments: (...args: any[]) => void;
    onEdit: (id: string, content: string) => void;
    onTyping: () => void;
    replyingTo: any;
    editingMessage: any;
    onCancelReply: () => void;
    onCancelEdit: () => void;
    onSendSticker: (id: string) => void;
    onCreatePoll: () => void;
    customEmojis?: any[];
    guilds?: any[];
  }) => (
    <div data-testid="message-input">
      <span data-testid="channel-name">{channelName}</span>
      {replyingTo && (
        <span data-testid="replying-to">
          Replying to {replyingTo.id}
          <button onClick={onCancelReply}>Cancel Reply</button>
        </span>
      )}
      <button data-testid="send-btn" onClick={() => onSend('test message')}>
        Send
      </button>
      <button data-testid="edit-msg-btn" onClick={() => onEdit('msg_1', 'edited')}>
        Save Edit
      </button>
      <button data-testid="create-poll-btn" onClick={onCreatePoll}>
        Create Poll
      </button>
      <button data-testid="send-sticker-btn" onClick={() => onSendSticker('sticker_1')}>
        Send Sticker
      </button>
    </div>
  ),
}));

vi.mock('../../../../src/renderer/components/discord/EmojiPicker', () => ({
  EmojiPicker: ({
    onSelect,
    onClose,
  }: {
    onSelect: (emoji: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="emoji-picker">
      <button data-testid="pick-emoji" onClick={() => onSelect('😀')}>
        Pick
      </button>
      <button data-testid="close-emoji" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('../../../../src/renderer/components/discord/CreatePollModal', () => ({
  CreatePollModal: ({
    onSubmit,
    onClose,
  }: {
    onSubmit: (q: string, a: string[], d: number, m: boolean) => void;
    onClose: () => void;
  }) => (
    <div data-testid="poll-modal">
      <button data-testid="submit-poll" onClick={() => onSubmit('Q?', ['A', 'B'], 24, false)}>
        Submit Poll
      </button>
      <button data-testid="close-poll" onClick={onClose}>
        Close Poll
      </button>
    </div>
  ),
}));

import { useDiscordStore } from '../../../../src/renderer/stores/useDiscordStore';
import { MessageList } from '../../../../src/renderer/components/discord/MessageList';
import { createMockDiscordMessage, createMockDiscordUser } from '../../../mocks/factories';

function setupStore(overrides: Partial<ReturnType<typeof useDiscordStore.getState>> = {}) {
  useDiscordStore.setState({
    connected: true,
    user: createMockDiscordUser({ id: 'current_user' }),
    guilds: [],
    selectedGuildId: 'guild_1',
    selectedChannelId: 'ch_1',
    selectedChannelName: 'general',
    selectedChannelType: 'text',
    selectedForumChannelId: null,
    guildChannels: {},
    guildEmojis: {},
    guildStickers: {},
    dmChannels: [],
    messages: [],
    pinnedMessages: [],
    forumThreads: [],
    forumHasMore: true,
    sendMessage: vi.fn(),
    sendMessageWithAttachments: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    loadMoreMessages: vi.fn(),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn(),
    fetchPinnedMessages: vi.fn(),
    fetchGuildEmojis: vi.fn(),
    triggerTyping: vi.fn(),
    goBack: vi.fn(),
    sendSticker: vi.fn(),
    createPoll: vi.fn(),
    ...overrides,
  } as any);
}

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockInvoke.mockResolvedValue(undefined);
    setupStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // Header rendering
  // ============================================
  it('renders channel name with # prefix for text channels', () => {
    setupStore({ selectedChannelName: 'general', selectedChannelType: 'text' });
    render(<MessageList />);
    expect(screen.getByTestId('channel-name').textContent).toBe('#general');
  });

  it('renders channel name with @ prefix for DM channels', () => {
    setupStore({ selectedChannelName: 'alice', selectedChannelType: 'dm' });
    render(<MessageList />);
    expect(screen.getByTestId('channel-name').textContent).toBe('@alice');
  });

  it('shows back button (ArrowLeft icon) by default', () => {
    render(<MessageList />);
    expect(screen.getByTestId('icon-arrowleft')).toBeDefined();
  });

  // ============================================
  // Channel sidebar toggle
  // ============================================
  it('shows channel toggle button when showChannelToggle is true', () => {
    const onToggle = vi.fn();
    render(
      <MessageList showChannelToggle channelSidebarOpen={true} onToggleChannelSidebar={onToggle} />
    );
    const btn = screen.getByTitle('Hide channels');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows "Show channels" title when sidebar is closed', () => {
    render(
      <MessageList showChannelToggle channelSidebarOpen={false} onToggleChannelSidebar={vi.fn()} />
    );
    expect(screen.getByTitle('Show channels')).toBeDefined();
  });

  // ============================================
  // Messages rendering
  // ============================================
  it('renders messages from store', () => {
    setupStore({
      messages: [
        createMockDiscordMessage({ id: 'msg_1', content: 'Hello world' }),
        createMockDiscordMessage({ id: 'msg_2', content: 'Second message' }),
      ],
    });
    render(<MessageList />);
    expect(screen.getByText('Hello world')).toBeDefined();
    expect(screen.getByText('Second message')).toBeDefined();
  });

  it('shows load more button when 50+ messages', () => {
    const messages = Array.from({ length: 50 }, (_, i) =>
      createMockDiscordMessage({ id: `msg_${i}`, content: `Message ${i}` })
    );
    setupStore({ messages });
    render(<MessageList />);
    expect(screen.getByText('Load older messages')).toBeDefined();
  });

  it('calls loadMoreMessages when load more clicked', () => {
    const loadMore = vi.fn();
    const messages = Array.from({ length: 50 }, (_, i) =>
      createMockDiscordMessage({ id: `msg_${i}`, content: `Message ${i}` })
    );
    setupStore({ messages, loadMoreMessages: loadMore });
    render(<MessageList />);
    fireEvent.click(screen.getByText('Load older messages'));
    expect(loadMore).toHaveBeenCalled();
  });

  // ============================================
  // Pinned messages
  // ============================================
  it('shows pinned messages overlay when pin button clicked', () => {
    const fetchPinned = vi.fn();
    setupStore({
      pinnedMessages: [createMockDiscordMessage({ id: 'pin_1', content: 'Pinned msg' })],
      fetchPinnedMessages: fetchPinned,
    });
    render(<MessageList />);

    fireEvent.click(screen.getByTitle('Pinned Messages'));
    expect(fetchPinned).toHaveBeenCalledWith('ch_1');
    expect(screen.getByText('Pinned Messages')).toBeDefined();
    expect(screen.getByText('Pinned msg')).toBeDefined();
  });

  it('shows "No pinned messages" when list is empty', () => {
    setupStore({ pinnedMessages: [] });
    render(<MessageList />);
    fireEvent.click(screen.getByTitle('Pinned Messages'));
    expect(screen.getByText('No pinned messages')).toBeDefined();
  });

  it('closes pinned overlay when X clicked', () => {
    setupStore({
      pinnedMessages: [createMockDiscordMessage({ id: 'pin_1', content: 'Pinned' })],
    });
    render(<MessageList />);
    fireEvent.click(screen.getByTitle('Pinned Messages'));
    expect(screen.getByText('Pinned')).toBeDefined();

    // Find close button in pinned overlay
    const closeButtons = screen.getAllByTestId('icon-x');
    fireEvent.click(closeButtons[0].closest('button')!);
    expect(screen.queryByText('Pinned')).toBeNull();
  });

  // ============================================
  // Send message
  // ============================================
  it('calls sendMessage on send', () => {
    const sendMsg = vi.fn();
    setupStore({ sendMessage: sendMsg });
    render(<MessageList />);
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(sendMsg).toHaveBeenCalledWith('ch_1', 'test message', undefined);
  });

  it('does not call sendMessage when no channel selected', () => {
    const sendMsg = vi.fn();
    setupStore({ sendMessage: sendMsg, selectedChannelId: null as any });
    render(<MessageList />);
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(sendMsg).not.toHaveBeenCalled();
  });

  // ============================================
  // Edit message
  // ============================================
  it('calls editMessage on edit', () => {
    const editMsg = vi.fn();
    setupStore({ editMessage: editMsg });
    render(<MessageList />);
    fireEvent.click(screen.getByTestId('edit-msg-btn'));
    expect(editMsg).toHaveBeenCalledWith('ch_1', 'msg_1', 'edited');
  });

  // ============================================
  // Delete message
  // ============================================
  it('calls deleteMessage from message item', () => {
    const deleteMsg = vi.fn();
    setupStore({
      messages: [createMockDiscordMessage({ id: 'msg_del', content: 'Delete me' })],
      deleteMessage: deleteMsg,
    });
    render(<MessageList />);
    fireEvent.click(screen.getByTestId('delete-msg_del'));
    expect(deleteMsg).toHaveBeenCalledWith('ch_1', 'msg_del');
  });

  // ============================================
  // Reply
  // ============================================
  it('sets reply state and sends with replyId', () => {
    const sendMsg = vi.fn();
    const msg = createMockDiscordMessage({ id: 'msg_r', content: 'Reply to me' });
    setupStore({ messages: [msg], sendMessage: sendMsg });
    render(<MessageList />);

    // Click reply button on message
    fireEvent.click(screen.getByTestId('reply-msg_r'));

    // Now replying-to should be shown in input
    expect(screen.getByTestId('replying-to')).toBeDefined();
    expect(screen.getByTestId('replying-to').textContent).toContain('msg_r');

    // Send message with reply
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(sendMsg).toHaveBeenCalledWith('ch_1', 'test message', 'msg_r');
  });

  // ============================================
  // Emoji picker for reactions
  // ============================================
  it('opens emoji picker for message and adds reaction', async () => {
    const addReaction = vi.fn().mockResolvedValue(undefined);
    const fetchMsgs = vi.fn();
    const msg = createMockDiscordMessage({ id: 'msg_e', content: 'Emoji this' });
    setupStore({ messages: [msg], addReaction, fetchMessages: fetchMsgs });
    render(<MessageList />);

    // Open emoji picker for the message
    fireEvent.click(screen.getByTestId('emoji-msg_e'));
    expect(screen.getByTestId('emoji-picker')).toBeDefined();

    // Pick an emoji
    fireEvent.click(screen.getByTestId('pick-emoji'));

    await waitFor(() => {
      expect(addReaction).toHaveBeenCalledWith('ch_1', 'msg_e', '😀');
    });
  });

  it('closes emoji picker', () => {
    const msg = createMockDiscordMessage({ id: 'msg_e2', content: 'Close emoji' });
    setupStore({ messages: [msg] });
    render(<MessageList />);

    fireEvent.click(screen.getByTestId('emoji-msg_e2'));
    expect(screen.getByTestId('emoji-picker')).toBeDefined();

    fireEvent.click(screen.getByTestId('close-emoji'));
    expect(screen.queryByTestId('emoji-picker')).toBeNull();
  });

  // ============================================
  // Poll creation
  // ============================================
  it('opens and submits poll modal', () => {
    const createPoll = vi.fn();
    setupStore({ createPoll });
    render(<MessageList />);

    // Click create poll from input
    fireEvent.click(screen.getByTestId('create-poll-btn'));
    expect(screen.getByTestId('poll-modal')).toBeDefined();

    // Submit poll
    fireEvent.click(screen.getByTestId('submit-poll'));
    expect(createPoll).toHaveBeenCalledWith('ch_1', 'Q?', ['A', 'B'], 24, false);
  });

  it('closes poll modal', () => {
    setupStore();
    render(<MessageList />);
    fireEvent.click(screen.getByTestId('create-poll-btn'));
    expect(screen.getByTestId('poll-modal')).toBeDefined();

    fireEvent.click(screen.getByTestId('close-poll'));
    expect(screen.queryByTestId('poll-modal')).toBeNull();
  });

  // ============================================
  // Send sticker
  // ============================================
  it('calls sendSticker when sticker sent from input', () => {
    const sendSticker = vi.fn();
    setupStore({ sendSticker });
    render(<MessageList />);
    fireEvent.click(screen.getByTestId('send-sticker-btn'));
    expect(sendSticker).toHaveBeenCalledWith('ch_1', 'sticker_1');
  });

  // ============================================
  // Channel change clears state
  // ============================================
  it('clears reply and edit state when channel changes', () => {
    const msg = createMockDiscordMessage({ id: 'msg_ch', content: 'Reply target' });
    setupStore({ messages: [msg] });

    const { rerender } = render(<MessageList />);

    // Set reply
    fireEvent.click(screen.getByTestId('reply-msg_ch'));
    expect(screen.getByTestId('replying-to')).toBeDefined();

    // Change channel
    act(() => {
      useDiscordStore.setState({ selectedChannelId: 'ch_2' });
    });
    rerender(<MessageList />);

    // Reply state should be cleared
    expect(screen.queryByTestId('replying-to')).toBeNull();
  });

  // ============================================
  // Go back
  // ============================================
  it('calls goBack when back button clicked', () => {
    const goBack = vi.fn();
    setupStore({ goBack });
    render(<MessageList />);

    // Find the back arrow button (ArrowLeft icon)
    const arrowIcon = screen.getByTestId('icon-arrowleft');
    fireEvent.click(arrowIcon.closest('button')!);
    expect(goBack).toHaveBeenCalled();
  });
});
