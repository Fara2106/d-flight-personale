import { useCallback, useState } from 'react';
type Pos = { lat: number; lon: number; accuracy: number };

export function useGeolocation() {
  const [position, setPosition] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocalizzazione non disponibile.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPosition({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => setError('Permesso negato o posizione non disponibile.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  return { position, error, request };
}
