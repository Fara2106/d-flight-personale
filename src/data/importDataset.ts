import { parseEd269 } from './parseEd269';
import { normalizeZones } from './normalizeZones';
import { diffZones } from './diffZones';
import { loadZones, saveDataset } from './zoneStore';
import type { DatasetMeta, ZoneDiff } from './ed269.types';

export async function importDataset(
  input: string | unknown
): Promise<{ meta: DatasetMeta; diff: ZoneDiff }> {
  const doc = parseEd269(input);
  const next = normalizeZones(doc);
  const prev = await loadZones();
  const diff = diffZones(prev, next);
  const raw: any = doc;
  const meta: DatasetMeta = {
    cycleDate: raw.cycleDate ?? raw.validFrom ?? null,
    importedAt: new Date().toISOString(),
    zoneCount: next.length,
  };
  await saveDataset(next, meta);
  return { meta, diff };
}
