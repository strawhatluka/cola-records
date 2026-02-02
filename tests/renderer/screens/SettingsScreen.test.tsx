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
      autoFetch: true,
      aliases: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({
      theme: 'system',
      defaultClonePath: '/mock/path',
      autoFetch: true,
      aliases: [],
    });
  });

  it('renders settings heading', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders all tabs', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('API')).toBeDefined();
    expect(screen.getByText('Aliases')).toBeDefined();
  });

  it('shows General tab content by default', () => {
    render(<SettingsScreen />);
    // GeneralTab should be visible
    expect(screen.getByText('Default Clone Directory')).toBeDefined();
  });

  it('switches to API tab', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    await user.click(screen.getByText('API'));
    expect(screen.getByText('Personal Access Token')).toBeDefined();
  });

  it('switches to Aliases tab', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    await user.click(screen.getByText('Aliases'));
    expect(screen.getByText('Shell Aliases')).toBeDefined();
  });
});
