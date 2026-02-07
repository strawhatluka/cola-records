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
      defaultProjectsPath: '/mock/projects',
      defaultProfessionalProjectsPath: '/mock/professional',
      autoFetch: true,
      aliases: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({
      theme: 'system',
      defaultClonePath: '/mock/path',
      defaultProjectsPath: '/mock/projects',
      defaultProfessionalProjectsPath: '/mock/professional',
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
    // Use getAllByText since 'General' appears both as tab button and card title
    const generalElements = screen.getAllByText('General');
    expect(generalElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('API')).toBeDefined();
    expect(screen.getByText('Bash Profile')).toBeDefined();
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
});
