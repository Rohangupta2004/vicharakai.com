import { useEffect, useRef, useState } from 'react';
import type { LandingTokens } from './landingTokens';
import {
  PAPER_ACCENT,
  PAPER_ACCENT_INK,
  PAPER_ACCENT_TEXT,
  PAPER_BG,
  PAPER_FONT_BODY,
  PAPER_FONT_DISPLAY,
  PAPER_G_ACCENT,
  PAPER_G_ACCENT_BRAND,
  PAPER_G_CARD,
  PAPER_G_HELD,
  PAPER_G_SUNK,
  PAPER_INK,
  PAPER_INK_FAINT,
  PAPER_INK_SOFT,
  PAPER_RULE,
  withAlpha,
} from './landingTokens';
import type { RegionConfig } from './landingRegions';

/**
 * THE SPACED-REPETITION EXPLAINER — the animated visual in the how-it-works
 * band (founder instruction, 2026-09-27: "replace the static image with a
 * Claude-style animated explainer").
 *
 * It replaces the static Mistake Book capture mockup that used to sit beside
 * the how-it-works copy. That mockup showed a feature; this shows the IDEA the
 * section is actually about — the gap between reviews getting longer every
 * time the topic comes back and is still there.
 *
 * DRAWN IN CODE, NOT DOWNLOADED. Everything here is markup, CSS and inline
 * SVG-free shapes: no <img>, no photo, no icon font, no animation library.
 * The page ships no new bytes for it.
 *
 * THE SCHEDULE IS THE REAL ONE. Day 1 / 3 / 7 / 14 / 28 is the spacing the app
 * actually schedules on (TOPIC_REVISION_INTERVALS in
 * apps/VicharakAI/config/revision.ts) — the same REVISION_OFFSETS the hero
 * demo computes with and the same days the week strips and the section copy
 * name. The last rung read 30 here until 2026-09-27 while the product booked
 * 28, so the animation promised a date the app would not keep. Never animate
 * a schedule the product does not run: a visitor who signs up gets these
 * dates.
 *
 * NOTHING MARKET-SPECIFIC IS HARDCODED. The topic on the card, the
 * revision/review noun and the chapter/unit noun all arrive from the region
 * config, so the US route never shows an Indian syllabus topic.
 *
 * MOTION. Smooth easing throughout, a staggered fade-and-rise the first time
 * the block scrolls into view (IntersectionObserver against the landing page's
 * real scroll root, .eg-root — the page does not scroll the window), and a
 * loop that pauses on the last stop and then crossfades back to day 0 rather
 * than rewinding in front of the visitor. The timer only runs while the block
 * is on screen. Everything stands down under prefers-reduced-motion, which
 * renders the finished state instead.
 */

/** The five days a topic comes back on — the app's own spacing. */
const REVIEW_DAYS = [1, 3, 7, 14, 28];
/** Day 0 is the night it was studied; the five reviews follow it. */
const STOPS = [0, ...REVIEW_DAYS];
const LAST = STOPS.length - 1;

/**
 * Where each stop sits along the rail, as a percentage.
 *
 * A true linear day scale would bury the first three stops in the left quarter
 * and collide their labels on a phone, so the position is a 50/50 blend of the
 * real day and an even spread. Every gap is still strictly wider than the one
 * before it — which is the entire point of the diagram — while every dot stays
 * readable. The labels underneath carry the real days.
 */
const RAIL_POS = STOPS.map((day, index) => {
  const linear = (day / STOPS[LAST]) * 100;
  const even = (index / LAST) * 100;
  return round2((linear + even) / 2);
});

/** The chip that sits between two stops: how much longer this wait was. */
const GAPS = STOPS.slice(1).map((day, index) => ({
  days: day - STOPS[index],
  at: round2((RAIL_POS[index] + RAIL_POS[index + 1]) / 2),
}));

/**
 * How well the topic is holding, stop by stop. Deliberately unlabelled with a
 * number on screen — it is the shape of the thing, not a statistic we can
 * evidence.
 */
const HELD = ['22%', '41%', '57%', '71%', '85%', '96%'];

/** Claude-ish motion: everything decelerates into place, nothing snaps. */
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/** The first card holds a beat longer, so the loop has a readable start. */
const FIRST_HOLD = 1750;
const STEP_HOLD = 1500;
/** The pause on the last stop, then the crossfade back to day 0. */
const END_PAUSE = 1900;
const END_FADE = 580;

/** Keeps the inline `left`/`width` percentages out of 16-decimal territory. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function SpacedRepetitionExplainer({
  t,
  region,
}: {
  t: LandingTokens;
  region: RegionConfig;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** Sticky: the entrance plays once, not on every scroll past. */
  const [revealed, setRevealed] = useState(false);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(0);
  /** True for the half second the diagram dims to hand back to day 0. */
  const [loop, setLoop] = useState(false);
  /** True for one frame while the stops rewind behind that dim. */
  const [snap, setSnap] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    if (typeof media.addEventListener === 'function') media.addEventListener('change', update);
    else media.addListener(update);
    return () => {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', update);
      else media.removeListener(update);
    };
  }, []);

  // The landing page scrolls inside .eg-root rather than the window, so the
  // observer is rooted there — exactly as the mobile sticky CTA does.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setRevealed(true);
      },
      { root: node.closest('.eg-root'), threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const running = revealed && inView && !reduced;

  useEffect(() => {
    if (!running) return;
    if (step < LAST) {
      const id = window.setTimeout(() => setStep(step + 1), step === 0 ? FIRST_HOLD : STEP_HOLD);
      return () => window.clearTimeout(id);
    }
    const dim = window.setTimeout(() => setLoop(true), END_PAUSE);
    const back = window.setTimeout(() => {
      setSnap(true);
      setLoop(false);
      setStep(0);
    }, END_PAUSE + END_FADE);
    return () => {
      window.clearTimeout(dim);
      window.clearTimeout(back);
    };
  }, [running, step]);

  useEffect(() => {
    if (!snap) return;
    const id = window.setTimeout(() => setSnap(false), 60);
    return () => window.clearTimeout(id);
  }, [snap]);

  // Scrolling away mid-loop must not leave the diagram dimmed.
  useEffect(() => {
    if (!running) setLoop(false);
  }, [running]);

  const revision = region.terms.revision;
  const Revision = `${revision.charAt(0).toUpperCase()}${revision.slice(1)}`;
  const topic = region.mockups.rows[0]?.topic ?? region.terms.chapter;

  // Under reduced motion the diagram renders finished rather than frozen at
  // the start, so it still says what it means.
  const view = reduced ? LAST : step;
  const day = STOPS[view];
  const nextGap = view < LAST ? STOPS[view + 1] - day : null;
  const upcoming = STOPS.slice(view + 1, view + 3);

  const rootClass = [
    'lp4-sr',
    revealed || reduced ? 'lp4-sr-in' : '',
    loop ? 'lp4-sr-loop' : '',
    snap ? 'lp4-sr-snap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={rootClass}
      data-testid="anim-spaced-repetition"
      role="img"
      aria-label={`One ${region.terms.chapter} coming back on day 1, 3, 7, 14 and 28 — each wait longer than the one before it.`}
    >
      <style>{`
        /* ---------- The spaced-repetition explainer ----------
           Page tokens only (the light warm-white canvas, dark ink, ink
           hairline rules) with the page's one accent, electric blue #0057FF —
           white ink on every accent fill, and PAPER_ACCENT_TEXT wherever the
           accent is TEXT. No cyan anywhere. */
        .lp4-sr {
          display: grid;
          justify-items: center;
          gap: 0.4rem;
          font-family: ${PAPER_FONT_BODY};
        }
        .lp4-sr-stage { width: 100%; display: grid; justify-items: center; transition: opacity 520ms ${EASE_IN_OUT}; }
        .lp4-sr-loop .lp4-sr-stage { opacity: 0.16; }

        /* Entrance: fade + rise, staggered, once, on scroll into view. */
        .lp4-sr-rise {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 760ms ${EASE_OUT}, transform 760ms ${EASE_OUT};
        }
        .lp4-sr-in .lp4-sr-rise { opacity: 1; transform: none; }
        .lp4-sr-in .lp4-sr-rise-2 { transition-delay: 150ms; }
        .lp4-sr-in .lp4-sr-rise-3 { transition-delay: 290ms; }

        /* ---- the phone: a wireframe outline, not a photograph ---- */
        .lp4-sr-phone {
          width: 100%;
          max-width: 286px;
          padding: 9px;
          border: 1.5px solid ${withAlpha(PAPER_INK, 0.35)};
          border-radius: 30px;
          background: ${PAPER_BG};
          box-shadow: 0 18px 38px rgba(22, 31, 43, 0.22);
        }
        .lp4-sr-screen {
          display: flex;
          flex-direction: column;
          min-height: 352px;
          padding: 11px 12px 13px;
          border-radius: 22px;
          border: 1px solid ${PAPER_RULE};
          background-image: ${PAPER_G_SUNK};
          overflow: hidden;
        }
        .lp4-sr-speaker {
          width: 42px;
          height: 4px;
          margin: 0 auto 11px;
          border-radius: 999px;
          background: ${PAPER_RULE};
        }
        .lp4-sr-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .lp4-sr-brand {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${PAPER_INK_FAINT};
        }
        .lp4-sr-day {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-variant-numeric: tabular-nums;
          color: ${PAPER_ACCENT_TEXT};
        }

        /* ---- the topic card ---- */
        .lp4-sr-card {
          margin-top: 11px;
          padding: 12px;
          border-radius: 13px;
          border: 1px solid ${PAPER_RULE};
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 3px rgba(22, 31, 43, 0.08);
        }
        /* Only the state block swaps, so the meter below it can transition
           its width instead of remounting at each step. */
        @media (prefers-reduced-motion: no-preference) {
          .lp4-sr-swap { animation: lp4srSwap 560ms ${EASE_OUT} both; }
        }
        @keyframes lp4srSwap {
          from { opacity: 0; transform: translateY(9px) scale(0.985); }
          to { opacity: 1; transform: none; }
        }
        .lp4-sr-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 8.5px;
          font-weight: 900;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .lp4-sr-pill i { width: 5px; height: 5px; border-radius: 999px; background: currentColor; }
        .lp4-sr-pill-study {
          color: ${PAPER_INK_SOFT};
          background: ${withAlpha(PAPER_INK, 0.05)};
          border: 1px solid ${PAPER_RULE};
        }
        .lp4-sr-pill-review {
          color: ${PAPER_ACCENT_INK};
          background-image: ${PAPER_G_ACCENT};
          border: 1px solid transparent;
        }
        @media (prefers-reduced-motion: no-preference) {
          .lp4-sr-pill-review i { animation: lp4srBlink 1.7s ${EASE_IN_OUT} infinite; }
        }
        @keyframes lp4srBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .lp4-sr-kicker {
          margin: 10px 0 0;
          font-size: 7.5px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${PAPER_INK_FAINT};
        }
        .lp4-sr-topic {
          margin: 3px 0 0;
          font-family: ${PAPER_FONT_DISPLAY};
          font-weight: 800;
          font-size: 15px;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: ${PAPER_INK};
        }
        .lp4-sr-meta { margin: 5px 0 0; font-size: 9.5px; font-weight: 700; line-height: 1.45; color: ${PAPER_INK_SOFT}; }

        .lp4-sr-meter { margin-top: 12px; }
        .lp4-sr-meter-k {
          display: block;
          font-size: 7.5px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${PAPER_INK_FAINT};
        }
        .lp4-sr-meter-track {
          display: block;
          margin-top: 5px;
          height: 6px;
          border-radius: 999px;
          background: ${withAlpha(PAPER_INK, 0.07)};
          overflow: hidden;
        }
        .lp4-sr-meter-track i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background-image: ${PAPER_G_HELD};
          transition: width 900ms ${EASE_OUT};
        }

        /* ---- what the schedule has queued behind it ---- */
        .lp4-sr-queue { margin-top: auto; padding-top: 13px; display: grid; gap: 5px; }
        .lp4-sr-queue-k {
          font-size: 7.5px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${PAPER_INK_FAINT};
        }
        .lp4-sr-queue-row {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 9px;
          border-radius: 9px;
          border: 1px solid ${PAPER_RULE};
          background: ${withAlpha('#161F2B', 0.04)};
          font-size: 9px;
          font-weight: 700;
          color: ${PAPER_INK_SOFT};
        }
        .lp4-sr-queue-row span:first-child {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: ${PAPER_ACCENT_TEXT};
        }

        /* ---- the interval timeline ---- */
        .lp4-sr-line { width: 100%; max-width: 30rem; padding: 2.5rem 0 2.1rem; }
        .lp4-sr-track { position: relative; height: 2px; margin: 0 1.2rem; }
        .lp4-sr-rail { position: absolute; inset: 0; border-radius: 999px; background: ${PAPER_RULE}; }
        .lp4-sr-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 999px;
          background-image: ${PAPER_G_ACCENT_BRAND};
          transition: width 840ms ${EASE_IN_OUT};
        }
        .lp4-sr-stop { position: absolute; top: 50%; transform: translate(-50%, -50%); }
        .lp4-sr-dot {
          position: relative;
          display: block;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: ${PAPER_BG};
          border: 1.5px solid ${PAPER_RULE};
          transition: background-color 420ms ${EASE_OUT}, border-color 420ms ${EASE_OUT},
            box-shadow 420ms ${EASE_OUT}, transform 560ms ${EASE_SPRING};
        }
        .lp4-sr-stop-done .lp4-sr-dot { background: ${PAPER_ACCENT_TEXT}; border-color: ${PAPER_ACCENT_TEXT}; }
        .lp4-sr-stop-on .lp4-sr-dot {
          background: ${PAPER_ACCENT_TEXT};
          border-color: ${PAPER_ACCENT_TEXT};
          transform: scale(1.34);
          box-shadow: 0 0 0 4px ${withAlpha(PAPER_ACCENT, 0.45)};
        }
        @media (prefers-reduced-motion: no-preference) {
          .lp4-sr-stop-on .lp4-sr-dot::after {
            content: '';
            position: absolute;
            inset: -5px;
            border-radius: 999px;
            border: 1.5px solid ${PAPER_ACCENT_TEXT};
            animation: lp4srPulse 1.8s ${EASE_OUT} infinite;
          }
        }
        @keyframes lp4srPulse {
          0% { opacity: 0.5; transform: scale(0.7); }
          70% { opacity: 0; transform: scale(1.75); }
          100% { opacity: 0; transform: scale(1.75); }
        }
        .lp4-sr-cap {
          position: absolute;
          top: 15px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          font-variant-numeric: tabular-nums;
          color: ${PAPER_INK_FAINT};
          transition: color 420ms ${EASE_OUT};
        }
        .lp4-sr-stop-done .lp4-sr-cap, .lp4-sr-stop-on .lp4-sr-cap { color: ${PAPER_INK}; }
        .lp4-sr-gap {
          position: absolute;
          bottom: 13px;
          transform: translate(-50%, 5px);
          opacity: 0;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid ${PAPER_RULE};
          background: ${PAPER_BG};
          white-space: nowrap;
          font-size: 0.75rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          color: ${PAPER_INK_FAINT};
          transition: opacity 540ms ${EASE_OUT}, transform 540ms ${EASE_OUT},
            color 420ms ${EASE_OUT}, border-color 420ms ${EASE_OUT};
        }
        .lp4-sr-gap-on {
          opacity: 1;
          transform: translate(-50%, 0);
          color: ${PAPER_ACCENT_TEXT};
          border-color: ${withAlpha(PAPER_ACCENT_TEXT, 0.45)};
        }
        .lp4-sr-axis {
          margin: 1.5rem 0 0;
          text-align: center;
          font-size: 0.875rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${PAPER_INK_FAINT};
        }

        /* The loop hands back to day 0 behind the dim, never in front of it. */
        .lp4-sr-snap .lp4-sr-fill,
        .lp4-sr-snap .lp4-sr-dot,
        .lp4-sr-snap .lp4-sr-cap,
        .lp4-sr-snap .lp4-sr-gap,
        .lp4-sr-snap .lp4-sr-meter-track i { transition: none; }

        @media (prefers-reduced-motion: reduce) {
          .lp4-sr-rise { opacity: 1; transform: none; transition: none; }
          .lp4-sr-stage,
          .lp4-sr-fill,
          .lp4-sr-dot,
          .lp4-sr-cap,
          .lp4-sr-gap,
          .lp4-sr-meter-track i { transition: none; }
        }
      `}</style>

      <div className="lp4-sr-stage">
        {/* ---- the phone ---- */}
        <div className="lp4-sr-phone lp4-sr-rise">
          <div className="lp4-sr-screen">
            <span className="lp4-sr-speaker" aria-hidden="true" />
            <div className="lp4-sr-head">
              <span className="lp4-sr-brand">{t.brandName}</span>
              <span className="lp4-sr-day">Day {day}</span>
            </div>

            <div className="lp4-sr-card">
              <div className="lp4-sr-swap" key={view}>
                <span className={view === 0 ? 'lp4-sr-pill lp4-sr-pill-study' : 'lp4-sr-pill lp4-sr-pill-review'}>
                  <i aria-hidden="true" />
                  {view === 0 ? 'Studied' : `${Revision} ${view} of ${LAST}`}
                </span>
                <p className="lp4-sr-kicker">{region.terms.chapter}</p>
                <p className="lp4-sr-topic">{topic}</p>
                <p className="lp4-sr-meta">
                  {view === 0
                    ? 'Logged tonight in thirty seconds.'
                    : nextGap
                      ? `Still there. Next one in ${plural(nextGap, 'day')}.`
                      : 'Thirty days on, still there.'}
                </p>
              </div>

              <div className="lp4-sr-meter">
                <span className="lp4-sr-meter-k">Held</span>
                <span className="lp4-sr-meter-track">
                  <i style={{ width: HELD[view] }} />
                </span>
              </div>
            </div>

            <div className="lp4-sr-queue">
              <span className="lp4-sr-queue-k">{upcoming.length ? 'Already scheduled' : 'Nothing due'}</span>
              {upcoming.length ? (
                upcoming.map((stop) => (
                  <span className="lp4-sr-queue-row" key={stop}>
                    <span aria-hidden="true" />
                    Day {stop} · {revision}
                  </span>
                ))
              ) : (
                <span className="lp4-sr-queue-row">
                  <span aria-hidden="true" />
                  It held. You never planned it.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ---- the interval timeline: each wait longer than the last ---- */}
        <div className="lp4-sr-line lp4-sr-rise lp4-sr-rise-2">
          <div className="lp4-sr-track">
            <span className="lp4-sr-rail" aria-hidden="true" />
            <span className="lp4-sr-fill" style={{ width: `${RAIL_POS[view]}%` }} aria-hidden="true" />

            {GAPS.map((gap, index) => (
              <span
                key={gap.at}
                className={index < view ? 'lp4-sr-gap lp4-sr-gap-on' : 'lp4-sr-gap'}
                style={{ left: `${gap.at}%` }}
              >
                +{plural(gap.days, 'day')}
              </span>
            ))}

            {STOPS.map((stop, index) => {
              const state = index === view ? ' lp4-sr-stop-on' : index < view ? ' lp4-sr-stop-done' : '';
              return (
                <span key={stop} className={`lp4-sr-stop${state}`} style={{ left: `${RAIL_POS[index]}%` }}>
                  <span className="lp4-sr-dot" />
                  <span className="lp4-sr-cap">{index === 0 ? 'Study' : stop}</span>
                </span>
              );
            })}
          </div>

          <p className="lp4-sr-axis lp4-sr-rise lp4-sr-rise-3">Days after you studied it</p>
        </div>
      </div>
    </div>
  );
}
