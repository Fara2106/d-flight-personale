import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataStatusBanner } from '../../src/ui/DataStatusBanner';

const meta = (over: Partial<Parameters<typeof DataStatusBanner>[0]['meta'] & object>) => ({
  cycleDate: null, importedAt: new Date().toISOString(), zoneCount: 10, ...over,
});

describe('DataStatusBanner: staleness onesta', () => {
  it('file senza data interna importato OGGI → nessun avviso (bug iPhone 2026-07-14)', () => {
    // il file D-Flight reale non ha cycleDate: l\'avviso "potrebbero non
    // essere aggiornati" il giorno stesso dell\'import è contraddittorio
    render(<DataStatusBanner meta={meta({})} />);
    expect(screen.getByText(/dati aggiornati al/i)).toBeTruthy();
    expect(screen.queryByText(/potrebbero non essere aggiornati/i)).toBeNull();
  });

  it('file senza data interna importato 2 mesi fa → avviso presente', () => {
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
    render(<DataStatusBanner meta={meta({ importedAt: old })} />);
    expect(screen.getByText(/potrebbero non essere aggiornati/i)).toBeTruthy();
  });

  it('cycleDate vecchia → avviso anche se l\'import è di oggi', () => {
    render(<DataStatusBanner meta={meta({ cycleDate: '2026-01-01' })} />);
    expect(screen.getByText(/potrebbero non essere aggiornati/i)).toBeTruthy();
  });
});
