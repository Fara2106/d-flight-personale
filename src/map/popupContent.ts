import { ZONE_COLORS } from './mapStyle';
import type { RestrictionType } from '../data/ed269.types';

const ORDER: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};
const FALLBACK_COLOR = '#888888';

/** Contenuto popup per una o più zone sovrapposte: dedup per id,
 *  ordinate dalla più restrittiva; solo textContent (niente HTML raw). */
export function buildPopupContent(items: Array<Record<string, unknown>>): HTMLElement {
  const seen = new Set<unknown>();
  const zones = items.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  zones.sort((a, b) =>
    (ORDER[a.restrictionType as RestrictionType] ?? 99) -
    (ORDER[b.restrictionType as RestrictionType] ?? 99));

  const root = document.createElement('div');
  root.className = 'zone-popup';
  for (const p of zones) {
    const item = document.createElement('div');
    item.className = 'zone-popup-item';

    const dot = document.createElement('span');
    dot.className = 'zone-popup-dot';
    dot.style.backgroundColor =
      ZONE_COLORS[p.restrictionType as RestrictionType] ?? FALLBACK_COLOR;
    item.appendChild(dot);

    const body = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = typeof p.name === 'string' ? p.name : '';
    body.appendChild(strong);
    body.appendChild(document.createElement('br'));
    body.appendChild(document.createTextNode(
      typeof p.label === 'string' ? p.label : '—'));
    body.appendChild(document.createElement('br'));
    const ref = p.verticalRef ? ` ${p.verticalRef}` : '';
    const ceiling = p.upperLimitM != null ? `${p.upperLimitM} m${ref}` : '—';
    body.appendChild(document.createTextNode(`Quota max: ${ceiling}`));
    item.appendChild(body);

    root.appendChild(item);
  }
  return root;
}
