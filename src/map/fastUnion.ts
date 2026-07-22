// Union "veloce" per la vista d'insieme (mosaico piatto per categoria).
// Il file D-Flight reale ha ~8000 fasce: l'union incrementale con
// accumulatore (batch dopo batch sullo stesso risultato) costa ~190s — il
// mosaico non arrivava mai (iPhone, 2026-07-14). Qui: coordinate arrotondate
// (workaround del bug "Unable to complete output ring" di polygon-clipping),
// ordinamento spaziale Z-order (i vicini si fondono per primi, i risultati
// intermedi restano piccoli), batch alle foglie e fusione ad albero →
// ~17s sul Mac, zero fallimenti sul file reale. Pensato per girare in un
// Web Worker: tutto sincrono, niente yield del main thread.
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { union } from '@turf/union';
import { difference } from '@turf/difference';
import { featureCollection, feature as toFeature } from '@turf/helpers';
import type { Zone, RestrictionType } from '../data/ed269.types';
import { RESTRICTION_ORDER } from './mapStyle';

type Poly = Polygon | MultiPolygon;
type PolyFeature = Feature<Poly>;

const snap = (v: number) => Math.round(v * 1e6) / 1e6; // ~11 cm: invisibile, robusto

function snapRing(r: Position[]): Position[] | null {
  const out: Position[] = [];
  for (const [x, y] of r) {
    const p: Position = [snap(x), snap(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  // l'ultimo punto deve richiudere sull'iniziale (lo snap può averlo fuso)
  const first = out[0], last = out[out.length - 1];
  if (first && (first[0] !== last[0] || first[1] !== last[1])) out.push([first[0], first[1]]);
  // un anello valido ha almeno 3 vertici distinti + chiusura
  return out.length >= 4 ? out : null;
}

/** Arrotonda le coordinate a 6 decimali; anelli/poligoni degeneri scartati. */
export function snapGeometry(g: Poly): Poly | null {
  if (g.type === 'Polygon') {
    const outer = snapRing(g.coordinates[0] ?? []);
    if (!outer) return null;
    const holes = g.coordinates.slice(1).map(snapRing).filter((r): r is Position[] => !!r);
    return { type: 'Polygon', coordinates: [outer, ...holes] };
  }
  const polys: Position[][][] = [];
  for (const p of g.coordinates) {
    const outer = snapRing(p[0] ?? []);
    if (!outer) continue;
    const holes = p.slice(1).map(snapRing).filter((r): r is Position[] => !!r);
    polys.push([outer, ...holes]);
  }
  return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
}

function bboxCenter(g: Poly): [number, number] {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const scan = (r: Position[]) => {
    for (const [x, y] of r) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  };
  if (g.type === 'Polygon') scan(g.coordinates[0] ?? []);
  else for (const p of g.coordinates) scan(p[0] ?? []);
  return [(minx + maxx) / 2, (miny + maxy) / 2];
}

/** Chiave Z-order (Morton) del centro bbox, normalizzata sull'estensione data. */
function mortonKey(c: [number, number], min: [number, number], span: [number, number]): number {
  const xi = Math.min(65535, Math.max(0, Math.round(((c[0] - min[0]) / span[0]) * 65535)));
  const yi = Math.min(65535, Math.max(0, Math.round(((c[1] - min[1]) / span[1]) * 65535)));
  let m = 0;
  for (let i = 0; i < 16; i++) {
    m += ((xi >> i) & 1) * 2 ** (2 * i + 1) + ((yi >> i) & 1) * 2 ** (2 * i);
  }
  return m;
}

const LEAF = 32; // geometrie per batch foglia (un solo sweep per batch)

function pairUnion(a: PolyFeature, b: PolyFeature, onFail: () => void): PolyFeature[] {
  try {
    const u = union(featureCollection([a, b])) as PolyFeature | null;
    if (u) return [u];
  } catch { /* fallthrough */ }
  onFail();
  return [a, b]; // fallimento isolato: le due parti restano separate (copertura intatta)
}

/**
 * Fonde le geometrie in (idealmente) una sola feature. Ritorna anche il
 * conteggio dei fallimenti: ogni fallimento lascia le parti separate, mai
 * ridurre la copertura visiva.
 */
export function unionAll(geoms: Poly[]): { merged: PolyFeature[]; failures: number } {
  let failures = 0;
  const onFail = () => { failures++; };
  const snapped = geoms.map(snapGeometry).filter((g): g is Poly => !!g);
  if (snapped.length === 0) return { merged: [], failures };
  // sort spaziale: i vicini si fondono per primi
  const centers = snapped.map(bboxCenter);
  const min: [number, number] = [Math.min(...centers.map((c) => c[0])),
    Math.min(...centers.map((c) => c[1]))];
  const span: [number, number] = [
    Math.max(Math.max(...centers.map((c) => c[0])) - min[0], 1e-9),
    Math.max(Math.max(...centers.map((c) => c[1])) - min[1], 1e-9)];
  const sorted = snapped.map((g, i) => ({ g, k: mortonKey(centers[i], min, span) }))
    .sort((a, b) => a.k - b.k).map((x) => toFeature(x.g));
  // foglie: batch in una sola chiamata; se il batch è indigesto, coppie
  let level: PolyFeature[] = [];
  for (let i = 0; i < sorted.length; i += LEAF) {
    const batch = sorted.slice(i, i + LEAF);
    try {
      const u = batch.length > 1
        ? (union(featureCollection(batch)) as PolyFeature | null)
        : batch[0];
      if (u) { level.push(u); continue; }
    } catch { /* fallback a coppie */ }
    let sub = batch;
    while (sub.length > 1) {
      const next: PolyFeature[] = [];
      for (let j = 0; j < sub.length; j += 2) {
        if (j + 1 >= sub.length) { next.push(sub[j]); continue; }
        next.push(...pairUnion(sub[j], sub[j + 1], onFail));
      }
      if (next.length >= sub.length) break; // nessun progresso
      sub = next;
    }
    level.push(...sub);
  }
  // albero: fondi i risultati a coppie finché si può
  while (level.length > 1) {
    const next: PolyFeature[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 >= level.length) { next.push(level[i]); continue; }
      next.push(...pairUnion(level[i], level[i + 1], onFail));
    }
    if (next.length >= level.length) break;
    level = next;
  }
  return { merged: level, failures };
}

/**
 * Mosaico piatto per categoria (vista d'insieme, zoom bassi): union per
 * categoria + ritaglio a CASCATA (da ogni categoria si sottrae l'unione delle
 * più severe → ogni punto UN solo colore). Semantica identica a
 * zonesToCategoryUnionAsync, ma sincrona e veloce: è il cuore del worker.
 */
export function categoryMosaic(zones: Zone[]): FeatureCollection {
  const features: Feature[] = [];
  const byType = new Map<RestrictionType, Poly[]>();
  const seen = new Set<string>();
  for (const z of zones) {
    const g = z.geometry;
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue;
    // dedup geometrie identiche (doppioni D-Flight)
    const k = z.restrictionType + JSON.stringify(g.coordinates);
    if (seen.has(k)) continue;
    seen.add(k);
    const arr = byType.get(z.restrictionType);
    if (arr) arr.push(g); else byType.set(z.restrictionType, [g]);
  }
  const ordered = [...byType.entries()].sort(([a], [b]) =>
    RESTRICTION_ORDER[a] - RESTRICTION_ORDER[b]);
  // unione progressiva delle categorie più severe già emesse (per il ritaglio)
  let carved: PolyFeature[] = [];
  for (const [type, geoms] of ordered) {
    const props = { restrictionType: type, catUnion: true };
    const { merged } = unionAll(geoms);
    for (const m of merged) {
      // ritaglio a cascata: via tutto ciò che è coperto da categorie più severe
      let emit: PolyFeature | null = m;
      for (const c of carved) {
        if (!emit) break;
        try {
          emit = difference(featureCollection([emit, c])) as PolyFeature | null;
        } catch { /* ritaglio fallito: meglio un velo doppio che un buco */ }
      }
      if (emit) features.push({ type: 'Feature', geometry: emit.geometry, properties: props });
    }
    // le categorie successive vanno bucate anche dove questa è a sua volta ritagliata
    carved = carved.concat(merged);
  }
  return { type: 'FeatureCollection', features };
}

/** Insieme (interface) delle due collezioni della vista d'insieme: i veli
 *  ritagliati (un colore per punto) e i contorni cumulativi (un bordo per
 *  punto). Trasportata da worker → cache → MapView. */
export interface CategoryOverlay { fill: FeatureCollection; outline: FeatureCollection }

/**
 * Contorni della vista d'insieme come BLOB CUMULATIVI per severità: per ogni
 * soglia si disegna il perimetro dell'unione di quella categoria e di tutte le
 * più severe. Così ogni confine INTERNO tra due categorie finisce dentro un
 * blob e non viene disegnato — resta solo il perimetro esterno, colorato per
 * severità. Solo union (robuste), mai difference: erano le imprecisioni del
 * ritaglio a far sbucare i bordi uno di fianco all'altro (feedback Lorenzo
 * 2026-07-22: "le forme fanno pasticcio"). `none` non ha contorno.
 */
export function categoryOutlines(zones: Zone[]): FeatureCollection {
  const byType = new Map<RestrictionType, Poly[]>();
  const seen = new Set<string>();
  for (const z of zones) {
    const g = z.geometry;
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue;
    if (z.restrictionType === 'none') continue; // il verde non ha contorno
    const k = z.restrictionType + JSON.stringify(g.coordinates);
    if (seen.has(k)) continue; // dedup doppioni D-Flight
    seen.add(k);
    const arr = byType.get(z.restrictionType);
    if (arr) arr.push(g); else byType.set(z.restrictionType, [g]);
  }
  // dalla più severa alla meno severa: il blob cumulativo cresce a ogni soglia
  const ordered = [...byType.entries()].sort(([a], [b]) =>
    RESTRICTION_ORDER[a] - RESTRICTION_ORDER[b]);
  const features: Feature[] = [];
  let prev: Poly[] = []; // geometrie già fuse delle categorie più severe
  for (const [type, geoms] of ordered) {
    const { merged } = unionAll([...prev, ...geoms]);
    for (const m of merged) {
      features.push({ type: 'Feature', geometry: m.geometry,
        properties: { restrictionType: type, catOutline: true } });
    }
    prev = merged.map((m) => m.geometry as Poly); // riusa il lavoro alla soglia dopo
  }
  return { type: 'FeatureCollection', features };
}

/** Le due collezioni della vista d'insieme in un colpo solo (veli + contorni). */
export function categoryOverlay(zones: Zone[]): CategoryOverlay {
  return { fill: categoryMosaic(zones), outline: categoryOutlines(zones) };
}
