import { defineConfig } from 'vite';

// Electron Forge Vite plugin preload configuration
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
});
