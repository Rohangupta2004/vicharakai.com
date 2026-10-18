/**
 * Shared presentational pieces for the VicharakAI app. Everything here is dumb — no
 * data access, no effects — so the tab files stay about behaviour.
 */
import { memo, useState, type CSSProperties, type ReactNode } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronUp, Compass, Crown, Database, Home, LineChart, MessageCircle, NotebookPen, Plus, Sparkles, Trophy, User, Wrench } from 'lucide-react';
import {
  BRAND,
  BRAND_WASH,
  F_BODY,
  F_HEAD,
  INK,
  INK_SOFT,
  KEPT,
  ON_AMBER,
  PAPER,
  PENCIL,
  RADIUS,
  RULE,
  RULE_SOFT,
  SHEET,
  subjectColor,
  tint,
} from './theme';
import { planDetail, planHeadline, type AiAccess } from './access';
import { VicharreeGemIcon } from './components/VicharreeCharacter';

export type VicharakTab = 'today' | 'calendar' | 'doubts' | 'practice' | 'analysis' | 'scores' | 'coach' | 'dashboard' | 'vision' | 'tools' | 'premium' | 'profile' | 'pyqadmin';

export const VICHARAK_TABS: VicharakTab[] = ['today', 'calendar', 'doubts', 'practice', 'analysis', 'scores', 'coach', 'dashboard', 'vision', 'tools', 'premium', 'profile', 'pyqadmin'];

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

/** A content panel: white sheet, one hairline rule, one radius, no shadow. */
export function cardStyle(radius: number = RADIUS.lg, extra?: CSSProperties): CSSProperties {
  return {
    background: SHEET,
    border: `1px solid ${RULE}`,
    borderRadius: radius,
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

/** Section heading — sentence case, body face. Never all-caps. */
export function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p
      className="flex items-center gap-1.5 mb-2.5"
      style={{ fontFamily: F_BODY, fontSize: '1rem', fontWeight: 600, color: INK }}
    >
      {icon}
      {children}
    </p>
  );
}

/* ---------- the notebook hand ---------- */

/**
 * The pen stroke under a page title. Drawn, not a border — it is the one
 * decorative mark the design allows, and it is the only place --brand is
 * used without something to tap.
 */
export function PenUnderline({ width = 104, className = '' }: { width?: number; className?: string }) {
  return (
    <svg
      width={width}
      height="6"
      viewBox="0 0 104 6"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ display: 'block', opacity: 0.55 }}
    >
      <path
        d="M1.5 4.1C16 2.1 33 1.3 51 2.1c18 .8 35 2.4 51.5 1.4"
        stroke={BRAND}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The one checkbox in the app: 19px, hand-cut corners, a degree off square,
 * and a tick that draws itself in --kept rather than appearing.
 */
export function TaskBox({ done, dense, busy }: { done?: boolean; dense?: boolean; busy?: boolean }) {
  return (
    <span
      className={`vicharak-box${dense ? ' vicharak-box-dense' : ''}${done ? ' vicharak-box-done' : ''}`}
      style={busy ? { opacity: 0.5 } : undefined}
      aria-hidden="true"
    >
      {done && (
        <svg viewBox="0 0 20 20" width="13" height="13" style={{ transform: 'rotate(1deg)' }}>
          <path className="vicharak-tick" d="M4 10.6 L8.1 14.6 L16 5.4" />
        </svg>
      )}
    </span>
  );
}

/** The app writing in the margin: one short honest line, no box, no art. */
export function EmptyLine({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="vicharak-empty" data-testid={testId}>
      {children}
    </p>
  );
}

/* ---------- expandable lists ---------- */

/**
 * The "Show X more / Show less" toggle used under a truncated list.
 * Callers slice their own arrays; this just renders the toggle row.
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
      className="w-full flex items-center justify-center gap-1.5 py-2.5 touch-manipulation"
      style={{ fontFamily: F_BODY, fontSize: '0.78rem', fontWeight: 600, color: INK_SOFT }}
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

/**
 * A pill. Outline by default; the selected one fills with ink. `color` only
 * ever tints the leading dot — a chip never carries a status colour.
 */
export function Chip({
  children,
  color,
  onClick,
  ariaLabel,
  testId,
  selected,
  strong,
}: {
  children: ReactNode;
  /** Draws a 6px dot in this colour — subject identity only. */
  color?: string;
  onClick?: () => void;
  ariaLabel?: string;
  testId?: string;
  selected?: boolean;
  /** Legacy caller flag from the old chip: now just means "selected". */
  strong?: boolean;
  /** Legacy caller prop — chips no longer carry their own fill. */
  bg?: string;
}) {
  const isOn = selected ?? strong ?? false;
  const className = `vicharak-chip${isOn ? ' vicharak-chip-on' : ''} flex-shrink-0`;
  const body = (
    <>
      {color && (
        <span
          className="rounded-full flex-shrink-0"
          style={{ width: 6, height: 6, background: color }}
          aria-hidden="true"
        />
      )}
      {children}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={isOn}
        className={`${className} touch-manipulation`}
        style={{ minHeight: 30 }}
        data-testid={testId}
      >
        {body}
      </button>
    );
  }
  return (
    <span className={className} data-testid={testId}>
      {body}
    </span>
  );
}

/** Coloured dot for a subject — the app's consistent subject signal. */
export function SubjectDot({ subject, size = 6 }: { subject: string; size?: number }) {
  return (
    <span
      className="rounded-full flex-shrink-0 inline-block"
      style={{ width: size, height: size, background: subjectColor(subject) }}
      aria-hidden="true"
    />
  );
}

export function SubjectChip({ subject, selected }: { subject: string; selected?: boolean }) {
  return (
    <Chip color={subjectColor(subject)} selected={selected}>
      {subject}
    </Chip>
  );
}

/* ---------- VicharakAI's face ---------- */

/** The brand logo shipped in workspace-branding.json. */
export const VICHARAK_LOGO_URL =
  'https://storage.googleapis.com/audos-images/chat-attachments/26649289-cffa-4dec-b6f1-3eb7da1ea96f.png';

/**
 * The brand mark itself — the VicharakAI logo. If the hosted image ever
 * fails to load the mark falls back to a styled 'V', so the button it sits
 * in is never blank.
 */
export function VicharakLogoMark({ size = 28, fallbackColor = ON_AMBER }: { size?: number; fallbackColor?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="flex items-center justify-center flex-shrink-0 leading-none"
        style={{ width: size, height: size, fontFamily: F_HEAD, fontSize: size * 0.72, fontWeight: 800, color: fallbackColor }}
        aria-hidden="true"
      >
        V
      </span>
    );
  }
  return (
    <img
      src={VICHARAK_LOGO_URL}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="flex-shrink-0 object-contain"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** VicharakAI's identity: a flat brand disc. No gradient, no glow. */
export function VicharakAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 30 : size === 'lg' ? 48 : 36;
  const icon = size === 'sm' ? 15 : size === 'lg' ? 22 : 18;
  return (
    <span
      className="flex items-center justify-center flex-shrink-0 rounded-full"
      style={{ width: box, height: box, background: BRAND, color: '#fff' }}
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
  // AccessTier is 'pro' | 'locked' since the trial moved to accessStatus —
  // the cast keeps this legacy (currently unmounted) banner compiling.
  const trial = (access.tier as string) === 'trial';
  const Icon = trial ? Sparkles : MessageCircle;
  return (
    <section
      className="mt-5 flex items-center gap-3 px-3.5 py-3"
      style={{ background: SHEET, border: `1px solid ${RULE}`, borderRadius: RADIUS.md }}
      data-testid="banner-plan"
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: INK_SOFT }} />
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: '0.86rem', fontWeight: 600, color: INK }} data-testid="text-plan-headline">
          {planHeadline(access)}
        </p>
        <p className="leading-snug" style={{ fontSize: '0.78rem', color: INK_SOFT }}>
          {planDetail(access)}
        </p>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        className="vicharak-btn vicharak-btn-primary flex-shrink-0"
        data-testid="button-plan-upgrade"
      >
        Go pro
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
      className="p-4"
      style={{ borderRadius: RADIUS.md, background: SHEET, border: `1px solid ${RULE}` }}
      data-testid="notice-ai-limit"
    >
      <div className="flex items-start gap-3">
        <VicharakAvatar size="sm" />
        <div className="min-w-0">
          <p className="leading-snug" style={{ fontSize: '0.95rem', fontWeight: 600, color: INK }}>
            {message}
          </p>
          <p className="mt-1 leading-relaxed" style={{ fontSize: '0.8rem', color: INK_SOFT }}>
            The quick questions above still work, free — and your plan, streak, calendar and dashboard are never
            limited.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        className="vicharak-btn vicharak-btn-primary mt-3 w-full"
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
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% of syllabus covered`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: RULE_SOFT }} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ stroke: KEPT, transition: 'stroke-dasharray 0.8s ease-out' }}
      />
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: INK, fontFamily: 'var(--f-head)', fontSize: size * 0.24, fontWeight: 800 }}
      >
        {clamped}%
      </text>
      <text
        x="50%"
        y="67%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: INK_SOFT, fontFamily: 'var(--f-body)', fontSize: size * 0.09, fontWeight: 600 }}
      >
        covered
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
        return <line key={g} x1={PAD} x2={W - PAD} y1={y} y2={y} strokeWidth="1" style={{ stroke: RULE_SOFT }} />;
      })}
      <path d={path} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: INK }} />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="2.8" style={{ fill: INK }} />
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
      <span className="w-24 flex-shrink-0 truncate" style={{ fontSize: '0.8rem', fontWeight: 500, color: INK_SOFT }}>
        {label}
      </span>
      <span className="flex-1 h-1.5 overflow-hidden" style={{ background: RULE_SOFT, borderRadius: 2 }}>
        <span
          className="block h-full"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color, borderRadius: 2, transition: 'width 0.7s ease-out' }}
        />
      </span>
      <span className="text-right flex-shrink-0 tabular-nums" style={{ fontSize: '0.78rem', fontWeight: 600, color: INK_SOFT, minWidth: 42 }}>
        {right ?? `${percent}%`}
      </span>
    </div>
  );
}

/* ---------- desktop sidebar ---------- */

/**
 * THE FOUR PRIMARY DESTINATIONS (founder instruction, 2026-09-30): on desktop
 * (≥768px) the mobile top tab bar is replaced by this left sidebar, and its
 * first group is EXACTLY those four tabs — same icons, same labels, listed
 * vertically. 'coach' renders the Vicharree gem icon, exactly as the tab did.
 *
 * PRACTICE IS NOT A DESTINATION (task #144724). The 'practice' SCREEN and its
 * deep links are untouched — it simply has no nav entry.
 */
const SIDEBAR_PRIMARY: Array<{ id: VicharakTab; label: string; Icon: typeof Home | null }> = [
  { id: 'coach', label: 'Vicharee', Icon: null },
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'analysis', label: 'Analysis', Icon: LineChart },
  { id: 'vision', label: 'Vision Board', Icon: Compass },
];

/** Every other destination, under a hairline divider — desktop keeps the
 * full map of the app even though the four tabs above lead. */
const SIDEBAR_SECONDARY: Array<{ id: VicharakTab; label: string; Icon: typeof Home }> = [
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'doubts', label: 'Mistake book', Icon: NotebookPen },
  { id: 'scores', label: 'Test scores', Icon: Trophy },
  { id: 'dashboard', label: 'Progress', Icon: BarChart3 },
  { id: 'tools', label: 'Tools', Icon: Wrench },
  { id: 'premium', label: 'VicharakAI Premium', Icon: Crown },
  { id: 'profile', label: 'Profile', Icon: User },
];

/** Admin-only destination — appended when the caller says the viewer is an admin. */
const PYQ_ADMIN_ITEM: { id: VicharakTab; label: string; Icon: typeof Home } = {
  id: 'pyqadmin',
  label: 'PYQ Admin',
  Icon: Database,
};

/**
 * Desktop-only left rail (≥768px, CSS media classes — no JS layout switch):
 * text links on paper — no pills, no fill. The active one carries an inset
 * brand rule under it. The four primary tabs (Vicharee · Today · Analysis ·
 * Vision Board) lead, exactly as the mobile top tab bar orders them; the
 * remaining destinations sit under a hairline divider. The bottom bar takes
 * over below the md breakpoint — exactly one navigation surface at any width.
 * Sticky left panel, never an overlay.
 */
export const VicharakSidebar = memo(function VicharakSidebar({
  active,
  onSelect,
  showPyqAdmin = false,
  vicharreeUnread = false,
}: {
  active: VicharakTab;
  onSelect: (tab: VicharakTab) => void;
  /** Admin-only: appends the PYQ Admin destination. */
  showPyqAdmin?: boolean;
  /** Dot badge on the Vicharree item while the chat holds an unseen message. */
  vicharreeUnread?: boolean;
}) {
  const secondary = showPyqAdmin ? [...SIDEBAR_SECONDARY, PYQ_ADMIN_ITEM] : SIDEBAR_SECONDARY;
  const renderItem = ({ id, label, Icon }: { id: VicharakTab; label: string; Icon: typeof Home | null }) => {
    const isActive = active === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={`vicharak-navlink${isActive ? ' vicharak-navlink-on' : ''} flex items-center gap-2.5 py-2.5 touch-manipulation`}
        style={{ fontFamily: F_BODY, fontSize: '0.88rem' }}
        data-testid={`sidenav-${id}`}
      >
        {id === 'coach' ? (
          <span className="relative flex-shrink-0 inline-flex" style={{ width: 18, height: 18 }} aria-hidden="true">
            <VicharreeGemIcon size={18} />
            {vicharreeUnread && (
              <span
                className="absolute rounded-full"
                style={{ top: -2, right: -2, width: 7, height: 7, background: '#0057FF', boxShadow: '0 0 4px #0057FF' }}
              />
            )}
          </span>
        ) : Icon ? (
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? BRAND : 'currentColor' }} />
        ) : null}
        {label}
      </button>
    );
  };
  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 w-52 px-4 py-6 gap-0.5 md:sticky md:top-0 md:self-start"
      style={{ background: PAPER, borderRight: `1px solid ${RULE}` }}
      aria-label="VicharakAI navigation"
      data-testid="sidebar-nav"
    >
      <div className="flex items-center gap-2.5 pb-6">
        <VicharakAvatar size="sm" />
        <span style={{ fontFamily: F_HEAD, fontSize: '1.05rem', fontWeight: 800, color: INK }}>VicharakAI</span>
      </div>
      {SIDEBAR_PRIMARY.map(renderItem)}
      <div className="my-3 flex-shrink-0" style={{ height: 1, background: RULE_SOFT }} aria-hidden="true" />
      {secondary.map(renderItem)}
    </aside>
  );
});

/* ---------- bottom navigation ---------- */

/**
 * SIX destinations (2026-09-27). The bar once carried eight labelled tabs
 * plus the '+' — nine targets across a 360px phone — and was cut to five;
 * TEST ANALYSIS then came back as its own tab on founder request: logging a
 * mock and seeing WHY marks were lost is a core loop, and burying it behind
 * Profile → quick links read as "the feature was removed". Mistakes,
 * Practice, Test scores and Tools stay on the Profile quick-links list; the
 * sidebar still shows everything on desktop.
 *
 * THE VISION BOARD IS DELIBERATELY NOT HERE. Six tabs plus the '+' already
 * fill a 360px phone at the 44px minimum touch target this app enforces, so a
 * seventh would push the last destination off the bar. It sits on the desktop
 * sidebar, on a hero card at the top of Progress, in the Tools grid and on
 * the Profile quick-links list instead.
 */
const TABS: Array<{ id: VicharakTab; label: string; Icon: typeof Home }> = [
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'calendar', label: 'Revision', Icon: CalendarDays },
  { id: 'analysis', label: 'Tests', Icon: LineChart },
  { id: 'dashboard', label: 'Progress', Icon: BarChart3 },
  { id: 'premium', label: 'Premium', Icon: Crown },
  { id: 'profile', label: 'Profile', Icon: User },
];

/**
 * Mobile bottom bar — a compact DARK strip (#0A0F1A, founder instruction
 * 2026-09-30). Inactive items sit muted at rgba(255,255,255,0.4); only the
 * active one reads bright white, with a small white bar above its icon. The
 * '+' at its centre is the one add-task entry point.
 */
export const VicharakBottomNav = memo(function VicharakBottomNav({
  active,
  onSelect,
  onAddTask,
  language = 'english',
}: {
  active: VicharakTab;
  onSelect: (tab: VicharakTab) => void;
  /** When provided, an inline '+' add-task button sits at the bar's centre. */
  onAddTask?: () => void;
  language?: 'english' | 'hindi' | 'hinglish';
}) {
  const renderTab = ({ id, label, Icon }: { id: VicharakTab; label: string; Icon: typeof Home }) => {
    const isActive = active === id;
    const hindi: Record<string, string> = {
      today: 'आज', calendar: 'रिवीजन', analysis: 'टेस्ट', dashboard: 'प्रगति',
      premium: 'प्रीमियम', profile: 'प्रोफ़ाइल',
    };
    const isHindi = language === 'hindi';
    const localizedLabel = isHindi ? hindi[id] ?? label : label;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        aria-label={localizedLabel}
        aria-current={isActive ? 'page' : undefined}
        className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 touch-manipulation"
        style={{ minHeight: 44, color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.4)' }}
        data-testid={`nav-${id}`}
      >
        {/* Active-state indicator — a small brand bar above the icon, so the
            current tab reads instantly even before the colour registers. */}
        <span
          aria-hidden="true"
          style={{ width: 18, height: 2, borderRadius: 999, background: isActive ? '#FFFFFF' : 'transparent', transition: 'background 0.2s ease' }}
        />
        <Icon className="w-[18px] h-[18px]" />
        <span
          lang={isHindi ? 'hi' : undefined}
          className="w-full text-center leading-[1.1] truncate"
          style={{ fontFamily: F_BODY, fontSize: isHindi ? '0.7rem' : '0.75rem', fontWeight: isActive ? 600 : 500 }}
        >
          {localizedLabel}
        </span>
      </button>
    );
  };

  return (
    <nav
      className="sticky z-30 flex-shrink-0 flex items-stretch justify-between px-2 pt-0.5 md:hidden"
      style={{
        bottom: 0,
        background: '#0A0F1A',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2px)',
      }}
      aria-label="VicharakAI navigation"
    >
      {TABS.slice(0, 3).map(renderTab)}
      {onAddTask && (
        <button
          key="add-task"
          type="button"
          onClick={onAddTask}
          aria-label="Add a task"
          className="flex-shrink-0 self-center w-10 h-10 mx-1 flex items-center justify-center touch-manipulation"
          style={{ borderRadius: RADIUS.md, background: '#0057FF', border: '1.5px solid #0057FF', color: '#FFFFFF' }}
          data-testid="nav-add-task"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
      {TABS.slice(3).map(renderTab)}
    </nav>
  );
});
