// Stub del modulo virtuale del plugin per l'ambiente Vitest: in jsdom non c'è
// un service worker, e il modulo reale è generato solo in dev/build.
// I test di UpdateToast lo sostituiscono con vi.mock; questo stub serve agli
// ALTRI test (es. App.test) che montano l'albero senza occuparsi della PWA.
import { useState } from 'react';

export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return { needRefresh, offlineReady, updateServiceWorker: async (_reload?: boolean) => {} };
}
