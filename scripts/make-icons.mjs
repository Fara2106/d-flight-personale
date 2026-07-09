// scripts/make-icons.mjs — genera i png dell'icona PWA dal master SVG.
// One-off: i png sono committati; rilanciare solo se cambia il design.
// Prerequisito: npm i --no-save sharp
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public/icons/icon.svg');
const out = (name) => join(root, 'public/icons', name);

// density alta: sharp rasterizza l'SVG prima del resize; a 72dpi il 512 sgrana
const svg = () => sharp(src, { density: 300 });

await svg().resize(192, 192).png().toFile(out('icon-192.png'));
await svg().resize(512, 512).png().toFile(out('icon-512.png'));
// il design B è full-bleed con soggetto nel cerchio sicuro: maskable = stesso render
await svg().resize(512, 512).png().toFile(out('icon-maskable-512.png'));
await svg().resize(180, 180).png().toFile(out('apple-touch-icon.png'));
console.log('icone generate in public/icons/');
