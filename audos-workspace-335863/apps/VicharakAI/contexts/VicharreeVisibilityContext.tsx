/**
 * VicharreeVisibilityContext — one switch for whether the floating Vicharree
 * launcher may show. Test/practice runners and timed sessions call hide() so
 * the character never overlaps a question card or distracts mid-test, and
 * show() when they close.
 *
 * The provider wraps the whole app (see App.tsx). hide()/show() are counted:
 * two overlapping hide() calls need two show() calls, so nested overlays
 * cannot accidentally re-show the launcher early.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface VicharreeVisibility {
  hide: () => void;
  show: () => void;
  isVisible: boolean;
}

const VicharreeVisibilityContext = createContext<VicharreeVisibility>({
  hide: () => undefined,
  show: () => undefined,
  isVisible: true,
});

export function VicharreeVisibilityProvider({ children }: { children: ReactNode }) {
  const hideCount = useRef(0);
  const [isVisible, setIsVisible] = useState(true);

  const hide = useCallback(() => {
    hideCount.current += 1;
    setIsVisible(false);
  }, []);

  const show = useCallback(() => {
    hideCount.current = Math.max(0, hideCount.current - 1);
    if (hideCount.current === 0) setIsVisible(true);
  }, []);

  const value = useMemo(() => ({ hide, show, isVisible }), [hide, show, isVisible]);
  return <VicharreeVisibilityContext.Provider value={value}>{children}</VicharreeVisibilityContext.Provider>;
}

export function useVicharreeVisibility(): VicharreeVisibility {
  return useContext(VicharreeVisibilityContext);
}
