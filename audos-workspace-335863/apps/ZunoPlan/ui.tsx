/**
 * Shared VicharakAI UI pieces used by BOTH apps (My Plan and VicharakAI Calendar) so the
 * bottom navigation ritual — Today | Calendar | Dashboard | Coach | Profile —
 * feels identical everywhere. No imports from the app files themselves to
 * keep the module graph acyclic.
 */
import { CalendarDays, Home, LayoutDashboard, Sparkles, User } from 'lucide-react';

export type ZunoTab = 'today' | 'calendar' | 'dashboard' | 'coach' | 'profile';

const TAB_IDS: ZunoTab[] = ['today', 'calendar', 'dashboard', 'coach', 'profile'];

export const ZUNO_NAV_TARGET_KEY = 'zuno_nav_target';

/** From the standalone Calendar app: jump to a tab inside My Plan. */
export function requestPlanTab(tab: ZunoTab) {
  try {
    localStorage.setItem(ZUNO_NAV_TARGET_KEY, tab);
  } catch {
    /* storage unavailable — the plan app simply opens on Today */
  }
  window.dispatchEvent(new CustomEvent('openApp', { detail: { appId: 'zuno-plan' } }));
}

/** Inside My Plan: consume a pending tab request (set by the Calendar app). */
export function consumeRequestedTab(): ZunoTab | null {
  try {
    const v = localStorage.getItem(ZUNO_NAV_TARGET_KEY);
    if (v) {
      localStorage.removeItem(ZUNO_NAV_TARGET_KEY);
      // "progress" is the pre-rename id, still sitting in some browsers' storage.
      if (v === 'progress') return 'dashboard';
      if (TAB_IDS.includes(v as ZunoTab)) return v as ZunoTab;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** VicharakAI's warm visual identity — an indigo→violet orb, not mascot art. */
export function ZunoAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';
  return (
    <span
      className={`${box} rounded-full flex items-center justify-center flex-shrink-0 bg-[linear-gradient(135deg,var(--space-brand-primary),var(--space-brand-highlight))] text-[var(--space-text-on-highlight)] shadow-[0_4px_14px_color-mix(in_srgb,var(--space-brand-highlight)_35%,transparent)]`}
      aria-hidden="true"
    >
      <Sparkles className={icon} />
    </span>
  );
}

const TABS: Array<{ id: ZunoTab; label: string; Icon: typeof Home }> = [
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'coach', label: 'Coach', Icon: Sparkles },
  { id: 'profile', label: 'Profile', Icon: User },
];

/**
 * The always-visible bottom tab bar. `variant="dark"` matches the Calendar
 * app's deep-indigo night theme; `"light"` uses the shared space tokens.
 */
export function ZunoBottomNav({
  active,
  onSelect,
  variant = 'light',
}: {
  active: ZunoTab;
  onSelect: (tab: ZunoTab) => void;
  variant?: 'light' | 'dark';
}) {
  const dark = variant === 'dark';
  return (
    <nav
      className="sticky bottom-0 z-30 px-3 pb-3 pt-1"
      style={{
        background: dark
          ? 'linear-gradient(to top, #0b0a1a 55%, transparent)'
          : 'linear-gradient(to top, var(--space-surface-gradient-to) 45%, transparent)',
      }}
      aria-label="VicharakAI navigation"
    >
      <div
        className="flex items-stretch justify-between rounded-[22px] border px-1.5 py-1.5 backdrop-blur-md"
        style={
          dark
            ? {
                borderColor: 'rgba(129,140,248,0.25)',
                background: 'rgba(23,21,50,0.92)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
              }
            : {
                borderColor: 'var(--space-border-default)',
                background: 'color-mix(in srgb, var(--space-surface-panel-strong) 92%, transparent)',
                boxShadow: '0 10px 28px color-mix(in srgb, var(--space-shell-shadow-strong) 55%, transparent)',
              }
        }
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 min-w-0 flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-all touch-manipulation"
              style={
                isActive
                  ? {
                      background: 'linear-gradient(135deg, var(--space-brand-primary), var(--space-brand-highlight))',
                      color: 'var(--space-text-on-highlight)',
                      boxShadow: '0 4px 14px color-mix(in srgb, var(--space-brand-highlight) 35%, transparent)',
                    }
                  : { color: dark ? '#8f95c9' : 'var(--space-text-muted)' }
              }
              data-testid={`nav-${id}`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-bold leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
