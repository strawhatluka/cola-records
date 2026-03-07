import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock the discord store
const mockSearchGifs = vi.fn();
const mockGetTrendingGifs = vi.fn();

vi.mock('../../../../src/renderer/stores/useDiscordStore', () => ({
  useDiscordStore: () => ({
    searchGifs: mockSearchGifs,
    getTrendingGifs: mockGetTrendingGifs,
  }),
}));

import { GifPicker } from '../../../../src/renderer/components/discord/GifPicker';

const mockGifs = [
  {
    url: 'https://tenor.com/gif1.gif',
    preview: 'https://tenor.com/gif1-preview.gif',
    width: 200,
    height: 200,
  },
  {
    url: 'https://tenor.com/gif2.gif',
    preview: 'https://tenor.com/gif2-preview.gif',
    width: 300,
    height: 200,
  },
];

describe('GifPicker', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetTrendingGifs.mockResolvedValue(mockGifs);
    mockSearchGifs.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // Rendering
  // ============================================
  it('renders search input', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });
    expect(screen.getByPlaceholderText('Search Tenor')).toBeDefined();
  });

  it('renders Tenor attribution', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });
    expect(screen.getByText('Powered by Tenor')).toBeDefined();
  });

  it('renders category buttons on mount', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });
    expect(screen.getByText('Trending')).toBeDefined();
    expect(screen.getByText('Agree')).toBeDefined();
    expect(screen.getByText('Dance')).toBeDefined();
    expect(screen.getByText('Happy')).toBeDefined();
  });

  it('loads trending GIFs on mount', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });
    expect(mockGetTrendingGifs).toHaveBeenCalled();
  });

  // ============================================
  // Standalone vs embedded mode
  // ============================================
  it('renders header with close button in standalone mode', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });
    expect(screen.getByText('GIFs')).toBeDefined();
  });

  it('does not render header in embedded mode', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} embedded />);
    });
    expect(screen.queryByText('GIFs')).toBeNull();
  });

  it('calls onClose when X button clicked in standalone mode', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });
    const closeIcons = screen.getAllByTestId('icon-x');
    fireEvent.click(closeIcons[0].closest('button')!);
    expect(mockOnClose).toHaveBeenCalled();
  });

  // ============================================
  // Category click
  // ============================================
  it('sets search query when category is clicked', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Dance'));
    });

    const input = screen.getByPlaceholderText('Search Tenor') as HTMLInputElement;
    expect(input.value).toBe('dance');
  });

  it('loads trending when Trending category is clicked', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });

    mockGetTrendingGifs.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByText('Trending'));
    });

    expect(mockGetTrendingGifs).toHaveBeenCalled();
  });

  // ============================================
  // Search
  // ============================================
  it('performs debounced search when query changes', async () => {
    mockSearchGifs.mockResolvedValue([
      { url: 'https://tenor.com/search.gif', preview: '', width: 100, height: 100 },
    ]);

    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });

    const input = screen.getByPlaceholderText('Search Tenor');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'cats' } });
    });

    // Search hasn't fired yet (debounced)
    expect(mockSearchGifs).not.toHaveBeenCalled();

    // Advance timer past debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSearchGifs).toHaveBeenCalledWith('cats');
  });

  it('shows "No GIFs found" when search returns empty', async () => {
    mockSearchGifs.mockResolvedValue([]);

    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });

    const input = screen.getByPlaceholderText('Search Tenor');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    });

    // Advance past debounce and flush all pending promises
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    // Flush microtask queue for the async searchGifs result
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('No GIFs found')).toBeDefined();
  });

  it('returns to categories when search is cleared', async () => {
    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });

    const input = screen.getByPlaceholderText('Search Tenor');

    // Type a search — categories hide immediately
    await act(async () => {
      fireEvent.change(input, { target: { value: 'cats' } });
    });

    expect(screen.queryByText('Agree')).toBeNull();

    // Clear search — triggers the query effect which sets showCategories=true
    await act(async () => {
      fireEvent.change(input, { target: { value: '' } });
    });
    // Flush the getTrendingGifs promise from the effect
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Agree')).toBeDefined();
  });

  // ============================================
  // GIF selection
  // ============================================
  it('calls onSelect when a GIF is clicked', async () => {
    mockGetTrendingGifs.mockResolvedValue(mockGifs);

    await act(async () => {
      render(<GifPicker onSelect={mockOnSelect} onClose={mockOnClose} />);
    });

    // Click Trending to leave category view and show gifs
    await act(async () => {
      fireEvent.click(screen.getByText('Trending'));
    });
    // Flush the getTrendingGifs promise
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const images = document.querySelectorAll('img');
    expect(images.length).toBeGreaterThan(0);

    const gifButton = images[0].closest('button');
    expect(gifButton).not.toBeNull();
    fireEvent.click(gifButton!);
    expect(mockOnSelect).toHaveBeenCalledWith('https://tenor.com/gif1.gif');
  });
});
