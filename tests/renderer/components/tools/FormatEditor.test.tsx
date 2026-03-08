import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { FormatEditor } from '../../../../src/renderer/components/tools/FormatEditor';
import type { PrettierConfig } from '../../../../src/main/ipc/channels/types';

const prettierConfig: PrettierConfig = {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  trailingComma: 'es5',
  arrowParens: 'always',
  endOfLine: 'lf',
  useTabs: false,
};

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('FormatEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<FormatEditor {...defaultProps} />);
    expect(screen.getByText('Loading formatter config...')).toBeDefined();
  });

  it('shows "no config found" when no formatter detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No formatter config found/)).toBeDefined();
    });
  });

  it('renders Prettier GUI with property controls when prettier detected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: prettierConfig,
          configPath: '/test/project/.prettierrc.json',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    // Check Prettier property controls exist
    expect(screen.getByTestId('prettier-semi')).toBeDefined();
    expect(screen.getByTestId('prettier-singleQuote')).toBeDefined();
    expect(screen.getByTestId('prettier-printWidth')).toBeDefined();
    expect(screen.getByTestId('prettier-tabWidth')).toBeDefined();
    expect(screen.getByTestId('prettier-trailingComma')).toBeDefined();
    expect(screen.getByTestId('prettier-arrowParens')).toBeDefined();
    expect(screen.getByTestId('prettier-endOfLine')).toBeDefined();
  });

  it('renders generic textarea for ruff config', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'ruff',
          configPath: '/test/project/ruff.toml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'ruff',
          config: { 'line-length': 88, 'indent-width': 4 },
          configPath: '/test/project/ruff.toml',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Ruff Config')).toBeDefined();
    });

    // Generic mode should have a textarea
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeDefined();
    expect(textarea?.value).toContain('line-length');
  });

  it('save button is disabled when config is clean', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: prettierConfig,
          configPath: '/test/project/.prettierrc.json',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(true);
  });

  it('save button enables after changing a Prettier property', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: prettierConfig,
          configPath: '/test/project/.prettierrc.json',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    // Change the semi toggle
    const semiSelect = screen.getByTestId('prettier-semi');
    await userEvent.selectOptions(semiSelect, 'false');

    const saveButton = screen.getByText('Save').closest('button')!;
    expect(saveButton.disabled).toBe(false);
  });

  it('calls write-format-config on save', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/project/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved .prettierrc.json' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    // Modify a property to enable save
    const semiSelect = screen.getByTestId('prettier-semi');
    await userEvent.selectOptions(semiSelect, 'false');

    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-config',
        '/test/project',
        'prettier',
        expect.objectContaining({ semi: false })
      );
    });
  });

  it('shows save status message after saving', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/project/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved .prettierrc.json' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    const semiSelect = screen.getByTestId('prettier-semi');
    await userEvent.selectOptions(semiSelect, 'false');
    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Saved .prettierrc.json')).toBeDefined();
    });
  });

  it('shows unsaved changes prompt when closing with dirty state', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/project/.prettierrc.json',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    // Make dirty
    const semiSelect = screen.getByTestId('prettier-semi');
    await userEvent.selectOptions(semiSelect, 'false');

    // Click close
    await userEvent.click(screen.getByTitle('Close editor'));

    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
    expect(screen.getByText('Save and close')).toBeDefined();
    expect(screen.getByText('Close without saving')).toBeDefined();
  });

  it('calls onClose directly when config is clean', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: prettierConfig,
          configPath: '/test/project/.prettierrc.json',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close editor'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes without saving when choosing Close without saving', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/project/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/project/.prettierrc.json',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    // Make dirty
    const semiSelect = screen.getByTestId('prettier-semi');
    await userEvent.selectOptions(semiSelect, 'false');

    // Trigger close prompt
    await userEvent.click(screen.getByTitle('Close editor'));
    expect(screen.getByText('You have unsaved changes.')).toBeDefined();

    // Choose "Close without saving"
    await userEvent.click(screen.getByText('Close without saving'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ============================================
  // Generic mode with _raw text
  // ============================================
  it('loads generic mode with _raw text for non-prettier formatter', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'ruff',
          configPath: '/test/ruff.toml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'ruff',
          config: { _raw: 'line-length = 88\nindent-width = 4' },
          configPath: '/test/ruff.toml',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Ruff Config')).toBeDefined();
    });
    const textarea = document.querySelector('textarea')!;
    expect(textarea.value).toBe('line-length = 88\nindent-width = 4');
  });

  it('converts config object to key=value lines when no _raw for non-prettier', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'black',
          configPath: '/test/pyproject.toml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'black',
          config: { 'line-length': 88, 'target-version': 'py39' },
          configPath: '/test/pyproject.toml',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Black Config')).toBeDefined();
    });
    const textarea = document.querySelector('textarea')!;
    expect(textarea.value).toContain('line-length = 88');
    expect(textarea.value).toContain('target-version = "py39"');
  });

  it('shows "Failed to save" on save error', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.reject(new Error('Write failed'));
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    await userEvent.selectOptions(screen.getByTestId('prettier-semi'), 'false');
    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });

  it('saves and closes when "Save and close" clicked in prompt', async () => {
    const onClose = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Prettier Config')).toBeDefined();
    });

    await userEvent.selectOptions(screen.getByTestId('prettier-semi'), 'false');
    await userEvent.click(screen.getByTitle('Close editor'));
    expect(screen.getByText('You have unsaved changes.')).toBeDefined();

    await userEvent.click(screen.getByText('Save and close'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-config',
        '/test/project',
        'prettier',
        expect.any(Object)
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('updates printWidth when number input changed', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    const user = userEvent.setup();
    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('prettier-printWidth')).toBeDefined();
    });

    const printWidthInput = screen.getByTestId('prettier-printWidth') as HTMLInputElement;
    await user.clear(printWidthInput);
    await user.type(printWidthInput, '120');

    expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
  });

  it('changes trailingComma select and saves', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('prettier-trailingComma')).toBeDefined();
    });

    await userEvent.selectOptions(screen.getByTestId('prettier-trailingComma'), 'all');
    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-config',
        '/test/project',
        'prettier',
        expect.objectContaining({ trailingComma: 'all' })
      );
    });
  });

  it('clears Prettier toggle to undefined when dash selected', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('prettier-semi')).toBeDefined();
    });

    await userEvent.selectOptions(screen.getByTestId('prettier-semi'), '');
    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-format-config'
      );
      expect(writeCall).toBeDefined();
      expect((writeCall![3] as Record<string, unknown>).semi).toBeUndefined();
    });
  });

  it('calls onClose from the no-config view close button', async () => {
    const onClose = vi.fn();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({ formatter: null, configPath: null, hasConfig: false });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/No formatter config found/)).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows TOML hint for ruff formatter', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'ruff',
          configPath: '/test/ruff.toml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'ruff',
          config: { _raw: '' },
          configPath: '/test/ruff.toml',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('TOML format: key = value')).toBeDefined();
    });
  });

  it('shows YAML hint for rubocop formatter', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'rubocop',
          configPath: '/test/.rubocop.yml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'rubocop',
          config: { _raw: '' },
          configPath: '/test/.rubocop.yml',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/YAML format/)).toBeDefined();
    });
  });

  it('saves ruff config by parsing TOML text', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'ruff',
          configPath: '/test/ruff.toml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'ruff',
          config: { _raw: 'line-length = 88' },
          configPath: '/test/ruff.toml',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved ruff.toml' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Ruff Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(textarea, 'line-length = 100\nindent-width = 4\nfix = true');

    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-config',
        '/test/project',
        'ruff',
        expect.objectContaining({ 'line-length': 100, 'indent-width': 4, fix: true })
      );
    });
  });

  it('saves rubocop config using _raw wrapper', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'rubocop',
          configPath: '/test/.rubocop.yml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'rubocop',
          config: { _raw: 'AllCops:\n  Enabled: true' },
          configPath: '/test/.rubocop.yml',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(textarea, 'AllCops:\n  Enabled: false');

    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-config',
        '/test/project',
        'rubocop',
        expect.objectContaining({ _raw: expect.any(String) })
      );
    });
  });

  it('handles load error gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No formatter config found/)).toBeDefined();
    });
  });

  it('shows "Format Config" as title for unknown formatter', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'unknown-tool',
          configPath: '/test/.config',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'unknown-tool',
          config: { _raw: 'content' },
          configPath: '/test/.config',
        });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Format Config')).toBeDefined();
    });
  });

  it('changes quoteProps and proseWrap selects', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('prettier-quoteProps')).toBeDefined();
    });

    await userEvent.selectOptions(screen.getByTestId('prettier-quoteProps'), 'consistent');
    await userEvent.selectOptions(screen.getByTestId('prettier-proseWrap'), 'always');

    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-config',
        '/test/project',
        'prettier',
        expect.objectContaining({ quoteProps: 'consistent', proseWrap: 'always' })
      );
    });
  });

  it('clears trailingComma to undefined when clearing select', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('prettier-trailingComma')).toBeDefined();
    });

    await userEvent.selectOptions(screen.getByTestId('prettier-trailingComma'), '');
    await userEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-format-config'
      );
      expect(writeCall).toBeDefined();
      expect((writeCall![3] as Record<string, unknown>).trailingComma).toBeUndefined();
    });
  });

  it('clears printWidth to undefined when number input emptied', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'prettier',
          configPath: '/test/.prettierrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'prettier',
          config: { ...prettierConfig },
          configPath: '/test/.prettierrc.json',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    const user = userEvent.setup();
    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('prettier-printWidth')).toBeDefined();
    });

    await user.clear(screen.getByTestId('prettier-printWidth'));
    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      const writeCall = mockInvoke.mock.calls.find(
        (c: unknown[]) => c[0] === 'dev-tools:write-format-config'
      );
      expect(writeCall).toBeDefined();
      expect((writeCall![3] as Record<string, unknown>).printWidth).toBeUndefined();
    });
  });

  it('saves rustfmt config by parsing TOML text', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-formatter')
        return Promise.resolve({
          formatter: 'rustfmt',
          configPath: '/test/rustfmt.toml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-format-config')
        return Promise.resolve({
          formatter: 'rustfmt',
          config: { _raw: 'max_width = 100' },
          configPath: '/test/rustfmt.toml',
        });
      if (channel === 'dev-tools:write-format-config')
        return Promise.resolve({ success: true, message: 'Saved' });
      return Promise.resolve(null);
    });

    render(<FormatEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('rustfmt Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(
      textarea,
      '# comment\n[section]\nmax_width = 120\nuse_small_heuristics = "Max"\nhard_tabs = false'
    );

    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-format-config',
        '/test/project',
        'rustfmt',
        expect.objectContaining({ max_width: 120, use_small_heuristics: 'Max', hard_tabs: false })
      );
    });
  });
});
