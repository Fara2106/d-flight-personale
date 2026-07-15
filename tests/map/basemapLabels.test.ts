import { describe, it, expect } from 'vitest';
import {
  firstSymbolLayerId, placeLabelBoosts, darkWaterTweaks,
} from '../../src/map/basemapLabels';

const LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'water', type: 'fill' },
  { id: 'roads', type: 'line' },
  { id: 'roadname', type: 'symbol', 'source-layer': 'transportation_name' },
  { id: 'place_hamlet', type: 'symbol', 'source-layer': 'place', minzoom: 12 },
  { id: 'place_town', type: 'symbol', 'source-layer': 'place', minzoom: 8 },
  { id: 'place_state', type: 'symbol', 'source-layer': 'place', minzoom: 5 },
  { id: 'place_continent', type: 'symbol', 'source-layer': 'place' },
] as never[];

describe('firstSymbolLayerId: dove inserire le zone perché i nomi restino sopra', () => {
  it('trova il primo layer symbol del basemap', () => {
    expect(firstSymbolLayerId(LAYERS)).toBe('roadname');
  });
  it('stile senza symbol (mock E2E) → undefined: le zone vanno in cima come oggi', () => {
    expect(firstSymbolLayerId([{ id: 'bg', type: 'background' }] as never[])).toBeUndefined();
  });
});

describe('placeLabelBoosts: più nomi di luoghi a parità di zoom', () => {
  it('anticipa di 2 le etichette place con minzoom ≥ 6 (città/paesi/frazioni)', () => {
    // sonda 2026-07-14: i tile CARTO hanno già i paesi a z8 e le città a z7 —
    // era il minzoom dello stile a nasconderli, non i dati
    const boosts = Object.fromEntries(
      placeLabelBoosts(LAYERS).map((b) => [b.id, b.minzoom]));
    expect(boosts.place_town).toBe(6);
    expect(boosts.place_hamlet).toBe(10);
  });
  it('NON tocca stati/continenti (già visibili presto) né i layer non-place', () => {
    const ids = placeLabelBoosts(LAYERS).map((b) => b.id);
    expect(ids).not.toContain('place_state');
    expect(ids).not.toContain('place_continent');
    expect(ids).not.toContain('roadname');
  });
});

describe('darkWaterTweaks: mare blu notte in tema scuro (feedback 2026-07-15)', () => {
  const DARK = [
    { id: 'background', type: 'background', paint: { 'background-color': '#0e0e0e' } },
    { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#2C353C' } },
    { id: 'water_shadow', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': 'transparent' } },
    { id: 'waterway', type: 'line', 'source-layer': 'waterway', paint: { 'line-color': 'rgba(63, 90, 109, 1)' } },
    { id: 'roads', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#222' } },
  ] as never[];

  it('il mare grigio diventa blu; i corsi d\'acqua con lui', () => {
    const tweaks = Object.fromEntries(
      darkWaterTweaks(DARK).map((t) => [t.id, t]));
    expect(tweaks.water.property).toBe('fill-color');
    expect(tweaks.water.value).toMatch(/^#/);
    expect(tweaks.water.value).not.toBe('#2C353C');
    expect(tweaks.waterway.property).toBe('line-color');
  });

  it('NON tocca il layer ombra trasparente né i layer non-acqua', () => {
    const ids = darkWaterTweaks(DARK).map((t) => t.id);
    expect(ids).not.toContain('water_shadow');
    expect(ids).not.toContain('roads');
    expect(ids).not.toContain('background');
  });
});
