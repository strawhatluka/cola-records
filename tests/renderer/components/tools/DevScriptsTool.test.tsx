import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMockDevScript,
  createMockToggleScript,
  createMockGlobalDevScript,
  createMockGlobalDevScriptsList,
} from '../../../mocks/dev-scripts.mock';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock the IPC client
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));

// Mock the dev scripts store with controllable state
const mockLoadScripts = vi.fn();
const mockSaveScript = vi.fn();
const mockDeleteScript = vi.fn();

let mockStoreState = {
  scripts: [] as any[],
  globalScripts: [] as any[],
  loading: false,
  error: null as string | null,
};

vi.mock('../../../../src/renderer/stores/useDevScriptsStore', () => ({
  useDevScriptsStore: () => ({
    ...mockStoreState,
    loadScripts: mockLoadScripts,
    saveScript: mockSaveScript,
    deleteScript: mockDeleteScript,
  }),
  selectScriptsForProject: (scripts: any[], projectPath: string) =>
    scripts.filter((s: any) => s.projectPath === projectPath),
}));

import { DevScriptsTool } from '../../../../src/renderer/components/tools/DevScriptsTool';

describe('DevScriptsTool', () => {
  const defaultProps = {
    workingDirectory: '/test/project/path',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      scripts: [],
      globalScripts: [],
      loading: false,
      error: null,
    };
  });

  // ── TT-08: Rendering Tests ──────────────────────────────────────────

  describe('rendering', () => {
    it('renders the header with title', () => {
      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Dev Scripts')).toBeDefined();
    });

    it('renders the Add Script button', () => {
      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Add Script')).toBeDefined();
    });

    it('should render script list when scripts exist', () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          projectPath: '/test/project/path',
        }),
        createMockDevScript({
          id: 'script_2',
          name: 'Test',
          command: 'npm test',
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('Build')).toBeDefined();
      expect(screen.getByText('Test')).toBeDefined();
      expect(screen.getByText('npm run build')).toBeDefined();
      expect(screen.getByText('npm test')).toBeDefined();
    });

    it('should render empty state when no scripts', () => {
      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('No scripts yet')).toBeDefined();
      expect(
        screen.getByText('Create custom scripts that appear as buttons in the header.')
      ).toBeDefined();
    });

    it('should show add script form', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      const addButton = screen.getByText('Add Script');
      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByText('New Script')).toBeDefined();
        expect(screen.getByPlaceholderText('e.g., Build, Test, Dev')).toBeDefined();
        expect(screen.getByPlaceholderText('e.g., npm install')).toBeDefined();
      });
    });

    it('loads scripts on mount with workingDirectory', () => {
      render(<DevScriptsTool {...defaultProps} />);
      expect(mockLoadScripts).toHaveBeenCalledWith('/test/project/path');
    });

    it('shows loading state when loading with no scripts', () => {
      mockStoreState.loading = true;
      mockStoreState.scripts = [];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Loading scripts...')).toBeDefined();
    });

    it('has correct container classes', () => {
      const { container } = render(<DevScriptsTool {...defaultProps} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('flex');
      expect(wrapper.className).toContain('flex-col');
      expect(wrapper.className).toContain('h-full');
    });
  });

  // ── TT-09: Form Tests ──────────────────────────────────────────

  describe('add script', () => {
    it('should show name and command inputs', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      const addButton = screen.getByText('Add Script');
      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Build, Test, Dev')).toBeDefined();
        expect(screen.getByPlaceholderText('e.g., npm install')).toBeDefined();
      });
    });

    it('should validate required fields - name', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      // Open form
      const addButton = screen.getByText('Add Script');
      fireEvent.click(addButton);

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByText('New Script')).toBeDefined();
      });

      // Find and click the submit button (inside the form, after the inputs)
      const submitButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent === 'Add Script');
      // The second "Add Script" button is the submit button in the form
      const submitButton = submitButtons[1];

      fireEvent.click(submitButton!);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeDefined();
      });
    });

    it('should validate required fields - command', async () => {
      const user = userEvent.setup();
      render(<DevScriptsTool {...defaultProps} />);

      // Open form
      await user.click(screen.getByText('Add Script'));

      // Enter name but not command
      const nameInput = await screen.findByPlaceholderText('e.g., Build, Test, Dev');
      await user.type(nameInput, 'Test Script');

      // Find submit by checking buttons after form opens
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (btn.textContent === 'Add Script' && btn.closest('.space-y-3')) {
          await user.click(btn);
          break;
        }
      }

      await waitFor(() => {
        expect(screen.getByText('At least one command is required')).toBeDefined();
      });
    });

    it('should call saveScript on submit', async () => {
      const user = userEvent.setup();
      mockSaveScript.mockResolvedValueOnce(undefined);

      render(<DevScriptsTool {...defaultProps} />);

      // Open form
      await user.click(screen.getByText('Add Script'));

      // Fill form
      const nameInput = await screen.findByPlaceholderText('e.g., Build, Test, Dev');
      const commandInput = screen.getByPlaceholderText('e.g., npm install');

      await user.type(nameInput, 'Build');
      await user.type(commandInput, 'npm run build');

      // Submit using the Add Script button inside form
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        // The form's submit button is inside .space-y-3
        if (btn.textContent === 'Add Script') {
          const parent = btn.parentElement;
          if (parent?.classList.contains('flex') && parent?.classList.contains('gap-2')) {
            await user.click(btn);
            break;
          }
        }
      }

      await waitFor(() => {
        expect(mockSaveScript).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Build',
            command: 'npm run build',
            commands: ['npm run build'],
            projectPath: '/test/project/path',
          })
        );
      });
    });

    it('should clear form after successful save', async () => {
      const user = userEvent.setup();
      mockSaveScript.mockResolvedValueOnce(undefined);

      render(<DevScriptsTool {...defaultProps} />);

      // Open form
      await user.click(screen.getByText('Add Script'));

      // Fill form
      const nameInput = await screen.findByPlaceholderText('e.g., Build, Test, Dev');
      const commandInput = screen.getByPlaceholderText('e.g., npm install');

      await user.type(nameInput, 'Build');
      await user.type(commandInput, 'npm run build');

      // Submit
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (btn.textContent === 'Add Script') {
          const parent = btn.parentElement;
          if (parent?.classList.contains('flex') && parent?.classList.contains('gap-2')) {
            await user.click(btn);
            break;
          }
        }
      }

      // Form should close after successful save
      await waitFor(() => {
        expect(screen.queryByText('New Script')).toBeNull();
      });
    });
  });

  describe('edit script', () => {
    it('should populate form with script data', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Find and click edit button (use fireEvent to ignore CSS opacity)
      const editButton = container.querySelector('button[title="Edit script"]');
      expect(editButton).not.toBeNull();
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Edit Script')).toBeDefined();
        const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
        expect((nameInput as HTMLInputElement).value).toBe('Build');
        const commandInput = screen.getByPlaceholderText('e.g., npm install');
        expect((commandInput as HTMLInputElement).value).toBe('npm run build');
      });
    });

    it('should update script on save', async () => {
      const user = userEvent.setup();
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];
      mockSaveScript.mockResolvedValueOnce(undefined);

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Click edit button (use fireEvent to ignore CSS opacity)
      const editButton = container.querySelector('button[title="Edit script"]');
      fireEvent.click(editButton!);

      // Modify command
      const commandInput = await screen.findByPlaceholderText('e.g., npm install');
      await user.clear(commandInput);
      await user.type(commandInput, 'npm run build:prod');

      // Submit - find Save Changes button
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockSaveScript).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'script_1',
            name: 'Build',
            command: 'npm run build:prod',
            commands: ['npm run build:prod'],
          })
        );
      });
    });

    it('should cancel edit and restore form', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Click edit button (use fireEvent to ignore CSS opacity)
      const editButton = container.querySelector('button[title="Edit script"]');
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Edit Script')).toBeDefined();
      });

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'));

      // Form should close
      await waitFor(() => {
        expect(screen.queryByText('Edit Script')).toBeNull();
      });
    });
  });

  describe('delete script', () => {
    it('should show confirmation dialog', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Find and click delete button (use fireEvent to ignore CSS opacity)
      const deleteButton = container.querySelector('button[title="Delete script"]');
      expect(deleteButton).not.toBeNull();
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeDefined();
      });
    });

    it('should delete on confirm', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];
      mockDeleteScript.mockResolvedValueOnce(undefined);

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Click delete button (use fireEvent to ignore CSS opacity)
      const deleteButton = container.querySelector('button[title="Delete script"]');
      fireEvent.click(deleteButton!);

      // Click confirm
      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockDeleteScript).toHaveBeenCalledWith('script_1');
      });
    });

    it('should cancel without deleting', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Click delete button (use fireEvent to ignore CSS opacity)
      const deleteButton = container.querySelector('button[title="Delete script"]');
      fireEvent.click(deleteButton!);

      // Click cancel (second button in confirm dialog)
      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeDefined();
      });

      // There should be a cancel button next to Confirm
      const cancelBtn = screen.getAllByRole('button').find((btn) => btn.textContent === 'Cancel');
      fireEvent.click(cancelBtn!);

      // Should not have called delete
      expect(mockDeleteScript).not.toHaveBeenCalled();
    });
  });

  describe('script execution', () => {
    it('should dispatch execute-dev-script event when run clicked', async () => {
      const mockScript = createMockDevScript({
        id: 'script_1',
        name: 'Build',
        command: 'npm run build',
        commands: ['npm run build'],
        projectPath: '/test/project/path',
      });
      mockStoreState.scripts = [mockScript];

      const eventListener = vi.fn();
      window.addEventListener('execute-dev-script', eventListener);

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Find and click run button (use fireEvent to ignore CSS opacity)
      const runButton = container.querySelector('button[title="Run script"]');
      expect(runButton).not.toBeNull();
      fireEvent.click(runButton!);

      await waitFor(() => {
        expect(eventListener).toHaveBeenCalled();
      });

      window.removeEventListener('execute-dev-script', eventListener);
    });
  });

  describe('form validation', () => {
    it('should show error for duplicate script name', async () => {
      const user = userEvent.setup();
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      // Open add form
      await user.click(screen.getByText('Add Script'));

      // Enter duplicate name
      const nameInput = await screen.findByPlaceholderText('e.g., Build, Test, Dev');
      const commandInput = screen.getByPlaceholderText('e.g., npm install');

      await user.type(nameInput, 'Build'); // Duplicate name
      await user.type(commandInput, 'npm run build:dev');

      // Submit
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (btn.textContent === 'Add Script') {
          const parent = btn.parentElement;
          if (parent?.classList.contains('flex') && parent?.classList.contains('gap-2')) {
            await user.click(btn);
            break;
          }
        }
      }

      await waitFor(() => {
        expect(screen.getByText('A script with this name already exists')).toBeDefined();
      });
    });
  });

  describe('toggle mode', () => {
    it('should show Toggle badge for toggle scripts in the list', () => {
      mockStoreState.scripts = [
        createMockToggleScript({
          id: 'toggle_1',
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Toggle')).toBeDefined();
    });

    it('should show toggle description in script list', () => {
      mockStoreState.scripts = [
        createMockToggleScript({
          id: 'toggle_1',
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Start DB / Stop DB')).toBeDefined();
    });

    it('should show 3 mode buttons when form is open', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      const addButton = screen.getByText('Add Script');
      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Single')).toBeDefined();
        expect(screen.getByText('Multi')).toBeDefined();
        expect(screen.getByText('Toggle')).toBeDefined();
      });
    });

    it('should show toggle form fields when toggle mode selected', async () => {
      const user = userEvent.setup();
      render(<DevScriptsTool {...defaultProps} />);

      await user.click(screen.getByText('Add Script'));

      // Click Toggle mode button
      await waitFor(() => {
        expect(screen.getByText('Toggle')).toBeDefined();
      });
      await user.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Start DB')).toBeDefined();
        expect(screen.getByPlaceholderText('e.g., docker compose up -d')).toBeDefined();
        expect(screen.getByPlaceholderText('e.g., Stop DB')).toBeDefined();
        expect(screen.getByPlaceholderText('e.g., docker compose down')).toBeDefined();
      });
    });

    it('should validate first press name is required', async () => {
      const user = userEvent.setup();
      render(<DevScriptsTool {...defaultProps} />);

      await user.click(screen.getByText('Add Script'));

      // Switch to toggle mode
      await waitFor(() => {
        expect(screen.getByText('Toggle')).toBeDefined();
      });
      await user.click(screen.getByText('Toggle'));

      // Submit with all fields empty
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (btn.textContent === 'Add Script') {
          const parent = btn.parentElement;
          if (parent?.classList.contains('flex') && parent?.classList.contains('gap-2')) {
            await user.click(btn);
            break;
          }
        }
      }

      await waitFor(() => {
        expect(screen.getByText('First press name is required')).toBeDefined();
      });
    });

    it('should validate first press command is required', async () => {
      const user = userEvent.setup();
      render(<DevScriptsTool {...defaultProps} />);

      await user.click(screen.getByText('Add Script'));

      await waitFor(() => {
        expect(screen.getByText('Toggle')).toBeDefined();
      });
      await user.click(screen.getByText('Toggle'));

      // Fill only first press name
      const firstPressName = await screen.findByPlaceholderText('e.g., Start DB');
      await user.type(firstPressName, 'Start');

      // Submit
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (btn.textContent === 'Add Script') {
          const parent = btn.parentElement;
          if (parent?.classList.contains('flex') && parent?.classList.contains('gap-2')) {
            await user.click(btn);
            break;
          }
        }
      }

      await waitFor(() => {
        expect(screen.getByText('First press command is required')).toBeDefined();
      });
    });

    it('should save toggle script on submit', async () => {
      mockSaveScript.mockResolvedValueOnce(undefined);

      render(<DevScriptsTool {...defaultProps} />);

      // Open form
      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      // Switch to toggle mode
      await waitFor(() => {
        expect(screen.getByText('Toggle')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Toggle'));

      // Fill all fields using fireEvent.change (faster than userEvent.type for long strings)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Start DB')).toBeDefined();
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., Start DB'), {
        target: { value: 'Start DB' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose up -d'), {
        target: { value: 'docker compose up -d' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., Stop DB'), {
        target: { value: 'Stop DB' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose down'), {
        target: { value: 'docker compose down' },
      });

      // Submit
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (btn.textContent === 'Add Script') {
          const parent = btn.parentElement;
          if (parent?.classList.contains('flex') && parent?.classList.contains('gap-2')) {
            fireEvent.click(btn);
            break;
          }
        }
      }

      await waitFor(() => {
        expect(mockSaveScript).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Start DB',
            toggle: {
              firstPressName: 'Start DB',
              firstPressCommand: 'docker compose up -d',
              secondPressName: 'Stop DB',
              secondPressCommand: 'docker compose down',
            },
            projectPath: '/test/project/path',
          })
        );
      });
    });

    it('should populate toggle form when editing a toggle script', async () => {
      mockStoreState.scripts = [
        createMockToggleScript({
          id: 'toggle_edit',
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      const editButton = container.querySelector('button[title="Edit script"]');
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Edit Script')).toBeDefined();
        const firstPressName = screen.getByPlaceholderText('e.g., Start DB') as HTMLInputElement;
        expect(firstPressName.value).toBe('Start DB');
        const firstPressCommand = screen.getByPlaceholderText(
          'e.g., docker compose up -d'
        ) as HTMLInputElement;
        expect(firstPressCommand.value).toBe('docker compose up -d');
        const secondPressName = screen.getByPlaceholderText('e.g., Stop DB') as HTMLInputElement;
        expect(secondPressName.value).toBe('Stop DB');
        const secondPressCommand = screen.getByPlaceholderText(
          'e.g., docker compose down'
        ) as HTMLInputElement;
        expect(secondPressCommand.value).toBe('docker compose down');
      });
    });
  });

  describe('multi-project isolation', () => {
    it('should not show scripts from a different project', () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_other',
          name: 'Other Build',
          projectPath: '/other/project',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('No scripts yet')).toBeDefined();
    });

    it('should show only scripts matching workingDirectory', () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_mine',
          name: 'My Build',
          projectPath: '/test/project/path',
        }),
        createMockDevScript({
          id: 'script_other',
          name: 'Other Build',
          projectPath: '/other/project',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('My Build')).toBeDefined();
      expect(screen.queryByText('Other Build')).toBeNull();
    });
  });

  // ── Helper: find the form submit button ──────────────────────────────
  // The form submit button is the "Add Script" or "Save Changes" button
  // inside the form's flex gap-2 container.
  function findFormSubmitButton(label = 'Add Script'): HTMLElement {
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      if (btn.textContent === label) {
        const parent = btn.parentElement;
        if (parent?.classList.contains('flex') && parent?.classList.contains('gap-2')) {
          return btn;
        }
      }
    }
    throw new Error(`Form submit button "${label}" not found`);
  }

  // ── Single Terminal Command Management ──────────────────────────────

  describe('single terminal command management', () => {
    it('should add a new command field when Add Command is clicked', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm install')).toBeDefined();
      });

      // Click "Add Command" button
      fireEvent.click(screen.getByText('Add Command'));

      await waitFor(() => {
        // Second command input should now appear
        expect(screen.getByPlaceholderText('e.g., npm run build')).toBeDefined();
      });
    });

    it('should show command count when multiple commands exist', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm install')).toBeDefined();
      });

      // Add a command
      fireEvent.click(screen.getByText('Add Command'));

      await waitFor(() => {
        expect(screen.getByText('Commands (2)')).toBeDefined();
        expect(screen.getByText('Commands will run sequentially in order.')).toBeDefined();
      });
    });

    it('should update command value when input changes', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      const commandInput = await screen.findByPlaceholderText('e.g., npm install');
      fireEvent.change(commandInput, { target: { value: 'npm run dev' } });

      expect((commandInput as HTMLInputElement).value).toBe('npm run dev');
    });

    it('should remove a command when X is clicked on a multi-command form', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm install')).toBeDefined();
      });

      // Add a second command (total 2)
      fireEvent.click(screen.getByText('Add Command'));

      await waitFor(() => {
        expect(screen.getByText('Commands (2)')).toBeDefined();
      });

      // With 2 commands, each row should have a remove (X) button
      // Find X icon buttons inside the form's command area
      const formArea = screen.getByText('New Script').closest('.mb-4');
      const xIcons = formArea?.querySelectorAll('[data-testid="icon-x"]');
      expect(xIcons!.length).toBeGreaterThan(0);

      // Click the first remove button
      const firstRemoveBtn = xIcons![0].closest('button');
      fireEvent.click(firstRemoveBtn!);

      // Should be back to 1 command
      await waitFor(() => {
        expect(screen.queryByText('Commands (2)')).toBeNull();
      });
    });

    it('should not remove the last remaining command', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm install')).toBeDefined();
      });

      // With only 1 command, there should be no remove button
      // The remove button only shows when commands.length > 1
      const commandInputs = screen.getAllByPlaceholderText('e.g., npm install');
      expect(commandInputs.length).toBe(1);

      // No X button should be visible for single command
      const formArea = screen.getByText('New Script').closest('.mb-4');
      const xIcons = formArea?.querySelectorAll('[data-testid="icon-x"]');
      // In single mode with 1 command, X buttons are for terminal close, not command removal
      // Actually, the remove command button only renders when commands.length > 1
      expect(xIcons?.length ?? 0).toBe(0);
    });
  });

  // ── Multi-Terminal Mode ──────────────────────────────────────────────

  describe('multi-terminal mode', () => {
    it('should switch to multi mode and show terminal UI', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      await waitFor(() => {
        expect(screen.getByText('Multi')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(
          screen.getByText('Launch multiple terminals in parallel (e.g., frontend + backend)')
        ).toBeDefined();
        // Should initialize with one terminal
        expect(screen.getByText('Terminals (1)')).toBeDefined();
        expect(screen.getByPlaceholderText('Terminal name (e.g., Frontend)')).toBeDefined();
      });
    });

    it('should initialize multi mode with current commands when switching from single', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      // Type a command in single mode first
      const commandInput = await screen.findByPlaceholderText('e.g., npm install');
      fireEvent.change(commandInput, { target: { value: 'npm run dev' } });

      // Switch to multi mode
      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        // The terminal should have been initialized with the existing command
        expect(screen.getByDisplayValue('npm run dev')).toBeDefined();
      });
    });

    it('should add a new terminal when Add Terminal is clicked', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (1)')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Add Terminal'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (2)')).toBeDefined();
        const terminalNameInputs = screen.getAllByPlaceholderText('Terminal name (e.g., Frontend)');
        expect(terminalNameInputs.length).toBe(2);
      });
    });

    it('should update terminal name when input changes', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Terminal name (e.g., Frontend)')).toBeDefined();
      });

      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Frontend' } });

      expect((terminalNameInput as HTMLInputElement).value).toBe('Frontend');
    });

    it('should update terminal command when input changes', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm run dev')).toBeDefined();
      });

      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'npm start' } });

      expect((cmdInput as HTMLInputElement).value).toBe('npm start');
    });

    it('should add a command to a terminal', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm run dev')).toBeDefined();
      });

      // The "Add Command" button inside the terminal card
      const addCommandButtons = screen.getAllByText('Add Command');
      // The last one is inside the terminal card
      fireEvent.click(addCommandButtons[addCommandButtons.length - 1]);

      await waitFor(() => {
        // Should now have 2 command inputs inside the terminal
        expect(screen.getByPlaceholderText('e.g., npm run watch')).toBeDefined();
      });
    });

    it('should remove a command from a terminal when terminal has multiple commands', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm run dev')).toBeDefined();
      });

      // Add a second command
      const addCommandButtons = screen.getAllByText('Add Command');
      fireEvent.click(addCommandButtons[addCommandButtons.length - 1]);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm run watch')).toBeDefined();
      });

      // Now there should be X buttons to remove commands
      // Find X icon buttons inside terminal command rows
      const formArea = screen.getByText('New Script').closest('.mb-4');
      const removeIcons = formArea?.querySelectorAll('[data-testid="icon-x"]');
      expect(removeIcons!.length).toBeGreaterThan(0);

      // Click the first remove button (the parent button)
      const firstRemoveIcon = removeIcons![0];
      const removeButton = firstRemoveIcon.closest('button');
      if (removeButton) {
        fireEvent.click(removeButton);
      }

      // One command should have been removed
      await waitFor(() => {
        // After removing, we should be back to 1 command in the terminal
        expect(screen.queryByPlaceholderText('e.g., npm run watch')).toBeNull();
      });
    });

    it('should toggle terminal expanded/collapsed state', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        // Terminal 1 is expanded by default - command inputs should be visible
        expect(screen.getByPlaceholderText('e.g., npm run dev')).toBeDefined();
      });

      // Click the chevron to collapse
      const chevronDown = screen.getByTestId('icon-chevrondown');
      const collapseButton = chevronDown.closest('button');
      fireEvent.click(collapseButton!);

      await waitFor(() => {
        // Command inputs should be hidden when collapsed
        expect(screen.queryByPlaceholderText('e.g., npm run dev')).toBeNull();
      });

      // Click again to expand
      const chevronRight = screen.getByTestId('icon-chevronright');
      const expandButton = chevronRight.closest('button');
      fireEvent.click(expandButton!);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., npm run dev')).toBeDefined();
      });
    });

    it('should remove a terminal when X is clicked and there are multiple terminals', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (1)')).toBeDefined();
      });

      // Add a second terminal
      fireEvent.click(screen.getByText('Add Terminal'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (2)')).toBeDefined();
      });

      // Find the remove terminal button (X icon inside terminal header)
      // Each terminal header has an X button when terminals.length > 1
      const formArea = screen.getByText('New Script').closest('.mb-4');
      const terminalHeaders = formArea?.querySelectorAll('.bg-muted\\/50');
      // Get X buttons within terminal headers
      const xButtons: HTMLElement[] = [];
      terminalHeaders?.forEach((header) => {
        const xIcon = header.querySelector('[data-testid="icon-x"]');
        if (xIcon) {
          const btn = xIcon.closest('button');
          if (btn) xButtons.push(btn);
        }
      });

      expect(xButtons.length).toBeGreaterThan(0);
      fireEvent.click(xButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Terminals (1)')).toBeDefined();
      });
    });

    it('should not remove the last terminal', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (1)')).toBeDefined();
      });

      // With only 1 terminal, there should be no remove button in the header
      const formArea = screen.getByText('New Script').closest('.mb-4');
      const terminalHeaders = formArea?.querySelectorAll('.bg-muted\\/50');
      let xButtonsInHeaders = 0;
      terminalHeaders?.forEach((header) => {
        const xIcon = header.querySelector('[data-testid="icon-x"]');
        if (xIcon?.closest('button')) xButtonsInHeaders++;
      });
      expect(xButtonsInHeaders).toBe(0);
    });

    it('should show command count badge in terminal header', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        // With initial empty command, the count badge should show "0 cmd"
        // because the command is empty string which trim() is falsy
        expect(screen.getByText('0 cmd')).toBeDefined();
      });

      // Type a valid command
      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'npm start' } });

      await waitFor(() => {
        expect(screen.getByText('1 cmd')).toBeDefined();
      });
    });

    it('should validate multi-terminal - at least one terminal required', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      // Type a name first
      const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
      fireEvent.change(nameInput, { target: { value: 'Multi Script' } });

      // Switch to multi mode - this initializes with 1 terminal
      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (1)')).toBeDefined();
      });

      // Clear the default terminal name so validation hits "needs a name"
      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: '' } });

      // Submit without filling terminal name
      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Terminal 1 needs a name')).toBeDefined();
      });
    });

    it('should validate multi-terminal - terminal needs at least one command', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
      fireEvent.change(nameInput, { target: { value: 'Multi Script' } });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Terminal name (e.g., Frontend)')).toBeDefined();
      });

      // Fill terminal name but leave command empty
      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Frontend' } });

      // Submit
      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Terminal "Frontend" needs at least one command')).toBeDefined();
      });
    });

    it('should validate multi-terminal - duplicate terminal names', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
      fireEvent.change(nameInput, { target: { value: 'Multi Script' } });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (1)')).toBeDefined();
      });

      // Add second terminal
      fireEvent.click(screen.getByText('Add Terminal'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (2)')).toBeDefined();
      });

      // Set both terminal names to the same value
      const terminalNameInputs = screen.getAllByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInputs[0], { target: { value: 'Server' } });
      fireEvent.change(terminalNameInputs[1], { target: { value: 'Server' } });

      // Add valid commands to both terminals
      const cmdInputs = screen.getAllByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInputs[0], { target: { value: 'npm start' } });
      if (cmdInputs.length > 1) {
        fireEvent.change(cmdInputs[1], { target: { value: 'npm run api' } });
      }

      // Submit
      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Terminal names must be unique')).toBeDefined();
      });
    });

    it('should save a valid multi-terminal script', async () => {
      mockSaveScript.mockResolvedValueOnce(undefined);
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
      fireEvent.change(nameInput, { target: { value: 'Full Stack' } });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Terminal name (e.g., Frontend)')).toBeDefined();
      });

      // Fill terminal name and command
      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Frontend' } });

      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'npm run dev:frontend' } });

      // Submit
      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSaveScript).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Full Stack',
            terminals: [{ name: 'Frontend', commands: ['npm run dev:frontend'] }],
            projectPath: '/test/project/path',
          })
        );
      });
    });

    it('should handle save error in multi-terminal mode', async () => {
      mockSaveScript.mockRejectedValueOnce(new Error('Save failed'));
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
      fireEvent.change(nameInput, { target: { value: 'Multi Script' } });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Terminal name (e.g., Frontend)')).toBeDefined();
      });

      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Backend' } });

      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'npm run api' } });

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Error: Save failed')).toBeDefined();
      });
    });

    it('should show mode description for multi mode', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(
          screen.getByText('Launch multiple terminals in parallel (e.g., frontend + backend)')
        ).toBeDefined();
      });
    });
  });

  // ── Mode Switching ──────────────────────────────────────────────

  describe('mode switching', () => {
    it('should show single mode description by default', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      await waitFor(() => {
        expect(screen.getByText('Run commands sequentially in a single terminal')).toBeDefined();
      });
    });

    it('should show toggle mode description when toggle selected', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(
          screen.getByText('Alternate between two commands (e.g., start / stop)')
        ).toBeDefined();
      });
    });

    it('should hide name field in toggle mode and show it in single mode', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      // Name input should be visible in single mode
      expect(screen.getByPlaceholderText('e.g., Build, Test, Dev')).toBeDefined();

      // Switch to toggle
      fireEvent.click(screen.getByText('Toggle'));

      await waitFor(() => {
        // Name input should be hidden in toggle mode
        expect(screen.queryByPlaceholderText('e.g., Build, Test, Dev')).toBeNull();
      });

      // Switch back to single
      fireEvent.click(screen.getByText('Single'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Build, Test, Dev')).toBeDefined();
      });
    });

    it('should not re-initialize terminals when switching to multi mode if terminals already exist', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      // Switch to multi first - initializes with 1 terminal
      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (1)')).toBeDefined();
      });

      // Add a second terminal
      fireEvent.click(screen.getByText('Add Terminal'));

      await waitFor(() => {
        expect(screen.getByText('Terminals (2)')).toBeDefined();
      });

      // Switch to single, then back to multi
      fireEvent.click(screen.getByText('Single'));
      fireEvent.click(screen.getByText('Multi'));

      // Terminals should still be preserved (length > 0 check in handleModeChange)
      await waitFor(() => {
        expect(screen.getByText('Terminals (2)')).toBeDefined();
      });
    });
  });

  // ── Toggle Mode Validation (additional) ──────────────────────────────

  describe('toggle mode validation (extended)', () => {
    it('should validate second press name is required', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Start DB')).toBeDefined();
      });

      fireEvent.change(screen.getByPlaceholderText('e.g., Start DB'), {
        target: { value: 'Start' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose up -d'), {
        target: { value: 'docker compose up -d' },
      });
      // Leave second press name empty

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Second press name is required')).toBeDefined();
      });
    });

    it('should validate second press command is required', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Start DB')).toBeDefined();
      });

      fireEvent.change(screen.getByPlaceholderText('e.g., Start DB'), {
        target: { value: 'Start' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose up -d'), {
        target: { value: 'docker compose up -d' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., Stop DB'), {
        target: { value: 'Stop' },
      });
      // Leave second press command empty

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Second press command is required')).toBeDefined();
      });
    });

    it('should validate duplicate name in toggle mode', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_existing',
          name: 'Start',
          command: 'npm start',
          commands: ['npm start'],
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Start DB')).toBeDefined();
      });

      // Use "Start" as first press name - same as existing script
      fireEvent.change(screen.getByPlaceholderText('e.g., Start DB'), {
        target: { value: 'Start' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose up -d'), {
        target: { value: 'docker compose up -d' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., Stop DB'), {
        target: { value: 'Stop' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose down'), {
        target: { value: 'docker compose down' },
      });

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('A script with this name already exists')).toBeDefined();
      });
    });

    it('should handle save error in toggle mode', async () => {
      mockSaveScript.mockRejectedValueOnce(new Error('Toggle save failed'));

      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Toggle'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g., Start DB')).toBeDefined();
      });

      fireEvent.change(screen.getByPlaceholderText('e.g., Start DB'), {
        target: { value: 'Run DB' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose up -d'), {
        target: { value: 'docker compose up -d' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., Stop DB'), {
        target: { value: 'Kill DB' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g., docker compose down'), {
        target: { value: 'docker compose down' },
      });

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Error: Toggle save failed')).toBeDefined();
      });
    });
  });

  // ── Error Paths ──────────────────────────────────────────────

  describe('error paths', () => {
    it('should handle save error in single-terminal mode', async () => {
      mockSaveScript.mockRejectedValueOnce(new Error('Network error'));

      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
      fireEvent.change(nameInput, { target: { value: 'My Script' } });

      const cmdInput = screen.getByPlaceholderText('e.g., npm install');
      fireEvent.change(cmdInput, { target: { value: 'npm run build' } });

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeDefined();
      });
    });

    it('should show duplicate name error for single mode', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      // Switch to multi mode and try duplicate name
      const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev');
      fireEvent.change(nameInput, { target: { value: 'Build' } });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Terminal name (e.g., Frontend)')).toBeDefined();
      });

      // Fill terminal with valid data
      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Frontend' } });

      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'npm start' } });

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('A script with this name already exists')).toBeDefined();
      });
    });

    it('should handle delete failure gracefully', async () => {
      mockDeleteScript.mockRejectedValueOnce(new Error('Delete failed'));
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Click delete button
      const deleteButton = container.querySelector('button[title="Delete script"]');
      fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeDefined();
      });

      // Click confirm - should not crash even though delete fails
      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockDeleteScript).toHaveBeenCalledWith('script_1');
      });
    });

    it('should validate name is required for multi mode', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Add Script'));
      });

      fireEvent.click(screen.getByText('Multi'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Terminal name (e.g., Frontend)')).toBeDefined();
      });

      // Fill terminal but leave script name empty
      const terminalNameInput = screen.getByPlaceholderText('Terminal name (e.g., Frontend)');
      fireEvent.change(terminalNameInput, { target: { value: 'Frontend' } });

      const cmdInput = screen.getByPlaceholderText('e.g., npm run dev');
      fireEvent.change(cmdInput, { target: { value: 'npm start' } });

      const submitBtn = findFormSubmitButton();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeDefined();
      });
    });
  });

  // ── Script List Display Variants ──────────────────────────────────

  describe('script list display variants', () => {
    it('should show multi-command count badge for scripts with multiple commands', () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_multi_cmd',
          name: 'Setup',
          command: 'npm install',
          commands: ['npm install', 'npm run build', 'npm run dev'],
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('Setup')).toBeDefined();
      expect(screen.getByText('3 commands')).toBeDefined();
      // Multi-command scripts show commands joined by &&
      expect(screen.getByText('npm install && npm run build && npm run dev')).toBeDefined();
    });

    it('should show terminal count badge for multi-terminal scripts', () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_multi_term',
          name: 'Full Stack',
          command: 'npm run dev',
          commands: ['npm run dev'],
          terminals: [
            { name: 'Frontend', commands: ['npm run dev:frontend'] },
            { name: 'Backend', commands: ['npm run dev:backend'] },
          ],
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('Full Stack')).toBeDefined();
      expect(screen.getByText('2 terminals')).toBeDefined();
      // Terminal names displayed as comma-separated
      expect(screen.getByText('Frontend, Backend')).toBeDefined();
    });

    it('should show single command without count badge', () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_single',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('Build')).toBeDefined();
      expect(screen.getByText('npm run build')).toBeDefined();
      // Should not show any count badge
      expect(screen.queryByText('1 commands')).toBeNull();
      expect(screen.queryByText('1 command')).toBeNull();
    });
  });

  // ── Edit Form Population Variants ──────────────────────────────────

  describe('edit form population variants', () => {
    it('should populate form for multi-terminal script editing', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_multi_edit',
          name: 'Full Stack',
          command: 'npm run dev',
          commands: ['npm run dev'],
          terminals: [
            { name: 'Frontend', commands: ['npm run dev:frontend'] },
            { name: 'Backend', commands: ['npm run dev:backend'] },
          ],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      const editButton = container.querySelector('button[title="Edit script"]');
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Edit Script')).toBeDefined();
        // Should be in multi mode
        expect(screen.getByText('Terminals (2)')).toBeDefined();
        // Terminal names should be populated
        expect(screen.getByDisplayValue('Frontend')).toBeDefined();
        // First terminal expanded by default
        expect(screen.getByDisplayValue('npm run dev:frontend')).toBeDefined();
      });
    });

    it('should populate form for single-terminal script with multiple commands', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_multi_cmd_edit',
          name: 'Setup',
          command: 'npm install',
          commands: ['npm install', 'npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      const editButton = container.querySelector('button[title="Edit script"]');
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Edit Script')).toBeDefined();
        const nameInput = screen.getByPlaceholderText('e.g., Build, Test, Dev') as HTMLInputElement;
        expect(nameInput.value).toBe('Setup');
        expect(screen.getByDisplayValue('npm install')).toBeDefined();
        expect(screen.getByDisplayValue('npm run build')).toBeDefined();
        expect(screen.getByText('Commands (2)')).toBeDefined();
      });
    });

    it('should populate form for single script with empty commands using command field', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_legacy',
          name: 'Legacy',
          command: 'npm start',
          commands: [],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      const editButton = container.querySelector('button[title="Edit script"]');
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Edit Script')).toBeDefined();
        // Should fall back to using script.command when commands array is empty
        expect(screen.getByDisplayValue('npm start')).toBeDefined();
      });
    });

    it('should show Save Changes button when editing', async () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      const editButton = container.querySelector('button[title="Edit script"]');
      fireEvent.click(editButton!);

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeDefined();
      });
    });
  });

  // ── Global Script Display Variants ──────────────────────────────────

  describe('global script display variants', () => {
    it('should show toggle badge on global toggle scripts', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'global_toggle',
          name: 'DB Toggle',
          command: 'docker compose up -d',
          commands: ['docker compose up -d'],
          toggle: {
            firstPressName: 'Start DB',
            firstPressCommand: 'docker compose up -d',
            secondPressName: 'Stop DB',
            secondPressCommand: 'docker compose down',
          },
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('DB Toggle')).toBeDefined();
      expect(screen.getByText('Toggle')).toBeDefined();
      expect(screen.getByText('Start DB / Stop DB')).toBeDefined();
    });

    it('should show terminal count badge on global multi-terminal scripts', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'global_multi',
          name: 'Full Stack',
          command: 'npm run dev',
          commands: ['npm run dev'],
          terminals: [
            { name: 'Frontend', commands: ['npm run dev:frontend'] },
            { name: 'Backend', commands: ['npm run dev:backend'] },
            { name: 'Worker', commands: ['npm run worker'] },
          ],
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('Full Stack')).toBeDefined();
      expect(screen.getByText('3 terminals')).toBeDefined();
      expect(screen.getByText('Frontend, Backend, Worker')).toBeDefined();
    });

    it('should show multi-command count badge on global scripts', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'global_multi_cmd',
          name: 'Clean Install',
          command: 'rm -rf node_modules',
          commands: ['rm -rf node_modules', 'npm install'],
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('Clean Install')).toBeDefined();
      expect(screen.getByText('2 commands')).toBeDefined();
      expect(screen.getByText('rm -rf node_modules && npm install')).toBeDefined();
    });

    it('should show single command global script without count badge', () => {
      mockStoreState.globalScripts = [
        createMockGlobalDevScript({
          id: 'global_single',
          name: 'Format',
          command: 'npm run format',
          commands: ['npm run format'],
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      expect(screen.getByText('Format')).toBeDefined();
      expect(screen.getByText('npm run format')).toBeDefined();
    });
  });

  // ── Disabled States ──────────────────────────────────────────────

  describe('disabled states', () => {
    it('should disable Add Script button when form is open', async () => {
      render(<DevScriptsTool {...defaultProps} />);

      const addButton = screen.getByText('Add Script');
      expect((addButton as HTMLButtonElement).disabled).toBe(false);

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByText('New Script')).toBeDefined();
      });

      // The header Add Script button should now be disabled
      const headerAddButton = screen
        .getAllByRole('button')
        .find(
          (btn) =>
            btn.textContent === 'Add Script' && !btn.parentElement?.classList.contains('gap-2')
        );
      // It should be disabled since the form is open
      expect((headerAddButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('should disable submit button when loading', async () => {
      mockStoreState.loading = true;
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'script_1',
          name: 'Build',
          command: 'npm run build',
          commands: ['npm run build'],
          projectPath: '/test/project/path',
        }),
      ];

      render(<DevScriptsTool {...defaultProps} />);

      // Open add form
      const addButton = screen.getByText('Add Script');
      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByText('New Script')).toBeDefined();
      });

      // The submit button should be disabled when loading
      const submitBtn = findFormSubmitButton();
      expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ── Execute Event Detail ──────────────────────────────────────────

  describe('execute event detail', () => {
    it('should include script and workingDirectory in the custom event detail', async () => {
      const mockScript = createMockDevScript({
        id: 'script_exec',
        name: 'Test Run',
        command: 'npm test',
        commands: ['npm test'],
        projectPath: '/test/project/path',
      });
      mockStoreState.scripts = [mockScript];

      let eventDetail: Record<string, unknown> | null = null;
      const eventListener = (e: Event) => {
        eventDetail = (e as CustomEvent).detail;
      };
      window.addEventListener('execute-dev-script', eventListener);

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      const runButton = container.querySelector('button[title="Run script"]');
      fireEvent.click(runButton!);

      await waitFor(() => {
        expect(eventDetail).not.toBeNull();
        expect((eventDetail as Record<string, unknown>).workingDirectory).toBe(
          '/test/project/path'
        );
        expect(
          ((eventDetail as Record<string, unknown>).script as Record<string, unknown>).name
        ).toBe('Test Run');
      });

      window.removeEventListener('execute-dev-script', eventListener);
    });
  });

  describe('global scripts display', () => {
    it('should show global scripts section when globals exist', () => {
      mockStoreState.globalScripts = createMockGlobalDevScriptsList();

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Global Scripts')).toBeDefined();
    });

    it('should not show global scripts section when no globals', () => {
      mockStoreState.globalScripts = [];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.queryByText('Global Scripts')).toBeNull();
    });

    it('should show Global badge on global scripts', () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Format' })];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Format')).toBeDefined();
      expect(screen.getAllByText('Global').length).toBeGreaterThan(0);
    });

    it('should show global scripts alongside project scripts', () => {
      mockStoreState.scripts = [
        createMockDevScript({
          id: 'p1',
          name: 'Build',
          projectPath: '/test/project/path',
        }),
      ];
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Format' })];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Build')).toBeDefined();
      expect(screen.getByText('Format')).toBeDefined();
      expect(screen.getByText('Global Scripts')).toBeDefined();
    });

    it('should show manage hint for global scripts', () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Format' })];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.getByText('Manage global scripts in Settings')).toBeDefined();
    });

    it('should not show empty state when only global scripts exist', () => {
      mockStoreState.scripts = [];
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Format' })];

      render(<DevScriptsTool {...defaultProps} />);
      expect(screen.queryByText('No scripts yet')).toBeNull();
    });

    it('should dispatch execute event when global script run is clicked', async () => {
      const globalScript = createMockGlobalDevScript({ id: 'g1', name: 'Format' });
      mockStoreState.globalScripts = [globalScript];

      const eventListener = vi.fn();
      window.addEventListener('execute-dev-script', eventListener);

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Global scripts have a run button
      const runButton = container.querySelector('button[title="Run script"]');
      expect(runButton).not.toBeNull();
      fireEvent.click(runButton!);

      await waitFor(() => {
        expect(eventListener).toHaveBeenCalled();
      });

      window.removeEventListener('execute-dev-script', eventListener);
    });

    it('should not show edit or delete buttons for global scripts', () => {
      mockStoreState.globalScripts = [createMockGlobalDevScript({ id: 'g1', name: 'Format' })];

      const { container } = render(<DevScriptsTool {...defaultProps} />);

      // Global scripts should only have Run button, no Edit or Delete
      expect(container.querySelector('button[title="Edit script"]')).toBeNull();
      expect(container.querySelector('button[title="Delete script"]')).toBeNull();
    });
  });
});
