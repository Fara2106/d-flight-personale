import { LocateIcon } from '../ui/icons';

/** Toggle del tracking posizione: attivo = la mappa segue l'utente. */
export function LocateButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      aria-label={active ? 'Ferma il tracking della posizione' : 'Segui la mia posizione'}
      title={active ? 'Tracking attivo — tocca per fermare' : 'Segui la mia posizione'}
      className="glass press locate-btn"
      style={active
        // il test verifica che lo stile attivo contenga --accent
        ? { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }
        : { color: 'var(--text)' }}>
      <LocateIcon size={18} />
    </button>
  );
}
