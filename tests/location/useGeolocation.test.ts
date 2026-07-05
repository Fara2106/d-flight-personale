import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation, geoErrorMessage } from '../../src/location/useGeolocation';

beforeEach(() => {
  vi.stubGlobal('navigator', { geolocation: {
    getCurrentPosition: (ok: any) =>
      ok({ coords: { latitude: 45.46, longitude: 9.19, accuracy: 12 } }),
  }});
});

it('returns the current position on request', () => {
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current.request());
  expect(result.current.position).toMatchObject({ lat: 45.46, lon: 9.19, accuracy: 12 });
});
it('reports an error when geolocation is unavailable', () => {
  vi.stubGlobal('navigator', {});
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current.request());
  expect(result.current.error).toBeTruthy();
});

describe('tracking continuo (watchPosition)', () => {
  let successCb: any, errorCb: any, watchOpts: any;
  const clearWatch = vi.fn();

  beforeEach(() => {
    successCb = errorCb = watchOpts = undefined;
    clearWatch.mockClear();
    vi.stubGlobal('navigator', { geolocation: {
      watchPosition: (ok: any, err: any, opts: any) => {
        successCb = ok; errorCb = err; watchOpts = opts; return 42;
      },
      clearWatch,
    }});
  });

  it('start(): attiva il watch ad alta precisione e aggiorna la posizione a ogni fix', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    expect(result.current.watching).toBe(true);
    expect(watchOpts.enableHighAccuracy).toBe(true);
    act(() => successCb({ coords: { latitude: 41.9, longitude: 12.5, accuracy: 8, heading: 90 } }));
    expect(result.current.position).toEqual({ lat: 41.9, lon: 12.5, accuracy: 8, heading: 90 });
    act(() => successCb({ coords: { latitude: 41.91, longitude: 12.51, accuracy: 6, heading: 95 } }));
    expect(result.current.position?.lat).toBe(41.91); // fix successivi aggiornano
  });

  it('heading assente o NaN (fermo/desktop) → null', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    act(() => successCb({ coords: { latitude: 41.9, longitude: 12.5, accuracy: 8, heading: NaN } }));
    expect(result.current.position?.heading).toBeNull();
  });

  it('stop(): ferma il watch con clearWatch', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.watching).toBe(false);
  });

  it('permesso negato: messaggio chiaro in italiano e tracking fermato', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    act(() => errorCb({ code: 1 }));
    expect(result.current.error).toMatch(/permesso posizione negato/i);
    expect(result.current.watching).toBe(false);
    expect(clearWatch).toHaveBeenCalled();
  });

  it('errore transitorio (timeout): messaggio ma il tracking resta attivo', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    act(() => errorCb({ code: 3 }));
    expect(result.current.error).toBeTruthy();
    expect(result.current.watching).toBe(true);
    expect(clearWatch).not.toHaveBeenCalled();
  });

  it('start() due volte non apre due watch', () => {
    const spy = vi.fn().mockReturnValue(7);
    vi.stubGlobal('navigator', { geolocation: { watchPosition: spy, clearWatch } });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    act(() => result.current.start());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unmount durante il tracking: clearWatch (niente watch orfani)', () => {
    const { result, unmount } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });
});

describe('geoErrorMessage', () => {
  it('messaggi distinti e concreti per i tre codici standard', () => {
    expect(geoErrorMessage(1)).toMatch(/permesso/i);
    expect(geoErrorMessage(1)).toMatch(/impostazioni|browser/i); // dice cosa fare
    expect(geoErrorMessage(2)).toMatch(/non disponibile/i);
    expect(geoErrorMessage(3)).toMatch(/tempo|riprova/i);
    expect(geoErrorMessage(99)).toBeTruthy();
  });
});
