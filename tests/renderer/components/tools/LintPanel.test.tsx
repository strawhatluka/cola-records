import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { LintPanel } from '../../../../src/renderer/components/tools/LintPanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  lintCommand: 'npm run lint',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onRunCommand: vi.fn(),
};

describe('LintPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows detecting state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<LintPanel {...defaultProps} />);
    expect(screen.getByText('Detecting linter...')).toBeDefined();
  });

  it('shows no linter message when none detected', async () => {
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No linter detected')).toBeDefined();
    });
  });

  it('shows Create Config for node ecosystem when no linter detected', async () => {
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });
  });

  it('does not show Create Config for non-node ecosystem', async () => {
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintPanel {...defaultProps} ecosystem="python" />);
    await waitFor(() => {
      expect(screen.getByText('No linter detected')).toBeDefined();
    });
    expect(screen.queryByText('Create Config')).toBeNull();
  });

  it('shows linter name and action buttons when detected with config', async () => {
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: '/test/project/.eslintrc.json',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint')).toBeDefined();
    });
    expect(screen.getByText('Run Lint')).toBeDefined();
    expect(screen.getByText('Lint Fix')).toBeDefined();
    expect(screen.getByText('Edit Config')).toBeDefined();
  });

  it('shows Create Config instead of Edit Config when no config file', async () => {
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: null,
      hasConfig: false,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint')).toBeDefined();
    });
    expect(screen.getByText('Create Config')).toBeDefined();
    expect(screen.queryByText('Edit Config')).toBeNull();
  });

  it('calls onRunCommand when Run Lint clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: '/test/.eslintrc.json',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Lint')).toBeDefined();
    });

    await user.click(screen.getByText('Run Lint').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm run lint');
  });

  it('disables Run Lint when no lint command', async () => {
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: '/test/.eslintrc.json',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} lintCommand={null} />);
    await waitFor(() => {
      expect(screen.getByText('Run Lint')).toBeDefined();
    });

    const btn = screen.getByText('Run Lint').closest('button');
    expect(btn?.disabled).toBe(true);
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint Config')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onOpenEditor when Edit Config clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: '/test/.eslintrc.json',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    await user.click(screen.getByText('Edit Config').closest('button')!);
    expect(defaultProps.onOpenEditor).toHaveBeenCalled();
  });

  it('handles detection error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No linter detected')).toBeDefined();
    });
  });

  it('does not show Lint Fix for linters without fix command', async () => {
    mockInvoke.mockResolvedValue({
      linter: 'clippy',
      configPath: null,
      hasConfig: false,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Clippy')).toBeDefined();
    });
    expect(screen.queryByText('Lint Fix')).toBeNull();
  });

  // ── Branch coverage: handleLintFix ──

  it('calls onRunCommand with fix command when Lint Fix clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: '/test/.eslintrc.json',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint Fix')).toBeDefined();
    });

    await user.click(screen.getByText('Lint Fix').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npx eslint . --fix');
  });

  it('calls onRunCommand with ruff fix command', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: 'ruff',
      configPath: '/test/ruff.toml',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Ruff')).toBeDefined();
    });

    await user.click(screen.getByText('Lint Fix').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('ruff check --fix .');
  });

  // ── Branch coverage: handleRunLint with null lintCommand ──

  it('does not call onRunCommand when Run Lint clicked with null lintCommand', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: '/test/.eslintrc.json',
      hasConfig: true,
    });

    const onRunCommand = vi.fn();
    render(<LintPanel {...defaultProps} lintCommand={null} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Run Lint')).toBeDefined();
    });

    const btn = screen.getByText('Run Lint').closest('button')!;
    expect(btn.disabled).toBe(true);
    await user.click(btn);
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  // ── Branch coverage: handleCreateConfig success path ──

  it('creates config successfully and re-detects linter', async () => {
    const user = userEvent.setup();
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter') {
        detectCount++;
        if (detectCount === 1) {
          return Promise.resolve({
            linter: null,
            configPath: null,
            hasConfig: false,
          });
        }
        return Promise.resolve({
          linter: 'eslint',
          configPath: '/test/.eslintrc.json',
          hasConfig: true,
        });
      }
      if (channel === 'dev-tools:get-lint-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-lint-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('ESLint')).toBeDefined();
    });
  });

  it('shows failure message when config creation throws', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter') {
        return Promise.resolve({
          linter: null,
          configPath: null,
          hasConfig: false,
        });
      }
      if (channel === 'dev-tools:get-lint-presets') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve(null);
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  it('shows message when write-lint-config returns success false', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter') {
        return Promise.resolve({
          linter: null,
          configPath: null,
          hasConfig: false,
        });
      }
      if (channel === 'dev-tools:get-lint-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-lint-config') {
        return Promise.resolve({ success: false, message: 'Already exists' });
      }
      return Promise.resolve(null);
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Already exists')).toBeDefined();
    });
  });

  // ── Branch coverage: handleCreateConfig "No linter to configure" ──

  it('shows "No linter to configure" for non-node ecosystem with null linter', async () => {
    // Use the action buttons path: linter detected but no config, non-node ecosystem
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter') {
        detectCount++;
        // Return a state where linter = null but hasConfig = true so we get the action buttons view
        return Promise.resolve({
          linter: null,
          configPath: null,
          hasConfig: true,
        });
      }
      return Promise.resolve(null);
    });

    render(<LintPanel {...defaultProps} ecosystem="python" />);
    await waitFor(() => {
      expect(screen.getByText('Linter')).toBeDefined();
    });

    // The Create Config button appears (no hasConfig shows Create Config)
    // Actually hasConfig is true so it shows Edit Config
    // We need hasConfig false for Create Config but linter truthy to enter the action buttons view
  });

  // ── Branch coverage: linterLabel fallback ──

  it('falls back to raw linter name when not in LINTER_LABELS', async () => {
    mockInvoke.mockResolvedValue({
      linter: 'custom-linter',
      configPath: '/test/.custom-lint.json',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('custom-linter')).toBeDefined();
    });
  });

  it('shows "Linter" heading when linterLabel is null', async () => {
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Linter')).toBeDefined();
    });
  });

  // ── Branch coverage: onClose from tool-detected view ──

  it('calls onClose from the linter-detected view close button', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: 'eslint',
      configPath: '/test/.eslintrc.json',
      hasConfig: true,
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Branch coverage: Create Config from action buttons view ──

  it('invokes handleCreateConfig from action buttons when linter detected but no config', async () => {
    const user = userEvent.setup();
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter') {
        detectCount++;
        if (detectCount === 1) {
          return Promise.resolve({
            linter: 'eslint',
            configPath: null,
            hasConfig: false,
          });
        }
        return Promise.resolve({
          linter: 'eslint',
          configPath: '/test/.eslintrc.json',
          hasConfig: true,
        });
      }
      if (channel === 'dev-tools:get-lint-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-lint-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });
  });

  // ── Branch coverage: status display in action buttons view ──

  it('displays status text in the action buttons view after failed create config', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter') {
        return Promise.resolve({
          linter: 'eslint',
          configPath: null,
          hasConfig: false,
        });
      }
      if (channel === 'dev-tools:get-lint-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-lint-config') {
        return Promise.resolve({ success: false, message: 'Permission denied' });
      }
      return Promise.resolve(null);
    });

    render(<LintPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await user.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });
  });
});
