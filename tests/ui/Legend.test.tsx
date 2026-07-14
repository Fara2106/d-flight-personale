import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Legend } from '../../src/ui/Legend';
import type { CatAltitude } from '../../src/data/categoryAltitudes';
import type { RestrictionType } from '../../src/data/ed269.types';

const alt = (over: Partial<CatAltitude> = {}): CatAltitude =>
  ({ modeM: 120, minM: 120, maxM: 120, count: 5, uniform: true, ...over });

const ALTITUDES: Record<RestrictionType, CatAltitude> = {
  prohibited: alt({ modeM: 0, minM: 0, maxM: 0 }),
  auth_required: alt(),
  conditional: alt({ modeM: 60, minM: 25, maxM: 120, uniform: false }),
  none: alt({ modeM: null, minM: null, maxM: null, count: 0 }),
};

it('mostra quanto in alto si può volare accanto a ogni categoria', () => {
  render(<Legend altitudes={ALTITUDES} />);
  expect(screen.getByText(/non si vola/i)).toBeInTheDocument();          // vietato
  expect(screen.getByText(/di norma fino a 120 m/i)).toBeInTheDocument(); // autorizzazione
  expect(screen.getByText(/25–120 m — variabile, tocca la zona/i)).toBeInTheDocument();
});

it('senza dati quota (nessuna zona importata) la legenda resta quella di sempre', () => {
  render(<Legend />);
  expect(screen.getByText(/vietato/i)).toBeInTheDocument();
  expect(screen.queryByText(/fino a/i)).not.toBeInTheDocument();
});

it('il chip di "richiede autorizzazione" mostra il tratteggio della mappa', () => {
  render(<Legend altitudes={ALTITUDES} />);
  const chip = document.querySelector('[data-chip="auth_required"]') as HTMLElement;
  expect(chip).not.toBeNull();
  expect(chip.style.backgroundImage).toContain('repeating-linear-gradient');
});

describe('filtro categorie (feedback 2026-07-14: "non si capisce una mazza")', () => {
  it('checkbox per nascondere arancio e giallo; il vietato NON è disattivabile', () => {
    render(<Legend altitudes={ALTITUDES} hiddenTypes={[]} onToggleType={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /richiede autorizzazione/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /condizionato/i })).toBeChecked();
    // vietato sempre visibile: niente checkbox (app conservativa)
    expect(screen.queryByRole('checkbox', { name: /vietato/i })).toBeNull();
  });

  it('il toggle chiama onToggleType col tipo giusto e riflette hiddenTypes', () => {
    const calls: string[] = [];
    render(<Legend altitudes={ALTITUDES} hiddenTypes={['auth_required']}
      onToggleType={(t) => calls.push(t)} />);
    const box = screen.getByRole('checkbox', { name: /richiede autorizzazione/i });
    expect(box).not.toBeChecked();
    box.click();
    expect(calls).toEqual(['auth_required']);
  });

  it('senza onToggleType (nessuna zona importata) niente checkbox: legenda statica', () => {
    render(<Legend altitudes={ALTITUDES} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
