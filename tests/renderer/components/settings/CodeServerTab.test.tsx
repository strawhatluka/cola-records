import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockSettings, createMockCodeServerConfig } from '../../../mocks/factories';

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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { CodeServerTab } from '../../../../src/renderer/components/settings/CodeServerTab';

describe('CodeServerTab', () => {
  const baseConfig = createMockCodeServerConfig();
  const baseSettings = createMockSettings({ codeServerConfig: baseConfig });
  const mockOnUpdate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    // Default: stats returns null (container not running)
    mockInvoke.mockResolvedValue(null);
  });

  // ── AT-17: Rendering and Props Display ──────────────────────────

  describe('rendering and props display', () => {
    it('renders restart banner text', () => {
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Changes will apply next time code-server starts')).toBeDefined();
    });

    it('renders all 7 section headings', () => {
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Resource Allocation')).toBeDefined();
      expect(screen.getByText('Current Usage')).toBeDefined();
      expect(screen.getByText('Startup Behavior')).toBeDefined();
      expect(screen.getByText('VS Code Settings')).toBeDefined();
      expect(screen.getByText('Extensions')).toBeDefined();
      expect(screen.getByText('Environment')).toBeDefined();
      expect(screen.getByText('Advanced')).toBeDefined();
    });

    it('displays current CPU/memory/shm values from settings props', () => {
      const config = createMockCodeServerConfig({
        cpuLimit: 4,
        memoryLimit: '4g',
        shmSize: '512m',
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.getByDisplayValue('4')).toBeDefined();
      expect(screen.getByDisplayValue('4g')).toBeDefined();
      expect(screen.getByDisplayValue('512m')).toBeDefined();
    });

    it('displays startup, VS Code, and advanced values from props', () => {
      const config = createMockCodeServerConfig({
        healthCheckTimeout: 120,
        terminalScrollback: 5000,
        containerName: 'my-custom-container',
        timezone: 'America/New_York',
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.getByDisplayValue('120')).toBeDefined();
      expect(screen.getByDisplayValue('5000')).toBeDefined();
      expect(screen.getByDisplayValue('my-custom-container')).toBeDefined();
      expect(screen.getByDisplayValue('America/New_York')).toBeDefined();
    });

    it('renders correctly with undefined codeServerConfig (defaults shown)', () => {
      const settings = createMockSettings({ codeServerConfig: undefined });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      // Default values should be visible
      expect(screen.getByDisplayValue('256m')).toBeDefined(); // shmSize default
      expect(screen.getByDisplayValue('90')).toBeDefined(); // healthCheckTimeout default
      expect(screen.getByDisplayValue('1000')).toBeDefined(); // terminalScrollback default
      expect(screen.getByDisplayValue('cola-code-server')).toBeDefined(); // containerName default
      expect(screen.getByDisplayValue('UTC')).toBeDefined(); // timezone default
    });

    it('renders Save Settings and Reset to Defaults buttons', () => {
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('Save Settings')).toBeDefined();
      expect(screen.getByText('Reset to Defaults')).toBeDefined();
    });

    it('displays extensions from settings', () => {
      const config = createMockCodeServerConfig({
        autoInstallExtensions: ['ms-python.python', 'dbaeumer.vscode-eslint'],
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('ms-python.python')).toBeDefined();
      expect(screen.getByText('dbaeumer.vscode-eslint')).toBeDefined();
    });

    it('displays custom env vars from settings', () => {
      const config = createMockCodeServerConfig({
        customEnvVars: [
          { key: 'NODE_ENV', value: 'development' },
          { key: 'DEBUG', value: 'true' },
        ],
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('NODE_ENV')).toBeDefined();
      expect(screen.getByText('development')).toBeDefined();
      expect(screen.getByText('DEBUG')).toBeDefined();
    });

    it('shows "No extensions configured" when list is empty', () => {
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('No extensions configured')).toBeDefined();
    });

    it('shows "No custom variables configured" when env vars list is empty', () => {
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);
      expect(screen.getByText('No custom variables configured')).toBeDefined();
    });
  });

  // ── AT-18: Preset Selection and Manual Override ─────────────────

  describe('preset selection and manual override', () => {
    it('clicking "Light" preset fills CPU=1, Memory=1g, SHM=128m', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await user.click(screen.getByText('Light'));

      expect(screen.getByDisplayValue('1')).toBeDefined();
      expect(screen.getByDisplayValue('1g')).toBeDefined();
      expect(screen.getByDisplayValue('128m')).toBeDefined();
    });

    it('clicking "Standard" preset fills CPU=2, Memory=2g, SHM=256m', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await user.click(screen.getByText('Standard'));

      expect(screen.getByDisplayValue('2')).toBeDefined();
      expect(screen.getByDisplayValue('2g')).toBeDefined();
      expect(screen.getByDisplayValue('256m')).toBeDefined();
    });

    it('clicking "Performance" preset fills CPU=4, Memory=4g, SHM=512m', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await user.click(screen.getByText('Performance'));

      expect(screen.getByDisplayValue('4')).toBeDefined();
      expect(screen.getByDisplayValue('4g')).toBeDefined();
      expect(screen.getByDisplayValue('512m')).toBeDefined();
    });

    it('clicking "Unlimited" preset clears CPU and Memory, sets SHM=256m', async () => {
      const user = userEvent.setup();
      // Start with Performance preset values so we can see the change
      const config = createMockCodeServerConfig({
        cpuLimit: 4,
        memoryLimit: '4g',
        shmSize: '512m',
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      await user.click(screen.getByText('Unlimited'));

      // CPU and Memory inputs should be empty (unlimited)
      const cpuInput = screen.getByLabelText('CPU Cores') as HTMLInputElement;
      const memInput = screen.getByLabelText('Memory') as HTMLInputElement;
      expect(cpuInput.value).toBe('');
      expect(memInput.value).toBe('');
      expect(screen.getByDisplayValue('256m')).toBeDefined();
    });

    it('manually editing CPU field clears active preset highlight', async () => {
      const user = userEvent.setup();
      const config = createMockCodeServerConfig({
        cpuLimit: 2,
        memoryLimit: '2g',
        shmSize: '256m',
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      // Standard preset should be active initially
      const standardButton = screen.getByText('Standard');
      expect(standardButton.closest('button')!.getAttribute('data-variant')).toBe('default');

      // Edit CPU manually
      const cpuInput = screen.getByLabelText('CPU Cores');
      await user.clear(cpuInput);
      await user.type(cpuInput, '3');

      // Standard button should no longer have default variant
      await waitFor(() => {
        expect(standardButton.closest('button')!.getAttribute('data-variant')).toBe('outline');
      });
    });

    it('preset changes do not call onUpdate (local state only)', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await user.click(screen.getByText('Light'));
      await user.click(screen.getByText('Performance'));

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  // ── AT-19: Save, Reset, and Validation ──────────────────────────

  describe('save, reset, and validation', () => {
    it('Save button calls onUpdate with complete codeServerConfig object', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          codeServerConfig: expect.objectContaining({
            shmSize: '256m',
            autoStartDocker: true,
            healthCheckTimeout: 90,
            autoSyncHostSettings: true,
            gpuAcceleration: 'on',
            terminalScrollback: 1000,
            autoInstallExtensions: [],
            timezone: 'UTC',
            customEnvVars: [],
            containerName: 'cola-code-server',
          }),
        });
      });
    });

    it('Reset button restores all fields to prop values', async () => {
      const user = userEvent.setup();
      const config = createMockCodeServerConfig({
        cpuLimit: 2,
        memoryLimit: '2g',
        containerName: 'original',
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      // Change some values
      const containerInput = screen.getByLabelText('Container Name');
      await user.clear(containerInput);
      await user.type(containerInput, 'modified');

      expect(screen.getByDisplayValue('modified')).toBeDefined();

      // Click Reset
      await user.click(screen.getByText('Reset to Defaults'));

      // Should be back to original values
      expect(screen.getByDisplayValue('original')).toBeDefined();
    });

    it('local changes do not trigger onUpdate until Save', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      // Make some changes without saving
      const containerInput = screen.getByLabelText('Container Name');
      await user.clear(containerInput);
      await user.type(containerInput, 'new-name');

      await user.click(screen.getByText('Light'));

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('negative CPU value shows validation error', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const cpuInput = screen.getByLabelText('CPU Cores');
      await user.type(cpuInput, '-1');
      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(screen.getByText('CPU limit must be a positive number')).toBeDefined();
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('invalid memory format shows validation error', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const memInput = screen.getByLabelText('Memory');
      await user.type(memInput, 'abc');
      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(
          screen.getByText('Memory must be a number followed by k, m, or g (e.g., 2g)')
        ).toBeDefined();
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('zero scrollback shows validation error', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const scrollInput = screen.getByLabelText('Terminal Scrollback Lines');
      await user.clear(scrollInput);
      await user.type(scrollInput, '0');
      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(screen.getByText('Scrollback must be a positive number')).toBeDefined();
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('empty container name shows validation error', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const containerInput = screen.getByLabelText('Container Name');
      await user.clear(containerInput);
      await user.click(screen.getByText('Save Settings'));

      await waitFor(() => {
        expect(screen.getByText('Container name cannot be empty')).toBeDefined();
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('reserved env var name shows validation error', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const keyInput = screen.getByPlaceholderText('Key');
      const valueInput = screen.getByPlaceholderText('Value');

      await user.type(keyInput, 'PUID');
      await user.type(valueInput, '1000');

      // Find the Add button for env vars (the one next to the env var inputs)
      const envSection = screen.getByText('Custom Environment Variables').closest('div')!;
      const addButtons = within(envSection).getAllByRole('button');
      const addButton = addButtons[addButtons.length - 1]; // Last button is the Add
      await user.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText('"PUID" is a reserved environment variable and cannot be set')
        ).toBeDefined();
      });
    });
  });

  // ── AT-20: Extension and Env Var Management ─────────────────────

  describe('extension and env var management', () => {
    it('add extension ID to list (appears in UI)', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const extInput = screen.getByPlaceholderText('Extension ID (e.g., ms-python.python)');
      await user.type(extInput, 'ms-python.python');

      const extSection = extInput.closest('.space-y-3')!;
      const addButton = within(extSection as HTMLElement).getAllByRole('button')[0];
      await user.click(addButton);

      expect(screen.getByText('ms-python.python')).toBeDefined();
    });

    it('remove extension from list', async () => {
      const user = userEvent.setup();
      const config = createMockCodeServerConfig({
        autoInstallExtensions: ['ms-python.python'],
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('ms-python.python')).toBeDefined();

      // Find the remove button (X icon) next to the extension
      const extItem = screen.getByText('ms-python.python').closest('div')!;
      const removeButton = within(extItem).getByRole('button');
      await user.click(removeButton);

      expect(screen.queryByText('ms-python.python')).toBeNull();
    });

    it('duplicate extension ID prevented', async () => {
      const user = userEvent.setup();
      const config = createMockCodeServerConfig({
        autoInstallExtensions: ['ms-python.python'],
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      const extInput = screen.getByPlaceholderText('Extension ID (e.g., ms-python.python)');
      await user.type(extInput, 'ms-python.python');

      const extSection = extInput.closest('.space-y-3')!;
      const addButton = within(extSection as HTMLElement).getAllByRole('button')[0];
      await user.click(addButton);

      // Should still only show one instance
      const instances = screen.getAllByText('ms-python.python');
      expect(instances).toHaveLength(1);
    });

    it('empty extension ID not added', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const extInput = screen.getByPlaceholderText('Extension ID (e.g., ms-python.python)');
      const extSection = extInput.closest('.space-y-3')!;
      const addButton = within(extSection as HTMLElement).getAllByRole('button')[0];
      await user.click(addButton);

      // "No extensions configured" should still be visible
      expect(screen.getByText('No extensions configured')).toBeDefined();
    });

    it('add env var key-value pair', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      const keyInput = screen.getByPlaceholderText('Key');
      const valueInput = screen.getByPlaceholderText('Value');

      await user.type(keyInput, 'NODE_ENV');
      await user.type(valueInput, 'production');

      // Click add button for env vars
      const envSection = screen.getByText('Custom Environment Variables').closest('div')!;
      const addButtons = within(envSection).getAllByRole('button');
      const addButton = addButtons[addButtons.length - 1];
      await user.click(addButton);

      expect(screen.getByText('NODE_ENV')).toBeDefined();
      expect(screen.getByText('production')).toBeDefined();
    });

    it('remove env var', async () => {
      const user = userEvent.setup();
      const config = createMockCodeServerConfig({
        customEnvVars: [{ key: 'MY_VAR', value: 'test' }],
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('MY_VAR')).toBeDefined();

      // Find the remove button next to the env var
      const envItem = screen.getByText('MY_VAR').closest('div.flex') as HTMLElement;
      const removeButton = within(envItem).getByRole('button');
      await user.click(removeButton);

      expect(screen.queryByText('MY_VAR')).toBeNull();
    });

    it('duplicate env var key prevented', async () => {
      const user = userEvent.setup();
      const config = createMockCodeServerConfig({
        customEnvVars: [{ key: 'EXISTING', value: 'val' }],
      });
      const settings = createMockSettings({ codeServerConfig: config });
      render(<CodeServerTab settings={settings} onUpdate={mockOnUpdate} />);

      const keyInput = screen.getByPlaceholderText('Key');
      const valueInput = screen.getByPlaceholderText('Value');
      await user.type(keyInput, 'EXISTING');
      await user.type(valueInput, 'new-val');

      // The add button is a sibling of the Value input within the same parent div
      const addButton = valueInput.parentElement!.querySelector('button')!;
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Environment variable "EXISTING" already exists')).toBeDefined();
      });
    });

    it('extension and env changes do not call onUpdate (local state only)', async () => {
      const user = userEvent.setup();
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      // Add extension
      const extInput = screen.getByPlaceholderText('Extension ID (e.g., ms-python.python)');
      await user.type(extInput, 'some.extension');
      const extSection = extInput.closest('.space-y-3')!;
      const extAddButton = within(extSection as HTMLElement).getAllByRole('button')[0];
      await user.click(extAddButton);

      // Add env var
      const keyInput = screen.getByPlaceholderText('Key');
      const valueInput = screen.getByPlaceholderText('Value');
      await user.type(keyInput, 'VAR1');
      await user.type(valueInput, 'val1');
      const envSection = screen.getByText('Custom Environment Variables').closest('div')!;
      const envButtons = within(envSection).getAllByRole('button');
      const envAddButton = envButtons[envButtons.length - 1];
      await user.click(envAddButton);

      expect(mockOnUpdate).not.toHaveBeenCalled();
    }, 15000);
  });

  // ── AT-21: Current Usage Display ────────────────────────────────

  describe('current usage display', () => {
    it('shows "not running" when stats returns null', async () => {
      mockInvoke.mockResolvedValue(null);
      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('Code server is not running')).toBeDefined();
      });
    });

    it('displays CPU% and memory when stats available', async () => {
      mockInvoke.mockResolvedValue({
        cpuPercent: 45.2,
        memUsage: '512MiB',
        memLimit: '2GiB',
        memPercent: 25.0,
      });

      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('45.2%')).toBeDefined();
        expect(screen.getByText(/512MiB/)).toBeDefined();
        expect(screen.getByText(/2GiB/)).toBeDefined();
        expect(screen.getByText(/25.0%/)).toBeDefined();
      });
    });

    it('polls on interval (IPC called multiple times)', async () => {
      vi.useFakeTimers();
      mockInvoke.mockResolvedValue(null);

      render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      // Initial call
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const initialCallCount = mockInvoke.mock.calls.filter(
        (c) => c[0] === 'code-server:get-stats'
      ).length;
      expect(initialCallCount).toBeGreaterThanOrEqual(1);

      // Advance 5 seconds for next poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      const afterPollCount = mockInvoke.mock.calls.filter(
        (c) => c[0] === 'code-server:get-stats'
      ).length;
      expect(afterPollCount).toBeGreaterThan(initialCallCount);

      // Advance another 5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      const finalCount = mockInvoke.mock.calls.filter(
        (c) => c[0] === 'code-server:get-stats'
      ).length;
      expect(finalCount).toBeGreaterThan(afterPollCount);

      vi.useRealTimers();
    });

    it('cleans up interval on unmount', async () => {
      vi.useFakeTimers();
      mockInvoke.mockResolvedValue(null);

      const { unmount } = render(<CodeServerTab settings={baseSettings} onUpdate={mockOnUpdate} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const countBeforeUnmount = mockInvoke.mock.calls.filter(
        (c) => c[0] === 'code-server:get-stats'
      ).length;

      unmount();

      // Advance timer - no more calls should happen
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      const countAfterUnmount = mockInvoke.mock.calls.filter(
        (c) => c[0] === 'code-server:get-stats'
      ).length;

      expect(countAfterUnmount).toBe(countBeforeUnmount);

      vi.useRealTimers();
    });
  });
});
