// Genera e2e/fixture-fiumicino.json: scenario DENSO stile Fiumicino/Roma ovest
// (vedi screenshot iPhone 2026-07-10) — decine di zone "richiede autorizzazione"
// sovrapposte a 120 m, corridoi, cerchi CTR, più vietate e condizionate.
// Uso: node e2e/gen-fixture-fiumicino.mjs   (riscrive il json, committato)
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CX = 12.24, CY = 41.77; // Fiumicino
const feats = [];
let n = 0;

function poly(coords, { name, restriction = 'U-SPACE', upper = 120, lower = 0, message }) {
  n += 1;
  feats.push({
    identifier: `FCO${String(n).padStart(3, '0')}`,
    name,
    restriction,
    ...(message ? { message } : {}),
    geometry: [{
      horizontalProjection: { type: 'Polygon', coordinates: [coords] },
      lowerLimit: lower, upperLimit: upper,
      upperVerticalReference: 'AGL', uomDimensions: 'M',
    }],
  });
}

const circle = (cx, cy, rKm, seg = 24) => {
  const r = rKm / 111;
  const ring = [];
  for (let i = 0; i <= seg; i++) {
    const a = (2 * Math.PI * i) / seg;
    ring.push([+(cx + (r * Math.cos(a)) / Math.cos((cy * Math.PI) / 180)).toFixed(5),
      +(cy + r * Math.sin(a)).toFixed(5)]);
  }
  return ring;
};

const rect = (cx, cy, wKm, hKm, rotDeg = 0) => {
  const w = wKm / 111 / 2, h = hKm / 111 / 2;
  const rot = (rotDeg * Math.PI) / 180;
  const pts = [[-w, -h], [w, -h], [w, h], [-w, h], [-w, -h]].map(([x, y]) => {
    const xr = x * Math.cos(rot) - y * Math.sin(rot);
    const yr = x * Math.sin(rot) + y * Math.cos(rot);
    return [+(cx + xr / Math.cos((cy * Math.PI) / 180)).toFixed(5), +(cy + yr).toFixed(5)];
  });
  return pts;
};

// mulberry32: layout pseudo-casuale ma DETERMINISTICO (stessa fixture a ogni run)
let seed = 20260710;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// — CTR: cerchi concentrici (fasce stessa zona: stesso nome, quote diverse)
poly(circle(CX, CY, 12), { name: 'LIRF CTR FIUMICINO', restriction: 'REQ_AUTHORISATION', upper: 120 });
poly(circle(CX, CY, 7), { name: 'LIRF CTR FIUMICINO', restriction: 'REQ_AUTHORISATION', upper: 60 });
// — corridoi allungati stile ATZ
poly(rect(CX + 0.02, CY + 0.01, 22, 5, 32), { name: 'LIRF ATZ RWY 16L/34R', restriction: 'REQ_AUTHORISATION' });
poly(rect(CX - 0.03, CY - 0.02, 22, 5, 32), { name: 'LIRF ATZ RWY 16R/34L', restriction: 'REQ_AUTHORISATION' });
// — la grande vietata a est (come nello screenshot) + due piccole
poly(rect(CX + 0.16, CY + 0.03, 9, 16, 4), { name: 'LI P_ROMA EST', restriction: 'PROHIBITED', upper: 0, message: 'Divieto assoluto.' });
poly(rect(CX + 0.005, CY - 0.015, 1.2, 1.8, 10), { name: 'LI P_DEPOSITO', restriction: 'PROHIBITED', upper: 0 });
poly(circle(CX - 0.09, CY + 0.10, 1), { name: 'LI P_IMPIANTO', restriction: 'PROHIBITED', upper: 0 });
// — tappeto di zone autorizzazione sovrapposte (il "caso Fiumicino")
for (let i = 0; i < 24; i++) {
  const cx = CX + (rnd() - 0.5) * 0.36;
  const cy = CY + (rnd() - 0.5) * 0.30;
  const kind = rnd();
  const coords = kind < 0.4
    ? circle(cx, cy, 1 + rnd() * 4, 20)
    : rect(cx, cy, 2 + rnd() * 9, 2 + rnd() * 7, rnd() * 90);
  poly(coords, { name: `LI R_${100 + i} ROMA OVEST`, restriction: 'REQ_AUTHORISATION', upper: 120 });
}
// — qualche condizionata e libera
for (let i = 0; i < 5; i++) {
  const cx = CX + (rnd() - 0.5) * 0.4, cy = CY + (rnd() - 0.5) * 0.34;
  poly(rect(cx, cy, 3 + rnd() * 5, 3 + rnd() * 4, rnd() * 60),
    { name: `LI C_${200 + i}`, restriction: 'CONDITIONAL', upper: 60, message: 'Condizioni locali.' });
}
poly(rect(CX - 0.20, CY - 0.12, 8, 6, 15), { name: 'LI G_LITORALE', restriction: 'NO_RESTRICTION', upper: 120 });
poly(circle(CX + 0.05, CY - 0.14, 3), { name: 'LI G_CAMPAGNA', restriction: 'NO_RESTRICTION', upper: 120 });

const out = join(dirname(fileURLToPath(import.meta.url)), 'fixture-fiumicino.json');
writeFileSync(out, JSON.stringify({ features: feats }, null, 1));
console.log(`scritte ${feats.length} zone → ${out}`);
