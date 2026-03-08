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

  // ============================================
  // Sourcemap select — all branches
  // ============================================
  it('changes sourcemap to inline', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { sourcemap: false },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-sourcemap')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-sourcemap'), 'inline');
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'vite',
        expect.objectContaining({ sourcemap: 'inline' })
      );
    });
  });

  it('changes sourcemap to true', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { sourcemap: false },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-sourcemap')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-sourcemap'), 'true');
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'vite',
        expect.objectContaining({ sourcemap: true })
      );
    });
  });

  it('clears sourcemap to undefined', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { sourcemap: true },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-sourcemap')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-sourcemap'), '');
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-build-config'
      );
      expect(writeCall).toBeDefined();
      expect((writeCall![3] as Record<string, unknown>).sourcemap).toBeUndefined();
    });
  });

  it('changes minify to terser', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { minify: false },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-minify')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-minify'), 'terser');
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'vite',
        expect.objectContaining({ minify: 'terser' })
      );
    });
  });

  it('changes minify to true', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { minify: false },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-minify')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-minify'), 'true');
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'vite',
        expect.objectContaining({ minify: true })
      );
    });
  });

  it('clears minify to undefined', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { minify: 'esbuild' },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-minify')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-minify'), '');
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-build-config'
      );
      expect(writeCall).toBeDefined();
      expect((writeCall![3] as Record<string, unknown>).minify).toBeUndefined();
    });
  });

  it('clears assetsInlineLimit to undefined when input emptied', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { assetsInlineLimit: 4096 },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-assetsInlineLimit')).toBeDefined();
    });

    await user.clear(screen.getByTestId('build-assetsInlineLimit'));
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-build-config'
      );
      expect(writeCall).toBeDefined();
      expect((writeCall![3] as Record<string, unknown>).assetsInlineLimit).toBeUndefined();
    });
  });

  it('clears manifest toggle to undefined', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { manifest: true },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-manifest')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('build-manifest'), '');
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-build-config'
      );
      expect(writeCall).toBeDefined();
      expect((writeCall![3] as Record<string, unknown>).manifest).toBeUndefined();
    });
  });

  it('changes outDir text input', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist' },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-outDir')).toBeDefined();
    });

    await user.clear(screen.getByTestId('build-outDir'));
    await user.type(screen.getByTestId('build-outDir'), 'build');

    await user.click(screen.getByText('Save').closest('button')!);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'vite',
        expect.objectContaining({ outDir: 'build' })
      );
    });
  });

  it('saves generic mode config with _raw', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'webpack',
          configPath: '/test/webpack.config.js',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'webpack',
          config: { _raw: 'module.exports = {}' },
          configPath: '/test/webpack.config.js',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('webpack Build Config')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'updated config content');

    await user.click(screen.getByText('Save').closest('button')!);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'webpack',
        expect.objectContaining({ _raw: expect.any(String) })
      );
    });
  });

  it('shows "Failed to save" on save error', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist' },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.reject(new Error('Write failed'));
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-outDir')).toBeDefined();
    });

    await user.clear(screen.getByTestId('build-outDir'));
    await user.type(screen.getByTestId('build-outDir'), 'build');

    await user.click(screen.getByText('Save').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });

  it('saves and closes when "Save and close" clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist' },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-outDir')).toBeDefined();
    });

    await user.clear(screen.getByTestId('build-outDir'));
    await user.type(screen.getByTestId('build-outDir'), 'build');

    await user.click(screen.getByTitle('Close editor'));
    expect(screen.getByText('You have unsaved changes.')).toBeDefined();

    await user.click(screen.getByText('Save and close'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-build-config',
        '/test/project',
        'vite',
        expect.any(Object)
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows save status message after save', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { outDir: 'dist' },
          configPath: '/test/vite.config.json',
        });
      if (channel === 'dev-tools:write-build-config')
        return Promise.resolve({ success: true, message: 'Saved vite config' });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('build-outDir')).toBeDefined();
    });

    await user.clear(screen.getByTestId('build-outDir'));
    await user.type(screen.getByTestId('build-outDir'), 'build');

    await user.click(screen.getByText('Save').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Saved vite config')).toBeDefined();
    });
  });

  it('handles load error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No build config found/)).toBeDefined();
    });
  });

  it('calls onClose from no-config close button', async () => {
    const onClose = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({ buildTool: null, configPath: null, hasConfig: false });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Build Editor')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Cargo.toml hint for cargo-build', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'cargo-build',
          configPath: '/test/Cargo.toml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'cargo-build',
          config: { _raw: '' },
          configPath: '/test/Cargo.toml',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cargo.toml')).toBeDefined();
    });
  });

  it('shows Gradle hint for gradle build tool', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'gradle',
          configPath: '/test/build.gradle',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'gradle',
          config: { _raw: '' },
          configPath: '/test/build.gradle',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Gradle build script')).toBeDefined();
    });
  });

  it('handles non-vite config without _raw property', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'webpack',
          configPath: '/test/webpack.config.js',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'webpack',
          config: { entry: './src/index.js' },
          configPath: '/test/webpack.config.js',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('webpack Build Config')).toBeDefined();
    });
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeDefined();
    expect(textarea?.value).toBe('');
  });

  it('renders vite in generic mode when config has _raw', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-build-tool')
        return Promise.resolve({
          buildTool: 'vite',
          configPath: '/test/vite.config.ts',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-build-config')
        return Promise.resolve({
          buildTool: 'vite',
          config: { _raw: 'export default {}' },
          configPath: '/test/vite.config.ts',
        });
      return Promise.resolve(null);
    });

    render(<BuildEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Vite Build Config')).toBeDefined();
    });
    expect(screen.getByText('JavaScript/TypeScript config file')).toBeDefined();
  });
});
