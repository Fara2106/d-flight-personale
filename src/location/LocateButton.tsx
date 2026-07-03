export function LocateButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Centra sulla mia posizione"
      className="rounded-full p-3" style={{ background:'var(--surface)', boxShadow:'var(--shadow)' }}>
      📍
    </button>
  );
}
