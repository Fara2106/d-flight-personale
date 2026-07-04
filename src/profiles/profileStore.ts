import { db } from '../data/db';
import type { Drone, Pilot } from './profile.types';

const ACTIVE_KEY = 'activeDroneId', PILOT_KEY = 'pilot';

export async function listDrones(): Promise<Drone[]> {
  return (await db()).getAll('drones');
}
export async function saveDrone(drone: Drone): Promise<void> {
  await (await db()).put('drones', drone);
}
export async function deleteDrone(id: string): Promise<void> {
  const d = await db();
  await d.delete('drones', id);
  if ((await d.get('settings', ACTIVE_KEY)) === id) await d.delete('settings', ACTIVE_KEY);
}
export async function getActiveDroneId(): Promise<string | null> {
  return ((await (await db()).get('settings', ACTIVE_KEY)) as string | undefined) ?? null;
}
export async function setActiveDroneId(id: string | null): Promise<void> {
  const d = await db();
  if (id === null) await d.delete('settings', ACTIVE_KEY);
  else await d.put('settings', id, ACTIVE_KEY);
}
export async function getPilot(): Promise<Pilot | null> {
  return ((await (await db()).get('settings', PILOT_KEY)) as Pilot | undefined) ?? null;
}
export async function savePilot(pilot: Pilot): Promise<void> {
  await (await db()).put('settings', pilot, PILOT_KEY);
}
