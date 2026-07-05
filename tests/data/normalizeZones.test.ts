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
