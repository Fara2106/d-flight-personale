# Restyle UI premium (vetro stile iOS) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere premium il guscio dell'app (vetro sfocato stile iOS, token unificati, icone SVG, micro-transizioni) senza toccare la resa della mappa né alcuna funzione.

**Architecture:** Sistema di token CSS in `index.css` (`--glass-*`, scala raggi, due ombre) + classi condivise (`.glass`, `.glass-panel`, `.btn-accent`, `.press`, animazioni). Nuovo file `src/ui/icons.tsx` con SVG inline. Ogni componente del chrome viene ristilizzato mantenendo struttura DOM, testi e `aria-label` invariati.

**Tech Stack:** React + TS, Tailwind v3 (classi utility esistenti), CSS puro. Zero dipendenze nuove.

## Global Constraints

- **La resa della mappa (round 6+7) NON si tocca**: nessuna modifica a `mapStyle.ts`, `zonesToGeoJSON.ts`, `basemapLabels.ts`, `categoryOverlay.ts`, `MapView.tsx` (rendering), `ZONE_COLORS`, opacità/veli.
- Nessuna modifica a testi utente, `aria-label`, ruoli ARIA, struttura DOM significativa. In particolare: `span.hidden sm:inline` in ThemeToggle e nel summary della Legenda (assert di `tests/ui/mobileChrome.test.tsx`); `btn.style.background` contenente `--accent` sul LocateButton attivo (assert di `tests/location/LocateButton.test.tsx`); placeholder ricerca che matcha `/cerca un luogo/i`.
- Zero dipendenze npm nuove.
- Accento `#007aff`/`#0a84ff` e colori zone invariati.
- Ogni scelta visiva va bene in ENTRAMBI i temi (chiaro e scuro).
- Gotcha cascata: ogni override di CSS MapLibre va prefissato `:root` (maplibre-gl.css viene dopo nel grafo dei moduli).
- `verbatimModuleSyntax: true` in tsconfig → import di soli tipi con `import type`.
- Dopo ogni task: suite completa `npx vitest run` + `npx tsc -b` verdi prima del commit.
- Niente push: i commit restano locali fino all'ok di Lorenzo.

---

### Task 1: Screenshot baseline (PRIMA delle modifiche)

**Files:** nessuno (artefatti in `.tmp-screens/`, untracked).

Serve il "prima" per il verdetto estetico di Lorenzo e per dimostrare la mappa pixel-identica.

- [ ] **Step 1: Build e server di preview**

```bash
cd "/Users/lorenzofaraoni/Documents/Web Apps/D-Flight personale"
npm run build
(npx vite preview --port 5199 --strictPort &) && sleep 2
```

- [ ] **Step 2: Screenshot nei due temi (viewport iPhone, fixture Fiumicino)**

```bash
mkdir -p .tmp-screens/premium
node e2e/shot.mjs http://localhost:5199/d-flight-personale/ .tmp-screens/premium/before 10.3
```

Expected: file `before-*.png` (chiaro+scuro) in `.tmp-screens/premium/`.

- [ ] **Step 3: Ferma il server**

```bash
kill %1 2>/dev/null || pkill -f "vite preview --port 5199"
```

Nessun commit (la cartella è untracked e resta tale).

---

### Task 2: Token vetro + animazioni base in `index.css`

**Files:**
- Modify: `src/index.css` (blocco `:root` / `[data-theme='dark']` + nuove classi in coda)
- Test: `tests/ui/premiumTokens.test.ts` (nuovo, strutturale come `mobileChrome.test.tsx`)

**Interfaces:**
- Produces (classi CSS usate dai task 4-8): `.glass`, `.glass-panel`, `.btn-accent`, `.press`, `.icon-btn`, `.anim-pop`, `.anim-rise`, `.field`. Token: `--glass-bg`, `--glass-border`, `--glass-blur`, `--shadow-sm`, `--shadow-lg`, `--radius-ctrl: 14px`, `--radius-card: 18px`, `--radius-sheet: 22px`, `--ease-out`. `--shadow` resta come alias di `--shadow-lg` finché tutti i componenti non migrano (rimosso al Task 9).

- [ ] **Step 1: Scrivi il test strutturale (fallisce)**

```ts
// tests/ui/premiumTokens.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/index.css'), 'utf8');

describe('token UI premium (vetro stile iOS)', () => {
  it('definisce i token vetro in entrambi i temi', () => {
    expect(css).toMatch(/:root\s*{[^}]*--glass-bg:/);
    expect(css).toMatch(/\[data-theme='dark'\]\s*{[^}]*--glass-bg:/);
    expect(css).toMatch(/--shadow-sm:/);
    expect(css).toMatch(/--shadow-lg:/);
    expect(css).toMatch(/--radius-card:/);
  });
  it('.glass usa il blur con fallback per browser senza supporto', () => {
    expect(css).toMatch(/\.glass\b[^{]*{[^}]*backdrop-filter/);
    expect(css).toMatch(/@supports not/);
  });
  it('le micro-transizioni rispettano prefers-reduced-motion', () => {
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `npx vitest run tests/ui/premiumTokens.test.ts`
Expected: FAIL (i token non esistono ancora).

- [ ] **Step 3: Implementa i token in `index.css`**

Sostituisci i blocchi `:root` e `[data-theme='dark']` (righe 5-17) con:

```css
:root {
  --bg: #f5f6f8; --surface: #ffffff; --text: #1c2530; --text-muted: #8a93a0;
  --accent: #007aff;
  /* vetro stile iOS: pannelli semi-trasparenti sfocati sopra la mappa */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-border: rgba(255, 255, 255, 0.55);
  --glass-blur: blur(20px) saturate(1.4);
  /* due ombre: leggera per i controlli, profonda per pannelli e sheet */
  --shadow-sm: 0 2px 10px rgba(30, 60, 90, 0.12);
  --shadow-lg: 0 16px 40px rgba(30, 60, 90, 0.22);
  --shadow: var(--shadow-lg); /* alias di transizione, rimosso a fine restyle */
  /* scala raggi: pillola=999px, controlli, card, sheet */
  --radius-ctrl: 14px; --radius-card: 18px; --radius-sheet: 22px;
  --ease-out: cubic-bezier(0.25, 0.8, 0.35, 1);
  /* safe area iOS (viewport-fit=cover): 0 dove notch/barra home non esistono */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
[data-theme='dark'] {
  --bg: #0f141b; --surface: #1f2630; --text: #e8edf3; --text-muted: #8a93a0;
  --accent: #0a84ff;
  --glass-bg: rgba(26, 32, 42, 0.68);
  --glass-border: rgba(255, 255, 255, 0.1);
  --shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 18px 44px rgba(0, 0, 0, 0.55);
  --shadow: var(--shadow-lg);
}
```

E aggiungi in coda al file:

```css
/* ===== Restyle premium (vetro stile iOS) ===== */

/* Superfici vetro: controlli piccoli (.glass) e pannelli/sheet (.glass-panel) */
.glass, .glass-panel {
  background: var(--glass-bg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  color: var(--text);
}
.glass { box-shadow: var(--shadow-sm); }
.glass-panel { box-shadow: var(--shadow-lg); }
/* browser senza backdrop-filter: superficie piena come prima del restyle */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass, .glass-panel, :root .maplibregl-popup-content { background: var(--surface); }
}

/* Azione primaria: blu accento pieno, ombra colorata tenue */
.btn-accent {
  background: var(--accent); color: #fff; font-weight: 600;
  border: 0; border-radius: var(--radius-ctrl); cursor: pointer;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent);
}

/* Bottone-icona discreto (chiudi ✕ ecc.) */
.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%; border: 0; cursor: pointer;
  background: transparent; color: var(--text-muted); flex: none;
}
.icon-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); }

/* Campi input/select coerenti (pannelli profilo/verdetto) */
.field {
  border: 1px solid color-mix(in srgb, var(--text-muted) 45%, transparent);
  border-radius: 10px; background: transparent; color: var(--text);
  padding: 6px 10px; outline: none;
}
.field:focus { border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }

/* Micro-transizioni (150-250ms). Spente con "riduci movimento". */
@media (prefers-reduced-motion: no-preference) {
  .press { transition: transform 0.15s var(--ease-out), filter 0.15s var(--ease-out); }
  .press:hover { filter: brightness(1.06); }
  .press:active { transform: scale(0.97); }
  .anim-pop { animation: pop-in 0.18s var(--ease-out); }
  .anim-rise { animation: rise-in 0.25s var(--ease-out); }
}
@keyframes pop-in { from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); } }
@keyframes rise-in { from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 4: Verifica che passi + suite completa**

Run: `npx vitest run tests/ui/premiumTokens.test.ts && npx vitest run && npx tsc -b`
Expected: tutto PASS (l'alias `--shadow` tiene in piedi i componenti non ancora migrati).

- [ ] **Step 5: Commit**

```bash
git add src/index.css tests/ui/premiumTokens.test.ts
git commit -m "feat(ui): token vetro iOS, scala raggi/ombre, classi glass e micro-transizioni"
```

---

### Task 3: Icone SVG (`src/ui/icons.tsx`)

**Files:**
- Create: `src/ui/icons.tsx`
- Test: `tests/ui/icons.test.tsx` (nuovo)

**Interfaces:**
- Produces: `SearchIcon`, `SunIcon`, `MoonIcon`, `SystemIcon`, `LocateIcon`, `CloseIcon`, `ChevronIcon`, `TargetIcon` — tutte `({ size?: number }) => JSX`, monocromatiche su `currentColor`, `aria-hidden="true"`.

- [ ] **Step 1: Scrivi il test (fallisce)**

```tsx
// tests/ui/icons.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  SearchIcon, SunIcon, MoonIcon, SystemIcon,
  LocateIcon, CloseIcon, ChevronIcon, TargetIcon,
} from '../../src/ui/icons';

const ICONS = [
  ['SearchIcon', SearchIcon], ['SunIcon', SunIcon], ['MoonIcon', MoonIcon],
  ['SystemIcon', SystemIcon], ['LocateIcon', LocateIcon],
  ['CloseIcon', CloseIcon], ['ChevronIcon', ChevronIcon], ['TargetIcon', TargetIcon],
] as const;

describe('icone SVG del chrome', () => {
  it.each(ICONS)('%s è un svg decorativo su currentColor', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(svg!.getAttribute('stroke')).toBe('currentColor');
  });
  it('accetta la dimensione', () => {
    const { container } = render(<SearchIcon size={20} />);
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('20');
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `npx vitest run tests/ui/icons.test.tsx`
Expected: FAIL ("Cannot find module '../../src/ui/icons'").

- [ ] **Step 3: Implementa `src/ui/icons.tsx`**

```tsx
// Icone SVG inline del chrome (stile SF Symbols): monocromatiche su
// currentColor, decorative (aria-hidden) — il nome accessibile sta sempre
// sull'elemento interattivo che le contiene.
import type { ReactNode } from 'react';

type IconProps = { size?: number };

function Svg({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" /></Svg>;
}
export function SunIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" />
    </Svg>
  );
}
export function MoonIcon(p: IconProps) {
  return <Svg {...p}><path d="M20.6 14.1A8.6 8.6 0 1 1 9.9 3.4a7 7 0 0 0 10.7 10.7Z" /></Svg>;
}
export function SystemIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <path d="M9 20.5h6M12 17v3.5" />
    </Svg>
  );
}
export function LocateIcon(p: IconProps) {
  return <Svg {...p}><path d="M20.5 3.5 11 20.6l-1.6-7L2.4 12Z" /></Svg>;
}
export function CloseIcon(p: IconProps) {
  return <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
}
export function ChevronIcon(p: IconProps) {
  return <Svg {...p}><path d="m9 5.5 6.5 6.5L9 18.5" /></Svg>;
}
export function TargetIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="1.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </Svg>
  );
}
```

- [ ] **Step 4: Verifica che passi**

Run: `npx vitest run tests/ui/icons.test.tsx && npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/icons.tsx tests/ui/icons.test.tsx
git commit -m "feat(ui): icone SVG inline stile SF Symbols al posto delle emoji"
```

---

### Task 4: Barra alta — SearchBox, ThemeToggle, LocateButton

**Files:**
- Modify: `src/search/SearchBox.tsx`, `src/theme/ThemeToggle.tsx`, `src/location/LocateButton.tsx`, `src/index.css` (classi `.search-*`, `.seg*`, `.locate-btn`), `e2e/shot.mjs:131` (selettore tema: le emoji spariscono)
- Test: esistenti (`tests/search/SearchBox.test.tsx`, `tests/ui/mobileChrome.test.tsx`, `tests/location/LocateButton.test.tsx`) — devono restare verdi SENZA modifiche.

**Interfaces:**
- Consumes: `.glass`, `.glass-panel`, `.press`, `.anim-pop` (Task 2); `SearchIcon`, `SunIcon`, `MoonIcon`, `SystemIcon`, `LocateIcon` (Task 3).

- [ ] **Step 1: CSS — aggiungi in coda a `src/index.css`**

```css
/* Barra ricerca: pillola vetro con lente interna */
.search-input {
  border-radius: 999px; padding: 10px 16px 10px 38px;
  font-size: 14px; outline: none; width: 100%;
}
.search-input::placeholder { color: var(--text-muted); }
.search-input:focus {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent), var(--shadow-sm);
}
.search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); pointer-events: none; display: flex; }
.search-results { border-radius: var(--radius-card); }
.search-row { display: block; width: 100%; padding: 10px 16px; text-align: left;
  font-size: 14px; background: none; border: 0; color: inherit; cursor: pointer; }
.search-row:hover, .search-row:focus-visible {
  background: color-mix(in srgb, var(--accent) 12%, transparent); }
.search-results li + li { border-top: 1px solid color-mix(in srgb, var(--text-muted) 18%, transparent); }

/* Selettore tema: segmented control con pillola che scivola */
.seg { position: relative; display: grid; grid-auto-flow: column;
  grid-auto-columns: 1fr; padding: 3px; border-radius: 999px; }
.seg-pill { position: absolute; top: 3px; bottom: 3px; left: 3px;
  width: calc((100% - 6px) / 3); border-radius: 999px; background: var(--accent);
  box-shadow: 0 1px 6px color-mix(in srgb, var(--accent) 40%, transparent); }
@media (prefers-reduced-motion: no-preference) {
  .seg-pill { transition: transform 0.2s var(--ease-out); }
}
.seg-btn { position: relative; z-index: 1; display: flex; align-items: center;
  justify-content: center; gap: 6px; padding: 7px 12px; border-radius: 999px;
  border: 0; background: none; cursor: pointer; font: inherit;
  transition: color 0.2s var(--ease-out); }

/* Bottone posizione */
.locate-btn { border-radius: 999px; padding: 11px; display: flex; cursor: pointer; }
```

- [ ] **Step 2: `src/search/SearchBox.tsx` — solo il `return` cambia**

```tsx
  return (
    <div className="relative">
      <span className="search-icon"><SearchIcon size={16} /></span>
      <input value={q} onChange={e => run(e.target.value)} placeholder="Cerca un luogo…"
        disabled={disabled}
        title={disabled ? 'Ricerca non disponibile offline' : undefined}
        className="glass search-input disabled:opacity-50" />
      {res.length > 0 && (
        <ul className="glass-panel search-results anim-pop absolute z-10 mt-2 w-full overflow-hidden">
          {res.map((r,i) => (
            <li key={i}><button className="search-row"
              onClick={() => { onPick(r); setRes([]); setQ(r.label); }}>{r.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
```

E aggiungi in testa: `import { SearchIcon } from '../ui/icons';`
(Il placeholder perde solo il glifo `⌕`: il test usa `/cerca un luogo/i` e resta verde.)

- [ ] **Step 3: `src/theme/ThemeToggle.tsx` — file completo**

```tsx
import type { ReactNode } from 'react';
import { type ThemePref } from './useTheme';
import { SunIcon, MoonIcon, SystemIcon } from '../ui/icons';

const OPTS: { key: ThemePref; icon: ReactNode; text: string }[] = [
  { key: 'light', icon: <SunIcon size={15} />, text: 'Chiaro' },
  { key: 'dark', icon: <MoonIcon size={15} />, text: 'Scuro' },
  { key: 'system', icon: <SystemIcon size={15} />, text: 'Sistema' },
];

export function ThemeToggle({ value, onChange }:
  { value: ThemePref; onChange: (p: ThemePref) => void }) {
  const idx = Math.max(0, OPTS.findIndex(o => o.key === value));
  return (
    <div role="group" aria-label="Tema" className="seg glass">
      {/* pillola attiva: scivola sotto i bottoni (transform per indice) */}
      <span className="seg-pill" aria-hidden="true"
        style={{ transform: `translateX(${idx * 100}%)` }} />
      {OPTS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          aria-label={o.text}
          className="seg-btn text-sm whitespace-nowrap"
          style={{ color: value === o.key ? '#fff' : 'var(--text-muted)' }}>
          {/* su mobile il testo ruba spazio alla ricerca: resta solo l'icona,
              il nome accessibile vive nell'aria-label */}
          {o.icon} <span className="hidden sm:inline">{o.text}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `src/location/LocateButton.tsx` — file completo**

```tsx
import { LocateIcon } from '../ui/icons';

/** Toggle del tracking posizione: attivo = la mappa segue l'utente. */
export function LocateButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      aria-label={active ? 'Ferma il tracking della posizione' : 'Segui la mia posizione'}
      title={active ? 'Tracking attivo — tocca per fermare' : 'Segui la mia posizione'}
      className="glass press locate-btn"
      style={active
        // il test verifica che lo stile attivo contenga --accent
        ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }
        : { color: 'var(--text)' }}>
      <LocateIcon size={18} />
    </button>
  );
}
```

- [ ] **Step 5: `e2e/shot.mjs` riga 131 — il selettore emoji non esiste più**

Sostituisci:

```js
      await page.locator(`button:has-text("${theme === 'dark' ? '🌙' : '☀️'}")`).first().click();
```

con:

```js
      await page.locator(`button[aria-label="${theme === 'dark' ? 'Scuro' : 'Chiaro'}"]`).click();
```

- [ ] **Step 6: Suite + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: tutto PASS senza modifiche ai test esistenti.

- [ ] **Step 7: Verifica visiva rapida nei due temi**

```bash
npm run build && (npx vite preview --port 5199 --strictPort &) && sleep 2
node e2e/shot.mjs http://localhost:5199/d-flight-personale/ .tmp-screens/premium/wip-topbar 10.3
kill %1 2>/dev/null || pkill -f "vite preview --port 5199"
```

Guarda gli screenshot: pillola ricerca vetro, segmented control, bottone posizione. Nessun bianco illeggibile in dark.

- [ ] **Step 8: Commit**

```bash
git add src/search/SearchBox.tsx src/theme/ThemeToggle.tsx src/location/LocateButton.tsx src/index.css e2e/shot.mjs
git commit -m "feat(ui): barra alta in vetro — ricerca a pillola, segmented control tema, bottone posizione"
```

---

### Task 5: Bottoni azione, banner, disclaimer, card errore, EmptyState

**Files:**
- Modify: `src/App.tsx` (bottone Verifica, card errore, overlay EmptyState/Profilo), `src/ui/ImportButton.tsx`, `src/ui/OfflineBanner.tsx`, `src/ui/DataStatusBanner.tsx`, `src/ui/Disclaimer.tsx`, `src/ui/EmptyState.tsx`, `src/index.css` (`.banner`, `.banner-dot`, `.error-card`, `.overlay-dim`)
- Test: esistenti — restano verdi senza modifiche.

**Interfaces:**
- Consumes: `.glass-panel`, `.btn-accent`, `.press`, `.anim-pop` (Task 2).

- [ ] **Step 1: CSS — aggiungi in coda a `src/index.css`**

```css
/* Banner informativi: card vetro compatta con puntino colorato */
.banner { display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 14px; border-radius: var(--radius-card); font-size: 14px; }
.banner-dot { width: 8px; height: 8px; border-radius: 50%; flex: none;
  margin-top: 6px; }

/* Card errore: leggibile nei due temi (non testo rosso nudo sulla mappa) */
.error-card { display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 14px; border-radius: var(--radius-card);
  max-width: 480px; font-size: 14px; font-weight: 500; color: #ef4444; }

/* Overlay modale: scurisce E sfoca la mappa sotto */
.overlay-dim { background: rgba(0, 0, 0, 0.35);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
```

- [ ] **Step 2: `src/ui/ImportButton.tsx` — solo il bottone cambia**

```tsx
      <button onClick={() => input.current?.click()}
        className="btn-accent press px-4 py-2 text-sm">
        Importa file zone (ED-269)
      </button>
```

- [ ] **Step 3: `src/App.tsx` — bottone Verifica (righe 111-117)**

```tsx
        <button onClick={() => setVerify({ point: null, radiusM: 100 })}
          disabled={zones.length === 0 || !!verify}
          title={zones.length === 0 ? 'Importa prima le zone' : 'Posso volare qui?'}
          className="btn-accent press px-4 py-2 text-sm disabled:opacity-50">
          Verifica
        </button>
```

- [ ] **Step 4: `src/App.tsx` — overlay Profilo ed EmptyState usano `.overlay-dim`**

Overlay profilo (righe 139-144):

```tsx
      {profileOpen && (
        <div className="overlay-dim" style={{ position:'absolute', inset:0,
          display:'grid', placeItems:'center', padding:16, zIndex: 30 }}>
          <ProfilePanel profiles={profiles} onClose={() => setProfileOpen(false)} />
        </div>
      )}
```

Overlay empty state (righe 146-151):

```tsx
      {zones.length === 0 && (
        <div className="overlay-dim" style={{ position:'absolute', inset:0,
          display:'grid', placeItems:'center', padding:16 }}>
          <EmptyState onImported={async () => { await refresh(); }} onError={setErr} />
        </div>
      )}
```

- [ ] **Step 5: `src/App.tsx` — card errore (righe 152-154)**

```tsx
      {(err ?? geo.error) && (
        <div role="alert" className="glass-panel error-card anim-pop"
          style={{ position:'absolute', top:'calc(var(--safe-top) + 64px)',
            left:'calc(var(--safe-left) + 12px)', right:'calc(var(--safe-right) + 12px)',
            width:'fit-content' }}>
          <span className="banner-dot" style={{ background:'#ef4444' }} aria-hidden="true" />
          <span>{err ?? geo.error}</span>
        </div>
      )}
```

- [ ] **Step 6: `src/ui/OfflineBanner.tsx` — file completo**

```tsx
export function OfflineBanner() {
  return (
    <div role="status" className="glass-panel banner anim-pop">
      <span className="banner-dot" style={{ background: '#f59e0b' }} aria-hidden="true" />
      <span><b>Sei offline</b> — zone e verifica funzionano; ricerca non disponibile</span>
    </div>
  );
}
```

(Sparisce solo il glifo 📡; il testo resta identico — l'E2E offline cerca il testo.)

- [ ] **Step 7: `src/ui/DataStatusBanner.tsx` — solo il `return` cambia**

```tsx
  return (
    <div className="glass-panel banner">
      <span className="banner-dot" aria-hidden="true"
        style={{ background: stale ? '#f59e0b' : '#22c55e' }} />
      <span>
        Dati aggiornati al <b>{when}</b>{' '}
        {stale && (
          <span style={{ color: '#f59e0b' }}>
            · ⚠️ potrebbero non essere aggiornati, reimporta il file
          </span>
        )}
      </span>
    </div>
  );
```

- [ ] **Step 8: `src/ui/Disclaimer.tsx` — file completo (solo respiro tipografico)**

```tsx
export function Disclaimer() {
  return (
    <div className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5,
      maxWidth: 420 }}>
      App <b>non ufficiale</b>. Verifica sempre sul portale ufficiale prima di volare:{' '}
      <a href="https://www.d-flight.it" target="_blank" rel="noreferrer"
        style={{ color: 'var(--accent)', fontWeight: 500 }}>
        D-Flight
      </a>
      .
    </div>
  );
}
```

- [ ] **Step 9: `src/ui/EmptyState.tsx` — il contenitore diventa vetro**

```tsx
    <div className="glass-panel anim-pop mx-auto max-w-md p-6 text-center"
      style={{ borderRadius: 'var(--radius-sheet)' }}>
```

(Il resto del file è invariato.)

- [ ] **Step 10: Suite + typecheck + commit**

Run: `npx vitest run && npx tsc -b`
Expected: PASS.

```bash
git add src/App.tsx src/ui/ImportButton.tsx src/ui/OfflineBanner.tsx src/ui/DataStatusBanner.tsx src/ui/Disclaimer.tsx src/ui/EmptyState.tsx src/index.css
git commit -m "feat(ui): bottoni accento, banner vetro con puntino, card errore, overlay sfocati"
```

---

### Task 6: Legenda — card vetro con chevron

**Files:**
- Modify: `src/ui/Legend.tsx`, `src/index.css` (`.legend`, `.chev`)
- Test: `tests/ui/mobileChrome.test.tsx` e `tests/ui/Legend.test.tsx` restano verdi senza modifiche (il summary conserva il testo e lo `span.hidden sm:inline`).

**Interfaces:**
- Consumes: `.glass-panel` (Task 2), `ChevronIcon` (Task 3).

- [ ] **Step 1: CSS — aggiungi in coda a `src/index.css`**

```css
/* Legenda: card vetro, chevron che ruota all'apertura */
.legend { border-radius: var(--radius-card); padding: 12px 14px; }
.legend summary { display: flex; align-items: center; gap: 6px; list-style: none; }
.legend summary::-webkit-details-marker { display: none; }
.chev { display: flex; color: var(--text-muted); flex: none; }
@media (prefers-reduced-motion: no-preference) {
  .chev { transition: transform 0.2s var(--ease-out); }
}
.legend[open] .chev { transform: rotate(90deg); }
```

- [ ] **Step 2: `src/ui/Legend.tsx` — il `<details>` e il `<summary>` cambiano così**

```tsx
    <details
      // su telefono la legenda aperta copre mezza mappa: parte chiusa lì,
      // aperta su desktop (valutato al mount; il toggle resta manuale)
      open={typeof window === 'undefined' || window.innerWidth > 640}
      className="glass-panel legend text-sm"
    >
      <summary className="cursor-pointer font-semibold select-none">
        <span className="chev" aria-hidden="true"><ChevronIcon size={13} /></span>
        Legenda<span className="hidden sm:inline"> (quota indicata sulla zona solo dove diversa)</span>
      </summary>
```

E aggiungi in testa: `import { ChevronIcon } from '../ui/icons';` → siccome siamo già in `src/ui`, l'import corretto è `import { ChevronIcon } from './icons';`
Il resto del file (righe categorie, checkbox, chip, nota sovrapposizioni) è INVARIATO — i chip colore replicano la mappa e non si toccano.

- [ ] **Step 3: Suite + typecheck + commit**

Run: `npx vitest run && npx tsc -b`
Expected: PASS (in particolare i 3 test di `mobileChrome.test.tsx` sulla Legenda).

```bash
git add src/ui/Legend.tsx src/index.css
git commit -m "feat(ui): legenda in vetro con chevron animato"
```

---

### Task 7: Popup MapLibre in vetro

**Files:**
- Modify: `src/index.css` (solo le regole `:root .maplibregl-popup-*` e `.zone-popup-*`)
- Test: nessun nuovo test (regole già coperte da `premiumTokens` per il fallback; verifica visiva al Task 9).

- [ ] **Step 1: Sostituisci il blocco popup esistente in `index.css` (righe 22-59) con**

```css
/* Popup MapLibre — vetro come il resto del chrome (default libreria: bianco
   fisso). Prefisso :root per vincere in specificità su maplibre-gl.css, che
   nel grafo dei moduli viene importato DOPO questo file (MapView) e a parità
   di specificità riprenderebbe il bianco fisso. */
:root .maplibregl-popup-content {
  background: var(--glass-bg);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  color: var(--text);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  padding: 12px 16px;
  font-family: inherit;
}
:root .maplibregl-popup-close-button {
  color: var(--text-muted);
  font-size: 16px;
  padding: 2px 8px;
  border-radius: 50%;
}
/* la freccetta segue il colore vetro (senza blur: è un triangolo di border) */
:root .maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
:root .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
:root .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip { border-top-color: var(--glass-bg); }
:root .maplibregl-popup-anchor-top .maplibregl-popup-tip,
:root .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
:root .maplibregl-popup-anchor-top-right .maplibregl-popup-tip { border-bottom-color: var(--glass-bg); }
:root .maplibregl-popup-anchor-left .maplibregl-popup-tip { border-right-color: var(--glass-bg); }
:root .maplibregl-popup-anchor-right .maplibregl-popup-tip { border-left-color: var(--glass-bg); }
@media (prefers-reduced-motion: no-preference) {
  :root .maplibregl-popup { animation: pop-in 0.18s var(--ease-out); }
}

/* Contenuto popup multi-zona (accordion) */
.zone-popup { max-height: 260px; overflow-y: auto; min-width: 210px; }
.zone-popup-item + .zone-popup-item {
  border-top: 1px solid color-mix(in srgb, var(--text-muted) 22%, transparent); }
.zone-popup-head { display: flex; gap: 9px; align-items: center; width: 100%;
  padding: 8px 0; background: none; border: 0; color: inherit; font: inherit;
  text-align: left; cursor: pointer; }
.zone-popup-dot { width: 10px; height: 10px; border-radius: 50%; flex: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 10%, transparent); }
.zone-popup-detail { padding: 0 0 10px 19px; color: var(--text-muted);
  line-height: 1.45; }
.zone-popup-plain { color: var(--text); font-weight: 600; margin: 2px 0 5px; }
.zone-popup-tech { margin-top: 7px; font-size: 12px; }
.zone-popup-tech summary { cursor: pointer; color: var(--text-muted); user-select: none; }
.zone-popup-tech > div { padding-left: 12px; }
```

Nota: il fallback `@supports not (backdrop-filter…)` del Task 2 copre già
`:root .maplibregl-popup-content` (torna a `--surface` pieno).

- [ ] **Step 2: Suite + typecheck + commit**

Run: `npx vitest run && npx tsc -b`
Expected: PASS.

```bash
git add src/index.css
git commit -m "feat(ui): popup mappa in vetro, accordion con più aria"
```

---

### Task 8: Verifica e pannelli — VerifyControls, VerdictSheet, ProfilePanel, UpdateToast

**Files:**
- Modify: `src/verify/VerifyControls.tsx`, `src/verify/VerdictSheet.tsx`, `src/profiles/ProfilePanel.tsx`, `src/pwa/UpdateToast.tsx`, `src/index.css` (grabber, animazioni sheet, `.update-toast`)
- Test: esistenti (`tests/verify/*`, `tests/profiles/*`, `tests/pwa/*`) restano verdi senza modifiche.

**Interfaces:**
- Consumes: `.glass-panel`, `.btn-accent`, `.press`, `.icon-btn`, `.field`, `.anim-rise` (Task 2); `CloseIcon`, `TargetIcon` (Task 3).

- [ ] **Step 1: CSS — aggiorna/aggiungi in `src/index.css`**

Aggiorna la regola `.verify-controls` esistente aggiungendo raggio e animazione, e aggiungi grabber + toast:

```css
/* (nella regola .verify-controls esistente non cambia il posizionamento) */
.verify-controls { border-radius: var(--radius-card); }
@media (prefers-reduced-motion: no-preference) {
  /* scende dall'alto mantenendo il centraggio orizzontale */
  .verify-controls { animation: drop-center 0.22s var(--ease-out); }
}
@keyframes drop-center {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* Maniglietta iOS del bottom sheet (solo mobile) */
@media (max-width: 640px) {
  .verdict-sheet::before { content: ''; display: block; width: 36px; height: 5px;
    border-radius: 3px; margin: 2px auto 10px;
    background: color-mix(in srgb, var(--text-muted) 45%, transparent); }
}

/* Toast aggiornamento PWA: centrato, scende dall'alto */
.update-toast { position: absolute; top: calc(var(--safe-top) + 64px); left: 50%;
  transform: translateX(-50%); z-index: 40; border-radius: var(--radius-card);
  display: flex; gap: 12px; align-items: center; padding: 10px 16px; }
@media (prefers-reduced-motion: no-preference) {
  .update-toast { animation: drop-center 0.22s var(--ease-out); }
}
```

E aggiorna la regola `.radius-step` esistente (solo raggio e colore):

```css
.radius-step { width: 32px; height: 32px; border-radius: 10px; flex: none;
  font-size: 18px; line-height: 1; font-weight: 600; color: var(--text);
  background: color-mix(in srgb, var(--text-muted) 16%, transparent);
  border: 0; cursor: pointer; }
```

- [ ] **Step 2: `src/verify/VerifyControls.tsx` — file completo**

```tsx
// src/verify/VerifyControls.tsx
import { CloseIcon, TargetIcon } from '../ui/icons';

const RADIUS_MIN = 0;
const RADIUS_MAX = 500;
const BTN_STEP = 20; // multiplo dello step dello slider: niente arrotondamenti

export function VerifyControls(
  { hasPoint, radiusM, onRadiusChange, canUsePosition, onUsePosition, onClose }: {
    hasPoint: boolean; radiusM: number; onRadiusChange: (m: number) => void;
    canUsePosition: boolean; onUsePosition: () => void; onClose: () => void;
  }
) {
  const clamp = (m: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, m));
  return (
    <div className="verify-controls glass-panel p-3"
      style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {!hasPoint ? (
        <>
          <span className="text-sm" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)', display: 'flex' }}><TargetIcon size={16} /></span>
            Tocca un punto sulla mappa
          </span>
          {canUsePosition && (
            <button onClick={onUsePosition}
              className="btn-accent press px-3 py-1 text-sm">Usa la mia posizione</button>
          )}
        </>
      ) : (
        <div className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <span>Raggio</span>
          {/* − / + funzionano sempre, anche dove il drag touch fa i capricci */}
          <button type="button" onClick={() => onRadiusChange(clamp(radiusM - BTN_STEP))}
            aria-label="Riduci il raggio" className="radius-step press">−</button>
          <input type="range" min={RADIUS_MIN} max={RADIUS_MAX} step={10} value={radiusM}
            aria-label="Raggio di verifica"
            className="radius-slider"
            onChange={e => onRadiusChange(Number(e.target.value))} />
          <button type="button" onClick={() => onRadiusChange(clamp(radiusM + BTN_STEP))}
            aria-label="Aumenta il raggio" className="radius-step press">+</button>
          <span style={{ minWidth: 48, textAlign: 'right' }}>{radiusM} m</span>
        </div>
      )}
      <button onClick={onClose} aria-label="Esci dalla verifica" className="icon-btn">
        <CloseIcon size={15} />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: `src/verify/VerdictSheet.tsx` — solo questi punti cambiano**

1. Import in testa: `import { CloseIcon } from '../ui/icons';`
2. Il contenitore (riga 38-39):

```tsx
    <div className="verdict-sheet glass-panel anim-rise p-4" role="dialog" aria-label="Verdetto"
      style={{ borderRadius: 'var(--radius-sheet)' }}>
```

(Su mobile il CSS esistente forza `border-radius: 16px 16px 0 0` — resta.)
3. Il bottone chiudi (righe 42-43):

```tsx
        <button onClick={onClose} aria-label="Chiudi verdetto" className="icon-btn">
          <CloseIcon size={16} />
        </button>
```

4. Il select drone (righe 48-53): `className="field text-sm"` e via lo `style` inline:

```tsx
          <select value={activeDroneId ?? ''} aria-label="Drone"
            onChange={e => onSelectDrone(e.target.value)}
            className="field text-sm">
```

5. Il bottone "Apri profilo" (righe 60-62):

```tsx
          <button onClick={onOpenProfile}
            className="btn-accent press px-4 py-2 text-sm" style={{ marginTop: 6 }}>Apri profilo</button>
```

I semafori del verdetto (`OUTCOME_UI`, emoji ✅🟡🟠⛔⚠️) sono contenuto
informativo, non chrome: NON si toccano (spec: logica e testi invariati).

- [ ] **Step 4: `src/profiles/ProfilePanel.tsx` — solo questi punti cambiano**

1. Import in testa: `import { CloseIcon } from '../ui/icons';`
2. Contenitore (righe 42-44):

```tsx
    <div role="dialog" aria-label="Profilo" className="glass-panel anim-pop p-4"
      style={{ borderRadius: 'var(--radius-sheet)',
        width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto' }}>
```

3. Bottone chiudi (righe 47-48):

```tsx
        <button onClick={onClose} aria-label="Chiudi profilo" className="icon-btn">
          <CloseIcon size={16} />
        </button>
```

4. Tutti gli input/select del form: sostituisci `className="rounded px-2 py-1"` +
`style={{ border: '1px solid var(--text-muted)', … }}` con `className="field text-sm"`
mantenendo SOLO `style={{ width: '100%' }}` dove presente. Nel dettaglio:
   - input Nome: `className="field text-sm" style={{ width: '100%' }}`
   - input Massa (g): `className="field text-sm" style={{ width: '100%' }}`
   - select Classe: `className="field text-sm" style={{ width: '100%' }}`
   - input date Scadenza: `className="field text-xs"`
   - input Numero operatore: `className="field text-sm" style={{ width: '100%' }}`
5. Bottone Aggiungi/Salva drone (righe 99-103):

```tsx
        <button onClick={() => { void submit(); }}
          className="btn-accent press px-4 py-2 text-sm">
          {editingId ? 'Salva drone' : 'Aggiungi drone'}
        </button>
```

- [ ] **Step 5: `src/pwa/UpdateToast.tsx` — file completo**

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Registra il service worker e mostra il toast quando c'è una nuova versione.
 *  L'update parte SOLO al tap su Aggiorna (registerType: 'prompt'). */
export function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="glass-panel update-toast text-sm">
      Nuova versione disponibile
      <button onClick={() => { void updateServiceWorker(true); }}
        className="btn-accent press px-3 py-1 text-sm">
        Aggiorna
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Suite + typecheck + commit**

Run: `npx vitest run && npx tsc -b`
Expected: PASS (in particolare `tests/verify/VerifyControls.test.tsx`,
`tests/verify/VerdictSheet.test.tsx`, `tests/profiles/ProfilePanel.test.tsx`,
`tests/pwa/UpdateToast.test.tsx` — selezionano per ruolo/aria-label, non per stile).

```bash
git add src/verify/VerifyControls.tsx src/verify/VerdictSheet.tsx src/profiles/ProfilePanel.tsx src/pwa/UpdateToast.tsx src/index.css
git commit -m "feat(ui): pannelli verifica/verdetto/profilo/toast in vetro, grabber iOS, campi coerenti"
```

---

### Task 9: Pulizia alias, verifica completa, screenshot "dopo"

**Files:**
- Modify: `src/index.css` (rimozione alias `--shadow`), `MEMORIA.md` (a verdetto ricevuto)

- [ ] **Step 1: Nessun uso residuo di `--shadow`**

Run: `grep -rn "var(--shadow)" src/ | grep -v -- "--shadow-sm" | grep -v -- "--shadow-lg"`
Expected: nessun risultato. Se ne restano, migra quei punti a `--shadow-sm`/`--shadow-lg` (componenti piccoli → sm, pannelli → lg).

- [ ] **Step 2: Rimuovi le due righe alias `--shadow: var(--shadow-lg);` da `index.css`**

(una in `:root`, una in `[data-theme='dark']`).

- [ ] **Step 3: Verifica completa**

```bash
npx vitest run          # attesi: tutti verdi (286 + i nuovi premiumTokens/icons)
npx tsc -b              # pulito
npm run build           # ok
node e2e/run.mjs        # 15/15
node e2e/offline.mjs    # 11/11
```

Expected: tutto verde. Se un E2E fallisce su un selettore, il fix va nello
SCRIPT solo se il selettore era legato a uno stile/emoji rimosso (come
shot.mjs al Task 4); mai indebolire un check.

- [ ] **Step 4: Screenshot "dopo" + confronto**

```bash
npm run build && (npx vite preview --port 5199 --strictPort &) && sleep 2
node e2e/shot.mjs http://localhost:5199/d-flight-personale/ .tmp-screens/premium/after 10.3
kill %1 2>/dev/null || pkill -f "vite preview --port 5199"
```

Confronta a occhio before/after nei due temi: (a) il chrome è vetro e curato;
(b) **la mappa sotto (zone, veli, etichette) è identica**. Se la mappa
differisce, c'è una regressione: fermarsi e indagare.

- [ ] **Step 5: Commit finale + presentazione a Lorenzo**

```bash
git add src/index.css
git commit -m "chore(ui): via l'alias --shadow, restyle premium completo"
```

Mostra a Lorenzo gli screenshot before/after (chiaro+scuro) per il verdetto
estetico. **Niente push finché non approva.** Dopo il verdetto: aggiornare
MEMORIA.md (TODO + Log) e committare.
