import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// estensione .ts esplicita: vite.config è typecheckato sotto tsconfig.node
// (module: nodenext) che la richiede; allowImportingTsExtensions la permette
import { MAP_STYLE_URL_RE } from './src/pwa/mapStyleCache.ts';

export default defineConfig({
  // GitHub Pages serve l'app da https://<user>.github.io/d-flight-personale/
  base: '/d-flight-personale/',
  plugins: [
    react(),
    VitePWA({
      // niente reload a sorpresa: il SW nuovo resta waiting finché l'utente
      // non conferma dal toast (UpdateToast)
      registerType: 'prompt',
      // la registrazione la fa useRegisterSW (virtual:pwa-register/react):
      // nessuno script registerSW.js auto-iniettato
      injectRegister: false,
      // il manifest è un file statico nostro (public/manifest.webmanifest)
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            // stile mappa CARTO (style/glyphs/sprite/tiles.json) — MAI i tile
            urlPattern: MAP_STYLE_URL_RE,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'carto-style-v1', expiration: { maxEntries: 80 } },
          },
        ],
      },
    }),
  ],
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
    alias: {
      'virtual:pwa-register/react':
        fileURLToPath(new URL('./tests/stubs/pwa-register-react.ts', import.meta.url)),
    },
  },
});
