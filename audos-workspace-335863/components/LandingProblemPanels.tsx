import type { LandingTokens } from './landingTokens';
import {
  CHART_AXIS_LINE,
  CHART_GRID_LINE,
  CHART_LINE_MUTED,
  CHART_LINE_PRIMARY,
  CTA_BLUE,
  GLASS_BG,
  GLASS_BG_INSET,
  GLASS_BORDER,
  LANDING_C_ACCENT,
} from './landingTokens';

/**
 * Section 3 of the signed-out landing page — “Why students fail despite
 * studying every day”, told as five TEXT panels.
 *
 * There are no illustrations in here, by founder instruction (2026-09-02):
 * the stick figures, the desk line-art, the open book, the toppling book
 * stack and the marked-paper drawing are all gone, and nothing may put a
 * character, avatar or cartoon prop back. Each panel is a dark glass card —
 * rgba(255,255,255,0.04) behind a rgba(255,255,255,0.08) hairline with a thin
 * #0057FF border on the left — carrying a big step numeral, a heading and a
 * line of body copy. The typography is the visual.
 *
 * The ONE piece of art that survives is the forgetting curve, because it is
 * real data-viz rather than decoration: two lines, axes and hairline grid,
 * drawn in brand blue (with revision) against plain white at 30% (without).
 *
 * Layout is VERTICAL ONLY: panels stack on mobile and sit in a two-column
 * grid on desktop, where the opening panel, the chart panel and the closing
 * panel each span both columns. There is no horizontal carousel and nothing
 * swipes sideways.
 *
 * COPY IS FROZEN: every heading, panel line and attribution string here is
 * word-for-word what the founder approved. Changes to this file are design
 * only.
 */

interface PanelProps {
  t: LandingTokens;
}

/**
 * The forgetting curve, drawn as a clean scientific chart.
 *
 * Brand blue is memory held near the top by revision at days 1, 3, 7 and 14;
 * white at 30% is the same memory decaying without review (Ebbinghaus). No
 * character, no desk, no props — the diagram alone, responsive to whatever
 * width the panel gives it.
 *
 * EXPORTED because the chart is universal: the international landing branch
 * (LandingGlobalMarketing) reuses it under its own framing copy.
 */
export function ForgettingCurve({ t }: PanelProps) {
  const dayTicks: Array<{ x: number; label: string }> = [
    { x: 90, label: 'Day 1' },
    { x: 128, label: '3' },
    { x: 190, label: '7' },
    { x: 264, label: '14' },
  ];
  return (
    <svg
      viewBox="0 0 300 190"
      role="img"
      aria-label="Chart: memory retention falls steeply over time without revision, but stays high with spaced revision at days 1, 3, 7 and 14"
      style={{ width: '100%', display: 'block' }}
    >
      {/* Horizontal grid + percentage ticks */}
      {[
        { y: 20, label: '100%' },
        { y: 83, label: '50%' },
        { y: 146, label: '0%' },
      ].map((row) => (
        <g key={row.label}>
          <line x1={56} y1={row.y} x2={288} y2={row.y} stroke={CHART_GRID_LINE} strokeWidth={1} />
          <text x={50} y={row.y + 3} textAnchor="end" fontSize={8} fontWeight={700} fill={t.textSubtle}>
            {row.label}
          </text>
        </g>
      ))}

      {/* Day grid + ticks */}
      {dayTicks.map((tick) => (
        <g key={tick.label}>
          <line x1={tick.x} y1={20} x2={tick.x} y2={146} stroke={CHART_GRID_LINE} strokeWidth={1} strokeDasharray="3 4" />
          <line x1={tick.x} y1={146} x2={tick.x} y2={151} stroke={CHART_AXIS_LINE} strokeWidth={1.4} />
          <text x={tick.x} y={162} textAnchor="middle" fontSize={8} fontWeight={700} fill={t.textSubtle}>
            {tick.label}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line x1={56} y1={14} x2={56} y2={146} stroke={CHART_AXIS_LINE} strokeWidth={1.6} />
      <line x1={56} y1={146} x2={292} y2={146} stroke={CHART_AXIS_LINE} strokeWidth={1.6} />
      <text
        x={18}
        y={83}
        textAnchor="middle"
        transform="rotate(-90 18 83)"
        fontSize={9}
        fontWeight={800}
        letterSpacing="0.4"
        fill={t.textMuted}
      >
        Memory Retention
      </text>
      <text x={174} y={180} textAnchor="middle" fontSize={9} fontWeight={800} letterSpacing="0.4" fill={t.textMuted}>
        Time
      </text>

      {/* With spaced revision — each review lifts retention back to the top. */}
      <path
        className="lp-curve lp-curve-hold"
        d="M56 22 C70 34 78 40 90 41 L90 24 C104 33 114 37 128 38 L128 22 C150 29 168 33 190 34 L190 21 C226 26 258 27 288 27"
        fill="none"
        stroke={CHART_LINE_PRIMARY}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Without revision — exponential decay. */}
      <path
        className="lp-curve lp-curve-decay"
        d="M56 22 C74 74 92 104 128 120 C176 138 232 144 288 146"
        fill="none"
        stroke={CHART_LINE_MUTED}
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      {/* Legend — sits in the empty middle-right of the plot. */}
      <g>
        <line x1={186} y1={100} x2={202} y2={100} stroke={CHART_LINE_MUTED} strokeWidth={2.4} strokeLinecap="round" />
        <text x={208} y={103} fontSize={8.5} fontWeight={700} fill={t.textMuted}>
          No revision
        </text>
        <line x1={186} y1={116} x2={202} y2={116} stroke={CHART_LINE_PRIMARY} strokeWidth={2.6} strokeLinecap="round" />
        <text x={208} y={119} fontSize={8.5} fontWeight={700} fill={t.textMuted}>
          Spaced revision
        </text>
      </g>
    </svg>
  );
}

const PANELS: Array<{
  id: string;
  step: string;
  title: string;
  text: string;
  /** Spans both desktop columns — the opening beat, the chart and the answer. */
  wide?: boolean;
  /** Panel 02 carries the forgetting curve; every other panel is text only. */
  chart?: boolean;
}> = [
  {
    id: 'study-hard',
    step: '01',
    title: 'You study hard',
    text: 'You finish the chapter. Solve examples. Feel ready.',
    wide: true,
  },
  {
    id: 'day-3',
    step: '02',
    title: 'Day 3: 50% is already gone',
    text: 'The Ebbinghaus Forgetting Curve: within 3 days you forget 50% without review.',
    wide: true,
    chart: true,
  },
  {
    id: 'day-7',
    step: '03',
    title: 'Day 7: new lectures bury you',
    text: 'New chapters keep piling up. You never go back. Forgetting accelerates.',
  },
  {
    id: 'mock',
    step: '04',
    title: 'Mock test reveals the damage',
    text: 'You discover your gaps at mock time — too late to fix them.',
  },
  {
    id: 'spaced',
    step: '05',
    title: 'Science has the answer: Spaced Repetition',
    text: 'Review at Day 1, 3, 5, 7, 14 and memory moves to long-term. Top rankers do this.',
    wide: true,
  },
];

export default function LandingProblemPanels({ t }: PanelProps) {
  return (
    <section
      className="px-5 py-24 md:px-10 md:py-32"
      style={{ backgroundColor: t.sectionBg, borderTop: `1px solid ${GLASS_BORDER}` }}
      data-testid="section-problem"
    >
      <style>{`
        /* The forgetting curve draws itself in when the panel scrolls into
           view (.eg-revealed is added by the reveal observer in
           useEmailGateController). The resting state is the FULLY DRAWN curve,
           so a panel that never gets the class still shows a complete chart
           instead of an empty one. */
        .lp-curve { stroke-dasharray: 700; stroke-dashoffset: 0; }
        [data-testid="problem-panel-day-3"].eg-revealed .lp-curve {
          animation: lpCurveDraw 1.15s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        [data-testid="problem-panel-day-3"].eg-revealed .lp-curve-hold { animation-delay: 0.22s; }
        @keyframes lpCurveDraw { from { stroke-dashoffset: 700; } to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .lp-curve { stroke-dasharray: none; }
          [data-testid="problem-panel-day-3"].eg-revealed .lp-curve { animation: none; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-3xl text-center">
          <h2
            className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl md:text-[52px]"
            style={{ color: t.textPrimary, fontFamily: t.headingFont }}
          >
            Why students fail despite studying every day
          </h2>
        </div>

        {/* Vertical grid — stacked on mobile, two columns on desktop. */}
        <div className="mt-14 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 md:gap-5" data-testid="problem-panel-grid">
          {PANELS.map((panel, index) => (
            <article
              key={panel.id}
              data-reveal
              className={`flex flex-col rounded-2xl p-6 md:p-8 ${panel.wide ? 'md:col-span-2' : ''}`}
              style={{
                backgroundColor: GLASS_BG,
                border: `1px solid ${GLASS_BORDER}`,
                borderLeft: `2px solid ${CTA_BLUE}`,
                transitionDelay: `${(index % 2) * 80}ms`,
              }}
              data-testid={`problem-panel-${panel.id}`}
            >
              {/* Step number marker — carries the --c-accent token
                  (founder instruction, 2026-09-03). */}
              <span
                className="text-[28px] font-extrabold leading-none tracking-[-0.02em] md:text-[34px]"
                style={{ color: `var(--c-accent, ${LANDING_C_ACCENT})`, fontFamily: t.headingFont }}
              >
                {panel.step}
              </span>
              <h3
                className="mt-5 text-[20px] font-extrabold leading-tight tracking-[-0.02em] md:text-[26px]"
                style={{ color: t.textPrimary, fontFamily: t.headingFont }}
              >
                {panel.title}
              </h3>
              <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.7] sm:text-[15px]" style={{ color: t.textMuted }}>
                {panel.text}
              </p>

              {panel.chart && (
                <div
                  className="mx-auto mt-8 w-full max-w-2xl overflow-hidden rounded-2xl px-2 py-4"
                  style={{ backgroundColor: GLASS_BG_INSET, border: `1px solid ${GLASS_BORDER}` }}
                >
                  <ForgettingCurve t={t} />
                </div>
              )}
            </article>
          ))}
        </div>

        {/* Attribution strip — names only: no embeds, no links. */}
        <p
          data-reveal
          className="mx-auto mt-12 max-w-3xl rounded-2xl px-6 py-5 text-center text-[14px] leading-relaxed sm:text-sm"
          style={{ border: `1px solid ${GLASS_BORDER}`, backgroundColor: GLASS_BG, color: t.textMuted }}
          data-testid="problem-attribution"
        >
          Ali Abdaal (6.8M subscribers) and Ishan Sharma have made videos on spaced repetition — it works.
        </p>

        <p
          data-reveal
          className="mx-auto mt-16 max-w-3xl text-center text-xl font-bold leading-snug tracking-[-0.02em] md:text-3xl"
          style={{ color: t.textPrimary, fontFamily: t.headingFont }}
        >
          {t.brandName} runs spaced revision for you — silently, in the background.
        </p>
      </div>
    </section>
  );
}
