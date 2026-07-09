import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const read = (rel: string) => readFileSync(resolve(projectRoot, rel), 'utf8');

describe('manifest PWA', () => {
  const manifest = () => JSON.parse(read('public/manifest.webmanifest'));

  it('ha nome, lingua e display standalone', () => {
    const m = manifest();
    expect(m.name).toBe('D-Flight personale');
    expect(m.short_name).toBe('D-Flight');
    expect(m.lang).toBe('it');
    expect(m.display).toBe('standalone');
  });
  it('start_url e scope sono RELATIVI (base path GitHub Pages)', () => {
    const m = manifest();
    expect(m.start_url).toBe('.');
    expect(m.scope).toBe('.');
  });
  it('dichiara le tre icone, con la maskable marcata purpose', () => {
    const m = manifest();
    const srcs = m.icons.map((i: { src: string }) => i.src);
    expect(srcs).toEqual(['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']);
    expect(m.icons[2].purpose).toBe('maskable');
    for (const i of m.icons) expect(i.src.startsWith('/')).toBe(false); // relativi
  });
});

describe('index.html — collegamenti PWA', () => {
  const html = () => read('index.html');

  it('linka manifest e apple-touch-icon', () => {
    expect(html()).toContain('rel="manifest"');
    expect(html()).toContain('href="/manifest.webmanifest"');
    expect(html()).toContain('rel="apple-touch-icon"');
    expect(html()).toContain('href="/icons/apple-touch-icon.png"');
  });
  it('ha theme-color per tema chiaro e scuro (token dell app)', () => {
    expect(html()).toContain('content="#f5f6f8"');
    expect(html()).toContain('content="#0f141b"');
  });
  it('ha i meta apple per lo standalone', () => {
    expect(html()).toContain('apple-mobile-web-app-capable');
    expect(html()).toContain('apple-mobile-web-app-title');
  });
});
