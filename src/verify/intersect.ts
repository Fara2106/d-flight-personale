// src/verify/intersect.ts
import circle from '@turf/circle';
import booleanIntersects from '@turf/boolean-intersects';
import { point, feature } from '@turf/helpers';
import type { Zone } from '../data/ed269.types';

export interface VerifyPoint { lat: number; lon: number; radiusM: number }

/** Zone toccate dal punto (radiusM = 0) o dal cerchio; il bordo conta come dentro. */
export function zonesAtPoint(zones: Zone[], p: VerifyPoint): Zone[] {
  const probe = p.radiusM > 0
    ? circle([p.lon, p.lat], p.radiusM / 1000, { steps: 64, units: 'kilometers' })
    : point([p.lon, p.lat]);
  return zones.filter(z => booleanIntersects(probe, feature(z.geometry)));
}
