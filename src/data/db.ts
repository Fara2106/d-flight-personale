import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FeatureCollection } from 'geojson';
import type { Zone, DatasetMeta } from './ed269.types';
import type { Drone, Pilot } from '../profiles/profile.types';

export interface CachedOverlay { zonesKey: string; fc: FeatureCollection }

export interface DflSchema extends DBSchema {
  zones: { key: string; value: Zone };
  meta: { key: string; value: DatasetMeta };
  drones: { key: string; value: Drone };
  settings: { key: string; value: string | Pilot };
  /** Geometrie derivate costose (mosaico vista d'insieme), una per dataset. */
  overlays: { key: string; value: CachedOverlay };
}

const DB = 'dfl-personale', VER = 3;

export const db = (): Promise<IDBPDatabase<DflSchema>> => openDB<DflSchema>(DB, VER, {
  upgrade(d) {
    if (!d.objectStoreNames.contains('zones')) d.createObjectStore('zones', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    if (!d.objectStoreNames.contains('drones')) d.createObjectStore('drones', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings');
    if (!d.objectStoreNames.contains('overlays')) d.createObjectStore('overlays');
  },
});
