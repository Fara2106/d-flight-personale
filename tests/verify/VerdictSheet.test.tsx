// tests/verify/VerdictSheet.test.tsx
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerdictSheet } from '../../src/verify/VerdictSheet';
import type { Verdict } from '../../src/rules/rulesEngine';
import type { Zone } from '../../src/data/ed269.types';
import type { Drone } from '../../src/profiles/profile.types';

const geom = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } as const;
const zA: Zone = { id: 'a', name: 'Alfa', restrictionType: 'conditional', geometry: geom,
  lowerLimitM: 0, upperLimitM: 60, verticalRef: 'AGL', message: 'Nota A',
  reasons: [], authority: null, permanent: true };
const zB: Zone = { ...zA, id: 'b', name: 'Beta', message: 'Nota B' };
const drones: Drone[] = [
  { id: 'd1', name: 'Mini', massGrams: 249, cClass: 'sub250' },
  { id: 'd2', name: 'Duo', massGrams: 900, cClass: 'C2' },
];

function verdict(over: Partial<Verdict> = {}): Verdict {
  return { outcome: 'conditions', subcategory: 'A1', maxAltitudeM: 60,
    operationalNotes: ['Nota operativa'], zones: [zA, zB],
    warnings: ['Warning X'], references: ['Reg. (UE) 2019/947'], ...over };
}
function noop() {}
function base(over: Partial<Parameters<typeof VerdictSheet>[0]> = {}) {
  return { verdict: verdict(), drones, activeDroneId: 'd1',
    onSelectDrone: noop, onOpenProfile: noop, onClose: noop, onZoneFocus: noop, ...over };
}

it('mostra esito, quota, note, warnings e link D-Flight', () => {
  render(<VerdictSheet {...base()} />);
  expect(screen.getByText(/con condizioni/i)).toBeInTheDocument();
  expect(screen.getByText(/60 m AGL/)).toBeInTheDocument();
  expect(screen.getByText('Nota operativa')).toBeInTheDocument();
  expect(screen.getByText(/Warning X/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /d-flight/i })).toHaveAttribute('href', 'https://www.d-flight.it');
});

it('forbidden: quota — e titolo vietato', () => {
  render(<VerdictSheet {...base({ verdict: verdict({ outcome: 'forbidden', maxAltitudeM: null }) })} />);
  expect(screen.getByText(/vietato/i)).toBeInTheDocument();
  expect(screen.getByText(/Quota massima: —/)).toBeInTheDocument();
});

it('accordion: una zona alla volta + onZoneFocus', () => {
  const focus = vi.fn();
  render(<VerdictSheet {...base({ onZoneFocus: focus })} />);
  fireEvent.click(screen.getByRole('button', { name: /alfa/i }));
  expect(focus).toHaveBeenLastCalledWith('Alfa');
  expect(screen.getByText('Nota A')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /beta/i }));
  expect(focus).toHaveBeenLastCalledWith('Beta');
  expect(screen.queryByText('Nota A')).not.toBeInTheDocument();
  expect(screen.getByText('Nota B')).toBeInTheDocument();
});

it('cambio drone → onSelectDrone', () => {
  const sel = vi.fn();
  render(<VerdictSheet {...base({ onSelectDrone: sel })} />);
  fireEvent.change(screen.getByLabelText(/drone/i), { target: { value: 'd2' } });
  expect(sel).toHaveBeenCalledWith('d2');
});

it('senza verdetto (nessun drone): CTA al profilo, nessun esito', () => {
  const open = vi.fn();
  render(<VerdictSheet {...base({ verdict: null, drones: [], activeDroneId: null, onOpenProfile: open })} />);
  fireEvent.click(screen.getByRole('button', { name: /apri profilo/i }));
  expect(open).toHaveBeenCalled();
  expect(screen.queryByText(/consentito|vietato/i)).not.toBeInTheDocument();
});

it('allo smontaggio azzera il focus', () => {
  const focus = vi.fn();
  const { unmount } = render(<VerdictSheet {...base({ onZoneFocus: focus })} />);
  unmount();
  expect(focus).toHaveBeenLastCalledWith(null);
});
