import { ZONE_COLORS } from '../map/mapStyle';

const ROWS: [keyof typeof ZONE_COLORS, string][] = [
  ['none', 'Consentito (regole generali)'],
  ['conditional', 'Condizionato'],
  ['auth_required', 'Richiede autorizzazione'],
  ['prohibited', 'Vietato'],
];

export function Legend() {
  return (
    <div
      className="rounded-2xl p-3 text-sm"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
    >
      <div className="mb-1 font-semibold">
        Legenda (colore = restrizione, etichetta = quota max)
      </div>
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
  );
}
