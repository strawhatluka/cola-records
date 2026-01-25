// Test setup file for TypeScript test environment

// Suppress unused variable warnings in tests
/* eslint-disable @typescript-eslint/no-unused-vars */

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
