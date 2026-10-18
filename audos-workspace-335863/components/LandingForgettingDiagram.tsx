import { useEffect, useRef, useState } from 'react';
import {
  PAPER_ACCENT_TEXT,
  PAPER_BG,
  PAPER_FONT_BODY,
  PAPER_GONE,
  PAPER_G_CARD,
  PAPER_INK,
  PAPER_INK_FAINT,
  PAPER_INK_SOFT,
  PAPER_RULE,
  withAlpha,
} from './landingTokens';

/**
 * THE MEMORY DIAGRAM — the drawn visual in the problem band (founder
 * instruction, 2026-09-27: "replace the static image with a diagram of how
 * memory decays without revision").
 *
 * It replaces the static planner photograph that used to sit beside the week
 * strips — and as of 2026-09-27 it is the ONLY thing in the band, because the
 * week-decay strips beside it were making the identical point. Two lines over
 * thirty days: the same topic left alone (falling to almost nothing by day 14,
 * in the page's red) and the same topic revised on schedule, stepping back up
 * at every revision and staying high, in the brand blue.
 *
 * THE AXES ARE LABELLED PLAINLY (founder instruction, 2026-09-27):
 * “Retention” up the side, “Time” along the bottom, over the percentages and
 * the day ticks. No jargon and no named curve.
 *
 * DRAWN IN CODE, NOT DOWNLOADED. Inline SVG built from the page tokens — no
 * <img>, no photograph, no canvas library, no new image bytes on the page.
 *
 * THE SCHEDULE IS THE REAL ONE. The bumps land on day 1 / 3 / 7 / 14 / 28 —
 * TOPIC_REVISION_INTERVALS in apps/VicharakAI/config/revision.ts, the same
 * spacing the hero demo computes with, the week strips name and the animated
 * explainer walks. The brief for this diagram asked for a 1-3-5-7-14 spacing
 * and a Day-30 axis label; neither is a schedule the app runs, and the page
 * never prints a date the product does not keep (see v186). Never let these
 * drift apart.
 *
 * NO BANNED VOCABULARY: the labels are "What happens without revision" and
 * "With VicharakAI" — the named-curve jargon stays off the page (brand rule).
 *
 * MOTION. The lines draw themselves left to right the first time the block
 * scrolls into view (stroke-dashoffset on pathLength=1, observed against the
 * landing page's real scroll container .eg-root — the page does not scroll
 * the window), then the revision dots fade in along the held line. Under
 * prefers-reduced-motion the finished diagram renders with no animation at
 * all.
 */

/** The five days a topic comes back on — the app's own spacing. */
const REVIEW_DAYS = [1, 3, 7, 14, 28];
const LAST_DAY = 30;

/**
 * WHAT THE SYSTEM SAYS AT EACH REVIEW POINT (founder instruction, 2026-09-27).
 * The diagram's claim is no longer only WHEN a topic comes back but HOW: each
 * brand mark on the held line carries the instruction the app actually gives.
 * The labels render as tooltip-style cards under the plot — five sentences
 * drawn inside a 480-unit-wide SVG would collide on a phone.
 */
const METHOD_LABELS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Blank page recall — write everything you remember' },
  { day: 3, label: 'Active recall — 5 mins, then check' },
  { day: 7, label: 'Recall or practice questions' },
  { day: 14, label: 'Spaced review — VicharakAI decides method' },
  { day: 28, label: 'Final retention check' },
];

/* The drawing surface. Width stays under ~500 viewBox units so the tick
 * labels keep a readable size once the SVG scales down to a 375px phone. */
const VIEW_W = 480;
const VIEW_H = 306;
/** Room down the left for the rotated “Retention” label AND the % ticks. */
const PLOT_LEFT = 66;
const PLOT_RIGHT = 468;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 240;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Day → x. A square-root scale rather than a linear one: on a linear axis the
 * first three revisions crowd into the left sixth of the plot and their
 * labels collide on a phone. The compression is applied to BOTH lines and the
 * ticks alike, so the comparison stays honest — the early plunge still reads
 * as a plunge, and every revision gap still draws wider than the one before
 * it (the same trick the interval timeline in LandingSpacedRepetition uses).
 */
function dayX(day: number): number {
  return round2(PLOT_LEFT + Math.sqrt(day / LAST_DAY) * (PLOT_RIGHT - PLOT_LEFT));
}

/** Percent remembered → y. */
function heldY(percent: number): number {
  return round2(PLOT_TOP + ((100 - percent) / 100) * (PLOT_BOTTOM - PLOT_TOP));
}

/** LEFT ALONE: a smooth exponential slide — ~78% left after one day, under
 *  half by day 3, and effectively nothing (3%) by day 14. */
const WITHOUT_SAMPLE_DAYS = [
  0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8.5, 10, 12, 14, 17, 20, 24, 28, 30,
];
const WITHOUT_PATH = WITHOUT_SAMPLE_DAYS.map(
  (day, index) => `${index === 0 ? 'M' : 'L'} ${dayX(day)} ${heldY(100 * Math.exp(-day / 4))}`,
).join(' ');

/** ON SCHEDULE: a shallow slip between revisions, a bump back up at each one,
 *  and each slip shallower than the last — the loss shrinking as the spacing
 *  grows is the whole idea. */
const WITH_POINTS: Array<[number, number]> = [
  [0, 100],
  [1, 82],
  [1, 100],
  [3, 84],
  [3, 100],
  [7, 86],
  [7, 100],
  [14, 88],
  [14, 100],
  [28, 90],
  [28, 100],
  [30, 98],
];
const WITH_PATH = WITH_POINTS.map(
  ([day, held], index) => `${index === 0 ? 'M' : 'L'} ${dayX(day)} ${heldY(held)}`,
).join(' ');

const GRID_LEVELS = [100, 75, 50, 25, 0];
const AXIS_LABEL_LEVELS = [100, 50, 0];

export default function ForgettingDiagram({
  brandName,
  revisionNoun = 'revision',
}: {
  brandName: string;
  /** The market's own noun — "revision" (IN/UK) or "review" (US/Global). */
  revisionNoun?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** Sticky: the lines draw once, not on every scroll past. */
  const [drawn, setDrawn] = useState(false);
  const [reduced, setReduced] = useState(false);

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
  // observer is rooted there — exactly as the spaced-repetition explainer does.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setDrawn(true);
        observer.disconnect();
      },
      { root: node.closest('.eg-root'), threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const on = drawn || reduced;

  return (
    <div ref={rootRef} className="lp4-fd" data-testid="chart-memory-diagram">
      <style>{`
        /* ---------- The memory diagram ----------
           Page tokens only: the light canvas, dark ink, ink hairline rules,
           the red the page already uses for lost material, and ONE accent —
           electric blue. The held LINE draws in PAPER_ACCENT_TEXT, which on
           the light sheet is a deepened blue that reads as a data line.
           No cyan anywhere. */
        .lp4-fd {
          border: 1px solid ${PAPER_RULE};
          border-radius: 12px;
          background-image: ${PAPER_G_CARD};
          box-shadow: 0 1px 2px rgba(22, 31, 43, 0.08), 0 18px 34px -28px rgba(22, 31, 43, 0.3);
          padding: 1.1rem 1.1rem 1rem;
          font-family: ${PAPER_FONT_BODY};
        }
        .lp4-fd-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem 1.15rem;
          margin: 0 0 0.85rem;
        }
        .lp4-fd-key {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 0.875rem;
          font-weight: 700;
          line-height: 1.3;
          color: ${PAPER_INK_SOFT};
        }
        .lp4-fd-key i { flex-shrink: 0; width: 18px; height: 3px; border-radius: 999px; }
        .lp4-fd-key-without i { background: ${PAPER_GONE}; }
        .lp4-fd-key-with { color: ${PAPER_ACCENT_TEXT}; }
        .lp4-fd-key-with i { background: ${PAPER_ACCENT_TEXT}; }
        .lp4-fd-svg { display: block; width: 100%; height: auto; }
        .lp4-fd-grid { stroke: ${withAlpha(PAPER_INK, 0.06)}; stroke-width: 1; }
        .lp4-fd-axis { stroke: ${withAlpha(PAPER_INK, 0.2)}; stroke-width: 1; }
        .lp4-fd-tick {
          font-family: ${PAPER_FONT_BODY};
          font-size: 14px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          fill: ${PAPER_INK_FAINT};
        }
        /* The two axis names. Small caps, quieter than the ticks they label,
           and sized to survive the SVG scaling down to a 375px phone. */
        .lp4-fd-axis-title {
          font-family: ${PAPER_FONT_BODY};
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          fill: ${PAPER_INK_SOFT};
        }
        .lp4-fd-line {
          fill: none;
          stroke-width: 2.6;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }
        .lp4-fd-line-without { stroke: ${PAPER_GONE}; }
        .lp4-fd-line-with { stroke: ${PAPER_ACCENT_TEXT}; }
        .lp4-fd-on { stroke-dashoffset: 0; }
        /* The brand mark at each review point — a mini VicharakAI tile on
           the held line instead of a bare dot: the blue line is the product
           acting, not just a trend. */
        .lp4-fd-dot { opacity: 0; }
        .lp4-fd-dot-on { opacity: 1; }
        .lp4-fd-mark-tile { fill: #0057FF; stroke: ${PAPER_BG}; stroke-width: 1.5; }
        .lp4-fd-mark-v {
          font-family: ${PAPER_FONT_BODY};
          font-size: 10px;
          font-weight: 800;
          fill: #FFFFFF;
        }
        /* The five method cards under the plot, tooltip-styled: what the
           system actually tells you to DO at each point — not just “revise
           this”. */
        .lp4-fd-methods {
          list-style: none;
          display: grid;
          gap: 0.5rem;
          margin: 1.05rem 0 0;
          padding: 0;
        }
        @media (min-width: 48rem) { .lp4-fd-methods { grid-template-columns: repeat(5, 1fr); } }
        .lp4-fd-method {
          position: relative;
          border: 1px solid rgba(0, 87, 255, 0.28);
          border-radius: 9px;
          background: rgba(0, 87, 255, 0.08);
          padding: 0.7rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.5;
          color: ${PAPER_INK_SOFT};
        }
        .lp4-fd-method::before {
          content: '';
          position: absolute;
          top: -5px;
          left: 18px;
          width: 8px;
          height: 8px;
          transform: rotate(45deg);
          background: #E9F0FE;
          border-left: 1px solid rgba(0, 87, 255, 0.28);
          border-top: 1px solid rgba(0, 87, 255, 0.28);
        }
        .lp4-fd-method-day {
          display: block;
          margin-bottom: 0.2rem;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${PAPER_ACCENT_TEXT};
        }
        .lp4-fd-foot {
          margin: 0.8rem 0 0;
          font-size: 0.875rem;
          line-height: 1.6;
          color: ${PAPER_INK_FAINT};
        }
        /* The draw-in only exists when motion is welcome; otherwise the
           diagram simply IS finished — no timers, no transitions. */
        @media (prefers-reduced-motion: no-preference) {
          .lp4-fd-line { transition: stroke-dashoffset 1500ms cubic-bezier(0.65, 0, 0.35, 1); }
          .lp4-fd-line-with { transition-delay: 280ms; }
          .lp4-fd-dot { transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1); }
        }
      `}</style>

      <div className="lp4-fd-legend">
        <span className="lp4-fd-key lp4-fd-key-without">
          <i aria-hidden="true" />
          What happens without {revisionNoun}
        </span>
        <span className="lp4-fd-key lp4-fd-key-with">
          <i aria-hidden="true" />
          With {brandName}
        </span>
      </div>

      <svg
        className="lp4-fd-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={`Retention against time over thirty days. Without ${revisionNoun}, memory of a topic falls below half by day 3 and to almost nothing by day 14. With ${brandName} ${revisionNoun} on day 1, 3, 7, 14 and 28, it steps back up each time and stays high the whole month.`}
      >
        {GRID_LEVELS.map((level) => (
          <line
            key={level}
            className={level === 0 ? 'lp4-fd-axis' : 'lp4-fd-grid'}
            x1={PLOT_LEFT}
            x2={PLOT_RIGHT}
            y1={heldY(level)}
            y2={heldY(level)}
          />
        ))}
        {AXIS_LABEL_LEVELS.map((level) => (
          <text key={level} className="lp4-fd-tick" x={PLOT_LEFT - 9} y={heldY(level) + 4.5} textAnchor="end">
            {level}%
          </text>
        ))}

        {/* THE AXIS NAMES: Retention up the side, Time along the bottom. */}
        <text
          className="lp4-fd-axis-title"
          x={16}
          y={(PLOT_TOP + PLOT_BOTTOM) / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${(PLOT_TOP + PLOT_BOTTOM) / 2})`}
        >
          Retention
        </text>

        <text className="lp4-fd-tick" x={dayX(0)} y={PLOT_BOTTOM + 24} textAnchor="start">
          Study
        </text>
        {REVIEW_DAYS.map((day) => (
          <text key={day} className="lp4-fd-tick" x={dayX(day)} y={PLOT_BOTTOM + 24} textAnchor="middle">
            Day {day}
          </text>
        ))}
        <text
          className="lp4-fd-axis-title"
          x={(PLOT_LEFT + PLOT_RIGHT) / 2}
          y={VIEW_H - 5}
          textAnchor="middle"
        >
          Time
        </text>

        {/* pathLength=1 lets one dash rule draw any path, whatever its true
            length: offset 1 hides it, offset 0 is fully drawn. */}
        <path
          className={on ? 'lp4-fd-line lp4-fd-line-without lp4-fd-on' : 'lp4-fd-line lp4-fd-line-without'}
          d={WITHOUT_PATH}
          pathLength={1}
        />
        <path
          className={on ? 'lp4-fd-line lp4-fd-line-with lp4-fd-on' : 'lp4-fd-line lp4-fd-line-with'}
          d={WITH_PATH}
          pathLength={1}
        />

        {/* THE BRAND MARK AT EACH REVIEW POINT (founder instruction,
            2026-09-27): a mini VicharakAI tile in place of a bare dot. */}
        {REVIEW_DAYS.map((day, index) => (
          <g
            key={day}
            className={on ? 'lp4-fd-dot lp4-fd-dot-on' : 'lp4-fd-dot'}
            style={{ transitionDelay: reduced ? undefined : `${1050 + index * 110}ms` }}
          >
            <rect
              className="lp4-fd-mark-tile"
              x={dayX(day) - 7}
              y={heldY(100) - 7}
              width={14}
              height={14}
              rx={4}
            />
            <text className="lp4-fd-mark-v" x={dayX(day)} y={heldY(100) + 3.6} textAnchor="middle">
              V
            </text>
          </g>
        ))}
      </svg>

      {/* WHAT EACH MARK MEANS — the method, not just the date. */}
      <ul className="lp4-fd-methods" data-testid="list-diagram-methods">
        {METHOD_LABELS.map((item) => (
          <li key={item.day} className="lp4-fd-method">
            <span className="lp4-fd-method-day">Day {item.day}</span>
            {item.label}
          </li>
        ))}
      </ul>

      <p className="lp4-fd-foot">
        Each mark is one scheduled {revisionNoun} — day 1, 3, 7, 14 and 28, the exact spacing the app books.
        {' '}{brandName} doesn’t just say “revise this”. It tells you how.
      </p>
    </div>
  );
}
