import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '../../src/location/useGeolocation';

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
