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
});
