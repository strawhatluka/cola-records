import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { BuildEditor } from '../../../../src/renderer/components/tools/BuildEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('BuildEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<BuildEditor {...defaultProps} />);
    expect(screen.getByText('Loading build config...')).toBeDefined();
  });

  it('shows no-config message when no build tool detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: null,
          configPath: null,
          hasConfig: false,
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText('No build config found. Create one from the Build panel first.')
      ).toBeDefined();
    });
  });

  it('renders rich GUI when vite JSON config found', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: {
            outDir: 'dist',
            target: 'es2020',
            sourcemap: false,
            minify: 'esbuild',
            cssMinify: true,
            manifest: false,
            emptyOutDir: true,
            assetsInlineLimit: 4096,
            chunkSizeWarningLimit: 500,
          },
          configPath: '/test/project/vite.config.json',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite Build Config')).toBeDefined();
    });

    expect(screen.getByTestId('build-outDir')).toBeDefined();
    expect(screen.getByTestId('build-target')).toBeDefined();
    expect(screen.getByTestId('build-sourcemap')).toBeDefined();
    expect(screen.getByTestId('build-minify')).toBeDefined();
    expect(screen.getByTestId('build-cssMinify')).toBeDefined();
    expect(screen.getByTestId('build-manifest')).toBeDefined();
    expect(screen.getByTestId('build-emptyOutDir')).toBeDefined();
    expect(screen.getByTestId('build-assetsInlineLimit')).toBeDefined();
    expect(screen.getByTestId('build-chunkSizeWarningLimit')).toBeDefined();
  });

  it('renders generic textarea for TS config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.ts',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { _raw: 'export default defineConfig({ build: {} })' },
          configPath: '/test/project/vite.config.ts',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite Build Config')).toBeDefined();
    });
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
  });

  it('Save button is disabled when no changes made', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist', minify: 'esbuild' },
          configPath: '/test/project/vite.config.json',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite Build Config')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(true);
  });

  it('Save button is enabled after changes', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist', cssMinify: false },
          configPath: '/test/project/vite.config.json',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-cssMinify')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-cssMinify'), 'true');

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(false);
  });

  it('calls write-build-config on save', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist', cssMinify: false },
          configPath: '/test/project/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved build config' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-cssMinify')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-cssMinify'), 'true');

    const saveButton = screen.getByText('Save').closest('button')!;
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'vite',
        expect.objectContaining({ cssMinify: true })
      );
    });
  });

  it('shows unsaved changes prompt when closing with dirty config', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist', cssMinify: false },
          configPath: '/test/project/vite.config.json',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-cssMinify')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-cssMinify'), 'true');
    await user.click(screen.getByTitle('Close editor'));

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
  });

  it('calls onClose directly when closing with no changes', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist' },
          configPath: '/test/project/vite.config.json',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite Build Config')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close editor'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes without saving when "Close without saving" clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/project/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist', cssMinify: false },
          configPath: '/test/project/vite.config.json',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-cssMinify')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-cssMinify'), 'true');
    await user.click(screen.getByTitle('Close editor'));
    await user.click(screen.getByText('Close without saving'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders generic textarea for non-vite build tool', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'webpack',
          configPath: '/test/project/webpack.config.js',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'webpack',
          config: { _raw: 'module.exports = {}' },
          configPath: '/test/project/webpack.config.js',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('webpack Build Config')).toBeDefined();
    });
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
  });
});
