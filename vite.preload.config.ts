import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
  build: {
    lib: {
      entry: 'src/main/preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    outDir: 'dist/main',
    emptyOutDir: false,
    rollupOptions: {
      external: ['electron'],
    },
  },
});
