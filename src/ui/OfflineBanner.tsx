export function OfflineBanner() {
  return (
    <div role="status"
      className="rounded-xl px-3 py-2 text-sm"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
      📡 <b>Sei offline</b> — zone e verifica funzionano; mappa di sfondo e ricerca no
    </div>
  );
}
