import { render, screen } from '@testing-library/react';
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
  it('senza aggiornamento non mostra nulla e non forza update', () => {
    mockNeedRefresh = false;
    mockUpdateServiceWorker.mockClear();
    render(<UpdateToast />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
  });

  it('con aggiornamento pronto lo APPLICA da solo (skipWaiting+reload) e mostra il toast', () => {
    // su iPhone il toast "prompt" spesso non veniva mai toccato → utente su
    // versione vecchia. Ora l'update si applica automaticamente.
    mockNeedRefresh = true;
    mockUpdateServiceWorker.mockClear();
    render(<UpdateToast />);
    expect(screen.getByRole('status')).toHaveTextContent(/aggiorno/i);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });
});
