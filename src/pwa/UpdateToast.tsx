import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Ogni quanto ricontrollare se c'è un service worker nuovo (oltre ai
 *  controlli all'avvio e a ogni ritorno in primo piano). */
const UPDATE_CHECK_MS = 60 * 60 * 1000; // 1 ora

/**
 * Registra il service worker e TIENE l'app aggiornata da sola.
 *
 * Perché non più il tap manuale: su iPhone la PWA installata resta "aperta"
 * per giorni e il vecchio toast "prompt" spesso non veniva mai visto né
 * toccato → l'utente restava su una versione vecchia (visto dal vivo il
 * 2026-07-22: mappa del round 8 su un telefono con il round 9 già in
 * produzione). Ora:
 *  - controlliamo un SW nuovo all'avvio, a intervalli e a ogni ritorno in
 *    primo piano (`visibilitychange`/`focus`) — decisivo su iOS, dove
 *    l'update in background non parte da solo;
 *  - appena è pronto lo APPLICHIAMO (skipWaiting + reload) senza aspettare un
 *    tap. Lo stato (zone, tema) è su IndexedDB/localStorage: il reload non
 *    perde dati.
 */
export function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return;
      const check = () => { void r.update(); };
      setInterval(check, UPDATE_CHECK_MS);
      // iOS: quando l'utente riapre la PWA (torna visibile) ricontrolla subito
      const onVisible = () => { if (document.visibilityState === 'visible') check(); };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', check);
    },
  });

  // appena c'è una versione nuova, applicala (skipWaiting + reload della pagina)
  useEffect(() => {
    if (needRefresh) void updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh) return null;
  return (
    <div role="status" className="glass-panel update-toast text-sm">
      Aggiorno all'ultima versione…
    </div>
  );
}
