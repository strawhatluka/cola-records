import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/workers/contribution-scanner.worker.ts',
      formats: ['cjs'],
      fileName: () => 'contribution-scanner.worker.js',
    },
    outDir: 'dist/workers',
    emptyOutDir: true,
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
