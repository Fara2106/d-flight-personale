import { it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { db } from '../../src/data/db';

declare const IDBFactory: any;

beforeEach(() => { indexedDB = new IDBFactory(); });

it('crea i cinque store al primo avvio', async () => {
  const d = await db();
  expect([...d.objectStoreNames].sort())
    .toEqual(['drones', 'meta', 'overlays', 'settings', 'zones']);
  d.close();
});

it('migra un DB v1 esistente conservando le zone', async () => {
  const v1 = await openDB('dfl-personale', 1, {
    upgrade(d) {
      d.createObjectStore('zones', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  await v1.put('zones', { id: 'z1', name: 'Zona v1' } as any);
  v1.close();

  const d = await db();
  expect([...d.objectStoreNames].sort())
    .toEqual(['drones', 'meta', 'overlays', 'settings', 'zones']);
  expect(await d.get('zones', 'z1')).toMatchObject({ id: 'z1', name: 'Zona v1' });
  d.close();
});
