// Vitest setup file
import '@testing-library/jest-dom';

// Mock performance.memory for tests (browser-specific API)
if (typeof performance !== 'undefined' && !(performance as any).memory) {
  Object.defineProperty(performance, 'memory', {
    configurable: true,
    enumerable: true,
    get() {
      return {
        jsHeapSizeLimit: 2172649472,
        totalJSHeapSize: 10000000,
        usedJSHeapSize: 10000000,
      };
    },
  });
}

// Mock window.electronAPI for all tests
global.window = global.window || ({} as any);
(global.window as any).electronAPI = {
  invoke: () => Promise.resolve(),
  send: () => {},
  on: () => () => {},
  platform: 'test',
  isDevelopment: false,
};

// Mock DOMMatrix for react-pdf
if (typeof DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

// Mock Canvas for react-pdf
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function() {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: [] }),
      putImageData: () => {},
      createImageData: () => ([]),
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    } as any;
  };
}

// Mock ResizeObserver for react-window
if (typeof ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock window.matchMedia for xterm.js
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
