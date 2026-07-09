import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Dimensioni PNG lette dall'header IHDR (byte 16-24, big-endian):
// nessuna dipendenza, i png committati devono avere le dimensioni dichiarate.
function pngSize(filePath: string): { w: number; h: number } {
  const b = readFileSync(filePath);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// Resolve relative to test file location
const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const icon = (name: string) => resolve(projectRoot, 'public/icons', name);

describe('icone PWA', () => {
  it('icon-192.png è 192×192', () => {
    expect(pngSize(icon('icon-192.png'))).toEqual({ w: 192, h: 192 });
  });
  it('icon-512.png è 512×512', () => {
    expect(pngSize(icon('icon-512.png'))).toEqual({ w: 512, h: 512 });
  });
  it('icon-maskable-512.png è 512×512', () => {
    expect(pngSize(icon('icon-maskable-512.png'))).toEqual({ w: 512, h: 512 });
  });
  it('apple-touch-icon.png è 180×180', () => {
    expect(pngSize(icon('apple-touch-icon.png'))).toEqual({ w: 180, h: 180 });
  });
  it('il master SVG esiste e contiene il drone', () => {
    const svg = readFileSync(icon('icon.svg'), 'utf8');
    expect(svg).toContain('stroke-linecap="round"'); // bracci del drone
    expect(svg).toContain('#ff453a'); // zona rossa
  });
});
