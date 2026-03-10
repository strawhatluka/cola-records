import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { FormatPanel } from '../../../../src/renderer/components/tools/FormatPanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  formatCommand: 'npm run format',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onOpenIgnoreEditor: vi.fn(),
  onRunCommand: vi.fn(),
};

describe('FormatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Detection ──

  it('shows detecting state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<FormatPanel {...defaultProps} />);
    expect(screen.getByText('Detecting formatter...')).toBeDefined();
  });

  it('shows detected formatter with config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier')).toBeDefined();
    });
  });

  it('shows no-config setup when no config found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: 'prettier', configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Detected: Prettier (no config file)')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });
  });

  it('shows "No formatter detected" when nothing found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No formatter detected')).toBeDefined();
    });
  });

  // ── Config exists — actions ──

  it('renders action buttons when config exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Format')).toBeDefined();
      expect(screen.getByText('Format Check')).toBeDefined();
      expect(screen.getByText('Edit Config')).toBeDefined();
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });
  });

  it('calls onRunCommand with format command when Run Format clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Format')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Run Format').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm run format');
  });

  it('calls onRunCommand with --check flag for Format Check', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format Check')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Format Check').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm run format --check');
  });

  it('calls onOpenEditor when Edit Config clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Edit Config').closest('button')!);
    expect(defaultProps.onOpenEditor).toHaveBeenCalled();
  });

  it('calls create-format-ignore when Create Ignore clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:create-format-ignore')
        return Promise.resolve({ success: true, message: 'Created .prettierignore' });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Ignore').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:create-format-ignore',
        '/test/project',
        'prettier'
      );
    });
  });

  it('calls onClose when close button is clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTitle('Close')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Edit Ignore button ──

  it('shows Edit Ignore instead of Create Ignore when ignore file exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore')
        return Promise.resolve('node_modules/\ndist/\n');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Ignore')).toBeDefined();
    });
    expect(screen.queryByText('Create Ignore')).toBeNull();
  });

  it('calls onOpenIgnoreEditor when Edit Ignore clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('node_modules/\n');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Edit Ignore').closest('button')!);
    expect(defaultProps.onOpenIgnoreEditor).toHaveBeenCalled();
  });

  it('switches from Create Ignore to Edit Ignore after successful creation', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      if (channel === 'dev-tools:create-format-ignore')
        return Promise.resolve({ success: true, message: 'Created .prettierignore' });
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Ignore').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Edit Ignore')).toBeDefined();
    });
    expect(screen.queryByText('Create Ignore')).toBeNull();
  });

  // ── Detection error handling ──

  it('shows fallback state when detection fails', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.reject(new Error('Detection failed'));
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No formatter detected')).toBeDefined();
    });
  });

  // ── Formatter without check flag (e.g., gofmt) ──

  it('does not show Format Check button for formatters without check flag', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'gofmt',
          configPath: '/test/project/gofmt.conf',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Format')).toBeDefined();
    });
    expect(screen.queryByText('Format Check')).toBeNull();
  });

  // ── Formatter label fallback (unlisted formatter uses raw name) ──

  it('uses raw formatter name when not in FORMATTER_LABELS', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'custom-fmt',
          configPath: '/test/project/.custom-fmt',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('custom-fmt')).toBeDefined();
    });
  });

  // ── handleRunFormat when formatCommand is null ──

  it('does not call onRunCommand when formatCommand is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    const onRunCommand = vi.fn();
    render(<FormatPanel {...defaultProps} formatCommand={null} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Run Format')).toBeDefined();
    });

    // Run Format button should be disabled
    const runBtn = screen.getByText('Run Format').closest('button')!;
    expect(runBtn.disabled).toBe(true);
  });

  // ── handleCreateConfig: create-config with non-node ecosystem and no formatter ──

  it('shows "No formatter to configure" when no formatter and non-node ecosystem', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} ecosystem={'python' as any} />);
    await waitFor(() => {
      expect(screen.getByText('No formatter detected')).toBeDefined();
    });

    // No "Create Config" button should be shown for non-node ecosystem with no formatter
    expect(screen.queryByText('Create Config')).toBeNull();
  });

  // ── handleCreateConfig: catch block ──

  it('shows "Failed" status when create config errors', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: 'prettier', configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      if (channel === 'dev-tools:get-format-presets')
        return Promise.reject(new Error('Preset error'));
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  // ── handleCreateConfig: successful config creation re-detects formatter ──

  it('re-detects formatter after successful config creation', async () => {
    let detectCallCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter') {
        detectCallCount++;
        if (detectCallCount === 1) {
          return Promise.resolve({ formatter: 'prettier', configPath: null, hasConfig: false });
        }
        // After creation, return with config
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      }
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      if (channel === 'dev-tools:get-format-presets') return Promise.resolve({});
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Config created' });
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);

    await waitFor(() => {
      // After re-detection, should show action buttons
      expect(screen.getByText('Run Format')).toBeDefined();
    });
  });

  // ── handleCreateIgnore: catch block ──

  it('shows "Failed" status when create ignore errors', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      if (channel === 'dev-tools:create-format-ignore')
        return Promise.reject(new Error('Write error'));
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Ignore').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  // ── handleCreateIgnore: unsuccessful result does not flip to Edit Ignore ──

  it('does not switch to Edit Ignore when creation result is not success', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      if (channel === 'dev-tools:create-format-ignore')
        return Promise.resolve({ success: false, message: 'Permission denied' });
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Ignore')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Ignore').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });
    // Should still show Create Ignore, not Edit Ignore
    expect(screen.getByText('Create Ignore')).toBeDefined();
    expect(screen.queryByText('Edit Ignore')).toBeNull();
  });

  // ── handleFormatCheck: no check flag for formatter ──

  it('does not call onRunCommand for format check when formatter has no check flag', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'gofmt',
          configPath: '/test/project/gofmt.conf',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    const onRunCommand = vi.fn();
    render(<FormatPanel {...defaultProps} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('gofmt')).toBeDefined();
    });

    // Format Check button should not even exist for gofmt
    expect(screen.queryByText('Format Check')).toBeNull();
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  // ── No-config detected formatter label shows "Detected: X (no config file)" ──

  it('shows "Detected: <label> (no config file)" for known formatter without config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: 'ruff', configPath: null, hasConfig: false });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} ecosystem={'python' as any} />);
    await waitFor(() => {
      expect(screen.getByText('Detected: Ruff (no config file)')).toBeDefined();
    });
  });

  // ── formatterLabel fallback to 'Formatter' when null ──

  it('shows "Formatter" heading when formatter is null but hasConfig is true', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: '/some/config', hasConfig: true });
      if (channel === 'dev-tools:read-format-ignore') return Promise.resolve('');
      return Promise.resolve(null);
    });

    render(<FormatPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Formatter')).toBeDefined();
    });
  });
});
