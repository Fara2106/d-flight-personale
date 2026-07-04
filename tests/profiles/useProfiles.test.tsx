import { it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useProfiles } from '../../src/profiles/useProfiles';
import type { Drone } from '../../src/profiles/profile.types';

declare const IDBFactory: any;

const mini: Drone = { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' };
const duo: Drone = { id: 'd2', name: 'Duo', massGrams: 900, cClass: 'C2' };

beforeEach(() => { indexedDB = new IDBFactory(); });

it('carica lo stato iniziale vuoto', async () => {
  const { result } = renderHook(() => useProfiles());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.drones).toEqual([]);
  expect(result.current.activeDrone).toBeNull();
});

it('il primo drone inserito diventa attivo; il secondo no', async () => {
  const { result } = renderHook(() => useProfiles());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.upsertDrone(mini));
  expect(result.current.activeDroneId).toBe('d1');
  await act(() => result.current.upsertDrone(duo));
  expect(result.current.activeDroneId).toBe('d1');
  await act(() => result.current.activate('d2'));
  expect(result.current.activeDrone?.name).toBe('Duo');
});

it('rimuovere il drone attivo azzera la selezione', async () => {
  const { result } = renderHook(() => useProfiles());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(() => result.current.upsertDrone(mini));
  await act(() => result.current.removeDrone('d1'));
  expect(result.current.drones).toEqual([]);
  expect(result.current.activeDroneId).toBeNull();
});

it('il pilota persiste tra i mount', async () => {
  const a = renderHook(() => useProfiles());
  await waitFor(() => expect(a.result.current.loaded).toBe(true));
  await act(() => a.result.current.updatePilot({ competencies: { a1a3: {} } }));
  a.unmount();
  const b = renderHook(() => useProfiles());
  await waitFor(() => expect(b.result.current.loaded).toBe(true));
  expect(b.result.current.pilot?.competencies.a1a3).toBeDefined();
});
