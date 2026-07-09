import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('safe area iOS (bordi in standalone: notch, barra home, margini)', () => {
  it('index.html: viewport-fit=cover (app edge-to-edge, insets misurabili)', () => {
    const meta = read('index.html').match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
    expect(meta).toContain('viewport-fit=cover');
  });

  it('index.css: variabili --safe-* dagli env(safe-area-inset-*)', () => {
    const css = read('src/index.css');
    for (const side of ['top', 'bottom', 'left', 'right']) {
      expect(css).toContain(`--safe-${side}: env(safe-area-inset-${side}, 0px)`);
    }
  });

  it('index.css: barra verifica e scheda verdetto rispettano le safe area', () => {
    const css = read('src/index.css');
    expect(css.match(/\.verify-controls[^}]+var\(--safe-top\)/)).toBeTruthy();
    expect(css.match(/\.verdict-sheet[^}]+var\(--safe-top\)/)).toBeTruthy();
    expect(css).toMatch(/var\(--safe-bottom\)/);
  });

  it('index.css: controlli MapLibre (zoom, attribution) dentro le safe area', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/maplibregl-ctrl-top-right[^}]+var\(--safe-/);
    expect(css).toMatch(/maplibregl-ctrl-bottom-right[^}]+var\(--safe-/);
  });

  it('App.tsx: la chrome (barra alta, banner, pulsanti) usa gli inset', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('var(--safe-top)');
    expect(app).toContain('var(--safe-bottom)');
    expect(app).toContain('var(--safe-left)');
    expect(app).toContain('var(--safe-right)');
  });
});
