import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock the child pickers to avoid their complex dependencies
vi.mock('../../../../src/renderer/components/discord/GifPicker', () => ({
  GifPicker: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="gif-picker">{embedded ? 'embedded' : 'standalone'}</div>
  ),
}));

vi.mock('../../../../src/renderer/components/discord/StickerPicker', () => ({
  StickerPicker: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="sticker-picker">{embedded ? 'embedded' : 'standalone'}</div>
  ),
}));

vi.mock('../../../../src/renderer/components/discord/EmojiPicker', () => ({
  EmojiPicker: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="emoji-picker">{embedded ? 'embedded' : 'standalone'}</div>
  ),
}));

import { PickerPanel } from '../../../../src/renderer/components/discord/PickerPanel';

describe('PickerPanel', () => {
  const defaultProps = {
    initialTab: 'gif' as const,
    onSelectGif: vi.fn(),
    onSelectSticker: vi.fn(),
    onSelectEmoji: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tab bar with GIFs, Stickers, Emoji', () => {
    render(<PickerPanel {...defaultProps} />);
    expect(screen.getByText('GIFs')).toBeDefined();
    expect(screen.getByText('Stickers')).toBeDefined();
    expect(screen.getByText('Emoji')).toBeDefined();
  });

  it('renders GifPicker when initialTab is gif', () => {
    render(<PickerPanel {...defaultProps} initialTab="gif" />);
    expect(screen.getByTestId('gif-picker')).toBeDefined();
    expect(screen.queryByTestId('sticker-picker')).toBeNull();
    expect(screen.queryByTestId('emoji-picker')).toBeNull();
  });

  it('renders StickerPicker when initialTab is sticker', () => {
    render(<PickerPanel {...defaultProps} initialTab="sticker" />);
    expect(screen.getByTestId('sticker-picker')).toBeDefined();
    expect(screen.queryByTestId('gif-picker')).toBeNull();
  });

  it('renders EmojiPicker when initialTab is emoji', () => {
    render(<PickerPanel {...defaultProps} initialTab="emoji" />);
    expect(screen.getByTestId('emoji-picker')).toBeDefined();
    expect(screen.queryByTestId('gif-picker')).toBeNull();
  });

  it('switches to Stickers tab on click', () => {
    render(<PickerPanel {...defaultProps} initialTab="gif" />);
    expect(screen.getByTestId('gif-picker')).toBeDefined();

    fireEvent.click(screen.getByText('Stickers'));
    expect(screen.getByTestId('sticker-picker')).toBeDefined();
    expect(screen.queryByTestId('gif-picker')).toBeNull();
  });

  it('switches to Emoji tab on click', () => {
    render(<PickerPanel {...defaultProps} initialTab="gif" />);
    fireEvent.click(screen.getByText('Emoji'));
    expect(screen.getByTestId('emoji-picker')).toBeDefined();
  });

  it('switches back to GIFs tab on click', () => {
    render(<PickerPanel {...defaultProps} initialTab="sticker" />);
    expect(screen.getByTestId('sticker-picker')).toBeDefined();

    fireEvent.click(screen.getByText('GIFs'));
    expect(screen.getByTestId('gif-picker')).toBeDefined();
  });

  it('calls onClose when X button is clicked', () => {
    render(<PickerPanel {...defaultProps} />);
    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('passes embedded=true to child pickers', () => {
    render(<PickerPanel {...defaultProps} initialTab="gif" />);
    expect(screen.getByTestId('gif-picker').textContent).toBe('embedded');
  });
});
