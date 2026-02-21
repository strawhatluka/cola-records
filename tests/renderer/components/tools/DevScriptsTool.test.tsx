import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockDevScript, createMockToggleScript } from '../../../mocks/dev-scripts.mock';

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
});
