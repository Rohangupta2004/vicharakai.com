/**
 * VicharreeLauncher — the floating Vicharree character, bottom-right, above
 * the bottom nav. It REPLACES the old round chat button: the character itself
 * is the tap target (no circle behind it). Tapping toggles the Vicharree chat;
 * opening flashes the 'greeting' state for 800ms before settling on
 * 'chatOpen'.
 *
 * Speech bubble:
 *  - Once per browser session ("Need help?", 3s after load, auto-dismisses
 *    after 5s or on tap — sessionStorage 'vicharree_bubble_shown').
 *  - Contextual tips handed in by the shell (weak topic → tap opens Practice
 *    pre-filtered) — shown once per session per tip id, again on tap.
 *  - Announcements from anywhere via vicharreeSay('…') (e.g. the Practice
 *    Q-Bank when a chapter keeps going wrong).
 *
 * Placement rules: fixed bottom-right above the bottom nav
 * (bottom: calc(80px + safe-area)), lifted by the keyboard height when the
 * on-screen keyboard opens (visualViewport), hidden entirely on test screens
 * via VicharreeVisibilityContext. The container is contained
 * (layout/style/paint) and fixed-size, so it can never cause layout shift.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import VicharreeCharacter, { type VicharreeState } from './VicharreeCharacter';
import { useVicharreeVisibility } from '../contexts/VicharreeVisibilityContext';

const NAVY_LIGHT = '#1A2550';
/** The exact light tint from the VicharakAI logo palette. */
const BLUE_BRIGHT = '#6C9BFF';

const BUBBLE_SESSION_KEY = 'vicharree_bubble_shown';
const TIP_SESSION_PREFIX = 'vicharree_tip_shown|';
const BUBBLE_DELAY_MS = 3000;
const BUBBLE_DISMISS_MS = 5000;
const TIP_DISMISS_MS = 6500;
const GREETING_FLASH_MS = 800;

/** Fired on window to make Vicharree speak from anywhere (detail: { text }). */
export const VICHARREE_SAY_EVENT = 'vicharree:say';

/** Make Vicharree say something (no-op when the launcher is not mounted). */
export function vicharreeSay(text: string): void {
  try {
    window.dispatchEvent(new CustomEvent(VICHARREE_SAY_EVENT, { detail: { text } }));
  } catch {
    /* CustomEvent unavailable — the tip is cosmetic, never load-bearing */
  }
}

export interface VicharreeTip {
  /** Stable id so one tip auto-shows only once per browser session. */
  id: string;
  text: string;
  /** When present the bubble is tappable and runs this (then dismisses). */
  onTap?: () => void;
}

function sessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode — the bubble may repeat, nothing breaks */
  }
}

interface BubbleState {
  text: string;
  onTap?: () => void;
  ttl: number;
  /** Dismissing the once-per-session bubble sets its storage flag. */
  marksSessionBubble?: boolean;
}

export default function VicharreeLauncher({
  chatOpen,
  onToggle,
  tip = null,
  unread = false,
}: {
  chatOpen: boolean;
  onToggle: () => void;
  tip?: VicharreeTip | null;
  /** Shows a small blue dot when the chat holds an unseen message. */
  unread?: boolean;
}) {
  const { isVisible } = useVicharreeVisibility();

  /* Responsive size: 56 below 768px (the brand spec size, and a comfortable
   * thumb target), 60 at and above it. */
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  const size = isDesktop ? 60 : 56;

  /* Keyboard-aware lift: when the visual viewport shrinks (keyboard open),
   * move up by the delta so the character never hides behind the keyboard. */
  const [keyboardLift, setKeyboardLift] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const onResize = () => {
      const delta = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardLift(delta > 60 ? delta : 0);
    };
    viewport.addEventListener('resize', onResize);
    viewport.addEventListener('scroll', onResize);
    return () => {
      viewport.removeEventListener('resize', onResize);
      viewport.removeEventListener('scroll', onResize);
    };
  }, []);

  /* Greeting flash when the chat opens. */
  const [flashGreeting, setFlashGreeting] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const handleToggle = () => {
    if (!chatOpen) {
      setFlashGreeting(true);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => {
        flashTimer.current = null;
        setFlashGreeting(false);
      }, GREETING_FLASH_MS);
    }
    if (bubble) showBubble(null);
    onToggle();
  };

  /* ---------- bubble ---------- */
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const dismissTimer = useRef<number | null>(null);

  const showBubble = (next: BubbleState | null) => {
    if (dismissTimer.current !== null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    setBubble((current) => {
      if (current?.marksSessionBubble) sessionSet(BUBBLE_SESSION_KEY, '1');
      return next;
    });
    if (next) {
      dismissTimer.current = window.setTimeout(() => {
        dismissTimer.current = null;
        if (next.marksSessionBubble) sessionSet(BUBBLE_SESSION_KEY, '1');
        setBubble(null);
      }, next.ttl);
    }
  };

  /* Once per session: "Need help?" 3s after load. */
  useEffect(() => {
    if (sessionGet(BUBBLE_SESSION_KEY) === '1') return undefined;
    const timer = window.setTimeout(() => {
      if (!chatOpen) {
        showBubble({ text: 'Need help?', ttl: BUBBLE_DISMISS_MS, marksSessionBubble: true });
      } else {
        sessionSet(BUBBLE_SESSION_KEY, '1');
      }
    }, BUBBLE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // Mount-only by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Contextual tip — once per browser session per tip id. */
  useEffect(() => {
    if (!tip || chatOpen) return;
    if (sessionGet(TIP_SESSION_PREFIX + tip.id) === '1') return;
    sessionSet(TIP_SESSION_PREFIX + tip.id, '1');
    showBubble({ text: tip.text, onTap: tip.onTap, ttl: TIP_DISMISS_MS });
    // Re-evaluate only when the tip identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip?.id]);

  /* Announcements from anywhere (vicharreeSay). */
  useEffect(() => {
    const onSay = (event: Event) => {
      const text = String((event as CustomEvent<{ text?: unknown }>).detail?.text ?? '').trim();
      if (text) showBubble({ text, ttl: TIP_DISMISS_MS });
    };
    window.addEventListener(VICHARREE_SAY_EVENT, onSay);
    return () => window.removeEventListener(VICHARREE_SAY_EVENT, onSay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const characterState: VicharreeState = !isVisible
    ? 'hidden'
    : flashGreeting
      ? 'greeting'
      : chatOpen
        ? 'chatOpen'
        : 'idle';

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      position: 'fixed',
      right: 16,
      bottom: `calc(80px + env(safe-area-inset-bottom, 0px) + ${keyboardLift}px)`,
      zIndex: 60,
      width: size,
      height: size,
      contain: 'layout style paint',
      pointerEvents: isVisible ? 'auto' : 'none',
      transition: 'bottom 0.15s ease-out',
      /* On a phone the chat is a FULL-SCREEN sheet whose bottom edge sits at
       * 62px — the launcher's own 80px anchor puts it straight on top of the
       * composer and its send button. The sheet has its own ✕ and swipe-down,
       * so the launcher stands down while it is open. On desktop the panel is
       * a small floating card and the launcher stays put beside it. */
      display: chatOpen && !isDesktop ? 'none' : undefined,
    }),
    [keyboardLift, size, isVisible, chatOpen, isDesktop],
  );

  return (
    <div style={containerStyle} data-testid="vicharree-launcher">
      {bubble && isVisible && !chatOpen && (
        <div
          role={bubble.onTap ? 'button' : 'status'}
          onClick={() => {
            const action = bubble.onTap;
            showBubble(null);
            if (action) action();
          }}
          style={{
            position: 'absolute',
            right: 0,
            bottom: size + 12,
            maxWidth: isDesktop ? 160 : 180,
            width: 'max-content',
            padding: '6px 12px',
            background: NAVY_LIGHT,
            border: `1px solid ${BLUE_BRIGHT}`,
            borderRadius: 8,
            color: '#FFFFFF',
            fontSize: '0.8rem',
            fontWeight: 500,
            lineHeight: 1.35,
            cursor: bubble.onTap ? 'pointer' : 'default',
            boxShadow: '0 4px 18px rgba(0,87,255,0.3)',
          }}
          data-testid="vicharree-bubble"
        >
          {bubble.text}
          {bubble.onTap && (
            <span className="block" style={{ fontSize: '0.7rem', fontWeight: 600, color: BLUE_BRIGHT, marginTop: 2 }}>
              {'Tap to open \u2192'}
            </span>
          )}
          {/* arrow pointing down toward the character */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: Math.max(10, size / 2 - 6),
              bottom: -6,
              width: 11,
              height: 11,
              background: NAVY_LIGHT,
              borderRight: `1px solid ${BLUE_BRIGHT}`,
              borderBottom: `1px solid ${BLUE_BRIGHT}`,
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      )}
      <button
        type="button"
        aria-label={chatOpen ? 'Close Vicharree' : 'Open Vicharree'}
        aria-expanded={chatOpen}
        onClick={handleToggle}
        className="touch-manipulation"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: size,
          height: size,
          filter: 'drop-shadow(0 4px 20px rgba(0,87,255,0.35))',
        }}
        data-testid="vicharree-launcher-button"
      >
        <VicharreeCharacter size={size} state={characterState} />
      </button>
      {unread && !chatOpen && isVisible && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: BLUE_BRIGHT,
            boxShadow: `0 0 6px ${BLUE_BRIGHT}`,
          }}
        />
      )}
    </div>
  );
}
