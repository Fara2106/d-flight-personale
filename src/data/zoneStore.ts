import { db } from './db';
import type { Zone, DatasetMeta } from './ed269.types';

const META_KEY = 'dataset';

export async function saveDataset(zones: Zone[], meta: DatasetMeta): Promise<void> {
  const d = await db();
  const tx = d.transaction(['zones', 'meta'], 'readwrite');
  await tx.objectStore('zones').clear();
  for (const z of zones) await tx.objectStore('zones').put(z);
  await tx.objectStore('meta').put(meta, META_KEY);
  await tx.done;
}
export async function loadZones(): Promise<Zone[]> {
  return (await db()).getAll('zones');
}
export async function loadMeta(): Promise<DatasetMeta | null> {
  return (await (await db()).get('meta', META_KEY)) ?? null;
}
