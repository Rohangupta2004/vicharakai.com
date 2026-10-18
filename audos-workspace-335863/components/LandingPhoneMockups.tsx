import type { ReactElement, ReactNode } from 'react';
import type { LandingTokens } from './landingTokens';
import { CTA_BLUE, GLASS_BG, GLASS_BG_INSET, GLASS_BORDER, GLASS_BORDER_STRONG, withAlpha } from './landingTokens';

/**
 * Section 4 of the signed-out landing page — three phone frames, each holding
 * a React-rendered mockup of a real VicharakAI screen.
 *
 * Everything here is markup: no screenshots, no external images, and — by
 * founder instruction (2026-09-02) — no icons, illustrations or drawn props
 * inside the frames either. What is left is what a real product screenshot
 * looks like: dark rows, text lines, small caps labels and one blue accent
 * marking the thing the app decided. The frame itself is a flat glass shell —
 * a hairline border and no drop shadow, so nothing reads as a sticker pasted
 * onto the page.
 *
 * COPY IS FROZEN: every label, caption and note in here is word-for-word what
 * the founder approved.
 */

interface MockupProps {
  t: LandingTokens;
}

function PhoneFrame({ t, children }: MockupProps & { children: ReactNode }) {
  return (
    <div
      className="lp-phone"
      style={{
        width: '100%',
        maxWidth: 288,
        margin: '0 auto',
        padding: 9,
        borderRadius: 38,
        backgroundColor: GLASS_BG,
        border: `1px solid ${GLASS_BORDER}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 400,
          borderRadius: 30,
          overflow: 'hidden',
          backgroundColor: t.pageBg,
          border: `1px solid ${GLASS_BORDER}`,
        }}
      >
        {/* Notch bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <span style={{ width: 52, height: 4, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.14)' }} />
        </div>
        {children}
      </div>
    </div>
  );
}

/** A small caps chip. `accent` marks the one thing the app itself decided. */
function Badge({ t, label, accent = false }: MockupProps & { label: string; accent?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 8.5,
        fontWeight: 900,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: accent ? t.accentSoft : t.textSubtle,
        backgroundColor: accent ? withAlpha(CTA_BLUE, 0.14) : GLASS_BG,
        border: `1px solid ${accent ? withAlpha(CTA_BLUE, 0.4) : GLASS_BORDER}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function AiTag({ t, label }: MockupProps & { label: string }) {
  return (
    <p
      style={{
        margin: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        padding: '4px 9px',
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: t.accentSoft,
        backgroundColor: withAlpha(CTA_BLUE, 0.12),
        border: `1px solid ${withAlpha(CTA_BLUE, 0.3)}`,
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: 999, backgroundColor: CTA_BLUE }} />
      {label}
    </p>
  );
}

/** A neutral content line — stands in for body text inside a mockup row. */
function TextLine({ width, strong = false }: { width: number | string; strong?: boolean }) {
  return (
    <span
      style={{
        display: 'block',
        height: 7,
        width: typeof width === 'number' ? `${width}%` : width,
        borderRadius: 999,
        backgroundColor: strong ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
      }}
    />
  );
}

/** Card 1 — the Today screen: you log the task, the revision gets scheduled.
 *  INDIA ONLY — the logged lecture names a coaching teacher (“Sharma Sir”),
 *  which only reads as familiar to an Indian student. See the `indiaOnly` flag
 *  on the card list below. */
function TodayScreen({ t }: MockupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '14px 12px 14px' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: t.textPrimary, fontFamily: t.headingFont }}>Today — Thursday</p>
      <p style={{ margin: '3px 0 0', fontSize: 9.5, fontWeight: 700, color: t.textSubtle }}>Your plan, built automatically</p>

      <div
        style={{
          marginTop: 14,
          borderRadius: 12,
          padding: '10px 11px',
          backgroundColor: GLASS_BG,
          border: `1px solid ${GLASS_BORDER}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, lineHeight: 1.35, color: t.textPrimary }}>
            Biology by Sharma Sir — Lecture 1
          </p>
          <Badge t={t} label="Unfinished" />
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 9.5, fontWeight: 700, color: t.textSubtle }}>Online batch lecture · logged by you</p>
      </div>

      <div
        style={{
          marginTop: 8,
          borderRadius: 12,
          padding: '10px 11px',
          backgroundColor: GLASS_BG,
          border: `1px solid ${GLASS_BORDER}`,
          borderLeft: `2px solid ${CTA_BLUE}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, lineHeight: 1.35, color: t.textPrimary }}>
            Organic Chemistry — Revision due
          </p>
          <Badge t={t} label="Auto" accent />
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 9.5, fontWeight: 700, color: t.textSubtle }}>Auto-scheduled · spaced interval hit today</p>
      </div>

      {/* Two more rows of the day, as plain content lines. */}
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          borderRadius: 12,
          padding: '12px 11px',
          backgroundColor: GLASS_BG_INSET,
          border: `1px solid ${GLASS_BORDER}`,
        }}
        aria-hidden="true"
      >
        <TextLine width={72} strong />
        <TextLine width={54} />
        <TextLine width={64} strong />
        <TextLine width={42} />
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 14 }}>
        <AiTag t={t} label={`${t.brandName} scheduled this`} />
      </div>
    </div>
  );
}

/** Card 2 — Doubt Capture: a wrong question stored as a card, rated, respaced. */
function DoubtCaptureScreen({ t }: MockupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '14px 12px 14px' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: t.textPrimary, fontFamily: t.headingFont }}>Mistake Book</p>
      <p style={{ margin: '3px 0 0', fontSize: 9.5, fontWeight: 700, color: t.textSubtle }}>Snap the question you got wrong</p>

      <div
        style={{
          marginTop: 14,
          borderRadius: 14,
          padding: 12,
          backgroundColor: GLASS_BG,
          border: `1px solid ${GLASS_BORDER}`,
        }}
      >
        {/* The stored question — a dark slot with the captured lines in it. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 8,
            height: 76,
            borderRadius: 10,
            padding: 10,
            backgroundColor: GLASS_BG_INSET,
            border: `1px solid ${GLASS_BORDER}`,
          }}
        >
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: t.textSubtle,
            }}
          >
            Question photo
          </span>
          <TextLine width={88} strong />
          <TextLine width={62} />
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 10, fontWeight: 800, color: t.textMuted }}>
          Physics · Test #4 · Rated: Hard
        </p>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        {[
          { label: 'Again', accent: false },
          { label: 'Got it', accent: false },
          { label: 'Explain', accent: true },
        ].map((action) => (
          <span
            key={action.label}
            style={{
              flex: 1,
              textAlign: 'center',
              borderRadius: 10,
              padding: '8px 0',
              fontSize: 10,
              fontWeight: 900,
              color: action.accent ? t.accentSoft : t.textMuted,
              backgroundColor: action.accent ? withAlpha(CTA_BLUE, 0.14) : GLASS_BG,
              border: `1px solid ${action.accent ? withAlpha(CTA_BLUE, 0.4) : GLASS_BORDER}`,
            }}
          >
            {action.label}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 14 }}>
        <AiTag t={t} label="Re-appears in 3 days" />
      </div>
    </div>
  );
}

/** Card 3 — the AI Priority List: weakest topic first. */
function PriorityListScreen({ t }: MockupProps) {
  const items = [
    { rank: 1, topic: 'Current Electricity', meta: '42% accuracy', weight: 'Weightage 8%', lead: true },
    { rank: 2, topic: 'Thermodynamics', meta: '67% accuracy', weight: 'Weightage 6%', lead: false },
    { rank: 3, topic: 'Optics', meta: '91% accuracy', weight: 'Weightage 5%', lead: false },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '14px 12px 14px' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: t.textPrimary, fontFamily: t.headingFont }}>AI Priority List</p>
      <p style={{ margin: '3px 0 0', fontSize: 9.5, fontWeight: 700, color: t.textSubtle }}>Weakest topic first</p>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((item) => (
          <div
            key={item.rank}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              borderRadius: 12,
              padding: '9px 10px',
              backgroundColor: GLASS_BG,
              border: `1px solid ${item.lead ? GLASS_BORDER_STRONG : GLASS_BORDER}`,
              borderLeft: item.lead ? `2px solid ${CTA_BLUE}` : `1px solid ${GLASS_BORDER}`,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 18,
                height: 18,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9.5,
                fontWeight: 900,
                color: item.lead ? t.accentSoft : t.textSubtle,
                backgroundColor: item.lead ? withAlpha(CTA_BLUE, 0.16) : GLASS_BG,
                border: `1px solid ${item.lead ? withAlpha(CTA_BLUE, 0.4) : GLASS_BORDER}`,
              }}
            >
              {item.rank}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, lineHeight: 1.35, color: t.textPrimary }}>{item.topic}</span>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: item.lead ? t.accentSoft : t.textMuted }}>{item.meta}</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: t.textSubtle }}>{item.weight}</span>
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Voice input hint. */}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 10,
          padding: '8px 10px',
          backgroundColor: GLASS_BG_INSET,
          border: `1px solid ${GLASS_BORDER}`,
          color: t.textSubtle,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700 }}>Voice to text — just say your task</span>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 14 }}>
        <AiTag t={t} label="Ranked by your weak spots" />
      </div>
    </div>
  );
}

const CARDS: Array<{
  id: string;
  Screen: (props: MockupProps) => ReactElement;
  caption: string;
  note?: string;
  /** Shown only to Indian visitors — the screen carries India-specific
   *  coaching context that would confuse everyone else. */
  indiaOnly?: boolean;
}> = [
  {
    id: 'today',
    Screen: TodayScreen,
    caption: 'You logged it. We scheduled the revision.',
    indiaOnly: true,
  },
  {
    id: 'doubt-capture',
    Screen: DoubtCaptureScreen,
    caption: 'Wrong question stored as a card. Rated Hard → re-appears in 3 days.',
  },
  {
    id: 'priority-list',
    Screen: PriorityListScreen,
    caption: 'AI ranks what needs attention today. Weakest topic first.',
    note: 'Voice to text available. Syllabus weightage shown per topic.',
  },
];

export default function LandingPhoneMockups({ t, isIndia }: MockupProps & { isIndia: boolean }) {
  // Geo gate: the Today screen names an Indian coaching teacher, so it renders
  // for Indian visitors only. Everyone else gets the remaining screens closed
  // up into an even grid — no empty slot, no gap in the section.
  const cards = CARDS.filter((card) => isIndia || !card.indiaOnly);
  return (
    <section
      className="px-5 py-24 md:px-10 md:py-32"
      style={{ backgroundColor: t.pageBg, borderTop: `1px solid ${GLASS_BORDER}` }}
      data-testid="section-how-it-works"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-3xl text-center">
          <h2
            className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl md:text-[52px]"
            style={{ color: t.textPrimary, fontFamily: t.headingFont }}
          >
            {t.brandName} — just add your task. We handle everything else.
          </h2>
        </div>

        <div
          data-reveal
          className={`mx-auto mt-14 grid gap-10 md:mt-20 md:gap-8 ${cards.length > 2 ? 'md:grid-cols-3' : 'md:max-w-3xl md:grid-cols-2'}`}
        >
          {cards.map((card) => (
            <div key={card.id} className="flex flex-col" data-testid={`mockup-${card.id}`}>
              <PhoneFrame t={t}>
                <card.Screen t={t} />
              </PhoneFrame>
              <p className="mx-auto mt-6 max-w-[300px] text-center text-sm leading-relaxed" style={{ color: t.textMuted }}>
                {card.caption}
              </p>
              {card.note && (
                <p className="mx-auto mt-2 max-w-[300px] text-center text-xs leading-relaxed" style={{ color: t.textSubtle }}>
                  {card.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
