// src/map/plainLanguage.ts
// Traduce i campi ED-269 di una zona in frasi semplici per chi è alle prime
// armi con i droni. Nessuna conversione di quota: AMSL/WGS84 restano tali,
// con un avviso esplicito (policy del progetto: AMSL mai convertito).

/** Frasi pronte per il popup: headline in evidenza + righe secondarie. */
export interface PlainZoneInfo {
  headline: string;
  lines: string[];
}

const HEADLINES: Record<string, string> = {
  prohibited: 'Vietato far volare il drone qui',
  auth_required: "Serve un'autorizzazione per volare qui",
  conditional: 'Si può volare, ma con condizioni da rispettare',
  none: 'Si può volare seguendo le regole generali',
};

/** Codici reason ED-269 → spiegazione in linguaggio comune (ignoti: omessi). */
const REASON_TEXT: Record<string, string> = {
  AIR_TRAFFIC: 'zona aeroportuale / traffico aereo',
  SENSITIVE: 'area sensibile',
  PRIVACY: 'tutela della privacy',
  POPULATION: 'area abitata',
  NATURE: 'area naturale protetta',
  NOISE: 'limiti di rumore',
  EMERGENCY: 'operazioni di emergenza',
};

/** MapLibre serializza le properties non primitive in stringhe JSON:
 *  accetta sia l'array originale sia la sua forma serializzata. */
export function parseReasons(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((r): r is string => typeof r === 'string');
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((r): r is string => typeof r === 'string') : [];
    } catch { return []; }
  }
  return [];
}

export function plainZoneInfo(p: Record<string, unknown>): PlainZoneInfo {
  const type = typeof p.restrictionType === 'string' ? p.restrictionType : '';
  const headline = HEADLINES[type] ?? 'Restrizioni non note: verifica prima di volare';
  const lines: string[] = [];

  // Quota in parole semplici (mai per le zone vietate: il divieto assorbe)
  const upper = typeof p.upperLimitM === 'number' ? p.upperLimitM : null;
  if (type !== 'prohibited' && upper != null) {
    const vref = typeof p.verticalRef === 'string' ? p.verticalRef : null;
    if (vref === 'AMSL') {
      lines.push(`Quota massima ${upper} m sul livello del mare (attenzione: non è l'altezza dal suolo)`);
    } else if (vref === 'WGS84') {
      lines.push(`Quota massima ${upper} m riferita all'ellissoide WGS84 (non è l'altezza dal suolo)`);
    } else {
      lines.push(`Quota massima qui: ${upper} m dal suolo`);
    }
  }

  const reasons = parseReasons(p.reasons)
    .map((r) => REASON_TEXT[r])
    .filter((t): t is string => Boolean(t));
  if (reasons.length > 0) lines.push(`Motivo: ${reasons.join(', ')}`);

  if (typeof p.applicabilityText === 'string' && p.applicabilityText) {
    lines.push(`Non è sempre attiva — vale: ${p.applicabilityText}`);
  }

  return { headline, lines };
}
