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
import { ServerList } from '../../../../src/renderer/components/discord/ServerList';
import { createMockDiscordGuild } from '../../../mocks/factories';

beforeEach(() => {
  vi.clearAllMocks();
  useDiscordStore.setState({
    guilds: [],
    selectedGuildId: null,
    view: 'dms',
    selectGuild: vi.fn(),
    selectDMs: vi.fn(),
  });
});

describe('ServerList', () => {
  it('renders the DM button at the top', () => {
    render(<ServerList />);

    const dmButton = screen.getByTitle('Direct Messages');
    expect(dmButton).toBeInTheDocument();
  });

  it('renders server icons for each guild', () => {
    const guilds = [
      createMockDiscordGuild({ id: 'g1', name: 'Alpha Server', icon: 'icon1' }),
      createMockDiscordGuild({ id: 'g2', name: 'Beta Server', icon: 'icon2' }),
      createMockDiscordGuild({ id: 'g3', name: 'Gamma Server', icon: null }),
    ];
    useDiscordStore.setState({ guilds });

    render(<ServerList />);

    // Guilds with icons render <img> with the guild name as alt text
    expect(screen.getByAltText('Alpha Server')).toBeInTheDocument();
    expect(screen.getByAltText('Beta Server')).toBeInTheDocument();

    // Guild without icon shows initials
    expect(screen.getByText('GS')).toBeInTheDocument();

    // All guilds accessible via title
    expect(screen.getByTitle('Alpha Server')).toBeInTheDocument();
    expect(screen.getByTitle('Beta Server')).toBeInTheDocument();
    expect(screen.getByTitle('Gamma Server')).toBeInTheDocument();
  });

  it('shows active indicator styling on the selected guild', () => {
    const guilds = [
      createMockDiscordGuild({ id: 'g1', name: 'Active Guild', icon: 'ic' }),
      createMockDiscordGuild({ id: 'g2', name: 'Other Guild', icon: 'ic2' }),
    ];
    useDiscordStore.setState({ guilds, selectedGuildId: 'g1', view: 'server' });

    render(<ServerList />);

    const activeButton = screen.getByTitle('Active Guild');
    // The active guild button should have the ring-2 class for the selection indicator
    expect(activeButton.className).toContain('ring-2');

    const otherButton = screen.getByTitle('Other Guild');
    expect(otherButton.className).not.toContain('ring-2');
  });

  it('calls selectGuild when clicking a server icon', () => {
    const selectGuild = vi.fn();
    const guilds = [createMockDiscordGuild({ id: 'g1', name: 'Click Me', icon: 'ic' })];
    useDiscordStore.setState({ guilds, selectGuild });

    render(<ServerList />);

    fireEvent.click(screen.getByTitle('Click Me'));
    expect(selectGuild).toHaveBeenCalledWith('g1');
  });

  it('calls selectDMs when clicking the DM button', () => {
    const selectDMs = vi.fn();
    useDiscordStore.setState({ selectDMs });

    render(<ServerList />);

    fireEvent.click(screen.getByTitle('Direct Messages'));
    expect(selectDMs).toHaveBeenCalledTimes(1);
  });
});
