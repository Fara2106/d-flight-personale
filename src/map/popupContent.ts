import { ZONE_COLORS } from './mapStyle';
import { plainGroupedZoneInfo } from './plainLanguage';

const FALLBACK_COLOR = '#888888';

/** Popup per una o più zone sovrapposte: nomi raggruppati (le bande di quota
 *  di una stessa zona ED-269 finiscono in una sola voce), ordinati per
 *  restrittività, accordion una-zona-alla-volta. L'apertura notifica
 *  onZoneFocus(bandId) per l'evidenziazione sulla mappa: usa l'id della banda
 *  più restrittiva (NON il nome), così la mappa illumina solo quella porzione
 *  e non tutti i gradoni di quota della zona. Solo textContent (niente HTML raw). */
export function buildPopupContent(
  items: Array<Record<string, unknown>>,
  onZoneFocus?: (id: string | null) => void,
): HTMLElement {
  const grouped = plainGroupedZoneInfo(items);

  const root = document.createElement('div');
  root.className = 'zone-popup';
  let openIdx: number | null = null;

  for (let i = 0; i < grouped.length; i++) {
    const gi = grouped[i]!;
    const item = document.createElement('div');
    item.className = 'zone-popup-item';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'zone-popup-head';
    const dot = document.createElement('span');
    dot.className = 'zone-popup-dot';
    dot.style.backgroundColor = ZONE_COLORS[gi.mainRestrictionType] ?? FALLBACK_COLOR;
    head.appendChild(dot);
    const nameEl = document.createElement('strong');
    nameEl.textContent = gi.name;
    head.appendChild(nameEl);

    head.addEventListener('click', () => {
      openIdx = openIdx === i ? null : i;
      onZoneFocus?.(openIdx === null ? null : gi.bandId);
      syncHidden();
    });
    item.appendChild(head);

    const detail = document.createElement('div');
    detail.className = 'zone-popup-detail';
    detail.hidden = true;

    // 1) linguaggio semplice in primo piano
    const plain = document.createElement('div');
    plain.className = 'zone-popup-plain';
    plain.textContent = gi.headline;
    detail.appendChild(plain);
    for (const t of gi.lines) {
      const row = document.createElement('div');
      row.textContent = t;
      detail.appendChild(row);
    }

    // 2) fasce di quota + gergo ED-269 in secondo piano
    const tech = document.createElement('details');
    tech.className = 'zone-popup-tech';
    const summary = document.createElement('summary');
    summary.textContent = 'Dettagli tecnici';
    tech.appendChild(summary);

    for (const band of gi.bands) {
      const ref = band.verticalRef ? ` ${band.verticalRef}` : '';
      const floor = band.lowerM != null ? `${band.lowerM}–` : '';
      const row = document.createElement('div');
      row.textContent = `Fascia: ${floor}${band.upperM} m${ref}`;
      tech.appendChild(row);
    }

    const vref = typeof gi.bands[0]!.verticalRef === 'string' ? gi.bands[0]!.verticalRef : null;
    const techLines = [
      `Tipo ED-269: ${gi.mainRestrictionType}`,
      `Quota max: ${gi.bands[0]!.upperM} m${vref ? ' ' + vref : ''}`,
    ];
    if (typeof gi.message === 'string' && gi.message) techLines.push(gi.message);
    if (typeof gi.applicabilityText === 'string' && gi.applicabilityText) {
      techLines.push(`Attiva: ${gi.applicabilityText}`);
    }
    for (const t of techLines) {
      const row = document.createElement('div');
      row.textContent = t;
      tech.appendChild(row);
    }
    detail.appendChild(tech);
    item.appendChild(detail);
    root.appendChild(item);
  }

  if (grouped.length === 1) {
    openIdx = 0;
    onZoneFocus?.(grouped[0]!.bandId);
  }

  const syncHidden = () => {
    const details = root.querySelectorAll('.zone-popup-detail') as NodeListOf<HTMLElement>;
    details.forEach((d, i) => { d.hidden = openIdx !== i; });
  };

  syncHidden();
  return root;
}
