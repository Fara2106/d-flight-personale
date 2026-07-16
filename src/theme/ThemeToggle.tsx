import type { ReactNode } from 'react';
import { type ThemePref } from './useTheme';
import { SunIcon, MoonIcon, SystemIcon } from '../ui/icons';

const OPTS: { key: ThemePref; icon: ReactNode; text: string }[] = [
  { key: 'light', icon: <SunIcon size={15} />, text: 'Chiaro' },
  { key: 'dark', icon: <MoonIcon size={15} />, text: 'Scuro' },
  { key: 'system', icon: <SystemIcon size={15} />, text: 'Sistema' },
];

export function ThemeToggle({ value, onChange }:
  { value: ThemePref; onChange: (p: ThemePref) => void }) {
  const idx = Math.max(0, OPTS.findIndex(o => o.key === value));
  return (
    <div role="group" aria-label="Tema" className="seg glass">
      {/* pillola attiva: scivola sotto i bottoni (transform per indice) */}
      <span className="seg-pill" aria-hidden="true"
        style={{ transform: `translateX(${idx * 100}%)` }} />
      {OPTS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          aria-label={o.text}
          className="seg-btn text-sm whitespace-nowrap"
          style={{ color: value === o.key ? '#fff' : 'var(--text-muted)' }}>
          {/* su mobile il testo ruba spazio alla ricerca: resta solo l'icona,
              il nome accessibile vive nell'aria-label */}
          {o.icon} <span className="hidden sm:inline">{o.text}</span>
        </button>
      ))}
    </div>
  );
}
