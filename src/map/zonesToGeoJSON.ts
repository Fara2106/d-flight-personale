import type { FeatureCollection } from 'geojson';
import type { Zone } from '../data/ed269.types';
import { altitudeLabel } from './altitudeLabel';

export function zonesToGeoJSON(zones: Zone[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      geometry: z.geometry,
      properties: {
        id: z.id,
        name: z.name,
        restrictionType: z.restrictionType,
        label: altitudeLabel(z),
        upperLimitM: z.upperLimitM,
        verticalRef: z.verticalRef,
        message: z.message,
      },
    })),
  };
}
