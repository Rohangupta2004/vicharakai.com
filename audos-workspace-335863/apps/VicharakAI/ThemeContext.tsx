/**
 * VicharakAI's light/dark theme state. The visual values themselves live in
 * theme.ts as CSS variables — this context only decides which set is active
 * (a `vicharak-dark` class on the `.vicharak-app` root) and remembers the
 * choice in localStorage.
 *
 * FIRST LAUNCH follows the device: with no stored choice the mode comes from
 * `prefers-color-scheme`. The moment the student picks a theme (the sun/moon
 * toggle in the app header) that explicit choice is stored and honoured on
 * every later visit — the system preference only ever decides the default.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type VicharakThemeMode = 'dark' | 'light';

export const VICHARAK_THEME_KEY = 'vicharak_theme';

function systemTheme(): VicharakThemeMode {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

/** The stored explicit choice, or null when the student has never picked. */
function readStoredTheme(): VicharakThemeMode | null {
  try {
    const value = localStorage.getItem(VICHARAK_THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

interface ThemeContextValue {
  mode: VicharakThemeMode;
  setMode: (mode: VicharakThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  setMode: () => undefined,
  toggle: () => undefined,
});

export function VicharakThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<VicharakThemeMode | null>(readStoredTheme);
  const [system, setSystem] = useState<VicharakThemeMode>(systemTheme);
  const mode: VicharakThemeMode = stored ?? system;

  /* Until the student picks, the app keeps following the device preference —
   * including a live OS switch mid-session. An explicit pick stops this. */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystem(media.matches ? 'dark' : 'light');
    if (typeof media.addEventListener === 'function') media.addEventListener('change', update);
    else media.addListener(update);
    return () => {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', update);
      else media.removeListener(update);
    };
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const setMode = (next: VicharakThemeMode) => {
      setStored(next);
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
