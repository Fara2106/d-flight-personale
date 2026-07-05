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
