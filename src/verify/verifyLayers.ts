// src/verify/verifyLayers.ts
import circle from '@turf/circle';
import type { Feature, Polygon } from 'geojson';

/** Cerchio di verifica da disegnare sulla mappa; null con raggio 0 (verifica puntuale). */
export function circleFeature(lat: number, lon: number, radiusM: number): Feature<Polygon> | null {
  if (radiusM <= 0) return null;
  return circle([lon, lat], radiusM / 1000, { steps: 64, units: 'kilometers' }) as Feature<Polygon>;
}
