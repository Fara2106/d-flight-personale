import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateToast } from '../../src/pwa/UpdateToast';

// vi.mock è hoisted sopra gli import: le variabili esterne usate nella factory
// DEVONO chiamarsi mock* (regola Vitest, altrimenti errore di inizializzazione)
const mockUpdateServiceWorker = vi.fn(async () => {});
let mockNeedRefresh = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

describe('UpdateToast', () => {
  it('non mostra nulla se non c è un aggiornamento', () => {
    mockNeedRefresh = false;
    render(<UpdateToast />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('con aggiornamento pronto mostra il toast e Aggiorna applica', () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);
    expect(screen.getByRole('status')).toHaveTextContent(/nuova versione disponibile/i);
    fireEvent.click(screen.getByRole('button', { name: /aggiorna/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });
});
