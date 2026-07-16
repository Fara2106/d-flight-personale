// src/verify/VerifyControls.tsx
import { CloseIcon, TargetIcon } from '../ui/icons';

const RADIUS_MIN = 0;
const RADIUS_MAX = 500;
const BTN_STEP = 20; // multiplo dello step dello slider: niente arrotondamenti

export function VerifyControls(
  { hasPoint, radiusM, onRadiusChange, canUsePosition, onUsePosition, onClose }: {
    hasPoint: boolean; radiusM: number; onRadiusChange: (m: number) => void;
    canUsePosition: boolean; onUsePosition: () => void; onClose: () => void;
  }
) {
  const clamp = (m: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, m));
  return (
    <div className="verify-controls glass-panel p-3"
      style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {!hasPoint ? (
        <>
          <span className="text-sm" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)', display: 'flex' }}><TargetIcon size={16} /></span>
            Tocca un punto sulla mappa
          </span>
          {canUsePosition && (
            <button onClick={onUsePosition}
              className="btn-accent press px-3 py-1 text-sm">Usa la mia posizione</button>
          )}
        </>
      ) : (
        <div className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <span>Raggio</span>
          {/* − / + funzionano sempre, anche dove il drag touch fa i capricci */}
          <button type="button" onClick={() => onRadiusChange(clamp(radiusM - BTN_STEP))}
            aria-label="Riduci il raggio" className="radius-step press">−</button>
          <input type="range" min={RADIUS_MIN} max={RADIUS_MAX} step={10} value={radiusM}
            aria-label="Raggio di verifica"
            className="radius-slider"
            onChange={e => onRadiusChange(Number(e.target.value))} />
          <button type="button" onClick={() => onRadiusChange(clamp(radiusM + BTN_STEP))}
            aria-label="Aumenta il raggio" className="radius-step press">+</button>
          <span style={{ minWidth: 48, textAlign: 'right' }}>{radiusM} m</span>
        </div>
      )}
      <button onClick={onClose} aria-label="Esci dalla verifica" className="icon-btn">
        <CloseIcon size={15} />
      </button>
    </div>
  );
}
