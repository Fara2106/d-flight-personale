import { type ThemePref } from './useTheme';

const OPTS: { key: ThemePref; icon: string; text: string }[] = [
  { key: 'light', icon: '☀️', text: 'Chiaro' },
  { key: 'dark', icon: '🌙', text: 'Scuro' },
  { key: 'system', icon: '🖥️', text: 'Sistema' },
];

export function ThemeToggle({ value, onChange }:
  { value: ThemePref; onChange: (p: ThemePref) => void }) {
  return (
    <div role="group" aria-label="Tema" className="inline-flex gap-1 rounded-xl p-1"
         style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
      {OPTS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          aria-label={o.text}
          className="rounded-lg px-3 py-1.5 text-sm whitespace-nowrap"
          style={value === o.key
            ? { color: '#fff', background: 'var(--accent)' }
            : { color: 'var(--text-muted)' }}>
          {/* su mobile il testo ruba spazio alla ricerca: resta solo l'icona,
              il nome accessibile vive nell'aria-label */}
          {o.icon} <span className="hidden sm:inline">{o.text}</span>
        </button>
      ))}
    </div>
  );
}
