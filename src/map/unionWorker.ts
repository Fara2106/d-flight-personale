// Worker del mosaico per categoria: riceve le zone, restituisce la
// FeatureCollection della vista d'insieme. Gira fuori dal main thread:
// sul file D-Flight reale il calcolo costa ~15-20s (Mac) e non deve
// bloccare né mappa né UI.
import type { Zone } from '../data/ed269.types';
import { categoryMosaic } from './fastUnion';

self.onmessage = (e: MessageEvent<Zone[]>) => {
  self.postMessage(categoryMosaic(e.data));
};
