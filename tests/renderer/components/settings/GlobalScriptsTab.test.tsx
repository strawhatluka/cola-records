import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  createMockGlobalDevScript,
  createMockGlobalDevScriptsList,
} from '../../../mocks/dev-scripts.mock';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock the store
const mockLoadGlobalScripts = vi.fn();
const mockSaveGlobalScript = vi.fn();
const mockDeleteGlobalScript = vi.fn();

let mockStoreState = {
  globalScripts: [] as any[],
  loading: false,
  error: null as string | null,
};

vi.mock('../../../../src/renderer/stores/useDevScriptsStore', () => ({
  useDevScriptsStore: () => ({
    ...mockStoreState,
    loadGlobalScripts: mockLoadGlobalScripts,
    saveGlobalScript: mockSaveGlobalScript,
    deleteGlobalScript: mockDeleteGlobalScript,
  }),
}));

import { GlobalScriptsTab } from '../../../../src/renderer/components/settings/GlobalScriptsTab';

describe('GlobalScriptsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      globalScripts: [],
      loading: false,
      error: null,
    };
  });

  describe('rendering', () => {
    it('renders the title and description', () => {
      render(<GlobalScriptsTab />);
      expect(screen.getByText('Global Dev Scripts')).toBeDefined();
      expect(screen.getByText(/Scripts defined here are available in every project/)).toBeDefined();
    });

    it('renders empty state when no global scripts', () => {
      render(<GlobalScriptsTab />);
      expect(screen.getByText('No global scripts yet')).toBeDefined();
    });

    it('renders the Add Global Script button', () => {
      render(<GlobalScriptsTab />);
      expect(screen.getByText('Add Global Script')).toBeDefined();
    });

    it('renders global scripts list', () => {
      mockStoreState.globalScripts = createMockGlobalDevScriptsList();
      render(<GlobalScriptsTab />);

      expect(screen.getByText('Format')).toBeDefined();
      expect(screen.getByText('Global Lint')).toBeDefined();
      expect(screen.getByText('Clean')).toBeDefined();
    });

    it('shows Global badge on each script', () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Lint' })];
      render(<GlobalScriptsTab />);

      expect(screen.getAllByText('Global').length).toBeGreaterThan(0);
    });

    it('calls loadGlobalScripts on mount', () => {
      render(<GlobalScriptsTab />);
      expect(mockLoadGlobalScripts).toHaveBeenCalled();
    });
  });

  describe('form', () => {
    it('opens add form when Add Global Script is clicked', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      expect(screen.getByText('New Global Script')).toBeDefined();
    });

    it('shows name input in single mode', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      expect(screen.getByTestId('global-script-name')).toBeDefined();
    });

    it('shows mode selector buttons', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      expect(screen.getByText('Single')).toBeDefined();
      expect(screen.getByText('Multi')).toBeDefined();
      expect(screen.getByText('Toggle')).toBeDefined();
    });

    it('shows error for empty name on submit', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeDefined();
      });
    });

    it('shows error for empty command on submit', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));

      // Set name
      const nameInput = screen.getByTestId('global-script-name');
      fireEvent.change(nameInput, { target: { value: 'Test Script' } });

      // Submit without command
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('At least one command is required')).toBeDefined();
      });
    });

    it('calls saveGlobalScript on valid submit', async () => {
      mockSaveGlobalScript.mockResolvedValueOnce(undefined);

      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));

      // Fill form
      fireEvent.change(screen.getByTestId('global-script-name'), {
        target: { value: 'Build' },
      });
      fireEvent.change(screen.getByTestId('global-script-command-0'), {
        target: { value: 'npm run build' },
      });

      // Submit
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(mockSaveGlobalScript).toHaveBeenCalledWith(
          expect.objectContaining({
            projectPath: '__global__',
            name: 'Build',
            commands: ['npm run build'],
          })
        );
      });
    });

    it('closes form on Cancel', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      expect(screen.getByText('New Global Script')).toBeDefined();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('New Global Script')).toBeNull();
    });

    it('shows duplicate name error', async () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Build' })];

      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));

      fireEvent.change(screen.getByTestId('global-script-name'), {
        target: { value: 'Build' },
      });
      fireEvent.change(screen.getByTestId('global-script-command-0'), {
        target: { value: 'npm run build' },
      });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('A global script with this name already exists')).toBeDefined();
      });
    });
  });

  describe('edit', () => {
    it('opens edit form when edit button is clicked', () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Build' })];
      render(<GlobalScriptsTab />);

      const editBtn = screen.getByTitle('Edit script');
      fireEvent.click(editBtn);

      expect(screen.getByText('Edit Global Script')).toBeDefined();
    });

    it('saves edited script', async () => {
      mockSaveGlobalScript.mockResolvedValueOnce(undefined);
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Build' })];
      render(<GlobalScriptsTab />);

      const editBtn = screen.getByTitle('Edit script');
      fireEvent.click(editBtn);

      const nameInput = screen.getByTestId('global-script-name');
      fireEvent.change(nameInput, { target: { value: 'Build All' } });

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockSaveGlobalScript).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Build All',
          })
        );
      });
    });
  });

  describe('script modes', () => {
    it('switches to multi mode and shows terminal UI', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Multi'));

      expect(screen.getByText('Add Terminal')).toBeDefined();
    });

    it('switches to toggle mode and shows toggle fields', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));

      // Labels include em-dash: "First Press — Name", "First Press — Command", etc.
      expect(screen.getByTestId('global-script-toggle-first-name')).toBeDefined();
      expect(screen.getByTestId('global-script-toggle-first-cmd')).toBeDefined();
      expect(screen.getByTestId('global-script-toggle-second-name')).toBeDefined();
      expect(screen.getByTestId('global-script-toggle-second-cmd')).toBeDefined();
    });

    it('switches back to single mode', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Multi'));
      fireEvent.click(screen.getByText('Single'));

      expect(screen.getByTestId('global-script-command-0')).toBeDefined();
    });
  });

  describe('commands', () => {
    it('adds a second command field', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Add Command'));

      expect(screen.getByTestId('global-script-command-0')).toBeDefined();
      expect(screen.getByTestId('global-script-command-1')).toBeDefined();
    });
  });

  describe('loading state', () => {
    it('disables Add Script button when loading', () => {
      mockStoreState.loading = true;
      render(<GlobalScriptsTab />);

      // Open the form, then check submit is disabled
      fireEvent.click(screen.getByText('Add Global Script'));
      const addBtn = screen.getByText('Add Script');
      expect((addBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('delete', () => {
    it('shows delete confirmation on delete click', () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Build' })];

      render(<GlobalScriptsTab />);

      // Find and click delete button
      const deleteBtn = screen.getByTitle('Delete script');
      fireEvent.click(deleteBtn);

      expect(screen.getByText('Confirm')).toBeDefined();
    });

    it('calls deleteGlobalScript on confirm', async () => {
      mockDeleteGlobalScript.mockResolvedValueOnce(undefined);
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Build' })];

      render(<GlobalScriptsTab />);

      fireEvent.click(screen.getByTitle('Delete script'));
      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockDeleteGlobalScript).toHaveBeenCalledWith('g1');
      });
    });

    it('cancels delete', () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Build' })];

      render(<GlobalScriptsTab />);

      fireEvent.click(screen.getByTitle('Delete script'));
      expect(screen.getByText('Confirm')).toBeDefined();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Confirm')).toBeNull();
    });
  });

  describe('script info display', () => {
    it('shows command count for multi-command scripts', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'g1',
          name: 'Build',
          commands: ['npm run lint', 'npm run build', 'npm run test'],
        }),
      ];
      render(<GlobalScriptsTab />);

      expect(screen.getByText('Build')).toBeDefined();
    });

    it('displays multiple scripts', () => {
      mockStoreState.globalScripts = createMockGlobalDevScriptsList();
      render(<GlobalScriptsTab />);

      expect(screen.getByText('Format')).toBeDefined();
      expect(screen.getByText('Global Lint')).toBeDefined();
      expect(screen.getByText('Clean')).toBeDefined();
    });

    it('shows Toggle badge for toggle scripts', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'g1',
          name: 'Start DB',
          toggle: {
            firstPressName: 'Start DB',
            firstPressCommand: 'docker compose up -d',
            secondPressName: 'Stop DB',
            secondPressCommand: 'docker compose down',
          },
        }),
      ];
      render(<GlobalScriptsTab />);
      expect(screen.getByText('Toggle')).toBeDefined();
      expect(screen.getByText('Start DB / Stop DB')).toBeDefined();
    });

    it('shows terminals count for multi-terminal scripts', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'g1',
          name: 'Full Stack',
          terminals: [
            { name: 'Frontend', commands: ['npm run dev:frontend'] },
            { name: 'Backend', commands: ['npm run dev:backend'] },
          ],
        }),
      ];
      render(<GlobalScriptsTab />);
      expect(screen.getByText('2 terminals')).toBeDefined();
      expect(screen.getByText('Frontend, Backend')).toBeDefined();
    });

    it('shows joined commands for multi-command single scripts', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'g1',
          name: 'Setup',
          commands: ['npm install', 'npm run build'],
        }),
      ];
      render(<GlobalScriptsTab />);
      expect(screen.getByText('npm install && npm run build')).toBeDefined();
      expect(screen.getByText('2 commands')).toBeDefined();
    });
  });

  describe('toggle mode', () => {
    it('submits toggle mode successfully', async () => {
      mockSaveGlobalScript.mockResolvedValueOnce(undefined);
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));

      fireEvent.change(screen.getByTestId('global-script-toggle-first-name'), {
        target: { value: 'Start DB' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-first-cmd'), {
        target: { value: 'docker compose up -d' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-second-name'), {
        target: { value: 'Stop DB' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-second-cmd'), {
        target: { value: 'docker compose down' },
      });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(mockSaveGlobalScript).toHaveBeenCalledWith(
          expect.objectContaining({
            projectPath: '__global__',
            name: 'Start DB',
            toggle: {
              firstPressName: 'Start DB',
              firstPressCommand: 'docker compose up -d',
              secondPressName: 'Stop DB',
              secondPressCommand: 'docker compose down',
            },
          })
        );
      });
    });

    it('validates first press name required', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('First press name is required')).toBeDefined();
      });
    });

    it('validates first press command required', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));
      fireEvent.change(screen.getByTestId('global-script-toggle-first-name'), {
        target: { value: 'Start' },
      });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('First press command is required')).toBeDefined();
      });
    });

    it('validates second press name required', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));
      fireEvent.change(screen.getByTestId('global-script-toggle-first-name'), {
        target: { value: 'Start' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-first-cmd'), {
        target: { value: 'up' },
      });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Second press name is required')).toBeDefined();
      });
    });

    it('validates second press command required', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));
      fireEvent.change(screen.getByTestId('global-script-toggle-first-name'), {
        target: { value: 'Start' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-first-cmd'), {
        target: { value: 'up' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-second-name'), {
        target: { value: 'Stop' },
      });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Second press command is required')).toBeDefined();
      });
    });

    it('validates duplicate name in toggle mode', async () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Start DB' })];
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));
      fireEvent.change(screen.getByTestId('global-script-toggle-first-name'), {
        target: { value: 'Start DB' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-first-cmd'), {
        target: { value: 'up' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-second-name'), {
        target: { value: 'Stop' },
      });
      fireEvent.change(screen.getByTestId('global-script-toggle-second-cmd'), {
        target: { value: 'down' },
      });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('A global script with this name already exists')).toBeDefined();
      });
    });

    it('hides name input in toggle mode', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Toggle'));
      expect(screen.queryByTestId('global-script-name')).toBeNull();
    });
  });

  describe('multi-terminal mode', () => {
    it('submits multi-terminal mode successfully', async () => {
      mockSaveGlobalScript.mockResolvedValueOnce(undefined);
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.change(screen.getByTestId('global-script-name'), {
        target: { value: 'Full Stack' },
      });
      fireEvent.click(screen.getByText('Multi'));

      // First terminal should be auto-created
      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Frontend' } });

      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'npm run dev:frontend' } });

      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(mockSaveGlobalScript).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Full Stack',
            terminals: [{ name: 'Frontend', commands: ['npm run dev:frontend'] }],
          })
        );
      });
    });

    it('validates empty terminal name', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.change(screen.getByTestId('global-script-name'), {
        target: { value: 'Stack' },
      });
      fireEvent.click(screen.getByText('Multi'));

      // Auto-created terminal has name "Terminal 1" — clear it to trigger validation
      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: '' } });

      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'cmd' } });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Terminal 1 needs a name')).toBeDefined();
      });
    });

    it('validates empty terminal commands', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.change(screen.getByTestId('global-script-name'), {
        target: { value: 'Stack' },
      });
      fireEvent.click(screen.getByText('Multi'));

      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Frontend' } });

      // Leave command empty, click submit
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Terminal "Frontend" needs at least one command')).toBeDefined();
      });
    });

    it('validates duplicate terminal names', async () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.change(screen.getByTestId('global-script-name'), {
        target: { value: 'Stack' },
      });
      fireEvent.click(screen.getByText('Multi'));

      // First terminal
      const firstTerminal = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(firstTerminal, { target: { value: 'Frontend' } });
      const firstCmd = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(firstCmd, { target: { value: 'cmd1' } });

      // Add second terminal
      fireEvent.click(screen.getByText('Add Terminal'));
      const allTerminalNames = screen.getAllByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(allTerminalNames[1], { target: { value: 'Frontend' } });
      const allCmds = screen.getAllByPlaceholderText('e.g., npm run dev');
      fireEvent.change(allCmds[1], { target: { value: 'cmd2' } });

      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Terminal names must be unique')).toBeDefined();
      });
    });

    it('carries commands from single to multi mode', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));

      // Enter a command in single mode
      fireEvent.change(screen.getByTestId('global-script-command-0'), {
        target: { value: 'npm run build' },
      });

      // Switch to multi
      fireEvent.click(screen.getByText('Multi'));

      // Terminal should exist with the command carried over
      expect(screen.getByText('1 cmd')).toBeDefined();
    });
  });

  describe('edit toggle/multi scripts', () => {
    it('opens edit form in toggle mode for toggle script', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'g1',
          name: 'Start DB',
          toggle: {
            firstPressName: 'Start DB',
            firstPressCommand: 'docker compose up -d',
            secondPressName: 'Stop DB',
            secondPressCommand: 'docker compose down',
          },
        }),
      ];
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByTitle('Edit script'));

      expect(screen.getByText('Edit Global Script')).toBeDefined();
      expect(
        (screen.getByTestId('global-script-toggle-first-name') as HTMLInputElement).value
      ).toBe('Start DB');
      expect((screen.getByTestId('global-script-toggle-first-cmd') as HTMLInputElement).value).toBe(
        'docker compose up -d'
      );
      expect(
        (screen.getByTestId('global-script-toggle-second-name') as HTMLInputElement).value
      ).toBe('Stop DB');
      expect(
        (screen.getByTestId('global-script-toggle-second-cmd') as HTMLInputElement).value
      ).toBe('docker compose down');
    });

    it('opens edit form in multi mode for multi-terminal script', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'g1',
          name: 'Full Stack',
          terminals: [
            { name: 'Frontend', commands: ['npm run dev:frontend'] },
            { name: 'Backend', commands: ['npm run dev:backend'] },
          ],
        }),
      ];
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByTitle('Edit script'));

      expect(screen.getByText('Edit Global Script')).toBeDefined();
      expect(screen.getByText('Add Terminal')).toBeDefined();
    });
  });

  describe('save error handling', () => {
    it('displays error when save fails', async () => {
      mockSaveGlobalScript.mockRejectedValueOnce(new Error('Network error'));
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.change(screen.getByTestId('global-script-name'), {
        target: { value: 'Build' },
      });
      fireEvent.change(screen.getByTestId('global-script-command-0'), {
        target: { value: 'npm run build' },
      });
      fireEvent.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeDefined();
      });
    });
  });

  describe('remove command', () => {
    it('removes a command when clicking X button', () => {
      render(<GlobalScriptsTab />);
      fireEvent.click(screen.getByText('Add Global Script'));
      fireEvent.click(screen.getByText('Add Command'));

      // Now 2 command inputs
      expect(screen.getByTestId('global-script-command-0')).toBeDefined();
      expect(screen.getByTestId('global-script-command-1')).toBeDefined();

      // Click X on one of the commands — find X buttons inside the commands area
      const xButtons = screen.getAllByTestId('icon-x');
      // The form has an X close button too, so find the one that's in the commands area
      // Click the last X icon which should be the remove command button
      const removeBtn = xButtons[xButtons.length - 1].closest('button');
      if (removeBtn) fireEvent.click(removeBtn);

      expect(screen.queryByTestId('global-script-command-1')).toBeNull();
    });
  });
});
