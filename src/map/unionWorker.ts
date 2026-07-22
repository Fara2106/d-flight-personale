// Worker dell'overlay per categoria: riceve le zone, restituisce le due
// collezioni della vista d'insieme (veli + contorni). Gira fuori dal main
// thread: sul file D-Flight reale il calcolo costa ~15-20s (Mac) e non deve
// bloccare né mappa né UI.
import type { Zone } from '../data/ed269.types';
import { categoryOverlay } from './fastUnion';

self.onmessage = (e: MessageEvent<Zone[]>) => {
  self.postMessage(categoryOverlay(e.data));
};
