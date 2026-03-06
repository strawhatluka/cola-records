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
  });
});
