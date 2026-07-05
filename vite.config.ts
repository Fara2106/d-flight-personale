import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serve l'app da https://<user>.github.io/d-flight-personale/
  base: '/d-flight-personale/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Code-splitting: MapLibre (~80% del bundle) in un chunk separato.
        // L'entry dell'app resta piccola e gli aggiornamenti del nostro codice
        // non invalidano la cache del chunk vendor della mappa.
        advancedChunks: {
          groups: [
            { name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        localstorage: 'memory',
      },
    },
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
