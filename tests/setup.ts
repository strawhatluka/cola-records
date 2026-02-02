/**
 * Vitest Global Setup
 *
 * Configures the test environment with jsdom, Electron mocks,
 * window.electronAPI mock, and jest-dom matchers.
 */
import '@testing-library/jest-dom/vitest';

// Guard: only set up window mocks when running in jsdom (window exists)
if (typeof window !== 'undefined') {
  // Mock window.electronAPI (Electron preload bridge)
  const mockInvoke = vi.fn();
  const mockSend = vi.fn();
  const mockOn = vi.fn(() => vi.fn()); // Returns unsubscribe function

  Object.defineProperty(window, 'electronAPI', {
    value: {
      invoke: mockInvoke,
      send: mockSend,
      on: mockOn,
    },
    writable: true,
  });

  // Mock window.process (Electron preload bridge)
  Object.defineProperty(window, 'process', {
    value: {
      platform: 'win32' as NodeJS.Platform,
      env: {
        NODE_ENV: 'test',
      },
    },
    writable: true,
  });

  // Mock window.matchMedia (used by ThemeProvider)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Reset all mocks between tests
  beforeEach(() => {
    mockInvoke.mockReset();
    mockSend.mockReset();
    mockOn.mockReset().mockImplementation(() => vi.fn());
  });
}
