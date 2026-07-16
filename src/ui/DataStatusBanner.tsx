import type { DatasetMeta } from '../data/ed269.types';
import { isStale } from './isStale';

export function DataStatusBanner({ meta }: { meta: DatasetMeta | null }) {
  if (!meta) return null;
  // il file D-Flight reale non ha una data interna (cycleDate): in quel caso
  // la staleness si misura dalla data di import (mai avvisare il giorno stesso)
  const stale = isStale(meta.cycleDate ?? meta.importedAt, new Date());
  const when = meta.cycleDate ?? new Date(meta.importedAt).toLocaleDateString('it-IT');
  return (
    <div className="glass-panel banner">
      <span className="banner-dot" aria-hidden="true"
        style={{ background: stale ? '#f59e0b' : '#22c55e' }} />
      <span>
        Dati aggiornati al <b>{when}</b>{' '}
        {stale && (
          <span style={{ color: '#f59e0b' }}>
            · ⚠️ potrebbero non essere aggiornati, reimporta il file
          </span>
        )}
      </span>
    </div>
  );
}
