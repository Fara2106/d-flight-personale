// tests/verify/VerifyControls.test.tsx
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerifyControls } from '../../src/verify/VerifyControls';

function noop() {}
const base = { hasPoint: false, radiusM: 100, onRadiusChange: noop,
  canUsePosition: false, onUsePosition: noop, onClose: noop };

it('senza punto: istruzione visibile, niente slider', () => {
  render(<VerifyControls {...base} />);
  expect(screen.getByText(/tocca un punto sulla mappa/i)).toBeInTheDocument();
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});

it('"Usa la mia posizione" solo se disponibile, e chiama il callback', () => {
  const use = vi.fn();
  const { rerender } = render(<VerifyControls {...base} />);
  expect(screen.queryByRole('button', { name: /usa la mia posizione/i })).not.toBeInTheDocument();
  rerender(<VerifyControls {...base} canUsePosition onUsePosition={use} />);
  fireEvent.click(screen.getByRole('button', { name: /usa la mia posizione/i }));
  expect(use).toHaveBeenCalled();
});

it('con punto: slider 0–500 che notifica il raggio', () => {
  const change = vi.fn();
  render(<VerifyControls {...base} hasPoint onRadiusChange={change} />);
  const slider = screen.getByRole('slider') as HTMLInputElement;
  expect(slider.min).toBe('0');
  expect(slider.max).toBe('500');
  expect(screen.getByText(/100 m/)).toBeInTheDocument(); // etichetta = prop radiusM
  fireEvent.change(slider, { target: { value: '250' } });
  expect(change).toHaveBeenCalledWith(250);
  // input controllato: il valore mostrato cambia solo quando il parent aggiorna la prop
});

it('X chiude la modalità', () => {
  const close = vi.fn();
  render(<VerifyControls {...base} onClose={close} />);
  fireEvent.click(screen.getByRole('button', { name: /esci dalla verifica/i }));
  expect(close).toHaveBeenCalled();
});
