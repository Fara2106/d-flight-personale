<!-- e2e/README.md -->
# E2E — Fase 2

Verifica end-to-end con Playwright headless (browser già in cache in
`~/Library/Caches/ms-playwright`).

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
node e2e/run.mjs
```

Playwright non è in `package.json` di proposito (CI non deve scaricare browser).
La fixture è centrata su ITALY_CENTER (12.5, 42.0): il click al centro del
canvas 1280×800 colpisce le zone sintetiche senza bisogno di geocoding.
