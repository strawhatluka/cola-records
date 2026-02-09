import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
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
