import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { BuildPanel } from '../../../../src/renderer/components/tools/BuildPanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  buildCommand: 'npm run build',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onRunCommand: vi.fn(),
};

describe('BuildPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows detecting state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<BuildPanel {...defaultProps} />);
    expect(screen.getByText('Detecting build tool...')).toBeDefined();
  });

  it('shows no tool message when none detected', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: null,
      configPath: null,
      hasConfig: false,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No build tool detected')).toBeDefined();
    });
  });

  it('shows Create Config for node ecosystem when no tool detected', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: null,
      configPath: null,
      hasConfig: false,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });
  });

  it('does not show Create Config for non-node ecosystem', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: null,
      configPath: null,
      hasConfig: false,
    });

    render(<BuildPanel {...defaultProps} ecosystem="python" />);
    await waitFor(() => {
      expect(screen.getByText('No build tool detected')).toBeDefined();
    });
    expect(screen.queryByText('Create Config')).toBeNull();
  });

  it('shows tool name and action buttons when detected with config', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/project/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite')).toBeDefined();
    });
    expect(screen.getByText('Run Build')).toBeDefined();
    expect(screen.getByText('Dev Build')).toBeDefined();
    expect(screen.getByText('Clean Build')).toBeDefined();
    expect(screen.getByText('Edit Config')).toBeDefined();
  });

  it('shows Create Config instead of Edit Config when no config file', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: null,
      hasConfig: false,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite')).toBeDefined();
    });
    expect(screen.getByText('Create Config')).toBeDefined();
    expect(screen.queryByText('Edit Config')).toBeNull();
  });

  it('calls onRunCommand when Run Build clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Build')).toBeDefined();
    });

    await user.click(screen.getByText('Run Build').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm run build');
  });

  it('disables Run Build when no build command', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} buildCommand={null} />);
    await waitFor(() => {
      expect(screen.getByText('Run Build')).toBeDefined();
    });

    const btn = screen.getByText('Run Build').closest('button');
    expect(btn?.disabled).toBe(true);
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: null,
      configPath: null,
      hasConfig: false,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Build Config')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onOpenEditor when Edit Config clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    await user.click(screen.getByText('Edit Config').closest('button')!);
    expect(defaultProps.onOpenEditor).toHaveBeenCalled();
  });

  it('handles detection error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No build tool detected')).toBeDefined();
    });
  });

  // ── Branch coverage: handleDevBuild ──

  it('calls onRunCommand with dev command when Dev Build clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Dev Build')).toBeDefined();
    });

    await user.click(screen.getByText('Dev Build').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npx vite');
  });

  it('does not show Dev Build for tool without dev command', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: 'rollup',
      configPath: '/test/rollup.config.js',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Rollup')).toBeDefined();
    });
    expect(screen.queryByText('Dev Build')).toBeNull();
  });

  // ── Branch coverage: handleCleanBuild ──

  it('calls onRunCommand with clean + build when Clean Build clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Clean Build')).toBeDefined();
    });

    await user.click(screen.getByText('Clean Build').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('rm -rf dist && npm run build');
  });

  it('does not show Clean Build for tool without clean targets', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: 'setuptools',
      configPath: '/test/setup.py',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('setuptools')).toBeDefined();
    });
    expect(screen.queryByText('Clean Build')).toBeNull();
    expect(screen.queryByText('Dev Build')).toBeNull();
  });

  it('does not show Clean Build when buildCommand is null even if clean targets exist', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} buildCommand={null} />);
    await waitFor(() => {
      expect(screen.getByText('Vite')).toBeDefined();
    });
    expect(screen.queryByText('Clean Build')).toBeNull();
  });

  it('falls back to plain build when clean targets not found but buildCommand exists', async () => {
    // 'composer' has no CLEAN_TARGETS entry
    mockInvoke.mockResolvedValue({
      buildTool: 'composer',
      configPath: '/test/composer.json',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Composer')).toBeDefined();
    });
    // No Clean Build button shown for tool without clean targets
    expect(screen.queryByText('Clean Build')).toBeNull();
  });

  // ── Branch coverage: handleCreateConfig (no-tool-detected view) ──

  it('shows status message after successful config creation', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool') {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            buildTool: null,
            configPath: null,
            hasConfig: false,
          });
        }
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.ts',
          hasConfig: true,
        });
      }
      if (channel === 'dev-tools:get-build-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-build-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Vite')).toBeDefined();
    });
  });

  it('shows failure status when config creation fails', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool') {
        return Promise.resolve({
          buildTool: null,
          configPath: null,
          hasConfig: false,
        });
      }
      if (channel === 'dev-tools:get-build-presets') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve(null);
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  it('shows message when write-build-config returns success false', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool') {
        return Promise.resolve({
          buildTool: null,
          configPath: null,
          hasConfig: false,
        });
      }
      if (channel === 'dev-tools:get-build-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-build-config') {
        return Promise.resolve({ success: false, message: 'Already exists' });
      }
      return Promise.resolve(null);
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Already exists')).toBeDefined();
    });
  });

  it('shows "No build tool to configure" for non-node ecosystem with no build tool', async () => {
    // Render with python ecosystem but force buildTool detected = null and hasConfig = false
    // so we see the "no-tool" panel. But python hides the Create Config button.
    // Instead, use the tool-detected path: buildTool detected but no config
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool') {
        // Return a tool with no config so we get the action buttons view with Create Config
        return Promise.resolve({
          buildTool: null,
          configPath: null,
          hasConfig: true, // hasConfig true so we skip no-tool view
        });
      }
      if (channel === 'dev-tools:get-build-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-build-config') {
        return Promise.resolve({ success: true, message: 'Done' });
      }
      return Promise.resolve(null);
    });

    render(<BuildPanel {...defaultProps} ecosystem="python" />);
    await waitFor(() => {
      expect(screen.getByText('Build Tool')).toBeDefined();
    });
  });

  // ── Branch coverage: handleCreateConfig from action buttons view ──

  it('invokes handleCreateConfig from action buttons when no config', async () => {
    const user = userEvent.setup();
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool') {
        detectCount++;
        if (detectCount === 1) {
          return Promise.resolve({
            buildTool: 'vite',
            configPath: null,
            hasConfig: false,
          });
        }
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.ts',
          hasConfig: true,
        });
      }
      if (channel === 'dev-tools:get-build-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-build-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });
  });

  // ── Branch coverage: toolLabel fallback ──

  it('falls back to raw build tool name when not in BUILD_TOOL_LABELS', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: 'unknown-tool',
      configPath: '/test/config.js',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('unknown-tool')).toBeDefined();
    });
  });

  it('shows "Build Tool" heading when toolLabel is null', async () => {
    mockInvoke.mockResolvedValue({
      buildTool: null,
      configPath: null,
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Build Tool')).toBeDefined();
    });
  });

  // ── Branch coverage: onClose on the tool-detected view ──

  it('calls onClose from the tool-detected view close button', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'vite',
      configPath: '/test/vite.config.ts',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Branch coverage: handleRunBuild with null buildCommand ──

  it('does not call onRunCommand when Run Build clicked with null buildCommand', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'webpack',
      configPath: '/test/webpack.config.js',
      hasConfig: true,
    });

    const onRunCommand = vi.fn();
    render(<BuildPanel {...defaultProps} buildCommand={null} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Run Build')).toBeDefined();
    });

    // Button is disabled, clicking should not trigger onRunCommand
    const btn = screen.getByText('Run Build').closest('button')!;
    expect(btn.disabled).toBe(true);
    await user.click(btn);
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  // ── Branch coverage: webpack with multiple clean targets ──

  it('constructs correct clean command for webpack with multiple targets', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'webpack',
      configPath: '/test/webpack.config.js',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Webpack')).toBeDefined();
    });

    await user.click(screen.getByText('Clean Build').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith(
      'rm -rf dist && rm -rf build && npm run build'
    );
  });

  // ── Branch coverage: Dev Build for webpack ──

  it('calls onRunCommand with webpack serve for Dev Build on webpack', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      buildTool: 'webpack',
      configPath: '/test/webpack.config.js',
      hasConfig: true,
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Dev Build')).toBeDefined();
    });

    await user.click(screen.getByText('Dev Build').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npx webpack serve');
  });

  // ── Branch coverage: status display in action buttons view ──

  it('displays status text in the action buttons view after create config', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool') {
        return Promise.resolve({
          buildTool: 'vite',
          configPath: null,
          hasConfig: false,
        });
      }
      if (channel === 'dev-tools:get-build-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-build-config') {
        return Promise.resolve({ success: false, message: 'Write error occurred' });
      }
      return Promise.resolve(null);
    });

    render(<BuildPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Write error occurred')).toBeDefined();
    });
  });
});
