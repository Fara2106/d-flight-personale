import { useEffect, useRef, useState } from 'react';
import { geocode, type GeocodeResult } from './geocode';
import { SearchIcon } from '../ui/icons';
export function SearchBox({ onPick, disabled = false }:
  { onPick: (r: GeocodeResult) => void; disabled?: boolean }) {
  const [q, setQ] = useState(''); const [res, setRes] = useState<GeocodeResult[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  // si va offline col dropdown aperto: chiudi la lista e ferma la richiesta in volo
  useEffect(() => {
    if (disabled) { controllerRef.current?.abort(); controllerRef.current = null; setRes([]); }
  }, [disabled]);
  async function run(v: string) {
    setQ(v);
    controllerRef.current?.abort();
    if (v.trim().length <= 2) { controllerRef.current = null; setRes([]); return; }
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const r = await geocode(v, controller.signal);
      if (!controller.signal.aborted) setRes(r);
    } catch (err) {
      // rete giù con navigator.onLine ancora true: nessun risultato, niente crash
      if ((err as { name?: string }).name !== 'AbortError' && !controller.signal.aborted) setRes([]);
    }
  }
  return (
    <div className="relative">
      <span className="search-icon"><SearchIcon size={16} /></span>
      <input value={q} onChange={e => run(e.target.value)} placeholder="Cerca un luogo…"
        disabled={disabled}
        title={disabled ? 'Ricerca non disponibile offline' : undefined}
        className="glass search-input disabled:opacity-50" />
      {res.length > 0 && (
        <ul className="glass-panel search-results anim-pop absolute z-10 mt-2 w-full overflow-hidden">
          {res.map((r,i) => (
            <li key={i}><button className="search-row"
              onClick={() => { onPick(r); setRes([]); setQ(r.label); }}>{r.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
