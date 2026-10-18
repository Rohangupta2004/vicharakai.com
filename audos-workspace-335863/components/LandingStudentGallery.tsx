import { useEffect, useRef, useState } from 'react';
import type { LandingTokens } from './landingTokens';
import {
  CHART_LINE_MUTED,
  CTA_BLUE,
  GLASS_BG,
  GLASS_BG_INSET,
  GLASS_BORDER,
  GLASS_BORDER_STRONG,
  GLASS_GLOW,
  withAlpha,
} from './landingTokens';

/**
 * Section 2 of the signed-out landing page — the four-stage student journey,
 * read by SCROLLING. It sits between the hero and the problem panels.
 *
 * THE VISUAL IS A UI MOCKUP, NOT A PICTURE (founder instruction,
 * 2026-09-02): the four generated student illustrations that used to fill the
 * frame are gone, and no photo, drawing or character may replace them. What
 * the frame holds now is a dark glass card built from markup only — a day
 * label, a few neutral content lines that fade as the memory does, and one
 * retention bar with a number above it. Brand blue is the stage where
 * VicharakAI is running; the earlier stages use plain white at 30%, the same
 * language the forgetting-curve chart speaks.
 *
 * There is deliberately NO timer in here: no setInterval, no auto-advance, no
 * carousel, nothing that moves on its own. On desktop the frame is sticky in
 * the left column while the four text panels scroll past on the right; an
 * IntersectionObserver (threshold 0.5) reports which panel the reader has
 * reached and the frame CROSSFADES to that stage's mockup — opacity only,
 * 0.3s, no sliding and no flipping.
 *
 * The observer is rooted on `.eg-root` because the landing page scrolls inside
 * that container rather than the window (see EmailGateLanding.tsx) — a
 * viewport-rooted observer is not reliable there.
 *
 * On a phone the same four stages simply stack: each mockup sits directly
 * above its own text, full width, so nothing depends on a scroll effect.
 *
 * COPY IS FROZEN: every stage headline and body line is word-for-word what
 * the founder approved.
 */

interface JourneyStage {
  id: string;
  /** Where the reader is on the timeline — shown on the frame and the pill. */
  day: string;
  label: string;
  headline: string;
  body: string;
  /** The retention figure the mockup's bar reads out. */
  retention: number;
  /** True for the stage where VicharakAI is running — the blue one. */
  onPlan?: boolean;
}

function journeyStages(brand: string): JourneyStage[] {
  return [
    {
      id: 'studied-well',
      day: 'Day 1',
      label: 'You studied well',
      headline: 'You studied hard. You understood everything.',
      body: 'You finished the chapter. Felt confident. Real progress.',
      retention: 100,
    },
    {
      id: 'fading',
      day: 'Day 3\u20134',
      label: 'It is fading',
      headline: '3 days later \u2014 half of it is already gone.',
      body: 'Without revision, memory drops fast. The chapter you studied starts slipping away and you don\u2019t even notice.',
      retention: 50,
    },
    {
      id: 'pile-up',
      day: 'Day 7',
      label: 'Pile-up',
      headline: 'New lectures keep coming. Old topics pile up.',
      body: '3 new chapters this week. Now you have no idea what to revise first \u2014 or whether you\u2019ll even remember it.',
      retention: 24,
    },
    {
      id: 'fixed',
      day: 'Every day after',
      label: `${brand} fixes it`,
      headline: `${brand} tracks it all automatically.`,
      body: `Add your daily task and ${brand} schedules every revision. It learns from what you complete — by your second day, it already knows your pace.`,
      retention: 96,
      onPlan: true,
    },
  ];
}

/** Above this width the sticky-frame layout runs; below it, stages stack. */
const DESKTOP_QUERY = '(min-width: 768px)';

function readIsDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** The four content lines inside the mockup — the chapter, fading. */
const CONTENT_LINES = [100, 86, 72, 54];

/**
 * The stage visual: a dark glass card holding a minimal progress UI. Boxes,
 * text lines and one bar — no illustration, no character, no photograph.
 */
function StageMockup({ t, stage }: { t: LandingTokens; stage: JourneyStage }) {
  const barColor = stage.onPlan ? CTA_BLUE : CHART_LINE_MUTED;
  // The content lines dim as the memory does: full strength on Day 1, faint by
  // the pile-up, and back to full once VicharakAI is running the schedule.
  const lineStrength = stage.retention / 100;
  return (
    <div
      className="flex h-full w-full flex-col justify-between p-6 md:p-7"
      style={{
        borderRadius: 24,
        backgroundColor: GLASS_BG,
        border: `1px solid ${stage.onPlan ? GLASS_BORDER_STRONG : GLASS_BORDER}`,
        boxShadow: stage.onPlan ? GLASS_GLOW : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[10px] font-extrabold uppercase tracking-[0.2em]"
          style={{ color: stage.onPlan ? t.accentSoft : t.textMuted }}
        >
          {stage.day}
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: t.textSubtle }}>
          {stage.label}
        </span>
      </div>

      {/* The chapter itself — neutral content lines, no words. */}
      <div className="mt-7 flex flex-col gap-3" aria-hidden="true">
        {CONTENT_LINES.map((width, index) => (
          <span
            key={index}
            style={{
              height: 10,
              width: `${width}%`,
              borderRadius: 999,
              backgroundColor: `rgba(255, 255, 255, ${(0.14 * lineStrength + 0.03).toFixed(3)})`,
            }}
          />
        ))}
      </div>

      {/* One bar, one number. */}
      <div className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <span
            className="text-[38px] font-extrabold leading-none tracking-[-0.03em] md:text-[44px]"
            style={{ color: stage.onPlan ? t.textPrimary : t.textMuted, fontFamily: t.headingFont }}
          >
            {stage.retention}%
          </span>
          <span className="pb-1 text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: t.textSubtle }}>
            Retention
          </span>
        </div>
        <div
          className="mt-4 overflow-hidden"
          style={{ height: 6, borderRadius: 999, backgroundColor: GLASS_BG_INSET, border: `1px solid ${GLASS_BORDER}` }}
        >
          <div
            style={{
              width: `${stage.retention}%`,
              height: '100%',
              borderRadius: 999,
              backgroundColor: barColor,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function LandingStudentGallery({ t }: { t: LandingTokens }) {
  const stages = journeyStages(t.brandName);
  const [active, setActive] = useState(0);
  const [isDesktop, setIsDesktop] = useState(readIsDesktop);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(query.matches);
    sync();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', sync);
      return () => query.removeEventListener('change', sync);
    }
    query.addListener(sync);
    return () => query.removeListener(sync);
  }, []);

  // Scroll position drives the sticky frame. Only the desktop layout needs
  // this — on a phone every stage already carries its own mockup.
  useEffect(() => {
    if (!isDesktop) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const nodes = panelRefs.current.filter((node): node is HTMLDivElement => node !== null);
    if (nodes.length === 0) return;
    const scrollRoot = nodes[0].closest('.eg-root');
    const ratios = nodes.map(() => 0);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = nodes.indexOf(entry.target as HTMLDivElement);
          if (index !== -1) ratios[index] = entry.isIntersecting ? entry.intersectionRatio : 0;
        });
        // On a tall screen two panels can be half-visible at once, so the
        // most-visible one wins and the frame never flickers between them.
        let best = -1;
        ratios.forEach((ratio, index) => {
          if (ratio >= 0.5 && (best === -1 || ratio > ratios[best])) best = index;
        });
        if (best !== -1) setActive(best);
      },
      { root: scrollRoot, threshold: [0.5, 0.75, 1] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [isDesktop, stages.length]);

  const renderPanel = (stage: JourneyStage, index: number) => {
    // On a phone every stage reads at full strength; on desktop the stage the
    // reader is on is the lit one.
    const isCurrent = !isDesktop || index === active;
    return (
      <div
        key={stage.id}
        ref={(node) => {
          panelRefs.current[index] = node;
        }}
        className="flex flex-col justify-center"
        style={{
          minHeight: isDesktop ? '78vh' : undefined,
          opacity: isCurrent ? 1 : 0.38,
          transition: 'opacity 0.3s ease',
        }}
        data-testid={`journey-panel-${stage.id}`}
      >
        {/* Phone layout: the stage's own mockup, directly above its text. */}
        {!isDesktop && (
          <div style={{ marginBottom: 22, aspectRatio: '4 / 5' }}>
            <StageMockup t={t} stage={stage} />
          </div>
        )}

        <span
          className="inline-flex items-center self-start rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em]"
          style={{
            color: stage.onPlan ? t.accentSoft : t.textMuted,
            backgroundColor: GLASS_BG,
            border: `1px solid ${stage.onPlan ? withAlpha(CTA_BLUE, 0.4) : GLASS_BORDER}`,
          }}
        >
          {stage.day} &middot; {stage.label}
        </span>
        <h3
          className="mt-5 text-[25px] font-extrabold leading-[1.12] tracking-[-0.03em] sm:text-3xl md:text-[38px]"
          style={{ color: t.textPrimary, fontFamily: t.headingFont }}
        >
          {stage.headline}
        </h3>
        <p
          className="mt-4 max-w-lg text-[15px] leading-[1.7] sm:text-base md:text-lg md:leading-relaxed"
          style={{ color: t.textMuted }}
        >
          {stage.body}
        </p>
      </div>
    );
  };

  return (
    <section
      className="px-5 py-24 md:px-10 md:py-32"
      style={{ backgroundColor: t.sectionBg, borderTop: `1px solid ${GLASS_BORDER}` }}
      data-testid="section-students"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: t.accentSoft }}>
            The student journey
          </p>
          <h2
            className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl md:text-[52px]"
            style={{ color: t.textPrimary, fontFamily: t.headingFont }}
          >
            This is what happens after you study
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.7] sm:text-base sm:leading-relaxed" style={{ color: t.textMuted }}>
            Four stages every student recognises. Scroll to walk through them.
          </p>
        </div>

        <div className={isDesktop ? 'mt-16 grid grid-cols-2 items-start gap-14' : 'mt-12 flex flex-col'}>
          {/* Sticky frame — desktop only. It holds all four mockups stacked and
              crossfades between them; nothing here is on a timer. */}
          {isDesktop && (
            <div style={{ position: 'sticky', top: '20vh', alignSelf: 'start' }}>
              <div
                className="relative"
                style={{
                  aspectRatio: '4 / 5',
                  // Never tall enough that a short laptop screen pushes the
                  // frame or the rail below it out of view while it is pinned.
                  maxHeight: '62vh',
                }}
                data-testid="journey-image-frame"
              >
                {stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: index === active ? 1 : 0,
                      transition: 'opacity 0.3s ease',
                      pointerEvents: index === active ? 'auto' : 'none',
                    }}
                    aria-hidden={index === active ? undefined : true}
                    data-testid={`journey-image-${stage.id}`}
                  >
                    <StageMockup t={t} stage={stage} />
                  </div>
                ))}
              </div>

              {/* Progress rail — how far through the story the reader is. */}
              <div className="mt-6 flex items-center gap-2" aria-hidden="true">
                {stages.map((stage, index) => (
                  <span
                    key={stage.id}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: index <= active ? CTA_BLUE : 'rgba(255, 255, 255, 0.12)',
                      transition: 'background-color 0.3s ease',
                    }}
                  />
                ))}
              </div>
              <p
                className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.18em]"
                style={{ color: t.textSubtle }}
                data-testid="journey-progress"
              >
                Stage {active + 1} of {stages.length}
              </p>
            </div>
          )}

          <div className={isDesktop ? 'flex flex-col' : 'flex flex-col gap-16'}>
            {stages.map(renderPanel)}
          </div>
        </div>
      </div>
    </section>
  );
}
