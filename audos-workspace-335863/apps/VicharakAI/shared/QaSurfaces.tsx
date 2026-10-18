/**
 * QA Time Machine surfaces (see systemDate.ts) — the simulated-date badge and
 * the hidden version-line gesture that opens Test Controls.
 */
import { useRef } from 'react';
import { Clock } from 'lucide-react';
import { RADIUS, TEXT_MUTED, WARNING, tint } from '../theme';
import { getSystemDate, isDateOverrideActive } from '../systemDate';

/** Fixed badge shown on EVERY screen while the QA date override is active, so
 * a tester always knows they are on simulated time. Tapping it opens the
 * Test Controls panel. Renders nothing when no override is set. */
export function DateOverrideBadge({ onOpen }: { onOpen: () => void }) {
  if (!isDateOverrideActive()) return null;
  const simulated = getSystemDate();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed top-2 right-2 z-[95] inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
      style={{
        borderRadius: RADIUS.chip,
        background: tint(WARNING, 0.18),
        border: `1px solid ${tint(WARNING, 0.55)}`,
        color: WARNING,
        backdropFilter: 'blur(6px)',
      }}
      aria-label="Date override active — open Test Controls"
      data-testid="badge-date-override"
    >
      <Clock className="w-3.5 h-3.5" />
      Test date: {simulated.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
    </button>
  );
}

/** The version line at the foot of the Profile tab. Doubles as the HIDDEN QA
 * entry to the Time Machine: 5 quick taps or a 3-second hold opens the Test
 * Controls panel. Regular users see only a version number. (Gesture timing
 * uses the REAL clock on purpose — it measures elapsed input time.) */
export function AppVersionLine({ onSecretUnlock }: { onSecretUnlock: () => void }) {
  const tapsRef = useRef<{ count: number; last: number }>({ count: 0, last: 0 });
  const holdRef = useRef<number | null>(null);
  const tap = () => {
    const now = Date.now();
    const taps = tapsRef.current;
    tapsRef.current = { count: now - taps.last < 2000 ? taps.count + 1 : 1, last: now };
    if (tapsRef.current.count >= 5) {
      tapsRef.current = { count: 0, last: 0 };
      onSecretUnlock();
    }
  };
  const startHold = () => {
    if (holdRef.current !== null) window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => {
      holdRef.current = null;
      onSecretUnlock();
    }, 3000);
  };
  const endHold = () => {
    if (holdRef.current !== null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };
  return (
    <p
      className="pt-2 pb-1 text-center text-[10px] font-bold select-none"
      style={{ color: TEXT_MUTED }}
      onClick={tap}
      onPointerDown={startHold}
      onPointerUp={endHold}
      onPointerLeave={endHold}
      onContextMenu={(event) => event.preventDefault()}
      data-testid="text-app-version"
    >
      VicharakAI v1.0
    </p>
  );
}
