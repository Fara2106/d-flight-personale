import type { Zone } from '../data/ed269.types';

export function altitudeLabel(z: Zone): string {
  if (z.restrictionType === 'prohibited') return '⛔ 0 m';
  if (z.upperLimitM == null) return '—';
  return `${z.upperLimitM} m`;
}
