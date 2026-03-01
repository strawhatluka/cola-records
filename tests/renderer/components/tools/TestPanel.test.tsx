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
});
