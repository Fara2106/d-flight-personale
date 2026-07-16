export function OfflineBanner() {
  return (
    <div role="status" className="glass-panel banner anim-pop">
      <span className="banner-dot" style={{ background: '#f59e0b' }} aria-hidden="true" />
      <span><b>Sei offline</b> — zone e verifica funzionano; ricerca non disponibile</span>
    </div>
  );
}
