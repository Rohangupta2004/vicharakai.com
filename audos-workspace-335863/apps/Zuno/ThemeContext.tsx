/**
 * VicharakAI's light/dark theme state. The visual values themselves live in
 * theme.ts as CSS variables — this context only decides which set is active
 * (a `vicharak-light` class on the `.vicharak-app` root) and remembers the choice in
 * localStorage. Dark is the default and matches the space shell.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type VicharakThemeMode = 'dark' | 'light';

export const VICHARAK_THEME_KEY = 'vicharak_theme';

function readStoredTheme(): VicharakThemeMode {
  try {
    return localStorage.getItem(VICHARAK_THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

interface ThemeContextValue {
  mode: VicharakThemeMode;
  setMode: (mode: VicharakThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  setMode: () => undefined,
  toggle: () => undefined,
});

export function VicharakThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<VicharakThemeMode>(readStoredTheme);

  const value = useMemo<ThemeContextValue>(() => {
    const setMode = (next: VicharakThemeMode) => {
      setModeState(next);
      try {
        localStorage.setItem(VICHARAK_THEME_KEY, next);
      } catch {
        /* the preference simply won't survive a reload */
      }
    };
    return { mode, setMode, toggle: () => setMode(mode === 'dark' ? 'light' : 'dark') };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useVicharakTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
