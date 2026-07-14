import type { DatasetMeta } from '../data/ed269.types';
import { isStale } from './isStale';

export function DataStatusBanner({ meta }: { meta: DatasetMeta | null }) {
  if (!meta) return null;
  // il file D-Flight reale non ha una data interna (cycleDate): in quel caso
  // la staleness si misura dalla data di import (mai avvisare il giorno stesso)
  const stale = isStale(meta.cycleDate ?? meta.importedAt, new Date());
  const when = meta.cycleDate ?? new Date(meta.importedAt).toLocaleDateString('it-IT');
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
    >
      Dati aggiornati al <b>{when}</b>{' '}
      {stale && (
        <span style={{ color: '#f59e0b' }}>
          · ⚠️ potrebbero non essere aggiornati, reimporta il file
        </span>
      )}
    </div>
  );
}
