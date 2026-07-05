// src/profiles/ProfilePanel.tsx
import { useState } from 'react';
import { C_CLASS_LABELS, type CClass, type Pilot } from './profile.types';
import type { UseProfiles } from './useProfiles';

const EMPTY = { name: '', massGrams: '', cClass: 'sub250' as CClass };

export function ProfilePanel(
  { profiles, onClose }: { profiles: UseProfiles; onClose: () => void }
) {
  const { drones, activeDroneId, pilot, upsertDrone, removeDrone, activate, updatePilot } = profiles;
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function submit() {
    const mass = Number(draft.massGrams);
    if (!draft.name.trim()) { setFormErr('Il nome è obbligatorio.'); return; }
    if (!Number.isFinite(mass) || mass <= 0) { setFormErr('Indica la massa in grammi, maggiore di zero.'); return; }
    await upsertDrone({
      id: editingId ?? crypto.randomUUID(),
      name: draft.name.trim(), massGrams: mass, cClass: draft.cClass,
    });
    setDraft(EMPTY); setEditingId(null); setFormErr(null);
  }

  const p: Pilot = pilot ?? { competencies: {} };
  function toggleComp(id: 'a1a3' | 'a2', on: boolean) {
    const competencies = { ...p.competencies };
    if (on) competencies[id] = competencies[id] ?? {};
    else delete competencies[id];
    void updatePilot({ ...p, competencies });
  }
  function setValidUntil(id: 'a1a3' | 'a2', v: string) {
    void updatePilot({
      ...p,
      competencies: { ...p.competencies, [id]: v ? { validUntil: v } : {} },
    });
  }

  return (
    <div role="dialog" aria-label="Profilo" className="rounded-2xl p-4"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)',
        width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 18 }}>Profilo</strong>
        <button onClick={onClose} aria-label="Chiudi profilo"
          style={{ color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
      </div>

      <h3 className="text-sm font-semibold" style={{ marginTop: 12 }}>I miei droni</h3>
      {drones.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Nessun drone: aggiungine uno qui sotto.
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {drones.map(d => (
          <li key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
            <input type="radio" name="drone-attivo" aria-label={`Attiva ${d.name}`}
              checked={activeDroneId === d.id} onChange={() => { void activate(d.id); }} />
            <span style={{ flex: 1 }}>
              {d.name}
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {' '}· {d.massGrams} g · {C_CLASS_LABELS[d.cClass]}
              </span>
            </span>
            <button className="text-xs" style={{ color: 'var(--accent)' }}
              onClick={() => {
                setEditingId(d.id);
                setDraft({ name: d.name, massGrams: String(d.massGrams), cClass: d.cClass });
              }}>Modifica</button>
            <button className="text-xs" style={{ color: '#ef4444' }}
              onClick={() => { void removeDrone(d.id); }}>Elimina</button>
          </li>
        ))}
      </ul>

      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        <label className="text-sm">Nome{' '}
          <input value={draft.name} aria-label="Nome"
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'transparent', width: '100%' }} />
        </label>
        <label className="text-sm">Massa (g){' '}
          <input type="number" value={draft.massGrams} aria-label="Massa (g)"
            onChange={e => setDraft({ ...draft, massGrams: e.target.value })}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'transparent', width: '100%' }} />
        </label>
        <label className="text-sm">Classe{' '}
          <select value={draft.cClass} aria-label="Classe"
            onChange={e => setDraft({ ...draft, cClass: e.target.value as CClass })}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'var(--surface)', width: '100%' }}>
            {(Object.keys(C_CLASS_LABELS) as CClass[]).map(c =>
              <option key={c} value={c}>{C_CLASS_LABELS[c]}</option>)}
          </select>
        </label>
        {formErr && <div className="text-sm" style={{ color: '#ef4444' }}>{formErr}</div>}
        <button onClick={() => { void submit(); }}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          {editingId ? 'Salva drone' : 'Aggiungi drone'}
        </button>
      </div>

      <h3 className="text-sm font-semibold" style={{ marginTop: 16 }}>Pilota</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {([['a1a3', 'A1/A3'], ['a2', 'A2']] as const).map(([id, label]) => (
          <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="text-sm" style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <input type="checkbox" aria-label={label}
                checked={!!p.competencies[id]} onChange={e => toggleComp(id, e.target.checked)} />
              Attestato {label}
            </label>
            {p.competencies[id] && (
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>scadenza{' '}
                <input type="date" aria-label={`Scadenza ${label}`}
                  value={p.competencies[id]?.validUntil ?? ''}
                  onChange={e => setValidUntil(id, e.target.value)}
                  className="rounded px-1"
                  style={{ border: '1px solid var(--text-muted)', background: 'transparent' }} />
              </label>
            )}
          </div>
        ))}
        <label className="text-sm">Numero operatore (facoltativo){' '}
          <input value={p.operatorId ?? ''} aria-label="Numero operatore"
            onChange={e => { void updatePilot({ ...p, operatorId: e.target.value || undefined }); }}
            className="rounded px-2 py-1" style={{ border: '1px solid var(--text-muted)', background: 'transparent', width: '100%' }} />
        </label>
      </div>
    </div>
  );
}
