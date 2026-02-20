/**
 * Vitest Global Setup
 *
 * Configures the test environment with jsdom, Electron mocks,
 * window.electronAPI mock, and jest-dom matchers.
 *
 * Also includes browser API mocks required by Radix UI components:
 * - PointerEvent (for click/pointer interactions)
 * - ResizeObserver (for component sizing)
 * - DOMRect (for element positioning)
 * - scrollIntoView, hasPointerCapture, releasePointerCapture
 *
 * @see https://www.luisball.com/blog/using-radixui-with-react-testing-library
 * @see https://github.com/radix-ui/primitives/issues/1220
 */
import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ============================================
// electron-log Mocks (used by logger utilities)
// ============================================
const noopLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
  silly: vi.fn(),
  log: vi.fn(),
  transports: {
    file: { level: 'info', maxSize: 10485760 },
    console: { level: 'debug' },
  },
};

vi.mock('electron-log/renderer', () => ({ default: noopLogger }));
vi.mock('electron-log/main', () => ({ default: noopLogger }));

// Guard: only set up window mocks when running in jsdom (window exists)
if (typeof window !== 'undefined') {
  // ============================================
  // Radix UI Browser API Mocks
  // ============================================

  // Mock PointerEvent (required by Radix UI for pointer interactions)
  // JSDOM doesn't support PointerEvent natively
  class MockPointerEvent extends Event {
    button: number;
    ctrlKey: boolean;
    pointerType: string;
    pointerId: number;
    pressure: number;
    clientX: number;
    clientY: number;

    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.button = props.button ?? 0;
      this.ctrlKey = props.ctrlKey ?? false;
      this.pointerType = props.pointerType ?? 'mouse';
      this.pointerId = props.pointerId ?? 1;
      this.pressure = props.pressure ?? 0;
      this.clientX = props.clientX ?? 0;
      this.clientY = props.clientY ?? 0;
    }
  }
  window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;

  // Mock ResizeObserver (required by Radix UI useSize hook)
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

  // Mock DOMRect for getBoundingClientRect
  class MockDOMRect {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    top = 0;
    right = 0;
    bottom = 0;
    left = 0;
    toJSON() {
      return this;
    }
    static fromRect() {
      return new MockDOMRect();
    }
  }
  window.DOMRect = MockDOMRect as unknown as typeof DOMRect;

  // Mock HTMLElement methods used by Radix UI
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.setPointerCapture = vi.fn();

  // ============================================
  // Electron API Mocks
  // ============================================
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
  // Extend the global process object instead of replacing it to preserve process.emit for Vitest
  Object.defineProperty(window, 'process', {
    value: {
      ...globalThis.process,
      platform: 'win32' as NodeJS.Platform,
      env: {
        ...globalThis.process?.env,
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
