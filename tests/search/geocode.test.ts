import { describe, it, expect, vi, afterEach } from 'vitest';
import { geocode } from '../../src/search/geocode';

afterEach(() => vi.restoreAllMocks());

it('maps Photon features to results', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features: [
      { geometry: { coordinates: [12.49, 41.90] },
        properties: { name: 'Roma', city: 'Roma', state: 'Lazio' } },
    ] }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const r = await geocode('roma');
  expect(r[0]).toMatchObject({ lat: 41.90, lon: 12.49 });
  expect(r[0].label).toContain('Roma');
  const requestedUrl = fetchMock.mock.calls[0][0] as string;
  expect(requestedUrl).toContain('bbox=6.6,35.2,18.8,47.3');
  // Photon ha rimosso il supporto a lang=it (restano default/de/en/fr):
  // con lang=it risponde 400 e la ricerca resta muta. Niente parametro lang.
  expect(requestedUrl).not.toContain('lang=');
});
it('returns empty array for blank query', async () => {
  expect(await geocode('  ')).toEqual([]);
});
