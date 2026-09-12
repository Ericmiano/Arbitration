import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false, // all files share one MySQL test DB - avoid cross-file truncation races
  },
});
