import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    // Ignore TypeScript errors in test files for now
    typecheck: {
      enabled: false,
    },
  },
});
