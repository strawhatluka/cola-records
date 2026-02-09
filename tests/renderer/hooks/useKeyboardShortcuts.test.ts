import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../../src/renderer/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const createKeyEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent => {
    return new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ...modifiers,
    });
  };

  describe('Ctrl+K (search focus)', () => {
    it('calls onSearchFocus on Ctrl+K', () => {
      const onSearchFocus = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSearchFocus }));

      window.dispatchEvent(createKeyEvent('k', { ctrlKey: true }));
      expect(onSearchFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onSearchFocus on Meta+K (Mac)', () => {
      const onSearchFocus = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSearchFocus }));

      window.dispatchEvent(createKeyEvent('k', { metaKey: true }));
      expect(onSearchFocus).toHaveBeenCalledTimes(1);
    });

    it('does not call onSearchFocus without modifier', () => {
      const onSearchFocus = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSearchFocus }));

      window.dispatchEvent(createKeyEvent('k'));
      expect(onSearchFocus).not.toHaveBeenCalled();
    });
  });

  describe('Escape (close modals)', () => {
    it('calls onEscapePress on Escape key', () => {
      const onEscapePress = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onEscapePress }));

      window.dispatchEvent(createKeyEvent('Escape'));
      expect(onEscapePress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ctrl+, (settings)', () => {
    it('calls onSettingsOpen on Ctrl+,', () => {
      const onSettingsOpen = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSettingsOpen }));

      window.dispatchEvent(createKeyEvent(',', { ctrlKey: true }));
      expect(onSettingsOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const onSearchFocus = vi.fn();
      const { unmount } = renderHook(() => useKeyboardShortcuts({ onSearchFocus }));

      unmount();

      window.dispatchEvent(createKeyEvent('k', { ctrlKey: true }));
      expect(onSearchFocus).not.toHaveBeenCalled();
    });
  });

  describe('optional handlers', () => {
    it('does not throw when handlers are undefined', () => {
      renderHook(() => useKeyboardShortcuts({}));

      // Should not throw
      window.dispatchEvent(createKeyEvent('k', { ctrlKey: true }));
      window.dispatchEvent(createKeyEvent('Escape'));
      window.dispatchEvent(createKeyEvent(',', { ctrlKey: true }));
    });
  });
});
