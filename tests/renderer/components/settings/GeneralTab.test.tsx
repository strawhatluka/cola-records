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

  describe('Directory selection - cancelled (null result)', () => {
    beforeEach(() => {
      mockInvoke.mockResolvedValue(null);
    });

    it('retains original clone path when dialog is cancelled', async () => {
      const user = userEvent.setup();
      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const browseButtons = screen.getAllByText('Browse');
      await user.click(browseButtons[0]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
      });

      // Path should remain unchanged
      const clonePathInput = screen.getByDisplayValue('/mock/contributions');
      expect(clonePathInput).toBeDefined();
    });

    it('retains original projects path when dialog is cancelled', async () => {
      const user = userEvent.setup();
      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const browseButtons = screen.getAllByText('Browse');
      await user.click(browseButtons[1]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
      });

      // Path should remain unchanged
      const projectsPathInput = screen.getByDisplayValue('/mock/projects');
      expect(projectsPathInput).toBeDefined();
    });

    it('retains original professional projects path when dialog is cancelled', async () => {
      const user = userEvent.setup();
      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const browseButtons = screen.getAllByText('Browse');
      await user.click(browseButtons[2]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
      });

      // Path should remain unchanged
      const professionalPathInput = screen.getByDisplayValue('/mock/professional');
      expect(professionalPathInput).toBeDefined();
    });
  });

  describe('Directory selection - error handling', () => {
    const dialogError = new Error('Dialog error');

    beforeEach(() => {
      mockInvoke.mockRejectedValue(dialogError);
    });

    it('retains original clone path when dialog errors', async () => {
      const user = userEvent.setup();
      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const browseButtons = screen.getAllByText('Browse');
      await user.click(browseButtons[0]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
      });

      // Path should remain unchanged
      const clonePathInput = screen.getByDisplayValue('/mock/contributions');
      expect(clonePathInput).toBeDefined();
    });

    it('retains original projects path when dialog errors', async () => {
      const user = userEvent.setup();
      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const browseButtons = screen.getAllByText('Browse');
      await user.click(browseButtons[1]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
      });

      // Path should remain unchanged
      const projectsPathInput = screen.getByDisplayValue('/mock/projects');
      expect(projectsPathInput).toBeDefined();
    });

    it('retains original professional projects path when dialog errors', async () => {
      const user = userEvent.setup();
      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const browseButtons = screen.getAllByText('Browse');
      await user.click(browseButtons[2]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('dialog:open-directory');
      });

      // Path should remain unchanged
      const professionalPathInput = screen.getByDisplayValue('/mock/professional');
      expect(professionalPathInput).toBeDefined();
    });
  });

  describe('Save settings - error handling', () => {
    it('shows error alert when save fails', async () => {
      const saveError = new Error('Failed to save');
      const mockFailingUpdate = vi.fn().mockRejectedValue(saveError);
      const user = userEvent.setup();

      render(<GeneralTab settings={baseSettings} onUpdate={mockFailingUpdate} />);

      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(`Failed to save settings: ${saveError}`);
      });

      // setAppTheme should NOT be called on error
      expect(mockSetTheme).not.toHaveBeenCalled();
    });
  });

  describe('Theme selection and save', () => {
    it('updates theme to dark and saves', async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValue('/selected/path');

      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      // Find and click the theme select trigger
      const themeLabel = screen.getByText('Theme');
      const selectTrigger = themeLabel.closest('div')?.querySelector('[role="combobox"]');

      if (!selectTrigger) {
        throw new Error('Theme select trigger not found');
      }

      await user.click(selectTrigger);

      // Click the dark theme option
      const darkOption = screen.getByText('Dark');
      await user.click(darkOption);

      // Save settings
      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          defaultClonePath: '/mock/contributions',
          defaultProjectsPath: '/mock/projects',
          defaultProfessionalProjectsPath: '/mock/professional',
          theme: 'dark',
        });
      });

      // Verify setAppTheme was called with dark
      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
      });
    });

    it('updates theme to light and saves', async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValue('/selected/path');

      render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      // Find and click the theme select trigger
      const themeLabel = screen.getByText('Theme');
      const selectTrigger = themeLabel.closest('div')?.querySelector('[role="combobox"]');

      if (!selectTrigger) {
        throw new Error('Theme select trigger not found');
      }

      await user.click(selectTrigger);

      // Click the light theme option
      const lightOption = screen.getByText('Light');
      await user.click(lightOption);

      // Save settings
      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          defaultClonePath: '/mock/contributions',
          defaultProjectsPath: '/mock/projects',
          defaultProfessionalProjectsPath: '/mock/professional',
          theme: 'light',
        });
      });

      // Verify setAppTheme was called with light
      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith('light');
      });
    });
  });

  describe('Props synchronization via useEffect', () => {
    it('updates state when settings prop changes', async () => {
      const { rerender } = render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      // Verify initial values
      expect(screen.getByDisplayValue('/mock/contributions')).toBeDefined();
      expect(screen.getByDisplayValue('/mock/projects')).toBeDefined();
      expect(screen.getByDisplayValue('/mock/professional')).toBeDefined();

      // Update settings prop
      const updatedSettings: AppSettings = {
        ...baseSettings,
        defaultClonePath: '/new/contributions',
        defaultProjectsPath: '/new/projects',
        defaultProfessionalProjectsPath: '/new/professional',
        theme: 'dark',
      };

      rerender(<GeneralTab settings={updatedSettings} onUpdate={mockOnUpdate} />);

      // Verify updated values appear
      await waitFor(() => {
        expect(screen.getByDisplayValue('/new/contributions')).toBeDefined();
        expect(screen.getByDisplayValue('/new/projects')).toBeDefined();
        expect(screen.getByDisplayValue('/new/professional')).toBeDefined();
      });
    });

    it('syncs theme when settings prop theme changes', async () => {
      const { rerender } = render(<GeneralTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      // Initial theme is 'system'
      // Update to dark theme
      const updatedSettings: AppSettings = {
        ...baseSettings,
        theme: 'dark',
      };

      rerender(<GeneralTab settings={updatedSettings} onUpdate={mockOnUpdate} />);

      // Save to verify the theme was synced internally
      const user = userEvent.setup();
      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: 'dark',
          })
        );
      });
    });
  });
});
