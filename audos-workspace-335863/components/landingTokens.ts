import type { CSSProperties } from 'react';

/**
 * The palette the signed-out marketing page draws from.
 *
 * useEmailGateController owns the actual values so the OTP screen, the
 * sign-in modal and the checkout modals stay on exactly the same brand; this
 * bag carries them into the marketing sub-components instead of each file
 * re-declaring a divergent set of hex codes.
 *
 * THE PAGE ACCENT IS #0057FF, electric blue (founder instruction, 2026-09-03
 * — cyan removed) — see the LANDING_ACCENT block at the bottom of this file.
 * It is the accent for the SIGNED-OUT MARKETING PAGE ONLY: every CTA,
 * highlight and active state on components/LandingPage.tsx reads it from
 * there, so the whole surface can be re-tinted in one place. The `accent` /
 * `accentDeep` / `gradient` fields in the token bag below carry the same
 * platform brand blue (#0057FF → #003AB0) that the OTP screen, the sign-in
 * modal, the checkout modals and the app shell are painted with — never
 * hardcode a divergent palette into a component.
 *
 * The canvas is unchanged: #0A0A0F page, #111118 deep surface, white primary
 * text, #94A3B8 secondary text.
 *
 * SURFACES are glass, not colour: cards are rgba(255,255,255,0.04) behind a
 * rgba(255,255,255,0.08) hairline (GLASS_* below). No coloured card fills, no
 * "pop-up" drop shadows — the only shadow on the page is the faint accent
 * GLASS_GLOW on a hovered or active card.
 */
export interface LandingTokens {
  brandName: string;
  headingFont: string;
  /** Page canvas — #0A0A0F. */
  pageBg: string;
  /** Section fill — the same near-black canvas (#0A0A0F). */
  sectionBg: string;
  /** Deep surface — #111118. Cards prefer the GLASS_BG below; this is for
   *  the few places that need an opaque fill (phone screens, insets). */
  panelBg: string;
  /** Hairline borders — #1C2333. Marketing cards use GLASS_BORDER instead. */
  border: string;
  textPrimary: string;
  textMuted: string;
  textSubtle: string;
  /** Primary brand accent — blue #0057FF. */
  accent: string;
  /** The deep navy end of the brand gradient — #003AB0. Also the pressed /
   *  shadow state. */
  accentDeep: string;
  /** A light tint of the SAME blue (#6C9BFF), for the small accent TEXT,
   *  hairlines and chart strokes that #0057FF is too dark to carry on a
   *  near-black canvas. Deliberately not cyan. */
  accentSoft: string;
  /** The brand fill — a real `linear-gradient(135deg, #0057FF, #003AB0)`.
   *  Assign it with the `background` shorthand or `backgroundImage` only:
   *  `backgroundColor` silently drops a gradient value. */
  gradient: string;
  /** The same sweep for text that is FILLED with the gradient (the key words
   *  of a hero headline). It leads in from the light tint above so the glyphs
   *  stay legible on near-black — a raw #0057FF→#003AB0 text fill reads as
   *  almost black at the navy end. Still blue only, no cyan. */
  gradientText: string;
  /** Ink that reads on the blue gradient fill — white. */
  onGradient: string;
  /** The platform's dark canvas + beacon glow. The marketing hero uses the
   *  quieter LANDING_HERO_GLOW below instead; this stays for the auth screens
   *  that share the token bag. */
  heroGlow: string;
  toneGood: string;
  toneWarn: string;
  toneDanger: string;
  subjectOrange: string;
}

/** Dark glass card fill — THE card surface on the marketing page. */
export const GLASS_BG = 'rgba(255, 255, 255, 0.04)';
/** A slightly deeper glass, for a panel nested inside another card. */
export const GLASS_BG_DEEP = 'rgba(17, 17, 24, 0.8)';
/** An inset fill (chart wells, mockup rows) — quieter than GLASS_BG. */
export const GLASS_BG_INSET = 'rgba(255, 255, 255, 0.02)';
/** The hairline every glass card carries. */
export const GLASS_BORDER = 'rgba(255, 255, 255, 0.08)';
/** A brighter hairline for the one highlighted / active card. */
export const GLASS_BORDER_STRONG = 'rgba(255, 255, 255, 0.14)';
/** The ONLY shadow on the page: a faint accent lift on hover or on the active
 *  card. Never a dark "pop-up" drop shadow. */
export const GLASS_GLOW = '0 0 32px rgba(0, 87, 255, 0.15)';
/** Solid CTA blue — flat, no gradient, no neon. Retired with the two
 *  geo-branched marketing pages; the live page uses LANDING_ACCENT below. */
export const CTA_BLUE = '#0057FF';
/** The pressed / hover shade of the solid CTA. */
export const CTA_BLUE_DEEP = '#003AB0';
/** One large, deliberately faint radial glow behind a hero headline. */
export const HERO_RADIAL_GLOW =
  'radial-gradient(ellipse 75% 55% at 50% 0%, rgba(0, 87, 255, 0.12) 0%, transparent 72%), #0A0A0F';
/** Data-viz strokes: brand blue for the line that matters, plain white at 30%
 *  for the "without" line. No red, no amber — the chart is monochrome + blue. */
export const CHART_LINE_PRIMARY = '#0057FF';
export const CHART_LINE_MUTED = 'rgba(255, 255, 255, 0.3)';
/** Grid, axes and ticks — hairlines, never a coloured rule. */
export const CHART_GRID_LINE = 'rgba(255, 255, 255, 0.08)';
export const CHART_AXIS_LINE = 'rgba(255, 255, 255, 0.14)';

/* ---------------------------------------------------------------------------
 * THE LANDING ACCENT (founder instruction, 2026-09-03 — cyan removed).
 *
 * #0057FF (electric blue) is the accent for the signed-out landing page —
 * every CTA, chip, highlight, active state, left border and chart stroke on
 * components/LandingPage.tsx (and the mockups it renders) reads it from here.
 * It is deliberately scoped to that surface: the app shell, the OTP screen,
 * the sign-in modal and the checkout modals stay on the platform brand blue
 * that useEmailGateController owns (the same #0057FF). Re-tinting the
 * marketing page means changing these four values and nothing else.
 * ------------------------------------------------------------------------ */
export const LANDING_ACCENT = '#0057FF';
/** Hover state of an accent CTA — a slightly lifted blue, so the hover stays
 *  visible on the near-black canvas. Matches the hover the solid #0057FF
 *  CTAs have always used. */
export const LANDING_ACCENT_HOVER = '#0B62FF';
/** Ink that reads on an accent fill: white. #0057FF is a dark colour and
 *  white text carries full contrast on it at button size. */
export const LANDING_ACCENT_INK = '#FFFFFF';
/** The one faint radial glow behind the hero and the closing CTA. */
export const LANDING_HERO_GLOW =
  'radial-gradient(ellipse 78% 58% at 50% 0%, rgba(0, 87, 255, 0.13) 0%, transparent 72%), #0A0A0F';
/** RETIRED IN v176. The two circular hero orbs are no longer rendered — the
 *  hero is lit by the aurora field below instead. Kept exported so nothing
 *  that still imports them breaks. */
export const LANDING_HERO_ORB =
  'radial-gradient(circle at 36% 34%, rgba(108, 155, 255, 0.96) 0%, rgba(0, 87, 255, 0.78) 24%, rgba(0, 58, 176, 0.28) 52%, transparent 72%)';
export const LANDING_HERO_ORB_WARM =
  'radial-gradient(circle at 40% 38%, rgba(255, 174, 102, 0.9) 0%, rgba(255, 107, 0, 0.74) 28%, rgba(255, 107, 0, 0.18) 56%, transparent 72%)';

/* ---------------------------------------------------------------------------
 * THE HERO FIELD (v176 redesign).
 *
 * Three very large, heavily blurred blooms drifting on separate slow paths
 * over a masked hairline grid, plus one wide beam that crosses the hero every
 * few seconds. Blue stays dominant and the warm bloom is a single small
 * accent — it reads as depth and motion rather than as decoration, and it is
 * markup only: no images, no libraries, transform-driven so it stays cheap.
 * ------------------------------------------------------------------------ */
export const LANDING_AURORA_BLUE =
  'radial-gradient(circle at 50% 50%, rgba(0, 87, 255, 0.9) 0%, rgba(0, 87, 255, 0.34) 40%, transparent 70%)';
export const LANDING_AURORA_DEEP =
  'radial-gradient(circle at 50% 50%, rgba(108, 155, 255, 0.62) 0%, rgba(0, 58, 176, 0.3) 46%, transparent 72%)';
export const LANDING_AURORA_WARM =
  'radial-gradient(circle at 50% 50%, rgba(255, 150, 74, 0.55) 0%, rgba(255, 107, 0, 0.18) 44%, transparent 70%)';
/** The hairline grid under the hero content, masked to fade out at the edges. */
export const LANDING_GRID_LINE = 'rgba(108, 155, 255, 0.07)';
/** The light tint of the brand blue, for small caps labels and hairlines that
 *  #0057FF is too dark to carry on a near-black canvas. Same value the token
 *  bag carries as `accentSoft`; exported here so a presentational component
 *  can reach it without threading the whole bag through. */
export const LANDING_ACCENT_SOFT = '#6C9BFF';
/** THE `--c-accent` TOKEN (founder instruction, 2026-09-03). A lighter
 *  electric blue reserved for exactly two elements: the “Due today” pill
 *  backgrounds and step number markers. LandingPage writes it into :root as
 *  the CSS variable `--c-accent`, and consumers read `var(--c-accent, …)`
 *  with this constant as the fallback. Deliberately NOT for headings,
 *  borders, section backgrounds or anything else — those stay on
 *  LANDING_ACCENT and the glass surfaces. Not cyan, not amber. */
export const LANDING_C_ACCENT = '#2F82F5';

/* ---------------------------------------------------------------------------
 * THE FOUR GRADIENT TOKENS (founder instruction, 2026-09-03).
 *
 * These paint the whole signed-out landing page. LandingPage.tsx writes them
 * into :root as --g-primary / --g-edge / --g-depth / --g-wash, and every
 * consumer reads `var(--g-…)` with these constants as the fallback.
 *
 *   --g-primary  the bright blue sweep — the hero headline's key-word fill.
 *   --g-edge     the gradient hairline that borders cards (see
 *                LANDING_EDGE_CARD_STYLE below).
 *   --g-depth    deep navy — the fill of the page's dark sections.
 *   --g-wash     one restrained radial glow, layered over a dark base on the
 *                hero, the close and the ambient sections.
 *
 * Strictly blues — no cyan, no amber. They belong on SECTION and CARD
 * backgrounds only: never layer any of them over a photo.
 * ------------------------------------------------------------------------ */
export const LANDING_G_PRIMARY = 'linear-gradient(102deg, #2F82F5, #6FA8FF 58%, #E8F1FF)';
export const LANDING_G_EDGE =
  'linear-gradient(150deg, rgba(111, 168, 255, 0.9), transparent 45%, rgba(47, 130, 245, 0.5))';
/** v176: the deep sections are near-black lit from above by navy, rather than
 *  a flat mid-navy fill. Dark-first — the blue reads as light on the page, not
 *  as paint. */
export const LANDING_G_DEPTH =
  'linear-gradient(180deg, #0B1428 0%, #070C1A 52%, #04070F 100%)';
export const LANDING_G_WASH =
  'radial-gradient(70vw 56vh at 74% -8%, rgba(0, 87, 255, 0.3), transparent 62%)';

/** The near-opaque navy that fills an edge card's inside, letting a hint of
 *  --g-edge glow through the body while the text stays fully legible. */
export const LANDING_EDGE_INNER = 'rgba(6, 14, 32, 0.82)';

/** THE CARD TREATMENT: --g-edge as a gradient hairline border. Two painted
 *  layers — the near-opaque inner clipped to the padding box over the edge
 *  gradient clipped to the border box — so the 1px transparent border shows
 *  the gradient. Spread it into a card's style object, and re-state
 *  borderLeft AFTER the spread on the accent-edged cards. */
export const LANDING_EDGE_CARD_STYLE: CSSProperties = {
  border: '1px solid transparent',
  backgroundImage: `linear-gradient(${LANDING_EDGE_INNER}, ${LANDING_EDGE_INNER}), var(--g-edge, ${LANDING_G_EDGE})`,
  backgroundOrigin: 'padding-box, border-box',
  backgroundClip: 'padding-box, border-box',
};

/* ===========================================================================
 *  THE LIGHT PAGE (v197, founder instruction 2026-09-30).
 *
 *  The whole signed-out landing page is LIGHT: a warm-white sheet in dark
 *  ink, carrying ONE accent — electric blue #0057FF. The ONLY dark surface
 *  left on the page is the free-session banner, which keeps a deliberate
 *  near-black card so the offer stands out (its palette is scoped inside
 *  LandingPage.tsx's .lp4-banner block, NOT here).
 *
 *  THE TOKEN NAMES ARE DELIBERATELY UNCHANGED. LandingPage, the memory
 *  diagram, the spaced-repetition explainer, the V2 showcase mockups, the
 *  Learn hub and the routed legal pages all read PAPER_*, so re-skinning the
 *  page means changing the VALUES here and nothing else — exactly what this
 *  pass does: the v188 night values flip back to paper.
 *
 *  CONTRAST IS THE RULE. Dark ink on the warm-white sheet clears WCAG AA
 *  everywhere; #0057FF carries WHITE ink on fills and is dark enough to be
 *  accent TEXT on this canvas (PAPER_ACCENT_TEXT is a deepened blue for the
 *  small labels). Tints are computed with withAlpha, never written as a
 *  Tailwind /NN opacity modifier, which emits no CSS on an arbitrary colour.
 *
 *  The dark GLASS and LANDING tokens above are kept exported: legacy
 *  components still import them, and nothing that reads them breaks.
 * ======================================================================== */

/** The canvas itself — cool white-blue, never cream. */
export const PAPER_BG = '#F2F7FF';
/** A sunk panel on the canvas (the demo wells, the week cells). */
export const PAPER_SUNK = '#E8F0FF';
/** Body ink — navy that matches workspace branding. */
export const PAPER_INK = '#001847';
/** Secondary ink — ledes, captions, answers. */
export const PAPER_INK_SOFT = '#002F8A';
/** A third, quieter ink for marginalia and fine print. */
export const PAPER_INK_FAINT = '#4A6BA8';
/** The hairline rule between bands and around cards. */
export const PAPER_RULE = 'rgba(0, 24, 71, 0.12)';
/** The colour of material that has been lost — a red that reads on paper. */
export const PAPER_GONE = '#C2372A';
/** The colour of material that has been held. */
export const PAPER_KEPT = '#15803D';

/* ---------------------------------------------------------------------------
 * THE PAGE ACCENT — #0057FF, electric blue (founder instruction, 2026-09-27:
 * remove ALL cyan).
 *
 * One accent carries every CTA face, border, timeline dot and highlight on
 * the landing page, and it is the SAME blue the app and the auth screens are
 * painted with — the signed-out page and the product a visitor signs into
 * read as one brand.
 *
 * #0057FF takes WHITE ink on a fill. On the light sheet the accent can also
 * be TEXT — PAPER_ACCENT_TEXT is a slightly deepened blue (≈6.9:1 on the
 * warm white) for small labels.
 * ------------------------------------------------------------------------ */
/** The accent itself — fills, borders, dots, highlights. White ink on top. */
export const PAPER_ACCENT = '#0057FF';
/** Hover face of an accent CTA. */
export const PAPER_ACCENT_HOVER = '#1A6BFF';
/** Pressed face. */
export const PAPER_ACCENT_PRESS = '#0043C9';
/** Ink that reads ON an accent fill — white. */
export const PAPER_ACCENT_INK = '#FFFFFF';
/** The accent as TEXT on the light sheet: a deepened blue that clears AA at
 *  label size. */
export const PAPER_ACCENT_TEXT = '#0047D6';
/** The accent CTA face — a shallow blue sweep. */
export const PAPER_G_ACCENT = 'linear-gradient(135deg, #1A6BFF 0%, #0047D6 100%)';
/** The full brand sweep — rules, ticks, bars, meters. */
export const PAPER_G_ACCENT_BRAND = 'linear-gradient(120deg, #2F82F5 0%, #0057FF 100%)';
/** The marker-highlight behind the hero headline's accent phrase — a swipe of
 *  blue under the glyphs, softened for the light sheet. */
export const PAPER_HIGHLIGHT =
  'linear-gradient(180deg, rgba(0, 87, 255, 0) 60%, rgba(0, 87, 255, 0.22) 60%, rgba(0, 87, 255, 0.22) 94%, rgba(0, 87, 255, 0) 94%)';

/** The brand fill on a button or a badge. */
export const PAPER_G_BRAND = 'linear-gradient(135deg, #0057FF 0%, #003AB0 100%)';
/** Its hover state — lifted, not darkened, so the press still reads. */
export const PAPER_G_BRAND_HOVER = 'linear-gradient(135deg, #1069FF 0%, #0046D2 100%)';
/** The sweep that FILLS headline words. Deep blues — light tints would wash
 *  out on the warm-white sheet. */
export const PAPER_G_TEXT = 'linear-gradient(96deg, #0041C4 0%, #0057FF 48%, #2F82F5 100%)';
/** The margin rule down the left edge of the sheet — fades in and out rather
 *  than butting into the band rules. */
export const PAPER_G_MARGIN =
  'linear-gradient(180deg, rgba(0, 87, 255, 0) 0%, rgba(0, 87, 255, 0.5) 10%, rgba(0, 87, 255, 0.5) 90%, rgba(0, 87, 255, 0) 100%)';
/** A hairline band rule that fades at both ends — dark ink on the light sheet. */
export const PAPER_G_RULE =
  'linear-gradient(90deg, rgba(0, 24, 71, 0) 0%, rgba(0, 24, 71, 0.12) 12%, rgba(0, 24, 71, 0.12) 88%, rgba(0, 24, 71, 0) 100%)';
/** The blue wash that lights a band from its top corner — faint on white. */
export const PAPER_G_WASH =
  'radial-gradient(58rem 30rem at 86% -12%, rgba(0, 87, 255, 0.08), transparent 62%)';
/** The second wash, lighting a band from the opposite corner — the same blue
 *  family a shade lighter, never a second hue. */
export const PAPER_G_WASH_WARM =
  'radial-gradient(46rem 26rem at 4% 0%, rgba(47, 130, 245, 0.06), transparent 58%)';
/** THE HERO GLOW (founder instruction, 2026-09-28) — a ChatGPT-style header
 *  lit from above: the brand blue bleeding in from the top-left at ~12% over
 *  the near-black canvas, answered by an even fainter indigo from the
 *  top-right for depth. Transparent-based so it layers over the page's own
 *  dark canvas without a seam. Static by design — no animation, so there is
 *  nothing for prefers-reduced-motion to stand down. Hero band only. */
export const PAPER_G_HERO =
  'radial-gradient(ellipse 72% 58% at 26% -12%, rgba(0, 87, 255, 0.10) 0%, transparent 66%), ' +
  'radial-gradient(ellipse 60% 48% at 88% -8%, rgba(108, 155, 255, 0.08) 0%, transparent 60%)';
/** The same glow on a phone — a single centred radial, so the light source
 *  still reads on a 375px screen instead of splitting into two corner tints. */
export const PAPER_G_HERO_MOBILE =
  'radial-gradient(ellipse 130% 52% at 50% -10%, rgba(0, 87, 255, 0.07) 0%, transparent 68%)';
/** A raised card on the canvas — white with a cool blue foot. */
export const PAPER_G_CARD = 'linear-gradient(168deg, #FFFFFF 0%, #F5F8FF 100%)';
/** A sunk panel on the canvas. */
export const PAPER_G_SUNK = 'linear-gradient(168deg, #EAF1FF 0%, #E2ECFF 100%)';
/** The six decay steps of the “left alone” week strip, green through to red. */
export const PAPER_DECAY_STEPS = [
  'linear-gradient(90deg, #2FA875, #3DD68C)',
  'linear-gradient(90deg, #58A883, #79C7A0)',
  'linear-gradient(90deg, #96A782, #B3C199)',
  'linear-gradient(90deg, #C99C66, #DAB484)',
  'linear-gradient(90deg, #D9765A, #E89177)',
  'linear-gradient(90deg, #E0503F, #FF6B5E)',
] as const;
/** The matching “with VicharakAI” strip — held, in the one brand blue. */
export const PAPER_G_HELD = 'linear-gradient(90deg, #0057FF, #6C9BFF)';

/** Editorial typography. The display face is loaded from Google Fonts by the
 *  landing page itself and falls back to the workspace heading font, so a
 *  blocked font request costs nothing but the flourish. */
export const PAPER_FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');";
export const PAPER_FONT_DISPLAY = '"Bricolage Grotesque", "IBM Plex Sans", system-ui, sans-serif';
export const PAPER_FONT_BODY = '"IBM Plex Sans", system-ui, -apple-system, sans-serif';

/**
 * rgba() form of a #rgb / #rrggbb colour. Tints are computed rather than
 * written as Tailwind opacity modifiers because Tailwind silently emits no CSS
 * for a `/NN` modifier on an arbitrary or var() colour.
 */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
