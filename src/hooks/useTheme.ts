'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_THEME, resolveTheme, THEME_STORAGE_KEY, type ThemeMode } from '@/components/daw/theme';

/**
 * Tema del estudio: claro (el de Aura, por defecto), oscuro o el del sistema. Se aplica como atributo en
 * <html> para que las variables CSS bajen a todo el árbol sin re-render.
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME);
  const [resolved, setResolved] = useState<'dark' | 'light'>(resolveTheme(DEFAULT_THEME));

  const apply = useCallback((next: ThemeMode) => {
    const actual = resolveTheme(next);
    document.documentElement.setAttribute('data-daw-theme', actual);
    setResolved(actual);
  }, []);

  useEffect(() => {
    const saved = (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? DEFAULT_THEME;
    setMode(saved);
    apply(saved);

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const current = (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? DEFAULT_THEME;
      if (current === 'system') apply('system');
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
      document.documentElement.removeAttribute('data-daw-theme');
    };
  }, [apply]);

  const change = useCallback(
    (next: ThemeMode) => {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      setMode(next);
      apply(next);
    },
    [apply],
  );

  return { mode, resolved, setMode: change };
}
