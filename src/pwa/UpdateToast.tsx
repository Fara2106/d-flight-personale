import { useRegisterSW } from 'virtual:pwa-register/react';

/** Registra il service worker e mostra il toast quando c'è una nuova versione.
 *  L'update parte SOLO al tap su Aggiorna (registerType: 'prompt'). */
export function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="glass-panel update-toast text-sm">
      Nuova versione disponibile
      <button onClick={() => { void updateServiceWorker(true); }}
        className="btn-accent press px-3 py-1 text-sm">
        Aggiorna
      </button>
    </div>
  );
}
