import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { LintEditor } from '../../../../src/renderer/components/tools/LintEditor';

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  onClose: vi.fn(),
};

describe('LintEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<LintEditor {...defaultProps} />);
    expect(screen.getByText('Loading lint config...')).toBeDefined();
  });

  it('shows no config message when no linter detected', async () => {
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText('No lint config found. Create one from the Lint panel first.')
      ).toBeDefined();
    });
  });

  it('shows rich ESLint editor for JSON config', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: {
          env: { browser: true, node: true },
          extends: ['eslint:recommended'],
          rules: { 'no-console': 'warn' },
        },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint Config')).toBeDefined();
    });

    expect(screen.getByText('Environments')).toBeDefined();
    expect(screen.getByText('Extends')).toBeDefined();
    expect(screen.getByText('Rules')).toBeDefined();
  });

  it('shows generic textarea for JS/TS ESLint config', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/eslint.config.js',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { _raw: 'export default []' },
        configPath: '/test/eslint.config.js',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint Config')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDefined();
    expect((textarea as HTMLTextAreaElement).value).toBe('export default []');
  });

  it('shows generic textarea for non-eslint linters', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'rubocop',
        configPath: '/test/.rubocop.yml',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'rubocop',
        config: { _raw: 'AllCops:\n  TargetRubyVersion: 3.0' },
        configPath: '/test/.rubocop.yml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).value).toBe('AllCops:\n  TargetRubyVersion: 3.0');
  });

  it('Save button is disabled when no changes made', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { env: { browser: true }, extends: ['eslint:recommended'] },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('ESLint Config')).toBeDefined();
    });

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton?.disabled).toBe(true);
  });

  it('calls onClose when close button clicked with no changes', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      linter: null,
      configPath: null,
      hasConfig: false,
    });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Lint Editor')).toBeDefined();
    });

    await user.click(screen.getByTitle('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows unsaved changes prompt when closing with dirty state', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'rubocop',
        configPath: '/test/.rubocop.yml',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'rubocop',
        config: { _raw: 'original content' },
        configPath: '/test/.rubocop.yml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(textarea, 'modified content');

    await user.click(screen.getByTitle('Close editor'));
    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
  });

  it('saves and closes when Save and close is clicked in prompt', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'rubocop',
        configPath: '/test/.rubocop.yml',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'rubocop',
        config: { _raw: 'original content' },
        configPath: '/test/.rubocop.yml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(textarea, 'modified content');

    await user.click(screen.getByTitle('Close editor'));

    mockInvoke.mockResolvedValueOnce({ success: true, message: 'Saved' });
    await user.click(screen.getByText('Save and close'));
    expect(mockInvoke).toHaveBeenCalledWith(
      'dev-tools:write-lint-config',
      '/test/project',
      'rubocop',
      expect.objectContaining({ _raw: 'modified content' })
    );
  });

  // ============================================
  // ESLint rich mode — toggle environment
  // ============================================
  it('toggles environment checkboxes in ESLint rich mode', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter')
        return Promise.resolve({
          linter: 'eslint',
          configPath: '/test/.eslintrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-lint-config')
        return Promise.resolve({
          linter: 'eslint',
          config: { env: { browser: true } },
          configPath: '/test/.eslintrc.json',
        });
      return Promise.resolve(null);
    });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Environments')).toBeDefined();
    });

    const browserCb = screen.getByTestId('lint-env-browser') as HTMLInputElement;
    expect(browserCb.checked).toBe(true);

    const nodeCb = screen.getByTestId('lint-env-node') as HTMLInputElement;
    expect(nodeCb.checked).toBe(false);

    // Use fireEvent.click for checkbox — more reliable in JSDOM
    fireEvent.click(nodeCb);

    await waitFor(() => {
      expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
    });
  });

  it('adds and removes extends items', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { extends: ['eslint:recommended'] },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('eslint:recommended')).toBeDefined();
    });

    const extendsInput = screen.getByTestId('lint-extends');
    await user.type(extendsInput, 'plugin:react/recommended');
    await user.keyboard('{Enter}');

    expect(screen.getByText('plugin:react/recommended')).toBeDefined();

    const removeBtn = screen.getByTitle('Remove eslint:recommended');
    await user.click(removeBtn);

    expect(screen.queryByText('eslint:recommended')).toBeNull();
  });

  it('adds plugins via input', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { plugins: [] },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Plugins')).toBeDefined();
    });

    await user.type(screen.getByTestId('lint-plugins'), '@typescript-eslint');
    await user.keyboard('{Enter}');

    expect(screen.getByText('@typescript-eslint')).toBeDefined();
  });

  it('sets and clears parser input', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { parser: '@typescript-eslint/parser' },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('lint-parser')).toBeDefined();
    });

    const parserInput = screen.getByTestId('lint-parser') as HTMLInputElement;
    expect(parserInput.value).toBe('@typescript-eslint/parser');

    await user.clear(parserInput);
    expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
  });

  it('adds ignorePatterns', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({ linter: 'eslint', config: {}, configPath: '/test/.eslintrc.json' });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Ignore Patterns')).toBeDefined();
    });

    await user.type(screen.getByTestId('lint-ignorePatterns'), 'dist/**');
    await user.keyboard('{Enter}');

    expect(screen.getByText('dist/**')).toBeDefined();
  });

  it('adds a new rule with default severity "warn"', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { rules: {} },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Rules')).toBeDefined();
    });

    await user.type(screen.getByTestId('lint-add-rule'), 'no-unused-vars');
    await user.keyboard('{Enter}');

    expect(screen.getByText('no-unused-vars')).toBeDefined();
    const ruleSelect = screen.getByTestId('lint-rule-no-unused-vars') as HTMLSelectElement;
    expect(ruleSelect.value).toBe('warn');
  });

  it('changes rule severity from warn to error', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { rules: { 'no-console': 'warn' } },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('lint-rule-no-console')).toBeDefined();
    });

    await user.selectOptions(screen.getByTestId('lint-rule-no-console'), 'error');
    expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
  });

  it('removes a rule via trash button', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { rules: { 'no-console': 'warn' } },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('no-console')).toBeDefined();
    });

    await user.click(screen.getByTitle('Remove no-console'));
    expect(screen.queryByText('no-console')).toBeNull();
  });

  it('displays numeric rule value as off/warn/error', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { rules: { 'no-var': 2 } },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('no-var')).toBeDefined();
    });

    const ruleSelect = screen.getByTestId('lint-rule-no-var') as HTMLSelectElement;
    expect(ruleSelect.value).toBe('error');
  });

  it('saves ESLint config via rich mode', async () => {
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter')
        return Promise.resolve({
          linter: 'eslint',
          configPath: '/test/.eslintrc.json',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-lint-config')
        return Promise.resolve({
          linter: 'eslint',
          config: { env: { browser: true } },
          configPath: '/test/.eslintrc.json',
        });
      if (channel === 'dev-tools:write-lint-config')
        return Promise.resolve({ success: true, message: 'Saved .eslintrc.json' });
      return Promise.resolve(null);
    });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Environments')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('lint-env-node'));

    await waitFor(() => {
      expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
    });

    fireEvent.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-tools:write-lint-config',
        '/test/project',
        'eslint',
        expect.objectContaining({ env: { browser: true, node: true } })
      );
    });
  });

  it('shows "Failed to save" on save error', async () => {
    const user = userEvent.setup();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:detect-linter')
        return Promise.resolve({
          linter: 'rubocop',
          configPath: '/test/.rubocop.yml',
          hasConfig: true,
        });
      if (channel === 'dev-tools:read-lint-config')
        return Promise.resolve({
          linter: 'rubocop',
          config: { _raw: 'original' },
          configPath: '/test/.rubocop.yml',
        });
      if (channel === 'dev-tools:write-lint-config')
        return Promise.reject(new Error('Write error'));
      return Promise.resolve(null);
    });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('RuboCop Config')).toBeDefined();
    });

    const textarea = document.querySelector('textarea')!;
    await user.clear(textarea);
    await user.type(textarea, 'modified');

    await user.click(screen.getByText('Save').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });

  it('handles load error gracefully', async () => {
    mockInvoke.mockImplementation(() => Promise.reject(new Error('Network error')));

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/No lint config found/)).toBeDefined();
    });
  });

  it('calls onClose from no-config close button', async () => {
    const onClose = vi.fn();
    mockInvoke.mockResolvedValue({ linter: null, configPath: null, hasConfig: false });

    render(<LintEditor {...defaultProps} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Lint Editor')).toBeDefined();
    });

    await userEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows linter name as-is for unknown linter', async () => {
    mockInvoke
      .mockResolvedValueOnce({ linter: 'pylint', configPath: '/test/.pylintrc', hasConfig: true })
      .mockResolvedValueOnce({
        linter: 'pylint',
        config: { _raw: 'content' },
        configPath: '/test/.pylintrc',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('pylint Config')).toBeDefined();
    });
  });

  it('shows TOML hint for ruff', async () => {
    mockInvoke
      .mockResolvedValueOnce({ linter: 'ruff', configPath: '/test/ruff.toml', hasConfig: true })
      .mockResolvedValueOnce({
        linter: 'ruff',
        config: { _raw: '' },
        configPath: '/test/ruff.toml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('TOML config file')).toBeDefined();
    });
  });

  it('shows YAML hint for golangci-lint', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'golangci-lint',
        configPath: '/test/.golangci.yml',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'golangci-lint',
        config: { _raw: '' },
        configPath: '/test/.golangci.yml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('YAML config file')).toBeDefined();
    });
  });

  it('handles non-eslint config without _raw property', async () => {
    mockInvoke
      .mockResolvedValueOnce({ linter: 'ruff', configPath: '/test/ruff.toml', hasConfig: true })
      .mockResolvedValueOnce({
        linter: 'ruff',
        config: { 'line-length': 88 },
        configPath: '/test/ruff.toml',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Ruff Config')).toBeDefined();
    });
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeDefined();
    expect(textarea?.value).toBe('');
  });

  it('does not add duplicate extends item', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { extends: ['eslint:recommended'] },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('eslint:recommended')).toBeDefined();
    });

    await user.type(screen.getByTestId('lint-extends'), 'eslint:recommended');
    await user.keyboard('{Enter}');

    const items = screen.getAllByText('eslint:recommended');
    expect(items.length).toBe(1);
  });

  it('does not add duplicate rule name', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({
        linter: 'eslint',
        configPath: '/test/.eslintrc.json',
        hasConfig: true,
      })
      .mockResolvedValueOnce({
        linter: 'eslint',
        config: { rules: { 'no-console': 'warn' } },
        configPath: '/test/.eslintrc.json',
      });

    render(<LintEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('no-console')).toBeDefined();
    });

    await user.type(screen.getByTestId('lint-add-rule'), 'no-console');
    await user.keyboard('{Enter}');

    const items = screen.getAllByText('no-console');
    expect(items.length).toBe(1);
  });
});
