import type { LandingTokens } from './landingTokens';
import {
  CHART_AXIS_LINE,
  CHART_GRID_LINE,
  LANDING_ACCENT,
  LANDING_EDGE_CARD_STYLE,
  withAlpha,
} from './landingTokens';

/**
 * SECTION 2 VISUAL — the forgetting curve, as flat 2D data-viz.
 *
 * Two lines only: what happens to material you never come back to (red,
 * falling away within days) and what happens when the revision is scheduled
 * for you (accent, held near the top). Both draw themselves in when the
 * section scrolls into view.
 *
 * The labels arrive as `copy` from the region config, because the US market
 * calls this “review” and the UK calls the unit a “module”. The chart itself
 * is identical everywhere — the science does not vary by market.
 *
 * HOW THE DRAW-IN WORKS: the reveal observer in useEmailGateController adds
 * .eg-revealed to any [data-reveal] element entering the scroll container, so
 * the animation is keyed off that class rather than a second observer. The
 * RESTING state is the fully drawn chart — if the class never arrives (no
 * IntersectionObserver, reduced motion) the reader still sees a complete
 * chart instead of an empty well.
 */

export default function LandingRetentionChart({
  t,
  copy,
}: {
  t: LandingTokens;
  copy: { ariaLabel: string; yAxis: string; xAxis: string; legendWithout: string };
}) {
  const decay = t.toneDanger;
  return (
    <div
      data-reveal
      data-testid="chart-forgetting-curve"
      className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl px-2 py-5 sm:px-4"
      style={LANDING_EDGE_CARD_STYLE}
    >
      <style>{`
        [data-testid="chart-forgetting-curve"] .lr-line { stroke-dasharray: 640; stroke-dashoffset: 0; }
        [data-testid="chart-forgetting-curve"].eg-revealed .lr-line {
          animation: lrDraw 1.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        [data-testid="chart-forgetting-curve"].eg-revealed .lr-line-hold { animation-delay: 0.35s; }
        @keyframes lrDraw { from { stroke-dashoffset: 640; } to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="chart-forgetting-curve"] .lr-line { stroke-dasharray: none; }
          [data-testid="chart-forgetting-curve"].eg-revealed .lr-line { animation: none; }
        }
      `}</style>

      <svg
        viewBox="0 0 320 196"
        role="img"
        aria-label={copy.ariaLabel}
        style={{ width: '100%', display: 'block' }}
      >
        {/* Percentage grid */}
        {[
          { y: 22, label: '100%' },
          { y: 84, label: '50%' },
          { y: 146, label: '0%' },
        ].map((row) => (
          <g key={row.label}>
            <line x1={52} y1={row.y} x2={308} y2={row.y} stroke={CHART_GRID_LINE} strokeWidth={1} />
            <text x={46} y={row.y + 3} textAnchor="end" fontSize={8} fontWeight={700} fill={t.textSubtle}>
              {row.label}
            </text>
          </g>
        ))}

        {/* Day ticks — the days a revision is scheduled for. */}
        {[
          { x: 88, label: 'Day 1' },
          { x: 130, label: '3' },
          { x: 196, label: '7' },
          { x: 276, label: '14' },
        ].map((tick) => (
          <g key={tick.label}>
            <line x1={tick.x} y1={22} x2={tick.x} y2={146} stroke={CHART_GRID_LINE} strokeWidth={1} strokeDasharray="3 4" />
            <line x1={tick.x} y1={146} x2={tick.x} y2={151} stroke={CHART_AXIS_LINE} strokeWidth={1.4} />
            <text x={tick.x} y={163} textAnchor="middle" fontSize={8} fontWeight={700} fill={t.textSubtle}>
              {tick.label}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line x1={52} y1={16} x2={52} y2={146} stroke={CHART_AXIS_LINE} strokeWidth={1.6} />
        <line x1={52} y1={146} x2={312} y2={146} stroke={CHART_AXIS_LINE} strokeWidth={1.6} />
        <text
          x={16}
          y={84}
          textAnchor="middle"
          transform="rotate(-90 16 84)"
          fontSize={9}
          fontWeight={800}
          letterSpacing="0.4"
          fill={t.textMuted}
        >
          {copy.yAxis}
        </text>
        <text x={182} y={182} textAnchor="middle" fontSize={9} fontWeight={800} letterSpacing="0.4" fill={t.textMuted}>
          {copy.xAxis}
        </text>

        {/* With VicharakAI — each scheduled review lifts recall back to the top. */}
        <path
          className="lr-line lr-line-hold"
          d="M52 24 C66 36 76 41 88 42 L88 25 C104 34 116 38 130 39 L130 24 C154 31 174 34 196 35 L196 23 C232 28 258 30 276 30 L276 22 C290 25 300 26 308 27"
          fill="none"
          stroke={LANDING_ACCENT}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Without review — it falls away in the first week. */}
        <path
          className="lr-line"
          d="M52 24 C72 78 92 108 130 122 C180 140 244 145 308 146"
          fill="none"
          stroke={decay}
          strokeWidth={2.4}
          strokeLinecap="round"
        />

        {/* Legend */}
        <g>
          <line x1={186} y1={98} x2={202} y2={98} stroke={decay} strokeWidth={2.4} strokeLinecap="round" />
          <text x={208} y={101} fontSize={8.5} fontWeight={700} fill={t.textMuted}>
            {copy.legendWithout}
          </text>
          <line x1={186} y1={114} x2={202} y2={114} stroke={LANDING_ACCENT} strokeWidth={2.6} strokeLinecap="round" />
          <text x={208} y={117} fontSize={8.5} fontWeight={700} fill={t.textMuted}>
            With {t.brandName}
          </text>
        </g>

        {/* The four review marks, so the lift has a visible cause. */}
        {[88, 130, 196, 276].map((x) => (
          <circle
            key={x}
            cx={x}
            cy={x === 88 ? 25 : x === 130 ? 24 : x === 196 ? 23 : 22}
            r={2.6}
            fill={LANDING_ACCENT}
            stroke={withAlpha(LANDING_ACCENT, 0.3)}
            strokeWidth={3}
          />
        ))}
      </svg>
    </div>
  );
}
