/**
 * VicharakAI's design system — one place, used by every screen of the app.
 *
 * The surface is PAPER: a cool white-blue page, white content sheets, hairline
 * rules instead of shadows, and navy ink. Colour is rationed on purpose:
 *
 *   --brand  something you can act on. Never decoration, headers, emphasis.
 *   --gone   missed / overdue / lost marks ONLY.
 *   --kept   completed ONLY.
 *   --s1..s5 subject identity, in chips only. Never status.
 *
 * Red appearing anywhere it doesn't mean "you missed this" destroys the signal,
 * so nothing else in the app is allowed to reach for it.
 *
 * `--f-hand` marks text the STUDENT entered or chose (task names, mistake
 * entries, typed questions, and the inputs that edit them) plus empty-state
 * lines. It is NOT a handwriting face: there is no Caveat and no Kalam in the
 * app any more, and `--f-hand` resolves to the same system sans stack as
 * everything else. Everything the app itself says is `--f-body`; page titles
 * are `--f-head`.
 *
 * The legacy export names below (NAVY, AMBER, CARD, …) are kept so the whole
 * app keeps compiling against one import; each one now resolves to its paper
 * equivalent, which is why a single edit here restyles every screen.
 */

/* ---------- paper ---------- */
export const PAPER = 'var(--paper, #F2F7FF)';
export const PAPER_SUNK = 'var(--paper-sunk, #E8F0FF)';
export const SHEET = 'var(--sheet, #FFFFFF)';

/* ---------- ink ---------- */
export const INK = 'var(--ink, #001847)';
export const INK_SOFT = 'var(--ink-soft, #002F8A)';
/** Quiet annotations and empty states — never load-bearing UI text. */
export const PENCIL = 'var(--pencil, #4A6BA8)';

/* ---------- lines ---------- */
export const RULE = 'var(--rule, #C7DAFF)';
export const RULE_SOFT = 'var(--rule-soft, #E8F0FF)';

/* ---------- action ---------- */
/** Electric blue ink for links, outlines and small labels (#0057FF — the
 * brand accent; the cyan palette was retired 2026-09-27). */
export const BRAND = 'var(--brand, #0057FF)';
export const BRAND_DEEP = 'var(--brand-deep, #003AB0)';
export const BRAND_WASH = 'var(--brand-wash, #E8F0FF)';
/** The electric blue is also the fill for primary actions (white text). */
export const BRAND_ACTION = 'var(--brand-action, #0057FF)';

/* ---------- state ---------- */
export const GONE = 'var(--gone, #B23A2E)';
export const GONE_WASH = 'var(--gone-wash, #FAEEEB)';
export const KEPT = 'var(--kept, #1C6B4A)';

/* ---------- type ---------- */
export const F_HEAD = 'var(--f-head, "Bricolage Grotesque", sans-serif)';
export const F_BODY = 'var(--f-body, "IBM Plex Sans", "IBM Plex Sans Devanagari", system-ui, sans-serif)';
/** No longer a handwriting face — the system sans stack, like everything else. */
export const F_HAND =
  'var(--f-hand, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';

/** The one radius. Pills use 999, the mobile bottom sheet 10px on its top. */
export const R = 'var(--r, 3px)';

/* ================================================================== */
/*  Legacy token names — every one now points at the paper system.     */
/* ================================================================== */

/* ---------- surfaces ---------- */
export const NAVY = PAPER;
export const NAVY_DEEP = PAPER_SUNK;
export const NAVY_ALT = SHEET;
export const CARD = SHEET;
export const CARD_SOFT = PAPER_SUNK;
export const BORDER = RULE_SOFT;
export const BORDER_STRONG = RULE;

/* ---------- type ---------- */
export const TEXT = INK;
export const TEXT_SECONDARY = INK_SOFT;
/* Deliberately --ink-soft, not --pencil: meta labels must clear 4.5:1 on
   paper, and --pencil only does so as a short handwritten line. */
export const TEXT_MUTED = INK_SOFT;

/* ---------- brand accents ---------- */
export const AMBER = BRAND;
export const ORANGE = BRAND;
export const ORANGE_DEEP = BRAND_DEEP;
export const AMBER_BRIGHT = BRAND;

/* ---------- semantic ---------- */
export const SUCCESS = KEPT;
export const DANGER = GONE;
/** No amber anywhere: an unfinished thing is quiet ink, never a warning. */
export const WARNING = INK_SOFT;

/* ---------- composites ---------- */
/** Primary fills use the electric blue; text and outlines use BRAND. */
export const BRAND_GRADIENT = BRAND_ACTION;
export const BRAND_GRADIENT_DEEP = BRAND_DEEP;
export const CHAT_GRADIENT = BRAND_ACTION;
export const PAGE_BG = PAPER;
/** Panels carry a hairline rule instead of a shadow; only popovers float. */
export const CARD_SHADOW = 'none';
export const HERO_SHADOW = 'none';
/** The one shadow left in the system — floating popovers and sheets. */
export const POPOVER_SHADOW = 'var(--popover-shadow, 0 6px 22px rgba(22,31,43,.13))';
/** Text ON a brand-filled control. Dark ink read fine on the old bright
 * cyan; on electric blue (#0057FF) it must be white. Only ever use this on
 * a BRAND/BRAND_ACTION/BRAND_GRADIENT fill — never on a pale wash. */
export const ON_AMBER = '#FFFFFF';
/** The nav sits on paper, edge to edge — no glass, no dark bar. */
export const GLASS_BG = PAPER;
export const OVERLAY_BG = 'var(--overlay, rgba(22,31,43,0.34))';

/* ---------- card families ---------- */
/* Cards used to be three gradient families. One level of panel, one surface. */
export const TASK_GRADIENT = SHEET;
export const REVISION_GRADIENT = SHEET;
export const DOUBT_GRADIENT = SHEET;
export const DOUBT_ACCENT = BRAND;

/* ---------- FSRS review chips ----------
 * Again is the only one that means "you lost this", so it is the only one
 * allowed to be red. */
export const FSRS_AGAIN = GONE;
export const FSRS_HARD = PENCIL;
export const FSRS_GOOD = KEPT;
export const FSRS_EASY = BRAND;

/** One radius everywhere. Pills stay round; the mobile sheet keeps a 10px top. */
export const RADIUS = { chip: 999, sm: 3, md: 3, lg: 3, hero: 3, sheet: 10 } as const;

/* ---------- subject colours ---------- */

/** The five subject hues. They identify a subject on a chip — never a state. */
export const SUBJECT_SCALE = [
  'var(--s1, #2E7D5B)',
  'var(--s2, #1B5CF0)',
  'var(--s3, #8A5A2B)',
  'var(--s4, #7A4E9E)',
  'var(--s5, #C08A2E)',
] as const;

const [S1, S2, S3, S4, S5] = SUBJECT_SCALE;

const SUBJECT_COLORS: Record<string, string> = {
  physics: S2,
  chemistry: S1,
  'organic chemistry': S1,
  'inorganic chemistry': S1,
  'physical chemistry': S1,
  biology: S4,
  botany: S4,
  zoology: S4,
  mathematics: S5,
  maths: S5,
  math: S5,
  quant: S5,
  'quantitative aptitude': S5,
  history: S3,
  'history & culture': S3,
  'general studies': S3,
  'general awareness': S3,
  'polity & governance': S3,
  polity: S3,
  economy: S3,
  geography: S3,
  'indian society': S3,
  'international relations': S3,
  'economy & agriculture': S3,
  'environment & ecology': S1,
  'science & technology': S2,
  'internal security': S3,
  'disaster management': S3,
  'ethics, integrity & aptitude': S4,
  'current affairs': S3,
  csat: S5,
  dilr: S5,
  reasoning: S5,
  varc: S4,
  english: S4,
};

/** Quiet ink for anything outside the known subject list. */
export const SUBJECT_FALLBACK = INK_SOFT;

/** Stable hue for an unlisted subject, so the same name always reads alike. */
function hashedSubjectColor(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_SCALE[hash % SUBJECT_SCALE.length];
}

export function subjectColor(subject: string | null | undefined): string {
  if (!subject) return SUBJECT_FALLBACK;
  const name = (subject ?? '').trim().toLowerCase();
  if (!name) return SUBJECT_FALLBACK;
  return SUBJECT_COLORS[name] ?? hashedSubjectColor(name);
}

/**
 * Soft wash of a subject's colour, for chip and icon-tile backgrounds.
 * Built with color-mix so it works for hex values AND var() tokens alike.
 */
export function subjectTint(subject: string | null | undefined, alpha = 0.14): string {
  return `color-mix(in srgb, ${subjectColor(subject)} ${alpha * 100}%, transparent)`;
}

/** Same idea for any colour — fixed hex or theme var() reference.
 * ALWAYS use this instead of a Tailwind `/NN` opacity modifier: Tailwind
 * silently drops an opacity modifier applied to a CSS variable and emits no
 * declaration at all. */
export function tint(color: string, alpha = 0.14): string {
  return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
}

/* ------------------------------------------------------------------ */
/*  Paper texture                                                      */
/* ------------------------------------------------------------------ */

/* Two stacked feTurbulence layers — fine grain over long fibres — painted
 * ONCE as a fixed overlay across the app root, never on individual cards. */
const GRAIN_LAYER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";
const FIBRE_LAYER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.007 0.45' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='320' height='320' filter='url(%23f)'/%3E%3C/svg%3E\")";

/**
 * Theme variables, base typography, the shared component language and gentle
 * motion — all injected once per screen by the shells that render it.
 * Animations collapse under prefers-reduced-motion.
 */
export const MOTION_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Devanagari:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
:root {
  /* paper */
  --paper: #F2F7FF;
  --paper-sunk: #E8F0FF;
  --sheet: #FFFFFF;

  /* ink */
  --ink: #001847;
  --ink-soft: #002F8A;
  --pencil: #4A6BA8;

  /* lines */
  --rule: #C7DAFF;
  --rule-soft: #E8F0FF;

  /* action — electric blue ink + blue filled actions (cyan retired 2026-09-27) */
  --brand: #0057FF;
  --brand-deep: #003AB0;
  --brand-action: #0057FF;
  --brand-wash: #E8F0FF;

  /* state */
  --gone: #B23A2E;
  --gone-wash: #FAEEEB;
  --kept: #1C6B4A;

  /* subjects — chips only */
  --s1: #2E7D5B; --s2: #1B5CF0; --s3: #8A5A2B; --s4: #7A4E9E; --s5: #C08A2E;

  --r: 3px;

  --f-head: "Bricolage Grotesque", sans-serif;
  --f-body: "IBM Plex Sans", "IBM Plex Sans Devanagari", system-ui, sans-serif;
  --f-hand: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  /* overlays & floating shadows */
  --overlay: rgba(22,31,43,0.34);
  --popover-shadow: 0 6px 22px rgba(22,31,43,.13);

  /* Vicharree chat surfaces (CoachScreen) — light: the chat sits on paper. */
  --chat-deep: #F2F7FF;
  --chat-panel: #FFFFFF;
  --chat-surface: rgba(0,87,255,0.05);
  --chat-surface-strong: rgba(0,87,255,0.10);
  --chat-edge: #C7DAFF;
  --chat-text: #001847;
  --chat-dim: #002F8A;
  --chat-accent-soft: #0057FF;
  --chat-veil: rgba(242,247,255,0.92);
  --chat-placeholder: rgba(90,100,114,0.65);
  --chat-danger: #B23A2E;
  --chat-green: #1C6B4A;

  /* Vision Board map surfaces (visionBoardTheme) — light: a paper map. */
  --map-page: #F2F7FF;
  --map-page-mid: #F5F8FF;
  --map-page-deep: #E8F0FF;
  --map-card: #FFFFFF;
  --map-card-raised: #F5F8FF;
  --map-rule: #C7DAFF;
  --map-rule-strong: #A8C6FF;
  --map-text: #001847;
  --map-text-soft: #002F8A;
  --map-text-muted: #4A6BA8;
  --map-weak: #C2372A;
  --map-moderate: #9A6A00;
  --map-strong: #1C6B4A;
  --map-untouched: #5F6C84;
  --map-shadow: rgba(22,31,43,0.10);
  --map-shadow-strong: rgba(22,31,43,0.16);

  /* Today-screen surfaces (TodayScreen's scoped palette). */
  --td-bg: #F2F7FF;
  --td-page-bg:
    radial-gradient(circle at 78% 8%, rgba(0,87,255,.10), transparent 28rem),
    radial-gradient(circle at 12% 72%, rgba(0,87,255,.06), transparent 24rem),
    linear-gradient(135deg, #F2F7FF 0%, #F9FBFF 52%, #EDF3FF 100%);
  --td-surface: #FFFFFF;
  --td-surface-bg: linear-gradient(135deg, rgba(255,255,255,.98), rgba(250,249,246,.94));
  --td-chip-hover-bg: linear-gradient(135deg, #F0F5FF, #E8EFFF);
  --td-chip-hover-border: #8FB5FF;
  --td-sunk: #E8F0FF;
  --td-border: #C7DAFF;
  --td-shadow: 0 1px 3px rgba(22,31,43,.06);
  --td-panel-shadow: 0 1px 0 rgba(235,231,222,.8), 0 12px 35px rgba(22,31,43,.03);
  --td-amber-ink: #B07800;
  --td-grade-again: #0039A8;
  --td-grade-hard: #0049D6;
  --td-grade-easy: #2E6FE8;
  --td-text: #001847;
  --td-text-done: #999999;
  --td-muted: #6B7285;
  --td-faint: #A8ADBD;
  --td-overdue: #0039A8;
  --td-overdue-wash: rgba(14,42,99,0.06);
  --td-card-bg: linear-gradient(145deg, rgba(255,255,255,.9), rgba(247,250,255,.66));
  --td-card-border: rgba(255,255,255,.75);
  --td-card-shadow: 0 4px 16px rgba(0,87,255,.07), 0 1px 3px rgba(22,31,43,.06), inset 0 1px 0 rgba(255,255,255,.85);
  --td-done-bg: linear-gradient(135deg, rgba(242,247,255,.98), rgba(232,240,255,.94));
  --td-done-line: #C9CEDC;
  --td-box-border: #C4C9D8;
  --td-edit: #B2B7C6;
  --td-add-bg: linear-gradient(135deg, rgba(0,87,255,.05), rgba(242,247,255,.7));
  --td-ghost-hover: rgba(27, 92, 240, 0.06);
  --td-glance-bg: linear-gradient(150deg, rgba(255,255,255,.92), rgba(250,249,246,.74));
  --td-glance-border: rgba(255,255,255,.7);
}
/* THE LIGHT/DARK SWITCH IS REAL AGAIN (founder instruction, 2026-09-30):
   the student picks Light or Dark (sun/moon toggle in the app header), the
   choice is stored, and this block swaps EVERY token — so all screens flip
   together and no surface is ever left on the wrong theme. */
.vicharak-app.vicharak-dark {
  color-scheme: dark;

  /* paper → deep navy night surfaces */
  --paper: #0A0F1E;
  --paper-sunk: #111A31;
  --sheet: #0F1830;

  /* ink → off-white */
  --ink: #EDF2FC;
  --ink-soft: #A9B7D0;
  --pencil: #8493B0;

  /* lines */
  --rule: #27355A;
  --rule-soft: #1C2846;

  /* action — the same electric blue family, lifted so TEXT stays legible.
     Fills (--brand-action) stay #0057FF and keep their white ink. */
  --brand: #5E97FF;
  --brand-deep: #85B0FF;
  --brand-action: #0057FF;
  --brand-wash: #14264D;

  /* state */
  --gone: #FF7B6E;
  --gone-wash: #35191A;
  --kept: #3ECF8E;

  /* subjects — lifted for contrast on navy */
  --s1: #52C08E; --s2: #6FA1FF; --s3: #D29B62; --s4: #B490E0; --s5: #E3B45C;

  /* overlays & floating shadows */
  --overlay: rgba(2,6,16,0.6);
  --popover-shadow: 0 6px 22px rgba(0,0,0,.55);

  /* Vicharree chat — the premium deep-navy chat surface. */
  --chat-deep: #070C22;
  --chat-panel: #0D1430;
  --chat-surface: rgba(148, 178, 255, 0.08);
  --chat-surface-strong: rgba(148, 178, 255, 0.14);
  --chat-edge: rgba(148, 178, 255, 0.22);
  --chat-text: #EAF0FF;
  --chat-dim: #93A5CE;
  --chat-accent-soft: #6C9BFF;
  --chat-veil: rgba(7, 12, 34, 0.92);
  --chat-placeholder: rgba(178, 198, 255, 0.45);
  --chat-danger: #FF6B35;
  --chat-green: #3ECF8E;

  /* Vision Board map — the navy pin board. */
  --map-page: #0A0F1E;
  --map-page-mid: #0B1329;
  --map-page-deep: #070B16;
  --map-card: #0D1B3E;
  --map-card-raised: #142347;
  --map-rule: #1E3060;
  --map-rule-strong: #2B4380;
  --map-text: #EAF2FF;
  --map-text-soft: #A8C8FF;
  --map-text-muted: #7D9BD4;
  --map-weak: #FF6B6B;
  --map-moderate: #FBBF24;
  --map-strong: #34D399;
  --map-untouched: #6B7C9E;
  --map-shadow: rgba(3,6,15,0.5);
  --map-shadow-strong: rgba(3,6,15,0.62);

  /* Today screen at night. */
  --td-bg: #0A0F1E;
  --td-page-bg:
    radial-gradient(circle at 78% 8%, rgba(94,151,255,.08), transparent 28rem),
    radial-gradient(circle at 12% 72%, rgba(0,87,255,.06), transparent 24rem),
    linear-gradient(135deg, #0A0F1E 0%, #0C1428 52%, #0A0F1E 100%);
  --td-surface: #0F1830;
  --td-surface-bg: linear-gradient(135deg, rgba(17,25,48,.98), rgba(13,20,40,.94));
  --td-chip-hover-bg: linear-gradient(135deg, #14264D, #0F1F42);
  --td-chip-hover-border: #3A63B8;
  --td-sunk: #111A31;
  --td-border: #27355A;
  --td-shadow: 0 1px 3px rgba(0,0,0,.3);
  --td-panel-shadow: 0 1px 0 rgba(39,53,90,.6), 0 12px 35px rgba(0,0,0,.25);
  --td-amber-ink: #E8B84B;
  --td-grade-again: #7FA8FF;
  --td-grade-hard: #6FA1FF;
  --td-grade-easy: #8FB5FF;
  --td-text: #EDF2FC;
  --td-text-done: #71809E;
  --td-muted: #A9B7D0;
  --td-faint: #7686A6;
  --td-overdue: #8FB5FF;
  --td-overdue-wash: rgba(94,151,255,0.10);
  --td-card-bg: linear-gradient(145deg, rgba(20,29,56,.92), rgba(15,24,48,.7));
  --td-card-border: rgba(94,151,255,.22);
  --td-card-shadow: 0 4px 16px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.3), inset 0 1px 0 rgba(148,178,255,.10);
  --td-done-bg: linear-gradient(135deg, rgba(14,21,42,.98), rgba(11,17,34,.94));
  --td-done-line: #3A4668;
  --td-box-border: #4A5878;
  --td-edit: #6B7A9C;
  --td-add-bg: linear-gradient(135deg, rgba(0,87,255,.12), rgba(10,15,30,.7));
  --td-ghost-hover: rgba(94, 151, 255, 0.10);
  --td-glance-bg: linear-gradient(150deg, rgba(18,26,50,.92), rgba(13,20,40,.74));
  --td-glance-border: rgba(94,151,255,.18);
}
.vicharak-app, .vicharak-app.vicharak-light {
  color-scheme: light;
  position: relative;
  z-index: 2;
  font-family: var(--f-body);
  font-size: 15px;
  line-height: 1.5;
  background: var(--paper);
  color: var(--ink);
  /* Nothing inside the app may widen the page: a child that overshoots the
     viewport is clipped instead of dragging the whole layout sideways.
     (clip, not hidden — it creates no scroll container, so sticky headers
     and the sticky bottom nav keep working.) */
  overflow-x: clip;
}
/* One fixed texture overlay for the whole app — never per card. */
.vicharak-app::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  opacity: 0.06;
  mix-blend-mode: multiply;
  background-image: ${GRAIN_LAYER}, ${FIBRE_LAYER};
  background-repeat: repeat, repeat;
}
/* At night the multiply grain would read as dirt — it flips to a faint
   screen-blended texture instead. */
.vicharak-app.vicharak-dark::after {
  mix-blend-mode: screen;
  opacity: 0.04;
}
/* A screen that asks for a flat, clean page opts out of the texture. */
.vicharak-app.vicharak-plain::after { display: none; }
.vicharak-app h1, .vicharak-app h2, .vicharak-app h3 { font-family: var(--f-body); font-weight: 600; letter-spacing: 0; }
/* Page titles — the date, the month. */
.vicharak-title { font-family: var(--f-head); font-weight: 800; font-size: 1.8rem; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); }
/* Text the STUDENT entered or chose. Sized for sans, not for a cursive face. */
.vicharak-hand { font-family: var(--f-hand); font-weight: 500; font-size: 1rem; line-height: 1.35; }
/* The app writing in the margin — one short line, no box, no illustration. */
.vicharak-empty { font-family: var(--f-hand); font-weight: 400; font-size: 0.9rem; line-height: 1.4; color: var(--pencil); }
/* Devanagari sits in the body face, a touch larger. */
.vicharak-app [lang="hi"] { font-family: var(--f-body); font-size: 0.9rem; font-weight: 500; }

/* Labels wrap on narrow screens instead of hiding their meaning behind an
   ellipsis. Rows grow vertically; the page never grows horizontally. */
.vicharak-app .truncate { overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }

/* ---------- one radius ---------- */
.vicharak-app .rounded-sm, .vicharak-app .rounded, .vicharak-app .rounded-md,
.vicharak-app .rounded-lg, .vicharak-app .rounded-xl, .vicharak-app .rounded-2xl,
.vicharak-app .rounded-3xl { border-radius: var(--r); }
/* ---------- no card shadows ---------- */
.vicharak-app .shadow, .vicharak-app .shadow-sm, .vicharak-app .shadow-md,
.vicharak-app .shadow-lg, .vicharak-app .shadow-xl, .vicharak-app .shadow-2xl { box-shadow: none; }

/* ---------- sentence case, everywhere ----------
 * An ALL-CAPS label is a shout, and paper doesn't shout. These two rules
 * retire every uppercase kicker and its letter-spacing across the app in one
 * place, so no screen has to be visited to un-shout it. */
.vicharak-app .uppercase { text-transform: none; }
.vicharak-app [class*="tracking-["], .vicharak-app .tracking-wide,
.vicharak-app .tracking-wider, .vicharak-app .tracking-widest { letter-spacing: 0; }
/* Nothing in the body face goes past 600; only .vicharak-title reaches 800. */
.vicharak-app .font-extrabold, .vicharak-app .font-black, .vicharak-app .font-bold { font-weight: 600; }

/* ---------- mobile legibility + touch targets ---------- */
.vicharak-app button, .vicharak-app [role="button"] { min-width: 44px !important; min-height: 44px !important; }
.vicharak-app [class*="text-[8px]"], .vicharak-app [class*="text-[9px]"],
.vicharak-app [class*="text-[10px]"], .vicharak-app [class*="text-[11px]"] { font-size: 12px !important; }
.vicharak-app [style*="font-size: 8px"], .vicharak-app [style*="font-size: 9px"],
.vicharak-app [style*="font-size: 10px"], .vicharak-app [style*="font-size: 11px"],
.vicharak-app [style*="font-size: 0.58rem"], .vicharak-app [style*="font-size: 0.63rem"],
.vicharak-app [style*="font-size: 0.65rem"], .vicharak-app [style*="font-size: 0.7rem"],
.vicharak-app [style*="font-size: 0.72rem"] { font-size: 12px !important; }
.vicharak-sheet { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)) !important; scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }
/* Long unbroken strings (URLs, formulas, pasted topic names) wrap instead of
   pushing a row wider than a phone screen. */
.vicharak-app p, .vicharak-app h1, .vicharak-app h2, .vicharak-app h3,
.vicharak-app li, .vicharak-app td, .vicharak-app label { overflow-wrap: break-word; }
/* Markdown code blocks and tables scroll inside their own card — never the page. */
.vicharak-app pre { max-width: 100%; overflow-x: auto; }
.vicharak-app table { max-width: 100%; display: block; overflow-x: auto; }
/* Media never widens a column. */
.vicharak-app img, .vicharak-app video, .vicharak-app canvas { max-width: 100%; }

/* ---------- buttons ---------- */
.vicharak-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; min-height: 44px; padding: 0.52rem 0.95rem; font-family: var(--f-body); font-size: 0.86rem; font-weight: 600; border-radius: var(--r); cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.vicharak-btn-primary { background: var(--brand-action); border: 1.5px solid var(--brand-action); color: #FFFFFF; }
.vicharak-btn-primary:hover { background: color-mix(in srgb, var(--brand-action) 82%, var(--brand-deep)); border-color: var(--brand-deep); }
.vicharak-btn-ghost { background: transparent; border: 1.5px solid var(--brand); color: var(--brand); }
.vicharak-btn-ghost:hover { background: var(--brand-wash); }
.vicharak-btn-plain { background: transparent; border: 1px solid var(--rule); color: var(--ink-soft); }
.vicharak-btn-plain:hover { background: var(--paper-sunk); }
.vicharak-btn:disabled { opacity: 0.45; cursor: default; }

/* ---------- list panel ---------- */
/* One sheet per group, rows divided by a hairline — no gaps, no per-row box. */
.vicharak-panel { background: var(--sheet); border: 1px solid var(--rule); border-radius: var(--r); overflow: hidden; }
.vicharak-rows > li + li, .vicharak-rows > div + div { border-top: 1px solid var(--rule-soft); }

/* ---------- checkbox ---------- */
.vicharak-box { width: 19px; height: 19px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border: 1.5px solid var(--ink-soft); border-radius: 3px 5px 2px 4px; transform: rotate(-1deg); background: transparent; transition: border-color 0.2s ease; }
.vicharak-box-dense { width: 17px; height: 17px; }
.vicharak-box-done { border-color: var(--kept); }
.vicharak-tick { stroke: var(--kept); stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 22; stroke-dashoffset: 22; }
.vicharak-box-done .vicharak-tick { animation: vicharakTick 0.3s ease-out forwards; }
@keyframes vicharakTick { to { stroke-dashoffset: 0; } }

/* ---------- struck-through task title ---------- */
.vicharak-struck { position: relative; }
.vicharak-struck::after { content: ''; position: absolute; left: 0; top: 54%; height: 1.5px; background: currentColor; right: -3px; animation: vicharakStrikeOut 0.34s ease-in-out both; }
@keyframes vicharakStrikeOut { from { right: 100%; } to { right: -3px; } }

/* ---------- chips ---------- */
.vicharak-chip { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 99px; border: 1px solid var(--rule); background: transparent; color: var(--ink-soft); font-family: var(--f-body); font-size: 0.77rem; font-weight: 500; white-space: nowrap; }
.vicharak-chip-on { background: var(--ink); border-color: var(--ink); color: var(--paper); }

/* ---------- forms ---------- */
/* 16px prevents iOS Safari zoom; scroll margin keeps focused controls above
   the software keyboard in long sheets and forms. */
.vicharak-app input, .vicharak-app textarea, .vicharak-app select {
  font-family: var(--f-body);
  font-size: 16px !important;
  color: var(--ink);
  min-height: 44px;
  scroll-margin-block: 35vh;
}
.vicharak-app input:focus, .vicharak-app textarea:focus, .vicharak-app select:focus { border-color: var(--brand); }
.vicharak-app input::placeholder, .vicharak-app textarea::placeholder { color: var(--pencil); }

/* ---------- nav ---------- */
/* Desktop: text links on paper. No pills, no fill. */
.vicharak-navlink { border-radius: 0; background: transparent; color: var(--ink-soft); font-weight: 500; }
.vicharak-navlink:hover { color: var(--ink); }
.vicharak-navlink-on { color: var(--ink); font-weight: 600; box-shadow: inset 0 -2px 0 var(--brand); }

/* ---------- the notebook device ---------- */
/* A single brand rule running the full height of the content column, with the
 * content indented past it. Desktop only — a phone has no margin to spare. */
@media (min-width: 60rem) {
  .vicharak-margin { position: relative; padding-left: 1.6rem; }
  .vicharak-margin::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 1.5px; background: color-mix(in srgb, var(--brand) 40%, transparent); }
}

/* ---------- focus ---------- */
.vicharak-app a:focus-visible, .vicharak-app button:focus-visible, .vicharak-app input:focus-visible,
.vicharak-app textarea:focus-visible, .vicharak-app select:focus-visible, .vicharak-app [tabindex]:focus-visible {
  outline: 2.5px solid var(--brand);
  outline-offset: 2px;
}

/* ---------- motion ---------- */
@keyframes vicharakRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vicharakFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes vicharakPop { 0% { transform: scale(1); } 45% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes vicharakToastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vicharakToastOut { to { opacity: 0; transform: translateY(6px); } }
@keyframes vicharakSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes vicharakPopupIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vicharakHerePulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 45%, transparent); } 50% { box-shadow: 0 0 0 7px transparent; } }
@keyframes vicharakStrike { from { width: 0; } to { width: 100%; } }
@keyframes vicharakCompleteOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(10px); } }
.vicharak-rise { animation: vicharakRise 0.3s ease-out both; }
.vicharak-fade { animation: vicharakFadeIn 0.4s ease-out both; }
.vicharak-pop { animation: vicharakPop 0.3s ease-out; }
.vicharak-toast { animation: vicharakToastIn 0.24s ease-out both, vicharakToastOut 0.4s ease-in 2.1s both; }
.vicharak-sheet { animation: vicharakSheetUp 0.26s ease-out both; }
.vicharak-popup { animation: vicharakPopupIn 0.22s ease-out both; }
.vicharak-here { animation: vicharakHerePulse 2.2s ease-out infinite; }
.vicharak-badge-glow { animation: none; }
.vicharak-strike { position: relative; }
.vicharak-strike::after { content: ''; position: absolute; left: 0; top: 54%; height: 1.5px; width: 100%; background: currentColor; animation: vicharakStrike 0.34s ease-in-out both; }
.vicharak-completing { animation: vicharakCompleteOut 0.4s ease-in 0.4s both; }
@keyframes vicharakCollectRow { 0% { opacity: 1; transform: translateY(0) scale(1); } 70% { opacity: 0.85; } 100% { opacity: 0; transform: translateY(var(--vicharak-collect-dy, -60px)) scale(0.72); } }
@keyframes vicharakCollectLand { 0% { transform: scale(0.7); opacity: 0; } 55% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.vicharak-collect-row { animation: vicharakCollectRow 0.62s cubic-bezier(0.4, 0, 0.2, 1) both; }
.vicharak-collect-land { animation: vicharakCollectLand 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.42s both; }
@keyframes vicharakShimmer { 0% { background-position: -180% 0; } 100% { background-position: 280% 0; } }
.vicharak-shimmer { background-image: linear-gradient(105deg, transparent 40%, color-mix(in srgb, var(--brand) 8%, transparent) 50%, transparent 60%); background-size: 220% 100%; background-repeat: no-repeat; animation: vicharakShimmer 2s linear infinite; }
.vicharak-scroll-x { scrollbar-width: none; -ms-overflow-style: none; }
.vicharak-scroll-x::-webkit-scrollbar { display: none; }
.vicharak-press { transition: transform 0.12s ease; }
.vicharak-press:active { transform: scale(0.98); }
.vicharak-task-list > li + li { border-top: 1px solid var(--rule-soft); }
.vicharak-task-cards { display: flex; flex-direction: column; }
.vicharak-task-cards > li + li { border-top: 1px solid var(--rule-soft); }
/* "Add to Home Screen" hint — pure decoration, no install prompt. */
@keyframes vicharakA2hsNudge { 0%, 100% { transform: translateY(0); opacity: 0.85; } 50% { transform: translateY(5px); opacity: 1; } }
@keyframes vicharakA2hsNudgeUp { 0%, 100% { transform: translateY(0); opacity: 0.85; } 50% { transform: translateY(-5px); opacity: 1; } }
@keyframes vicharakA2hsRing { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 45%, transparent); } 70% { box-shadow: 0 0 0 12px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
.vicharak-a2hs-down { animation: vicharakA2hsNudge 1.5s ease-in-out infinite; }
.vicharak-a2hs-up { animation: vicharakA2hsNudgeUp 1.5s ease-in-out infinite; }
.vicharak-a2hs-ring { animation: vicharakA2hsRing 1.8s ease-out infinite; }
@media (min-width: 1024px) {
  .vicharak-fab { bottom: 28px !important; }
}
@media (prefers-reduced-motion: reduce) {
  .vicharak-app *, .vicharak-app *::before, .vicharak-app *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ---------- consistent bottom clearance, every screen ----------
   THE one bottom padding for scrollable tab content. It clears the sticky
   bottom nav (~68px incl. its safe-area strip), the floating Vicharree
   launcher / FABs (48px sitting 80px up), and the device safe-area inset
   (iOS home indicator, Android gesture nav). Screens use this class instead
   of ad-hoc pb-* values, so the last card is always fully reachable.
   Desktop (≥768px) has the sidebar instead of a bottom nav — a compact
   2.5rem is enough there. */
.vicharak-screen-pad { padding-bottom: calc(8rem + env(safe-area-inset-bottom, 0px)); }
@media (min-width: 768px) { .vicharak-screen-pad { padding-bottom: 2.5rem; } }
`;
