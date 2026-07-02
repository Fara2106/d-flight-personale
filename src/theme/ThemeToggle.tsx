import { type ThemePref } from './useTheme';

const OPTS: { key: ThemePref; label: string }[] = [
  { key: 'light', label: '☀️ Chiaro' },
  { key: 'dark', label: '🌙 Scuro' },
  { key: 'system', label: '🖥️ Sistema' },
];

export function ThemeToggle({ value, onChange }:
  { value: ThemePref; onChange: (p: ThemePref) => void }) {
  return (
    <div role="group" aria-label="Tema" className="inline-flex gap-1 rounded-xl p-1"
         style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
      {OPTS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className="rounded-lg px-3 py-1.5 text-sm whitespace-nowrap"
          style={value === o.key
            ? { color: '#fff', background: 'var(--accent)' }
            : { color: 'var(--text-muted)' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
