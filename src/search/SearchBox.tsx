import { useRef, useState } from 'react';
import { geocode, type GeocodeResult } from './geocode';
export function SearchBox({ onPick }: { onPick: (r: GeocodeResult) => void }) {
  const [q, setQ] = useState(''); const [res, setRes] = useState<GeocodeResult[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
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
      if ((err as { name?: string }).name !== 'AbortError') throw err;
    }
  }
  return (
    <div className="relative">
      <input value={q} onChange={e => run(e.target.value)} placeholder="⌕ Cerca un luogo…"
        className="w-full rounded-full px-4 py-2.5 text-sm outline-none"
        style={{ background:'var(--surface)', color:'var(--text)', boxShadow:'var(--shadow)' }} />
      {res.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl"
            style={{ background:'var(--surface)', boxShadow:'var(--shadow)' }}>
          {res.map((r,i) => (
            <li key={i}><button onClick={() => { onPick(r); setRes([]); setQ(r.label); }}
              className="block w-full px-4 py-2 text-left text-sm hover:opacity-80">{r.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
