import { useRegisterSW } from 'virtual:pwa-register/react';

/** Registra il service worker e mostra il toast quando c'è una nuova versione.
 *  L'update parte SOLO al tap su Aggiorna (registerType: 'prompt'). */
export function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status"
      className="rounded-xl px-4 py-2 text-sm"
      style={{ position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)',
        display: 'flex', gap: 12, alignItems: 'center', zIndex: 40 }}>
      Nuova versione disponibile
      <button onClick={() => { void updateServiceWorker(true); }}
        className="rounded-lg px-3 py-1 text-sm font-semibold text-white"
        style={{ background: 'var(--accent)' }}>
        Aggiorna
      </button>
    </div>
  );
}
