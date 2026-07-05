import type { Polygon, MultiPolygon } from 'geojson';

export type RestrictionType = 'prohibited' | 'auth_required' | 'conditional' | 'none';

export interface Zone {
  id: string;
  name: string;
  restrictionType: RestrictionType;
  geometry: Polygon | MultiPolygon;
  lowerLimitM: number | null;
  upperLimitM: number | null;
  verticalRef: 'AGL' | 'AMSL' | 'WGS84' | null;
  message: string | null;
  reasons: string[];
  authority: { name?: string; email?: string; phone?: string } | null;
  permanent: boolean;
  /** Finestra di attività per zone non permanenti (testo compatto); null/assente = permanente.
   *  Opzionale per compatibilità con record IndexedDB salvati prima della Fase 2. */
  applicabilityText?: string | null;
}

export interface DatasetMeta {
  cycleDate: string | null;   // ISO (se ricavabile dal file)
  importedAt: string;         // ISO
  zoneCount: number;
}

export interface ZoneDiff { added: Zone[]; modified: Zone[]; removed: Zone[]; }

export interface Ed269Volume {
  horizontalProjection: any;        // Polygon o Circle (gestito nel normalizer)
  lowerLimit?: number; upperLimit?: number;
  lowerVerticalReference?: string; upperVerticalReference?: string;
  uomDimensions?: string;
}
export interface Ed269Feature {
  identifier?: string; name?: string; restriction?: string;
  reason?: string[]; message?: string;
  geometry?: Ed269Volume[];
  applicability?: any[]; zoneAuthority?: any[] | any;
}
export interface Ed269Document {
  features: Ed269Feature[];
  [k: string]: unknown;
}
