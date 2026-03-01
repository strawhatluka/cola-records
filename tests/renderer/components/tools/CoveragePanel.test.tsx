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
});
