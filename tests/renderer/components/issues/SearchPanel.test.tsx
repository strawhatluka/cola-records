import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { SearchPanel } from '../../../../src/renderer/components/issues/SearchPanel';

describe('SearchPanel', () => {
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search form elements', () => {
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);
    expect(screen.getByText('Search Issues')).toBeDefined();
    expect(screen.getByPlaceholderText('Search issues...')).toBeDefined();
    expect(screen.getByText('Search')).toBeDefined();
    expect(screen.getByText('Language')).toBeDefined();
    expect(screen.getByText('Minimum Stars')).toBeDefined();
  });

  it('renders label checkboxes with good first issue pre-selected', () => {
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);
    expect(screen.getByText('good first issue')).toBeDefined();
    expect(screen.getByText('beginner-friendly')).toBeDefined();
    expect(screen.getByText('help wanted')).toBeDefined();
    expect(screen.getByText('documentation')).toBeDefined();
  });

  it('calls onSearch with query and labels when Search is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    await user.type(screen.getByPlaceholderText('Search issues...'), 'react hooks');
    await user.click(screen.getByText('Search'));

    expect(mockOnSearch).toHaveBeenCalledWith('react hooks', ['good first issue']);
  });

  it('calls onSearch on Enter key in search input', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    await user.type(screen.getByPlaceholderText('Search issues...'), 'react hooks{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('react hooks', ['good first issue']);
  });

  it('appends stars filter to query', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    await user.type(screen.getByPlaceholderText('Search issues...'), 'test');
    await user.type(screen.getByPlaceholderText('e.g., 100'), '500');
    await user.click(screen.getByText('Search'));

    expect(mockOnSearch).toHaveBeenCalledWith('test stars:>=500', ['good first issue']);
  });

  it('disables Search button when loading', () => {
    render(<SearchPanel onSearch={mockOnSearch} loading={true} />);
    const searchBtn = screen.getByText('Search').closest('button')!;
    expect(searchBtn.hasAttribute('disabled')).toBe(true);
  });

  it('resets filters when Clear Filters is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchPanel onSearch={mockOnSearch} loading={false} />);

    // Type something and change stars
    await user.type(screen.getByPlaceholderText('Search issues...'), 'test');
    await user.type(screen.getByPlaceholderText('e.g., 100'), '500');

    // Click clear
    await user.click(screen.getByText('Clear Filters'));

    // Now search — should have empty query and default labels
    await user.click(screen.getByText('Search'));
    expect(mockOnSearch).toHaveBeenCalledWith('', ['good first issue']);
  });
});
