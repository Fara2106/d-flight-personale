import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

function systemDark(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return systemDark() ? 'dark' : 'light';
  return pref;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>(
    () => (localStorage.getItem('theme') as ThemePref) || 'system'
  );
  const resolved = resolve(theme);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setTheme = useCallback((p: ThemePref) => {
    localStorage.setItem('theme', p);
    setThemeState(p);
  }, []);

  return { theme, resolved, setTheme };
}
