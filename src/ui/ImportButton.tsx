import { useRef } from 'react';
import { importDataset } from '../data/importDataset';
import type { DatasetMeta, ZoneDiff } from '../data/ed269.types';

export function ImportButton(
  { onDone, onError }:
  { onDone: (r: { meta: DatasetMeta; diff: ZoneDiff }) => void;
    onError: (msg: string) => void }
) {
  const input = useRef<HTMLInputElement>(null);
  async function handle(file: File) {
    try { onDone(await importDataset(await file.text())); }
    catch (e) { onError(e instanceof Error ? e.message : 'Import non riuscito'); }
  }
  return (
    <div onDragOver={e => e.preventDefault()}
         onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f); }}>
      <input ref={input} type="file" accept=".json,application/json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <button onClick={() => input.current?.click()}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: 'var(--accent)' }}>
        Importa file zone (ED-269)
      </button>
    </div>
  );
}
