// tests/map/singleOutline.test.ts
// Feedback Lorenzo 2026-07-17: "le figure delle aree sono un po' accavallate
// ancora". Il round 6 aveva unificato i VELI (un colore per punto = regola più
// severa) ma aveva lasciato i BORDI per zona al dettaglio (zones-line da
// zones-render): sul file reale, a Roma/Fiumicino, decine di zone sovrapposte
// = decine di contorni intrecciati sopra il velo piatto (ragnatela).
// Regola nuova, simmetrica a quella dei veli: UN SOLO contorno per punto, dal
// mosaico per categoria, a OGNI zoom.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/map/MapView.tsx'), 'utf8');

/** Estrae il blocco addLayer del layer indicato (fino alla parentesi di chiusura). */
function layerBlock(id: string): string | null {
  const i = src.indexOf(`id: '${id}'`);
  if (i === -1) return null;
  return src.slice(i, src.indexOf('}, beforeId)', i) + 12);
}

describe('un solo contorno per punto (feedback "aree accavallate" 2026-07-17)', () => {
  it('il bordo del mosaico per categoria vale a OGNI zoom (niente maxzoom)', () => {
    const block = layerBlock('zones-cat-line');
    expect(block).not.toBeNull();
    expect(block).not.toMatch(/maxzoom/);
  });

  it('non esiste più un layer di bordi per singola zona', () => {
    // zones-line disegnava il contorno di OGNI zona (union per nome): dove le
    // zone si sovrappongono davvero il risultato era una ragnatela
    expect(layerBlock('zones-line')).toBeNull();
  });

  it('i confini restano visibili al dettaglio: bordo pieno allo stop di zoom alto', () => {
    // il velo è unico ma le figure devono restare leggibili: il contorno del
    // mosaico è netto da z9.5 in su (buildCatLinePaint)
    expect(src).toMatch(/buildCatLinePaint/);
  });
});
