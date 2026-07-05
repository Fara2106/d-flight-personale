import { ZONE_COLORS, RESTRICTION_ORDER } from './mapStyle';
import { plainZoneInfo } from './plainLanguage';
import type { RestrictionType } from '../data/ed269.types';

const FALLBACK_COLOR = '#888888';

/** Popup per una o più zone sovrapposte: lista compatta dei nomi ordinati per
 *  restrittività, accordion una-zona-alla-volta; l'apertura notifica onZoneFocus(id)
 *  per l'evidenziazione sulla mappa. Solo textContent (niente HTML raw).
 *  Il dettaglio parla il linguaggio dei principianti: frase concreta in evidenza,
 *  gergo ED-269 relegato in una sezione "Dettagli tecnici" collassata. */
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
    (RESTRICTION_ORDER[a.restrictionType as RestrictionType] ?? 99) -
    (RESTRICTION_ORDER[b.restrictionType as RestrictionType] ?? 99));

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

    // 1) linguaggio semplice in primo piano
    const info = plainZoneInfo(p);
    const plain = document.createElement('div');
    plain.className = 'zone-popup-plain';
    plain.textContent = info.headline;
    detail.appendChild(plain);
    for (const t of info.lines) {
      const row = document.createElement('div');
      row.textContent = t;
      detail.appendChild(row);
    }

    // 2) gergo ED-269 in secondo piano, espandibile
    const tech = document.createElement('details');
    tech.className = 'zone-popup-tech';
    const summary = document.createElement('summary');
    summary.textContent = 'Dettagli tecnici';
    tech.appendChild(summary);
    const ref = p.verticalRef ? ` ${p.verticalRef}` : '';
    const techLines = [
      `Quota max: ${p.upperLimitM != null ? `${p.upperLimitM} m${ref}` : '—'}`,
      `Tipo ED-269: ${typeof p.restrictionType === 'string' ? p.restrictionType : '—'}`,
    ];
    if (typeof p.message === 'string' && p.message) techLines.push(p.message);
    for (const t of techLines) {
      const row = document.createElement('div');
      row.textContent = t;
      tech.appendChild(row);
    }
    detail.appendChild(tech);
    details.set(id, detail);
    item.appendChild(detail);
    root.appendChild(item);
  }

  if (zones.length === 1) setOpen(String(zones[0].id ?? ''));
  return root;
}
