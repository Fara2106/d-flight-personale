import { useEffect, useState } from 'react';
import type { Drone, Pilot } from './profile.types';
import {
  listDrones, saveDrone, deleteDrone,
  getActiveDroneId, setActiveDroneId, getPilot, savePilot,
} from './profileStore';

export function useProfiles() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [activeDroneId, setActiveId] = useState<string | null>(null);
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, a, p] = [await listDrones(), await getActiveDroneId(), await getPilot()];
      if (cancelled) return;
      setDrones(d); setActiveId(a); setPilot(p); setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  async function upsertDrone(d: Drone): Promise<void> {
    await saveDrone(d);
    const list = await listDrones();
    setDrones(list);
    if (list.length === 1) { await setActiveDroneId(d.id); setActiveId(d.id); }
  }
  async function removeDrone(id: string): Promise<void> {
    await deleteDrone(id);
    setDrones(await listDrones());
    setActiveId(await getActiveDroneId());
  }
  async function activate(id: string): Promise<void> {
    await setActiveDroneId(id);
    setActiveId(id);
  }
  async function updatePilot(p: Pilot): Promise<void> {
    await savePilot(p);
    setPilot(p);
  }

  const activeDrone = drones.find(d => d.id === activeDroneId) ?? null;
  return { loaded, drones, activeDroneId, activeDrone, pilot, upsertDrone, removeDrone, activate, updatePilot };
}

export type UseProfiles = ReturnType<typeof useProfiles>;
