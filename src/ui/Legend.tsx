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

/** Categorie che l'utente può nascondere dalla mappa. Il vietato NON è
 *  disattivabile (app conservativa); none non disegna nulla comunque. */
const TOGGLABLE: RestrictionType[] = ['conditional', 'auth_required'];

export function Legend({ altitudes, hiddenTypes, onToggleType }: {
  /** Quote tipiche per categoria dai dati importati (categoryAltitudes). */
  altitudes?: Record<RestrictionType, CatAltitude> | null;
  /** Categorie momentaneamente nascoste sulla mappa. */
  hiddenTypes?: RestrictionType[];
  /** Se presente, le righe disattivabili mostrano una checkbox. */
  onToggleType?: (t: RestrictionType) => void;
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
          const togglable = onToggleType && TOGGLABLE.includes(k);
          return (
            <div key={k} className="flex items-start gap-2 py-0.5">
              {/* checkbox a SINISTRA: il bordo destro della legenda può finire
                  sotto i bottoni Verifica/Importa sugli schermi stretti */}
              {togglable && (
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={!(hiddenTypes ?? []).includes(k)}
                  onChange={() => onToggleType(k)}
                  style={{ marginTop: 3, width: 16, height: 16, flex: 'none',
                    accentColor: 'var(--accent)' }}
                />
              )}
              <Chip type={k} />
              <span className="flex-1">
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
