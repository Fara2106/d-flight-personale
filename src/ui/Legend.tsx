import { ZONE_COLORS } from '../map/mapStyle';
import { legendAltitudeText, type CatAltitude } from '../data/categoryAltitudes';
import type { RestrictionType } from '../data/ed269.types';

const ROWS: [RestrictionType, string][] = [
  ['none', 'Consentito (regole generali)'],
  ['conditional', 'Condizionato'],
  ['auth_required', 'Richiede autorizzazione'],
  ['prohibited', 'Vietato'],
];

/** Chip colore; per "richiede autorizzazione" replica il tratteggio della mappa. */
function Chip({ type }: { type: RestrictionType }) {
  const hatch = type === 'auth_required';
  return (
    <span
      data-chip={type}
      style={{
        width: 14, height: 14, borderRadius: 4, flex: 'none', marginTop: 3,
        background: hatch ? `${ZONE_COLORS[type]}55` : ZONE_COLORS[type],
        backgroundImage: hatch
          ? `repeating-linear-gradient(45deg, ${ZONE_COLORS[type]} 0 2px, transparent 2px 6px)`
          : undefined,
        border: `1px solid ${ZONE_COLORS[type]}`,
      }}
    />
  );
}

export function Legend({ altitudes }: {
  /** Quote tipiche per categoria dai dati importati (categoryAltitudes). */
  altitudes?: Record<RestrictionType, CatAltitude> | null;
}) {
  return (
    <details
      // su telefono la legenda aperta copre mezza mappa: parte chiusa lì,
      // aperta su desktop (valutato al mount; il toggle resta manuale)
      open={typeof window === 'undefined' || window.innerWidth > 640}
      className="rounded-2xl p-3 text-sm"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
    >
      <summary className="cursor-pointer font-semibold select-none">
        Legenda<span className="hidden sm:inline"> (quota indicata sulla zona solo dove diversa)</span>
      </summary>
      <div className="mt-1">
        {ROWS.map(([k, label]) => {
          const quota = altitudes ? legendAltitudeText(k, altitudes[k]) : null;
          return (
            <div key={k} className="flex items-start gap-2 py-0.5">
              <Chip type={k} />
              <span>
                {label}
                {quota && (
                  <span style={{ color: 'var(--text-muted)' }}> — {quota}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
