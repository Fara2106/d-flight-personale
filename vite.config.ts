import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// estensione .ts esplicita: vite.config è typecheckato sotto tsconfig.node
// (module: nodenext) che la richiede; allowImportingTsExtensions la permette
import { MAP_STYLE_URL_RE, MAP_TILE_URL_RE } from './src/pwa/mapStyleCache.ts';

// identifica la build nel DOM (data-build su App): VITE_BUILD_ID esplicito
// (E2E offline.mjs), altrimenti lo SHA git — così anche in prod si può
// verificare quale build è live (hook E2E post-deploy)
function buildId(): string {
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID;
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return new Date().toISOString(); }
}

// Content-Security-Policy: whitelist stretta delle sole origini che l'app usa
// davvero (basemap CARTO, geocoder Photon; tutto il resto è same-origin). Difesa
// in profondità contro l'iniezione di risorse (il popup usa già solo textContent,
// niente innerHTML). Iniettata SOLO nella build: in dev romperebbe l'HMR di Vite
// (script inline + WebSocket). `frame-ancestors`/X-Frame-Options non sono
// esprimibili via <meta> (servono header HTTP, non disponibili su GitHub Pages).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // MapLibre/React usano stili inline sugli elementi
  "img-src 'self' data: blob: https://*.cartocdn.com https://cartocdn.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:", // union worker (self) + worker interni MapLibre (blob)
  "manifest-src 'self'",
  "connect-src 'self' https://*.cartocdn.com https://cartocdn.com https://photon.komoot.io",
].join('; ');

const cspPlugin: Plugin = {
  name: 'inject-csp-prod',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (ctx.server) return html; // dev: niente CSP
      return html.replace('</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  },
};

export default defineConfig({
  // GitHub Pages serve l'app da https://<user>.github.io/d-flight-personale/
  base: '/d-flight-personale/',
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId()) },
  plugins: [
    cspPlugin,
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
        // il PRIMO SW prende il controllo della pagina appena attivo (senza
        // reload): serve al warmup delle cache mappa (warmMapCache.ts) — senza
        // di esso l'offline funziona solo dalla seconda sessione online (bug
        // test iPhone 2026-07-09). Gli AGGIORNAMENTI restano col flusso
        // prompt: il SW nuovo aspetta il consenso dal toast (skipWaiting off).
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            // stile mappa CARTO (style/glyphs/sprite/tiles.json) — MAI i tile
            urlPattern: MAP_STYLE_URL_RE,
            handler: 'StaleWhileRevalidate',
            // maxAgeSeconds: SWR riaggiorna da solo a ogni visita online, il TTL
            // serve solo a far scadere voci di sessioni mai più rivisitate
            options: {
              cacheName: 'carto-style-v1',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true },
            },
          },
          {
            // tile vettoriali: cache limitata CacheFirst (decisione A rivista) —
            // offline si vede lo sfondo delle aree visitate; il cap per numero
            // ed età tiene la cache piccola e riduce le richieste al CDN
            urlPattern: MAP_TILE_URL_RE,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-tiles-v1',
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
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
