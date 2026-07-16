// Icone SVG inline del chrome (stile SF Symbols): monocromatiche su
// currentColor, decorative (aria-hidden) — il nome accessibile sta sempre
// sull'elemento interattivo che le contiene.
import type { ReactNode } from 'react';

type IconProps = { size?: number };

function Svg({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" /></Svg>;
}
export function SunIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" />
    </Svg>
  );
}
export function MoonIcon(p: IconProps) {
  return <Svg {...p}><path d="M20.6 14.1A8.6 8.6 0 1 1 9.9 3.4a7 7 0 0 0 10.7 10.7Z" /></Svg>;
}
export function SystemIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <path d="M9 20.5h6M12 17v3.5" />
    </Svg>
  );
}
export function LocateIcon(p: IconProps) {
  return <Svg {...p}><path d="M20.5 3.5 11 20.6l-1.6-7L2.4 12Z" /></Svg>;
}
export function CloseIcon(p: IconProps) {
  return <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
}
export function ChevronIcon(p: IconProps) {
  return <Svg {...p}><path d="m9 5.5 6.5 6.5L9 18.5" /></Svg>;
}
export function TargetIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="1.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </Svg>
  );
}
