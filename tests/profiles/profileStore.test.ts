import { it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  listDrones, saveDrone, deleteDrone,
  getActiveDroneId, setActiveDroneId, getPilot, savePilot,
} from '../../src/profiles/profileStore';
import type { Drone, Pilot } from '../../src/profiles/profile.types';

declare const IDBFactory: any;

const mini: Drone = { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' };
const duo: Drone = { id: 'd2', name: 'Duo', massGrams: 900, cClass: 'C2' };

beforeEach(() => { indexedDB = new IDBFactory(); });

it('parte vuoto', async () => {
  expect(await listDrones()).toEqual([]);
  expect(await getActiveDroneId()).toBeNull();
  expect(await getPilot()).toBeNull();
});

it('salva, aggiorna ed elimina droni', async () => {
  await saveDrone(mini);
  await saveDrone(duo);
  expect(await listDrones()).toHaveLength(2);
  await saveDrone({ ...mini, name: 'Mini 4K' });
  expect((await listDrones()).find(d => d.id === 'd1')?.name).toBe('Mini 4K');
  await deleteDrone('d2');
  expect(await listDrones()).toHaveLength(1);
});

it('gestisce il drone attivo e lo azzera se eliminato', async () => {
  await saveDrone(mini);
  await setActiveDroneId('d1');
  expect(await getActiveDroneId()).toBe('d1');
  await deleteDrone('d1');
  expect(await getActiveDroneId()).toBeNull();
});

it('salva e rilegge il pilota', async () => {
  const p: Pilot = { competencies: { a1a3: {}, a2: { validUntil: '2027-01-31' } }, operatorId: 'ITA-OP-123' };
  await savePilot(p);
  expect(await getPilot()).toEqual(p);
});
