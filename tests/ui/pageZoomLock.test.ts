import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lockPageZoom } from '../../src/ui/lockPageZoom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('pinch-zoom della pagina bloccato (iOS)', () => {
  it('index.html: viewport con maximum-scale=1 e user-scalable=no', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const meta = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
    expect(meta).toContain('width=device-width');
    expect(meta).toContain('maximum-scale=1');
    expect(meta).toContain('user-scalable=no');
  });

  it('lockPageZoom: annulla gesturestart e gesturechange (pinch Safari)', () => {
    const target = document.createElement('div');
    lockPageZoom(target);
    for (const type of ['gesturestart', 'gesturechange']) {
      const e = new Event(type, { cancelable: true });
      target.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    }
  });

  it('lockPageZoom: non tocca altri eventi touch (la mappa gestisce i suoi)', () => {
    const target = document.createElement('div');
    lockPageZoom(target);
    const e = new Event('touchmove', { cancelable: true });
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('lockPageZoom: default su document senza errori', () => {
    expect(() => lockPageZoom()).not.toThrow();
    const e = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('main.tsx importa e attiva lockPageZoom', () => {
    const main = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');
    expect(main).toContain('lockPageZoom(');
  });

  it('lockPageZoom accetta un listener registrato una sola volta per tipo', () => {
    const target = document.createElement('div');
    const spy = vi.spyOn(target, 'addEventListener');
    lockPageZoom(target);
    const types = spy.mock.calls.map((c) => c[0]);
    expect(new Set(types).size).toBe(types.length);
  });
});
