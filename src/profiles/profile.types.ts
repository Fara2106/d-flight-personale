export type CClass = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'sub250' | 'legacy250plus';

export interface Drone {
  id: string;
  name: string;
  massGrams: number;
  cClass: CClass;
}

/** validUntil: data ISO (yyyy-mm-dd); assente = senza scadenza. */
export interface Competency { validUntil?: string }

export interface Pilot {
  competencies: { a1a3?: Competency; a2?: Competency };
  operatorId?: string; // solo visualizzazione
}

export const C_CLASS_LABELS: Record<CClass, string> = {
  C0: 'C0', C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4',
  sub250: 'Sub-250 g senza classe',
  legacy250plus: 'Legacy ≥250 g senza classe',
};
