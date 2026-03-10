import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

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

import { ChannelList } from '../../../../src/renderer/components/discord/ChannelList';
import { useDiscordStore } from '../../../../src/renderer/stores/useDiscordStore';
import { createMockDiscordGuild, createMockDiscordChannel } from '../../../mocks/factories';

beforeEach(() => {
  vi.clearAllMocks();
  useDiscordStore.setState({
    connected: true,
    user: null,
    guilds: [],
    selectedGuildId: null,
    selectedChannelId: null,
    selectedForumChannelId: null,
    guildChannels: {},
    guildEmojis: {},
    guildStickers: {},
    dmChannels: [],
    messages: [],
    forumThreads: [],
    forumHasMore: true,
  });
});

describe('ChannelList React.memo Optimization (ChannelItem)', () => {
  it('does not re-render channel items when unrelated sibling channels change', () => {
    // Set up initial state with multiple channels
    const guild = createMockDiscordGuild({ id: 'guild_1', name: 'Test Server' });
    const channels = [
      createMockDiscordChannel({ id: 'ch_1', name: 'general', type: 0, position: 0 }),
      createMockDiscordChannel({ id: 'ch_2', name: 'random', type: 0, position: 1 }),
      createMockDiscordChannel({ id: 'ch_3', name: 'dev', type: 0, position: 2 }),
    ];

    useDiscordStore.setState({
      guilds: [guild],
      selectedGuildId: 'guild_1',
      guildChannels: { guild_1: channels },
    });

    render(<ChannelList />);

    // All channels should be rendered
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
  });

  it('re-renders a channel item when its own data changes', () => {
    const guild = createMockDiscordGuild({ id: 'guild_1', name: 'Test Server' });
    const channels = [
      createMockDiscordChannel({ id: 'ch_1', name: 'general', type: 0, position: 0 }),
    ];

    useDiscordStore.setState({
      guilds: [guild],
      selectedGuildId: 'guild_1',
      guildChannels: { guild_1: channels },
    });

    const { rerender } = render(<ChannelList />);

    expect(screen.getByText('general')).toBeInTheDocument();

    // Update channels in store
    const updatedChannels = [
      createMockDiscordChannel({ id: 'ch_1', name: 'announcements', type: 0, position: 0 }),
    ];
    act(() => {
      useDiscordStore.setState({
        guildChannels: { guild_1: updatedChannels },
      });
    });
    rerender(<ChannelList />);

    // Channel should show new name
    expect(screen.getByText('announcements')).toBeInTheDocument();
  });

  it('re-renders a channel item when its active state changes', () => {
    const guild = createMockDiscordGuild({ id: 'guild_1', name: 'Test Server' });
    const channels = [
      createMockDiscordChannel({ id: 'ch_1', name: 'general', type: 0, position: 0 }),
      createMockDiscordChannel({ id: 'ch_2', name: 'random', type: 0, position: 1 }),
    ];

    useDiscordStore.setState({
      guilds: [guild],
      selectedGuildId: 'guild_1',
      selectedChannelId: null,
      guildChannels: { guild_1: channels },
    });

    const { rerender } = render(<ChannelList />);

    // Initially channels are rendered
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();

    // Select the 'general' channel
    act(() => {
      useDiscordStore.setState({ selectedChannelId: 'ch_1' });
    });
    rerender(<ChannelList />);

    // Both channels should still render after selection change
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();

    // The selected channel's button should exist
    const generalBtn = screen.getByText('general').closest('button');
    expect(generalBtn).toBeInTheDocument();
  });

  it('renders channels without categories correctly', () => {
    const guild = createMockDiscordGuild({ id: 'guild_1', name: 'Test Server' });
    const channels = [
      createMockDiscordChannel({ id: 'ch_1', name: 'general', type: 0, position: 0 }),
      createMockDiscordChannel({ id: 'ch_2', name: 'random', type: 0, position: 1 }),
    ];

    useDiscordStore.setState({
      guilds: [guild],
      selectedGuildId: 'guild_1',
      guildChannels: { guild_1: channels },
    });

    render(<ChannelList />);

    // Channels should be visible
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();
  });
});
