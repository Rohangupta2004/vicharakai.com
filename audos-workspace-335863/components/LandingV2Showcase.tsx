import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  PAPER_ACCENT,
  PAPER_ACCENT_TEXT,
  PAPER_BG,
  PAPER_FONT_BODY,
  PAPER_FONT_DISPLAY,
  PAPER_G_BRAND,
  PAPER_INK,
  PAPER_INK_FAINT,
  PAPER_INK_SOFT,
  PAPER_KEPT,
  PAPER_RULE,
  PAPER_SUNK,
} from './landingTokens';

/**
 * THE V2 PRODUCT SHOWCASE (founder instruction, 2026-09-29).
 *
 * The app was rebuilt as V2 — the Vicharee mood check-in that opens every
 * session, the chat-first daily plan, and the Vision Board map — and the
 * landing page showed none of it. These three components are pure CSS/HTML
 * phone mockups of those V2 moments, animated with keyframes only: no
 * screenshots, no video, no libraries.
 *
 * Conventions (same as LandingFlowDiagram):
 *   · Each mockup starts its animation when it scrolls into view, observed
 *     against .eg-root — the landing page's real scroll container.
 *   · Under prefers-reduced-motion every mockup renders its FINAL state,
 *     fully visible and static.
 *   · Every colour comes from the PAPER_* tokens — the light warm-white
 *     canvas and the one electric-blue accent, nothing else. The phone
 *     BEZELS stay dark on purpose: they are hardware, not page surface.
 *
 * The looping mockups (mood check-in, chat) run on a single master duration
 * per phone, with every element keyed to percentage offsets of that one
 * animation — so the scene can never drift out of sync with itself.
 */

/* ------------------------------------------------------------------ */
/*  Shared: in-view + reduced-motion state                             */
/* ------------------------------------------------------------------ */

type MotionState = 'idle' | 'on' | 'static';

function useMockupMotion(threshold = 0.3) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [motion, setMotion] = useState<MotionState>('idle');

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setMotion('static');
      return;
    }
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setMotion('on');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMotion('on');
          observer.disconnect();
        }
      },
      { root: el.closest('.eg-root'), threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { rootRef, motion };
}

function motionClass(base: string, motion: MotionState): string {
  if (motion === 'on') return `${base} v2m-on`;
  if (motion === 'static') return `${base} v2m-static`;
  return base;
}

/* ------------------------------------------------------------------ */
/*  Shared: the CSS phone frame                                        */
/* ------------------------------------------------------------------ */

/** The bezel + screen every mockup sits in. CSS only — no images. The halo
 *  behind it is the page's one accent at very low alpha, so the phone reads
 *  as lit by the product rather than dropped onto the page. */
function MockupPhone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="v2m-wrap">
      <div className="v2m-halo" aria-hidden="true" />
      <div className="v2m-phone" role="img" aria-label={label}>
        <div className="v2m-screen">
          <div className="v2m-island" aria-hidden="true" />
          {children}
        </div>
      </div>
    </div>
  );
}

/** Frame styles shared by all three mockups. Repeated per <style> block —
 *  identical rules are idempotent in CSS and each mockup stays portable. */
const PHONE_CSS = `
  .v2m-wrap { position: relative; display: flex; justify-content: center; }
  .v2m-halo {
    position: absolute;
    inset: -8% -14%;
    background: radial-gradient(ellipse 60% 55% at 50% 42%, rgba(0, 87, 255, 0.16) 0%, transparent 70%);
    filter: blur(6px);
    pointer-events: none;
  }
  .v2m-phone {
    position: relative;
    width: min(300px, 100%);
    border-radius: 2.6rem;
    padding: 9px;
    background: linear-gradient(170deg, #1B1B26 0%, #101018 100%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      0 34px 90px -46px rgba(0, 87, 255, 0.55),
      0 24px 60px -36px rgba(0, 0, 0, 0.9);
  }
  .v2m-screen {
    position: relative;
    display: flex;
    flex-direction: column;
    aspect-ratio: 9 / 18.6;
    border-radius: 2.05rem;
    border: 1px solid rgba(22, 31, 43, 0.08);
    background: ${PAPER_BG};
    overflow: hidden;
    font-family: ${PAPER_FONT_BODY};
  }
  .v2m-island {
    position: absolute;
    top: 9px;
    left: 50%;
    width: 74px;
    height: 18px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: #000;
    border: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 6;
  }
  .v2m-appbar {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 2.5rem 1rem 0.7rem;
    border-bottom: 1px solid ${PAPER_RULE};
  }
  .v2m-orb {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    flex: none;
    background:
      radial-gradient(circle at 32% 30%, #8FB6FF 0%, ${PAPER_ACCENT} 46%, #003AB0 100%);
    box-shadow: 0 0 14px rgba(0, 87, 255, 0.55);
  }
  .v2m-appbar b {
    font-family: ${PAPER_FONT_DISPLAY};
    font-size: 0.82rem;
    font-weight: 800;
    color: ${PAPER_INK};
    letter-spacing: 0.01em;
  }
  .v2m-appbar i {
    font-style: normal;
    font-size: 0.62rem;
    color: ${PAPER_INK_FAINT};
    display: block;
    margin-top: 1px;
  }
`;

/* Tiny inline icons — stroke inherits currentColor, so they tint with the
 * text beside them. Deliberately SVG, not emoji: the mockups are premium
 * product UI, not stickers. */
function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconSteady() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function IconRain() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 16.6A4.5 4.5 0 0 0 17.5 8.4a6 6 0 0 0-11.6 1.7A3.8 3.8 0 0 0 6 17.6h11.5" />
      <line x1="8" y1="20" x2="8" y2="22" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="16" y1="20" x2="16" y2="22" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

/* ================================================================== */
/*  1 · THE VICHAREE MOOD CHECK-IN                                     */
/*      Vicharee sweeps up from the bottom of the screen, asks how     */
/*      the student feels, "Just Regular" gets picked, the plan sets.  */
/* ================================================================== */

const MOOD_OPTIONS = [
  { key: 'up', label: 'Very Energetic', icon: <IconBolt /> },
  { key: 'mid', label: 'Just Regular', icon: <IconSteady /> },
  { key: 'down', label: 'Very Down', icon: <IconRain /> },
] as const;

export function VichareeMoodMockup() {
  const { rootRef, motion } = useMockupMotion();

  return (
    <div ref={rootRef} className={motionClass('v2m1', motion)} data-testid="mockup-vicharee-mood">
      <style>{`
        ${PHONE_CSS}
        /* ---- the dimmed Today list behind the sheet ---- */
        .v2m1-behind { flex: 1; padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.55rem; }
        .v2m1-behind h5 {
          margin: 0 0 0.15rem;
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: 0.92rem;
          font-weight: 800;
          color: ${PAPER_INK};
        }
        .v2m1-skel {
          border: 1px solid ${PAPER_RULE};
          border-radius: 0.8rem;
          background: ${PAPER_SUNK};
          padding: 0.55rem 0.65rem;
        }
        .v2m1-skel span {
          display: block;
          height: 7px;
          border-radius: 4px;
          background: rgba(22, 31, 43, 0.12);
        }
        .v2m1-skel span + span { margin-top: 6px; width: 62%; background: rgba(22, 31, 43, 0.07); }
        /* ---- the scrim that dims the list while Vicharee is up ---- */
        .v2m1-dim {
          position: absolute;
          inset: 0;
          background: rgba(4, 4, 9, 0.62);
          backdrop-filter: blur(1.5px);
          opacity: 0;
          z-index: 2;
        }
        /* ---- the sheet Vicharee sweeps in on ---- */
        .v2m1-sheet {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 3;
          border-radius: 1.4rem 1.4rem 2.05rem 2.05rem;
          border-top: 1px solid rgba(0, 87, 255, 0.28);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 249, 246, 0.99) 100%);
          box-shadow: 0 -18px 50px -20px rgba(0, 87, 255, 0.3);
          padding: 0.6rem 0.85rem 1rem;
          transform: translateY(106%);
        }
        .v2m1-grip {
          width: 34px;
          height: 4px;
          border-radius: 999px;
          background: rgba(22, 31, 43, 0.2);
          margin: 0 auto 0.65rem;
        }
        .v2m1-who { display: flex; align-items: center; gap: 0.5rem; }
        .v2m1-who .v2m-orb { width: 34px; height: 34px; }
        .v2m1-who b {
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: 0.9rem;
          font-weight: 800;
          color: ${PAPER_INK};
        }
        .v2m1-who i {
          display: block;
          font-style: normal;
          font-size: 0.62rem;
          color: ${PAPER_ACCENT_TEXT};
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .v2m1-hello { margin: 0.7rem 0 0.15rem; font-size: 0.78rem; color: ${PAPER_INK_SOFT}; }
        .v2m1-q {
          margin: 0 0 0.75rem;
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: 1.02rem;
          font-weight: 800;
          color: ${PAPER_INK};
          letter-spacing: 0.005em;
        }
        .v2m1-moods { display: flex; flex-direction: column; gap: 0.45rem; }
        .v2m1-mood {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 0.85rem;
          background: rgba(22, 31, 43, 0.03);
          color: ${PAPER_INK_SOFT};
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.6rem 0.75rem;
        }
        .v2m1-mood svg { color: ${PAPER_ACCENT_TEXT}; flex: none; }
        /* ---- the plan-set confirmation under the buttons ---- */
        .v2m1-set {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-top: 0.7rem;
          font-size: 0.72rem;
          color: ${PAPER_INK_SOFT};
          opacity: 0;
        }
        .v2m1-set .v2m1-tick {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: rgba(61, 214, 140, 0.16);
          color: ${PAPER_KEPT};
          flex: none;
        }
        .v2m1-set b { color: ${PAPER_INK}; font-weight: 600; }
        /* ================= the 12s master loop ================= */
        .v2m-on .v2m1-dim { animation: v2m1Dim 12s ease-in-out infinite; }
        .v2m-on .v2m1-sheet { animation: v2m1Sheet 12s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        .v2m-on .v2m1-mood-mid { animation: v2m1Pick 12s ease infinite; }
        .v2m-on .v2m1-mood-up, .v2m-on .v2m1-mood-down { animation: v2m1Dodge 12s ease infinite; }
        .v2m-on .v2m1-set { animation: v2m1Set 12s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        .v2m-on .v2m-orb { animation: v2m1Breathe 3.4s ease-in-out infinite; }
        @keyframes v2m1Dim {
          0%, 6% { opacity: 0; }
          13%, 88% { opacity: 1; }
          95%, 100% { opacity: 0; }
        }
        @keyframes v2m1Sheet {
          0%, 6% { transform: translateY(106%); }
          15%, 88% { transform: translateY(0); }
          96%, 100% { transform: translateY(106%); }
        }
        @keyframes v2m1Pick {
          0%, 38% {
            background: rgba(22, 31, 43, 0.03);
            border-color: ${PAPER_RULE};
            color: ${PAPER_INK_SOFT};
            transform: none;
          }
          41% { transform: scale(0.97); }
          45%, 92% {
            background: ${PAPER_G_BRAND};
            border-color: rgba(108, 155, 255, 0.65);
            color: #FFFFFF;
            transform: none;
            box-shadow: 0 6px 22px -8px rgba(0, 87, 255, 0.8);
          }
          100% {
            background: rgba(22, 31, 43, 0.03);
            border-color: ${PAPER_RULE};
            color: ${PAPER_INK_SOFT};
          }
        }
        @keyframes v2m1Dodge {
          0%, 40% { opacity: 1; }
          46%, 92% { opacity: 0.38; }
          100% { opacity: 1; }
        }
        @keyframes v2m1Set {
          0%, 48% { opacity: 0; transform: translateY(6px); }
          55%, 88% { opacity: 1; transform: none; }
          94%, 100% { opacity: 0; }
        }
        @keyframes v2m1Breathe {
          0%, 100% { box-shadow: 0 0 12px rgba(0, 87, 255, 0.45); }
          50% { box-shadow: 0 0 20px rgba(0, 87, 255, 0.75); }
        }
        /* ---- reduced motion / final state: sheet up, mood picked ---- */
        .v2m-static .v2m1-dim { opacity: 1; }
        .v2m-static .v2m1-sheet { transform: none; }
        .v2m-static .v2m1-mood-mid {
          background: ${PAPER_G_BRAND};
          border-color: rgba(108, 155, 255, 0.65);
          color: #FFFFFF;
        }
        .v2m-static .v2m1-mood-up, .v2m-static .v2m1-mood-down { opacity: 0.38; }
        .v2m-static .v2m1-set { opacity: 1; }
      `}</style>
      <MockupPhone label="VicharakAI mockup: Vicharee slides up and asks how you are feeling today, with three mood options">
        <div className="v2m-appbar">
          <span className="v2m-orb" aria-hidden="true" />
          <span>
            <b>VicharakAI</b>
            <i>JEE 2027 · Day 41</i>
          </span>
        </div>
        <div className="v2m1-behind" aria-hidden="true">
          <h5>Today</h5>
          <div className="v2m1-skel"><span /><span /></div>
          <div className="v2m1-skel"><span /><span /></div>
          <div className="v2m1-skel"><span /><span /></div>
        </div>
        <div className="v2m1-dim" aria-hidden="true" />
        <div className="v2m1-sheet">
          <div className="v2m1-grip" aria-hidden="true" />
          <div className="v2m1-who">
            <span className="v2m-orb" aria-hidden="true" />
            <span>
              <b>Vicharee</b>
              <i>Your AI coach</i>
            </span>
          </div>
          <p className="v2m1-hello">Good evening, Aarav.</p>
          <p className="v2m1-q">How are you feeling today?</p>
          <div className="v2m1-moods">
            {MOOD_OPTIONS.map((mood) => (
              <span key={mood.key} className={`v2m1-mood v2m1-mood-${mood.key}`}>
                {mood.icon}
                {mood.label}
              </span>
            ))}
          </div>
          <p className="v2m1-set">
            <span className="v2m1-tick"><IconCheck /></span>
            <span>
              <b>Plan set for a steady day</b> — 3 targets, about 45 min.
            </span>
          </p>
        </div>
      </MockupPhone>
    </div>
  );
}

/* ================================================================== */
/*  2 · THE VISION BOARD                                               */
/*      The zoomed-out game map: topic nodes with completion and       */
/*      accuracy, connected up to the dream-goal card.                 */
/* ================================================================== */

interface VisionNode {
  name: string;
  complete: number;
  accuracy: number;
  /** Percent position of the card inside the map. */
  left: string;
  top: string;
  /** Where its connector meets the card, in the 0–100 path space. */
  anchorX: number;
  anchorY: number;
  /** Entrance stagger, seconds after the mockup scrolls into view. */
  delay: number;
}

const VISION_NODES: VisionNode[] = [
  { name: 'Human Physiology', complete: 82, accuracy: 88, left: '4%', top: '30%', anchorX: 26, anchorY: 33, delay: 0.85 },
  { name: 'Organic Chemistry', complete: 54, accuracy: 71, left: '52%', top: '43%', anchorX: 74, anchorY: 46, delay: 1.25 },
  { name: 'Mechanics', complete: 61, accuracy: 76, left: '8%', top: '59%', anchorX: 30, anchorY: 62, delay: 1.65 },
  { name: 'Genetics', complete: 33, accuracy: 58, left: '48%', top: '74%', anchorX: 70, anchorY: 77, delay: 2.05 },
];

/** Connector curves, drawn in the same 0–100 space the anchors live in.
 *  pathLength=1 lets one dash rule draw every path regardless of length. */
const VISION_PATHS = VISION_NODES.map(
  (node) => `M ${node.anchorX} ${node.anchorY} Q ${node.anchorX > 50 ? 62 : 38} ${node.anchorY - 12} 50 17`,
);

export function VisionBoardMockup() {
  const { rootRef, motion } = useMockupMotion(0.25);

  return (
    <div ref={rootRef} className={motionClass('v2m2', motion)} data-testid="mockup-vision-board">
      <style>{`
        ${PHONE_CSS}
        .v2m2-map {
          position: relative;
          flex: 1;
          overflow: hidden;
        }
        /* The game-world floor: a faint grid + star specks, drifting slowly. */
        .v2m2-floor {
          position: absolute;
          inset: -12%;
          background-image:
            radial-gradient(circle at 18% 24%, rgba(108, 155, 255, 0.35) 0 1px, transparent 2px),
            radial-gradient(circle at 72% 12%, rgba(108, 155, 255, 0.28) 0 1px, transparent 2px),
            radial-gradient(circle at 84% 56%, rgba(108, 155, 255, 0.22) 0 1px, transparent 2px),
            radial-gradient(circle at 30% 70%, rgba(108, 155, 255, 0.25) 0 1px, transparent 2px),
            radial-gradient(circle at 58% 88%, rgba(108, 155, 255, 0.3) 0 1px, transparent 2px),
            linear-gradient(rgba(108, 155, 255, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(108, 155, 255, 0.055) 1px, transparent 1px),
            radial-gradient(ellipse 90% 50% at 50% 0%, rgba(0, 87, 255, 0.14) 0%, transparent 65%);
          background-size:
            100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%,
            34px 34px, 34px 34px, 100% 100%;
        }
        .v2m-on .v2m2-floor { animation: v2m2Drift 18s ease-in-out infinite alternate; }
        @keyframes v2m2Drift {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-10px, 8px) scale(1.04); }
        }
        /* Connectors — dashed light-blue paths that draw themselves in. */
        .v2m2-links { position: absolute; inset: 0; width: 100%; height: 100%; }
        .v2m2-links path {
          fill: none;
          stroke: rgba(108, 155, 255, 0.55);
          stroke-width: 1.4;
          stroke-linecap: round;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          vector-effect: non-scaling-stroke;
        }
        .v2m-on .v2m2-links path { animation: v2m2Draw 1.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .v2m-on .v2m2-links path:nth-child(1) { animation-delay: 0.55s; }
        .v2m-on .v2m2-links path:nth-child(2) { animation-delay: 0.95s; }
        .v2m-on .v2m2-links path:nth-child(3) { animation-delay: 1.35s; }
        .v2m-on .v2m2-links path:nth-child(4) { animation-delay: 1.75s; }
        @keyframes v2m2Draw { to { stroke-dashoffset: 0; } }
        /* The dream-goal card at the summit. */
        .v2m2-goal {
          position: absolute;
          left: 50%;
          top: 4.5%;
          transform: translateX(-50%);
          width: 72%;
          border-radius: 1rem;
          border: 1px solid rgba(0, 87, 255, 0.4);
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 245, 255, 0.97) 100%);
          box-shadow: 0 0 26px rgba(0, 87, 255, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9);
          padding: 0.55rem 0.7rem;
          text-align: center;
          opacity: 0;
        }
        .v2m2-goal i {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-style: normal;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${PAPER_ACCENT_TEXT};
        }
        .v2m2-goal b {
          display: block;
          margin-top: 2px;
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: 0.86rem;
          font-weight: 800;
          color: ${PAPER_INK};
        }
        .v2m2-goal span {
          display: block;
          margin-top: 1px;
          font-size: 0.62rem;
          color: ${PAPER_INK_SOFT};
        }
        .v2m-on .v2m2-goal { animation: v2m2GoalIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both; }
        @keyframes v2m2GoalIn {
          from { opacity: 0; transform: translate(-50%, -10px) scale(0.94); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        /* Topic nodes. */
        .v2m2-node {
          position: absolute;
          width: 44%;
          border-radius: 0.85rem;
          border: 1px solid ${PAPER_RULE};
          background: linear-gradient(168deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 246, 241, 0.97) 100%);
          box-shadow: 0 10px 26px -14px rgba(22, 31, 43, 0.3);
          padding: 0.5rem 0.55rem;
          opacity: 0;
        }
        .v2m2-node b {
          display: block;
          font-size: 0.66rem;
          font-weight: 700;
          color: ${PAPER_INK};
          line-height: 1.25;
        }
        .v2m2-bar {
          position: relative;
          height: 4px;
          margin-top: 5px;
          border-radius: 999px;
          background: rgba(22, 31, 43, 0.1);
          overflow: hidden;
        }
        .v2m2-bar i {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: ${PAPER_G_BRAND};
          transform-origin: left center;
          transform: scaleX(var(--fill, 0.5));
        }
        .v2m2-node span {
          display: block;
          margin-top: 4px;
          font-size: 0.56rem;
          color: ${PAPER_INK_FAINT};
        }
        .v2m2-node span em { font-style: normal; color: ${PAPER_ACCENT_TEXT}; font-weight: 600; }
        /* Each node carries its own stagger as an inline animation-delay —
           inline wins over the shorthand here, so the delays survive it. */
        .v2m-on .v2m2-node { animation: v2m2NodeIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes v2m2NodeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.92); }
          to { opacity: 1; transform: none; }
        }
        .v2m-on .v2m2-bar i { animation: v2m2Fill 1s cubic-bezier(0.22, 1, 0.36, 1) 2.3s both; }
        @keyframes v2m2Fill { from { transform: scaleX(0); } to { transform: scaleX(var(--fill, 0.5)); } }
        /* The goal floats gently once everything is in. */
        .v2m-on .v2m2-lift { animation: v2m2Float 6s ease-in-out 2.6s infinite alternate; }
        @keyframes v2m2Float { from { transform: translateY(0); } to { transform: translateY(-4px); } }
        /* Reduced motion / final state — everything drawn, nothing moving. */
        .v2m-static .v2m2-goal { opacity: 1; }
        .v2m-static .v2m2-node { opacity: 1; }
        .v2m-static .v2m2-links path { stroke-dashoffset: 0; }
      `}</style>
      <MockupPhone label="VicharakAI mockup: the Vision Board — topic nodes with completion and accuracy, connected to a dream-goal card">
        <div className="v2m-appbar">
          <span className="v2m-orb" aria-hidden="true" />
          <span>
            <b>Vision Board</b>
            <i>NEET 2027 · Priya&rsquo;s map</i>
          </span>
        </div>
        <div className="v2m2-map">
          <div className="v2m2-floor" aria-hidden="true" />
          <svg className="v2m2-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {VISION_PATHS.map((d) => (
              <path key={d} d={d} pathLength={1} />
            ))}
          </svg>
          <div className="v2m2-lift" aria-hidden="true">
            <div className="v2m2-goal">
              <i>
                <IconFlag />
                Dream goal
              </i>
              <b>MBBS at AIIMS Delhi</b>
              <span>NEET · May 2027</span>
            </div>
          </div>
          {VISION_NODES.map((node) => (
            <div
              key={node.name}
              className="v2m2-node"
              style={{ left: node.left, top: node.top, animationDelay: `${node.delay}s` }}
            >
              <b>{node.name}</b>
              <span className="v2m2-bar" aria-hidden="true">
                <i style={{ ['--fill' as string]: String(node.complete / 100) }} />
              </span>
              <span>
                <em>{node.complete}%</em> complete · {node.accuracy}% accuracy
              </span>
            </div>
          ))}
        </div>
      </MockupPhone>
    </div>
  );
}

/* ================================================================== */
/*  3 · THE CHAT-FIRST DAILY PLAN                                      */
/*      Vicharee messages first with today's targets, the Today tab    */
/*      updates itself, and a doubt photo lands right in the thread.   */
/* ================================================================== */

const CHAT_TARGETS = [
  { subject: 'Physics', line: 'Rotational Motion — 20 recall Qs', why: 'weak spot from Mock 4' },
  { subject: 'Maths', line: 'Integration by Parts — 15 min revision', why: 'last seen 7 days ago' },
  { subject: 'Chemistry', line: 'Chemical Bonding — quick quiz', why: 'due today' },
] as const;

const CHAT_PILLS = ['Start Rotational Motion', 'Upload a doubt', 'Make today lighter'] as const;

export function ChatPlanMockup() {
  const { rootRef, motion } = useMockupMotion();

  return (
    <div ref={rootRef} className={motionClass('v2m3', motion)} data-testid="mockup-chat-plan">
      <style>{`
        ${PHONE_CSS}
        .v2m3-tabs {
          display: flex;
          gap: 0.35rem;
          padding: 0.55rem 1rem 0.6rem;
          border-bottom: 1px solid ${PAPER_RULE};
        }
        .v2m3-tab {
          position: relative;
          font-size: 0.62rem;
          font-weight: 600;
          color: ${PAPER_INK_FAINT};
          border: 1px solid ${PAPER_RULE};
          border-radius: 999px;
          padding: 0.28rem 0.65rem;
          background: rgba(22, 31, 43, 0.03);
        }
        .v2m3-tab-on {
          color: #FFFFFF;
          background: ${PAPER_G_BRAND};
          border-color: rgba(108, 155, 255, 0.6);
        }
        .v2m3-badge {
          position: absolute;
          top: -6px;
          right: -7px;
          min-width: 15px;
          height: 15px;
          border-radius: 999px;
          background: ${PAPER_ACCENT};
          color: #FFFFFF;
          font-size: 0.55rem;
          font-weight: 700;
          line-height: 15px;
          text-align: center;
          box-shadow: 0 0 0 2px ${PAPER_BG};
          opacity: 0;
        }
        .v2m3-thread {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 0.45rem;
          padding: 0.7rem 0.8rem;
          overflow: hidden;
        }
        .v2m3-msg {
          max-width: 88%;
          border-radius: 1rem 1rem 1rem 0.3rem;
          border: 1px solid ${PAPER_RULE};
          background: linear-gradient(168deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 246, 241, 0.97) 100%);
          padding: 0.5rem 0.6rem;
          font-size: 0.68rem;
          line-height: 1.4;
          color: ${PAPER_INK_SOFT};
          opacity: 0;
        }
        .v2m3-msg b { color: ${PAPER_INK}; font-weight: 700; }
        .v2m3-mine {
          align-self: flex-end;
          border-radius: 1rem 1rem 0.3rem 1rem;
          border-color: rgba(108, 155, 255, 0.5);
          background: ${PAPER_G_BRAND};
          color: rgba(255, 255, 255, 0.92);
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .v2m3-mine svg { flex: none; }
        /* the typing indicator */
        .v2m3-typing {
          display: inline-flex;
          gap: 3px;
          align-items: center;
          border: 1px solid ${PAPER_RULE};
          border-radius: 1rem 1rem 1rem 0.3rem;
          background: rgba(255, 255, 255, 0.95);
          padding: 0.45rem 0.6rem;
          opacity: 0;
          align-self: flex-start;
        }
        .v2m3-typing i {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: ${PAPER_INK_FAINT};
        }
        /* the plan rows inside the plan message */
        .v2m3-target { display: flex; gap: 0.4rem; margin-top: 0.4rem; align-items: flex-start; }
        .v2m3-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${PAPER_ACCENT};
          margin-top: 4px;
          flex: none;
          box-shadow: 0 0 8px rgba(0, 87, 255, 0.7);
        }
        .v2m3-target small { display: block; font-size: 0.58rem; color: ${PAPER_INK_FAINT}; }
        /* the suggestion pills */
        .v2m3-pills { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0 0.8rem 0.55rem; }
        .v2m3-pill {
          font-size: 0.6rem;
          font-weight: 600;
          color: ${PAPER_ACCENT_TEXT};
          border: 1px solid rgba(108, 155, 255, 0.35);
          border-radius: 999px;
          padding: 0.28rem 0.6rem;
          background: rgba(0, 87, 255, 0.08);
          opacity: 0;
        }
        /* the input bar */
        .v2m3-input {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin: 0 0.7rem 0.8rem;
          border: 1px solid ${PAPER_RULE};
          border-radius: 999px;
          background: ${PAPER_SUNK};
          padding: 0.45rem 0.7rem;
          font-size: 0.65rem;
          color: ${PAPER_INK_FAINT};
        }
        .v2m3-input svg { color: ${PAPER_ACCENT_TEXT}; flex: none; }
        .v2m3-input span { flex: 1; }
        /* ================= the 14s master loop ================= */
        .v2m-on .v2m3-typing { animation: v2m3Typing 14s ease infinite; }
        .v2m-on .v2m3-typing i { animation: v2m3Dot 1s ease-in-out infinite; }
        .v2m-on .v2m3-typing i:nth-child(2) { animation-delay: 0.16s; }
        .v2m-on .v2m3-typing i:nth-child(3) { animation-delay: 0.32s; }
        .v2m-on .v2m3-hello { animation: v2m3In 14s cubic-bezier(0.22, 1, 0.36, 1) infinite; animation-delay: 0s; }
        .v2m-on .v2m3-plan { animation: v2m3In2 14s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        .v2m-on .v2m3-badge { animation: v2m3Badge 14s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        .v2m-on .v2m3-pill:nth-child(1) { animation: v2m3Pill1 14s ease infinite; }
        .v2m-on .v2m3-pill:nth-child(2) { animation: v2m3Pill2 14s ease infinite; }
        .v2m-on .v2m3-pill:nth-child(3) { animation: v2m3Pill3 14s ease infinite; }
        .v2m-on .v2m3-doubt { animation: v2m3Doubt 14s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        .v2m-on .v2m3-fix { animation: v2m3Fix 14s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        @keyframes v2m3Dot {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-2px); opacity: 1; }
        }
        @keyframes v2m3Typing {
          0%, 2% { opacity: 0; }
          4%, 10% { opacity: 1; }
          12%, 100% { opacity: 0; }
        }
        @keyframes v2m3In {
          0%, 11% { opacity: 0; transform: translateY(8px); }
          14%, 93% { opacity: 1; transform: none; }
          98%, 100% { opacity: 0; }
        }
        @keyframes v2m3In2 {
          0%, 19% { opacity: 0; transform: translateY(8px); }
          23%, 93% { opacity: 1; transform: none; }
          98%, 100% { opacity: 0; }
        }
        @keyframes v2m3Badge {
          0%, 30% { opacity: 0; transform: scale(0.4); }
          34%, 93% { opacity: 1; transform: scale(1); }
          98%, 100% { opacity: 0; }
        }
        @keyframes v2m3Pill1 {
          0%, 38% { opacity: 0; transform: translateY(5px); }
          41%, 93% { opacity: 1; transform: none; }
          98%, 100% { opacity: 0; }
        }
        @keyframes v2m3Pill2 {
          0%, 41% { opacity: 0; transform: translateY(5px); }
          44%, 52% { opacity: 1; transform: none; background: rgba(0, 87, 255, 0.08); }
          55%, 60% { background: rgba(0, 87, 255, 0.32); transform: scale(0.97); }
          63%, 93% { opacity: 1; transform: none; background: rgba(0, 87, 255, 0.08); }
          98%, 100% { opacity: 0; }
        }
        @keyframes v2m3Pill3 {
          0%, 44% { opacity: 0; transform: translateY(5px); }
          47%, 93% { opacity: 1; transform: none; }
          98%, 100% { opacity: 0; }
        }
        @keyframes v2m3Doubt {
          0%, 62% { opacity: 0; transform: translateY(8px); }
          66%, 93% { opacity: 1; transform: none; }
          98%, 100% { opacity: 0; }
        }
        @keyframes v2m3Fix {
          0%, 74% { opacity: 0; transform: translateY(8px); }
          78%, 93% { opacity: 1; transform: none; }
          98%, 100% { opacity: 0; }
        }
        /* Reduced motion / final state — full conversation, static. */
        .v2m-static .v2m3-hello, .v2m-static .v2m3-plan, .v2m-static .v2m3-doubt,
        .v2m-static .v2m3-fix, .v2m-static .v2m3-pill, .v2m-static .v2m3-badge { opacity: 1; }
        .v2m-static .v2m3-typing { display: none; }
      `}</style>
      <MockupPhone label="VicharakAI mockup: Vicharee sends today's targets in chat, the Today tab updates, and a doubt photo is answered in the thread">
        <div className="v2m-appbar">
          <span className="v2m-orb" aria-hidden="true" />
          <span>
            <b>Vicharee</b>
            <i>Your AI coach · online</i>
          </span>
        </div>
        <div className="v2m3-tabs" aria-hidden="true">
          <span className="v2m3-tab v2m3-tab-on">Chat</span>
          <span className="v2m3-tab">
            Today
            <span className="v2m3-badge">3</span>
          </span>
          <span className="v2m3-tab">Vision Board</span>
        </div>
        <div className="v2m3-thread">
          <span className="v2m3-typing" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div className="v2m3-msg v2m3-hello">
            <b>Good evening, Arjun.</b> Mock 4 is logged — here are today&rsquo;s 3 targets:
          </div>
          <div className="v2m3-msg v2m3-plan">
            <b>Today · 3 targets · ~45 min</b>
            {CHAT_TARGETS.map((target) => (
              <span key={target.line} className="v2m3-target">
                <span className="v2m3-dot" aria-hidden="true" />
                <span>
                  {target.line}
                  <small>
                    {target.subject} · {target.why}
                  </small>
                </span>
              </span>
            ))}
          </div>
          <div className="v2m3-msg v2m3-mine v2m3-doubt">
            <IconCamera />
            <span>Doubt photo · Rotation Q17</span>
          </div>
          <div className="v2m3-msg v2m3-fix">
            Got it — torque direction slip. Adding a <b>5-min fix</b> to today&rsquo;s plan.
          </div>
        </div>
        <div className="v2m3-pills" aria-hidden="true">
          {CHAT_PILLS.map((pill) => (
            <span key={pill} className="v2m3-pill">
              {pill}
            </span>
          ))}
        </div>
        <div className="v2m3-input" aria-hidden="true">
          <span>Message Vicharee…</span>
          <IconCamera />
        </div>
      </MockupPhone>
    </div>
  );
}
