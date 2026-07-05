// src/rules/ruleTable.ts
import type { CClass } from '../profiles/profile.types';

export type Subcategory = 'A1' | 'A2' | 'A3';
export type CompetencyId = 'a1a3' | 'a2';

export interface SubcatRule {
  classes: CClass[];
  /** Attestato richiesto; null = nessuno (resta l'obbligo di registrazione operatore). */
  requires: CompetencyId | null;
  subcategory: Subcategory;
  notes: string[];
  reference: string;
}

/** Righe in ordine di priorità: la prima applicabile vince. */
export const RULE_TABLE: SubcatRule[] = [
  {
    classes: ['sub250', 'C0'], requires: null, subcategory: 'A1',
    notes: [
      'Registrazione operatore UAS obbligatoria (salvo giocattoli senza sensori).',
      'Vietato il sorvolo di assembramenti di persone.',
      'Evitare il sorvolo di persone non coinvolte.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.020(5)(a)-(b)',
  },
  {
    classes: ['C1'], requires: 'a1a3', subcategory: 'A1',
    notes: [
      'Nessun sorvolo previsto di persone non coinvolte; se accade, ridurlo al minimo.',
      'Vietato il sorvolo di assembramenti di persone.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.020(4)(b) e (5)(c)',
  },
  {
    classes: ['C2'], requires: 'a2', subcategory: 'A2',
    notes: [
      'Distanza orizzontale minima 30 m da persone non coinvolte (5 m con modalità a bassa velocità attiva).',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.030',
  },
  {
    classes: ['C2'], requires: 'a1a3', subcategory: 'A3',
    notes: [
      'Volo solo in aree dove non si mettono in pericolo persone non coinvolte.',
      'Almeno 150 m da aree residenziali, commerciali, industriali o ricreative.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.040',
  },
  {
    classes: ['C3', 'C4'], requires: 'a1a3', subcategory: 'A3',
    notes: [
      'Volo solo in aree dove non si mettono in pericolo persone non coinvolte.',
      'Almeno 150 m da aree residenziali, commerciali, industriali o ricreative.',
    ],
    reference: 'Reg. (UE) 2019/947, UAS.OPEN.040',
  },
  {
    classes: ['legacy250plus'], requires: 'a1a3', subcategory: 'A3',
    notes: [
      'Drone senza marcatura di classe ≥250 g: dal 1/1/2024 è ammessa solo la sottocategoria A3.',
      'Almeno 150 m da aree residenziali, commerciali, industriali o ricreative.',
    ],
    reference: 'Reg. (UE) 2019/947, art. 20; UAS.OPEN.040',
  },
];

export function findRule(cClass: CClass, valid: CompetencyId[]): SubcatRule | null {
  for (const r of RULE_TABLE) {
    if (!r.classes.includes(cClass)) continue;
    if (r.requires === null || valid.includes(r.requires)) return r;
  }
  return null;
}
