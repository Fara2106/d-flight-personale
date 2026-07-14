import { describe, it, expect } from 'vitest';
import { categoryAltitudes, legendAltitudeText } from '../../src/data/categoryAltitudes';
import type { Zone } from '../../src/data/ed269.types';

const zone = (over: Partial<Zone>): Zone => ({
  id: Math.random().toString(36).slice(2), name: 'Z', restrictionType: 'auth_required',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  lowerLimitM: 0, upperLimitM: 120, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true,
  ...over,
});

describe('categoryAltitudes: quota tipica per categoria dai dati ED-269', () => {
  it('moda e uniformità: 120 m dominante → uniform', () => {
    const zones = [
      ...Array.from({ length: 9 }, () => zone({})),
      zone({ upperLimitM: 60 }),
    ];
    const a = categoryAltitudes(zones).auth_required;
    expect(a.modeM).toBe(120);
    expect(a.uniform).toBe(true); // ≥90% sul valore di moda
    expect(a.minM).toBe(60);
    expect(a.maxM).toBe(120);
    expect(a.count).toBe(10);
  });

  it('quote sparse → non uniforme, con range', () => {
    const zones = [zone({ upperLimitM: 25 }), zone({ upperLimitM: 60 }), zone({ upperLimitM: 120 })];
    const a = categoryAltitudes(zones).auth_required;
    expect(a.uniform).toBe(false);
    expect(a.minM).toBe(25);
    expect(a.maxM).toBe(120);
  });

  it('le quote AMSL non entrano nel computo (mai confuse con l\'altezza dal suolo)', () => {
    const zones = [zone({}), zone({ upperLimitM: 500, verticalRef: 'AMSL' })];
    const a = categoryAltitudes(zones).auth_required;
    expect(a.modeM).toBe(120);
    expect(a.maxM).toBe(120);
  });

  it('categoria senza zone → count 0 e mode null', () => {
    const a = categoryAltitudes([zone({})]).none;
    expect(a.count).toBe(0);
    expect(a.modeM).toBeNull();
  });
});

describe('legendAltitudeText: dicitura onesta per la legenda', () => {
  it('vietato con moda 0 → divieto, non una quota', () => {
    const t = legendAltitudeText('prohibited',
      { modeM: 0, minM: 0, maxM: 0, count: 3, uniform: true });
    expect(t).toMatch(/non si vola|divieto/i);
  });
  it('vietato con quote variabili (file reale, sentinella 9999999) → SEMPRE divieto, mai il range', () => {
    // il file D-Flight reale ha zone vietate con upperLimit 5..9999999:
    // mostrare "5–9999999 m" in legenda è insensato — vietato = non si vola
    const t = legendAltitudeText('prohibited',
      { modeM: 500, minM: 5, maxM: 9999999, count: 765, uniform: false });
    expect(t).toMatch(/non si vola|divieto/i);
    expect(t).not.toMatch(/9999999/);
  });
  it('uniforme → "fino a X m"', () => {
    const t = legendAltitudeText('auth_required',
      { modeM: 120, minM: 60, maxM: 120, count: 10, uniform: true });
    expect(t).toBe('di norma fino a 120 m');
  });
  it('variabile → range e invito a toccare la zona', () => {
    const t = legendAltitudeText('conditional',
      { modeM: 60, minM: 25, maxM: 120, count: 5, uniform: false });
    expect(t).toMatch(/25.120 m/);
    expect(t).toMatch(/tocca la zona/i);
  });
  it('nessuna zona → null (niente riga quota)', () => {
    expect(legendAltitudeText('none',
      { modeM: null, minM: null, maxM: null, count: 0, uniform: false })).toBeNull();
  });
});
