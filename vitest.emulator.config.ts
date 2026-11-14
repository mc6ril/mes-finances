import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/** Tests qui exigent l'émulateur Firestore (règles, adapter) : npm run test:emulator. */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/emulator/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
