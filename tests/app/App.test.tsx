import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

it('niente bottone Profilo nella chrome principale (feedback iPhone 2026-07-10)', async () => {
  render(<App />);
  await screen.findByRole('button', { name: /^verifica$/i });
  // il profilo resta raggiungibile dal verdetto (VerdictSheet → onOpenProfile)
  expect(screen.queryByRole('button', { name: /^profilo$/i })).not.toBeInTheDocument();
});

it('il pin della posizione sta nella barra in alto, accanto a ricerca e tema', async () => {
  render(<App />);
  const pin = await screen.findByRole('button', { name: /segui la mia posizione/i });
  const topBar = pin.closest('div[style*="top"]');
  expect(topBar).not.toBeNull();
  // stessa barra della ricerca
  expect(topBar!.querySelector('input')).not.toBeNull();
});
