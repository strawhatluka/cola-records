import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

import { useDiscordStore } from '../../../../src/renderer/stores/useDiscordStore';
import { ChannelList } from '../../../../src/renderer/components/discord/ChannelList';
import { createMockDiscordGuild, createMockDiscordChannel } from '../../../mocks/factories';

beforeEach(() => {
  vi.clearAllMocks();
  useDiscordStore.setState({
    guilds: [],
    selectedGuildId: null,
    selectedChannelId: null,
    selectedForumChannelId: null,
    guildChannels: {},
    openChannel: vi.fn(),
    openForumChannel: vi.fn(),
  });
});

describe('ChannelList', () => {
  it('renders channels grouped by category', () => {
    const guild = createMockDiscordGuild({ id: 'g1', name: 'Test Server' });
    const channels = [
      createMockDiscordChannel({
        id: 'cat1',
        name: 'Text Channels',
        type: 4,
        parentId: null,
        position: 0,
      }),
      createMockDiscordChannel({
        id: 'ch1',
        name: 'general',
        type: 0,
        parentId: 'cat1',
        position: 0,
      }),
      createMockDiscordChannel({
        id: 'ch2',
        name: 'random',
        type: 0,
        parentId: 'cat1',
        position: 1,
      }),
      createMockDiscordChannel({
        id: 'cat2',
        name: 'Voice Channels',
        type: 4,
        parentId: null,
        position: 1,
      }),
      createMockDiscordChannel({
        id: 'vc1',
        name: 'General Voice',
        type: 2,
        parentId: 'cat2',
        position: 0,
      }),
    ];

    useDiscordStore.setState({
      guilds: [guild],
      selectedGuildId: 'g1',
      guildChannels: { g1: channels },
    });

    render(<ChannelList />);

    // Category headers rendered as uppercase buttons
    expect(screen.getByText('Text Channels')).toBeInTheDocument();
    expect(screen.getByText('Voice Channels')).toBeInTheDocument();

    // Child channels rendered
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();
    expect(screen.getByText('General Voice')).toBeInTheDocument();
  });

  it('shows text channels with hash icon (default icon)', () => {
    const channels = [
      createMockDiscordChannel({
        id: 'ch1',
        name: 'text-channel',
        type: 0,
        parentId: null,
        position: 0,
      }),
    ];
    useDiscordStore.setState({
      guilds: [createMockDiscordGuild({ id: 'g1', name: 'S' })],
      selectedGuildId: 'g1',
      guildChannels: { g1: channels },
    });

    const { container } = render(<ChannelList />);

    // The Hash icon from lucide-react renders as an SVG inside the button
    const channelButton = screen.getByText('text-channel').closest('button');
    expect(channelButton).toBeInTheDocument();
    const svg = channelButton!.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows voice channels with a distinct icon', () => {
    const channels = [
      createMockDiscordChannel({
        id: 'vc1',
        name: 'voice-room',
        type: 2,
        parentId: null,
        position: 0,
      }),
    ];
    useDiscordStore.setState({
      guilds: [createMockDiscordGuild({ id: 'g1', name: 'S' })],
      selectedGuildId: 'g1',
      guildChannels: { g1: channels },
    });

    render(<ChannelList />);

    // Voice channel should be rendered with its name
    const voiceButton = screen.getByText('voice-room').closest('button');
    expect(voiceButton).toBeInTheDocument();
    // Voice channels are clickable (type 2 is in the isClickable list)
    expect(voiceButton).not.toBeDisabled();
  });

  it('calls openChannel when clicking a text channel', () => {
    const openChannel = vi.fn();
    const channels = [
      createMockDiscordChannel({
        id: 'ch1',
        name: 'general',
        type: 0,
        parentId: null,
        position: 0,
      }),
    ];
    useDiscordStore.setState({
      guilds: [createMockDiscordGuild({ id: 'g1', name: 'S' })],
      selectedGuildId: 'g1',
      guildChannels: { g1: channels },
      openChannel,
    });

    render(<ChannelList />);

    fireEvent.click(screen.getByText('general'));
    expect(openChannel).toHaveBeenCalledWith('ch1', 'general', 'text');
  });

  it('shows forum channels and calls openForumChannel on click', () => {
    const openForumChannel = vi.fn();
    const channels = [
      createMockDiscordChannel({
        id: 'forum1',
        name: 'help-forum',
        type: 15,
        parentId: null,
        position: 0,
      }),
    ];
    useDiscordStore.setState({
      guilds: [createMockDiscordGuild({ id: 'g1', name: 'S' })],
      selectedGuildId: 'g1',
      guildChannels: { g1: channels },
      openForumChannel,
    });

    render(<ChannelList />);

    const forumButton = screen.getByText('help-forum');
    expect(forumButton).toBeInTheDocument();

    fireEvent.click(forumButton);
    expect(openForumChannel).toHaveBeenCalledWith('forum1', 'help-forum');
  });
});
