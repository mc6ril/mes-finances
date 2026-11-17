import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    // Juste au-dessus du chunk Firebase (≈ 660 Ko, incompressible) : signale toute croissance anormale.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // À priorité égale, le premier groupe l'emporte. Chaque groupe emporte aussi les dépendances
          // de ses modules : React doit être capturé avant recharts, sinon l'entrée importerait recharts.
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-is|scheduler)[\\/]/ },
            // Firebase (Auth + Firestore) à part : gros, et mis à jour moins souvent que l'application.
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            // recharts et ses dépendances (propres à lui) : chargés seulement par les pages à graphiques.
            {
              name: 'recharts',
              test: /node_modules[\\/](recharts|victory-vendor|d3-[^\\/]+|internmap|@reduxjs|react-redux|redux|redux-thunk|reselect|immer|es-toolkit|decimal\.js-light|eventemitter3|tiny-invariant|use-sync-external-store|clsx)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Exigent l'émulateur Firestore : npm run test:emulator.
    exclude: ['tests/emulator/**', 'node_modules/**'],
  },
});
