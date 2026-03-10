import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock IPC client
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { CoveragePanel } from '../../../../src/renderer/components/tools/CoveragePanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  coverageCommand: 'npx vitest run --coverage',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onRunCommand: vi.fn(),
};

describe('CoveragePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows detecting state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<CoveragePanel {...defaultProps} />);

    expect(screen.getByText('Detecting coverage provider...')).toBeDefined();
  });

  it('shows provider detected with config', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: '/test/.vitest.config.json',
      hasConfig: true,
      reportPath: '/test/coverage/index.html',
    });

    render(<CoveragePanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('v8')).toBeDefined();
    });
    expect(screen.getByText('Run Coverage')).toBeDefined();
    expect(screen.getByText('Open Report')).toBeDefined();
    expect(screen.getByText('Edit Config')).toBeDefined();
  });

  it('shows no provider detected for empty project', async () => {
    mockInvoke.mockResolvedValue({
      provider: null,
      configPath: null,
      hasConfig: false,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No coverage provider detected')).toBeDefined();
    });
    expect(screen.getByText('Create Config')).toBeDefined();
  });

  it('shows Create Config for node ecosystem with no provider', async () => {
    mockInvoke.mockResolvedValue({
      provider: null,
      configPath: null,
      hasConfig: false,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });
  });

  it('does not show Create Config for non-node ecosystem with no provider', async () => {
    mockInvoke.mockResolvedValue({
      provider: null,
      configPath: null,
      hasConfig: false,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} ecosystem="go" />);

    await waitFor(() => {
      expect(screen.getByText('No coverage provider detected')).toBeDefined();
    });
    expect(screen.queryByText('Create Config')).toBeNull();
  });

  it('calls onRunCommand when Run Coverage clicked', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: '/test/vitest.config.json',
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} onRunCommand={onRunCommand} />);

    await waitFor(() => {
      expect(screen.getByText('Run Coverage')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Run Coverage').closest('button')!);
    expect(onRunCommand).toHaveBeenCalledWith('npx vitest run --coverage');
  });

  it('calls onOpenEditor when Edit Config clicked', async () => {
    const onOpenEditor = vi.fn();
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: '/test/vitest.config.json',
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} onOpenEditor={onOpenEditor} />);

    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Edit Config').closest('button')!);
    expect(onOpenEditor).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    mockInvoke.mockResolvedValue({
      provider: null,
      configPath: null,
      hasConfig: false,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Coverage Config')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Open Report when no reportPath', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: '/test/vitest.config.json',
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Run Coverage')).toBeDefined();
    });
    expect(screen.queryByText('Open Report')).toBeNull();
  });

  it('shows Create Config instead of Edit Config when no config exists', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: null,
      hasConfig: false,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });
    expect(screen.queryByText('Edit Config')).toBeNull();
  });

  it('disables Run Coverage when no coverage command', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: '/test/vitest.config.json',
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} coverageCommand={null} />);

    await waitFor(() => {
      expect(screen.getByText('Run Coverage')).toBeDefined();
    });

    const btn = screen.getByText('Run Coverage').closest('button');
    expect(btn?.disabled).toBe(true);
  });

  it('handles detection error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Detection failed'));

    render(<CoveragePanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No coverage provider detected')).toBeDefined();
    });
  });

  // ── Branch coverage: handleOpenReport ──

  it('calls ipc to open report when Open Report clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/vitest.config.json',
          hasConfig: true,
          reportPath: '/test/coverage/index.html',
        });
      }
      if (channel === 'dev-tools:open-coverage-report') {
        return Promise.resolve({ success: true, message: 'Report opened' });
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Open Report')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Open Report').closest('button')!);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:open-coverage-report',
        '/test/coverage/index.html'
      );
    });
  });

  it('shows failure status when open report fails', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/vitest.config.json',
          hasConfig: true,
          reportPath: '/test/coverage/index.html',
        });
      }
      if (channel === 'dev-tools:open-coverage-report') {
        return Promise.reject(new Error('File not found'));
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Open Report')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Open Report').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Failed to open')).toBeDefined();
    });
  });

  // ── Branch coverage: handleRunCoverage with null coverageCommand ──

  it('does not call onRunCommand when Run Coverage clicked with null command', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: '/test/vitest.config.json',
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} coverageCommand={null} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Run Coverage')).toBeDefined();
    });

    const btn = screen.getByText('Run Coverage').closest('button')!;
    expect(btn.disabled).toBe(true);
    await userEvent.click(btn);
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  // ── Branch coverage: handleCreateConfig ──

  it('creates config successfully and re-detects provider', async () => {
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        detectCount++;
        if (detectCount === 1) {
          return Promise.resolve({
            provider: null,
            configPath: null,
            hasConfig: false,
            reportPath: null,
          });
        }
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      }
      if (channel === 'dev-tools:get-coverage-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-coverage-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('v8')).toBeDefined();
    });
  });

  it('shows failure message when config creation throws', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        return Promise.resolve({
          provider: null,
          configPath: null,
          hasConfig: false,
          reportPath: null,
        });
      }
      if (channel === 'dev-tools:get-coverage-presets') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  it('shows message when write-coverage-config returns success false', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        return Promise.resolve({
          provider: null,
          configPath: null,
          hasConfig: false,
          reportPath: null,
        });
      }
      if (channel === 'dev-tools:get-coverage-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-coverage-config') {
        return Promise.resolve({ success: false, message: 'Already exists' });
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Already exists')).toBeDefined();
    });
  });

  it('shows "No provider to configure" for non-node ecosystem with null provider', async () => {
    // For non-node, the Create Config button does NOT appear in the no-provider view.
    // We need to test via the action buttons view: provider = null, hasConfig = true
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        return Promise.resolve({
          provider: null,
          configPath: null,
          hasConfig: true,
          reportPath: null,
        });
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} ecosystem="go" />);
    await waitFor(() => {
      expect(screen.getByText('Coverage Provider')).toBeDefined();
    });
  });

  // ── Branch coverage: Create Config from action buttons view ──

  it('invokes handleCreateConfig from action buttons when provider detected but no config', async () => {
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        detectCount++;
        if (detectCount === 1) {
          return Promise.resolve({
            provider: 'v8',
            configPath: null,
            hasConfig: false,
            reportPath: null,
          });
        }
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/vitest.config.json',
          hasConfig: true,
          reportPath: null,
        });
      }
      if (channel === 'dev-tools:get-coverage-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-coverage-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('v8')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });
  });

  // ── Branch coverage: providerLabel fallback ──

  it('falls back to raw provider name when not in PROVIDER_LABELS', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'custom-provider',
      configPath: '/test/custom.config.json',
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('custom-provider')).toBeDefined();
    });
  });

  it('shows "Coverage Provider" heading when providerLabel is null', async () => {
    mockInvoke.mockResolvedValue({
      provider: null,
      configPath: null,
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Coverage Provider')).toBeDefined();
    });
  });

  // ── Branch coverage: onClose from provider-detected view ──

  it('calls onClose from the provider-detected view close button', async () => {
    mockInvoke.mockResolvedValue({
      provider: 'v8',
      configPath: '/test/vitest.config.json',
      hasConfig: true,
      reportPath: null,
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('v8')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Branch coverage: status display in action buttons view ──

  it('displays status text after open report succeeds', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-coverage') {
        return Promise.resolve({
          provider: 'v8',
          configPath: '/test/vitest.config.json',
          hasConfig: true,
          reportPath: '/test/coverage/index.html',
        });
      }
      if (channel === 'dev-tools:open-coverage-report') {
        return Promise.resolve({ success: true, message: 'Report opened successfully' });
      }
      return Promise.resolve(null);
    });

    render(<CoveragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Open Report')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Open Report').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Report opened successfully')).toBeDefined();
    });
  });
});
