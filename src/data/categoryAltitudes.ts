// src/data/categoryAltitudes.ts
// Quota "tipica" per categoria di restrizione, ricavata dai dati ED-269
// importati. Serve a due cose (feedback iPhone 2026-07-10):
// - legenda: accanto al colore, quanto in alto si può volare di norma;
// - mappa: etichettare SOLO le zone che differiscono dalla quota tipica
//   (il tappeto di "120 m" identici è rumore).
// Le quote AMSL/WGS84 sono ESCLUSE dal computo: non sono altezze dal suolo
// (policy del progetto: mai confonderle con l'AGL).

import type { Zone, RestrictionType } from './ed269.types';

export interface CatAltitude {
  /** Quota più frequente (m AGL), null se nessun dato utile. */
  modeM: number | null;
  minM: number | null;
  maxM: number | null;
  /** Zone considerate nel computo (AGL o riferimento assente). */
  count: number;
  /** true se ≥90% delle zone sta sulla quota di moda. */
  uniform: boolean;
}

const TYPES: RestrictionType[] = ['prohibited', 'auth_required', 'conditional', 'none'];

export function categoryAltitudes(zones: Zone[]): Record<RestrictionType, CatAltitude> {
  const out = {} as Record<RestrictionType, CatAltitude>;
  for (const t of TYPES) {
    const vals = zones
      .filter((z) => z.restrictionType === t && z.upperLimitM != null
        && z.verticalRef !== 'AMSL' && z.verticalRef !== 'WGS84')
      .map((z) => z.upperLimitM as number);
    if (vals.length === 0) {
      out[t] = { modeM: null, minM: null, maxM: null, count: 0, uniform: false };
      continue;
    }
    const freq = new Map<number, number>();
    for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);
    let modeM = vals[0], best = 0;
    for (const [v, n] of freq) if (n > best || (n === best && v > modeM)) { modeM = v; best = n; }
    out[t] = {
      modeM,
      minM: Math.min(...vals),
      maxM: Math.max(...vals),
      count: vals.length,
      uniform: best / vals.length >= 0.9,
    };
  }
  return out;
}

/** Dicitura per la riga di legenda; null = non mostrare nulla. */
export function legendAltitudeText(t: RestrictionType, a: CatAltitude): string | null {
  if (a.count === 0 || a.modeM == null) return null;
  if (t === 'prohibited' && a.modeM === 0) return 'non si vola';
  if (a.uniform) return `di norma fino a ${a.modeM} m`;
  return `${a.minM}–${a.maxM} m — variabile, tocca la zona`;
}
