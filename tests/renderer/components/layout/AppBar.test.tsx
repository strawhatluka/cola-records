import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock IPC client
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

// Mock useUpdaterStore
vi.mock('../../../../src/renderer/stores/useUpdaterStore', () => ({
  useUpdaterStore: (selector: (state: { appVersion: string }) => string) =>
    selector({ appVersion: '1.0.0' }),
}));

// Mock Spotify and Discord components to isolate AppBar tests
vi.mock('../../../../src/renderer/components/spotify/SpotifyPlayer', () => ({
  SpotifyPlayer: () => <div data-testid="spotify-player">SpotifyPlayer</div>,
}));

vi.mock('../../../../src/renderer/components/discord/DiscordClient', () => ({
  DiscordClient: () => <div data-testid="discord-client">DiscordClient</div>,
}));

import { AppBar } from '../../../../src/renderer/components/layout/AppBar';

describe('AppBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title', () => {
    render(<AppBar title="My App" />);
    expect(screen.getByText('My App')).toBeDefined();
  });

  it('renders version indicator', () => {
    render(<AppBar title="Test" />);
    expect(screen.getByText('v1.0.0')).toBeDefined();
  });

  it('renders as a header element', () => {
    const { container } = render(<AppBar title="Test" />);
    expect(container.querySelector('header')).toBeDefined();
  });

  describe('Chrome button', () => {
    it('renders the Chrome button with correct title', () => {
      render(<AppBar title="Test" />);
      const chromeBtn = screen.getByTitle('Google Chrome');
      expect(chromeBtn).toBeDefined();
    });

    it('invokes shell:launch-app with chrome on click', () => {
      render(<AppBar title="Test" />);
      const chromeBtn = screen.getByTitle('Google Chrome');
      fireEvent.click(chromeBtn);
      expect(mockInvoke).toHaveBeenCalledWith('shell:launch-app', 'chrome');
    });

    it('renders Chrome SVG icon', () => {
      render(<AppBar title="Test" />);
      const chromeBtn = screen.getByTitle('Google Chrome');
      const svg = chromeBtn.querySelector('svg');
      expect(svg).toBeDefined();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });
  });

  describe('integration components', () => {
    it('renders SpotifyPlayer component', () => {
      render(<AppBar title="Test" />);
      expect(screen.getByTestId('spotify-player')).toBeDefined();
    });

    it('renders DiscordClient component', () => {
      render(<AppBar title="Test" />);
      expect(screen.getByTestId('discord-client')).toBeDefined();
    });
  });
});
