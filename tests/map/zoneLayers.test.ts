import { describe, it, expect } from 'vitest';
import {
  buildFillPaint, buildFillLayout, buildLinePaint, buildCatLinePaint,
  buildCatFillPaint, typeVisibilityFilter,
  buildLabelLayout, severitySortKey, highlightFilter,
  labelDiffFilter, labelStandardFilter, hatchImage,
} from '../../src/map/MapView';
import {
  RESTRICTION_ORDER, ZONE_COLORS, ZONE_DETAIL_MINZOOM, ZONE_LABEL_ALL_MINZOOM,
} from '../../src/map/mapStyle';

/** Estrae il valore prodotto da una match-expression MapLibre per un dato input. */
function evalMatch(expr: unknown, value: string): number {
  const e = expr as unknown[];
  expect(Array.isArray(e) && e[0] === 'match').toBe(true);
  for (let i = 2; i < e.length - 1; i += 2) {
    if (e[i] === value) return e[i + 1] as number;
  }
  return e[e.length - 1] as number; // fallback
}

it('maps restriction types to colors via a data-driven expression', () => {
  const paint = buildFillPaint() as any;
  const expr = JSON.stringify(paint['fill-color']);
  expect(expr).toContain('prohibited');
  expect(expr).toContain(ZONE_COLORS.prohibited);
});

it('highlightFilter: id selezionato o sentinella che non matcha nulla', () => {
  expect(highlightFilter('z9')).toEqual(['==', ['get', 'id'], 'z9']);
  expect(highlightFilter(null)).toEqual(['==', ['get', 'id'], '__none__']);
});

describe('leggibilità zone sovrapposte', () => {
  it('RESTRICTION_ORDER: 0 = più restrittivo, condiviso da popup e rendering', () => {
    expect(RESTRICTION_ORDER.prohibited).toBe(0);
    expect(RESTRICTION_ORDER.auth_required).toBe(1);
    expect(RESTRICTION_ORDER.conditional).toBe(2);
    expect(RESTRICTION_ORDER.none).toBe(3);
  });

  it('fill-opacity decrescente con la severità: il verde è invisibile per evitare effetto "inglobamento"', () => {
    const paint = buildFillPaint() as any;
    const op = (t: string) => evalMatch(paint['fill-opacity'], t);
    expect(op('prohibited')).toBeGreaterThan(op('auth_required'));
    expect(op('auth_required')).toBeGreaterThan(op('conditional'));
    expect(op('conditional')).toBeGreaterThan(op('none'));
    expect(op('prohibited')).toBeLessThanOrEqual(0.5); // resta un overlay, non copre la mappa
    // Le zone "none" sono invisibili (opacità 0): non inglobano visivamente altre zone
    expect(op('none')).toBe(0);
    // riempimenti LEGGERI (feedback 2026-07-10): la mappa base resta leggibile;
    // il colore quasi pieno solo dove il divieto è assoluto
    expect(op('auth_required')).toBeLessThanOrEqual(0.15);
    expect(op('conditional')).toBeLessThanOrEqual(0.12);
  });

  it('fill-sort-key: le zone più restrittive vengono disegnate sopra', () => {
    const key = severitySortKey();
    const k = (t: string) => evalMatch(key, t);
    expect(k('prohibited')).toBeGreaterThan(k('auth_required'));
    expect(k('auth_required')).toBeGreaterThan(k('conditional'));
    expect(k('conditional')).toBeGreaterThan(k('none'));
    const layout = buildFillLayout() as any;
    expect(layout['fill-sort-key']).toEqual(key);
  });

  it('bordi gerarchici: line-width maggiore per zone più restrittive, bordi "none" invisibili', () => {
    const paint = buildLinePaint() as any;
    const w = (t: string) => evalMatch(paint['line-width'], t);
    expect(w('prohibited')).toBeGreaterThan(w('auth_required'));
    expect(w('auth_required')).toBeGreaterThan(w('conditional'));
    // Le zone "none" sono invisibili (nessun bordo)
    expect(w('none')).toBe(0);
    expect(JSON.stringify(paint['line-color'])).toContain(ZONE_COLORS.prohibited);
    // ora è una case-expression per fascia: il ramo "primaria" resta ben visibile
    expect((paint['line-opacity'] as unknown[])[2]).toBeGreaterThanOrEqual(0.8);
  });

  it('etichette: symbol-sort-key dà priorità alla zona più restrittiva in collisione', () => {
    const layout = buildLabelLayout() as any;
    const k = (t: string) => evalMatch(layout['symbol-sort-key'], t);
    // sort-key più basso = piazzata prima = vince la collisione
    expect(k('prohibited')).toBeLessThan(k('none'));
    expect(layout['text-field']).toEqual(['get', 'label']);
  });
});

describe('typeVisibilityFilter: nascondere categorie scelte dall\'utente (legenda)', () => {
  it('senza categorie nascoste → il filtro base resta com\'è (null se assente)', () => {
    expect(typeVisibilityFilter([])).toBeNull();
    const base = ['==', ['get', 'x'], 1];
    expect(typeVisibilityFilter([], base as never)).toEqual(base);
  });

  it('con categorie nascoste → esclude quei restrictionType', () => {
    const f = typeVisibilityFilter(['auth_required']);
    expect(f).toEqual(['!', ['in', ['get', 'restrictionType'], ['literal', ['auth_required']]]]);
  });

  it('combina il filtro base in AND con la visibilità', () => {
    const base = ['==', ['get', 'labelPrimary'], true];
    const f = typeVisibilityFilter(['conditional'], base as never) as unknown[];
    expect(f[0]).toBe('all');
    expect(f[1]).toEqual(base);
    expect(JSON.stringify(f[2])).toContain('conditional');
  });
});

describe('dedup fasce sulla mappa (bordi annidati + etichette duplicate)', () => {
  it('line-opacity: bordo pieno solo su bandPrimary, accennato sulle altre fasce', () => {
    const paint = buildLinePaint() as any;
    const expr = paint['line-opacity'] as unknown[];
    expect(expr[0]).toBe('case');
    expect(JSON.stringify(expr)).toContain('bandPrimary');
    const [, , full, faint] = expr as [string, unknown, number, number];
    expect(full).toBeGreaterThan(faint);
    expect(faint).toBeGreaterThan(0); // le fasce restano accennate, non invisibili
  });

  it('filtri etichette: eccezioni separate dalle quote standard, sempre sulla fascia primaria', () => {
    expect(labelDiffFilter()).toEqual(['all',
      ['==', ['get', 'labelPrimary'], true],
      ['==', ['get', 'labelDiffers'], true]]);
    expect(labelStandardFilter()).toEqual(['all',
      ['==', ['get', 'labelPrimary'], true],
      ['!=', ['get', 'labelDiffers'], true]]);
  });
});

describe('vista d\'insieme per categoria (caso Fiumicino, 2026-07-10)', () => {
  it('le soglie zoom sono ordinate: insieme < dettaglio < etichette standard', () => {
    expect(ZONE_DETAIL_MINZOOM).toBeGreaterThan(5);
    expect(ZONE_LABEL_ALL_MINZOOM).toBeGreaterThan(ZONE_DETAIL_MINZOOM);
  });

  it('bordo di categoria: colori dalla palette', () => {
    const paint = buildCatLinePaint() as any;
    expect(JSON.stringify(paint['line-color'])).toContain(ZONE_COLORS.auth_required);
  });

  it('veli d\'insieme GRADUATI con lo zoom: all\'Italia intera resta leggibile solo il rosso', () => {
    // feedback 2026-07-14: "con le aree non si capisce una mazza" — alla
    // scala nazionale i veli arancio/giallo devono sparire quasi del tutto
    // (resta il basemap + il vietato), e riprendere corpo salendo di zoom
    const paint = buildCatFillPaint() as any;
    const expr = paint['fill-opacity'] as unknown[];
    expect(expr[0]).toBe('interpolate');
    expect(expr[2]).toEqual(['zoom']);
    const [lowStop, highStop] = [expr[4], expr[6]];
    // stop basso (Italia intera): arancio quasi invisibile, rosso ben visibile
    expect(evalMatch(lowStop, 'auth_required')).toBeLessThanOrEqual(0.03);
    expect(evalMatch(lowStop, 'conditional')).toBeLessThanOrEqual(0.03);
    expect(evalMatch(lowStop, 'prohibited')).toBeGreaterThanOrEqual(0.25);
    // stop alto (vicino al dettaglio): i valori pieni di sempre
    expect(evalMatch(highStop, 'auth_required')).toBe(0.07);
    expect(evalMatch(highStop, 'prohibited')).toBe(0.35);
  });

  it('bordi d\'insieme graduati: niente ragnatela arancione all\'Italia intera', () => {
    const paint = buildCatLinePaint() as any;
    const expr = paint['line-opacity'] as unknown[];
    expect(expr[0]).toBe('interpolate');
    const [lowStop, highStop] = [expr[4], expr[6]];
    expect(evalMatch(lowStop, 'auth_required')).toBeLessThanOrEqual(0.15);
    expect(evalMatch(lowStop, 'prohibited')).toBeGreaterThanOrEqual(0.7);
    expect(evalMatch(highStop, 'auth_required')).toBeGreaterThanOrEqual(0.9);
  });

  it('tratteggio diagonale: pattern RGBA col colore auth_required, il resto trasparente', () => {
    const img = hatchImage(ZONE_COLORS.auth_required, 12);
    expect(img.width).toBe(12);
    expect(img.data.length).toBe(12 * 12 * 4);
    let colored = 0, transparent = 0;
    for (let i = 3; i < img.data.length; i += 4) {
      if (img.data[i] > 0) colored++; else transparent++;
    }
    expect(colored).toBeGreaterThan(0);
    expect(transparent).toBeGreaterThan(colored); // righe sottili, non un tappeto
  });
});
