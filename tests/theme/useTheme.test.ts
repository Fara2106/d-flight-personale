import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../src/theme/useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('dark'), media: q,
    addEventListener: () => {}, removeEventListener: () => {},
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
