/**
 * AppHeader — the app's own top bar: the VicharakAI logo with the VicharakAI
 * name, plus the menu button that opens the sidebar drawer on phones (the
 * desktop rail carries its own toggle).
 *
 * While it is mounted the space shell (Desktop.tsx) hides its own brand bar
 * for this app, so exactly one brand header shows. The shell listens for
 * APP_HEADER_EVENT; keep the event name in sync with it.
 */
import { useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { BRAND, F_HEAD, INK, INK_SOFT, RULE, SHEET } from '../theme';
import { VicharakLogoMark } from '../ui';

export const APP_HEADER_EVENT = 'vicharak:app-header';

function announceAppHeader(mounted: boolean): void {
  try {
    (window as unknown as { __vicharakAppHeader?: boolean }).__vicharakAppHeader = mounted;
    window.dispatchEvent(new CustomEvent(APP_HEADER_EVENT, { detail: mounted }));
  } catch {
    /* the shell simply keeps its own bar */
  }
}

export default function AppHeader({
  sidebarOpen,
  onToggleSidebar,
  className = '',
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  className?: string;
}) {
  useEffect(() => {
    announceAppHeader(true);
    return () => announceAppHeader(false);
  }, []);

  return (
    <header
      className={`items-center gap-1.5 px-2 sm:px-4 flex-shrink-0 ${className}`}
      style={{ minHeight: 56, background: SHEET, borderBottom: `1px solid ${RULE}` }}
      data-testid="app-header"
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={sidebarOpen}
        aria-controls="vicharak-sidebar-drawer"
        className="md:hidden flex items-center justify-center flex-shrink-0 touch-manipulation"
        style={{ color: INK_SOFT }}
        data-testid="button-sidebar-toggle-mobile"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      <div className="flex items-center gap-2 min-w-0" data-testid="app-header-brand">
        <VicharakLogoMark size={34} fallbackColor={BRAND} fit="cover" />
        <span
          className="leading-none"
          style={{ fontFamily: F_HEAD, fontSize: '1.12rem', fontWeight: 800, letterSpacing: '-0.01em', color: INK }}
        >
          Vicharak<span style={{ color: BRAND }}>AI</span>
        </span>
      </div>
    </header>
  );
}
