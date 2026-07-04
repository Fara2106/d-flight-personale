# D-Flight personale — Fase 2: profili, motore regole, verifica on-demand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere al viewer di Fase 1 il verdetto personalizzato "posso volare qui?": profili drone/pilota, motore regole a tabella esplicita, verifica punto+cerchio, e rework accordion+evidenziazione del popup multi-zona.

**Architecture:** Tre moduli nuovi (`src/profiles/`, `src/rules/`, `src/verify/`). `rulesEngine` è funzioni pure `(zone, drone, pilota) → Verdict`, testabile senza browser. `intersect` è geometria pura (Turf modulare). `profileStore` replica lo stile di `zoneStore` su un DB IndexedDB condiviso portato a versione 2 (store nuovi `drones` e `settings`). La UI aggiunge ProfilePanel, VerifyControls, VerdictSheet e il rework del popup mappa.

**Tech Stack:** React 19 + TS 6 + Vite 8, MapLibre GL 5, `idb` 8, `@turf/circle` (già presente) + `@turf/boolean-intersects` + `@turf/helpers` (da aggiungere), Vitest 4 + Testing Library + fake-indexeddb, Tailwind v3 (solo utility; colori via CSS custom properties).

**Spec:** `docs/superpowers/specs/2026-07-03-dflight-fase2-pianificazione-design.md`

## Global Constraints

- **TypeScript:** `verbatimModuleSyntax: true` → import di soli tipi con `import type { X }` o `import { type X }`. `noUnusedLocals`/`noUnusedParameters` attivi su `src`. A fine di OGNI task eseguire anche `npx tsc -b` e riportarne l'esito (i test possono passare senza coprire tutti i file).
- **Test:** `npx vitest run <file>` per il singolo file, `npx vitest run` per la suite. Suite attuale: 39 test verdi — devono restare verdi.
- **Copy UI in italiano.** Approccio conservativo: mai un "ok" implicito; ogni lacuna → esito `verify` ("Verifica ufficialmente").
- **DOM del popup:** solo `textContent`/`createElement`, mai `innerHTML`/`setHTML` con dati del dataset.
- **CSS:** usare i token tema (`var(--surface)`, `var(--text)`, `var(--accent)`, `var(--shadow)`, `var(--text-muted)`). Qualsiasi override di CSS di libreria MapLibre va prefissato `:root` (gotcha cascata: `maplibre-gl.css` viene dopo nel grafo dei moduli).
- **Turf:** solo pacchetti modulari `@turf/*` v7 (tree-shakable). Niente `@turf/turf`.
- **Commit frequenti**, conventional (`feat:`, `test:`, `fix:`), un commit per step di commit indicato.
- **Gotcha iCloud:** se Vite/tsc falliscono con `ETIMEDOUT` o su file `* 2.*`: `find . -name "* 2.*" -not -path "./node_modules/*" -delete` e `brctl download .`.

## Decisioni di piano (delta rispetto alla spec, tutte conservative)

1. `Zone.applicabilityText?: string | null` è **opzionale** per non rompere le fixture esistenti e i record IndexedDB già salvati (undefined ≡ null).
2. `Verdict` ha in più il campo `subcategory: 'A1'|'A2'|'A3'|null` (la scheda lo mostra; la spec lo cita nelle note operative).
3. Quota: `verticalRef === null` (riferimento ignoto) **conta** nel `min` (conservativo); `AMSL`/`WGS84` → warning e non conteggiati (§5.3 spec).
4. Popup: con **una sola** zona l'accordion parte aperto (ed evidenzia); con più zone parte chiuso (lista di soli nomi).
5. Lo stato degradato "nessun drone attivo" è gestito in App (verdict `null` → CTA profilo nella scheda). L'engine resta difensivo (`verify` se chiamato senza drone). Un drone sub-250/C0 **senza attestati** riceve un verdetto valido: la riga 1 della tabella non richiede attestati (normativamente corretto); "nessuna qualifica → ⚠️" vale per i droni che la richiedono (la tabella restituisce assenza → `verify`).
6. Fix backlog Fase 1 incluso: lo stack di controlli in basso a destra passa a `bottom: 44` per non coprire l'attribution CARTO.
7. Code-splitting del bundle (1.24 MB): **fuori scope**, resta in backlog. Degli altri Minor del ledger `.superpowers/sdd/progress.md`: il popup `setHTML` raw e il flusso errori/tema erano già stati risolti nel polish `2b29d82`; l'overlap attribution è coperto dal Task 12; i restanti (import `describe` inutilizzati nei test, `f: any` in geocode, debounce ricerca) restano backlog — nessuno tocca i moduli di Fase 2.
8. E2E: Playwright installato con `npm i --no-save` (nessuna dipendenza in `package.json`, CI non tocca browser); fixture centrata su `ITALY_CENTER` (12.5, 42.0) così il click al centro del canvas colpisce le zone senza bisogno di geocoding di rete.

## File Structure

```
src/data/db.ts                     (nuovo)   apertura DB condivisa, schema v2
src/data/zoneStore.ts              (mod)     usa db.ts
src/data/ed269.types.ts            (mod)     + applicabilityText
src/data/normalizeZones.ts         (mod)     + formatter applicabilità
src/map/zonesToGeoJSON.ts          (mod)     + applicabilityText nelle properties
src/map/popupContent.ts            (mod)     rework accordion + onZoneFocus
src/map/MapView.tsx                (mod)     highlight layer, verify layer, click verify
src/profiles/profile.types.ts      (nuovo)   Drone, Pilot, CClass, label classi
src/profiles/profileStore.ts       (nuovo)   CRUD droni + settings
src/profiles/useProfiles.ts        (nuovo)   hook stato profili
src/profiles/ProfilePanel.tsx      (nuovo)   pannello profilo
src/rules/ruleTable.ts             (nuovo)   tabella decisionale + findRule
src/rules/rulesEngine.ts           (nuovo)   evaluate() → Verdict
src/verify/intersect.ts            (nuovo)   zonesAtPoint (Turf)
src/verify/verifyLayers.ts         (nuovo)   circleFeature
src/verify/VerifyControls.tsx      (nuovo)   overlay modalità verifica
src/verify/VerdictSheet.tsx        (nuovo)   scheda verdetto
src/App.tsx                        (mod)     integrazione
src/index.css                      (mod)     stili accordion popup, sheet
e2e/fixture-ed269.json             (nuovo)   3 zone sintetiche su ITALY_CENTER
e2e/run.mjs                        (nuovo)   E2E Playwright headless
```

---

### Task 1: Tipi profilo + DB condiviso v2

**Files:**
- Create: `src/profiles/profile.types.ts`
- Create: `src/data/db.ts`
- Modify: `src/data/zoneStore.ts`
- Test: `tests/data/db.test.ts`

**Interfaces:**
- Consumes: `Zone`, `DatasetMeta` da `src/data/ed269.types.ts`.
- Produces: `CClass`, `Drone`, `Competency`, `Pilot`, `C_CLASS_LABELS` da `profile.types.ts`; `db(): Promise<IDBPDatabase<DflSchema>>` da `db.ts` con store `zones`, `meta`, `drones`, `settings`. `zoneStore` mantiene invariata la sua API (`saveDataset`, `loadZones`, `loadMeta`).

- [ ] **Step 1: Crea i tipi profilo**

```ts
// src/profiles/profile.types.ts
export type CClass = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'sub250' | 'legacy250plus';

export interface Drone {
  id: string;
  name: string;
  massGrams: number;
  cClass: CClass;
}

/** validUntil: data ISO (yyyy-mm-dd); assente = senza scadenza. */
export interface Competency { validUntil?: string }

export interface Pilot {
  competencies: { a1a3?: Competency; a2?: Competency };
  operatorId?: string; // solo visualizzazione
}

export const C_CLASS_LABELS: Record<CClass, string> = {
  C0: 'C0', C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4',
  sub250: 'Sub-250 g senza classe',
  legacy250plus: 'Legacy ≥250 g senza classe',
};
```

- [ ] **Step 2: Scrivi il test della migrazione DB (deve fallire)**

```ts
// tests/data/db.test.ts
import { it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { db } from '../../src/data/db';

declare const IDBFactory: any;

beforeEach(() => { indexedDB = new IDBFactory(); });

it('crea i quattro store al primo avvio', async () => {
  const d = await db();
  expect([...d.objectStoreNames].sort()).toEqual(['drones', 'meta', 'settings', 'zones']);
  d.close();
});

it('migra un DB v1 esistente conservando le zone', async () => {
  const v1 = await openDB('dfl-personale', 1, {
    upgrade(d) {
      d.createObjectStore('zones', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  await v1.put('zones', { id: 'z1', name: 'Zona v1' } as any);
  v1.close();

  const d = await db();
  expect([...d.objectStoreNames].sort()).toEqual(['drones', 'meta', 'settings', 'zones']);
  expect(await d.get('zones', 'z1')).toMatchObject({ id: 'z1', name: 'Zona v1' });
  d.close();
});
```

- [ ] **Step 3: Verifica che fallisca**

Run: `npx vitest run tests/data/db.test.ts`
Expected: FAIL — `Cannot find module '../../src/data/db'`.

- [ ] **Step 4: Implementa db.ts e rifattorizza zoneStore**

```ts
// src/data/db.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Zone, DatasetMeta } from './ed269.types';
import type { Drone, Pilot } from '../profiles/profile.types';

export interface DflSchema extends DBSchema {
  zones: { key: string; value: Zone };
  meta: { key: string; value: DatasetMeta };
  drones: { key: string; value: Drone };
  settings: { key: string; value: string | Pilot };
}

const DB = 'dfl-personale', VER = 2;

export const db = (): Promise<IDBPDatabase<DflSchema>> => openDB<DflSchema>(DB, VER, {
  upgrade(d) {
    if (!d.objectStoreNames.contains('zones')) d.createObjectStore('zones', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    if (!d.objectStoreNames.contains('drones')) d.createObjectStore('drones', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings');
  },
});
```

```ts
// src/data/zoneStore.ts  (file completo dopo il refactor)
import { db } from './db';
import type { Zone, DatasetMeta } from './ed269.types';

const META_KEY = 'dataset';

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

- [ ] **Step 5: Verifica test nuovi e pregressi**

Run: `npx vitest run tests/data/db.test.ts tests/data/zoneStore.test.ts tests/data/importDataset.test.ts && npx tsc -b`
Expected: PASS (2 nuovi + i pregressi), tsc pulito.

- [ ] **Step 6: Commit**

```bash
git add src/profiles/profile.types.ts src/data/db.ts src/data/zoneStore.ts tests/data/db.test.ts
git commit -m "feat: tipi profilo e DB IndexedDB condiviso v2 (store drones/settings)"
```

---

### Task 2: profileStore

**Files:**
- Create: `src/profiles/profileStore.ts`
- Test: `tests/profiles/profileStore.test.ts`

**Interfaces:**
- Consumes: `db()` (Task 1), `Drone`, `Pilot` (Task 1).
- Produces: `listDrones(): Promise<Drone[]>`, `saveDrone(d: Drone): Promise<void>`, `deleteDrone(id: string): Promise<void>` (azzera anche il drone attivo se coincide), `getActiveDroneId(): Promise<string | null>`, `setActiveDroneId(id: string | null): Promise<void>`, `getPilot(): Promise<Pilot | null>`, `savePilot(p: Pilot): Promise<void>`.

- [ ] **Step 1: Scrivi i test (devono fallire)**

```ts
// tests/profiles/profileStore.test.ts
import { it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  listDrones, saveDrone, deleteDrone,
  getActiveDroneId, setActiveDroneId, getPilot, savePilot,
} from '../../src/profiles/profileStore';
import type { Drone, Pilot } from '../../src/profiles/profile.types';

declare const IDBFactory: any;

const mini: Drone = { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' };
const duo: Drone = { id: 'd2', name: 'Duo', massGrams: 900, cClass: 'C2' };

beforeEach(() => { indexedDB = new IDBFactory(); });

it('parte vuoto', async () => {
  expect(await listDrones()).toEqual([]);
  expect(await getActiveDroneId()).toBeNull();
  expect(await getPilot()).toBeNull();
});

it('salva, aggiorna ed elimina droni', async () => {
  await saveDrone(mini);
  await saveDrone(duo);
  expect(await listDrones()).toHaveLength(2);
  await saveDrone({ ...mini, name: 'Mini 4K' });
  expect((await listDrones()).find(d => d.id === 'd1')?.name).toBe('Mini 4K');
  await deleteDrone('d2');
  expect(await listDrones()).toHaveLength(1);
});

it('gestisce il drone attivo e lo azzera se eliminato', async () => {
  await saveDrone(mini);
  await setActiveDroneId('d1');
  expect(await getActiveDroneId()).toBe('d1');
  await deleteDrone('d1');
  expect(await getActiveDroneId()).toBeNull();
});

it('salva e rilegge il pilota', async () => {
  const p: Pilot = { competencies: { a1a3: {}, a2: { validUntil: '2027-01-31' } }, operatorId: 'ITA-OP-123' };
  await savePilot(p);
  expect(await getPilot()).toEqual(p);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/profiles/profileStore.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa**

```ts
// src/profiles/profileStore.ts
import { db } from '../data/db';
import type { Drone, Pilot } from './profile.types';

const ACTIVE_KEY = 'activeDroneId', PILOT_KEY = 'pilot';

export async function listDrones(): Promise<Drone[]> {
  return (await db()).getAll('drones');
}
export async function saveDrone(drone: Drone): Promise<void> {
  await (await db()).put('drones', drone);
}
export async function deleteDrone(id: string): Promise<void> {
  const d = await db();
  await d.delete('drones', id);
  if ((await d.get('settings', ACTIVE_KEY)) === id) await d.delete('settings', ACTIVE_KEY);
}
export async function getActiveDroneId(): Promise<string | null> {
  return ((await (await db()).get('settings', ACTIVE_KEY)) as string | undefined) ?? null;
}
export async function setActiveDroneId(id: string | null): Promise<void> {
  const d = await db();
  if (id === null) await d.delete('settings', ACTIVE_KEY);
  else await d.put('settings', id, ACTIVE_KEY);
}
export async function getPilot(): Promise<Pilot | null> {
  return ((await (await db()).get('settings', PILOT_KEY)) as Pilot | undefined) ?? null;
}
export async function savePilot(pilot: Pilot): Promise<void> {
  await (await db()).put('settings', pilot, PILOT_KEY);
}
```

- [ ] **Step 4: Verifica**

Run: `npx vitest run tests/profiles/profileStore.test.ts && npx tsc -b`
Expected: PASS (4 test), tsc pulito.

- [ ] **Step 5: Commit**

```bash
git add src/profiles/profileStore.ts tests/profiles/profileStore.test.ts
git commit -m "feat: profileStore — CRUD droni, drone attivo, pilota"
```

---

### Task 3: useProfiles

**Files:**
- Create: `src/profiles/useProfiles.ts`
- Test: `tests/profiles/useProfiles.test.tsx`

**Interfaces:**
- Consumes: tutte le funzioni di `profileStore` (Task 2).
- Produces: `useProfiles()` che ritorna `{ loaded: boolean; drones: Drone[]; activeDroneId: string | null; activeDrone: Drone | null; pilot: Pilot | null; upsertDrone(d: Drone): Promise<void>; removeDrone(id: string): Promise<void>; activate(id: string): Promise<void>; updatePilot(p: Pilot): Promise<void> }` e il tipo `export type UseProfiles = ReturnType<typeof useProfiles>`. Il **primo** drone inserito diventa automaticamente attivo.

- [ ] **Step 1: Scrivi i test (devono fallire)**

```tsx
// tests/profiles/useProfiles.test.tsx
import { it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useProfiles } from '../../src/profiles/useProfiles';
import type { Drone } from '../../src/profiles/profile.types';

declare const IDBFactory: any;

const mini: Drone = { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' };
const duo: Drone = { id: 'd2', name: 'Duo', massGrams: 900, cClass: 'C2' };

beforeEach(() => { indexedDB = new IDBFactory(); });

it('carica lo stato iniziale vuoto', async () => {
  const { result } = renderHook(() => useProfiles());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.drones).toEqual([]);
  expect(result.current.activeDrone).toBeNull();
});

it('il primo drone inserito diventa attivo; il secondo no', async () => {
  const { result } = renderHook(() => useProfiles());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.upsertDrone(mini));
  expect(result.current.activeDroneId).toBe('d1');
  await act(() => result.current.upsertDrone(duo));
  expect(result.current.activeDroneId).toBe('d1');
  await act(() => result.current.activate('d2'));
  expect(result.current.activeDrone?.name).toBe('Duo');
});

it('rimuovere il drone attivo azzera la selezione', async () => {
  const { result } = renderHook(() => useProfiles());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.upsertDrone(mini));
  await act(() => result.current.removeDrone('d1'));
  expect(result.current.drones).toEqual([]);
  expect(result.current.activeDroneId).toBeNull();
});

it('il pilota persiste tra i mount', async () => {
  const a = renderHook(() => useProfiles());
  await waitFor(() => expect(a.result.current.loaded).toBe(true));
  await act(() => a.result.current.updatePilot({ competencies: { a1a3: {} } }));
  a.unmount();
  const b = renderHook(() => useProfiles());
  await waitFor(() => expect(b.result.current.loaded).toBe(true));
  expect(b.result.current.pilot?.competencies.a1a3).toBeDefined();
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/profiles/useProfiles.test.tsx`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa**

```ts
// src/profiles/useProfiles.ts
import { useEffect, useState } from 'react';
import type { Drone, Pilot } from './profile.types';
import {
  listDrones, saveDrone, deleteDrone,
  getActiveDroneId, setActiveDroneId, getPilot, savePilot,
} from './profileStore';

export function useProfiles() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [activeDroneId, setActiveId] = useState<string | null>(null);
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { (async () => {
    setDrones(await listDrones());
    setActiveId(await getActiveDroneId());
    setPilot(await getPilot());
    setLoaded(true);
  })(); }, []);

  async function upsertDrone(d: Drone): Promise<void> {
    await saveDrone(d);
    const list = await listDrones();
    setDrones(list);
    if (list.length === 1) { await setActiveDroneId(d.id); setActiveId(d.id); }
  }
  async function removeDrone(id: string): Promise<void> {
    await deleteDrone(id);
    setDrones(await listDrones());
    setActiveId(await getActiveDroneId());
  }
  async function activate(id: string): Promise<void> {
    await setActiveDroneId(id);
    setActiveId(id);
  }
  async function updatePilot(p: Pilot): Promise<void> {
    await savePilot(p);
    setPilot(p);
  }

  const activeDrone = drones.find(d => d.id === activeDroneId) ?? null;
  return { loaded, drones, activeDroneId, activeDrone, pilot, upsertDrone, removeDrone, activate, updatePilot };
}

export type UseProfiles = ReturnType<typeof useProfiles>;
```

- [ ] **Step 4: Verifica**

Run: `npx vitest run tests/profiles/useProfiles.test.tsx && npx tsc -b`
Expected: PASS (4 test), tsc pulito.

- [ ] **Step 5: Commit**

```bash
git add src/profiles/useProfiles.ts tests/profiles/useProfiles.test.tsx
git commit -m "feat: hook useProfiles con auto-attivazione del primo drone"
```

---

### Task 4: ProfilePanel

**Files:**
- Create: `src/profiles/ProfilePanel.tsx`
- Test: `tests/profiles/ProfilePanel.test.tsx`

**Interfaces:**
- Consumes: `UseProfiles` (Task 3), `C_CLASS_LABELS`, tipi (Task 1).
- Produces: `ProfilePanel({ profiles, onClose }: { profiles: UseProfiles; onClose: () => void })` — pannello con lista droni (radio attivo, modifica, elimina), form aggiungi/salva con validazione (nome obbligatorio, massa > 0), blocco pilota (checkbox A1/A3 e A2 con scadenza opzionale, numero operatore).

- [ ] **Step 1: Scrivi i test (devono fallire)**

```tsx
// tests/profiles/ProfilePanel.test.tsx
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfilePanel } from '../../src/profiles/ProfilePanel';
import type { UseProfiles } from '../../src/profiles/useProfiles';
import type { Drone } from '../../src/profiles/profile.types';

const mini: Drone = { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' };

function stub(over: Partial<UseProfiles> = {}): UseProfiles {
  return {
    loaded: true, drones: [], activeDroneId: null, activeDrone: null, pilot: null,
    upsertDrone: vi.fn(async () => {}), removeDrone: vi.fn(async () => {}),
    activate: vi.fn(async () => {}), updatePilot: vi.fn(async () => {}),
    ...over,
  } as UseProfiles;
}

it('rifiuta un drone senza nome', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /aggiungi drone/i }));
  expect(screen.getByText(/nome è obbligatorio/i)).toBeInTheDocument();
  expect(p.upsertDrone).not.toHaveBeenCalled();
});

it('rifiuta una massa non positiva', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Mini' } });
  fireEvent.change(screen.getByLabelText(/massa/i), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /aggiungi drone/i }));
  expect(screen.getByText(/maggiore di zero/i)).toBeInTheDocument();
  expect(p.upsertDrone).not.toHaveBeenCalled();
});

it('salva un drone valido', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Mini' } });
  fireEvent.change(screen.getByLabelText(/massa/i), { target: { value: '249' } });
  fireEvent.change(screen.getByLabelText(/classe/i), { target: { value: 'sub250' } });
  fireEvent.click(screen.getByRole('button', { name: /aggiungi drone/i }));
  expect(p.upsertDrone).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Mini', massGrams: 249, cClass: 'sub250' }));
});

it('mostra i droni e attiva via radio', () => {
  const p = stub({ drones: [mini], activeDroneId: null });
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('radio', { name: /attiva mini/i }));
  expect(p.activate).toHaveBeenCalledWith('d1');
});

it('spunta A2 con scadenza e aggiorna il pilota', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /a2/i }));
  expect(p.updatePilot).toHaveBeenCalledWith(
    expect.objectContaining({ competencies: expect.objectContaining({ a2: {} }) }));
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/profiles/ProfilePanel.test.tsx`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa**

```tsx
// src/profiles/ProfilePanel.tsx
import { useState } from 'react';
import { C_CLASS_LABELS, type CClass, type Pilot } from './profile.types';
import type { UseProfiles } from './useProfiles';

const EMPTY = { name: '', massGrams: '', cClass: 'sub250' as CClass };

export function ProfilePanel(
  { profiles, onClose }: { profiles: UseProfiles; onClose: () => void }
) {
  const { drones, activeDroneId, pilot, upsertDrone, removeDrone, activate, updatePilot } = profiles;
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function submit() {
    const mass = Number(draft.massGrams);
    if (!draft.name.trim()) { setFormErr('Il nome è obbligatorio.'); return; }
    if (!Number.isFinite(mass) || mass <= 0) { setFormErr('Indica la massa in grammi, maggiore di zero.'); return; }
    await upsertDrone({
      id: editingId ?? crypto.randomUUID(),
      name: draft.name.trim(), massGrams: mass, cClass: draft.cClass,
    });
    setDraft(EMPTY); setEditingId(null); setFormErr(null);
  }

  const p: Pilot = pilot ?? { competencies: {} };
  function toggleComp(id: 'a1a3' | 'a2', on: boolean) {
    const competencies = { ...p.competencies };
    if (on) competencies[id] = competencies[id] ?? {};
    else delete competencies[id];
    void updatePilot({ ...p, competencies });
  }
  function setValidUntil(id: 'a1a3' | 'a2', v: string) {
    void updatePilot({
      ...p,
      competencies: { ...p.competencies, [id]: v ? { validUntil: v } : {} },
    });
  }

  return (
    <div role="dialog" aria-label="Profilo" className="rounded-2xl p-4"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)',
        width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 18 }}>Profilo</strong>
        <button onClick={onClose} aria-label="Chiudi profilo"
          style={{ color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
      </div>

      <h3 className="text-sm font-semibold" style={{ marginTop: 12 }}>I miei droni</h3>
      {drones.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Nessun drone: aggiungine uno qui sotto.
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {drones.map(d => (
          <li key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
            <input type="radio" name="drone-attivo" aria-label={`Attiva ${d.name}`}
              checked={activeDroneId === d.id} onChange={() => { void activate(d.id); }} />
            <span style={{ flex: 1 }}>
              {d.name}
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {' '}· {d.massGrams} g · {C_CLASS_LABELS[d.cClass]}
              </span>
            </span>
            <button className="text-xs" style={{ color: 'var(--accent)' }}
              onClick={() => {
                setEditingId(d.id);
                setDraft({ name: d.name, massGrams: String(d.massGrams), cClass: d.cClass });
              }}>Modifica</button>
            <button className="text-xs" style={{ color: '#ef4444' }}
              onClick={() => { void removeDrone(d.id); }}>Elimina</button>
          </li>
        ))}
      </ul>

      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        <label className="text-sm">Nome{' '}
          <input value={draft.name} aria-label="Nome"
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'transparent', width: '100%' }} />
        </label>
        <label className="text-sm">Massa (g){' '}
          <input type="number" value={draft.massGrams} aria-label="Massa (g)"
            onChange={e => setDraft({ ...draft, massGrams: e.target.value })}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'transparent', width: '100%' }} />
        </label>
        <label className="text-sm">Classe{' '}
          <select value={draft.cClass} aria-label="Classe"
            onChange={e => setDraft({ ...draft, cClass: e.target.value as CClass })}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'var(--surface)', width: '100%' }}>
            {(Object.keys(C_CLASS_LABELS) as CClass[]).map(c =>
              <option key={c} value={c}>{C_CLASS_LABELS[c]}</option>)}
          </select>
        </label>
        {formErr && <div className="text-sm" style={{ color: '#ef4444' }}>{formErr}</div>}
        <button onClick={() => { void submit(); }}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          {editingId ? 'Salva drone' : 'Aggiungi drone'}
        </button>
      </div>

      <h3 className="text-sm font-semibold" style={{ marginTop: 16 }}>Pilota</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {([['a1a3', 'A1/A3'], ['a2', 'A2']] as const).map(([id, label]) => (
          <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="text-sm" style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <input type="checkbox" aria-label={label}
                checked={!!p.competencies[id]} onChange={e => toggleComp(id, e.target.checked)} />
              Attestato {label}
            </label>
            {p.competencies[id] && (
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>scadenza{' '}
                <input type="date" aria-label={`Scadenza ${label}`}
                  value={p.competencies[id]?.validUntil ?? ''}
                  onChange={e => setValidUntil(id, e.target.value)}
                  className="rounded px-1"
                  style={{ border: '1px solid var(--text-muted)', background: 'transparent' }} />
              </label>
            )}
          </div>
        ))}
        <label className="text-sm">Numero operatore (facoltativo){' '}
          <input value={p.operatorId ?? ''} aria-label="Numero operatore"
            onChange={e => { void updatePilot({ ...p, operatorId: e.target.value || undefined }); }}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'transparent', width: '100%' }} />
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verifica**

Run: `npx vitest run tests/profiles/ProfilePanel.test.tsx && npx tsc -b`
Expected: PASS (5 test), tsc pulito.

- [ ] **Step 5: Commit**

```bash
git add src/profiles/ProfilePanel.tsx tests/profiles/ProfilePanel.test.tsx
git commit -m "feat: ProfilePanel — droni CRUD con drone attivo e blocco pilota"
```

---

### Task 5: applicabilityText sulle zone

**Files:**
- Modify: `src/data/ed269.types.ts` (interfaccia `Zone`)
- Modify: `src/data/normalizeZones.ts`
- Modify: `src/map/zonesToGeoJSON.ts`
- Test: `tests/data/normalizeZones.test.ts` (aggiunte in coda)

**Interfaces:**
- Produces: `Zone.applicabilityText?: string | null` — descrizione compatta della finestra di attività per zone non permanenti (`null`/assente per zone permanenti). Esposta anche nelle properties GeoJSON.

- [ ] **Step 1: Aggiungi i test (devono fallire)**

Aggiungere in coda a `tests/data/normalizeZones.test.ts`:

```ts
it('zona permanente → applicabilityText null', () => {
  const doc = { features: [{ identifier: 'p1', name: 'P', restriction: 'PROHIBITED',
    geometry: [{ horizontalProjection: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } }],
    applicability: [{ permanent: 'YES' }] }] } as any;
  expect(normalizeZones(doc)[0].applicabilityText).toBeNull();
});

it('zona a finestra → testo con date e schedule', () => {
  const doc = { features: [{ identifier: 's1', name: 'S', restriction: 'CONDITIONAL',
    geometry: [{ horizontalProjection: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } }],
    applicability: [{ permanent: 'NO',
      startDateTime: '2026-07-01T00:00:00Z', endDateTime: '2026-09-30T23:59:00Z',
      schedule: [{ day: ['MON', 'FRI'], startTime: '08:00', endTime: '20:00' }] }] }] } as any;
  const t = normalizeZones(doc)[0].applicabilityText;
  expect(t).toContain('2026-07-01');
  expect(t).toContain('2026-09-30');
  expect(t).toContain('MON, FRI');
  expect(t).toContain('08:00–20:00');
});

it('zona non permanente senza dettagli → testo generico', () => {
  const doc = { features: [{ identifier: 's2', name: 'S2', restriction: 'CONDITIONAL',
    geometry: [{ horizontalProjection: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } }],
    applicability: [{ permanent: 'NO' }] }] } as any;
  expect(normalizeZones(doc)[0].applicabilityText).toMatch(/orari|finestre/i);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/data/normalizeZones.test.ts`
Expected: FAIL — `applicabilityText` è `undefined`.

- [ ] **Step 3: Implementa**

In `src/data/ed269.types.ts`, dentro `interface Zone`, aggiungere dopo `permanent: boolean;`:

```ts
  /** Finestra di attività per zone non permanenti (testo compatto); null/assente = permanente.
   *  Opzionale per compatibilità con record IndexedDB salvati prima della Fase 2. */
  applicabilityText?: string | null;
```

In `src/data/normalizeZones.ts` aggiungere il formatter e usarlo:

```ts
function dateOf(iso: unknown): string | null {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : null;
}

function applicabilityTextOf(applic: any, permanent: boolean): string | null {
  if (permanent) return null;
  const parts: string[] = [];
  const from = dateOf(applic?.startDateTime), to = dateOf(applic?.endDateTime);
  if (from || to) parts.push([from, to].filter(Boolean).join(' → '));
  const sched = Array.isArray(applic?.schedule) ? applic.schedule : [];
  for (const s of sched) {
    const days = Array.isArray(s?.day) ? s.day.join(', ') : '';
    const hours = s?.startTime && s?.endTime ? `${s.startTime}–${s.endTime}` : '';
    const t = [days, hours].filter(Boolean).join(' ');
    if (t) parts.push(t);
  }
  return parts.length ? parts.join(' · ') : 'a orari/finestre — verifica su D-Flight';
}
```

e nel `zones.push({ ... })` sostituire la riga `permanent:` con:

```ts
      permanent,
      applicabilityText: applicabilityTextOf(applic, permanent),
```

dove subito prima del `zones.push({ ... })` si calcola una volta sola:

```ts
    const permanent = applic?.permanent === 'YES' || applic?.permanent === true || !applic;
```

In `src/map/zonesToGeoJSON.ts` aggiungere nelle `properties`:

```ts
        applicabilityText: z.applicabilityText ?? null,
```

- [ ] **Step 4: Verifica tutta la suite**

Run: `npx vitest run && npx tsc -b`
Expected: PASS (39 pregressi + 3 nuovi), tsc pulito.

- [ ] **Step 5: Commit**

```bash
git add src/data/ed269.types.ts src/data/normalizeZones.ts src/map/zonesToGeoJSON.ts tests/data/normalizeZones.test.ts
git commit -m "feat: applicabilityText — finestra di attività compatta per zone non permanenti"
```

---

### Task 6: ruleTable

**Files:**
- Create: `src/rules/ruleTable.ts`
- Test: `tests/rules/ruleTable.test.ts`

**Interfaces:**
- Consumes: `CClass` (Task 1).
- Produces: `Subcategory = 'A1'|'A2'|'A3'`, `CompetencyId = 'a1a3'|'a2'`, `SubcatRule { classes: CClass[]; requires: CompetencyId | null; subcategory: Subcategory; notes: string[]; reference: string }`, `RULE_TABLE: SubcatRule[]`, `findRule(cClass: CClass, valid: CompetencyId[]): SubcatRule | null`. Le righe sono in ordine di priorità: la prima applicabile vince (C2 con A2 → A2 prima di A3). Combinazione assente → `null` (mai un falso ok).

- [ ] **Step 1: Scrivi i test (devono fallire)**

```ts
// tests/rules/ruleTable.test.ts
import { it, expect } from 'vitest';
import { findRule, RULE_TABLE } from '../../src/rules/ruleTable';

it('ogni riga ha riferimento normativo e almeno una nota', () => {
  for (const r of RULE_TABLE) {
    expect(r.reference.length).toBeGreaterThan(0);
    expect(r.notes.length).toBeGreaterThan(0);
  }
});

it('sub-250/C0 volano in A1 anche senza attestati', () => {
  expect(findRule('sub250', [])?.subcategory).toBe('A1');
  expect(findRule('C0', [])?.subcategory).toBe('A1');
});

it('C1 richiede A1/A3', () => {
  expect(findRule('C1', ['a1a3'])?.subcategory).toBe('A1');
  expect(findRule('C1', [])).toBeNull();
});

it('C2 con A2 → A2; con solo A1/A3 → A3; senza nulla → null', () => {
  expect(findRule('C2', ['a1a3', 'a2'])?.subcategory).toBe('A2');
  expect(findRule('C2', ['a2'])?.subcategory).toBe('A2');
  expect(findRule('C2', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('C2', [])).toBeNull();
});

it('C3, C4 e legacy ≥250g → A3 con A1/A3', () => {
  expect(findRule('C3', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('C4', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('legacy250plus', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('legacy250plus', [])).toBeNull();
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/rules/ruleTable.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa**

```ts
// src/rules/ruleTable.ts
import type { CClass } from '../profiles/profile.types';

export type Subcategory = 'A1' | 'A2' | 'A3';
export type CompetencyId = 'a1a3' | 'a2';

export interface SubcatRule {
  classes: CClass[];
  /** Attestato richiesto; null = nessuno (resta l'obbligo di registrazione operatore). */
  requires: CompetencyId | null;
  subcategory: Subcategory;
  notes: string[];
  reference: string;
}

/** Righe in ordine di priorità: la prima applicabile vince. */
export const RULE_TABLE: SubcatRule[] = [
  {
    classes: ['sub250', 'C0'], requires: null, subcategory: 'A1',
    notes: [
      'Registrazione operatore UAS obbligatoria (salvo giocattoli senza sensori).',
      'Vietato il sorvolo di assembramenti di persone.',
      'Evitare il sorvolo di persone non coinvolte.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.020(5)(a)-(b)',
  },
  {
    classes: ['C1'], requires: 'a1a3', subcategory: 'A1',
    notes: [
      'Nessun sorvolo previsto di persone non coinvolte; se accade, ridurlo al minimo.',
      'Vietato il sorvolo di assembramenti di persone.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.020(4)(b) e (5)(c)',
  },
  {
    classes: ['C2'], requires: 'a2', subcategory: 'A2',
    notes: [
      'Distanza orizzontale minima 30 m da persone non coinvolte (5 m con modalità a bassa velocità attiva).',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.030',
  },
  {
    classes: ['C2'], requires: 'a1a3', subcategory: 'A3',
    notes: [
      'Volo solo in aree dove non si mettono in pericolo persone non coinvolte.',
      'Almeno 150 m da aree residenziali, commerciali, industriali o ricreative.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.040',
  },
  {
    classes: ['C3', 'C4'], requires: 'a1a3', subcategory: 'A3',
    notes: [
      'Volo solo in aree dove non si mettono in pericolo persone non coinvolte.',
      'Almeno 150 m da aree residenziali, commerciali, industriali o ricreative.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.040',
  },
  {
    classes: ['legacy250plus'], requires: 'a1a3', subcategory: 'A3',
    notes: [
      'Drone senza marcatura di classe ≥250 g: dal 1/1/2024 è ammessa solo la sottocategoria A3.',
      'Almeno 150 m da aree residenziali, commerciali, industriali o ricreative.',
    ],
    reference: 'Reg. (UE) 2019/947, art. 20; UAS.OPEN.040',
  },
];

export function findRule(cClass: CClass, valid: CompetencyId[]): SubcatRule | null {
  for (const r of RULE_TABLE) {
    if (!r.classes.includes(cClass)) continue;
    if (r.requires === null || valid.includes(r.requires)) return r;
  }
  return null;
}
```

**Nota deliverable (spec §5.5):** l'implementer valida ogni riga contro EU 2019/947 consolidato + Regolamento ENAC UAS-IT; se una nota o un riferimento risulta impreciso lo corregge nel commit citando la fonte nel messaggio.

- [ ] **Step 4: Verifica**

Run: `npx vitest run tests/rules/ruleTable.test.ts && npx tsc -b`
Expected: PASS (5 test), tsc pulito.

- [ ] **Step 5: Commit**

```bash
git add src/rules/ruleTable.ts tests/rules/ruleTable.test.ts
git commit -m "feat: tabella decisionale drone×attestato → sottocategoria Open con riferimenti"
```

---

### Task 7: rulesEngine

**Files:**
- Create: `src/rules/rulesEngine.ts`
- Test: `tests/rules/rulesEngine.test.ts`

**Interfaces:**
- Consumes: `findRule`, `Subcategory`, `CompetencyId` (Task 6); `Zone`, `RestrictionType` (Fase 1); `Drone`, `Pilot` (Task 1).
- Produces:
  ```ts
  type Outcome = 'ok' | 'conditions' | 'auth_required' | 'forbidden' | 'verify';
  interface Verdict {
    outcome: Outcome;
    subcategory: Subcategory | null;
    maxAltitudeM: number | null;     // null per forbidden/verify
    operationalNotes: string[];
    zones: Zone[];                   // ordinate per severità (per l'accordion)
    warnings: string[];
    references: string[];
  }
  evaluate(zones: Zone[], drone: Drone | null, pilot: Pilot | null, now?: Date): Verdict
  ```

- [ ] **Step 1: Scrivi i test (devono fallire)**

```ts
// tests/rules/rulesEngine.test.ts
import { it, expect, describe } from 'vitest';
import { evaluate } from '../../src/rules/rulesEngine';
import type { Zone } from '../../src/data/ed269.types';
import type { Drone, Pilot } from '../../src/profiles/profile.types';

const NOW = new Date('2026-07-04T12:00:00Z');
const geom = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } as const;

function zone(over: Partial<Zone>): Zone {
  return { id: 'z', name: 'Z', restrictionType: 'none', geometry: geom,
    lowerLimitM: 0, upperLimitM: null, verticalRef: 'AGL',
    message: null, reasons: [], authority: null, permanent: true, ...over };
}
const mini: Drone = { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' };
const duo: Drone = { id: 'd2', name: 'Duo', massGrams: 900, cClass: 'C2' };
const pilotA13: Pilot = { competencies: { a1a3: {} } };
const pilotFull: Pilot = { competencies: { a1a3: {}, a2: {} } };

describe('passo 1 — sottocategoria', () => {
  it.each([
    [mini, { competencies: {} } as Pilot, 'ok', 'A1'],
    [mini, pilotFull, 'ok', 'A1'],
    [duo, pilotFull, 'ok', 'A2'],
    [duo, pilotA13, 'ok', 'A3'],
  ] as const)('%#', (drone, pilot, outcome, subcat) => {
    const v = evaluate([], drone, pilot, NOW);
    expect(v.outcome).toBe(outcome);
    expect(v.subcategory).toBe(subcat);
    expect(v.references.length).toBeGreaterThan(0);
  });

  it('combinazione assente → verify, quota null', () => {
    const v = evaluate([], duo, { competencies: {} }, NOW);
    expect(v.outcome).toBe('verify');
    expect(v.maxAltitudeM).toBeNull();
  });

  it('senza drone → verify', () => {
    expect(evaluate([], null, pilotFull, NOW).outcome).toBe('verify');
  });

  it('A2 scaduta → trattata assente con warning, fallback A3', () => {
    const p: Pilot = { competencies: { a1a3: {}, a2: { validUntil: '2026-01-01' } } };
    const v = evaluate([], duo, p, NOW);
    expect(v.subcategory).toBe('A3');
    expect(v.warnings.join(' ')).toMatch(/A2 scadut/i);
  });

  it('A2 con scadenza futura → valida', () => {
    const p: Pilot = { competencies: { a2: { validUntil: '2027-01-01' } } };
    expect(evaluate([], duo, p, NOW).subcategory).toBe('A2');
  });
});

describe('passo 2 — severità zone', () => {
  it('prohibited vince su tutto: forbidden, quota null', () => {
    const v = evaluate([zone({ restrictionType: 'none' }), zone({ id: 'p', restrictionType: 'prohibited' })],
      mini, pilotFull, NOW);
    expect(v.outcome).toBe('forbidden');
    expect(v.maxAltitudeM).toBeNull();
    expect(v.zones[0].id).toBe('p'); // ordinate per severità
  });

  it('auth_required → auth_required con contatti autorità', () => {
    const v = evaluate([zone({ restrictionType: 'auth_required',
      authority: { name: 'ENAC', email: 'x@enac.it' } })], mini, pilotFull, NOW);
    expect(v.outcome).toBe('auth_required');
    expect(v.operationalNotes.join(' ')).toContain('ENAC');
  });

  it('conditional → conditions con il message della zona', () => {
    const v = evaluate([zone({ restrictionType: 'conditional', message: 'Solo sotto 50 m' })],
      mini, pilotFull, NOW);
    expect(v.outcome).toBe('conditions');
    expect(v.operationalNotes.join(' ')).toContain('Solo sotto 50 m');
  });

  it('nessuna zona → esito del passo 1', () => {
    expect(evaluate([], mini, pilotFull, NOW).outcome).toBe('ok');
  });
});

describe('passo 3 — quota', () => {
  it('min tra 120 e i soffitti AGL', () => {
    const v = evaluate([zone({ upperLimitM: 60 }), zone({ id: 'b', upperLimitM: 45 })],
      mini, pilotFull, NOW);
    expect(v.maxAltitudeM).toBe(45);
  });

  it('senza zone il tetto è 120', () => {
    expect(evaluate([], mini, pilotFull, NOW).maxAltitudeM).toBe(120);
  });

  it('AMSL non convertito: warning e non conteggiato', () => {
    const v = evaluate([zone({ upperLimitM: 500, verticalRef: 'AMSL' })], mini, pilotFull, NOW);
    expect(v.maxAltitudeM).toBe(120);
    expect(v.warnings.join(' ')).toMatch(/AMSL/);
  });

  it('riferimento ignoto (null): conteggiato, conservativo', () => {
    const v = evaluate([zone({ upperLimitM: 30, verticalRef: null })], mini, pilotFull, NOW);
    expect(v.maxAltitudeM).toBe(30);
  });
});

describe('passo 4 — validità temporale', () => {
  it('zona non permanente: conta nel verdetto + warning con finestra', () => {
    const v = evaluate([zone({ restrictionType: 'conditional', permanent: false,
      applicabilityText: 'MON, FRI 08:00–20:00' })], mini, pilotFull, NOW);
    expect(v.outcome).toBe('conditions');
    expect(v.warnings.join(' ')).toContain('MON, FRI 08:00–20:00');
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/rules/rulesEngine.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa**

```ts
// src/rules/rulesEngine.ts
import type { Zone, RestrictionType } from '../data/ed269.types';
import type { Drone, Pilot } from '../profiles/profile.types';
import { findRule, type CompetencyId, type Subcategory } from './ruleTable';

export type Outcome = 'ok' | 'conditions' | 'auth_required' | 'forbidden' | 'verify';

export interface Verdict {
  outcome: Outcome;
  subcategory: Subcategory | null;
  maxAltitudeM: number | null;
  operationalNotes: string[];
  zones: Zone[];
  warnings: string[];
  references: string[];
}

const SEVERITY: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};
const MAX_OPEN_AGL = 120;

const COMP_LABEL: Record<CompetencyId, string> = { a1a3: 'A1/A3', a2: 'A2' };

/** Attestati validi a `now`; le scadenze passate diventano warning. */
export function validCompetencies(
  pilot: Pilot | null, now: Date
): { valid: CompetencyId[]; warnings: string[] } {
  const valid: CompetencyId[] = [];
  const warnings: string[] = [];
  const comps = pilot?.competencies ?? {};
  for (const id of ['a1a3', 'a2'] as const) {
    const c = comps[id];
    if (!c) continue;
    if (c.validUntil && new Date(`${c.validUntil}T23:59:59`) < now) {
      warnings.push(`Attestato ${COMP_LABEL[id]} scaduto il ${c.validUntil}: trattato come assente.`);
    } else {
      valid.push(id);
    }
  }
  return { valid, warnings };
}

export function evaluate(
  zones: Zone[], drone: Drone | null, pilot: Pilot | null, now: Date = new Date()
): Verdict {
  const sorted = [...zones].sort(
    (a, b) => SEVERITY[a.restrictionType] - SEVERITY[b.restrictionType]);
  const { valid, warnings } = validCompetencies(pilot, now);

  const verdict: Verdict = {
    outcome: 'verify', subcategory: null, maxAltitudeM: null,
    operationalNotes: [], zones: sorted, warnings, references: [],
  };

  if (!drone) {
    verdict.warnings.push('Nessun drone attivo: configura il profilo.');
    return verdict;
  }
  const rule = findRule(drone.cClass, valid);
  if (!rule) {
    verdict.warnings.push('Combinazione drone/attestati non prevista in categoria Open: verifica ufficialmente.');
    return verdict;
  }
  verdict.subcategory = rule.subcategory;
  verdict.operationalNotes = [...rule.notes];
  verdict.references = [rule.reference];

  // Passo 4 — zone non permanenti: mai filtrate, sempre segnalate.
  for (const z of sorted) {
    if (!z.permanent) {
      verdict.warnings.push(
        `«${z.name}»: zona non permanente${z.applicabilityText ? ` (attiva: ${z.applicabilityText})` : ''} — conta comunque nel verdetto.`);
    }
  }

  // Passo 2 — la zona più severa decide l'esito.
  const worst: RestrictionType = sorted[0]?.restrictionType ?? 'none';
  if (worst === 'prohibited') {
    verdict.outcome = 'forbidden';
    return verdict; // quota null: non si vola
  }

  // Passo 3 — quota: min(120 AGL, soffitti AGL/ignoti); AMSL e WGS84 → warning.
  let max = MAX_OPEN_AGL;
  for (const z of sorted) {
    if (z.upperLimitM == null) continue;
    if (z.verticalRef === 'AMSL' || z.verticalRef === 'WGS84') {
      verdict.warnings.push(
        `«${z.name}»: soffitto ${z.upperLimitM} m ${z.verticalRef} — non convertito, verifica l'altitudine del luogo.`);
      continue;
    }
    max = Math.min(max, z.upperLimitM);
  }
  verdict.maxAltitudeM = max;

  if (worst === 'auth_required') {
    verdict.outcome = 'auth_required';
    for (const z of sorted) {
      if (z.restrictionType !== 'auth_required' || !z.authority) continue;
      const contact = [z.authority.name, z.authority.email, z.authority.phone]
        .filter(Boolean).join(' · ');
      if (contact) verdict.operationalNotes.push(`Autorizzazione per «${z.name}»: ${contact}`);
    }
    return verdict;
  }
  if (worst === 'conditional') {
    verdict.outcome = 'conditions';
    for (const z of sorted) {
      if (z.restrictionType === 'conditional' && z.message) {
        verdict.operationalNotes.push(`«${z.name}»: ${z.message}`);
      }
    }
    return verdict;
  }
  verdict.outcome = 'ok';
  return verdict;
}
```

- [ ] **Step 4: Verifica**

Run: `npx vitest run tests/rules/rulesEngine.test.ts && npx tsc -b`
Expected: PASS (15 test), tsc pulito.

- [ ] **Step 5: Commit**

```bash
git add src/rules/rulesEngine.ts tests/rules/rulesEngine.test.ts
git commit -m "feat: rulesEngine — verdetto conservativo in 4 passi (sottocategoria, severità, quota, finestre)"
```

---

### Task 8: intersect (Turf)

**Files:**
- Modify: `package.json` (nuove dipendenze)
- Create: `src/verify/intersect.ts`
- Test: `tests/verify/intersect.test.ts`

**Interfaces:**
- Consumes: `Zone` (Fase 1).
- Produces: `VerifyPoint { lat: number; lon: number; radiusM: number }`, `zonesAtPoint(zones: Zone[], p: VerifyPoint): Zone[]` — con `radiusM === 0` verifica puntuale (il bordo conta come dentro: conservativo); ordine di ritorno = ordine di input (l'ordinamento per severità lo fa l'engine).

- [ ] **Step 1: Aggiungi le dipendenze**

Run: `npm install @turf/boolean-intersects@^7 @turf/helpers@^7`
Expected: installate (stessa major di `@turf/circle` 7.x già presente).

- [ ] **Step 2: Scrivi i test (devono fallire)**

```ts
// tests/verify/intersect.test.ts
import { it, expect } from 'vitest';
import { zonesAtPoint } from '../../src/verify/intersect';
import type { Zone } from '../../src/data/ed269.types';

// Quadrato ~222 m di lato: lon/lat ∈ [0, 0.002] (all'equatore 0.001° ≈ 111 m)
function square(id: string, x0 = 0, y0 = 0, s = 0.002): Zone {
  return { id, name: id, restrictionType: 'conditional',
    geometry: { type: 'Polygon', coordinates: [[
      [x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]]] },
    lowerLimitM: 0, upperLimitM: 60, verticalRef: 'AGL',
    message: null, reasons: [], authority: null, permanent: true };
}

it('punto dentro (raggio 0)', () => {
  expect(zonesAtPoint([square('a')], { lat: 0.001, lon: 0.001, radiusM: 0 })).toHaveLength(1);
});

it('punto fuori (raggio 0)', () => {
  expect(zonesAtPoint([square('a')], { lat: 0.01, lon: 0.01, radiusM: 0 })).toHaveLength(0);
});

it('punto sul bordo conta come dentro (conservativo)', () => {
  expect(zonesAtPoint([square('a')], { lat: 0.001, lon: 0, radiusM: 0 })).toHaveLength(1);
});

it('cerchio che interseca senza contenere il centro', () => {
  // centro a lon 0.004 (~222 m dal bordo destro del quadrato)
  const hit = zonesAtPoint([square('a')], { lat: 0.001, lon: 0.004, radiusM: 300 });
  expect(hit).toHaveLength(1);
  const miss = zonesAtPoint([square('a')], { lat: 0.001, lon: 0.004, radiusM: 100 });
  expect(miss).toHaveLength(0);
});

it('multi-zona sovrapposte: le ritorna tutte, in ordine di input', () => {
  const zs = [square('a'), square('b', 0.001, 0.001)];
  const hit = zonesAtPoint(zs, { lat: 0.0015, lon: 0.0015, radiusM: 0 });
  expect(hit.map(z => z.id)).toEqual(['a', 'b']);
});
```

- [ ] **Step 3: Verifica che falliscano**

Run: `npx vitest run tests/verify/intersect.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 4: Implementa**

```ts
// src/verify/intersect.ts
import circle from '@turf/circle';
import booleanIntersects from '@turf/boolean-intersects';
import { point, feature } from '@turf/helpers';
import type { Zone } from '../data/ed269.types';

export interface VerifyPoint { lat: number; lon: number; radiusM: number }

/** Zone toccate dal punto (radiusM = 0) o dal cerchio; il bordo conta come dentro. */
export function zonesAtPoint(zones: Zone[], p: VerifyPoint): Zone[] {
  const probe = p.radiusM > 0
    ? circle([p.lon, p.lat], p.radiusM / 1000, { steps: 64, units: 'kilometers' })
    : point([p.lon, p.lat]);
  return zones.filter(z => booleanIntersects(probe, feature(z.geometry)));
}
```

- [ ] **Step 5: Verifica**

Run: `npx vitest run tests/verify/intersect.test.ts && npx tsc -b`
Expected: PASS (5 test), tsc pulito.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/verify/intersect.ts tests/verify/intersect.test.ts
git commit -m "feat: zonesAtPoint — intersezione punto/cerchio con le zone (Turf modulare)"
```

---

### Task 9: Popup accordion + evidenziazione zona

**Files:**
- Modify: `src/map/popupContent.ts` (rework)
- Modify: `src/map/MapView.tsx` (layer highlight + nuove prop + close popup)
- Modify: `src/index.css` (stili accordion)
- Test: `tests/map/popupContent.test.ts` (riscrittura), `tests/map/zoneLayers.test.ts` (aggiunta `highlightFilter`)

**Interfaces:**
- Consumes: `ZONE_COLORS` (Fase 1), properties GeoJSON (ora con `applicabilityText`, Task 5).
- Produces:
  - `buildPopupContent(items: Array<Record<string, unknown>>, onZoneFocus?: (id: string | null) => void): HTMLElement` — lista compatta dei nomi ordinati per severità; **una sola** zona aperta alla volta; apertura → `onZoneFocus(id)`, chiusura → `onZoneFocus(null)`; con una sola zona parte aperta.
  - `highlightFilter(id: string | null)` esportata da `MapView.tsx` (filtro MapLibre del layer `zones-highlight`).
  - Nuove prop MapView: `highlightZoneId?: string | null`, `onZoneFocus?: (id: string | null) => void`.

- [ ] **Step 1: Riscrivi i test del popup (devono fallire)**

Sostituire l'intero contenuto di `tests/map/popupContent.test.ts` con:

```ts
// tests/map/popupContent.test.ts
import { it, expect, vi } from 'vitest';
import { buildPopupContent } from '../../src/map/popupContent';

const zoneA = { id: 'a', name: 'Alfa', restrictionType: 'conditional',
  label: '≤ 60 m', upperLimitM: 60, verticalRef: 'AGL', message: 'Nota A', applicabilityText: null };
const zoneP = { id: 'p', name: 'Papa', restrictionType: 'prohibited',
  label: '⛔ 0 m', upperLimitM: 0, verticalRef: 'AGL', message: null, applicabilityText: 'MON 08:00–20:00' };

it('dedup per id e ordinamento per restrittività (prohibited primo)', () => {
  const el = buildPopupContent([zoneA, zoneP, zoneA]);
  const names = [...el.querySelectorAll('.zone-popup-head strong')].map(n => n.textContent);
  expect(names).toEqual(['Papa', 'Alfa']);
});

it('multi-zona: dettagli chiusi in partenza', () => {
  const el = buildPopupContent([zoneA, zoneP]);
  const details = [...el.querySelectorAll('.zone-popup-detail')] as HTMLElement[];
  expect(details).toHaveLength(2);
  expect(details.every(d => d.hidden)).toBe(true);
});

it('click su un nome apre solo quel dettaglio e notifica il focus', () => {
  const focus = vi.fn();
  const el = buildPopupContent([zoneA, zoneP], focus);
  const heads = [...el.querySelectorAll('.zone-popup-head')] as HTMLElement[];
  heads[1].click(); // Alfa
  const details = [...el.querySelectorAll('.zone-popup-detail')] as HTMLElement[];
  expect(details[1].hidden).toBe(false);
  expect(details[0].hidden).toBe(true);
  expect(focus).toHaveBeenLastCalledWith('a');
  heads[0].click(); // Papa: chiude Alfa
  expect(details[0].hidden).toBe(false);
  expect(details[1].hidden).toBe(true);
  expect(focus).toHaveBeenLastCalledWith('p');
});

it('ri-click sulla zona aperta la chiude e azzera il focus', () => {
  const focus = vi.fn();
  const el = buildPopupContent([zoneA, zoneP], focus);
  const head = el.querySelector('.zone-popup-head') as HTMLElement;
  head.click();
  head.click();
  expect(focus).toHaveBeenLastCalledWith(null);
  const detail = el.querySelector('.zone-popup-detail') as HTMLElement;
  expect(detail.hidden).toBe(true);
});

it('singola zona: parte aperta e con focus', () => {
  const focus = vi.fn();
  const el = buildPopupContent([zoneA], focus);
  const detail = el.querySelector('.zone-popup-detail') as HTMLElement;
  expect(detail.hidden).toBe(false);
  expect(focus).toHaveBeenLastCalledWith('a');
});

it('il dettaglio mostra quota, message e finestra di attività (solo textContent)', () => {
  const el = buildPopupContent([zoneP]);
  const detail = el.querySelector('.zone-popup-detail') as HTMLElement;
  expect(detail.textContent).toContain('0 m AGL');
  expect(detail.textContent).toContain('MON 08:00–20:00');
  expect(el.innerHTML).not.toContain('<script');
});
```

Aggiungere in coda a `tests/map/zoneLayers.test.ts`:

```ts
import { highlightFilter } from '../../src/map/MapView';

it('highlightFilter: id selezionato o sentinella che non matcha nulla', () => {
  expect(highlightFilter('z9')).toEqual(['==', ['get', 'id'], 'z9']);
  expect(highlightFilter(null)).toEqual(['==', ['get', 'id'], '__none__']);
});
```

(Se l'import di `MapView` in ambiente jsdom fallisse per il CSS di maplibre, la funzione va spostata in `src/map/mapStyle.ts` e importata da lì in MapView — mantenere lo stesso nome. `tests/map/zoneLayers.test.ts` importa già oggi `buildFillPaint` da MapView, quindi non è atteso alcun problema.)

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/map/popupContent.test.ts tests/map/zoneLayers.test.ts`
Expected: FAIL — nuova firma/`highlightFilter` inesistente.

- [ ] **Step 3: Implementa il popup**

Sostituire l'intero contenuto di `src/map/popupContent.ts` con:

```ts
import { ZONE_COLORS } from './mapStyle';
import type { RestrictionType } from '../data/ed269.types';

const ORDER: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};
const FALLBACK_COLOR = '#888888';

/** Popup per una o più zone sovrapposte: lista compatta dei nomi ordinati per
 *  restrittività, accordion una-zona-alla-volta; l'apertura notifica onZoneFocus(id)
 *  per l'evidenziazione sulla mappa. Solo textContent (niente HTML raw). */
export function buildPopupContent(
  items: Array<Record<string, unknown>>,
  onZoneFocus?: (id: string | null) => void,
): HTMLElement {
  const seen = new Set<unknown>();
  const zones = items.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  zones.sort((a, b) =>
    (ORDER[a.restrictionType as RestrictionType] ?? 99) -
    (ORDER[b.restrictionType as RestrictionType] ?? 99));

  const root = document.createElement('div');
  root.className = 'zone-popup';
  let openId: string | null = null;
  const details = new Map<string, HTMLElement>();

  const setOpen = (id: string | null) => {
    openId = id;
    for (const [zid, el] of details) el.hidden = zid !== id;
    onZoneFocus?.(id);
  };

  for (const p of zones) {
    const id = String(p.id ?? '');
    const item = document.createElement('div');
    item.className = 'zone-popup-item';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'zone-popup-head';
    const dot = document.createElement('span');
    dot.className = 'zone-popup-dot';
    dot.style.backgroundColor =
      ZONE_COLORS[p.restrictionType as RestrictionType] ?? FALLBACK_COLOR;
    head.appendChild(dot);
    const name = document.createElement('strong');
    name.textContent = typeof p.name === 'string' ? p.name : '';
    head.appendChild(name);
    head.addEventListener('click', () => setOpen(openId === id ? null : id));
    item.appendChild(head);

    const detail = document.createElement('div');
    detail.className = 'zone-popup-detail';
    detail.hidden = true;
    const ref = p.verticalRef ? ` ${p.verticalRef}` : '';
    const lines = [
      typeof p.label === 'string' ? p.label : '—',
      `Quota max: ${p.upperLimitM != null ? `${p.upperLimitM} m${ref}` : '—'}`,
    ];
    if (typeof p.message === 'string' && p.message) lines.push(p.message);
    if (typeof p.applicabilityText === 'string' && p.applicabilityText) {
      lines.push(`Attiva: ${p.applicabilityText}`);
    }
    for (const t of lines) {
      const row = document.createElement('div');
      row.textContent = t;
      detail.appendChild(row);
    }
    details.set(id, detail);
    item.appendChild(detail);
    root.appendChild(item);
  }

  if (zones.length === 1) setOpen(String(zones[0].id ?? ''));
  return root;
}
```

- [ ] **Step 4: Aggiorna MapView (highlight + wiring popup)**

In `src/map/MapView.tsx`:

1. Esporta il filtro e aggiungi il layer highlight. Dopo la definizione di `SRC` aggiungi:

```ts
export function highlightFilter(id: string | null): maplibregl.FilterSpecification {
  return ['==', ['get', 'id'], id ?? '__none__'] as maplibregl.FilterSpecification;
}
```

2. `addZoneLayers` prende il highlight corrente e aggiunge il layer (dopo `zones-line`, prima di `zones-label`):

```ts
function addZoneLayers(map: maplibregl.Map, zones: Zone[], highlightId: string | null) {
  const data = zonesToGeoJSON(zones) as any;
  const fillPaint = buildFillPaint()!;
  if (map.getSource(SRC)) { (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(data); return; }
  map.addSource(SRC, { type: 'geojson', data });
  map.addLayer({ id: 'zones-fill', type: 'fill', source: SRC, paint: fillPaint });
  map.addLayer({ id: 'zones-line', type: 'line', source: SRC,
    paint: { 'line-color': fillPaint['fill-color'] as any, 'line-width': 1.2 } });
  map.addLayer({ id: 'zones-highlight', type: 'line', source: SRC,
    filter: highlightFilter(highlightId),
    paint: { 'line-color': '#0a84ff', 'line-width': 3 } });
  map.addLayer({ id: 'zones-label', type: 'symbol', source: SRC,
    layout: { 'text-field': ['get', 'label'], 'text-size': 12,
      'text-font': ['Open Sans Regular', 'Noto Sans Regular'] },
    paint: { 'text-color': '#1c2530', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
}
```

3. Nuove prop e ref (firma del componente):

```tsx
export function MapView(
  { resolvedTheme, zones, onZoneClick, userPosition, flyTo, highlightZoneId, onZoneFocus }:
  { resolvedTheme: 'light' | 'dark'; zones: Zone[];
    onZoneClick?: (props: Record<string, unknown>) => void;
    userPosition?: { lat: number; lon: number; accuracy: number } | null;
    flyTo?: { lat: number; lon: number } | null;
    highlightZoneId?: string | null;
    onZoneFocus?: (id: string | null) => void }
) {
```

dentro il componente, accanto a `zonesRef`:

```ts
  const highlightRef = useRef<string | null>(highlightZoneId ?? null);
  const onZoneFocusRef = useRef(onZoneFocus);
  onZoneFocusRef.current = onZoneFocus;
```

4. Aggiorna le tre chiamate esistenti a `addZoneLayers`: `addZoneLayers(m, zonesRef.current, highlightRef.current)` nell'`on('load')`, `addZoneLayers(m, zonesRef.current, highlightRef.current)` nel callback `styledata` del cambio tema (usare `zonesRef.current` invece della closure `zones`), `addZoneLayers(m, zones, highlightRef.current)` nell'effetto su `zones`.

5. Nel click handler del popup, collega focus e chiusura:

```ts
    m.on('click', 'zones-fill', (e) => {
      const feats = e.features ?? [];
      if (feats.length === 0) return;
      if (onZoneClick) onZoneClick(feats[0].properties || {});
      const popup = new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setDOMContent(buildPopupContent(
          feats.map((f) => f.properties ?? {}),
          (id) => onZoneFocusRef.current?.(id)))
        .addTo(m);
      popup.on('close', () => onZoneFocusRef.current?.(null));
    });
```

6. Nuovo effetto per il filtro highlight:

```ts
  useEffect(() => {
    highlightRef.current = highlightZoneId ?? null;
    const m = map.current;
    if (m && m.getLayer('zones-highlight')) {
      m.setFilter('zones-highlight', highlightFilter(highlightZoneId ?? null));
    }
  }, [highlightZoneId]);
```

- [ ] **Step 5: Stili accordion in index.css**

Sostituire il blocco "Contenuto popup multi-zona" di `src/index.css` con:

```css
/* Contenuto popup multi-zona (accordion) */
.zone-popup { max-height: 240px; overflow-y: auto; min-width: 200px; }
.zone-popup-item + .zone-popup-item { border-top: 1px solid rgba(138, 147, 160, 0.25); }
.zone-popup-head { display: flex; gap: 8px; align-items: center; width: 100%;
  padding: 6px 0; background: none; border: 0; color: inherit; font: inherit;
  text-align: left; cursor: pointer; }
.zone-popup-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.zone-popup-detail { padding: 0 0 8px 18px; color: var(--text-muted); }
```

- [ ] **Step 6: Verifica tutta la suite**

Run: `npx vitest run && npx tsc -b`
Expected: PASS (popup 6 test nuovi, resto verde), tsc pulito.

- [ ] **Step 7: Commit**

```bash
git add src/map/popupContent.ts src/map/MapView.tsx src/index.css tests/map/popupContent.test.ts tests/map/zoneLayers.test.ts
git commit -m "feat: popup accordion una-zona-alla-volta con evidenziazione della zona sulla mappa"
```

---

### Task 10: VerdictSheet

**Files:**
- Create: `src/verify/VerdictSheet.tsx`
- Modify: `src/index.css` (classe `.verdict-sheet`)
- Test: `tests/verify/VerdictSheet.test.tsx`

**Interfaces:**
- Consumes: `Verdict`, `Outcome` (Task 7), `Drone` (Task 1), `ZONE_COLORS` (Fase 1), `Zone.applicabilityText` (Task 5).
- Produces:
  ```tsx
  VerdictSheet({ verdict, drones, activeDroneId, onSelectDrone, onOpenProfile, onClose, onZoneFocus }: {
    verdict: Verdict | null;            // null = nessun drone attivo → CTA profilo
    drones: Drone[];
    activeDroneId: string | null;
    onSelectDrone: (id: string) => void;
    onOpenProfile: () => void;
    onClose: () => void;
    onZoneFocus: (id: string | null) => void;
  })
  ```
  Allo smontaggio chiama `onZoneFocus(null)`.

- [ ] **Step 1: Scrivi i test (devono fallire)**

```tsx
// tests/verify/VerdictSheet.test.tsx
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerdictSheet } from '../../src/verify/VerdictSheet';
import type { Verdict } from '../../src/rules/rulesEngine';
import type { Zone } from '../../src/data/ed269.types';
import type { Drone } from '../../src/profiles/profile.types';

const geom = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } as const;
const zA: Zone = { id: 'a', name: 'Alfa', restrictionType: 'conditional', geometry: geom,
  lowerLimitM: 0, upperLimitM: 60, verticalRef: 'AGL', message: 'Nota A',
  reasons: [], authority: null, permanent: true };
const zB: Zone = { ...zA, id: 'b', name: 'Beta' };
const drones: Drone[] = [
  { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' },
  { id: 'd2', name: 'Duo', massGrams: 900, cClass: 'C2' },
];

function verdict(over: Partial<Verdict> = {}): Verdict {
  return { outcome: 'conditions', subcategory: 'A1', maxAltitudeM: 60,
    operationalNotes: ['Nota operativa'], zones: [zA, zB],
    warnings: ['Warning X'], references: ['Reg. (UE) 2019/947'], ...over };
}
function noop() {}
function base(over: Partial<Parameters<typeof VerdictSheet>[0]> = {}) {
  return { verdict: verdict(), drones, activeDroneId: 'd1',
    onSelectDrone: noop, onOpenProfile: noop, onClose: noop, onZoneFocus: noop, ...over };
}

it('mostra esito, quota, note, warnings e link D-Flight', () => {
  render(<VerdictSheet {...base()} />);
  expect(screen.getByText(/con condizioni/i)).toBeInTheDocument();
  expect(screen.getByText(/60 m AGL/)).toBeInTheDocument();
  expect(screen.getByText('Nota operativa')).toBeInTheDocument();
  expect(screen.getByText(/Warning X/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /d-flight/i })).toHaveAttribute('href', 'https://www.d-flight.it');
});

it('forbidden: quota — e titolo vietato', () => {
  render(<VerdictSheet {...base({ verdict: verdict({ outcome: 'forbidden', maxAltitudeM: null }) })} />);
  expect(screen.getByText(/vietato/i)).toBeInTheDocument();
  expect(screen.getByText(/Quota massima: —/)).toBeInTheDocument();
});

it('accordion: una zona alla volta + onZoneFocus', () => {
  const focus = vi.fn();
  render(<VerdictSheet {...base({ onZoneFocus: focus })} />);
  fireEvent.click(screen.getByRole('button', { name: /alfa/i }));
  expect(focus).toHaveBeenLastCalledWith('a');
  expect(screen.getByText('Nota A')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /beta/i }));
  expect(focus).toHaveBeenLastCalledWith('b');
  expect(screen.queryByText('Nota A')).not.toBeInTheDocument();
});

it('cambio drone → onSelectDrone', () => {
  const sel = vi.fn();
  render(<VerdictSheet {...base({ onSelectDrone: sel })} />);
  fireEvent.change(screen.getByLabelText(/drone/i), { target: { value: 'd2' } });
  expect(sel).toHaveBeenCalledWith('d2');
});

it('senza verdetto (nessun drone): CTA al profilo, nessun esito', () => {
  const open = vi.fn();
  render(<VerdictSheet {...base({ verdict: null, drones: [], activeDroneId: null, onOpenProfile: open })} />);
  fireEvent.click(screen.getByRole('button', { name: /apri profilo/i }));
  expect(open).toHaveBeenCalled();
  expect(screen.queryByText(/consentito|vietato/i)).not.toBeInTheDocument();
});

it('allo smontaggio azzera il focus', () => {
  const focus = vi.fn();
  const { unmount } = render(<VerdictSheet {...base({ onZoneFocus: focus })} />);
  unmount();
  expect(focus).toHaveBeenLastCalledWith(null);
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/verify/VerdictSheet.test.tsx`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa**

```tsx
// src/verify/VerdictSheet.tsx
import { useEffect, useRef, useState } from 'react';
import type { Verdict, Outcome } from '../rules/rulesEngine';
import type { Drone } from '../profiles/profile.types';
import { ZONE_COLORS } from '../map/mapStyle';

const OUTCOME_UI: Record<Outcome, { icon: string; title: string; color: string }> = {
  ok: { icon: '✅', title: 'Volo consentito', color: '#22c55e' },
  conditions: { icon: '🟡', title: 'Consentito con condizioni', color: '#b8860b' },
  auth_required: { icon: '🟠', title: 'Serve autorizzazione', color: '#f59e0b' },
  forbidden: { icon: '⛔', title: 'Volo vietato', color: '#ef4444' },
  verify: { icon: '⚠️', title: 'Verifica ufficialmente', color: '#8a93a0' },
};

export function VerdictSheet(
  { verdict, drones, activeDroneId, onSelectDrone, onOpenProfile, onClose, onZoneFocus }: {
    verdict: Verdict | null;
    drones: Drone[];
    activeDroneId: string | null;
    onSelectDrone: (id: string) => void;
    onOpenProfile: () => void;
    onClose: () => void;
    onZoneFocus: (id: string | null) => void;
  }
) {
  const [openZoneId, setOpenZoneId] = useState<string | null>(null);
  const focusRef = useRef(onZoneFocus);
  focusRef.current = onZoneFocus;
  useEffect(() => () => focusRef.current(null), []);

  function toggleZone(id: string) {
    const next = openZoneId === id ? null : id;
    setOpenZoneId(next);
    onZoneFocus(next);
  }

  return (
    <div className="verdict-sheet rounded-2xl p-4" role="dialog" aria-label="Verdetto"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Posso volare qui?</strong>
        <button onClick={onClose} aria-label="Chiudi verdetto"
          style={{ color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
      </div>

      {drones.length > 0 && (
        <label className="text-sm" style={{ display: 'block', marginTop: 8 }}>Drone{' '}
          <select value={activeDroneId ?? ''} aria-label="Drone"
            onChange={e => onSelectDrone(e.target.value)}
            className="rounded px-2 py-1"
            style={{ border: '1px solid var(--text-muted)', background: 'var(--surface)' }}>
            {drones.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}

      {!verdict ? (
        <div style={{ marginTop: 10 }}>
          <p className="text-sm">⚠️ Configura un drone e le tue qualifiche per avere il verdetto.</p>
          <button onClick={onOpenProfile}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)', marginTop: 6 }}>Apri profilo</button>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 10, fontSize: 20, fontWeight: 700,
            color: OUTCOME_UI[verdict.outcome].color }}>
            {OUTCOME_UI[verdict.outcome].icon} {OUTCOME_UI[verdict.outcome].title}
          </div>
          {verdict.subcategory && (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sottocategoria {verdict.subcategory}
            </div>
          )}
          <div className="text-sm" style={{ marginTop: 4 }}>
            Quota massima: {verdict.maxAltitudeM != null ? `${verdict.maxAltitudeM} m AGL` : '—'}
          </div>

          {verdict.operationalNotes.length > 0 && (
            <ul className="text-sm" style={{ paddingLeft: 18, marginTop: 6 }}>
              {verdict.operationalNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {verdict.warnings.length > 0 && (
            <ul className="text-sm" style={{ paddingLeft: 18, marginTop: 6, color: '#b45309' }}>
              {verdict.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
            </ul>
          )}

          {verdict.zones.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong className="text-sm">Perché — zone toccate</strong>
              {verdict.zones.map(z => (
                <div key={z.id}>
                  <button onClick={() => toggleZone(z.id)}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%',
                      padding: '5px 0', background: 'none', border: 0, color: 'inherit',
                      font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none',
                      background: ZONE_COLORS[z.restrictionType] }} />
                    {z.name}
                  </button>
                  {openZoneId === z.id && (
                    <div className="text-sm" style={{ color: 'var(--text-muted)', paddingLeft: 18 }}>
                      <div>Quota max: {z.upperLimitM != null
                        ? `${z.upperLimitM} m${z.verticalRef ? ` ${z.verticalRef}` : ''}` : '—'}</div>
                      {z.message && <div>{z.message}</div>}
                      {z.applicabilityText && <div>Attiva: {z.applicabilityText}</div>}
                      {z.authority?.name && <div>Autorità: {z.authority.name}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {verdict.references.length > 0 && (
            <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {verdict.references.join(' · ')}
            </div>
          )}
        </>
      )}

      <a href="https://www.d-flight.it" target="_blank" rel="noreferrer"
        className="text-sm" style={{ color: 'var(--accent)', display: 'inline-block', marginTop: 8 }}>
        Verifica su D-Flight →
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Stili sheet in index.css**

Aggiungere in coda a `src/index.css`:

```css
/* Scheda verdetto: card a destra su desktop, bottom sheet su mobile */
.verdict-sheet { position: absolute; right: 12px; top: 64px; width: 360px;
  max-width: calc(100vw - 24px); max-height: 72vh; overflow-y: auto; z-index: 20; }
@media (max-width: 640px) {
  .verdict-sheet { top: auto; right: 0; left: 0; bottom: 0; width: auto;
    max-height: 55vh; border-radius: 16px 16px 0 0; }
}
```

- [ ] **Step 5: Verifica**

Run: `npx vitest run tests/verify/VerdictSheet.test.tsx && npx tsc -b`
Expected: PASS (6 test), tsc pulito.

- [ ] **Step 6: Commit**

```bash
git add src/verify/VerdictSheet.tsx src/index.css tests/verify/VerdictSheet.test.tsx
git commit -m "feat: VerdictSheet — scheda verdetto con accordion zone, warnings e CTA profilo"
```

---

### Task 11: Modalità verifica — VerifyControls, verifyLayers, MapView

**Files:**
- Create: `src/verify/verifyLayers.ts`
- Create: `src/verify/VerifyControls.tsx`
- Modify: `src/map/MapView.tsx` (prop verify, cerchio, marker trascinabile, click)
- Modify: `src/index.css` (classe `.verify-controls`)
- Test: `tests/verify/verifyLayers.test.ts`, `tests/verify/VerifyControls.test.tsx`

**Interfaces:**
- Consumes: `@turf/circle`; MapView di Task 9.
- Produces:
  - `circleFeature(lat: number, lon: number, radiusM: number): Feature<Polygon> | null` (`null` se `radiusM <= 0`).
  - `VerifyControls({ hasPoint, radiusM, onRadiusChange, canUsePosition, onUsePosition, onClose })` — istruzione "Tocca un punto sulla mappa" finché `!hasPoint`; slider raggio 0–500 (step 10) quando `hasPoint`; X sempre presente.
  - Nuove prop MapView: `verify?: { point: { lat: number; lon: number } | null; radiusM: number } | null`, `onVerifyPick?: (lat: number, lon: number) => void` (usata sia dal click sulla mappa sia dal drag del marker centro). Con verify attivo il click su una zona NON apre il popup.

- [ ] **Step 1: Scrivi i test (devono fallire)**

```ts
// tests/verify/verifyLayers.test.ts
import { it, expect } from 'vitest';
import { circleFeature } from '../../src/verify/verifyLayers';

it('raggio 0 → null (verifica puntuale, nessun cerchio da disegnare)', () => {
  expect(circleFeature(42, 12.5, 0)).toBeNull();
});

it('raggio 100 → poligono chiuso centrato sul punto', () => {
  const f = circleFeature(42, 12.5, 100);
  expect(f?.geometry.type).toBe('Polygon');
  const ring = f!.geometry.coordinates[0];
  expect(ring.length).toBeGreaterThan(32);
  const lons = ring.map(c => c[0]);
  expect((Math.min(...lons) + Math.max(...lons)) / 2).toBeCloseTo(12.5, 3);
});
```

```tsx
// tests/verify/VerifyControls.test.tsx
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerifyControls } from '../../src/verify/VerifyControls';

function noop() {}
const base = { hasPoint: false, radiusM: 100, onRadiusChange: noop,
  canUsePosition: false, onUsePosition: noop, onClose: noop };

it('senza punto: istruzione visibile, niente slider', () => {
  render(<VerifyControls {...base} />);
  expect(screen.getByText(/tocca un punto sulla mappa/i)).toBeInTheDocument();
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});

it('"Usa la mia posizione" solo se disponibile, e chiama il callback', () => {
  const use = vi.fn();
  const { rerender } = render(<VerifyControls {...base} />);
  expect(screen.queryByRole('button', { name: /usa la mia posizione/i })).not.toBeInTheDocument();
  rerender(<VerifyControls {...base} canUsePosition onUsePosition={use} />);
  fireEvent.click(screen.getByRole('button', { name: /usa la mia posizione/i }));
  expect(use).toHaveBeenCalled();
});

it('con punto: slider 0–500 che notifica il raggio', () => {
  const change = vi.fn();
  render(<VerifyControls {...base} hasPoint onRadiusChange={change} />);
  const slider = screen.getByRole('slider') as HTMLInputElement;
  expect(slider.min).toBe('0');
  expect(slider.max).toBe('500');
  expect(screen.getByText(/100 m/)).toBeInTheDocument(); // etichetta = prop radiusM
  fireEvent.change(slider, { target: { value: '250' } });
  expect(change).toHaveBeenCalledWith(250);
  // input controllato: il valore mostrato cambia solo quando il parent aggiorna la prop
});

it('X chiude la modalità', () => {
  const close = vi.fn();
  render(<VerifyControls {...base} onClose={close} />);
  fireEvent.click(screen.getByRole('button', { name: /esci dalla verifica/i }));
  expect(close).toHaveBeenCalled();
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/verify/verifyLayers.test.ts tests/verify/VerifyControls.test.tsx`
Expected: FAIL — moduli inesistenti.

- [ ] **Step 3: Implementa verifyLayers e VerifyControls**

```ts
// src/verify/verifyLayers.ts
import circle from '@turf/circle';
import type { Feature, Polygon } from 'geojson';

/** Cerchio di verifica da disegnare sulla mappa; null con raggio 0 (verifica puntuale). */
export function circleFeature(lat: number, lon: number, radiusM: number): Feature<Polygon> | null {
  if (radiusM <= 0) return null;
  return circle([lon, lat], radiusM / 1000, { steps: 64, units: 'kilometers' }) as Feature<Polygon>;
}
```

```tsx
// src/verify/VerifyControls.tsx
export function VerifyControls(
  { hasPoint, radiusM, onRadiusChange, canUsePosition, onUsePosition, onClose }: {
    hasPoint: boolean; radiusM: number; onRadiusChange: (m: number) => void;
    canUsePosition: boolean; onUsePosition: () => void; onClose: () => void;
  }
) {
  return (
    <div className="verify-controls rounded-2xl p-3"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)',
        display: 'flex', gap: 10, alignItems: 'center' }}>
      {!hasPoint ? (
        <>
          <span className="text-sm">🎯 Tocca un punto sulla mappa</span>
          {canUsePosition && (
            <button onClick={onUsePosition}
              className="rounded-xl px-3 py-1 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}>Usa la mia posizione</button>
          )}
        </>
      ) : (
        <label className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          Raggio
          <input type="range" min={0} max={500} step={10} value={radiusM}
            onChange={e => onRadiusChange(Number(e.target.value))} />
          <span style={{ minWidth: 48, textAlign: 'right' }}>{radiusM} m</span>
        </label>
      )}
      <button onClick={onClose} aria-label="Esci dalla verifica"
        style={{ color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
    </div>
  );
}
```

Aggiungere in coda a `src/index.css`:

```css
/* Barra della modalità verifica */
.verify-controls { position: absolute; top: 64px; left: 50%;
  transform: translateX(-50%); z-index: 20; max-width: calc(100vw - 24px); }
```

- [ ] **Step 4: Estendi MapView con la modalità verifica**

In `src/map/MapView.tsx`:

1. Import in testa: `import { circleFeature } from '../verify/verifyLayers';`

2. Tipo e helper sotto `highlightFilter`:

```ts
export interface VerifyState { point: { lat: number; lon: number } | null; radiusM: number }

function setVerifyLayers(map: maplibregl.Map, verify: VerifyState | null) {
  const feat = verify?.point
    ? circleFeature(verify.point.lat, verify.point.lon, verify.radiusM) : null;
  const data: any = { type: 'FeatureCollection', features: feat ? [feat] : [] };
  if (map.getSource('verify')) {
    (map.getSource('verify') as maplibregl.GeoJSONSource).setData(data);
  } else if (verify) {
    map.addSource('verify', { type: 'geojson', data });
    map.addLayer({ id: 'verify-fill', type: 'fill', source: 'verify',
      paint: { 'fill-color': '#0a84ff', 'fill-opacity': 0.12 } });
    map.addLayer({ id: 'verify-line', type: 'line', source: 'verify',
      paint: { 'line-color': '#0a84ff', 'line-width': 2, 'line-dasharray': [2, 2] } });
  }
}
```

3. Firma: aggiungere le prop `verify?: VerifyState | null; onVerifyPick?: (lat: number, lon: number) => void` (stesso stile delle altre).

4. Ref nel componente:

```ts
  const verifyRef = useRef<VerifyState | null>(verify ?? null);
  verifyRef.current = verify ?? null;
  const onVerifyPickRef = useRef(onVerifyPick);
  onVerifyPickRef.current = onVerifyPick;
```

5. Nell'effetto di creazione mappa, PRIMA di `m.on('click', 'zones-fill', ...)` aggiungere il click generico, e nel handler del popup mettere il guard:

```ts
    m.on('click', (e) => {
      if (verifyRef.current) onVerifyPickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });
```

e come prima riga dentro il handler `zones-fill`: `if (verifyRef.current) return;`

6. Nel callback `styledata` del cambio tema, dopo `addZoneLayers(...)` aggiungere `setVerifyLayers(m, verifyRef.current);` (il cambio stile azzera i source custom).

7. Nuovo effetto cerchio + marker centro trascinabile (dopo l'effetto del puntino blu):

```ts
  // cerchio di verifica + centro trascinabile
  const centerMarker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (m.isStyleLoaded()) setVerifyLayers(m, verify ?? null);
    else m.once('load', () => setVerifyLayers(m, verifyRef.current));

    if (!verify?.point) {
      centerMarker.current?.remove(); centerMarker.current = null; return;
    }
    if (!centerMarker.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:14px;height:14px;border-radius:50%;background:#fff;border:4px solid #0a84ff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:grab';
      const mk = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([verify.point.lon, verify.point.lat]).addTo(m);
      mk.on('dragend', () => {
        const p = mk.getLngLat();
        onVerifyPickRef.current?.(p.lat, p.lng);
      });
      centerMarker.current = mk;
    } else {
      centerMarker.current.setLngLat([verify.point.lon, verify.point.lat]);
    }
  }, [verify]);
```

- [ ] **Step 5: Verifica tutta la suite**

Run: `npx vitest run && npx tsc -b`
Expected: PASS (6 test nuovi + resto verde), tsc pulito.

- [ ] **Step 6: Commit**

```bash
git add src/verify/verifyLayers.ts src/verify/VerifyControls.tsx src/map/MapView.tsx src/index.css tests/verify/verifyLayers.test.ts tests/verify/VerifyControls.test.tsx
git commit -m "feat: modalità verifica — cerchio regolabile, centro trascinabile, controlli overlay"
```

---

### Task 12: Integrazione App

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/app/App.test.tsx` (aggiunte)

**Interfaces:**
- Consumes: tutto quanto sopra. `useProfiles` (Task 3), `ProfilePanel` (Task 4), `zonesAtPoint` (Task 8), `evaluate` (Task 7), `VerifyControls` (Task 11), `VerdictSheet` (Task 10), prop MapView (Task 9 e 11).
- Produces: bottoni "Verifica" (disabilitato senza zone) e "Profilo" nello stack in basso a destra (spostato a `bottom: 44` per non coprire l'attribution CARTO — fix backlog Fase 1); stato verifica/verdetto ricalcolato a ogni cambio drone/pilota/raggio/punto.

- [ ] **Step 1: Aggiungi i test (devono fallire)**

Aggiungere in coda a `tests/app/App.test.tsx`:

```tsx
it('bottone Verifica disabilitato senza zone', async () => {
  render(<App />);
  const btn = await screen.findByRole('button', { name: /^verifica$/i });
  expect(btn).toBeDisabled();
});

it('bottone Profilo apre e chiude il pannello', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^profilo$/i }));
  expect(await screen.findByRole('dialog', { name: /profilo/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /chiudi profilo/i }));
  expect(screen.queryByRole('dialog', { name: /profilo/i })).not.toBeInTheDocument();
});
```

e aggiornare l'import di testing-library in testa al file: `import { render, screen, fireEvent } from '@testing-library/react';`

- [ ] **Step 2: Verifica che falliscano**

Run: `npx vitest run tests/app/App.test.tsx`
Expected: FAIL — bottoni inesistenti.

- [ ] **Step 3: Implementa (App.tsx completo)**

```tsx
// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
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
import { useProfiles } from './profiles/useProfiles';
import { ProfilePanel } from './profiles/ProfilePanel';
import { VerifyControls } from './verify/VerifyControls';
import { VerdictSheet } from './verify/VerdictSheet';
import { zonesAtPoint } from './verify/intersect';
import { evaluate } from './rules/rulesEngine';
import type { Zone, DatasetMeta } from './data/ed269.types';

type VerifyUiState = { point: { lat: number; lon: number } | null; radiusM: number };

export default function App() {
  const { theme, resolved, setTheme } = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [flyTo, setFlyTo] = useState<{lat:number;lon:number}|null>(null);
  const [err, setErr] = useState<string | null>(null);
  const geo = useGeolocation();

  const profiles = useProfiles();
  const [verify, setVerify] = useState<VerifyUiState | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [highlightZoneId, setHighlightZoneId] = useState<string | null>(null);

  useEffect(() => { (async () => {
    setZones(await loadZones()); setMeta(await loadMeta());
  })(); }, []);

  useEffect(() => {
    if (geo.position) setFlyTo({ lat: geo.position.lat, lon: geo.position.lon });
  }, [geo.position]);

  async function refresh() { setZones(await loadZones()); setMeta(await loadMeta()); setErr(null); }

  const verdict = useMemo(() => {
    if (!verify?.point || !profiles.activeDrone) return null;
    return evaluate(
      zonesAtPoint(zones, { ...verify.point, radiusM: verify.radiusM }),
      profiles.activeDrone, profiles.pilot);
  }, [verify, zones, profiles.activeDrone, profiles.pilot]);

  function closeVerify() { setVerify(null); setHighlightZoneId(null); }
  function setPoint(lat: number, lon: number) {
    setVerify(v => (v ? { ...v, point: { lat, lon } } : v));
  }

  return (
    <div style={{ position:'absolute', inset:0 }}>
      <MapView resolvedTheme={resolved} zones={zones}
        userPosition={geo.position} flyTo={flyTo}
        highlightZoneId={highlightZoneId} onZoneFocus={setHighlightZoneId}
        verify={verify} onVerifyPick={setPoint} />

      <div style={{ position:'absolute', top:12, left:12, right:12, display:'flex', gap:10, alignItems:'flex-start' }}>
        <div style={{ flex:1, maxWidth:480 }}><SearchBox onPick={r => setFlyTo({ lat:r.lat, lon:r.lon })} /></div>
        <ThemeToggle value={theme} onChange={setTheme} />
      </div>

      <div style={{ position:'absolute', bottom:12, left:12, display:'flex', flexDirection:'column', gap:10 }}>
        <DataStatusBanner meta={meta} />
        <Legend />
        <Disclaimer />
      </div>

      {/* bottom: 44 per non coprire l'attribution CARTO (fix backlog Fase 1) */}
      <div style={{ position:'absolute', bottom:44, right:12, display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end' }}>
        <button onClick={() => setVerify({ point: null, radiusM: 100 })}
          disabled={zones.length === 0 || !!verify}
          title={zones.length === 0 ? 'Importa prima le zone' : 'Posso volare qui?'}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          Verifica
        </button>
        <button onClick={() => setProfileOpen(true)}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
          Profilo
        </button>
        <LocateButton onClick={geo.request} />
        <ImportButton onDone={async () => { await refresh(); }} onError={setErr} />
      </div>

      {verify && (
        <VerifyControls hasPoint={!!verify.point} radiusM={verify.radiusM}
          onRadiusChange={m => setVerify(v => (v ? { ...v, radiusM: m } : v))}
          canUsePosition={!!geo.position}
          onUsePosition={() => { if (geo.position) setPoint(geo.position.lat, geo.position.lon); }}
          onClose={closeVerify} />
      )}

      {verify?.point && (
        <VerdictSheet verdict={verdict}
          drones={profiles.drones} activeDroneId={profiles.activeDroneId}
          onSelectDrone={id => { void profiles.activate(id); }}
          onOpenProfile={() => setProfileOpen(true)}
          onClose={closeVerify} onZoneFocus={setHighlightZoneId} />
      )}

      {profileOpen && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,.35)', padding:16, zIndex: 30 }}>
          <ProfilePanel profiles={profiles} onClose={() => setProfileOpen(false)} />
        </div>
      )}

      {zones.length === 0 && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,.15)', padding:16 }}>
          <EmptyState onImported={async () => { await refresh(); }} onError={setErr} />
        </div>
      )}
      {(err ?? geo.error) && <div style={{ position:'absolute', top:64, left:12, right:12, color:'#ef4444' }}>{err ?? geo.error}</div>}
    </div>
  );
}
```

Nota: con `zones.length === 0` l'overlay EmptyState copre i bottoni; i test usano `findByRole` che li trova comunque nel DOM (il bottone Verifica è `disabled`). Il click su Profilo nel test funziona perché l'overlay EmptyState non intercetta i click a livello jsdom.
Se il test "Profilo apre il pannello" fallisse per sovrapposizione dell'overlay, spostare l'overlay EmptyState PRIMA dello stack bottoni nel JSX (l'ordine DOM non cambia il layout, essendo tutto absolute).

- [ ] **Step 4: Verifica tutta la suite**

Run: `npx vitest run && npx tsc -b`
Expected: PASS (2 nuovi + resto verde), tsc pulito.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/app/App.test.tsx
git commit -m "feat: integrazione Fase 2 in App — Verifica, Profilo, verdetto live; fix overlap attribution"
```

---

### Task 13: E2E Playwright headless

**Files:**
- Create: `e2e/fixture-ed269.json`
- Create: `e2e/run.mjs`
- Create: `e2e/README.md`

**Interfaces:**
- Consumes: l'app completa via dev server Vite.
- Produces: script E2E rieseguibile. Playwright NON entra in `package.json`: `npm i --no-save playwright` con browser già in cache (`~/Library/Caches/ms-playwright`).

- [ ] **Step 1: Crea la fixture**

Tre zone centrate su `ITALY_CENTER` (12.5, 42.0) così il click al centro del canvas le colpisce senza geocoding: Z1 condizionata grande (±0.004°), Z2 condizionata piccola (±0.002°, sovrapposta), Z3 vietata a est (bordo interno a ~0.0045° ≈ 375 m: fuori dal raggio 100, dentro il raggio 500).

```json
{
  "features": [
    {
      "identifier": "Z1",
      "name": "Area condizionata grande",
      "restriction": "CONDITIONAL",
      "message": "Volo consentito sotto i 60 m previa valutazione.",
      "geometry": [{
        "horizontalProjection": { "type": "Polygon", "coordinates": [[
          [12.496, 41.996], [12.504, 41.996], [12.504, 42.004], [12.496, 42.004], [12.496, 41.996]
        ]] },
        "lowerLimit": 0, "upperLimit": 60,
        "upperVerticalReference": "AGL", "uomDimensions": "M"
      }]
    },
    {
      "identifier": "Z2",
      "name": "Area condizionata piccola",
      "restriction": "CONDITIONAL",
      "message": "Contattare il gestore locale.",
      "geometry": [{
        "horizontalProjection": { "type": "Polygon", "coordinates": [[
          [12.498, 41.998], [12.502, 41.998], [12.502, 42.002], [12.498, 42.002], [12.498, 41.998]
        ]] },
        "lowerLimit": 0, "upperLimit": 45,
        "upperVerticalReference": "AGL", "uomDimensions": "M"
      }]
    },
    {
      "identifier": "Z3",
      "name": "Zona vietata a est",
      "restriction": "PROHIBITED",
      "geometry": [{
        "horizontalProjection": { "type": "Polygon", "coordinates": [[
          [12.5045, 41.998], [12.5075, 41.998], [12.5075, 42.002], [12.5045, 42.002], [12.5045, 41.998]
        ]] },
        "lowerLimit": 0, "upperLimit": 0,
        "upperVerticalReference": "AGL", "uomDimensions": "M"
      }]
    }
  ]
}
```

- [ ] **Step 2: Scrivi lo script E2E**

```js
// e2e/run.mjs — E2E Fase 2 con Playwright headless.
// Prerequisiti: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
// Uso: node e2e/run.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
};
// poll fino a condizione vera (per assert su count, dove i locator strict non bastano)
async function until(fn, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await fn()) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

// 1. dev server
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite non parte')), 30000);
  server.stdout.on('data', d => { if (String(d).includes('Local:')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  await page.goto(`http://localhost:${PORT}/`);

  // 2. empty state + import fixture
  await page.getByText(/Importa le zone ufficiali/i).waitFor();
  check('empty state visibile', true);
  await page.locator('input[type=file]').first()
    .setInputFiles(join(root, 'e2e/fixture-ed269.json'));
  await page.getByText(/Dati aggiornati al/i).waitFor({ timeout: 10000 });
  check('import fixture (banner dataset visibile)', true);
  await page.waitForTimeout(2500); // rendering mappa

  // 3. verifica senza profilo → CTA
  await page.getByRole('button', { name: /^verifica$/i }).click();
  await page.getByText(/tocca un punto sulla mappa/i).waitFor();
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.click({ position: { x: 640, y: 400 } }); // centro = ITALY_CENTER
  await page.getByText(/configura un drone/i).waitFor();
  check('senza profilo: CTA al profilo, nessun finto verdetto', true);

  // 4. profilo: due droni + attestato A1/A3
  await page.getByRole('button', { name: /apri profilo/i }).click();
  await page.getByLabel('Nome').fill('Mini');
  await page.getByLabel('Massa (g)').fill('249');
  await page.getByLabel('Classe').selectOption('sub250');
  await page.getByRole('button', { name: /aggiungi drone/i }).click();
  await page.getByLabel('Nome').fill('Duo');
  await page.getByLabel('Massa (g)').fill('900');
  await page.getByLabel('Classe').selectOption('C2');
  await page.getByRole('button', { name: /aggiungi drone/i }).click();
  await page.getByRole('checkbox', { name: 'A1/A3' }).check();
  await page.getByRole('button', { name: /chiudi profilo/i }).click();
  check('profilo: 2 droni + attestato A1/A3', true);

  // 5. verdetto con Mini (sub250, attivo perché primo): condizioni, quota 45
  const sheet = page.getByRole('dialog', { name: /verdetto/i });
  await sheet.getByText(/con condizioni/i).waitFor();
  await sheet.getByText(/45 m AGL/).waitFor();
  check('verdetto Mini: 🟡 condizioni, quota 45 m (min dei soffitti)', true);

  // 6. cambio drone → ricalcolo (Duo con solo A1/A3 → A3, note 150 m)
  await sheet.getByLabel('Drone').selectOption({ label: 'Duo' });
  await sheet.getByText(/150 m/).waitFor();
  await sheet.getByText(/Sottocategoria A3/).waitFor();
  check('cambio drone ricalcola: Duo → A3 con nota 150 m', true);

  // 7. accordion: una zona alla volta.
  // NB: i message delle zone condizionate compaiono ANCHE nelle note operative
  // («Zona»: message), quindi si lavora a count: 1 = solo nota, 2 = nota + dettaglio aperto.
  const count = (re) => sheet.getByText(re).count();
  check('accordion chiuso: message solo nelle note',
    await until(async () => (await count(/previa valutazione/i)) === 1));
  await sheet.getByRole('button', { name: /area condizionata grande/i }).click();
  check('apertura zona 1: dettaglio visibile',
    await until(async () => (await count(/previa valutazione/i)) === 2));
  await sheet.getByRole('button', { name: /area condizionata piccola/i }).click();
  check('apertura zona 2 chiude la zona 1',
    await until(async () =>
      (await count(/previa valutazione/i)) === 1 &&
      (await count(/gestore locale/i)) === 2));

  // 8. slider 500 m → entra la zona vietata → ⛔
  await page.getByRole('slider').fill('500');
  await sheet.getByText(/vietato/i).waitFor();
  await sheet.getByText(/Quota massima: —/).waitFor();
  check('raggio 500 m: interseca la zona vietata → ⛔, quota —', true);

  // 9. slider 0 → verifica puntuale, torna alle condizioni
  await page.getByRole('slider').fill('0');
  await sheet.getByText(/con condizioni/i).waitFor();
  check('raggio 0: verifica puntuale → 🟡', true);

  // 10. chiusura
  await page.getByRole('button', { name: /esci dalla verifica/i }).click();
  const sheetGone = await page.getByRole('dialog', { name: /verdetto/i }).count() === 0;
  check('X esce dalla modalità verifica', sheetGone);

  // 11. popup accordion Fase 1 (fuori dalla modalità verifica)
  await canvas.click({ position: { x: 640, y: 400 } });
  await page.locator('.zone-popup').waitFor();
  const heads = page.locator('.zone-popup-head');
  check('popup multi-zona: lista nomi', await heads.count() >= 2);
  await heads.first().click();
  const visibleDetails = await page.locator('.zone-popup-detail:not([hidden])').count();
  check('popup accordion: un dettaglio aperto', visibleDetails === 1);

  // 12. console pulita
  check('zero errori console', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} check verdi`);
process.exit(failed.length ? 1 : 0);
```

- [ ] **Step 3: README E2E**

````markdown
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
````

- [ ] **Step 4: Esegui**

Run: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright && node e2e/run.mjs`
Expected: tutti i check verdi, exit 0. Se un check fallisce: sistemare l'app (o il selettore, se è lo script a essere impreciso) e rieseguire fino al verde. IndexedDB del browser E2E parte pulito a ogni run (profilo browser effimero).

- [ ] **Step 5: Commit**

```bash
git add e2e/fixture-ed269.json e2e/run.mjs e2e/README.md
git commit -m "test: E2E Fase 2 — profilo, verifica punto+cerchio, verdetto, accordion, raggio"
```

---

## Verifica finale di fase

- [ ] `npx vitest run` — tutta la suite verde.
- [ ] `npx tsc -b` — pulito.
- [ ] `npm run build` — build ok (nota: warning bundle >1.2 MB atteso, backlog).
- [ ] `node e2e/run.mjs` — tutti i check verdi.
- [ ] Review finale whole-branch (opus) come in Fase 1, poi merge su `main` → il push triggera il deploy Pages (se la deployment fallisce con "Deployment failed, try again later": `gh run rerun <id> --failed`).
