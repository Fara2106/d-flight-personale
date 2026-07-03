import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../src/theme/useTheme';

let mql: { matches: boolean; media: string; listeners: Array<() => void> };

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  mql = { matches: true, media: '(prefers-color-scheme: dark)', listeners: [] };
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() { return q.includes('dark') ? mql.matches : !mql.matches; },
    media: q,
    addEventListener: (_: string, cb: () => void) => { mql.listeners.push(cb); },
    removeEventListener: (_: string, cb: () => void) => {
      mql.listeners = mql.listeners.filter(l => l !== cb);
    },
  }));
});

it('defaults to system and resolves from matchMedia', () => {
  const { result } = renderHook(() => useTheme());
  expect(result.current.theme).toBe('system');
  expect(result.current.resolved).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it('persists explicit choice and applies it', () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current.setTheme('light'));
  expect(localStorage.getItem('theme')).toBe('light');
  expect(result.current.resolved).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('reacts to OS theme changes while pref is system', () => {
  const { result } = renderHook(() => useTheme());
  expect(result.current.resolved).toBe('dark');

  act(() => {
    mql.matches = false;
    mql.listeners.forEach(cb => cb());
  });

  expect(result.current.resolved).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('does not listen for OS changes when pref is explicit', () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current.setTheme('light'));
  expect(mql.listeners.length).toBe(0);
});
