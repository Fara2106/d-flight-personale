import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchBox } from '../../src/search/SearchBox';
import { geocode } from '../../src/search/geocode';

vi.mock('../../src/search/geocode', () => ({
  geocode: vi.fn(),
}));
const geocodeMock = vi.mocked(geocode);

describe('SearchBox risultati', () => {
  beforeEach(() => {
    geocodeMock.mockReset();
  });

  it('mostra i risultati e li chiude quando diventa disabled (offline)', async () => {
    geocodeMock.mockResolvedValue([{ label: 'Roma, Lazio', lat: 41.9, lon: 12.5 }]);
    const { rerender } = render(<SearchBox onPick={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/cerca un luogo/i), { target: { value: 'roma' } });
    await screen.findByRole('button', { name: /roma, lazio/i });

    // si va offline con il dropdown aperto: la lista deve sparire…
    rerender(<SearchBox onPick={() => {}} disabled />);
    expect(screen.queryByRole('button', { name: /roma, lazio/i })).toBeNull();

    // …e non riapparire stantia quando si torna online
    rerender(<SearchBox onPick={() => {}} />);
    expect(screen.queryByRole('button', { name: /roma, lazio/i })).toBeNull();
  });

  it('errore di rete (navigator.onLine falso-positivo): niente crash, dropdown chiuso', async () => {
    geocodeMock.mockResolvedValueOnce([{ label: 'Roma, Lazio', lat: 41.9, lon: 12.5 }]);
    render(<SearchBox onPick={() => {}} />);
    const input = screen.getByPlaceholderText(/cerca un luogo/i);
    fireEvent.change(input, { target: { value: 'roma' } });
    await screen.findByRole('button', { name: /roma, lazio/i });

    // la rete cade ma navigator.onLine resta true: fetch rigetta
    geocodeMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fireEvent.change(input, { target: { value: 'roma centro' } });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /roma, lazio/i })).toBeNull());
  });
});
