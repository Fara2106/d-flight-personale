import { describe, it, expect } from 'vitest';
import { wireMapIdleFlag } from '../../src/map/mapIdleFlag';

function fakeMap() {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    on(ev: string, cb: () => void) { (handlers[ev] ??= []).push(cb); },
    fire(ev: string) { (handlers[ev] ?? []).forEach((cb) => cb()); },
  };
}

describe('wireMapIdleFlag', () => {
  it('espone data-map-idle su idle e lo toglie quando la mappa ridisegna', () => {
    const el = document.createElement('div');
    const m = fakeMap();
    wireMapIdleFlag(m, el);
    expect(el.dataset.mapIdle).toBeUndefined();

    m.fire('idle');
    expect(el.dataset.mapIdle).toBe('1');

    // nuovo frame (zoom, nuove tile, zone aggiunte): non più idle…
    m.fire('render');
    expect(el.dataset.mapIdle).toBeUndefined();

    // …finché MapLibre non ha finito di nuovo
    m.fire('idle');
    expect(el.dataset.mapIdle).toBe('1');
  });
});
