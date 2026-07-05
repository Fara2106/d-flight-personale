// src/rules/rulesEngine.ts
import type { Zone, RestrictionType } from '../data/ed269.types';
import type { Drone, Pilot } from '../profiles/profile.types';
import { findRule, type CompetencyId, type Subcategory } from './ruleTable';

export type Outcome = 'ok' | 'conditions' | 'auth_required' | 'forbidden' | 'verify';

export interface Verdict {
  outcome: Outcome;
  subcategory: Subcategory | null;
  maxAltitudeM: number | null;
  operationalNotes: string[];
  zones: Zone[];
  warnings: string[];
  references: string[];
}

const SEVERITY: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};
const MAX_OPEN_AGL = 120;

const COMP_LABEL: Record<CompetencyId, string> = { a1a3: 'A1/A3', a2: 'A2' };

/** Attestati validi a `now`; le scadenze passate diventano warning. */
export function validCompetencies(
  pilot: Pilot | null, now: Date
): { valid: CompetencyId[]; warnings: string[] } {
  const valid: CompetencyId[] = [];
  const warnings: string[] = [];
  const comps = pilot?.competencies ?? {};
  for (const id of ['a1a3', 'a2'] as const) {
    const c = comps[id];
    if (!c) continue;
    if (c.validUntil && new Date(`${c.validUntil}T23:59:59`) < now) {
      warnings.push(`Attestato ${COMP_LABEL[id]} scaduto il ${c.validUntil}: trattato come assente.`);
    } else {
      valid.push(id);
    }
  }
  return { valid, warnings };
}

export function evaluate(
  zones: Zone[], drone: Drone | null, pilot: Pilot | null, now: Date = new Date()
): Verdict {
  const sorted = [...zones].sort(
    (a, b) => SEVERITY[a.restrictionType] - SEVERITY[b.restrictionType]);
  const { valid, warnings } = validCompetencies(pilot, now);

  const verdict: Verdict = {
    outcome: 'verify', subcategory: null, maxAltitudeM: null,
    operationalNotes: [], zones: sorted, warnings, references: [],
  };

  if (!drone) {
    verdict.warnings.push('Nessun drone attivo: configura il profilo.');
    return verdict;
  }
  const rule = findRule(drone.cClass, valid);
  if (!rule) {
    verdict.warnings.push('Combinazione drone/attestati non prevista in categoria Open: verifica ufficialmente.');
    return verdict;
  }
  verdict.subcategory = rule.subcategory;
  verdict.operationalNotes = [...rule.notes];
  verdict.references = [rule.reference];

  // Passo 4 — zone non permanenti: mai filtrate, sempre segnalate.
  for (const z of sorted) {
    if (!z.permanent) {
      verdict.warnings.push(
        `«${z.name}»: zona non permanente${z.applicabilityText ? ` (attiva: ${z.applicabilityText})` : ''} — conta comunque nel verdetto.`);
    }
  }

  // Passo 2 — la zona più severa decide l'esito.
  const worst: RestrictionType = sorted[0]?.restrictionType ?? 'none';
  if (worst === 'prohibited') {
    verdict.outcome = 'forbidden';
    return verdict; // quota null: non si vola
  }

  // Passo 3 — quota: min(120 AGL, soffitti AGL/ignoti); AMSL e WGS84 → warning.
  let max = MAX_OPEN_AGL;
  for (const z of sorted) {
    if (z.upperLimitM == null) continue;
    if (z.verticalRef === 'AMSL' || z.verticalRef === 'WGS84') {
      verdict.warnings.push(
        `«${z.name}»: soffitto ${z.upperLimitM} m ${z.verticalRef} — non convertito, verifica l'altitudine del luogo.`);
      continue;
    }
    max = Math.min(max, z.upperLimitM);
  }
  verdict.maxAltitudeM = max;

  if (worst === 'auth_required') {
    verdict.outcome = 'auth_required';
    for (const z of sorted) {
      if (z.restrictionType !== 'auth_required' || !z.authority) continue;
      const contact = [z.authority.name, z.authority.email, z.authority.phone]
        .filter(Boolean).join(' · ');
      if (contact) verdict.operationalNotes.push(`Autorizzazione per «${z.name}»: ${contact}`);
    }
    return verdict;
  }
  if (worst === 'conditional') {
    verdict.outcome = 'conditions';
    for (const z of sorted) {
      if (z.restrictionType === 'conditional' && z.message) {
        verdict.operationalNotes.push(`«${z.name}»: ${z.message}`);
      }
    }
    return verdict;
  }
  verdict.outcome = 'ok';
  return verdict;
}
