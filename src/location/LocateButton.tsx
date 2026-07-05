/** Toggle del tracking posizione: attivo = la mappa segue l'utente. */
export function LocateButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      aria-label={active ? 'Ferma il tracking della posizione' : 'Segui la mia posizione'}
      title={active ? 'Tracking attivo — tocca per fermare' : 'Segui la mia posizione'}
      className="rounded-full p-3"
      style={{
        background: active ? 'var(--accent)' : 'var(--surface)',
        boxShadow: 'var(--shadow)',
        filter: active ? 'saturate(1.2)' : undefined,
      }}>
      📍
    </button>
  );
}
