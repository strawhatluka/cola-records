import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock IPC
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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

// Mock ThemeProvider
vi.mock('../../../src/renderer/providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useSettingsStore } from '../../../src/renderer/stores/useSettingsStore';
import { SettingsScreen } from '../../../src/renderer/screens/SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      theme: 'system',
      defaultClonePath: '/mock/path',
      defaultProjectsPath: '/mock/projects',
      defaultProfessionalProjectsPath: '/mock/professional',
      autoFetch: true,
      aliases: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'settings:get') {
        return Promise.resolve({
          theme: 'system',
          defaultClonePath: '/mock/path',
          defaultProjectsPath: '/mock/projects',
          defaultProfessionalProjectsPath: '/mock/professional',
          autoFetch: true,
          aliases: [],
        });
      }
      // code-server:get-stats and others return null
      return Promise.resolve(null);
    });
  });

  it('renders settings heading', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders all 5 tab buttons', () => {
    render(<SettingsScreen />);
    // Use getAllByText since 'General' appears both as tab button and card title
    const generalElements = screen.getAllByText('General');
    expect(generalElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('API')).toBeDefined();
    expect(screen.getByText('Bash Profile')).toBeDefined();
    expect(screen.getByText('SSH Remotes')).toBeDefined();
    expect(screen.getByText('Code Server')).toBeDefined();
  });

  it('shows General tab content by default', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Default Contributions Directory')).toBeDefined();
  });

  it('switches to API tab', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    await user.click(screen.getByText('API'));
    expect(screen.getByText('Personal Access Token')).toBeDefined();
  });

  it('switches to Bash Profile tab', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    await user.click(screen.getByText('Bash Profile'));
    expect(screen.getByText('Shell Aliases')).toBeDefined();
  });

  // ── AT-26: Code Server Tab Navigation ───────────────────────────

  it('switches to Code Server tab and renders CodeServerTab content', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    await user.click(screen.getByText('Code Server'));
    expect(screen.getByText('Resource Allocation')).toBeDefined();
    expect(screen.getByText('Current Usage')).toBeDefined();
    expect(screen.getByText('Startup Behavior')).toBeDefined();
  });

  it('default active tab is General', () => {
    render(<SettingsScreen />);
    // General tab content should be visible
    expect(screen.getByText('Default Contributions Directory')).toBeDefined();
    // Code Server content should NOT be visible
    expect(screen.queryByText('Resource Allocation')).toBeNull();
  });

  it('tab switching works correctly between all tabs', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    // Start on General
    expect(screen.getByText('Default Contributions Directory')).toBeDefined();

    // Switch to Code Server
    await user.click(screen.getByText('Code Server'));
    expect(screen.getByText('Resource Allocation')).toBeDefined();
    expect(screen.queryByText('Default Contributions Directory')).toBeNull();

    // Switch back to General
    const generalElements = screen.getAllByText('General');
    await user.click(generalElements[0]);
    expect(screen.getByText('Default Contributions Directory')).toBeDefined();
    expect(screen.queryByText('Resource Allocation')).toBeNull();
  });
});
