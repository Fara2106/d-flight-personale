// src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './theme/useTheme';
import { ThemeToggle } from './theme/ThemeToggle';
import { MapView } from './map/MapView';
import { SearchBox } from './search/SearchBox';
import { LocateButton } from './location/LocateButton';
import { useGeolocation } from './location/useGeolocation';
import { ImportButton } from './ui/ImportButton';
import { Legend } from './ui/Legend';
import { Disclaimer } from './ui/Disclaimer';
import { EmptyState } from './ui/EmptyState';
import { DataStatusBanner } from './ui/DataStatusBanner';
import { loadZones, loadMeta } from './data/zoneStore';
import { useProfiles } from './profiles/useProfiles';
import { ProfilePanel } from './profiles/ProfilePanel';
import { VerifyControls } from './verify/VerifyControls';
import { VerdictSheet } from './verify/VerdictSheet';
import { UpdateToast } from './pwa/UpdateToast';
import { OfflineBanner } from './ui/OfflineBanner';
import { useOnline } from './ui/useOnline';
import { zonesAtPoint } from './verify/intersect';
import { evaluate } from './rules/rulesEngine';
import type { Zone, DatasetMeta } from './data/ed269.types';

type VerifyUiState = { point: { lat: number; lon: number } | null; radiusM: number };

export default function App() {
  const { theme, resolved, setTheme } = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [flyTo, setFlyTo] = useState<{lat:number;lon:number}|null>(null);
  const [err, setErr] = useState<string | null>(null);
  const geo = useGeolocation();

  const profiles = useProfiles();
  const [verify, setVerify] = useState<VerifyUiState | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [highlightZoneId, setHighlightZoneId] = useState<string | null>(null);
  const online = useOnline();

  useEffect(() => { (async () => {
    setZones(await loadZones()); setMeta(await loadMeta());
  })(); }, []);

  // centra la mappa SOLO alla prima fix del tracking (i fix successivi muovono
  // il puntino, non la camera: l'utente resta libero di esplorare la mappa)
  const centeredOnFix = useRef(false);
  useEffect(() => {
    if (!geo.watching) { centeredOnFix.current = false; return; }
    if (geo.position && !centeredOnFix.current) {
      centeredOnFix.current = true;
      setFlyTo({ lat: geo.position.lat, lon: geo.position.lon });
    }
  }, [geo.watching, geo.position]);

  async function refresh() { setZones(await loadZones()); setMeta(await loadMeta()); setErr(null); }

  const verdict = useMemo(() => {
    if (!verify?.point || !profiles.activeDrone) return null;
    return evaluate(
      zonesAtPoint(zones, { ...verify.point, radiusM: verify.radiusM }),
      profiles.activeDrone, profiles.pilot);
  }, [verify, zones, profiles.activeDrone, profiles.pilot]);

  function closeVerify() { setVerify(null); setHighlightZoneId(null); }
  function setPoint(lat: number, lon: number) {
    setVerify(v => (v ? { ...v, point: { lat, lon } } : v));
  }

  return (
    <div style={{ position:'absolute', inset:0 }} data-build={import.meta.env.VITE_BUILD_ID ?? ''}>
      <MapView resolvedTheme={resolved} zones={zones}
        userPosition={geo.position} flyTo={flyTo}
        highlightZoneId={highlightZoneId} onZoneFocus={setHighlightZoneId}
        verify={verify} onVerifyPick={setPoint} />

      <UpdateToast />

      <div style={{ position:'absolute', top:'calc(var(--safe-top) + 12px)',
        left:'calc(var(--safe-left) + 12px)', right:'calc(var(--safe-right) + 12px)',
        display:'flex', gap:10, alignItems:'flex-start' }}>
        <div style={{ flex:1, maxWidth:480 }}><SearchBox onPick={r => setFlyTo({ lat:r.lat, lon:r.lon })} disabled={!online} /></div>
        <ThemeToggle value={theme} onChange={setTheme} />
      </div>

      <div style={{ position:'absolute', bottom:'calc(var(--safe-bottom) + 12px)',
        left:'calc(var(--safe-left) + 12px)', display:'flex', flexDirection:'column', gap:10,
        // su mobile lascia respiro alla colonna pulsanti di destra
        maxWidth:'calc(100vw - 140px)', alignItems:'flex-start' }}>
        {!online && <OfflineBanner />}
        <DataStatusBanner meta={meta} />
        <Legend />
        <Disclaimer />
      </div>

      {/* bottom: 44 per non coprire l'attribution CARTO (fix backlog Fase 1) */}
      <div style={{ position:'absolute', bottom:'calc(var(--safe-bottom) + 44px)',
        right:'calc(var(--safe-right) + 12px)', display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end' }}>
        <button onClick={() => setVerify({ point: null, radiusM: 100 })}
          disabled={zones.length === 0 || !!verify}
          title={zones.length === 0 ? 'Importa prima le zone' : 'Posso volare qui?'}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          Verifica
        </button>
        <button onClick={() => setProfileOpen(true)}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
          Profilo
        </button>
        <LocateButton active={geo.watching}
          onClick={() => { if (geo.watching) geo.stop(); else geo.start(); }} />
        <ImportButton onDone={async () => { await refresh(); }} onError={setErr} />
      </div>

      {verify && (
        <VerifyControls hasPoint={!!verify.point} radiusM={verify.radiusM}
          onRadiusChange={m => setVerify(v => (v ? { ...v, radiusM: m } : v))}
          canUsePosition={!!geo.position}
          onUsePosition={() => { if (geo.position) setPoint(geo.position.lat, geo.position.lon); }}
          onClose={closeVerify} />
      )}

      {verify?.point && (
        <VerdictSheet verdict={verdict}
          drones={profiles.drones} activeDroneId={profiles.activeDroneId}
          onSelectDrone={id => { void profiles.activate(id); }}
          onOpenProfile={() => setProfileOpen(true)}
          onClose={closeVerify} onZoneFocus={setHighlightZoneId} />
      )}

      {profileOpen && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,.35)', padding:16, zIndex: 30 }}>
          <ProfilePanel profiles={profiles} onClose={() => setProfileOpen(false)} />
        </div>
      )}

      {zones.length === 0 && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,.15)', padding:16 }}>
          <EmptyState onImported={async () => { await refresh(); }} onError={setErr} />
        </div>
      )}
      {(err ?? geo.error) && <div style={{ position:'absolute', top:'calc(var(--safe-top) + 64px)',
        left:'calc(var(--safe-left) + 12px)', right:'calc(var(--safe-right) + 12px)',
        color:'#ef4444' }}>{err ?? geo.error}</div>}
    </div>
  );
}
