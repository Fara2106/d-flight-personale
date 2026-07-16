// src/verify/VerdictSheet.tsx
import { useEffect, useRef, useState } from 'react';
import type { Verdict, Outcome } from '../rules/rulesEngine';
import type { Drone } from '../profiles/profile.types';
import { ZONE_COLORS } from '../map/mapStyle';
import { CloseIcon } from '../ui/icons';

const OUTCOME_UI: Record<Outcome, { icon: string; title: string; color: string }> = {
  ok: { icon: '✅', title: 'Volo consentito', color: '#22c55e' },
  conditions: { icon: '🟡', title: 'Consentito con condizioni', color: '#b8860b' },
  auth_required: { icon: '🟠', title: 'Serve autorizzazione', color: '#f59e0b' },
  forbidden: { icon: '⛔', title: 'Volo vietato', color: '#ef4444' },
  verify: { icon: '⚠️', title: 'Verifica ufficialmente', color: '#8a93a0' },
};

export function VerdictSheet(
  { verdict, drones, activeDroneId, onSelectDrone, onOpenProfile, onClose, onZoneFocus }: {
    verdict: Verdict | null;
    drones: Drone[];
    activeDroneId: string | null;
    onSelectDrone: (id: string) => void;
    onOpenProfile: () => void;
    onClose: () => void;
    onZoneFocus: (id: string | null) => void;
  }
) {
  const [openZoneId, setOpenZoneId] = useState<string | null>(null);
  const focusRef = useRef(onZoneFocus);
  focusRef.current = onZoneFocus;
  useEffect(() => () => focusRef.current(null), []);

  function toggleZone(id: string) {
    const next = openZoneId === id ? null : id;
    setOpenZoneId(next);
    onZoneFocus(next);
  }

  return (
    <div className="verdict-sheet glass-panel anim-rise p-4" role="dialog" aria-label="Verdetto"
      style={{ borderRadius: 'var(--radius-sheet)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Posso volare qui?</strong>
        <button onClick={onClose} aria-label="Chiudi verdetto" className="icon-btn">
          <CloseIcon size={16} />
        </button>
      </div>

      {drones.length > 0 && (
        <label className="text-sm" style={{ display: 'block', marginTop: 8 }}>Drone{' '}
          <select value={activeDroneId ?? ''} aria-label="Drone"
            onChange={e => onSelectDrone(e.target.value)}
            className="field text-sm">
            {drones.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}

      {!verdict ? (
        <div style={{ marginTop: 10 }}>
          <p className="text-sm">⚠️ Configura un drone e le tue qualifiche per avere il verdetto.</p>
          <button onClick={onOpenProfile}
            className="btn-accent press px-4 py-2 text-sm" style={{ marginTop: 6 }}>Apri profilo</button>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 10, fontSize: 20, fontWeight: 700,
            color: OUTCOME_UI[verdict.outcome].color }}>
            {OUTCOME_UI[verdict.outcome].icon} {OUTCOME_UI[verdict.outcome].title}
          </div>
          {verdict.subcategory && (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sottocategoria {verdict.subcategory}
            </div>
          )}
          <div className="text-sm" style={{ marginTop: 4 }}>
            Quota massima: {verdict.maxAltitudeM != null ? `${verdict.maxAltitudeM} m AGL` : '—'}
          </div>

          {verdict.operationalNotes.length > 0 && (
            <ul className="text-sm" style={{ paddingLeft: 18, marginTop: 6 }}>
              {verdict.operationalNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {verdict.warnings.length > 0 && (
            <ul className="text-sm" style={{ paddingLeft: 18, marginTop: 6, color: '#b45309' }}>
              {verdict.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
            </ul>
          )}

          {verdict.zones.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong className="text-sm">Perché — zone toccate</strong>
              {verdict.zones.map(z => (
                <div key={z.id}>
                  <button onClick={() => toggleZone(z.id)}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%',
                      padding: '5px 0', background: 'none', border: 0, color: 'inherit',
                      font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none',
                      background: ZONE_COLORS[z.restrictionType] }} />
                    {z.name}
                  </button>
                  {openZoneId === z.id && (
                    <div className="text-sm" style={{ color: 'var(--text-muted)', paddingLeft: 18 }}>
                      <div>Quota max: {z.upperLimitM != null
                        ? `${z.upperLimitM} m${z.verticalRef ? ` ${z.verticalRef}` : ''}` : '—'}</div>
                      {z.message && <div>{z.message}</div>}
                      {z.applicabilityText && <div>Attiva: {z.applicabilityText}</div>}
                      {z.authority?.name && <div>Autorità: {z.authority.name}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {verdict.references.length > 0 && (
            <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {verdict.references.join(' · ')}
            </div>
          )}
        </>
      )}

      <a href="https://www.d-flight.it" target="_blank" rel="noreferrer"
        className="text-sm" style={{ color: 'var(--accent)', display: 'inline-block', marginTop: 8 }}>
        Verifica su D-Flight →
      </a>
    </div>
  );
}
