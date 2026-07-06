// src/map/plainLanguage.ts
// Traduce i campi ED-269 di una zona in frasi semplici per chi è alle prime
// armi con i droni. Nessuna conversione di quota: AMSL/WGS84 restano tali,
// con un avviso esplicito (policy del progetto: AMSL mai convertito).

import type { RestrictionType } from '../data/ed269.types';
import { RESTRICTION_ORDER } from './mapStyle';

/** Frasi pronte per il popup: headline in evidenza + righe secondarie. */
export interface PlainZoneInfo {
  headline: string;
  lines: string[];
}

/** Dati raggruppati per nome zona: voce principale (frase semplice) +
 *  elenco delle fasce di quota nei "Dettagli tecnici". */
export interface GroupedZoneInfo {
  /** Nome della zona (es. "LIML_MILANO/LINATE 18/36"). */
  name: string;
  headline: string;
  lines: string[];
  /** Lista di fasce (lower→upper) per i dettagli tecnici. */
  bands: Array<{ lowerM: number | null; upperM: number; verticalRef: string | null }>;
  /** Tipo della fascia principale (più restrittiva). */
  mainRestrictionType: RestrictionType;
  /** Message ED-269 della fascia principale. */
  message: string | null;
  /** Finestra di attività ED-269 della fascia principale. */
  applicabilityText: string | null;
}

interface _BandEntry {
  lowerM: number | null;
  upperM: number;
  verticalRef: string | null;
  restrictionType: RestrictionType;
}

/** Raggruppa items per nome zona, ordina le bande per severità,
 *  produce una voce principale (frase della banda più restrittiva)
 *  e raccoglie tutte le bande per i dettagli tecnici. */
export function plainGroupedZoneInfo(items: Array<Record<string, unknown>>): Array<GroupedZoneInfo> {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const p of items) {
    const name = typeof p.name === 'string' ? p.name : '(senza nome)';
    (groups.get(name) ?? groups.set(name, []).get(name)!).push(p);
  }
  const result: Array<GroupedZoneInfo> = [];
  for (const [name, props] of groups) {
    // Accoda i props originali con le bande, così dopo la sort posso risalire ai campi
    const entries: Array<{ band: _BandEntry; props: Record<string, unknown> }> = props.map(p => ({
      band: {
        lowerM: typeof p.lowerLimitM === 'number' ? p.lowerLimitM : null,
        upperM: typeof p.upperLimitM === 'number' ? p.upperLimitM : 0,
        verticalRef: typeof p.verticalRef === 'string' ? p.verticalRef : null,
        restrictionType: (typeof p.restrictionType === 'string'
          ? p.restrictionType as RestrictionType
          : 'conditional'),
      },
      props: p,
    }));
    entries.sort((a, b) =>
      (RESTRICTION_ORDER[a.band.restrictionType] ?? 99) - (RESTRICTION_ORDER[b.band.restrictionType] ?? 99));
    const main = entries[0]!;
    const info = plainZoneInfo(main.props);
    result.push({
      name,
      headline: info.headline,
      lines: info.lines,
      bands: entries.map(e => ({ lowerM: e.band.lowerM, upperM: e.band.upperM, verticalRef: e.band.verticalRef })),
      mainRestrictionType: main.band.restrictionType,
      message: typeof main.props.message === 'string' ? main.props.message : null,
      applicabilityText: typeof main.props.applicabilityText === 'string' ? main.props.applicabilityText : null,
    });
  }
  // Ordina i gruppi per restrittività del tipo principale
  result.sort((a, b) =>
    (RESTRICTION_ORDER[a.mainRestrictionType] ?? 99) - (RESTRICTION_ORDER[b.mainRestrictionType] ?? 99));
  return result;
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
