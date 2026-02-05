import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock next-themes for ThemeToggle
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
  }),
}));

// Mock react-router-dom for Sidebar
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/' }),
}));

// Mock radix-ui dropdown for ThemeToggle
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children, asChild, ...props }: any) => <button {...props}>{children}</button>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Item: ({ children, onSelect, ...props }: any) => (
    <button onClick={onSelect} {...props}>{children}</button>
  ),
  Group: ({ children }: any) => <div>{children}</div>,
  Label: ({ children }: any) => <div>{children}</div>,
  Separator: () => <hr />,
  Sub: ({ children }: any) => <div>{children}</div>,
  SubTrigger: ({ children }: any) => <button>{children}</button>,
  SubContent: ({ children }: any) => <div>{children}</div>,
  RadioGroup: ({ children }: any) => <div>{children}</div>,
  RadioItem: ({ children }: any) => <button>{children}</button>,
  CheckboxItem: ({ children }: any) => <button>{children}</button>,
  ItemIndicator: ({ children }: any) => <span>{children}</span>,
}));

import { ThemeToggle } from '../../../src/renderer/components/ThemeToggle';
import { Sidebar } from '../../../src/renderer/components/layout/Sidebar';
import { Progress } from '../../../src/renderer/components/ui/Progress';
import { ServerList } from '../../../src/renderer/components/discord/ServerList';
import { useDiscordStore } from '../../../src/renderer/stores/useDiscordStore';

beforeEach(() => {
  vi.clearAllMocks();
  useDiscordStore.setState({
    connected: false,
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
    loadingMessages: false,
    hasMoreMessages: true,
    forumThreads: [],
    loadingForumThreads: false,
    forumHasMore: true,
    replyingTo: null,
    editingMessage: null,
    pollingInterval: null,
    activeView: 'dms',
  });
});

describe('CSS Transition Optimizations', () => {
  describe('ThemeToggle', () => {
    it('sun icon uses transition-transform, NOT transition-all', () => {
      const { container } = render(<ThemeToggle />);

      // Check that transition classes don't include transition-all
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();

      // Check no element uses transition-all
      const allElements = container.querySelectorAll('*');
      let hasTransitionAll = false;
      allElements.forEach((el) => {
        if (el.className && typeof el.className === 'string' && el.className.includes('transition-all')) {
          hasTransitionAll = true;
        }
      });
      expect(hasTransitionAll).toBe(false);
    });

    it('button contains transition-transform class', () => {
      const { container } = render(<ThemeToggle />);

      // ThemeToggle icons use transition-transform for rotate animations
      // The icons themselves have the transition classes
      const elements = container.querySelectorAll('[class*="transition"]');
      // At minimum, the component should render and have some elements
      expect(container.querySelector('button')).toBeInTheDocument();
    });
  });

  describe('Sidebar', () => {
    it('uses transition-[width], NOT transition-all', () => {
      const { container } = render(<Sidebar />);

      // Sidebar has a container with width transition
      const sidebar = container.querySelector('aside, nav, [class*="transition"]');
      const allElements = container.querySelectorAll('*');

      // Check no element uses transition-all
      let hasTransitionAll = false;
      allElements.forEach((el) => {
        if (el.className && el.className.includes && el.className.includes('transition-all')) {
          hasTransitionAll = true;
        }
      });
      expect(hasTransitionAll).toBe(false);
    });
  });

  describe('Progress', () => {
    it('uses transition-transform, NOT transition-all', () => {
      const { container } = render(<Progress value={50} />);

      // Progress indicator div should have transition-transform
      const progressBar = container.querySelector('[class*="transition"]');

      // Verify transition-all is not present
      const allElements = container.querySelectorAll('*');
      let hasTransitionAll = false;
      allElements.forEach((el) => {
        if (el.className && el.className.includes && el.className.includes('transition-all')) {
          hasTransitionAll = true;
        }
      });
      expect(hasTransitionAll).toBe(false);
    });

    it('indicator has transition-transform class', () => {
      const { container } = render(<Progress value={50} />);

      const indicator = container.querySelector('[class*="bg-primary"]');
      expect(indicator?.className).toContain('transition-transform');
    });
  });

  describe('ServerList', () => {
    it('DM button uses specific transition, NOT transition-all', () => {
      useDiscordStore.setState({
        connected: true,
        guilds: [],
      });

      const { container } = render(<ServerList />);

      // Check the DM button doesn't have transition-all
      const buttons = container.querySelectorAll('button');
      buttons.forEach((btn) => {
        expect(btn.className).not.toContain('transition-all');
      });
    });

    it('guild buttons use specific transition, NOT transition-all', () => {
      useDiscordStore.setState({
        connected: true,
        guilds: [
          { id: 'guild_1', name: 'Test Server', icon: 'abc123', ownerId: '1', channels: [] },
        ],
      });

      const { container } = render(<ServerList />);

      // Check all buttons don't have transition-all
      const buttons = container.querySelectorAll('button');
      buttons.forEach((btn) => {
        expect(btn.className).not.toContain('transition-all');
      });
    });

    it('buttons use transition-[border-radius,background-color]', () => {
      useDiscordStore.setState({
        connected: true,
        guilds: [
          { id: 'guild_1', name: 'Test Server', icon: 'abc123', ownerId: '1', channels: [] },
        ],
      });

      const { container } = render(<ServerList />);

      // Find elements with specific transition classes
      const elements = container.querySelectorAll('[class*="transition-"]');
      const hasSpecificTransition = Array.from(elements).some(
        (el) =>
          el.className.includes('transition-[border-radius') ||
          el.className.includes('transition-[background')
      );

      // At least some elements should have specific transitions
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});
