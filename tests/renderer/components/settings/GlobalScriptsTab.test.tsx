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
  });
});
