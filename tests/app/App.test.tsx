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
