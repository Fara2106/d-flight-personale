import { render, screen, act, renderHook } from '@testing-library/react';
import { useOnline } from '../../src/ui/useOnline';
import { OfflineBanner } from '../../src/ui/OfflineBanner';
import { SearchBox } from '../../src/search/SearchBox';

describe('useOnline', () => {
  it('parte dallo stato di navigator.onLine e segue gli eventi', () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true); // jsdom: onLine = true

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);

    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);
  });
});

describe('OfflineBanner', () => {
  it('spiega cosa funziona e cosa no', () => {
    render(<OfflineBanner />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/sei offline/i);
    expect(banner).toHaveTextContent(/zone e verifica funzionano/i);
  });
});

describe('SearchBox offline', () => {
  it('con disabled l input è disabilitato e spiega perché', () => {
    render(<SearchBox onPick={() => {}} disabled />);
    const input = screen.getByPlaceholderText(/cerca un luogo/i);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('title', expect.stringMatching(/offline/i));
  });
  it('senza disabled resta abilitato (default)', () => {
    render(<SearchBox onPick={() => {}} />);
    expect(screen.getByPlaceholderText(/cerca un luogo/i)).toBeEnabled();
  });
});
