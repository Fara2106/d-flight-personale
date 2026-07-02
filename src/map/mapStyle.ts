import type { RestrictionType } from '../data/ed269.types';

export function mapStyleUrl(theme: 'light' | 'dark'): string {
  const name = theme === 'dark' ? 'dark-matter-gl-style' : 'positron-gl-style';
  return `https://basemaps.cartocdn.com/gl/${name}/style.json`;
}

export const ZONE_COLORS: Record<RestrictionType, string> = {
  prohibited: '#ef4444', auth_required: '#f59e0b',
  conditional: '#eab308', none: '#22c55e',
};

export const ITALY_CENTER: [number, number] = [12.5, 42.0];
export const ITALY_ZOOM = 5;
