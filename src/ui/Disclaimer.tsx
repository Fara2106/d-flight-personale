export function Disclaimer() {
  return (
    <div className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5,
      maxWidth: 420 }}>
      App <b>non ufficiale</b>. Verifica sempre sul portale ufficiale prima di volare:{' '}
      <a href="https://www.d-flight.it" target="_blank" rel="noopener noreferrer"
        style={{ color: 'var(--accent)', fontWeight: 500 }}>
        D-Flight
      </a>
      .
    </div>
  );
}
