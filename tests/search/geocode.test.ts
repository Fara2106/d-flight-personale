import { describe, it, expect, vi, afterEach } from 'vitest';
import { geocode } from '../../src/search/geocode';

afterEach(() => vi.restoreAllMocks());

it('maps Photon features to results', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features: [
      { geometry: { coordinates: [12.49, 41.90] },
        properties: { name: 'Roma', city: 'Roma', state: 'Lazio' } },
    ] }),
  }));
  const r = await geocode('roma');
  expect(r[0]).toMatchObject({ lat: 41.90, lon: 12.49 });
  expect(r[0].label).toContain('Roma');
});
it('returns empty array for blank query', async () => {
  expect(await geocode('  ')).toEqual([]);
});
