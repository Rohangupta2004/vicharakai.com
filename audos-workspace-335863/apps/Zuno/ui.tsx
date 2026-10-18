/**
 * Shared presentational pieces for the VicharakAI app. Everything here is dumb — no
 * data access, no effects — so the tab files stay about behaviour.
 */
import type { CSSProperties, ReactNode } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronUp, Crown, HelpCircle, Home, MessageCircle, Sparkles, User, Wrench } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  CARD_SHADOW,
  GLASS_BG,
  NAVY,
  ON_AMBER,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  subjectTint,
  tint,
} from './theme';
import { planDetail, planHeadline, type AiAccess } from './access';

export type VicharakTab = 'today' | 'calendar' | 'doubts' | 'coach' | 'dashboard' | 'tools' | 'profile';

export const VICHARAK_TABS: VicharakTab[] = ['today', 'calendar', 'doubts', 'coach', 'dashboard', 'tools', 'profile'];

export const VICHARAK_NAV_TARGET_KEY = 'vicharak_nav_target';

/** Consume a tab request left in storage by an older build or a deep link. */
export function consumeRequestedTab(): VicharakTab | null {
  try {
    const v = localStorage.getItem(VICHARAK_NAV_TARGET_KEY);
    if (!v) return null;
    localStorage.removeItem(VICHARAK_NAV_TARGET_KEY);
    // Pre-rename ids from older builds: the dashboard is a nav tab again.
    if (v === 'progress') return 'dashboard';
    return (VICHARAK_TABS as string[]).includes(v) ? (v as VicharakTab) : null;
  } catch {
    return null;
  }
}

/* ---------- surfaces ---------- */

/** The standard navy card. `radius` follows the 16–20px card language. */
export function cardStyle(radius: number = RADIUS.lg, extra?: CSSProperties): CSSProperties {
  return {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: radius,
    boxShadow: CARD_SHADOW,
    ...extra,
  };
}

export function Card({
  children,
  radius = RADIUS.lg,
  className = '',
  style,
  testId,
}: {
  children: ReactNode;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  return (
    <section className={className} style={cardStyle(radius, style)} data-testid={testId}>
      {children}
    </section>
  );
}

/** Small uppercase section kicker. */
export function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p
      className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] mb-3"
      style={{ color: TEXT_MUTED }}
    >
      {icon}
      {children}
    </p>
  );
}

/* ---------- expandable lists (CHANGE 11) ---------- */

/**
 * The "Show X more ▾ / Show less ▴" toggle used under every truncated list
 * (active tasks, completed tasks, question revision, syllabus, weak chapters).
 * Callers slice their own arrays; this just renders the animated toggle row.
 */
export function ShowMoreToggle({
  hiddenCount,
  expanded,
  onToggle,
  noun = 'more',
  testId,
}: {
  /** How many rows are hidden while collapsed. */
  hiddenCount: number;
  expanded: boolean;
  onToggle: () => void;
  /** e.g. "more", "completed" — renders as "Show 4 more" / "Show 3 completed". */
  noun?: string;
  testId?: string;
}) {
  if (!expanded && hiddenCount <= 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-extrabold transition-all touch-manipulation"
      style={{ color: TEXT_MUTED }}
      data-testid={testId}
    >
      {expanded ? (
        <>
          Show less
          <ChevronUp className="w-3.5 h-3.5" />
        </>
      ) : (
        <>
          Show {hiddenCount} {noun}
          <ChevronDown className="w-3.5 h-3.5" />
        </>
      )}
    </button>
  );
}

/* ---------- chips ---------- */

export function Chip({
  children,
  color = TEXT_SECONDARY,
  bg,
  onClick,
  ariaLabel,
  testId,
  strong,
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
  onClick?: () => void;
  ariaLabel?: string;
  testId?: string;
  strong?: boolean;
}) {
  const style: CSSProperties = {
    color,
    background: bg ?? tint(color, 0.13),
    border: `1px solid ${strong ? tint(color, 0.45) : 'transparent'}`,
    borderRadius: RADIUS.chip,
  };
  const className =
    'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold flex-shrink-0 whitespace-nowrap';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${className} transition-transform hover:-translate-y-px touch-manipulation`}
        style={style}
        data-testid={testId}
      >
        {children}
      </button>
    );
  }
  return (
    <span className={className} style={style} data-testid={testId}>
      {children}
    </span>
  );
}

/** Coloured dot for a subject — the app's consistent subject signal. */
export function SubjectDot({ subject, size = 8 }: { subject: string; size?: number }) {
  return (
    <span
      className="rounded-full flex-shrink-0 inline-block"
      style={{ width: size, height: size, background: subjectColor(subject) }}
      aria-hidden="true"
    />
  );
}

export function SubjectChip({ subject }: { subject: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold flex-shrink-0"
      style={{
        color: subjectColor(subject),
        background: subjectTint(subject),
        borderRadius: RADIUS.chip,
      }}
    >
      <SubjectDot subject={subject} size={6} />
      {subject}
    </span>
  );
}

/* ---------- VicharakAI's face ---------- */

/** VicharakAI's identity: a glowing electric-blue orb, not mascot art. */
export function VicharakAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 32 : size === 'lg' ? 56 : 40;
  const icon = size === 'sm' ? 16 : size === 'lg' ? 26 : 20;
  return (
    <span
      className="flex items-center justify-center flex-shrink-0 rounded-full"
      style={{
        width: box,
        height: box,
        background: BRAND_GRADIENT,
        color: ON_AMBER,
        boxShadow: '0 4px 14px rgba(0,87,255,0.35)',
      }}
      aria-hidden="true"
    >
      <Sparkles style={{ width: icon, height: icon }} />
    </span>
  );
}

/* ---------- plan ---------- */

/**
 * The quiet plan line on Today: a trial countdown while the trial runs, and a
 * warm free-tier note afterwards. Pro students get nothing here — there is
 * nothing to tell them.
 */
export function PlanBanner({ access, onUpgrade }: { access: AiAccess; onUpgrade: () => void }) {
  if (access.tier === 'pro') return null;
  const trial = access.tier === 'trial';
  const accent = trial ? AMBER : TEXT_SECONDARY;
  const Icon = trial ? Sparkles : MessageCircle;
  return (
    <section
      className="mt-6 flex items-center gap-3 px-4 py-3 vicharak-rise"
      style={{
        background: tint(accent, 0.09),
        border: `1px solid ${tint(accent, 0.28)}`,
        borderRadius: RADIUS.md,
      }}
      data-testid="banner-plan"
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold" style={{ color: accent }} data-testid="text-plan-headline">
          {planHeadline(access)}
        </p>
        <p className="text-[11px] leading-snug" style={{ color: TEXT_MUTED }}>
          {planDetail(access)}
        </p>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        className="px-2.5 py-1 text-[10px] font-extrabold flex-shrink-0"
        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
        data-testid="button-plan-upgrade"
      >
        Go Pro
      </button>
    </section>
  );
}

/** Shown in place of nothing — above the composer — once the day's free AI is spent. */
export function AiLimitNotice({
  message,
  priceLine,
  onUpgrade,
}: {
  message: string;
  priceLine: string;
  onUpgrade: () => void;
}) {
  return (
    <div
      className="p-4 vicharak-rise"
      style={{
        borderRadius: RADIUS.hero,
        background: CARD,
        border: `1px solid ${tint(AMBER, 0.35)}`,
        boxShadow: CARD_SHADOW,
      }}
      data-testid="notice-ai-limit"
    >
      <div className="flex items-start gap-3">
        <VicharakAvatar size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: TEXT }}>
            {message}
          </p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: TEXT_MUTED }}>
            The quick questions above still work, free — and your plan, streak, calendar and dashboard are never
            limited.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-3 w-full py-2.5 text-sm font-extrabold inline-flex items-center justify-center gap-2"
        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
        data-testid="button-open-upgrade"
      >
        <Crown className="w-4 h-4" />
        {priceLine}
      </button>
    </div>
  );
}

/* ---------- charts (hand-rolled SVG, no chart dependency) ---------- */

/** Overall-progress ring for the Dashboard. */
export function ProgressRing({ percent, size = 132 }: { percent: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% of syllabus covered`}>
      <defs>
        <linearGradient id="vicharakRingGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--vicharak-amber)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--vicharak-orange)' }} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: BORDER }} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#vicharakRingGradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
      />
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: TEXT, fontSize: size * 0.24, fontWeight: 800 }}
      >
        {clamped}%
      </text>
      <text
        x="50%"
        y="66%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: TEXT_MUTED, fontSize: size * 0.085, fontWeight: 700, letterSpacing: 1 }}
      >
        COVERED
      </text>
    </svg>
  );
}

/** Accuracy trend line. */
export function TrendChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const W = 320;
  const H = 120;
  const PAD = 14;
  if (points.length === 0) return null;
  const xs = points.map((_, i) => (points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1)));
  const ys = points.map((p) => H - PAD - (Math.max(0, Math.min(100, p.value)) / 100) * (H - PAD * 2));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Accuracy trend">
      {[25, 50, 75].map((g) => {
        const y = H - PAD - (g / 100) * (H - PAD * 2);
        return <line key={g} x1={PAD} x2={W - PAD} y1={y} y2={y} strokeDasharray="3 4" strokeWidth="1" style={{ stroke: BORDER }} />;
      })}
      <path d={path} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: AMBER }} />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="3.5" strokeWidth="1.5" style={{ fill: AMBER, stroke: NAVY }} />
      ))}
    </svg>
  );
}

/** One horizontal bar row — used for subject-wise performance and coverage. */
export function BarRow({
  label,
  percent,
  color,
  right,
}: {
  label: string;
  percent: number;
  color: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold w-24 flex-shrink-0 truncate" style={{ color: TEXT_SECONDARY }}>
        {label}
      </span>
      <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: BORDER }}>
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color, transition: 'width 0.7s ease-out' }}
        />
      </span>
      <span className="text-[11px] font-bold text-right flex-shrink-0" style={{ color: TEXT_MUTED, minWidth: 42 }}>
        {right ?? `${percent}%`}
      </span>
    </div>
  );
}

/* ---------- bottom navigation ---------- */

/** Today · Study Calendar · Doubts · Dashboard · Tools · Profile. Tasks are
 * added via the floating '+' button and the daily check-in; the AI coach
 * opens from the floating AI button. Timer, Weightage, Road View and
 * Syllabus live under Tools. */
const TABS: Array<{ id: VicharakTab; label: string; Icon: typeof Home }> = [
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'doubts', label: 'Doubts', Icon: HelpCircle },
  { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
  { id: 'tools', label: 'Tools', Icon: Wrench },
  { id: 'profile', label: 'Profile', Icon: User },
];

/** The always-visible bar: Today · Calendar · Doubts · Dashboard · Tools ·
 * Profile. The Calendar tab opens the Study Calendar; the Doubts tab is the
 * student's question bank; the AI coach opens from the floating AI button.
 * No strips or rows ever float above the pill — the two FABs rendered by
 * App.tsx are the only floating elements in the app (CHANGE 9). */
export function VicharakBottomNav({
  active,
  onSelect,
  language = 'english',
}: {
  active: VicharakTab;
  onSelect: (tab: VicharakTab) => void;
  language?: 'english' | 'hindi' | 'hinglish';
}) {
  return (
    <nav
      className="sticky z-30 flex-shrink-0 px-4 pt-2"
      style={{
        background: 'transparent',
        bottom: 0,
        // The pill always floats clear of the device edge — never glued to it.
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
      }}
      aria-label="VicharakAI navigation"
    >
      <div
        className="flex items-stretch justify-between px-1.5 py-1.5 backdrop-blur-md"
        style={{
          borderRadius: 22,
          border: `1px solid ${BORDER_STRONG}`,
          background: GLASS_BG,
          boxShadow: CARD_SHADOW,
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const localizedLabel = language === 'hindi'
            ? (({ today: 'आज', calendar: 'कैलेंडर', doubts: 'शंकाएँ', dashboard: 'डैशबोर्ड', tools: 'टूल्स', profile: 'प्रोफ़ाइल' } as Record<string, string>)[id] ?? label)
            : language === 'hinglish'
              ? (({ today: 'Aaj', calendar: 'Calendar', doubts: 'Doubts', dashboard: 'Dashboard', tools: 'Tools', profile: 'Profile' } as Record<string, string>)[id] ?? label)
              : label;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-label={localizedLabel}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1 py-1.5 transition-all touch-manipulation"
              style={
                isActive
                  ? {
                      borderRadius: 16,
                      background: BRAND_GRADIENT,
                      color: ON_AMBER,
                      boxShadow: '0 4px 14px rgba(0,87,255,0.32)',
                    }
                  : { borderRadius: 16, color: TEXT_MUTED }
              }
              data-testid={`nav-${id}`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-extrabold leading-none">{localizedLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
