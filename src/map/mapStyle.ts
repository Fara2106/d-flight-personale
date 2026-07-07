import type { RestrictionType } from '../data/ed269.types';

export function mapStyleUrl(theme: 'light' | 'dark'): string {
  const name = theme === 'dark' ? 'dark-matter-gl-style' : 'positron-gl-style';
  return `https://basemaps.cartocdn.com/gl/${name}/style.json`;
}

export const ZONE_COLORS: Record<RestrictionType, string> = {
  prohibited: '#ef4444', auth_required: '#f59e0b',
  conditional: '#eab308', none: '#22c55e',
};

/** 0 = più restrittivo. Unica fonte per l'ordinamento del popup e del rendering. */
export const RESTRICTION_ORDER: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};

/** Opacità del riempimento per severità: le zone innocue (spesso enormi) sono
 *  invisibili per non creare l'effetto "inglobamento" visivo su molte zone. */
export const ZONE_FILL_OPACITY: Record<RestrictionType, number> = {
  prohibited: 0.32, auth_required: 0.24, conditional: 0.18, none: 0,
};

/** Spessore del bordo per severità: i perimetri restano leggibili anche dove i
 *  riempimenti si mescolano. */
export const ZONE_LINE_WIDTH: Record<RestrictionType, number> = {
  prohibited: 2.4, auth_required: 1.8, conditional: 1.4, none: 0,
};

export const ITALY_CENTER: [number, number] = [12.5, 42.0];
export const ITALY_ZOOM = 5;
