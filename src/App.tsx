import { useEffect, useState } from 'react';
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
import type { Zone, DatasetMeta } from './data/ed269.types';

export default function App() {
  const { theme, resolved, setTheme } = useTheme();
  const [zones, setZones] = useState<Zone[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [flyTo, setFlyTo] = useState<{lat:number;lon:number}|null>(null);
  const [err, setErr] = useState<string | null>(null);
  const geo = useGeolocation();

  useEffect(() => { (async () => {
    setZones(await loadZones()); setMeta(await loadMeta());
  })(); }, []);

  useEffect(() => {
    if (geo.position) setFlyTo({ lat: geo.position.lat, lon: geo.position.lon });
  }, [geo.position]);

  async function refresh() { setZones(await loadZones()); setMeta(await loadMeta()); }

  return (
    <div style={{ position:'absolute', inset:0 }}>
      <MapView resolvedTheme={resolved} zones={zones}
        userPosition={geo.position} flyTo={flyTo} />

      <div style={{ position:'absolute', top:12, left:12, right:12, display:'flex', gap:10, alignItems:'flex-start' }}>
        <div style={{ flex:1, maxWidth:480 }}><SearchBox onPick={r => setFlyTo({ lat:r.lat, lon:r.lon })} /></div>
        <ThemeToggle value={theme} onChange={setTheme} />
      </div>

      <div style={{ position:'absolute', bottom:12, left:12, display:'flex', flexDirection:'column', gap:10 }}>
        <DataStatusBanner meta={meta} />
        <Legend />
        <Disclaimer />
      </div>

      <div style={{ position:'absolute', bottom:12, right:12, display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end' }}>
        <LocateButton onClick={geo.request} />
        <ImportButton onDone={async () => { await refresh(); }} onError={setErr} />
      </div>

      {zones.length === 0 && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,.15)', padding:16 }}>
          <EmptyState onImported={async () => { await refresh(); }} onError={setErr} />
        </div>
      )}
      {err && <div style={{ position:'absolute', top:64, left:12, right:12, color:'#ef4444' }}>{err}</div>}
    </div>
  );
}
