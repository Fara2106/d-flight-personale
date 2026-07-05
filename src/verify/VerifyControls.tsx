// src/verify/VerifyControls.tsx
export function VerifyControls(
  { hasPoint, radiusM, onRadiusChange, canUsePosition, onUsePosition, onClose }: {
    hasPoint: boolean; radiusM: number; onRadiusChange: (m: number) => void;
    canUsePosition: boolean; onUsePosition: () => void; onClose: () => void;
  }
) {
  return (
    <div className="verify-controls rounded-2xl p-3"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)',
        display: 'flex', gap: 10, alignItems: 'center' }}>
      {!hasPoint ? (
        <>
          <span className="text-sm">🎯 Tocca un punto sulla mappa</span>
          {canUsePosition && (
            <button onClick={onUsePosition}
              className="rounded-xl px-3 py-1 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}>Usa la mia posizione</button>
          )}
        </>
      ) : (
        <label className="text-sm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          Raggio
          <input type="range" min={0} max={500} step={10} value={radiusM}
            onChange={e => onRadiusChange(Number(e.target.value))} />
          <span style={{ minWidth: 48, textAlign: 'right' }}>{radiusM} m</span>
        </label>
      )}
      <button onClick={onClose} aria-label="Esci dalla verifica"
        style={{ color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
    </div>
  );
}
