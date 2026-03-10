import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock IPC client
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

import { PackageConfigEditor } from '../../../../src/renderer/components/tools/PackageConfigEditor';
import type { PackageConfigData } from '../../../../src/main/ipc/channels/types';

const mockNodeConfig: PackageConfigData = {
  ecosystem: 'node',
  fileName: 'package.json',
  structured: {
    name: 'test-package',
    version: '1.0.0',
    description: 'A test package',
    type: 'module',
    license: 'MIT',
    private: false,
    main: 'index.js',
    keywords: ['test', 'mock'],
    scripts: {
      build: 'tsc',
      test: 'vitest',
      lint: 'eslint src/',
    },
    dependencies: {
      express: '^4.18.0',
      lodash: '^4.17.21',
    },
    devDependencies: {
      typescript: '^5.0.0',
      vitest: '^1.0.0',
    },
    peerDependencies: {},
    optionalDependencies: {},
    engines: { node: '>=18' },
    files: ['dist'],
    workspaces: [],
    browserslist: ['> 1%'],
  },
  raw: '{\n  "name": "test-package"\n}',
  indent: 2,
};

const mockPythonConfig: PackageConfigData = {
  ecosystem: 'python',
  fileName: 'pyproject.toml',
  structured: null,
  raw: '[tool.poetry]\nname = "my-project"\nversion = "0.1.0"\n\n[tool.poetry.dependencies]\npython = "^3.9"',
  indent: 2,
};

const mockGoConfig: PackageConfigData = {
  ecosystem: 'go',
  fileName: 'go.mod',
  structured: null,
  raw: 'module example.com/my-module\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)',
  indent: 2,
};

const defaultProps = {
  workingDirectory: '/test/project',
  ecosystem: 'node' as const,
  packageManager: 'npm' as const,
  onClose: vi.fn(),
  onRunCommand: vi.fn(),
};

describe('PackageConfigEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockNodeConfig);
      if (channel === 'dev-tools:write-package-config')
        return Promise.resolve({ success: true, message: 'package.json saved' });
      if (channel === 'dev-tools:search-npm-registry') return Promise.resolve([]);
      return Promise.resolve(null);
    });
  });

  // ── Loading & initial state ──────────────────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner on mount', () => {
      mockInvoke.mockReturnValue(new Promise(() => {}));
      render(<PackageConfigEditor {...defaultProps} />);
      expect(screen.getByTestId('icon-loader2')).toBeDefined();
    });

    it('shows "No config file found" when config is null', async () => {
      mockInvoke.mockResolvedValue(null);
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No config file found')).toBeDefined();
      });
    });

    it('shows "Go back" button when no config', async () => {
      mockInvoke.mockResolvedValue(null);
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Go back')).toBeDefined();
      });
    });

    it('calls onClose when "Go back" clicked', async () => {
      const onClose = vi.fn();
      mockInvoke.mockResolvedValue(null);
      render(<PackageConfigEditor {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Go back')).toBeDefined();
      });

      await userEvent.click(screen.getByText('Go back'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Tier dispatch ────────────────────────────────────────────────────

  describe('tier dispatch', () => {
    it('renders 4-tab GUI for node (Tier 1)', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('General')).toBeDefined();
      });
      expect(screen.getByText('Scripts')).toBeDefined();
      expect(screen.getByText('Dependencies')).toBeDefined();
      expect(screen.getByText('Advanced')).toBeDefined();
    });

    it('renders 4-tab GUI for php (Tier 1)', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config')
          return Promise.resolve({
            ...mockNodeConfig,
            ecosystem: 'php',
            fileName: 'composer.json',
          });
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="php" />);

      await waitFor(() => {
        expect(screen.getByText('General')).toBeDefined();
      });
    });

    it('renders section-aware editor for python (Tier 2)', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockPythonConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="python" />);

      await waitFor(() => {
        expect(screen.getByText('pyproject.toml')).toBeDefined();
      });
      // Should have section nav
      expect(screen.getByText('Sections')).toBeDefined();
      expect(screen.getByText('[tool.poetry]')).toBeDefined();
      expect(screen.getByText('[tool.poetry.dependencies]')).toBeDefined();
    });

    it('renders section-aware editor for rust (Tier 2)', async () => {
      const rustConfig: PackageConfigData = {
        ecosystem: 'rust',
        fileName: 'Cargo.toml',
        structured: null,
        raw: '[package]\nname = "my-crate"\n\n[dependencies]\nserde = "1.0"',
        indent: 2,
      };
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(rustConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="rust" />);

      await waitFor(() => {
        expect(screen.getByText('Cargo.toml')).toBeDefined();
      });
      expect(screen.getByText('[package]')).toBeDefined();
      expect(screen.getByText('[dependencies]')).toBeDefined();
    });

    it('renders structured text editor for go (Tier 3)', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockGoConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="go" />);

      await waitFor(() => {
        expect(screen.getByText('go.mod')).toBeDefined();
      });
    });
  });

  // ── Header ───────────────────────────────────────────────────────────

  describe('header', () => {
    it('renders file name in header', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeDefined();
      });
    });

    it('renders Save button', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeDefined();
      });
    });

    it('renders close button', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTitle('Close')).toBeDefined();
      });
    });
  });

  // ── Tab switching ────────────────────────────────────────────────────

  describe('tab switching', () => {
    it('defaults to General tab', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        // General tab should show the name input
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });
    });

    it('switches to Scripts tab', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Scripts')).toBeDefined();
      });

      await userEvent.click(screen.getByText('Scripts'));

      await waitFor(() => {
        expect(screen.getByText('build')).toBeDefined();
        expect(screen.getByText('test')).toBeDefined();
        expect(screen.getByText('lint')).toBeDefined();
      });
    });

    it('switches to Dependencies tab', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dependencies')).toBeDefined();
      });

      await userEvent.click(screen.getByText('Dependencies'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search npm registry...')).toBeDefined();
      });
    });

    it('switches to Advanced tab', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeDefined();
      });

      await userEvent.click(screen.getByText('Advanced'));

      await waitFor(() => {
        expect(screen.getByText('engines')).toBeDefined();
      });
    });
  });

  // ── General tab ──────────────────────────────────────────────────────

  describe('General tab', () => {
    it('renders name input with current value', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('my-package') as HTMLInputElement;
        expect(nameInput.value).toBe('test-package');
      });
    });

    it('renders description textarea', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('description')).toBeDefined();
      });
    });

    it('renders type dropdown with module/commonjs', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('type')).toBeDefined();
      });
      const select = screen.getByDisplayValue('module') as HTMLSelectElement;
      expect(select).toBeDefined();
    });

    it('renders license dropdown', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('license')).toBeDefined();
      });
    });

    it('renders author fieldset', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('author')).toBeDefined();
      });
    });

    it('renders keywords with remove buttons', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('test')).toBeDefined();
        expect(screen.getByText('mock')).toBeDefined();
      });
    });

    it('renders private toggle', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('private')).toBeDefined();
      });
    });

    it('renders main and types inputs', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        const mainInput = screen.getByPlaceholderText('index.js') as HTMLInputElement;
        expect(mainInput.value).toBe('index.js');
      });
    });
  });

  // ── Scripts tab ──────────────────────────────────────────────────────

  describe('Scripts tab', () => {
    async function goToScripts() {
      render(<PackageConfigEditor {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Scripts')).toBeDefined();
      });
      await userEvent.click(screen.getByText('Scripts'));
    }

    it('renders script cards with name and command', async () => {
      await goToScripts();

      await waitFor(() => {
        expect(screen.getByText('build')).toBeDefined();
        expect(screen.getByText('tsc')).toBeDefined();
      });
    });

    it('renders Run button for each script', async () => {
      await goToScripts();

      await waitFor(() => {
        const playIcons = screen.getAllByTestId('icon-play');
        expect(playIcons.length).toBe(3); // build, test, lint
      });
    });

    it('renders Delete button for each script', async () => {
      await goToScripts();

      await waitFor(() => {
        const trashIcons = screen.getAllByTestId('icon-trash2');
        expect(trashIcons.length).toBe(3);
      });
    });

    it('calls onRunCommand when Run button clicked', async () => {
      const onRunCommand = vi.fn();
      render(<PackageConfigEditor {...defaultProps} onRunCommand={onRunCommand} />);
      await waitFor(() => {
        expect(screen.getByText('Scripts')).toBeDefined();
      });
      await userEvent.click(screen.getByText('Scripts'));

      await waitFor(() => {
        expect(screen.getByText('tsc')).toBeDefined();
      });

      // Click the first Run button (build → tsc)
      const playButtons = screen.getAllByTestId('icon-play');
      await userEvent.click(playButtons[0].closest('button')!);

      expect(onRunCommand).toHaveBeenCalledWith('tsc');
    });

    it('renders add script form', async () => {
      await goToScripts();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('build')).toBeDefined();
        expect(screen.getByPlaceholderText('tsc && node dist/index.js')).toBeDefined();
      });
    });

    it('shows "No scripts defined" when empty', async () => {
      const emptyScriptsConfig = {
        ...mockNodeConfig,
        structured: { ...mockNodeConfig.structured, scripts: undefined },
      };
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(emptyScriptsConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Scripts')).toBeDefined();
      });
      await userEvent.click(screen.getByText('Scripts'));

      await waitFor(() => {
        expect(screen.getByText('No scripts defined')).toBeDefined();
      });
    });
  });

  // ── Dependencies tab ─────────────────────────────────────────────────

  describe('Dependencies tab', () => {
    async function goToDeps() {
      render(<PackageConfigEditor {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Dependencies')).toBeDefined();
      });
      await userEvent.click(screen.getByText('Dependencies'));
    }

    it('renders npm search input', async () => {
      await goToDeps();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search npm registry...')).toBeDefined();
      });
    });

    it('renders 4 collapsible dependency sections', async () => {
      await goToDeps();

      // Section headers use font-semibold class; use selector to distinguish from <option> elements
      await waitFor(() => {
        expect(screen.getByText('dependencies', { selector: 'span' })).toBeDefined();
        expect(screen.getByText('devDependencies', { selector: 'span' })).toBeDefined();
        expect(screen.getByText('peerDependencies', { selector: 'span' })).toBeDefined();
        expect(screen.getByText('optionalDependencies', { selector: 'span' })).toBeDefined();
      });
    });

    it('renders dependency entries with version', async () => {
      await goToDeps();

      await waitFor(() => {
        expect(screen.getByText('express')).toBeDefined();
        expect(screen.getByText('^4.18.0')).toBeDefined();
        expect(screen.getByText('lodash')).toBeDefined();
      });
    });

    it('shows section counts', async () => {
      await goToDeps();

      // Both dependencies and devDependencies have 2 entries
      await waitFor(() => {
        const counts = screen.getAllByText('(2)');
        expect(counts.length).toBe(2);
      });
    });

    it('renders add dependency form', async () => {
      await goToDeps();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('package-name')).toBeDefined();
        expect(screen.getByPlaceholderText('^1.0.0')).toBeDefined();
      });
    });

    it('triggers npm search on input', async () => {
      const searchResults = [
        { name: 'axios', description: 'HTTP client', version: '1.6.0', date: '2023-01-01' },
      ];
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockNodeConfig);
        if (channel === 'dev-tools:search-npm-registry') return Promise.resolve(searchResults);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Dependencies')).toBeDefined();
      });
      await userEvent.click(screen.getByText('Dependencies'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search npm registry...')).toBeDefined();
      });

      // Type search query — the debounced search fires after 300ms
      const searchInput = screen.getByPlaceholderText('Search npm registry...');
      fireEvent.change(searchInput, { target: { value: 'axios' } });

      // Wait for debounce timer to fire naturally and IPC to be called
      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith('dev-tools:search-npm-registry', 'axios');
        },
        { timeout: 2000 }
      );
    });
  });

  // ── Advanced tab ─────────────────────────────────────────────────────

  describe('Advanced tab', () => {
    async function goToAdvanced() {
      render(<PackageConfigEditor {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeDefined();
      });
      await userEvent.click(screen.getByText('Advanced'));
    }

    it('renders engines fieldset', async () => {
      await goToAdvanced();

      await waitFor(() => {
        expect(screen.getByText('engines')).toBeDefined();
        expect(screen.getByText('node')).toBeDefined();
      });
    });

    it('renders files fieldset', async () => {
      await goToAdvanced();

      await waitFor(() => {
        expect(screen.getByText('files')).toBeDefined();
      });
    });

    it('renders workspaces fieldset', async () => {
      await goToAdvanced();

      await waitFor(() => {
        expect(screen.getByText('workspaces')).toBeDefined();
      });
    });

    it('renders browserslist fieldset', async () => {
      await goToAdvanced();

      await waitFor(() => {
        expect(screen.getByText('browserslist')).toBeDefined();
      });
    });

    it('renders sideEffects toggle', async () => {
      await goToAdvanced();

      await waitFor(() => {
        expect(screen.getByText('sideEffects')).toBeDefined();
      });
    });

    it('renders Raw JSON details', async () => {
      await goToAdvanced();

      await waitFor(() => {
        expect(screen.getByText('Raw JSON')).toBeDefined();
      });
    });
  });

  // ── Save flow ────────────────────────────────────────────────────────

  describe('save flow', () => {
    it('calls IPC write when Save clicked after edit', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      // Edit name field to mark dirty
      const nameInput = screen.getByPlaceholderText('my-package') as HTMLInputElement;
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'changed-name');

      const saveButton = screen.getByText('Save').closest('button')!;
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'dev-tools:write-package-config',
          '/test/project',
          'node',
          expect.objectContaining({
            structured: expect.objectContaining({ name: 'changed-name' }),
          })
        );
      });
    });

    it('shows save status message after save', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      // Edit to make dirty
      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'new-name');

      await userEvent.click(screen.getByText('Save').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('package.json saved')).toBeDefined();
      });
    });

    it('shows error message when save fails', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockNodeConfig);
        if (channel === 'dev-tools:write-package-config')
          return Promise.reject(new Error('Write failed'));
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'fail-name');

      await userEvent.click(screen.getByText('Save').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Failed to save')).toBeDefined();
      });
    });

    it('handles Ctrl+S keyboard shortcut', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      // Edit to make dirty
      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'shortcut-name');

      // Trigger Ctrl+S on the container
      const container = screen.getByText('package.json').closest('[tabindex]')!;
      fireEvent.keyDown(container, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'dev-tools:write-package-config',
          '/test/project',
          'node',
          expect.anything()
        );
      });
    });
  });

  // ── Dirty tracking ───────────────────────────────────────────────────

  describe('dirty tracking', () => {
    it('Save button is disabled when not dirty', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save').closest('button')!;
        expect(saveButton.disabled).toBe(true);
      });
    });

    it('Save button is enabled when dirty', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'dirty-name');

      const saveButton = screen.getByText('Save').closest('button')!;
      expect(saveButton.disabled).toBe(false);
    });

    it('shows unsaved indicator dot when dirty', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'dirty');

      // Should show the orange dot
      const dot = document.querySelector('.bg-orange-400');
      expect(dot).not.toBeNull();
    });
  });

  // ── Close prompt ─────────────────────────────────────────────────────

  describe('close prompt', () => {
    it('calls onClose directly when not dirty', async () => {
      const onClose = vi.fn();
      render(<PackageConfigEditor {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTitle('Close')).toBeDefined();
      });

      await userEvent.click(screen.getByTitle('Close').closest('button')!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows unsaved changes prompt when dirty', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'dirty');

      await userEvent.click(screen.getByTitle('Close').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('You have unsaved changes.')).toBeDefined();
      });
    });

    it('Cancel button closes the prompt', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'dirty');

      await userEvent.click(screen.getByTitle('Close').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeDefined();
      });

      await userEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('You have unsaved changes.')).toBeNull();
      });
    });

    it('"Close without saving" calls onClose', async () => {
      const onClose = vi.fn();
      render(<PackageConfigEditor {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'dirty');

      await userEvent.click(screen.getByTitle('Close').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Close without saving')).toBeDefined();
      });

      await userEvent.click(screen.getByText('Close without saving'));
      expect(onClose).toHaveBeenCalled();
    });

    it('"Save and close" saves then closes', async () => {
      const onClose = vi.fn();
      render(<PackageConfigEditor {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('my-package')).toBeDefined();
      });

      const nameInput = screen.getByPlaceholderText('my-package');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'dirty');

      await userEvent.click(screen.getByTitle('Close').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('Save and close')).toBeDefined();
      });

      await userEvent.click(screen.getByText('Save and close'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'dev-tools:write-package-config',
          '/test/project',
          'node',
          expect.anything()
        );
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  // ── Tier 2 (TOML section-aware) ─────────────────────────────────────

  describe('Tier 2 — section-aware editor', () => {
    it('renders section navigation for python', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockPythonConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="python" />);

      await waitFor(() => {
        expect(screen.getByText('Sections')).toBeDefined();
      });
    });

    it('renders textarea for raw editing', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockPythonConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="python" />);

      await waitFor(() => {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).not.toBeNull();
        expect(textarea.value).toContain('[tool.poetry]');
      });
    });
  });

  // ── Tier 3 (structured text) ─────────────────────────────────────────

  describe('Tier 3 — structured text editor', () => {
    it('renders textarea for go config', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockGoConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="go" />);

      await waitFor(() => {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).not.toBeNull();
        expect(textarea.value).toContain('module example.com/my-module');
      });
    });

    it('renders file name in header for go', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'dev-tools:read-package-config') return Promise.resolve(mockGoConfig);
        return Promise.resolve(null);
      });

      render(<PackageConfigEditor {...defaultProps} ecosystem="go" />);

      await waitFor(() => {
        expect(screen.getByText('go.mod')).toBeDefined();
      });
    });
  });

  // ── IPC call on mount ────────────────────────────────────────────────

  describe('IPC integration', () => {
    it('calls read-package-config on mount with correct args', async () => {
      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'dev-tools:read-package-config',
          '/test/project',
          'node'
        );
      });
    });

    it('handles load failure gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Read failed'));

      render(<PackageConfigEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No config file found')).toBeDefined();
      });
    });
  });
});
