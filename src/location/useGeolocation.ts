import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoPosition = { lat: number; lon: number; accuracy: number; heading: number | null };

/** Messaggi in italiano semplice per i codici GeolocationPositionError. */
export function geoErrorMessage(code: number): string {
  switch (code) {
    case 1: return "Permesso posizione negato: abilitalo per questo sito dalle impostazioni del browser (icona lucchetto vicino all'indirizzo), poi riprova.";
    case 2: return 'Posizione non disponibile in questo momento (segnale GPS assente o debole).';
    case 3: return 'La ricerca della posizione sta impiegando troppo tempo: spostati all\'aperto e riprova.';
    default: return 'Errore di geolocalizzazione.';
  }
}

function toPos(p: GeolocationPosition): GeoPosition {
  const h = p.coords.heading;
  return {
    lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy,
    heading: typeof h === 'number' && Number.isFinite(h) ? h : null,
  };
}

/** Posizione utente: `request()` legge una volta; `start()`/`stop()` seguono la
 *  posizione in tempo reale (watchPosition, alta precisione, heading incluso). */
export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (watchId.current != null) {
        navigator.geolocation?.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation?.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (mounted.current) setWatching(false);
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocalizzazione non disponibile su questo browser.'); return; }
    if (watchId.current != null) return; // già attivo
    setError(null);
    setWatching(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => { if (mounted.current) setPosition(toPos(p)); },
      (e) => {
        if (!mounted.current) return;
        setError(geoErrorMessage(e.code));
        if (e.code === 1) stop(); // permesso negato: inutile insistere
      },
      { enableHighAccuracy: true, maximumAge: 1_000, timeout: 15_000 },
    );
  }, [stop]);

  const request = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocalizzazione non disponibile su questo browser.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { if (mounted.current) setPosition(toPos(p)); },
      (e) => { if (mounted.current) setError(geoErrorMessage(e.code)); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  return { position, error, watching, start, stop, request };
}
