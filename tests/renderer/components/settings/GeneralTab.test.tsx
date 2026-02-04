import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
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

// Mock ThemeProvider
const mockSetTheme = vi.fn();
vi.mock('../../../../src/renderer/providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: mockSetTheme,
    resolvedTheme: 'light',
  }),
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { GeneralTab } from '../../../../src/renderer/components/settings/GeneralTab';
import type { AppSettings } from '../../../../src/main/ipc/channels';

describe('GeneralTab', () => {
  const baseSettings: AppSettings = {
    theme: 'system',
    defaultClonePath: '/mock/contributions',
    defaultProjectsPath: '/mock/projects',
    defaultProfessionalProjectsPath: '/mock/professional',
    autoFetch: true,
    aliases: [],
  };

  const mockOnUpdate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue('/selected/path');
    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders all directory sections', () => {
    render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Default Contributions Directory')).toBeDefined();
    expect(screen.getByText('Default Projects Directory')).toBeDefined();
    expect(screen.getByText('Default Professional Projects Directory')).toBeDefined();
  });

  it('renders Appearance section with theme selector', () => {
    render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Appearance')).toBeDefined();
    expect(screen.getByText('Theme')).toBeDefined();
  });

  it('renders Save Settings and Reset to Defaults buttons', () => {
    render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Save Settings')).toBeDefined();
    expect(screen.getByText('Reset to Defaults')).toBeDefined();
  });

  it('displays current settings values', () => {
    render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);
    const inputs = screen.getAllByDisplayValue('/mock/contributions');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('opens directory dialog when Browse is clicked', async () => {
    const user = userEvent.setup();
    render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

    const browseButtons = screen.getAllByText('Browse');
    await user.click(browseButtons[0]);

    expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
  });

  it('calls onUpdate with all settings when Save is clicked', async () => {
    const user = userEvent.setup();
    render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith({
        defaultClonePath: '/mock/contributions',
        defaultProjectsPath: '/mock/projects',
        defaultProfessionalProjectsPath: '/mock/professional',
        theme: 'system',
      });
    });
  });

  it('calls setAppTheme after successful save', async () => {
    const user = userEvent.setup();
    render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

    await user.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('system');
    });
  });
});
