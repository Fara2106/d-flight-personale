// tests/ui/icons.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  SearchIcon, SunIcon, MoonIcon, SystemIcon,
  LocateIcon, CloseIcon, ChevronIcon, TargetIcon,
} from '../../src/ui/icons';

const ICONS = [
  ['SearchIcon', SearchIcon], ['SunIcon', SunIcon], ['MoonIcon', MoonIcon],
  ['SystemIcon', SystemIcon], ['LocateIcon', LocateIcon],
  ['CloseIcon', CloseIcon], ['ChevronIcon', ChevronIcon], ['TargetIcon', TargetIcon],
] as const;

describe('icone SVG del chrome', () => {
  it.each(ICONS)('%s è un svg decorativo su currentColor', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(svg!.getAttribute('stroke')).toBe('currentColor');
  });
  it('accetta la dimensione', () => {
    const { container } = render(<SearchIcon size={20} />);
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('20');
  });
});
