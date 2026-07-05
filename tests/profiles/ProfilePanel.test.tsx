// tests/profiles/ProfilePanel.test.tsx
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfilePanel } from '../../src/profiles/ProfilePanel';
import type { UseProfiles } from '../../src/profiles/useProfiles';
import type { Drone } from '../../src/profiles/profile.types';

const mini: Drone = { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' };

function stub(over: Partial<UseProfiles> = {}): UseProfiles {
  return {
    loaded: true, drones: [], activeDroneId: null, activeDrone: null, pilot: null,
    upsertDrone: vi.fn(async () => {}), removeDrone: vi.fn(async () => {}),
    activate: vi.fn(async () => {}), updatePilot: vi.fn(async () => {}),
    ...over,
  } as UseProfiles;
}

it('rifiuta un drone senza nome', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /aggiungi drone/i }));
  expect(screen.getByText(/nome è obbligatorio/i)).toBeInTheDocument();
  expect(p.upsertDrone).not.toHaveBeenCalled();
});

it('rifiuta una massa non positiva', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Mini' } });
  fireEvent.change(screen.getByLabelText(/massa/i), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /aggiungi drone/i }));
  expect(screen.getByText(/maggiore di zero/i)).toBeInTheDocument();
  expect(p.upsertDrone).not.toHaveBeenCalled();
});

it('salva un drone valido', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Mini' } });
  fireEvent.change(screen.getByLabelText(/massa/i), { target: { value: '249' } });
  fireEvent.change(screen.getByLabelText(/classe/i), { target: { value: 'sub250' } });
  fireEvent.click(screen.getByRole('button', { name: /aggiungi drone/i }));
  expect(p.upsertDrone).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Mini', massGrams: 249, cClass: 'sub250' }));
});

it('mostra i droni e attiva via radio', () => {
  const p = stub({ drones: [mini], activeDroneId: null });
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('radio', { name: /attiva mini/i }));
  expect(p.activate).toHaveBeenCalledWith('d1');
});

it('spunta A2 con scadenza e aggiorna il pilota', () => {
  const p = stub();
  render(<ProfilePanel profiles={p} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /a2/i }));
  expect(p.updatePilot).toHaveBeenCalledWith(
    expect.objectContaining({ competencies: expect.objectContaining({ a2: {} }) }));
});
