# D-Flight personale — Fase 1: Mappa zone (viewer) — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire la "mappa nuda e cruda" funzionante: importi il file ufficiale ED-269, vedi le zone geografiche UAS colorate per restrizione con la quota massima in etichetta, tocchi una zona per il dettaglio, cerchi un luogo e vedi la tua posizione GPS — tutto con tema chiaro/scuro/sistema.

**Architecture:** PWA React 100% statica (nessun backend, nessun account). I dati ED-269 importati vengono validati, normalizzati in un modello `Zone[]` interno e salvati in IndexedDB; la mappa MapLibre rende le zone da una `FeatureCollection` derivata. Tutta la logica non-grafica vive in funzioni pure testabili; il componente mappa resta sottile.

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS, MapLibre GL JS, `idb` (IndexedDB), `@turf/circle` (conversione cerchi→poligoni), Vitest + @testing-library/react + jsdom + fake-indexeddb. Mappa keyless: CARTO **Positron** (chiaro) / **Dark Matter** (scuro). Ricerca: **Photon** (keyless).

## Global Constraints

Ogni task eredita implicitamente questi vincoli (valori dalla specifica `docs/superpowers/specs/2026-06-30-dflight-personale-design.md`):

- **App non ufficiale**: disclaimer evidente + link "verifica su D-Flight / AIP" sempre accessibile.
- **Nessun backend, nessun account, nessuna credenziale.** 100% client statico.
- **Dati locali** in IndexedDB. (L'offline completo è Fase 3; in Fase 1 i dati persistono già tra le sessioni.)
- **Provider keyless**: mappa CARTO `positron-gl-style` (chiaro) / `dark-matter-gl-style` (scuro); geocoder Photon (`https://photon.komoot.io`). **Attribuzione OSM + CARTO sempre visibile** sulla mappa.
- **Estetica stile B**: tema Chiaro / Scuro / Sistema; accento blu `#007aff` (chiaro) / `#0a84ff` (scuro); esiti/colori zone verde / giallo / arancio / rosso; tipografia ampia (niente testo spezzato a capo nelle schede).
- **Quota in metri**, con riferimento **AGL/AMSL** mostrato nel dettaglio; **quota massima in etichetta su ogni zona** nella mappa base.
- **Colori zone**: `prohibited` rosso `#ef4444` · `auth_required` arancio `#f59e0b` · `conditional` giallo `#eab308` · `none` verde `#22c55e`.
- **Lingua UI: italiano.**
- **Node ≥ 18**, package manager **npm**.

---

## File structure (Fase 1)

```
package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, index.html
src/main.tsx                 # entry React
src/App.tsx                  # composizione UI (stile B)
src/index.css                # Tailwind + variabili tema (token stile B)
src/theme/useTheme.ts        # stato tema light/dark/system, persistito, applica classe
src/theme/ThemeToggle.tsx    # interruttore a 3 stati
src/data/ed269.types.ts      # tipi raw ED-269 + tipo interno Zone + DatasetMeta + ZoneDiff
src/data/parseEd269.ts       # JSON.parse + validazione struttura -> Ed269Document
src/data/normalizeZones.ts   # Ed269Document -> Zone[] (mappa restrizioni, geometrie, limiti)
src/data/diffZones.ts        # diff prev vs next -> {added, modified, removed}
src/data/zoneStore.ts        # IndexedDB: saveDataset / loadZones / loadMeta
src/data/importDataset.ts    # orchestratore: parse->normalize->diff(vs store)->save
src/map/altitudeLabel.ts     # Zone -> etichetta quota ("120 m" / "⛔ 0 m")
src/map/zonesToGeoJSON.ts    # Zone[] -> FeatureCollection per la mappa
src/map/mapStyle.ts          # URL stile per tema + definizioni layer zone
src/map/MapView.tsx          # MapLibre: stile, source/layer zone, popup, attribuzione
src/search/geocode.ts        # fetch Photon -> GeocodeResult[]
src/search/SearchBox.tsx     # UI ricerca
src/location/useGeolocation.ts  # hook navigator.geolocation
src/location/LocateButton.tsx   # pulsante "centra su di me" + marker posizione
src/ui/ImportButton.tsx      # import file (picker + drag-drop)
src/ui/Legend.tsx            # legenda colori + quota
src/ui/DataStatusBanner.tsx  # data ciclo + staleness (isStale)
src/ui/EmptyState.tsx        # onboarding quando non ci sono dati
src/ui/Disclaimer.tsx        # avviso "non ufficiale" + link ufficiali
tests/**                     # specchio di src per i file con logica pura
```

---

## Task 1: Scaffold progetto (Vite + React + TS + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: progetto eseguibile (`npm run dev`), test runner (`npm test`), `App` componente radice.

- [ ] **Step 1: Crea il progetto Vite React-TS**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
```
Se la cartella non è vuota, conferma di procedere mantenendo i file esistenti (`docs/`, `.gitignore`).

- [ ] **Step 2: Installa dipendenze runtime e dev**

Run:
```bash
npm install maplibre-gl idb @turf/circle
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom fake-indexeddb @types/geojson
npx tailwindcss init -p
```

- [ ] **Step 3: Configura Tailwind** — sostituisci `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 4: Token tema stile B** — sostituisci `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #f5f6f8; --surface: #ffffff; --text: #1c2530; --text-muted: #8a93a0;
  --accent: #007aff; --shadow: 0 10px 28px rgba(30,60,90,.18);
}
[data-theme='dark'] {
  --bg: #0f141b; --surface: #1f2630; --text: #e8edf3; --text-muted: #8a93a0;
  --accent: #0a84ff; --shadow: 0 12px 30px rgba(0,0,0,.5);
}
html, body, #root { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--text);
  font-family: -apple-system, system-ui, 'SF Pro', sans-serif; }
```

- [ ] **Step 5: Configura Vitest** — modifica `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
```

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

Aggiungi a `package.json` negli `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 6: Test di smoke** — `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => {
  it('runs the test environment', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 7: Esegui i test**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 8: App minima** — sostituisci `src/App.tsx`:

```tsx
export default function App() {
  return <div data-testid="app-root">D-Flight personale</div>;
}
```
Verifica che `npm run dev` apra l'app senza errori.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+React+TS with Tailwind and Vitest"
```

---

## Task 2: Tema (light / dark / system)

**Files:**
- Create: `src/theme/useTheme.ts`, `src/theme/ThemeToggle.tsx`
- Test: `tests/theme/useTheme.test.ts`

**Interfaces:**
- Produces:
  - `type ThemePref = 'light' | 'dark' | 'system'`
  - `useTheme(): { theme: ThemePref; resolved: 'light' | 'dark'; setTheme(p: ThemePref): void }`
  - applica `document.documentElement.dataset.theme = resolved` e persiste in `localStorage['theme']`.

- [ ] **Step 1: Test del resolver e persistenza** — `tests/theme/useTheme.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../src/theme/useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('dark'), media: q,
    addEventListener: () => {}, removeEventListener: () => {},
  }));
});

it('defaults to system and resolves from matchMedia', () => {
  const { result } = renderHook(() => useTheme());
  expect(result.current.theme).toBe('system');
  expect(result.current.resolved).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it('persists explicit choice and applies it', () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current.setTheme('light'));
  expect(localStorage.getItem('theme')).toBe('light');
  expect(result.current.resolved).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/theme/useTheme.test.ts`
Expected: FAIL ("Cannot find module .../useTheme").

- [ ] **Step 3: Implementa** — `src/theme/useTheme.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
export type ThemePref = 'light' | 'dark' | 'system';

function systemDark(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-color-scheme: dark)').matches;
}
function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return systemDark() ? 'dark' : 'light';
  return pref;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>(
    () => (localStorage.getItem('theme') as ThemePref) || 'system'
  );
  const resolved = resolve(theme);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setTheme = useCallback((p: ThemePref) => {
    localStorage.setItem('theme', p);
    setThemeState(p);
  }, []);

  return { theme, resolved, setTheme };
}
```
> Nota: l'import corretto è `import { useCallback, useEffect, useState } from 'react'`.

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/theme/useTheme.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Interruttore** — `src/theme/ThemeToggle.tsx`:

```tsx
import { ThemePref } from './useTheme';
const OPTS: { key: ThemePref; label: string }[] = [
  { key: 'light', label: '☀️ Chiaro' },
  { key: 'dark', label: '🌙 Scuro' },
  { key: 'system', label: '🖥️ Sistema' },
];
export function ThemeToggle({ value, onChange }:
  { value: ThemePref; onChange: (p: ThemePref) => void }) {
  return (
    <div role="group" aria-label="Tema" className="inline-flex gap-1 rounded-xl p-1"
         style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
      {OPTS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className="rounded-lg px-3 py-1.5 text-sm whitespace-nowrap"
          style={value === o.key
            ? { color: '#fff', background: 'var(--accent)' }
            : { color: 'var(--text-muted)' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/theme tests/theme
git commit -m "feat(theme): light/dark/system theme with persistence and toggle"
```

---

## Task 3: Tipi ED-269 + parser/validatore

**Files:**
- Create: `src/data/ed269.types.ts`, `src/data/parseEd269.ts`
- Test: `tests/data/parseEd269.test.ts`

**Interfaces:**
- Produces:
  - tipi: `RestrictionType`, `Zone`, `DatasetMeta`, `ZoneDiff`, `Ed269Document`, `Ed269Feature`
  - `parseEd269(input: string | unknown): Ed269Document` — lancia `Ed269ParseError` se la struttura non è valida.

- [ ] **Step 1: Test** — `tests/data/parseEd269.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseEd269, Ed269ParseError } from '../../src/data/parseEd269';

const valid = JSON.stringify({
  features: [{
    identifier: 'ITA-001', name: 'CTR Roma', restriction: 'PROHIBITED',
    geometry: [{ horizontalProjection: { type: 'Polygon',
      coordinates: [[[12.5,41.8],[12.6,41.8],[12.6,41.9],[12.5,41.8]]] },
      lowerLimit: 0, upperLimit: 0, uomDimensions: 'M' }],
  }],
});

it('parses a valid ED-269 document (string)', () => {
  const doc = parseEd269(valid);
  expect(doc.features).toHaveLength(1);
  expect(doc.features[0].name).toBe('CTR Roma');
});
it('parses an already-parsed object', () => {
  expect(parseEd269(JSON.parse(valid)).features).toHaveLength(1);
});
it('throws on invalid JSON', () => {
  expect(() => parseEd269('{not json')).toThrow(Ed269ParseError);
});
it('throws when features array is missing', () => {
  expect(() => parseEd269('{"foo":1}')).toThrow(Ed269ParseError);
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/data/parseEd269.test.ts`
Expected: FAIL (modulo non trovato).

- [ ] **Step 3: Tipi** — `src/data/ed269.types.ts`:

```ts
import type { Polygon, MultiPolygon } from 'geojson';

export type RestrictionType = 'prohibited' | 'auth_required' | 'conditional' | 'none';

export interface Zone {
  id: string;
  name: string;
  restrictionType: RestrictionType;
  geometry: Polygon | MultiPolygon;
  lowerLimitM: number | null;
  upperLimitM: number | null;
  verticalRef: 'AGL' | 'AMSL' | 'WGS84' | null;
  message: string | null;
  reasons: string[];
  authority: { name?: string; email?: string; phone?: string } | null;
  permanent: boolean;
}

export interface DatasetMeta {
  cycleDate: string | null;   // ISO (se ricavabile dal file)
  importedAt: string;         // ISO
  zoneCount: number;
}

export interface ZoneDiff { added: Zone[]; modified: Zone[]; removed: Zone[]; }

export interface Ed269Volume {
  horizontalProjection: any;        // Polygon o Circle (gestito nel normalizer)
  lowerLimit?: number; upperLimit?: number;
  lowerVerticalReference?: string; upperVerticalReference?: string;
  uomDimensions?: string;
}
export interface Ed269Feature {
  identifier?: string; name?: string; restriction?: string;
  reason?: string[]; message?: string;
  geometry?: Ed269Volume[];
  applicability?: any[]; zoneAuthority?: any[] | any;
}
export interface Ed269Document {
  features: Ed269Feature[];
  [k: string]: unknown;
}
```

- [ ] **Step 4: Parser** — `src/data/parseEd269.ts`:

```ts
import type { Ed269Document } from './ed269.types';

export class Ed269ParseError extends Error {}

export function parseEd269(input: string | unknown): Ed269Document {
  let obj: any;
  if (typeof input === 'string') {
    try { obj = JSON.parse(input); }
    catch { throw new Ed269ParseError('File non valido: JSON non leggibile.'); }
  } else { obj = input; }

  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.features)) {
    throw new Ed269ParseError(
      'Struttura non riconosciuta: manca l\'elenco "features" del formato ED-269.'
    );
  }
  return obj as Ed269Document;
}
```

- [ ] **Step 5: Esegui — deve passare**

Run: `npx vitest run tests/data/parseEd269.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Commit**

```bash
git add src/data/ed269.types.ts src/data/parseEd269.ts tests/data/parseEd269.test.ts
git commit -m "feat(data): ED-269 types and parser with validation"
```

---

## Task 4: Normalizzatore (ED-269 → Zone[])

**Files:**
- Create: `src/data/normalizeZones.ts`
- Test: `tests/data/normalizeZones.test.ts`

**Interfaces:**
- Consumes: `Ed269Document`, `Zone` (Task 3); `circle` da `@turf/circle`.
- Produces: `normalizeZones(doc: Ed269Document): Zone[]`.

- [ ] **Step 1: Test** — `tests/data/normalizeZones.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeZones } from '../../src/data/normalizeZones';
import type { Ed269Document } from '../../src/data/ed269.types';

const doc: Ed269Document = { features: [
  { identifier: 'A1', name: 'Vietata', restriction: 'PROHIBITED',
    reason: ['AIR_TRAFFIC'], message: 'no',
    geometry: [{ horizontalProjection: { type: 'Polygon',
      coordinates: [[[12.5,41.8],[12.6,41.8],[12.6,41.9],[12.5,41.8]]] },
      lowerLimit: 0, upperLimit: 0, upperVerticalReference: 'AGL', uomDimensions: 'M' }],
    applicability: [{ permanent: 'YES' }],
    zoneAuthority: [{ name: 'ENAC', email: 'x@enac.it' }] },
  { identifier: 'A2', name: 'Auth', restriction: 'REQ_AUTHORISATION',
    geometry: [{ horizontalProjection: { type: 'Circle',
      center: [9.19, 45.46], radius: 1000 },
      upperLimit: 45, upperVerticalReference: 'AGL', uomDimensions: 'M' }] },
] };

it('maps restriction enum to internal type', () => {
  const z = normalizeZones(doc);
  expect(z[0].restrictionType).toBe('prohibited');
  expect(z[1].restrictionType).toBe('auth_required');
});
it('keeps polygon geometry and limits', () => {
  const z = normalizeZones(doc)[0];
  expect(z.geometry.type).toBe('Polygon');
  expect(z.upperLimitM).toBe(0);
  expect(z.verticalRef).toBe('AGL');
  expect(z.authority?.name).toBe('ENAC');
  expect(z.permanent).toBe(true);
});
it('converts a Circle projection to a Polygon', () => {
  const z = normalizeZones(doc)[1];
  expect(z.geometry.type).toBe('Polygon');
  expect(z.geometry.coordinates[0].length).toBeGreaterThan(10);
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/data/normalizeZones.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/data/normalizeZones.ts`:

```ts
import circle from '@turf/circle';
import type { Polygon, MultiPolygon } from 'geojson';
import type { Ed269Document, Ed269Feature, Ed269Volume, Zone, RestrictionType } from './ed269.types';

const RESTRICTION: Record<string, RestrictionType> = {
  PROHIBITED: 'prohibited',
  REQ_AUTHORISATION: 'auth_required',
  CONDITIONAL: 'conditional',
  NO_RESTRICTION: 'none',
};

function toMeters(v: number | undefined, uom?: string): number | null {
  if (v == null) return null;
  return uom === 'FT' ? Math.round(v * 0.3048) : v;
}

function geometryOf(vol: Ed269Volume | undefined, uom?: string): Polygon | MultiPolygon | null {
  const hp = vol?.horizontalProjection;
  if (!hp) return null;
  if (hp.type === 'Polygon') return { type: 'Polygon', coordinates: hp.coordinates };
  if (hp.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: hp.coordinates };
  if (hp.type === 'Circle' && Array.isArray(hp.center) && typeof hp.radius === 'number') {
    const radiusKm = (uom === 'FT' ? hp.radius * 0.3048 : hp.radius) / 1000;
    return circle(hp.center, radiusKm, { steps: 48, units: 'kilometers' }).geometry as Polygon;
  }
  return null;
}

function authorityOf(f: Ed269Feature) {
  const a = Array.isArray(f.zoneAuthority) ? f.zoneAuthority[0] : f.zoneAuthority;
  if (!a) return null;
  return { name: a.name, email: a.email, phone: a.phone };
}

export function normalizeZones(doc: Ed269Document): Zone[] {
  const zones: Zone[] = [];
  doc.features.forEach((f, i) => {
    const vol = f.geometry?.[0];
    const geometry = geometryOf(vol, vol?.uomDimensions);
    if (!geometry) return; // scarta feature senza geometria utilizzabile
    const applic = Array.isArray(f.applicability) ? f.applicability[0] : undefined;
    zones.push({
      id: f.identifier || `zone-${i}`,
      name: f.name || 'Zona senza nome',
      restrictionType: RESTRICTION[(f.restriction || '').toUpperCase()] ?? 'conditional',
      geometry,
      lowerLimitM: toMeters(vol?.lowerLimit, vol?.uomDimensions),
      upperLimitM: toMeters(vol?.upperLimit, vol?.uomDimensions),
      verticalRef: (vol?.upperVerticalReference as Zone['verticalRef']) ?? null,
      message: f.message ?? null,
      reasons: Array.isArray(f.reason) ? f.reason : [],
      authority: authorityOf(f),
      permanent: applic?.permanent === 'YES' || applic?.permanent === true || !applic,
    });
  });
  return zones;
}
```
> Limitazione nota (rischio §15): si usa solo il primo volume per feature. Gestione multi-volume rinviata.

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/data/normalizeZones.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/data/normalizeZones.ts tests/data/normalizeZones.test.ts
git commit -m "feat(data): normalize ED-269 features into internal Zone model"
```

---

## Task 5: Diff zone

**Files:**
- Create: `src/data/diffZones.ts`
- Test: `tests/data/diffZones.test.ts`

**Interfaces:**
- Consumes: `Zone`, `ZoneDiff` (Task 3).
- Produces: `diffZones(prev: Zone[], next: Zone[]): ZoneDiff`. "modified" = stesso `id` con contenuto diverso (confronto JSON stabile).

- [ ] **Step 1: Test** — `tests/data/diffZones.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { diffZones } from '../../src/data/diffZones';
import type { Zone } from '../../src/data/ed269.types';

const z = (id: string, upper: number | null): Zone => ({
  id, name: id, restrictionType: 'none',
  geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] },
  lowerLimitM: 0, upperLimitM: upper, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true,
});

it('detects added, removed and modified zones', () => {
  const prev = [z('a', 120), z('b', 60)];
  const next = [z('a', 120), z('b', 90), z('c', 30)];
  const d = diffZones(prev, next);
  expect(d.added.map(x => x.id)).toEqual(['c']);
  expect(d.removed.map(x => x.id)).toEqual([]);
  expect(d.modified.map(x => x.id)).toEqual(['b']);
});
it('handles empty previous (first import)', () => {
  const d = diffZones([], [z('a', 120)]);
  expect(d.added).toHaveLength(1);
  expect(d.modified).toHaveLength(0);
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/data/diffZones.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/data/diffZones.ts`:

```ts
import type { Zone, ZoneDiff } from './ed269.types';

const fingerprint = (z: Zone) => JSON.stringify([
  z.name, z.restrictionType, z.lowerLimitM, z.upperLimitM,
  z.verticalRef, z.message, z.reasons, z.geometry,
]);

export function diffZones(prev: Zone[], next: Zone[]): ZoneDiff {
  const prevById = new Map(prev.map(z => [z.id, z]));
  const nextIds = new Set(next.map(z => z.id));
  const added: Zone[] = [], modified: Zone[] = [];
  for (const z of next) {
    const old = prevById.get(z.id);
    if (!old) added.push(z);
    else if (fingerprint(old) !== fingerprint(z)) modified.push(z);
  }
  const removed = prev.filter(z => !nextIds.has(z.id));
  return { added, modified, removed };
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/data/diffZones.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add src/data/diffZones.ts tests/data/diffZones.test.ts
git commit -m "feat(data): zone diffing (added/modified/removed)"
```

---

## Task 6: Archivio IndexedDB (zoneStore)

**Files:**
- Create: `src/data/zoneStore.ts`
- Test: `tests/data/zoneStore.test.ts`

**Interfaces:**
- Consumes: `Zone`, `DatasetMeta` (Task 3); `openDB` da `idb`.
- Produces:
  - `saveDataset(zones: Zone[], meta: DatasetMeta): Promise<void>`
  - `loadZones(): Promise<Zone[]>`
  - `loadMeta(): Promise<DatasetMeta | null>`

- [ ] **Step 1: Test** — `tests/data/zoneStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveDataset, loadZones, loadMeta } from '../../src/data/zoneStore';
import type { Zone } from '../../src/data/ed269.types';

const z: Zone = { id: 'a', name: 'A', restrictionType: 'none',
  geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] },
  lowerLimitM: 0, upperLimitM: 120, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true };

beforeEach(async () => {
  indexedDB = new IDBFactory(); // reset DB tra i test
});

it('returns empty/null before any import', async () => {
  expect(await loadZones()).toEqual([]);
  expect(await loadMeta()).toBeNull();
});
it('saves and loads zones and meta', async () => {
  const meta = { cycleDate: '2026-06-26', importedAt: '2026-06-30T10:00:00Z', zoneCount: 1 };
  await saveDataset([z], meta);
  expect(await loadZones()).toHaveLength(1);
  expect((await loadMeta())?.zoneCount).toBe(1);
});
it('replaces the dataset on re-import', async () => {
  await saveDataset([z], { cycleDate: null, importedAt: 'x', zoneCount: 1 });
  await saveDataset([], { cycleDate: null, importedAt: 'y', zoneCount: 0 });
  expect(await loadZones()).toEqual([]);
});
```
> Nota: `IDBFactory` è fornito da `fake-indexeddb/auto`. Aggiungi `declare const IDBFactory: any;` in cima al test se TS si lamenta.

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/data/zoneStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/data/zoneStore.ts`:

```ts
import { openDB, type DBSchema } from 'idb';
import type { Zone, DatasetMeta } from './ed269.types';

interface DflSchema extends DBSchema {
  zones: { key: string; value: Zone };
  meta: { key: string; value: DatasetMeta };
}
const DB = 'dfl-personale', VER = 1, META_KEY = 'dataset';

const db = () => openDB<DflSchema>(DB, VER, {
  upgrade(d) {
    if (!d.objectStoreNames.contains('zones')) d.createObjectStore('zones', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
  },
});

export async function saveDataset(zones: Zone[], meta: DatasetMeta): Promise<void> {
  const d = await db();
  const tx = d.transaction(['zones', 'meta'], 'readwrite');
  await tx.objectStore('zones').clear();
  for (const z of zones) await tx.objectStore('zones').put(z);
  await tx.objectStore('meta').put(meta, META_KEY);
  await tx.done;
}
export async function loadZones(): Promise<Zone[]> {
  return (await db()).getAll('zones');
}
export async function loadMeta(): Promise<DatasetMeta | null> {
  return (await (await db()).get('meta', META_KEY)) ?? null;
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/data/zoneStore.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/data/zoneStore.ts tests/data/zoneStore.test.ts
git commit -m "feat(data): IndexedDB store for zones and dataset meta"
```

---

## Task 7: Orchestratore import + pulsante import

**Files:**
- Create: `src/data/importDataset.ts`, `src/ui/ImportButton.tsx`
- Test: `tests/data/importDataset.test.ts`

**Interfaces:**
- Consumes: `parseEd269`, `normalizeZones`, `diffZones`, `loadZones`, `saveDataset` (Task 3–6).
- Produces: `importDataset(input: string | unknown): Promise<{ meta: DatasetMeta; diff: ZoneDiff }>`.
  Ricava `cycleDate` da `input` se presente (`obj.cycleDate`/`obj.validFrom`), altrimenti `null`.

- [ ] **Step 1: Test** — `tests/data/importDataset.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { importDataset } from '../../src/data/importDataset';
import { loadZones } from '../../src/data/zoneStore';

const file = (name: string) => JSON.stringify({ features: [{
  identifier: name, name, restriction: 'PROHIBITED',
  geometry: [{ horizontalProjection: { type: 'Polygon',
    coordinates: [[[12.5,41.8],[12.6,41.8],[12.6,41.9],[12.5,41.8]]] },
    upperLimit: 0, uomDimensions: 'M' }] }] });

beforeEach(() => { indexedDB = new IDBFactory(); });

it('first import stores zones and reports all as added', async () => {
  const r = await importDataset(file('Z1'));
  expect(r.meta.zoneCount).toBe(1);
  expect(r.diff.added).toHaveLength(1);
  expect(await loadZones()).toHaveLength(1);
});
it('re-import computes diff against stored zones', async () => {
  await importDataset(file('Z1'));
  const r = await importDataset(file('Z2'));
  expect(r.diff.added.map(z => z.id)).toEqual(['Z2']);
  expect(r.diff.removed.map(z => z.id)).toEqual(['Z1']);
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/data/importDataset.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/data/importDataset.ts`:

```ts
import { parseEd269 } from './parseEd269';
import { normalizeZones } from './normalizeZones';
import { diffZones } from './diffZones';
import { loadZones, saveDataset } from './zoneStore';
import type { DatasetMeta, ZoneDiff } from './ed269.types';

export async function importDataset(
  input: string | unknown
): Promise<{ meta: DatasetMeta; diff: ZoneDiff }> {
  const doc = parseEd269(input);
  const next = normalizeZones(doc);
  const prev = await loadZones();
  const diff = diffZones(prev, next);
  const raw: any = doc;
  const meta: DatasetMeta = {
    cycleDate: raw.cycleDate ?? raw.validFrom ?? null,
    importedAt: new Date().toISOString(),
    zoneCount: next.length,
  };
  await saveDataset(next, meta);
  return { meta, diff };
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/data/importDataset.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Pulsante import (picker + drag-drop)** — `src/ui/ImportButton.tsx`:

```tsx
import { useRef } from 'react';
import { importDataset } from '../data/importDataset';
import type { DatasetMeta, ZoneDiff } from '../data/ed269.types';

export function ImportButton(
  { onDone, onError }:
  { onDone: (r: { meta: DatasetMeta; diff: ZoneDiff }) => void;
    onError: (msg: string) => void }
) {
  const input = useRef<HTMLInputElement>(null);
  async function handle(file: File) {
    try { onDone(await importDataset(await file.text())); }
    catch (e) { onError(e instanceof Error ? e.message : 'Import non riuscito'); }
  }
  return (
    <div onDragOver={e => e.preventDefault()}
         onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f); }}>
      <input ref={input} type="file" accept=".json,application/json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <button onClick={() => input.current?.click()}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: 'var(--accent)' }}>
        Importa file zone (ED-269)
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/data/importDataset.ts src/ui/ImportButton.tsx tests/data/importDataset.test.ts
git commit -m "feat(data): import orchestrator and import button"
```

---

## Task 8: Trasformazioni mappa (etichetta quota + GeoJSON)

**Files:**
- Create: `src/map/altitudeLabel.ts`, `src/map/zonesToGeoJSON.ts`
- Test: `tests/map/altitudeLabel.test.ts`, `tests/map/zonesToGeoJSON.test.ts`

**Interfaces:**
- Consumes: `Zone` (Task 3).
- Produces:
  - `altitudeLabel(z: Zone): string`
  - `zonesToGeoJSON(zones: Zone[]): GeoJSON.FeatureCollection` con `properties` `{ id, name, restrictionType, label }`.

- [ ] **Step 1: Test etichetta** — `tests/map/altitudeLabel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { altitudeLabel } from '../../src/map/altitudeLabel';
import type { Zone } from '../../src/data/ed269.types';
const base: Zone = { id:'a', name:'a', restrictionType:'none',
  geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]},
  lowerLimitM:0, upperLimitM:120, verticalRef:'AGL',
  message:null, reasons:[], authority:null, permanent:true };

it('shows max altitude in meters', () => {
  expect(altitudeLabel({ ...base, upperLimitM: 120 })).toBe('120 m');
});
it('shows a no-fly label for prohibited zones', () => {
  expect(altitudeLabel({ ...base, restrictionType: 'prohibited', upperLimitM: 0 })).toBe('⛔ 0 m');
});
it('falls back when altitude is unknown', () => {
  expect(altitudeLabel({ ...base, upperLimitM: null })).toBe('—');
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/map/altitudeLabel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/map/altitudeLabel.ts`:

```ts
import type { Zone } from '../data/ed269.types';
export function altitudeLabel(z: Zone): string {
  if (z.restrictionType === 'prohibited') return '⛔ 0 m';
  if (z.upperLimitM == null) return '—';
  return `${z.upperLimitM} m`;
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/map/altitudeLabel.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Test GeoJSON** — `tests/map/zonesToGeoJSON.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { zonesToGeoJSON } from '../../src/map/zonesToGeoJSON';
import type { Zone } from '../../src/data/ed269.types';
const z: Zone = { id:'a', name:'Vietata', restrictionType:'prohibited',
  geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]},
  lowerLimitM:0, upperLimitM:0, verticalRef:'AGL',
  message:null, reasons:[], authority:null, permanent:true };

it('produces a FeatureCollection with display properties', () => {
  const fc = zonesToGeoJSON([z]);
  expect(fc.type).toBe('FeatureCollection');
  expect(fc.features[0].properties).toMatchObject({
    id: 'a', name: 'Vietata', restrictionType: 'prohibited', label: '⛔ 0 m',
  });
});
```

- [ ] **Step 6: Implementa** — `src/map/zonesToGeoJSON.ts`:

```ts
import type { FeatureCollection } from 'geojson';
import type { Zone } from '../data/ed269.types';
import { altitudeLabel } from './altitudeLabel';

export function zonesToGeoJSON(zones: Zone[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: zones.map(z => ({
      type: 'Feature',
      geometry: z.geometry,
      properties: {
        id: z.id, name: z.name, restrictionType: z.restrictionType,
        label: altitudeLabel(z),
        upperLimitM: z.upperLimitM, verticalRef: z.verticalRef,
        message: z.message,
      },
    })),
  };
}
```

- [ ] **Step 7: Esegui entrambi i test — devono passare**

Run: `npx vitest run tests/map/`
Expected: PASS (4 test).

- [ ] **Step 8: Commit**

```bash
git add src/map/altitudeLabel.ts src/map/zonesToGeoJSON.ts tests/map/
git commit -m "feat(map): altitude label and zones->GeoJSON transforms"
```

---

## Task 9: Stile mappa + componente MapView (base)

**Files:**
- Create: `src/map/mapStyle.ts`, `src/map/MapView.tsx`
- Test: `tests/map/mapStyle.test.ts`

**Interfaces:**
- Consumes: `maplibre-gl`.
- Produces:
  - `mapStyleUrl(theme: 'light' | 'dark'): string`
  - `ZONE_COLORS: Record<RestrictionType, string>`
  - `MapView` componente che riceve `{ resolvedTheme: 'light'|'dark' }` e monta MapLibre centrato sull'Italia con attribuzione.

- [ ] **Step 1: Test stile** — `tests/map/mapStyle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapStyleUrl, ZONE_COLORS } from '../../src/map/mapStyle';

it('returns CARTO positron for light and dark-matter for dark', () => {
  expect(mapStyleUrl('light')).toContain('positron');
  expect(mapStyleUrl('dark')).toContain('dark-matter');
});
it('defines a color per restriction type', () => {
  expect(ZONE_COLORS.prohibited).toBe('#ef4444');
  expect(ZONE_COLORS.none).toBe('#22c55e');
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/map/mapStyle.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/map/mapStyle.ts`:

```ts
import type { RestrictionType } from '../data/ed269.types';

export function mapStyleUrl(theme: 'light' | 'dark'): string {
  const name = theme === 'dark' ? 'dark-matter-gl-style' : 'positron-gl-style';
  return `https://basemaps.cartocdn.com/gl/${name}/style.json`;
}

export const ZONE_COLORS: Record<RestrictionType, string> = {
  prohibited: '#ef4444', auth_required: '#f59e0b',
  conditional: '#eab308', none: '#22c55e',
};

export const ITALY_CENTER: [number, number] = [12.5, 42.0];
export const ITALY_ZOOM = 5;
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/map/mapStyle.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Componente MapView** — `src/map/MapView.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapStyleUrl, ITALY_CENTER, ITALY_ZOOM } from './mapStyle';

export function MapView({ resolvedTheme }: { resolvedTheme: 'light' | 'dark' }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = new maplibregl.Map({
      container: el.current,
      style: mapStyleUrl(resolvedTheme),
      center: ITALY_CENTER, zoom: ITALY_ZOOM,
      attributionControl: { compact: true },
    });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    return () => { map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cambia stile col tema mantenendo la vista
  useEffect(() => {
    map.current?.setStyle(mapStyleUrl(resolvedTheme));
  }, [resolvedTheme]);

  return <div ref={el} style={{ position: 'absolute', inset: 0 }} />;
}
```

- [ ] **Step 6: Verifica manuale**

In `App.tsx` monta temporaneamente `<MapView resolvedTheme="light" />`, esegui `npm run dev`.
Expected: mappa CARTO chiara centrata sull'Italia, attribuzione OSM/CARTO visibile, controllo zoom.

- [ ] **Step 7: Commit**

```bash
git add src/map/mapStyle.ts src/map/MapView.tsx tests/map/mapStyle.test.ts
git commit -m "feat(map): MapView with CARTO light/dark style and Italy view"
```

---

## Task 10: Render zone + popup di dettaglio

**Files:**
- Modify: `src/map/MapView.tsx`
- Test: `tests/map/zoneLayers.test.ts`

**Interfaces:**
- Consumes: `zonesToGeoJSON` (Task 8), `ZONE_COLORS` (Task 9), `Zone[]` (prop nuova).
- Produces:
  - `MapView` accetta ora `{ resolvedTheme, zones, onZoneClick? }`.
  - `buildFillPaint(): maplibregl.FillLayerSpecification['paint']` (helper puro, esportato e testato).

- [ ] **Step 1: Test del paint per-restrizione** — `tests/map/zoneLayers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFillPaint } from '../../src/map/MapView';

it('maps restriction types to colors via a data-driven expression', () => {
  const paint = buildFillPaint() as any;
  const expr = JSON.stringify(paint['fill-color']);
  expect(expr).toContain('prohibited');
  expect(expr).toContain('#ef4444');
  expect(paint['fill-opacity']).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/map/zoneLayers.test.ts`
Expected: FAIL ("buildFillPaint is not a function").

- [ ] **Step 3: Implementa** — aggiorna `src/map/MapView.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapStyleUrl, ITALY_CENTER, ITALY_ZOOM, ZONE_COLORS } from './mapStyle';
import { zonesToGeoJSON } from './zonesToGeoJSON';
import type { Zone } from '../data/ed269.types';

const SRC = 'zones';

export function buildFillPaint(): maplibregl.FillLayerSpecification['paint'] {
  return {
    'fill-color': ['match', ['get', 'restrictionType'],
      'prohibited', ZONE_COLORS.prohibited,
      'auth_required', ZONE_COLORS.auth_required,
      'conditional', ZONE_COLORS.conditional,
      'none', ZONE_COLORS.none,
      '#888888'],
    'fill-opacity': 0.25,
  };
}

function addZoneLayers(map: maplibregl.Map, zones: Zone[]) {
  const data = zonesToGeoJSON(zones) as any;
  if (map.getSource(SRC)) { (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(data); return; }
  map.addSource(SRC, { type: 'geojson', data });
  map.addLayer({ id: 'zones-fill', type: 'fill', source: SRC, paint: buildFillPaint() });
  map.addLayer({ id: 'zones-line', type: 'line', source: SRC,
    paint: { 'line-color': buildFillPaint()['fill-color'] as any, 'line-width': 1.2 } });
  map.addLayer({ id: 'zones-label', type: 'symbol', source: SRC,
    layout: { 'text-field': ['get', 'label'], 'text-size': 12,
      'text-font': ['Open Sans Regular','Noto Sans Regular'] },
    paint: { 'text-color': '#1c2530', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
}

export function MapView(
  { resolvedTheme, zones, onZoneClick }:
  { resolvedTheme: 'light' | 'dark'; zones: Zone[];
    onZoneClick?: (props: Record<string, unknown>) => void }
) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({
      container: el.current, style: mapStyleUrl(resolvedTheme),
      center: ITALY_CENTER, zoom: ITALY_ZOOM, attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => addZoneLayers(m, zones));
    m.on('click', 'zones-fill', (e) => {
      const f = e.features?.[0]; if (f && onZoneClick) onZoneClick(f.properties || {});
      if (f) new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${f.properties?.name ?? ''}</strong><br/>Quota max: ${f.properties?.label ?? '—'}`)
        .addTo(m);
    });
    m.on('mouseenter', 'zones-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'zones-fill', () => { m.getCanvas().style.cursor = ''; });
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    m.setStyle(mapStyleUrl(resolvedTheme));
    m.once('styledata', () => addZoneLayers(m, zones));
  }, [resolvedTheme]);

  useEffect(() => {
    const m = map.current; if (m && m.isStyleLoaded()) addZoneLayers(m, zones);
  }, [zones]);

  return <div ref={el} style={{ position: 'absolute', inset: 0 }} />;
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/map/zoneLayers.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Verifica manuale**

Con dati importati, le zone appaiono colorate per restrizione, con etichetta quota; il click apre un popup con nome e quota max.

- [ ] **Step 6: Commit**

```bash
git add src/map/MapView.tsx tests/map/zoneLayers.test.ts
git commit -m "feat(map): render colored zones with altitude labels and click popup"
```

---

## Task 11: Chrome UI — Legenda, banner stato dati, disclaimer, empty state

**Files:**
- Create: `src/ui/Legend.tsx`, `src/ui/DataStatusBanner.tsx`, `src/ui/Disclaimer.tsx`, `src/ui/EmptyState.tsx`, `src/ui/isStale.ts`
- Test: `tests/ui/isStale.test.ts`

**Interfaces:**
- Produces: `isStale(cycleDate: string | null, now: Date, maxDays?: number): boolean` (default 28) + componenti UI.

- [ ] **Step 1: Test staleness** — `tests/ui/isStale.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isStale } from '../../src/ui/isStale';

it('is stale when older than the AIRAC window', () => {
  expect(isStale('2026-05-01', new Date('2026-06-30'))).toBe(true);
});
it('is fresh within the window', () => {
  expect(isStale('2026-06-20', new Date('2026-06-30'))).toBe(false);
});
it('is stale when there is no cycle date (unknown)', () => {
  expect(isStale(null, new Date('2026-06-30'))).toBe(true);
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/ui/isStale.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/ui/isStale.ts`:

```ts
export function isStale(cycleDate: string | null, now: Date, maxDays = 28): boolean {
  if (!cycleDate) return true;
  const ageDays = (now.getTime() - new Date(cycleDate).getTime()) / 86_400_000;
  return ageDays > maxDays;
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/ui/isStale.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Componenti UI**

`src/ui/Legend.tsx`:
```tsx
import { ZONE_COLORS } from '../map/mapStyle';
const ROWS: [keyof typeof ZONE_COLORS, string][] = [
  ['none','Consentito (regole generali)'], ['conditional','Condizionato'],
  ['auth_required','Richiede autorizzazione'], ['prohibited','Vietato'],
];
export function Legend() {
  return (
    <div className="rounded-2xl p-3 text-sm" style={{ background:'var(--surface)', boxShadow:'var(--shadow)' }}>
      <div className="mb-1 font-semibold">Legenda (colore = restrizione, etichetta = quota max)</div>
      {ROWS.map(([k,label]) => (
        <div key={k} className="flex items-center gap-2 py-0.5">
          <span style={{ width:14, height:14, borderRadius:4, background: ZONE_COLORS[k] }} />
          <span style={{ whiteSpace:'nowrap' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
```

`src/ui/DataStatusBanner.tsx`:
```tsx
import type { DatasetMeta } from '../data/ed269.types';
import { isStale } from './isStale';
export function DataStatusBanner({ meta }: { meta: DatasetMeta | null }) {
  if (!meta) return null;
  const stale = isStale(meta.cycleDate, new Date());
  const when = meta.cycleDate ?? new Date(meta.importedAt).toLocaleDateString('it-IT');
  return (
    <div className="rounded-xl px-3 py-2 text-sm" style={{ background:'var(--surface)', boxShadow:'var(--shadow)' }}>
      Dati aggiornati al <b>{when}</b>{' '}
      {stale && <span style={{ color:'#f59e0b' }}>· ⚠️ potrebbero non essere aggiornati, reimporta il file</span>}
    </div>
  );
}
```

`src/ui/Disclaimer.tsx`:
```tsx
export function Disclaimer() {
  return (
    <div className="text-xs" style={{ color:'var(--text-muted)' }}>
      App <b>non ufficiale</b>. Verifica sempre sul portale ufficiale prima di volare:{' '}
      <a href="https://www.d-flight.it" target="_blank" rel="noreferrer"
         style={{ color:'var(--accent)' }}>D-Flight</a>.
    </div>
  );
}
```

`src/ui/EmptyState.tsx`:
```tsx
import { ImportButton } from './ImportButton';
import type { DatasetMeta, ZoneDiff } from '../data/ed269.types';
export function EmptyState(
  { onImported, onError }:
  { onImported: (r:{meta:DatasetMeta;diff:ZoneDiff}) => void; onError:(m:string)=>void }
) {
  return (
    <div className="mx-auto max-w-md rounded-2xl p-6 text-center"
         style={{ background:'var(--surface)', boxShadow:'var(--shadow)' }}>
      <h2 className="mb-2 text-lg font-bold">Importa le zone ufficiali</h2>
      <p className="mb-4 text-sm" style={{ color:'var(--text-muted)' }}>
        Scarica il file delle zone geografiche UAS (formato ED-269, JSON) dal tuo account
        su d-flight.it e importalo qui. Resterà disponibile anche offline.
      </p>
      <ImportButton onDone={onImported} onError={onError} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/ tests/ui/
git commit -m "feat(ui): legend, data-status banner, disclaimer, empty state"
```

---

## Task 12: Ricerca luoghi (Photon)

**Files:**
- Create: `src/search/geocode.ts`, `src/search/SearchBox.tsx`
- Test: `tests/search/geocode.test.ts`

**Interfaces:**
- Produces:
  - `type GeocodeResult = { label: string; lat: number; lon: number }`
  - `geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>` (Photon, limitato all'Italia, lingua it).

- [ ] **Step 1: Test con fetch mockato** — `tests/search/geocode.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { geocode } from '../../src/search/geocode';

afterEach(() => vi.restoreAllMocks());

it('maps Photon features to results', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features: [
      { geometry: { coordinates: [12.49, 41.90] },
        properties: { name: 'Roma', city: 'Roma', state: 'Lazio' } },
    ] }),
  }));
  const r = await geocode('roma');
  expect(r[0]).toMatchObject({ lat: 41.90, lon: 12.49 });
  expect(r[0].label).toContain('Roma');
});
it('returns empty array for blank query', async () => {
  expect(await geocode('  ')).toEqual([]);
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/search/geocode.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/search/geocode.ts`:

```ts
export type GeocodeResult = { label: string; lat: number; lon: number };

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=it&limit=5`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []).map((f: any): GeocodeResult => {
    const p = f.properties ?? {};
    const label = [p.name, p.city, p.state].filter(Boolean).join(', ') || 'Risultato';
    const [lon, lat] = f.geometry.coordinates;
    return { label, lat, lon };
  });
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/search/geocode.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: SearchBox** — `src/search/SearchBox.tsx`:

```tsx
import { useState } from 'react';
import { geocode, type GeocodeResult } from './geocode';
export function SearchBox({ onPick }: { onPick: (r: GeocodeResult) => void }) {
  const [q, setQ] = useState(''); const [res, setRes] = useState<GeocodeResult[]>([]);
  async function run(v: string) { setQ(v); setRes(v.trim().length > 2 ? await geocode(v) : []); }
  return (
    <div className="relative">
      <input value={q} onChange={e => run(e.target.value)} placeholder="⌕ Cerca un luogo…"
        className="w-full rounded-full px-4 py-2.5 text-sm outline-none"
        style={{ background:'var(--surface)', color:'var(--text)', boxShadow:'var(--shadow)' }} />
      {res.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl"
            style={{ background:'var(--surface)', boxShadow:'var(--shadow)' }}>
          {res.map((r,i) => (
            <li key={i}><button onClick={() => { onPick(r); setRes([]); setQ(r.label); }}
              className="block w-full px-4 py-2 text-left text-sm hover:opacity-80">{r.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/search/ tests/search/
git commit -m "feat(search): Photon geocoding and search box"
```

---

## Task 13: Posizione GPS

**Files:**
- Create: `src/location/useGeolocation.ts`, `src/location/LocateButton.tsx`
- Test: `tests/location/useGeolocation.test.ts`

**Interfaces:**
- Produces:
  - `useGeolocation(): { position: {lat:number;lon:number;accuracy:number} | null; error: string | null; request(): void }`

- [ ] **Step 1: Test con geolocation mockata** — `tests/location/useGeolocation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '../../src/location/useGeolocation';

beforeEach(() => {
  vi.stubGlobal('navigator', { geolocation: {
    getCurrentPosition: (ok: any) =>
      ok({ coords: { latitude: 45.46, longitude: 9.19, accuracy: 12 } }),
  }});
});

it('returns the current position on request', () => {
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current.request());
  expect(result.current.position).toMatchObject({ lat: 45.46, lon: 9.19, accuracy: 12 });
});
it('reports an error when geolocation is unavailable', () => {
  vi.stubGlobal('navigator', {});
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current.request());
  expect(result.current.error).toBeTruthy();
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npx vitest run tests/location/useGeolocation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** — `src/location/useGeolocation.ts`:

```ts
import { useCallback, useState } from 'react';
type Pos = { lat: number; lon: number; accuracy: number };

export function useGeolocation() {
  const [position, setPosition] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocalizzazione non disponibile.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPosition({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => setError('Permesso negato o posizione non disponibile.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  return { position, error, request };
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `npx vitest run tests/location/useGeolocation.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: LocateButton** — `src/location/LocateButton.tsx`:

```tsx
export function LocateButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Centra sulla mia posizione"
      className="rounded-full p-3" style={{ background:'var(--surface)', boxShadow:'var(--shadow)' }}>
      📍
    </button>
  );
}
```
> Il marker "puntino blu" + cerchio di precisione viene aggiunto in Task 14 usando `position` (MapLibre `Marker` o un layer cerchio) e il pulsante `flyTo`.

- [ ] **Step 6: Commit**

```bash
git add src/location/ tests/location/
git commit -m "feat(location): geolocation hook and locate button"
```

---

## Task 14: Integrazione App (layout stile B) + verifica end-to-end

**Files:**
- Modify: `src/App.tsx`, `src/map/MapView.tsx` (prop `flyTo`, marker posizione)
- Test: `tests/app/App.test.tsx`

**Interfaces:**
- Consumes: tutti i moduli precedenti.
- Produces: `App` che mostra mappa a tutto schermo, barra ricerca + tema in alto, legenda + locate + import, banner stato dati, empty state al primo avvio.

- [ ] **Step 1: Estendi MapView con `flyTo` e marker posizione** — aggiungi alle prop di `MapView`:
  `userPosition?: { lat:number; lon:number; accuracy:number } | null` e `flyTo?: { lat:number; lon:number } | null`.

In `MapView`, dopo il blocco esistente, aggiungi:
```tsx
  // vola alla posizione scelta dalla ricerca o dal GPS
  useEffect(() => {
    if (flyTo && map.current) map.current.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 13 });
  }, [flyTo]);

  // marker "puntino blu" della posizione utente
  const marker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (!userPosition) { marker.current?.remove(); marker.current = null; return; }
    const dot = document.createElement('div');
    dot.style.cssText =
      'width:16px;height:16px;border-radius:50%;background:#0a84ff;border:3px solid #fff;box-shadow:0 0 0 6px rgba(10,132,255,.2)';
    marker.current?.remove();
    marker.current = new maplibregl.Marker({ element: dot })
      .setLngLat([userPosition.lon, userPosition.lat]).addTo(m);
  }, [userPosition]);
```
Aggiorna la firma del componente includendo `userPosition` e `flyTo` nelle props.

- [ ] **Step 2: Componi App** — `src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useTheme } from './theme/useTheme';
import { ThemeToggle } from './theme/ThemeToggle';
import { MapView } from './map/MapView';
import { SearchBox } from './search/SearchBox';
import { LocateButton } from './location/LocateButton';
import { useGeolocation } from './location/useGeolocation';
import { ImportButton } from './ui/ImportButton';
import { Legend } from './ui/Legend';
import { Disclaimer } from './ui/Disclaimer';
import { EmptyState } from './ui/EmptyState';
import { DataStatusBanner } from './ui/DataStatusBanner';
import { loadZones, loadMeta } from './data/zoneStore';
import type { Zone, DatasetMeta } from './data/ed269.types';

export default function App() {
  const { theme, resolved, setTheme } = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [flyTo, setFlyTo] = useState<{lat:number;lon:number}|null>(null);
  const [err, setErr] = useState<string | null>(null);
  const geo = useGeolocation();

  useEffect(() => { (async () => {
    setZones(await loadZones()); setMeta(await loadMeta());
  })(); }, []);

  async function refresh() { setZones(await loadZones()); setMeta(await loadMeta()); }

  return (
    <div style={{ position:'absolute', inset:0 }}>
      <MapView resolvedTheme={resolved} zones={zones}
        userPosition={geo.position} flyTo={flyTo ?? (geo.position ? { lat:geo.position.lat, lon:geo.position.lon } : null)} />

      <div style={{ position:'absolute', top:12, left:12, right:12, display:'flex', gap:10, alignItems:'flex-start' }}>
        <div style={{ flex:1, maxWidth:480 }}><SearchBox onPick={r => setFlyTo({ lat:r.lat, lon:r.lon })} /></div>
        <ThemeToggle value={theme} onChange={setTheme} />
      </div>

      <div style={{ position:'absolute', bottom:12, left:12, display:'flex', flexDirection:'column', gap:10 }}>
        <DataStatusBanner meta={meta} />
        <Legend />
        <Disclaimer />
      </div>

      <div style={{ position:'absolute', bottom:12, right:12, display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end' }}>
        <LocateButton onClick={geo.request} />
        <ImportButton onDone={async () => { await refresh(); }} onError={setErr} />
      </div>

      {zones.length === 0 && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,.15)', padding:16 }}>
          <EmptyState onImported={async () => { await refresh(); }} onError={setErr} />
        </div>
      )}
      {err && <div style={{ position:'absolute', top:64, left:12, right:12, color:'#ef4444' }}>{err}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Test integrazione (empty state)** — `tests/app/App.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import 'fake-indexeddb/auto';

vi.mock('../../src/map/MapView', () => ({ MapView: () => <div data-testid="map" /> }));

import App from '../../src/App';

beforeEach(() => { (globalThis as any).indexedDB = new IDBFactory(); });

it('shows the import empty-state when there is no data', async () => {
  render(<App />);
  expect(await screen.findByText(/Importa le zone ufficiali/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test`
Expected: PASS (tutta la suite verde).

- [ ] **Step 5: Verifica manuale end-to-end**

1. `npm run dev`.
2. Primo avvio → appare l'empty state "Importa le zone ufficiali".
3. Importa un **file ED-269 reale** scaricato da d-flight.it (o un campione) → la mappa mostra le zone colorate con etichette di quota; il banner mostra la data.
4. Cerca "Roma" → la mappa vola lì. Premi 📍 → consenti la posizione → compare il puntino blu.
5. Cambia tema (Chiaro/Scuro/Sistema) → mappa e UI cambiano coerentemente; le zone restano renderizzate.
6. Clic su una zona → popup con nome e quota max.
7. Ricarica la pagina → i dati importati persistono (IndexedDB).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/map/MapView.tsx tests/app/App.test.tsx
git commit -m "feat(app): integrate map, search, location, import in style-B layout"
```

---

## Self-review (Fase 1 vs spec)

- **Mappa nuda e cruda (default)** → Task 9–11 (zone colorate, etichetta quota, popup, legenda). ✅
- **Quota max per colore/zona** → Task 8 (`altitudeLabel`) + Task 10 (symbol layer). ✅
- **Import ED-269 + diff + data ciclo + staleness** → Task 3–7, 11. ✅
- **Ricerca luogo / GPS** → Task 12, 13, 14. ✅
- **Tema chiaro/scuro/sistema** → Task 2, riapplicato in MapView (Task 10). ✅
- **Estetica stile B / keyless / non ufficiale** → Global Constraints + Task 9 (CARTO), 11 (Disclaimer). ✅
- **Offline completo, profili, motore di regole, pianificazione** → **Fase 2/3** (sotto). Fuori da questo piano per disegno.
- **Placeholder scan:** nessun TODO/TBD nei task eseguibili. ✅
- **Type consistency:** `Zone`, `DatasetMeta`, `ZoneDiff` definiti in Task 3 e usati coerentemente; `mapStyleUrl`, `ZONE_COLORS`, `buildFillPaint`, `zonesToGeoJSON`, `altitudeLabel`, `geocode`, `useGeolocation`, `useTheme` con firme coerenti tra i task. ✅

---

## Roadmap — Fase 2 e Fase 3 (piani dedicati da scrivere dopo)

**Fase 2 — Personalizzazione + pianificazione** (nuovo piano `…-fase2-regole.md`)
- Profili: CRUD droni (massa, classe C0–C4/sub250/legacy) e pilota (A1/A3, A2) in IndexedDB; selezione attivi.
- `rulesEngine` (funzioni pure, TDD tabellare): zone intersecate × classe drone × qualifica → verdetto conservativo (`consentito` / `condizionato` / `serve autorizzazione` / `vietato` / `verifica`), con quota max `min(120 AGL, zona)` e riferimenti normativi.
- Intersezioni geometriche (`@turf/boolean-intersects`) tra area/punto disegnati e zone.
- Pianificazione on-demand: disegno punto/cerchio/poligono, scheda verdetto, salvataggio "spot".
- Toggle opzionale "colora per il mio drone".

**Fase 3 — Offline / PWA** (nuovo piano `…-fase3-pwa.md`)
- Service worker (Workbox) + manifest installabile; cache app-shell e stile mappa.
- Strategia cache tile mappa per aree visitate + avviso quando si naviga offline oltre la cache.
- Web Share Target (import "condividi all'app" su mobile).
- Rifiniture accessibilità, onboarding, banner aggiornamento.
