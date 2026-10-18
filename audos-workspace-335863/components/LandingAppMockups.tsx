import type { CSSProperties, ReactNode } from 'react';
import type { LandingTokens } from './landingTokens';
import type { RegionMockups, RegionTestAnalysisMockup } from './landingRegions';

/**
 * The app screens the signed-out landing page shows — markup mockups drawn to
 * look like the REAL app (founder instruction, 2026-09-05: the mockups must
 * match the actual product, not an invented dark design).
 *
 * The real VicharakAI app is LIGHT-themed: a deep-navy brand bar, a pale
 * blue-grey canvas, white cards behind hairline borders, the #0057FF accent
 * on primary actions, and coloured tag chips. The constants below mirror that
 * palette. They deliberately do NOT read the landing page's dark glass tokens:
 * these screens depict the app itself, and the app is light — the dark tokens
 * belong to the marketing surface around the phone, which is unchanged.
 *
 * Still markup only: no image bytes, no screenshots, no third-party assets,
 * and every frame is capped at 390px. THE SCREENS ARE THE SAME IN EVERY
 * MARKET; THE WORDS ON THEM ARE NOT — market-specific labels (subjects,
 * papers, tasks) arrive as `copy` from the region config
 * (components/landingRegions.ts). Nothing hardcoded here may name an exam, a
 * paper or a subject.
 */

/* ------------------------------------------------------------------------
 * The real app's own palette, as the product actually renders it.
 * ---------------------------------------------------------------------- */
const APP_BG = '#F2F6FC';
const APP_CARD = '#FFFFFF';
const APP_BORDER = '#E2E8F3';
const APP_INK = '#0B1B33';
const APP_MUTED = '#5B6B84';
const APP_SUBTLE = '#8A97AB';
const APP_TOPBAR = '#081027';
const APP_BLUE = '#0057FF';
const APP_BLUE_LIGHT = '#2F82F5';
const APP_BLUE_SOFT = '#E8F0FE';
const APP_GREEN_SOFT = '#E5F6ED';
const APP_GREEN_INK = '#0E9F5D';
const APP_ORANGE_SOFT = '#FDEFDD';
const APP_ORANGE_INK = '#B54708';
const APP_RED = '#E5484D';

/** The gradient the app paints its primary actions with. */
const APP_PRIMARY_GRADIENT = `linear-gradient(135deg, ${APP_BLUE}, ${APP_BLUE_LIGHT})`;

interface MockupProps {
  t: LandingTokens;
}

/** A screen plus the market's wording for it. */
interface ScreenProps extends MockupProps {
  copy: RegionMockups;
}

/**
 * The phone shell: a solid INK bezel (v177 — the landing page is a paper
 * sheet now, so the old dark gradient edge no longer belongs) around a LIGHT
 * screen, topped by the app's own navy brand bar. What sits inside the frame
 * looks exactly like the product.
 */
export function PhoneFrame({ t, children }: MockupProps & { children: ReactNode }) {
  return (
    <div
      className="lp4-phone"
      style={{
        width: '100%',
        maxWidth: 390,
        margin: '0 auto',
        padding: 9,
        borderRadius: 26,
        background: `linear-gradient(165deg, ${APP_TOPBAR}, #131C33)`,
        border: `1.5px solid ${APP_INK}`,
        boxShadow: '0 22px 44px rgba(22, 31, 43, 0.18)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 420,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: APP_BG,
          border: '1px solid rgba(8, 16, 39, 0.18)',
        }}
      >
        {/* The app's navy brand bar, exactly as the product draws it. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', backgroundColor: APP_TOPBAR }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              width: 16,
              height: 16,
              borderRadius: 5,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 900,
              color: '#FFFFFF',
              background: APP_PRIMARY_GRADIENT,
            }}
          >
            v
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.01em', color: '#FFFFFF' }}>{t.brandName}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Screen title + subtitle, matching the app's own header block. */
function ScreenHeader({ t, title, subtitle }: MockupProps & { title: string; subtitle: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: APP_INK, fontFamily: t.headingFont }}>
        {title}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 9.5, fontWeight: 700, lineHeight: 1.45, color: APP_MUTED }}>{subtitle}</p>
    </div>
  );
}

/** A white app card behind the hairline border the product uses. */
function AppCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 12,
        backgroundColor: APP_CARD,
        border: `1px solid ${APP_BORDER}`,
        boxShadow: '0 1px 3px rgba(11, 27, 51, 0.05)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type ChipTone = 'blue' | 'bluesoft' | 'green' | 'orange' | 'neutral';

const CHIP_TONES: Record<ChipTone, { bg: string; ink: string; border: string }> = {
  blue: { bg: APP_BLUE, ink: '#FFFFFF', border: APP_BLUE },
  bluesoft: { bg: APP_BLUE_SOFT, ink: APP_BLUE, border: '#CFE0FC' },
  green: { bg: APP_GREEN_SOFT, ink: APP_GREEN_INK, border: '#C4EAD5' },
  orange: { bg: APP_ORANGE_SOFT, ink: APP_ORANGE_INK, border: '#F6DCB8' },
  neutral: { bg: '#F1F4F9', ink: APP_MUTED, border: APP_BORDER },
};

/** A small caps pill, in the app's own chip colours. */
function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const c = CHIP_TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 8,
        fontWeight: 900,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        color: c.ink,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      {label}
    </span>
  );
}

/**
 * SECTION 3, LEFT PANEL — Mistake Book at the moment of capture, laid out the
 * way the real screen is: the big blue "Snap a mistake" action, the gallery
 * alternative, the type-it-instead field, and the auto-tag chips.
 */
export function MistakeCaptureScreen({ t, copy }: ScreenProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '13px 12px 13px' }}>
      <ScreenHeader t={t} title="Mistake Book" subtitle="Got it wrong, or got stuck? Snap it — it saves instantly." />

      <AppCard style={{ marginTop: 12 }}>
        <p style={{ margin: 0, textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: APP_INK }}>
          Snap the question you got wrong — it saves instantly
        </p>

        <div
          style={{
            marginTop: 10,
            borderRadius: 12,
            padding: '13px 10px',
            textAlign: 'center',
            background: APP_PRIMARY_GRADIENT,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: '#FFFFFF' }}>📷 Snap a mistake</p>
          <p style={{ margin: '3px 0 0', fontSize: 8, fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)' }}>
            saves instantly — answer it later
          </p>
        </div>

        <div
          style={{
            marginTop: 8,
            borderRadius: 12,
            padding: '9px 10px',
            textAlign: 'center',
            backgroundColor: APP_CARD,
            border: `1px solid ${APP_BORDER}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: APP_INK }}>🖼 Choose from Gallery</p>
        </div>

        <div
          style={{
            marginTop: 8,
            borderRadius: 10,
            padding: '9px 10px',
            backgroundColor: APP_CARD,
            border: `1px solid ${APP_BORDER}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: APP_SUBTLE }}>
            Or type the question — it saves as its own entry
          </p>
        </div>
      </AppCard>

      {/* The tags the app just filled in by itself. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: APP_SUBTLE }}>
          ✦ Auto-tagged
        </span>
        {copy.captureChips.map((chip) => (
          <Chip key={chip} label={chip} tone="bluesoft" />
        ))}
      </div>

      <p style={{ marginTop: 'auto', marginBottom: 0, paddingTop: 12, fontSize: 9, fontWeight: 700, lineHeight: 1.5, color: APP_SUBTLE }}>
        {copy.captureCaption}
      </p>
    </div>
  );
}

/** One task on the Today plan, drawn like the app's checkbox rows. */
function TaskRow({ title, why, chip }: { title: string; why: string; chip?: string }) {
  const tone: ChipTone = chip === 'Due now' ? 'blue' : chip === 'Weak' ? 'orange' : 'bluesoft';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 2px' }}>
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 1, width: 13, height: 13, borderRadius: 4, border: `1.6px solid #C6D2E4`, backgroundColor: '#FFFFFF' }}
      />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.35, color: APP_INK }}>{title}</span>
          {chip ? <Chip label={chip} tone={tone} /> : null}
        </span>
        <span style={{ display: 'block', marginTop: 3, fontSize: 8.5, fontWeight: 700, lineHeight: 1.45, color: APP_SUBTLE }}>{why}</span>
      </span>
    </div>
  );
}

/**
 * SECTION 3 (RIGHT PANEL) and the feature visual — the Today plan, in the
 * app's real layout: the DUE TODAY pill over a white card of checkbox rows,
 * each carrying the why-line that explains its place on the plan.
 */
export function TodayScreen({ t, copy, compact = false }: ScreenProps & { compact?: boolean }) {
  // `compact` is the two-panel view in section 3, where the phone sits beside
  // the capture screen and only the first two tasks fit.
  const tasks = compact ? copy.tasks.slice(0, 2) : copy.tasks;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '13px 12px 13px' }}>
      <ScreenHeader t={t} title="Today" subtitle={copy.todaySubtitle} />

      <div style={{ marginTop: 10 }}>
        <Chip label="Due today" tone="bluesoft" />
      </div>

      <AppCard style={{ marginTop: 8, padding: '4px 10px' }}>
        {tasks.map((task, index) => (
          <div key={task.title} style={{ borderTop: index === 0 ? 'none' : `1px solid ${APP_BORDER}` }}>
            <TaskRow title={task.title} why={task.why} chip={task.chip} />
          </div>
        ))}
      </AppCard>

      <p style={{ marginTop: 'auto', marginBottom: 0, paddingTop: 12, fontSize: 9, fontWeight: 700, lineHeight: 1.5, color: APP_SUBTLE }}>
        {copy.todayFooter}
      </p>
    </div>
  );
}

/**
 * THE TEST ANALYSIS SECTION VISUAL — the app's real analysis screen: the
 * score strip, then "where the questions went" as the red breakdown bars.
 * Every market-specific word arrives from the region config.
 */
export function TestAnalysisScreen({ t, copy }: MockupProps & { copy: RegionTestAnalysisMockup }) {
  // ONE demo paper, and every figure on this screen agrees with it (the
  // landing page quotes the same one): 160 of 180 attempted, 128 right and
  // 32 wrong, which is 480/720 at +4/-1 and 80% accuracy. The 32 wrong
  // answers are split across the four reasons below, largest on the third so
  // the red note underneath has a cause.
  const counts = [6, 7, 11, 8];
  const maxCount = 11;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '13px 12px 13px' }}>
      <ScreenHeader t={t} title={copy.title} subtitle={copy.subtitle} />

      {/* The score strip. */}
      <AppCard style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', textAlign: 'center', gap: 6 }}>
        {[
          { value: '480/720', label: 'Score', color: APP_INK },
          { value: '80%', label: 'Accuracy', color: APP_GREEN_INK },
          { value: '160/180', label: 'Attempted', color: APP_INK },
        ].map((stat) => (
          <span key={stat.label} style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 900, letterSpacing: '-0.01em', color: stat.color }}>
              {stat.value}
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 2,
                fontSize: 7,
                fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: APP_SUBTLE,
              }}
            >
              {stat.label}
            </span>
          </span>
        ))}
      </AppCard>

      {/* Where the questions went — the red breakdown bars. */}
      <AppCard style={{ marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 8, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: APP_SUBTLE }}>
          Where the questions went
        </p>
        <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {copy.errorTypes.map((label, index) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ flexShrink: 0, width: 88, fontSize: 8.5, fontWeight: 800, lineHeight: 1.25, color: APP_INK }}>{label}</span>
              <span style={{ flex: 1, height: 7, borderRadius: 999, backgroundColor: '#EEF2F8', overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${(counts[index] / maxCount) * 100}%`,
                    borderRadius: 999,
                    backgroundColor: APP_RED,
                  }}
                />
              </span>
              <span style={{ flexShrink: 0, width: 22, textAlign: 'right', fontSize: 8, fontWeight: 800, color: APP_MUTED }}>
                {counts[index]} q
              </span>
            </div>
          ))}
        </div>
        <p style={{ margin: '9px 0 0', fontSize: 8.5, fontWeight: 800, color: APP_RED }}>
          You missed {counts[2]} questions to “{copy.errorTypes[2].toLowerCase()}”.
        </p>
      </AppCard>

      <p style={{ marginTop: 'auto', marginBottom: 0, paddingTop: 12, fontSize: 9, fontWeight: 700, lineHeight: 1.5, color: APP_SUBTLE }}>
        {copy.footer}
      </p>
    </div>
  );
}

/**
 * The Mistake Book list view — kept for API compatibility (not currently
 * rendered on the landing page). Drawn in the same light app style.
 */
export function MistakeBookScreen({ t, copy }: ScreenProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '13px 12px 13px' }}>
      <ScreenHeader t={t} title="Mistake Book" subtitle={copy.mistakeBookSubtitle} />

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {copy.rows.map((row) => (
          <AppCard key={row.topic} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 11px' }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, lineHeight: 1.35, color: APP_INK }}>{row.topic}</span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 8.5, fontWeight: 700, color: APP_SUBTLE }}>{row.meta}</span>
            </span>
            <Chip label={row.due} tone={row.due.trim().toLowerCase() === 'due today' ? 'blue' : 'neutral'} />
          </AppCard>
        ))}
      </div>

      <span
        style={{
          display: 'block',
          marginTop: 'auto',
          textAlign: 'center',
          borderRadius: 12,
          padding: '12px 0',
          fontSize: 11.5,
          fontWeight: 900,
          color: '#FFFFFF',
          background: APP_PRIMARY_GRADIENT,
        }}
      >
        📷 Snap a mistake
      </span>
    </div>
  );
}
