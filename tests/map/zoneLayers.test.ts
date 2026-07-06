import { describe, it, expect } from 'vitest';
import {
  buildFillPaint, buildFillLayout, buildLinePaint, buildLabelLayout,
  severitySortKey, highlightFilter,
} from '../../src/map/MapView';
import { RESTRICTION_ORDER } from '../../src/map/mapStyle';

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
  expect(expr).toContain('#ef4444');
});

it('highlightFilter: name selezionato o sentinella che non matcha nulla', () => {
  expect(highlightFilter('X')).toEqual(['==', ['get', 'name'], 'X']);
  expect(highlightFilter(null)).toEqual(['==', ['get', 'name'], '__none__']);
});

describe('leggibilità zone sovrapposte', () => {
  it('RESTRICTION_ORDER: 0 = più restrittivo, condiviso da popup e rendering', () => {
    expect(RESTRICTION_ORDER.prohibited).toBe(0);
    expect(RESTRICTION_ORDER.auth_required).toBe(1);
    expect(RESTRICTION_ORDER.conditional).toBe(2);
    expect(RESTRICTION_ORDER.none).toBe(3);
  });

  it('fill-opacity decrescente con la severità: il verde è un velo, il rosso resta visibile', () => {
    const paint = buildFillPaint() as any;
    const op = (t: string) => evalMatch(paint['fill-opacity'], t);
    expect(op('prohibited')).toBeGreaterThan(op('auth_required'));
    expect(op('auth_required')).toBeGreaterThan(op('conditional'));
    expect(op('conditional')).toBeGreaterThan(op('none'));
    for (const t of ['prohibited', 'auth_required', 'conditional', 'none']) {
      expect(op(t)).toBeGreaterThan(0);
      expect(op(t)).toBeLessThanOrEqual(0.5); // resta un overlay, non copre la mappa
    }
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

  it('bordi gerarchici: line-width maggiore per zone più restrittive, bordo ben visibile', () => {
    const paint = buildLinePaint() as any;
    const w = (t: string) => evalMatch(paint['line-width'], t);
    expect(w('prohibited')).toBeGreaterThan(w('auth_required'));
    expect(w('auth_required')).toBeGreaterThan(w('none'));
    expect(JSON.stringify(paint['line-color'])).toContain('#ef4444');
    expect(paint['line-opacity']).toBeGreaterThanOrEqual(0.8);
  });

  it('etichette: symbol-sort-key dà priorità alla zona più restrittiva in collisione', () => {
    const layout = buildLabelLayout() as any;
    const k = (t: string) => evalMatch(layout['symbol-sort-key'], t);
    // sort-key più basso = piazzata prima = vince la collisione
    expect(k('prohibited')).toBeLessThan(k('none'));
    expect(layout['text-field']).toEqual(['get', 'label']);
  });
});
