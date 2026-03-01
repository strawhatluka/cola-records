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
});
