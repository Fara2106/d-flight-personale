import { ZONE_COLORS } from './mapStyle';
import type { RestrictionType } from '../data/ed269.types';

const ORDER: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};
const FALLBACK_COLOR = '#888888';

/** Popup per una o più zone sovrapposte: lista compatta dei nomi ordinati per
 *  restrittività, accordion una-zona-alla-volta; l'apertura notifica onZoneFocus(id)
 *  per l'evidenziazione sulla mappa. Solo textContent (niente HTML raw). */
export function buildPopupContent(
  items: Array<Record<string, unknown>>,
  onZoneFocus?: (id: string | null) => void,
): HTMLElement {
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
  let openId: string | null = null;
  const details = new Map<string, HTMLElement>();

  const setOpen = (id: string | null) => {
    openId = id;
    for (const [zid, el] of details) el.hidden = zid !== id;
    onZoneFocus?.(id);
  };

  for (const p of zones) {
    const id = String(p.id ?? '');
    const item = document.createElement('div');
    item.className = 'zone-popup-item';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'zone-popup-head';
    const dot = document.createElement('span');
    dot.className = 'zone-popup-dot';
    dot.style.backgroundColor =
      ZONE_COLORS[p.restrictionType as RestrictionType] ?? FALLBACK_COLOR;
    head.appendChild(dot);
    const name = document.createElement('strong');
    name.textContent = typeof p.name === 'string' ? p.name : '';
    head.appendChild(name);
    head.addEventListener('click', () => setOpen(openId === id ? null : id));
    item.appendChild(head);

    const detail = document.createElement('div');
    detail.className = 'zone-popup-detail';
    detail.hidden = true;
    const ref = p.verticalRef ? ` ${p.verticalRef}` : '';
    const lines = [
      typeof p.label === 'string' ? p.label : '—',
      `Quota max: ${p.upperLimitM != null ? `${p.upperLimitM} m${ref}` : '—'}`,
    ];
    if (typeof p.message === 'string' && p.message) lines.push(p.message);
    if (typeof p.applicabilityText === 'string' && p.applicabilityText) {
      lines.push(`Attiva: ${p.applicabilityText}`);
    }
    for (const t of lines) {
      const row = document.createElement('div');
      row.textContent = t;
      detail.appendChild(row);
    }
    details.set(id, detail);
    item.appendChild(detail);
    root.appendChild(item);
  }

  if (zones.length === 1) setOpen(String(zones[0].id ?? ''));
  return root;
}
