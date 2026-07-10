import { ZONE_COLORS } from '../map/mapStyle';

const ROWS: [keyof typeof ZONE_COLORS, string][] = [
  ['none', 'Consentito (regole generali)'],
  ['conditional', 'Condizionato'],
  ['auth_required', 'Richiede autorizzazione'],
  ['prohibited', 'Vietato'],
];

export function Legend() {
  return (
    <details
      // su telefono la legenda aperta copre mezza mappa: parte chiusa lì,
      // aperta su desktop (valutato al mount; il toggle resta manuale)
      open={typeof window === 'undefined' || window.innerWidth > 640}
      className="rounded-2xl p-3 text-sm"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
    >
      <summary className="cursor-pointer font-semibold select-none">
        Legenda<span className="hidden sm:inline"> (colore = restrizione, etichetta = quota max)</span>
      </summary>
      <div className="mt-1">
        {ROWS.map(([k, label]) => (
          <div key={k} className="flex items-center gap-2 py-0.5">
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: ZONE_COLORS[k],
              }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
