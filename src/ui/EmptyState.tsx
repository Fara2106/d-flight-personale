import { ImportButton } from './ImportButton';
import type { DatasetMeta, ZoneDiff } from '../data/ed269.types';

export function EmptyState(
  {
    onImported,
    onError,
  }: {
    onImported: (r: { meta: DatasetMeta; diff: ZoneDiff }) => void;
    onError: (m: string) => void;
  }
) {
  return (
    <div
      className="mx-auto max-w-md rounded-2xl p-6 text-center"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
    >
      <h2 className="mb-2 text-lg font-bold">Importa le zone ufficiali</h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Scarica il file delle zone geografiche UAS (formato ED-269, JSON) dal tuo account
        su d-flight.it e importalo qui. Resterà disponibile anche offline.
      </p>
      <ImportButton onDone={onImported} onError={onError} />
    </div>
  );
}
