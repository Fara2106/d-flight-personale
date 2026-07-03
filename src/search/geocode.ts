export type GeocodeResult = { label: string; lat: number; lon: number };

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=it&limit=5`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []).map((f: any): GeocodeResult => {
    const p = f.properties ?? {};
    const label = [p.name, p.city, p.state].filter(Boolean).join(', ') || 'Risultato';
    const [lon, lat] = f.geometry.coordinates;
    return { label, lat, lon };
  });
}
