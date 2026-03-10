import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { TestPanel } from '../../../../src/renderer/components/tools/TestPanel';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  testCommand: 'npm test',
  onClose: vi.fn(),
  onOpenEditor: vi.fn(),
  onRunCommand: vi.fn(),
};

describe('TestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Detection ──

  it('shows detecting state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<TestPanel {...defaultProps} />);
    expect(screen.getByText('Detecting test framework...')).toBeDefined();
  });

  it('shows detected framework with config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest')).toBeDefined();
    });
  });

  it('shows "No test framework detected" when nothing found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No test framework detected')).toBeDefined();
    });
  });

  it('shows Create Config for node ecosystem when no framework detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });
  });

  // ── Config exists — actions ──

  it('renders action buttons when config exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeDefined();
      expect(screen.getByText('Coverage')).toBeDefined();
      expect(screen.getByText('Watch')).toBeDefined();
      expect(screen.getByText('Edit Config')).toBeDefined();
    });
  });

  it('calls onRunCommand with test command when Run Tests clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Run Tests').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npm test');
  });

  it('calls onRunCommand with coverage command when Coverage clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Coverage')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Coverage').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npx vitest run --coverage');
  });

  it('calls onRunCommand with watch command when Watch clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Watch')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Watch').closest('button')!);
    expect(defaultProps.onRunCommand).toHaveBeenCalledWith('npx vitest --watch');
  });

  it('calls onOpenEditor when Edit Config clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Edit Config').closest('button')!);
    expect(defaultProps.onOpenEditor).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTitle('Close')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows framework detected without config — shows Create Config and Run Tests', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: null,
          hasConfig: false,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });
  });

  it('does not show Coverage button when coverageCommand is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'mocha',
          configPath: '/test/project/.mocharc.yml',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: 'npx mocha --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeDefined();
    });
    expect(screen.queryByText('Coverage')).toBeNull();
  });

  it('does not show Watch button when watchCommand is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'pytest',
          configPath: '/test/project/pytest.ini',
          hasConfig: true,
          coverageCommand: 'pytest --cov',
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeDefined();
    });
    expect(screen.queryByText('Watch')).toBeNull();
  });

  it('handles detection error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Detection failed'));

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No test framework detected')).toBeDefined();
    });
  });

  // ── Branch coverage: handleRunTests with null testCommand ──

  it('does not call onRunCommand when Run Tests clicked with null testCommand', async () => {
    const onRunCommand = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} testCommand={null} onRunCommand={onRunCommand} />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeDefined();
    });

    const btn = screen.getByText('Run Tests').closest('button')!;
    expect(btn.disabled).toBe(true);
    await userEvent.click(btn);
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  // ── Branch coverage: handleCreateConfig success path ──

  it('creates config successfully and re-detects framework', async () => {
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework') {
        detectCount++;
        if (detectCount === 1) {
          return Promise.resolve({
            framework: null,
            configPath: null,
            hasConfig: false,
            coverageCommand: null,
            watchCommand: null,
          });
        }
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      }
      if (channel === 'dev-tools:get-test-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-test-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Vitest')).toBeDefined();
    });
  });

  it('shows failure message when config creation throws', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework') {
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      }
      if (channel === 'dev-tools:get-test-presets') {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeDefined();
    });
  });

  it('shows message when write-test-config returns success false', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework') {
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      }
      if (channel === 'dev-tools:get-test-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-test-config') {
        return Promise.resolve({ success: false, message: 'Already exists' });
      }
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Already exists')).toBeDefined();
    });
  });

  // ── Branch coverage: handleCreateConfig "No framework to configure" ──

  it('does not show Create Config for non-node ecosystem when no framework detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} ecosystem="python" />);
    await waitFor(() => {
      expect(screen.getByText('No test framework detected')).toBeDefined();
    });
    expect(screen.queryByText('Create Config')).toBeNull();
  });

  // ── Branch coverage: Create Config from action buttons view ──

  it('invokes handleCreateConfig from action buttons when framework detected but no config', async () => {
    let detectCount = 0;
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework') {
        detectCount++;
        if (detectCount === 1) {
          return Promise.resolve({
            framework: 'vitest',
            configPath: null,
            hasConfig: false,
            coverageCommand: 'npx vitest run --coverage',
            watchCommand: 'npx vitest --watch',
          });
        }
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      }
      if (channel === 'dev-tools:get-test-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-test-config') {
        return Promise.resolve({ success: true, message: 'Config created' });
      }
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Edit Config')).toBeDefined();
    });
  });

  // ── Branch coverage: frameworkLabel fallback ──

  it('falls back to raw framework name when not in FRAMEWORK_LABELS', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'custom-framework',
          configPath: '/test/project/custom.config.ts',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('custom-framework')).toBeDefined();
    });
  });

  it('shows "Test Framework" heading when frameworkLabel is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: null,
          configPath: null,
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Test Framework')).toBeDefined();
    });
  });

  // ── Branch coverage: onClose from framework-detected view ──

  it('calls onClose from the framework-detected view close button', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: 'npx vitest run --coverage',
          watchCommand: 'npx vitest --watch',
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Branch coverage: handleRunCoverage with null coverageCommand ──

  it('does not show Coverage button and does nothing when coverageCommand is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'jest',
          configPath: '/test/project/jest.config.js',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Jest')).toBeDefined();
    });
    expect(screen.queryByText('Coverage')).toBeNull();
    expect(screen.queryByText('Watch')).toBeNull();
  });

  // ── Branch coverage: handleRunWatch with null watchCommand ──

  it('does not show Watch button when watchCommand is null but coverage exists', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'jest',
          configPath: '/test/project/jest.config.js',
          hasConfig: true,
          coverageCommand: 'jest --coverage',
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Coverage')).toBeDefined();
    });
    expect(screen.queryByText('Watch')).toBeNull();
  });

  // ── Branch coverage: status display in action buttons view ──

  it('displays status text in the action buttons view after failed create config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework') {
        return Promise.resolve({
          framework: 'vitest',
          configPath: null,
          hasConfig: false,
          coverageCommand: null,
          watchCommand: null,
        });
      }
      if (channel === 'dev-tools:get-test-presets') {
        return Promise.resolve({ template: 'default' });
      }
      if (channel === 'dev-tools:write-test-config') {
        return Promise.resolve({ success: false, message: 'Permission denied' });
      }
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vitest')).toBeDefined();
      expect(screen.getByText('Create Config')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Create Config').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined();
    });
  });

  // ── Branch coverage: disables Run Tests when testCommand is null ──

  it('disables Run Tests button when testCommand is null', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-test-framework')
        return Promise.resolve({
          framework: 'vitest',
          configPath: '/test/project/vitest.config.ts',
          hasConfig: true,
          coverageCommand: null,
          watchCommand: null,
        });
      return Promise.resolve(null);
    });

    render(<TestPanel {...defaultProps} testCommand={null} />);
    await waitFor(() => {
      expect(screen.getByText('Run Tests')).toBeDefined();
    });

    const btn = screen.getByText('Run Tests').closest('button');
    expect(btn?.disabled).toBe(true);
  });
});
