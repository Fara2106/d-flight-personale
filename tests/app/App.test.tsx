import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import 'fake-indexeddb/auto';

vi.mock('../../src/map/MapView', () => ({ MapView: () => <div data-testid="map" /> }));

import App from '../../src/App';

beforeEach(() => { (globalThis as any).indexedDB = new IDBFactory(); });

it('shows the import empty-state when there is no data', async () => {
  render(<App />);
  expect(await screen.findByText(/Importa le zone ufficiali/i)).toBeInTheDocument();
});

it('bottone Verifica disabilitato senza zone', async () => {
  render(<App />);
  const btn = await screen.findByRole('button', { name: /^verifica$/i });
  expect(btn).toBeDisabled();
});

it('espone un data-build non vuoto anche senza VITE_BUILD_ID esplicito (hook E2E/prod)', async () => {
  const { container } = render(<App />);
  const root = container.querySelector('[data-build]');
  expect(root).not.toBeNull();
  expect(root!.getAttribute('data-build')).not.toBe('');
});

it('bottone Profilo apre e chiude il pannello', async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^profilo$/i }));
  expect(await screen.findByRole('dialog', { name: /profilo/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /chiudi profilo/i }));
  expect(screen.queryByRole('dialog', { name: /profilo/i })).not.toBeInTheDocument();
});
