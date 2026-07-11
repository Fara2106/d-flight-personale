import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ThemeToggle } from '../../src/theme/ThemeToggle';
import { Legend } from '../../src/ui/Legend';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('chrome su schermi stretti (collaudo iPhone 2026-07-10)', () => {
  it('ThemeToggle: il testo è nascosto su mobile ma il nome accessibile resta', () => {
    render(<ThemeToggle value="light" onChange={() => {}} />);
    for (const name of ['Chiaro', 'Scuro', 'Sistema']) {
      const btn = screen.getByRole('button', { name: new RegExp(name, 'i') });
      // il testo visibile è in uno span nascosto sotto il breakpoint sm
      const label = btn.querySelector('span.hidden');
      expect(label?.className).toContain('sm:inline');
      expect(label?.textContent).toBe(name);
    }
  });

  it('Legend: è un <details> richiudibile, aperto di default su desktop', () => {
    render(<Legend />);
    const details = screen.getByText(/^legenda/i).closest('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(true); // jsdom: innerWidth 1024 = desktop
    expect(screen.getByText('Vietato')).toBeInTheDocument();
    // su mobile resta solo "Legenda": la spiegazione è nascosta sotto sm
    const extra = details?.querySelector('summary span.hidden');
    expect(extra?.className).toContain('sm:inline');
    expect(extra?.textContent).toContain('quota indicata');
  });

  it('Legend: parte chiusa su schermi stretti', () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    render(<Legend />);
    const details = screen.getAllByText(/^legenda/i).at(-1)?.closest('details');
    expect(details?.open).toBe(false);
    Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
  });

  it('index.css: zoom +/− MapLibre nascosto su mobile (lo fa il pinch)', () => {
    const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*maplibregl-ctrl-top-right[^}]*display: none/);
  });
});
