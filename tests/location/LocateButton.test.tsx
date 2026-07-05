import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocateButton } from '../../src/location/LocateButton';

it('inattivo: invita a seguire la posizione e non risulta premuto', () => {
  render(<LocateButton active={false} onClick={() => {}} />);
  const btn = screen.getByRole('button', { name: /segui la mia posizione/i });
  expect(btn).toHaveAttribute('aria-pressed', 'false');
});

it('attivo: aria-pressed e stile accent, label per fermare', () => {
  render(<LocateButton active onClick={() => {}} />);
  const btn = screen.getByRole('button', { name: /ferma/i });
  expect(btn).toHaveAttribute('aria-pressed', 'true');
  expect(btn.style.background).toContain('--accent');
});

it('il click notifica il toggle', () => {
  const onClick = vi.fn();
  render(<LocateButton active={false} onClick={onClick} />);
  fireEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledTimes(1);
});
