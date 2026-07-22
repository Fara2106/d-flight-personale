# Contorni puliti (round 9) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Togliere il "pasticcio" dei contorni ai confini tra categorie — un solo bordo colorato per punto (severità più alta), tratteggio auth più calmo, etichette-quota non ripetute — senza toccare veli, popup e semantica della baseline round 8.

**Architecture:** I veli restano il mosaico ritagliato mutuamente esclusivo (`categoryMosaic`, invariato). I **contorni** passano a **blob cumulativi per severità** calcolati con sole *unioni* (`categoryOutlines`): il bordo rosso attorno al vietato, arancione attorno a vietato+autorizzazione, giallo attorno a tutto — ogni confine interno finisce dentro un blob e non viene disegnato; dove i bordi coincidono vince il più severo (sort-key + spessore). Worker/cache/orchestratore trasportano ora **due** collezioni (`{ fill, outline }`). MapView disegna `zones-cat-line` da una nuova sorgente `zones-cat-outline`. In parallelo: opacità hatch ridotta e dedup etichette estesa alla prossimità.

**Tech Stack:** TypeScript, React, MapLibre GL, Turf (`@turf/union`), Vitest, idb (IndexedDB), Playwright (E2E headless sul Mac).

## Global Constraints

- **Baseline intoccabile:** veli mutuamente esclusivi (round 8), popup che al tocco elenca TUTTE le zone, highlight blu della zona aperta, colori e ordine di severità (`RESTRICTION_ORDER`: prohibited 0, auth_required 1, conditional 2, none 3). Non modificarli.
- **App conservativa:** mai nascondere una quota diversa o più severa. La dedup etichette agisce solo a parità di **testo** identico.
- **`none` (verde) non ha contorno** né velo, come oggi.
- **Robustezza geometrica:** ogni union passa da `unionAll` (snap 1e-6 + albero), mai `difference` per i contorni.
- **Verifica sempre:** `npx tsc --noEmit`, `npm test`, `npm run build` verdi a fine di ogni task che tocca codice; E2E 15/15 + offline 11/11 e collaudo col file ED-269 reale nel task finale.
- **Cache versione:** un record overlay senza la parte `outline` va trattato come miss (ricalcolo), così i dataset già in cache si rigenerano senza errori.

---

## File Structure

- `src/map/fastUnion.ts` — aggiunge `categoryOutlines`, il tipo `CategoryOverlay` e `categoryOverlay`. `categoryMosaic` invariato.
- `src/map/overlayWorkerClient.ts` — `computeCategoryMosaic` → `computeCategoryOverlay` (ritorna `CategoryOverlay`).
- `src/map/unionWorker.ts` — il worker restituisce `categoryOverlay(...)`.
- `src/map/overlayCache.ts` — `loadCachedMosaic`/`saveCachedMosaic` → `loadCachedOverlay`/`saveCachedOverlay` (valore `CategoryOverlay`).
- `src/data/db.ts` — `CachedOverlay` porta `{ zonesKey, overlay }`.
- `src/map/categoryOverlay.ts` — `categoryMosaicFor` → `categoryOverlayFor` (ritorna `CategoryOverlay`).
- `src/map/MapView.tsx` — nuova sorgente `zones-cat-outline`; `zones-cat-line` la usa; hatch a `HATCH_FILL_OPACITY`.
- `src/map/mapStyle.ts` — costante `HATCH_FILL_OPACITY`.
- `src/map/zonesToGeoJSON.ts` — dedup etichette estesa a valore+prossimità.

---

## Task 1: Contorni cumulativi per severità (`categoryOutlines`)

**Files:**
- Modify: `src/map/fastUnion.ts`
- Test: `tests/map/fastUnion.test.ts`

**Interfaces:**
- Consumes: `unionAll(geoms: Poly[]): { merged: PolyFeature[]; failures: number }`, `RESTRICTION_ORDER` (già presenti).
- Produces:
  - `categoryOutlines(zones: Zone[]): FeatureCollection` — una feature per soglia di severità presente; ogni feature ha `properties.restrictionType` = la soglia e `properties.catOutline = true`; nessuna feature per `none`.
  - `interface CategoryOverlay { fill: FeatureCollection; outline: FeatureCollection }`
  - `categoryOverlay(zones: Zone[]): CategoryOverlay` = `{ fill: categoryMosaic(zones), outline: categoryOutlines(zones) }`

- [ ] **Step 1: Write the failing test**

Aggiungi in fondo a `tests/map/fastUnion.test.ts` (usa gli helper `rectGeom` e `zone` già definiti nel file):

```ts
import { categoryOutlines, categoryOverlay } from '../../src/map/fastUnion';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { MultiPolygon } from 'geojson';

describe('categoryOutlines: contorni cumulativi per severità (round 9)', () => {
  it('una feature per soglia; niente contorno per "none"', () => {
    const fc = categoryOutlines([
      zone('p', rectGeom(0, 1), 'prohibited'),
      zone('a', rectGeom(0, 3), 'auth_required'),
      zone('n', rectGeom(0, 5), 'none'),
    ]);
    const types = fc.features.map((f) => f.properties?.restrictionType).sort();
    expect(types).toEqual(['auth_required', 'prohibited']);
    expect(fc.features.every((f) => f.properties?.catOutline === true)).toBe(true);
  });

  it('il blob cumulativo di una soglia CONTIENE le categorie più severe', () => {
    // auth cumulativo = union(prohibited ∪ auth): copre il punto interno al prohibited
    const fc = categoryOutlines([
      zone('p', rectGeom(0, 1), 'prohibited'),
      zone('a', rectGeom(2, 3), 'auth_required'), // disgiunto dal prohibited
    ]);
    const auth = fc.features.find((f) => f.properties?.restrictionType === 'auth_required')!;
    const g = auth.geometry as Polygon | MultiPolygon;
    // il contorno auth abbraccia sia il prohibited (x≈0.5) sia l'auth (x≈2.5)
    expect(booleanPointInPolygon([0.5, 0.5], g)).toBe(true);
    expect(booleanPointInPolygon([2.5, 0.5], g)).toBe(true);
  });

  it('categoryOverlay: ritorna sia i veli (fill) sia i contorni (outline)', () => {
    const ov = categoryOverlay([
      zone('p', rectGeom(0, 1), 'prohibited'),
      zone('a', rectGeom(0, 3), 'auth_required'),
    ]);
    expect(ov.fill.features.every((f) => f.properties?.catUnion === true)).toBe(true);
    expect(ov.outline.features.every((f) => f.properties?.catOutline === true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/map/fastUnion.test.ts -t "categoryOutlines"`
Expected: FAIL — `categoryOutlines`/`categoryOverlay` non esportati.

- [ ] **Step 3: Write minimal implementation**

In `src/map/fastUnion.ts`, dopo `categoryMosaic`, aggiungi (il tipo `Feature`/`FeatureCollection` è già importato; assicurati che `RestrictionType`, `Zone`, `RESTRICTION_ORDER`, `Poly`, `PolyFeature` siano in scope — lo sono):

```ts
/** Insieme (interface) delle due collezioni della vista d'insieme: i veli
 *  ritagliati (un colore per punto) e i contorni cumulativi (un bordo per
 *  punto). Trasportata da worker → cache → MapView. */
export interface CategoryOverlay { fill: FeatureCollection; outline: FeatureCollection }

/**
 * Contorni della vista d'insieme come BLOB CUMULATIVI per severità: per ogni
 * soglia si disegna il perimetro dell'unione di quella categoria e di tutte le
 * più severe. Così ogni confine INTERNO tra due categorie finisce dentro un
 * blob e non viene disegnato — resta solo il perimetro esterno, colorato per
 * severità. Solo union (robuste), mai difference: erano le imprecisioni del
 * ritaglio a far sbucare i bordi uno di fianco all'altro (feedback Lorenzo
 * 2026-07-22: "le forme fanno pasticcio"). `none` non ha contorno.
 */
export function categoryOutlines(zones: Zone[]): FeatureCollection {
  const byType = new Map<RestrictionType, Poly[]>();
  const seen = new Set<string>();
  for (const z of zones) {
    const g = z.geometry;
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue;
    if (z.restrictionType === 'none') continue; // il verde non ha contorno
    const k = z.restrictionType + JSON.stringify(g.coordinates);
    if (seen.has(k)) continue; // dedup doppioni D-Flight
    seen.add(k);
    const arr = byType.get(z.restrictionType);
    if (arr) arr.push(g); else byType.set(z.restrictionType, [g]);
  }
  // dalla più severa alla meno severa: il blob cumulativo cresce a ogni soglia
  const ordered = [...byType.entries()].sort(([a], [b]) =>
    RESTRICTION_ORDER[a] - RESTRICTION_ORDER[b]);
  const features: Feature[] = [];
  let prev: Poly[] = []; // geometrie già fuse delle categorie più severe
  for (const [type, geoms] of ordered) {
    const { merged } = unionAll([...prev, ...geoms]);
    for (const m of merged) {
      features.push({ type: 'Feature', geometry: m.geometry,
        properties: { restrictionType: type, catOutline: true } });
    }
    prev = merged.map((m) => m.geometry as Poly); // riusa il lavoro alla soglia dopo
  }
  return { type: 'FeatureCollection', features };
}

/** Le due collezioni della vista d'insieme in un colpo solo (veli + contorni). */
export function categoryOverlay(zones: Zone[]): CategoryOverlay {
  return { fill: categoryMosaic(zones), outline: categoryOutlines(zones) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/map/fastUnion.test.ts`
Expected: PASS (tutti, inclusi i preesistenti).

- [ ] **Step 5: Commit**

```bash
git add src/map/fastUnion.ts tests/map/fastUnion.test.ts
git commit -m "feat(map): contorni cumulativi per severità (categoryOutlines) — via i confini interni"
```

---

## Task 2: Trasporto delle due collezioni (worker, client, cache, orchestratore)

**Files:**
- Modify: `src/map/overlayWorkerClient.ts`, `src/map/unionWorker.ts`, `src/map/overlayCache.ts`, `src/data/db.ts`, `src/map/categoryOverlay.ts`
- Test: `tests/map/overlayWorkerClient.test.ts`, `tests/map/overlayCache.test.ts`, `tests/map/categoryOverlay.test.ts`

**Interfaces:**
- Consumes: `categoryOverlay(zones): CategoryOverlay`, `CategoryOverlay` (Task 1).
- Produces:
  - `computeCategoryOverlay(zones: Zone[]): Promise<CategoryOverlay>`
  - `loadCachedOverlay(key: string): Promise<CategoryOverlay | null>`, `saveCachedOverlay(key: string, overlay: CategoryOverlay): Promise<void>` (`zonesKey` invariato)
  - `categoryOverlayFor(zones: Zone[]): Promise<CategoryOverlay>`

- [ ] **Step 1: Write the failing tests**

Sostituisci il corpo di `tests/map/overlayWorkerClient.test.ts` che chiama `computeCategoryMosaic` con `computeCategoryOverlay`, adeguando gli assert alla forma `{ fill, outline }`. Esempio dei due casi chiave:

```ts
import { computeCategoryOverlay } from '../../src/map/overlayWorkerClient';
// ... helper zone(...) invariati ...

it('senza Worker: calcola inline e restituisce fill+outline', async () => {
  const ov = await computeCategoryOverlay([zone('a', 'auth_required')]);
  expect(ov.fill.features[0].properties?.catUnion).toBe(true);
  expect(ov.outline.features[0].properties?.catOutline).toBe(true);
});

it('con Worker: inoltra le zone e restituisce ciò che il worker manda', async () => {
  const FAKE = { fill: { type: 'FeatureCollection', features: [] },
                 outline: { type: 'FeatureCollection', features: [] } };
  // ... stub Worker che posta FAKE (come il test attuale) ...
  const ov = await computeCategoryOverlay(zones);
  expect(ov).toEqual(FAKE);
  expect(posted).toEqual([zones]);
});
```

In `tests/map/overlayCache.test.ts` rinomina le chiamate a `loadCachedOverlay`/`saveCachedOverlay` e cambia il valore salvato da `FC` a un overlay `{ fill: FC, outline: FC }`; aggiungi:

```ts
it('formato vecchio (senza outline) = miss, così si ricalcola', async () => {
  // salva a mano un record vecchio-stile e verifica che load lo ignori
  const { db } = await import('../../src/data/db');
  await (await db()).put('overlays', { zonesKey: 'k', fc: FC } as any, 'category-mosaic');
  expect(await loadCachedOverlay('k')).toBeNull();
});
```

In `tests/map/categoryOverlay.test.ts` rinomina `categoryMosaicFor` → `categoryOverlayFor` e adegua gli assert a `{ fill, outline }` (il cache-hit confronta l'overlay salvato; il cache-miss verifica `ov.fill.features[0].properties?.catUnion === true` e che `loadCachedOverlay` restituisca l'overlay salvato).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/map/overlayWorkerClient.test.ts tests/map/overlayCache.test.ts tests/map/categoryOverlay.test.ts`
Expected: FAIL — simboli rinominati non ancora esistenti.

- [ ] **Step 3: Write the implementation**

`src/data/db.ts` — cambia il record overlay:

```ts
import type { CategoryOverlay } from '../map/fastUnion';
// ...
export interface CachedOverlay { zonesKey: string; overlay: CategoryOverlay }
```

(La `VER` resta 3: lo store `overlays` esiste già; i record vecchi vengono scartati come miss dal load — vedi sotto.)

`src/map/overlayCache.ts` — valore `CategoryOverlay`, load robusto al formato vecchio:

```ts
import type { CategoryOverlay } from './fastUnion';
// zonesKey invariato
export async function loadCachedOverlay(key: string): Promise<CategoryOverlay | null> {
  try {
    const rec = await (await db()).get('overlays', RECORD_KEY);
    if (!rec || rec.zonesKey !== key) return null;
    const ov = rec.overlay;
    // record di formato vecchio (senza outline) → miss: si ricalcola
    if (!ov || !ov.fill || !ov.outline) return null;
    return ov;
  } catch {
    return null;
  }
}
export async function saveCachedOverlay(key: string, overlay: CategoryOverlay): Promise<void> {
  try {
    await (await db()).put('overlays', { zonesKey: key, overlay }, RECORD_KEY);
  } catch { /* quota / DB chiuso: si ricalcola */ }
}
```

`src/map/unionWorker.ts`:

```ts
import type { Zone } from '../data/ed269.types';
import { categoryOverlay } from './fastUnion';

self.onmessage = (e: MessageEvent<Zone[]>) => {
  self.postMessage(categoryOverlay(e.data));
};
```

`src/map/overlayWorkerClient.ts` — rinomina e cambia tipo (stessa struttura Worker/fallback di oggi):

```ts
import type { CategoryOverlay } from './fastUnion';
import { categoryOverlay } from './fastUnion';

async function inline(zones: Zone[]): Promise<CategoryOverlay> {
  await new Promise((r) => setTimeout(r, 0));
  return categoryOverlay(zones);
}

export function computeCategoryOverlay(zones: Zone[]): Promise<CategoryOverlay> {
  if (typeof Worker === 'undefined') return inline(zones);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./unionWorker.ts', import.meta.url), { type: 'module' });
    } catch { resolve(inline(zones)); return; }
    worker.onmessage = (e: MessageEvent<CategoryOverlay>) => { worker.terminate(); resolve(e.data); };
    worker.onerror = () => { worker.terminate(); resolve(inline(zones)); };
    worker.postMessage(zones);
  });
}
```

`src/map/categoryOverlay.ts`:

```ts
import type { CategoryOverlay } from './fastUnion';
import { computeCategoryOverlay } from './overlayWorkerClient';
import { zonesKey, loadCachedOverlay, saveCachedOverlay } from './overlayCache';

export async function categoryOverlayFor(zones: Zone[]): Promise<CategoryOverlay> {
  const key = zonesKey(zones);
  const cached = await loadCachedOverlay(key);
  if (cached) return cached;
  const ov = await computeCategoryOverlay(zones);
  await saveCachedOverlay(key, ov);
  return ov;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/map/overlayWorkerClient.test.ts tests/map/overlayCache.test.ts tests/map/categoryOverlay.test.ts && npx tsc --noEmit`
Expected: test PASS; tsc **fallirà ancora** su `MapView.tsx` (usa i nomi vecchi) — normale, lo sistema il Task 3. Verifica che l'unico errore tsc residuo sia in `MapView.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/map/overlayWorkerClient.ts src/map/unionWorker.ts src/map/overlayCache.ts src/data/db.ts src/map/categoryOverlay.ts tests/map/overlayWorkerClient.test.ts tests/map/overlayCache.test.ts tests/map/categoryOverlay.test.ts
git commit -m "refactor(map): il mosaico trasporta due collezioni (fill+outline) da worker a cache"
```

---

## Task 3: MapView — sorgente contorni dedicata + hatch più calmo

**Files:**
- Modify: `src/map/mapStyle.ts`, `src/map/MapView.tsx`
- Test: `tests/map/singleOutline.test.ts`

**Interfaces:**
- Consumes: `categoryOverlayFor` (Task 2), `HATCH_FILL_OPACITY`.
- Produces: layer `zones-cat-line` legge la sorgente `zones-cat-outline`; hatch a opacità ridotta.

- [ ] **Step 1: Write the failing test**

In `tests/map/singleOutline.test.ts` aggiungi:

```ts
describe('contorni cumulativi (round 9): bordo da sorgente dedicata', () => {
  it("zones-cat-line legge la sorgente 'zones-cat-outline', non il mosaico dei veli", () => {
    const block = layerBlock('zones-cat-line');
    expect(block).not.toBeNull();
    expect(block).toMatch(/source:\s*SRC_CAT_LINE/);
  });
  it("l'hatch usa la costante di opacità (calmato), non 0.3 fisso", () => {
    const block = layerBlock('zones-hatch');
    expect(block).toMatch(/HATCH_FILL_OPACITY/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/map/singleOutline.test.ts`
Expected: FAIL — `SRC_CAT_LINE`/`HATCH_FILL_OPACITY` non presenti nei blocchi.

- [ ] **Step 3: Write the implementation**

`src/map/mapStyle.ts` — aggiungi accanto alle altre costanti:

```ts
/** Opacità del tratteggio "richiede autorizzazione": tenuta bassa perché la
 *  CTR di Roma/Fiumicino copre mezzo schermo — il segnale resta (velo + bordo
 *  arancione), il rumore no (feedback Lorenzo 2026-07-22). */
export const HATCH_FILL_OPACITY = 0.15;
```

In `src/map/MapView.tsx`:

1. import: aggiungi `HATCH_FILL_OPACITY` alla lista da `./mapStyle`; cambia `import { categoryMosaicFor }` in `import { categoryOverlayFor }`.
2. costante sorgente, sotto `const SRC_CAT = 'zones-cat';`:

```ts
const SRC_CAT_LINE = 'zones-cat-outline'; // contorni cumulativi (un bordo per punto)
```

3. nel blocco che alimenta le sorgenti (dove oggi c'è `swapWhenReady(SRC_CAT, categoryMosaicFor(zones));`), sostituisci con:

```ts
  // un solo calcolo (cache/worker), due sorgenti: veli ritagliati + contorni cumulativi
  const overlay = categoryOverlayFor(zones);
  swapWhenReady(SRC_CAT, overlay.then((o) => o.fill));
  swapWhenReady(SRC_CAT_LINE, overlay.then((o) => o.outline));
```

4. nel ramo "sorgenti già presenti" (reload), dopo le due `setData` esistenti su `SRC` e `SRC_CAT`, aggiungi:

```ts
    (map.getSource(SRC_CAT_LINE) as maplibregl.GeoJSONSource).setData(data);
```

5. dopo `map.addSource(SRC_CAT, { type: 'geojson', data });` aggiungi:

```ts
  map.addSource(SRC_CAT_LINE, { type: 'geojson', data });
```

6. nel layer `zones-cat-line`, cambia `source: SRC_CAT` in `source: SRC_CAT_LINE`.
7. nel layer `zones-hatch`, cambia `'fill-opacity': 0.3` in `'fill-opacity': HATCH_FILL_OPACITY`.

(La visibilità per categoria — `set('zones-cat-line')` e `applyTypeVisibility` — resta invariata: le feature outline hanno `restrictionType`, quindi i filtri esistenti continuano a funzionare.)

- [ ] **Step 4: Run test + full suite + typecheck + build**

Run: `npx vitest run tests/map/singleOutline.test.ts && npx tsc --noEmit && npm test && npm run build`
Expected: tutto PASS/verde; nessun errore tsc residuo.

- [ ] **Step 5: Commit**

```bash
git add src/map/mapStyle.ts src/map/MapView.tsx tests/map/singleOutline.test.ts
git commit -m "feat(map): contorni da sorgente dedicata (zones-cat-outline) + hatch auth più calmo"
```

---

## Task 4: Etichette-quota de-duplicate per prossimità

**Files:**
- Modify: `src/map/zonesToGeoJSON.ts`
- Test: `tests/map/zonesToGeoJSON.test.ts`

**Interfaces:**
- Consumes: struttura di `zonesToGeoJSON` esistente (`labels`, `areas`, `largestBy`).
- Produces: `labelPrimary` ora falso anche per una zona il cui **testo** quota è già stato scelto come primario entro `LABEL_DEDUP_DEG` gradi da una zona più estesa (in aggiunta alla regola nome+quota esistente).

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/map/zonesToGeoJSON.test.ts` (dentro un nuovo `describe`), usando coordinate realistiche:

```ts
describe('dedup etichette per valore+prossimità (round 9, "0 m" ripetuti)', () => {
  const near = (id: string, name: string, cx: number): Zone => ({
    ...z, id, name, restrictionType: 'prohibited', upperLimitM: 0, verticalRef: 'AGL',
    geometry: { type: 'Polygon',
      coordinates: [[[cx, 41.9], [cx + 0.004, 41.9], [cx + 0.004, 41.904], [cx, 41.9]]] },
  });

  it('stesso testo, nomi diversi, VICINE → una sola primaria', () => {
    const fc = zonesToGeoJSON([near('a', 'Roma A', 12.50), near('b', 'Roma B', 12.505)]);
    const primaries = fc.features.filter((f) => f.properties?.labelPrimary);
    expect(primaries).toHaveLength(1);
  });

  it('stesso testo ma LONTANE → entrambe primarie', () => {
    const fc = zonesToGeoJSON([near('a', 'Roma A', 12.50), near('b', 'Milano B', 9.19)]);
    const primaries = fc.features.filter((f) => f.properties?.labelPrimary);
    expect(primaries).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/map/zonesToGeoJSON.test.ts -t "prossimità"`
Expected: FAIL sul primo caso (oggi entrambe primarie: nomi diversi).

- [ ] **Step 3: Write the implementation**

In `src/map/zonesToGeoJSON.ts`, sopra `zonesToGeoJSON`, aggiungi l'helper e la costante:

```ts
/** Soglia di dedup etichette per prossimità (~3 km): a parità di testo quota,
 *  etichette più vicine di così vengono ridotte a una (feedback 2026-07-22). */
const LABEL_DEDUP_DEG = 0.03;

/** Centro del bounding box (anelli esterni): basta per confronti di vicinanza. */
function bboxCenter(g: Geometry): [number, number] {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const scan = (r: Position[]) => { for (const [x, y] of r) {
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  } };
  if (g.type === 'Polygon') scan(g.coordinates[0] ?? []);
  else if (g.type === 'MultiPolygon') for (const p of g.coordinates) scan(p[0] ?? []);
  else return [0, 0];
  return [(minx + maxx) / 2, (miny + maxy) / 2];
}
```

Poi, dentro `zonesToGeoJSON`, dopo la riga `const primaryByNameLabel = largestBy(...)`, aggiungi il secondo passaggio (soppressione per prossimità, additivo — non tocca la regola nome+quota):

```ts
  const isNameLabelPrimary = (i: number) =>
    primaryByNameLabel.get(`${zones[i].name} ${labels[i]}`) === i;
  // tra le primarie (nome+quota), sopprimi i doppioni di STESSO testo troppo
  // vicini: tiene la più estesa. Testi diversi (= quote diverse) mai toccati.
  const centers = zones.map((z) => bboxCenter(z.geometry));
  const keptByLabel = new Map<string, number[]>();
  const suppressed = new Set<number>();
  const candidates = zones.map((_, i) => i)
    .filter(isNameLabelPrimary)
    .sort((a, b) => areas[b] - areas[a]); // la più estesa vince
  for (const i of candidates) {
    const kept = keptByLabel.get(labels[i]) ?? [];
    const near = kept.some((j) => {
      const dx = centers[i][0] - centers[j][0], dy = centers[i][1] - centers[j][1];
      return dx * dx + dy * dy < LABEL_DEDUP_DEG * LABEL_DEDUP_DEG;
    });
    if (near) suppressed.add(i);
    else { kept.push(i); keptByLabel.set(labels[i], kept); }
  }
```

E nella costruzione delle properties, sostituisci la riga `labelPrimary`:

```ts
        labelPrimary: isNameLabelPrimary(i) && !suppressed.has(i),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/map/zonesToGeoJSON.test.ts`
Expected: PASS (nuovi + preesistenti; le fixture vecchie a scala di gradi restano invariate perché la regola nome+quota è preservata).

- [ ] **Step 5: Commit**

```bash
git add src/map/zonesToGeoJSON.ts tests/map/zonesToGeoJSON.test.ts
git commit -m "feat(map): dedup etichette-quota per prossimità (via i valori ripetuti)"
```

---

## Task 5: Verifica integrata + collaudo reale + MEMORIA

**Files:**
- Test: E2E `e2e/run.mjs`, `e2e/offline.mjs`, screenshot `e2e/shot.mjs`
- Modify: `MEMORIA.md`

- [ ] **Step 1: Suite completa + typecheck + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc pulito, tutta la suite verde, build ok. Annota il conteggio test.

- [ ] **Step 2: E2E headless (sul Mac)**

Run: `node e2e/run.mjs` poi `node e2e/offline.mjs` (Playwright; se serve, `npm i --no-save playwright` come da prassi progetto).
Expected: 15/15 e 11/11 verdi, zero errori console.

- [ ] **Step 3: Screenshot before/after col file ED-269 reale**

Usa `e2e/shot.mjs` sulla build di produzione a **Roma z11** e **Fiumicino z12/z13**, salvando in `.tmp-screens/round9/`. Se il file reale non è più sul Desktop, chiedere a Lorenzo di ri-esportarlo da D-Flight; in mancanza, usare `e2e/fixture-fiumicino.json`.
Verifica visiva: (a) nessun incrocio di bordi colorati ai confini tra categorie; (b) tratteggio percepibilmente più calmo; (c) niente "0 m"/"120 m" ripetuti a pochi millimetri. Confronta con `.tmp-screens/premium/fix-*` (baseline round 8).

- [ ] **Step 4: Performance del calcolo sul file reale**

Con il file reale importato, verifica in console che il primo calcolo dell'overlay resti nell'ordine di pochi secondi (baseline ~7s) e che il reload lo prenda dalla cache (istantaneo). Se la union cumulativa più esterna risultasse lenta o desse `failures`, la mitigazione è già dentro `unionAll` (albero+snap); annota i tempi misurati.

- [ ] **Step 5: Aggiorna MEMORIA e commit**

Aggiorna l'intestazione e il TODO di `MEMORIA.md`: round 9 "contorni puliti" (via i confini interni, hatch calmo, etichette dedup), con i numeri di suite/E2E, la nota che è **in attesa del verdetto di Lorenzo su iPhone**, e le leve di taratura (`HATCH_FILL_OPACITY`, `ZONE_LINE_WIDTH`, `LABEL_DEDUP_DEG`, graduazioni `buildCatLinePaint`). La baseline round 8 resta il punto di rollback finché Lorenzo non approva.

```bash
git add MEMORIA.md .tmp-screens
git commit -m "docs: MEMORIA — round 9 contorni puliti, in attesa del verdetto iPhone"
```

(Il push su `main` fa scattare il deploy Pages: farlo solo dopo l'ok di Lorenzo, come per i round precedenti. I push solo-docs non triggerano il deploy.)

---

## Self-Review

- **Spec coverage:** §Design/1 contorni → Task 1 (geometria) + Task 3 (rendering) + Task 2 (trasporto); §Design/2 hatch → Task 3; §Design/3 etichette → Task 4; §Testing → Task 1/4 (unit), Task 5 (E2E/reale/perf); §Fuori scope rispettato (veli/popup/verdetto non toccati). Cache versionata → Task 2 (load robusto al formato vecchio). Nessun requisito scoperto.
- **Placeholder scan:** nessun TODO/TBD; ogni step di codice mostra il codice; comandi con output atteso.
- **Type consistency:** `CategoryOverlay { fill, outline }` usato identico in fastUnion → worker → client → cache → db → orchestratore → MapView; `categoryOutlines`/`categoryOverlay`/`computeCategoryOverlay`/`loadCachedOverlay`/`saveCachedOverlay`/`categoryOverlayFor` coerenti tra Task 1-3; property `catOutline` (contorni) vs `catUnion` (veli) distinte; `SRC_CAT_LINE`/`HATCH_FILL_OPACITY` introdotte in Task 3 e usate lì.
- **Nota limite noto:** nascondere una categoria *intermedia* dalla legenda (es. solo auth) lascia il contorno cumulativo esterno (giallo) attorno anche all'area nascosta; caso d'uso marginale, il velo si nasconde comunque. Non in scope; da rivedere solo se emerge dal collaudo.
