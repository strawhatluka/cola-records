import { defineConfig } from 'vite';

// Electron Forge Vite plugin worker configuration
// Note: Electron Forge VitePlugin handles outDir automatically
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/workers/contribution-scanner.worker.ts',
      formats: ['cjs'],
      fileName: () => 'contribution-scanner.worker.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'worker_threads',
        'better-sqlite3',
        'simple-git',
        'chokidar',
        'node-pty',
        '@octokit/graphql',
        '@octokit/rest',
        'ignore',
      ],
    },
  },
});
