export function Disclaimer() {
  return (
    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
      App <b>non ufficiale</b>. Verifica sempre sul portale ufficiale prima di volare:{' '}
      <a
        href="https://www.d-flight.it"
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--accent)' }}
      >
        D-Flight
      </a>
      .
    </div>
  );
}
