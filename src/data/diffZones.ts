import type { Zone, ZoneDiff } from './ed269.types';

const fingerprint = (z: Zone) => JSON.stringify([
  z.name, z.restrictionType, z.lowerLimitM, z.upperLimitM,
  z.verticalRef, z.message, z.reasons, z.geometry,
]);

export function diffZones(prev: Zone[], next: Zone[]): ZoneDiff {
  const prevById = new Map(prev.map(z => [z.id, z]));
  const nextIds = new Set(next.map(z => z.id));
  const added: Zone[] = [];
  const modified: Zone[] = [];
  for (const z of next) {
    const old = prevById.get(z.id);
    if (!old) added.push(z);
    else if (fingerprint(old) !== fingerprint(z)) modified.push(z);
  }
  const removed = prev.filter(z => !nextIds.has(z.id));
  return { added, modified, removed };
}
