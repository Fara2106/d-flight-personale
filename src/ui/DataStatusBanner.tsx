import type { DatasetMeta } from '../data/ed269.types';
import { isStale } from './isStale';

export function DataStatusBanner({ meta }: { meta: DatasetMeta | null }) {
  if (!meta) return null;
  const stale = isStale(meta.cycleDate, new Date());
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
