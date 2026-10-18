/**
 * VicharakAI's design system — one place, used by every screen of the app.
 *
 * Two palettes, one set of tokens. Every colour below is a CSS variable
 * reference; the concrete values live in MOTION_CSS — dark by default (deep
 * midnight navy, electric-blue → cyan gradients, soft white type) and a clean
 * light palette (white/off-white surfaces, dark ink, the same electric-blue
 * family deepened for contrast on white) when the app root carries the
 * `vicharak-light` class. ThemeContext.tsx decides which class is active and
 * persists the choice, so components keep importing the same constants.
 *
 * NOTE: the AMBER/ORANGE export names are legacy — they now resolve to the
 * brand's electric blue (primary) and cyan (accent). Keeping the names avoids
 * touching every screen; the values follow workspace-branding.json.
 *
 * The tone is warm and motivational, never a clinical analytics dashboard.
 */

/* ---------- surfaces ---------- */
export const NAVY = 'var(--vicharak-page)';
export const NAVY_DEEP = 'var(--vicharak-page-deep)';
export const NAVY_ALT = 'var(--vicharak-page-alt)';
export const CARD = 'var(--vicharak-card)';
export const CARD_SOFT = 'var(--vicharak-card-soft)';
export const BORDER = 'var(--vicharak-border)';
export const BORDER_STRONG = 'var(--vicharak-border-strong)';

/* ---------- type ---------- */
export const TEXT = 'var(--vicharak-text)';
export const TEXT_SECONDARY = 'var(--vicharak-text-secondary)';
export const TEXT_MUTED = 'var(--vicharak-text-muted)';

/* ---------- brand accents ---------- */
export const AMBER = 'var(--vicharak-amber)';
export const ORANGE = 'var(--vicharak-orange)';
export const ORANGE_DEEP = 'var(--vicharak-orange-deep)';
export const AMBER_BRIGHT = 'var(--vicharak-amber-bright)';

/* ---------- semantic ---------- */
export const SUCCESS = 'var(--vicharak-success)';
export const WARNING = 'var(--vicharak-warning)';
export const DANGER = 'var(--vicharak-danger)';

/* ---------- composites ---------- */
/** The one gradient. Buttons, active tabs, hero cards, progress fills.
 * Weighted deep-blue → electric-blue with only a cyan glint at the end so
 * white ON_AMBER text stays readable across the whole fill. */
export const BRAND_GRADIENT = `linear-gradient(135deg, ${ORANGE_DEEP}, ${AMBER} 60%, ${ORANGE})`;
export const BRAND_GRADIENT_DEEP = `linear-gradient(140deg, ${ORANGE_DEEP}, ${AMBER} 55%, ${ORANGE})`;
export const PAGE_BG = `linear-gradient(180deg, ${NAVY} 0%, var(--vicharak-page-mid) 55%, ${NAVY} 100%)`;
export const CARD_SHADOW = 'var(--vicharak-card-shadow)';
export const HERO_SHADOW = 'var(--vicharak-hero-shadow)';
/** Readable ink for anything sitting on an amber/orange fill. */
export const ON_AMBER = 'var(--vicharak-on-amber)';
/** Frosted-glass fill for the bottom nav and toasts. */
export const GLASS_BG = 'var(--vicharak-glass)';
/** Dimmed backdrop behind sheets and modals. */
export const OVERLAY_BG = 'var(--vicharak-overlay)';

/** Radii, in px, matching the 16–20px card language (hero cards go to 24). */
export const RADIUS = { chip: 999, sm: 12, md: 16, lg: 20, hero: 24, sheet: 28 } as const;

/* ---------- subject colours ---------- */

const SUBJECT_COLORS: Record<string, string> = {
  physics: '#3B82F6',
  chemistry: '#10B981',
  'organic chemistry': '#10B981',
  'inorganic chemistry': '#10B981',
  'physical chemistry': '#10B981',
  biology: '#8B5CF6',
  botany: '#8B5CF6',
  zoology: '#8B5CF6',
  mathematics: '#F59E0B',
  maths: '#F59E0B',
  math: '#F59E0B',
  quant: '#F59E0B',
  'quantitative aptitude': '#F59E0B',
  history: '#14B8A6',
  'history & culture': '#14B8A6',
  'general studies': '#14B8A6',
  'general awareness': '#14B8A6',
  'polity & governance': '#14B8A6',
  geography: '#14B8A6',
  'indian society': '#14B8A6',
  'international relations': '#14B8A6',
  'economy & agriculture': '#14B8A6',
  'environment & ecology': '#14B8A6',
  'science & technology': '#14B8A6',
  'internal security': '#14B8A6',
  'disaster management': '#14B8A6',
  'ethics, integrity & aptitude': '#14B8A6',
  'current affairs': '#14B8A6',
  csat: '#14B8A6',
  dilr: '#14B8A6',
  reasoning: '#14B8A6',
  varc: '#8B5CF6',
  english: '#8B5CF6',
};

/** Neutral grey for anything outside the known subject list. */
export const SUBJECT_FALLBACK = '#6B7280';

export function subjectColor(subject: string | null | undefined): string {
  if (!subject) return SUBJECT_FALLBACK;
  return SUBJECT_COLORS[subject.trim().toLowerCase()] ?? SUBJECT_FALLBACK;
}

/**
 * Soft wash of a subject's colour, for chip and icon-tile backgrounds.
 * Built with color-mix so it works for hex values AND var() tokens alike.
 */
export function subjectTint(subject: string | null | undefined, alpha = 0.14): string {
  return `color-mix(in srgb, ${subjectColor(subject)} ${alpha * 100}%, transparent)`;
}

/** Same idea for any colour — fixed hex or theme var() reference. */
export function tint(color: string, alpha = 0.14): string {
  return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
}

/**
 * Theme variables + gentle motion, all injected once by App.tsx.
 * Dark values sit on `.vicharak-app`; the `.vicharak-light` class overrides them.
 * Animations collapse under prefers-reduced-motion.
 */
export const MOTION_CSS = `
.vicharak-app {
  color-scheme: dark;
  --vicharak-page: #0A0F1E;
  --vicharak-page-deep: #070B16;
  --vicharak-page-alt: #0F1730;
  --vicharak-page-mid: #121C3A;
  --vicharak-card: #141C33;
  --vicharak-card-soft: #1B2542;
  --vicharak-border: #2A3554;
  --vicharak-border-strong: #3C4A70;
  --vicharak-text: #F4F6FB;
  --vicharak-text-secondary: #B8C2DC;
  --vicharak-text-muted: #93A0BF;
  --vicharak-amber: #0057FF;
  --vicharak-orange: #00D4FF;
  --vicharak-orange-deep: #0041CC;
  --vicharak-amber-bright: #4DDFFF;
  --vicharak-success: #4ADE80;
  --vicharak-warning: #FBBF24;
  --vicharak-danger: #F87171;
  --vicharak-on-amber: #FFFFFF;
  --vicharak-card-shadow: 0 4px 12px rgba(0,0,0,0.35);
  --vicharak-hero-shadow: 0 12px 32px rgba(0,87,255,0.30);
  --vicharak-glass: rgba(20,28,51,0.92);
  --vicharak-overlay: rgba(4,7,16,0.72);
}
.vicharak-app.vicharak-light {
  color-scheme: light;
  --vicharak-page: #FAFAFA;
  --vicharak-page-deep: #F1F3F8;
  --vicharak-page-alt: #FFFFFF;
  --vicharak-page-mid: #FFFFFF;
  --vicharak-card: #FFFFFF;
  --vicharak-card-soft: #F0F6FF;
  --vicharak-border: #E4E6EE;
  --vicharak-border-strong: #CBD0DE;
  --vicharak-text: #1A1A2E;
  --vicharak-text-secondary: #45495E;
  --vicharak-text-muted: #6E7488;
  --vicharak-amber: #0047D6;
  --vicharak-orange: #0095CC;
  --vicharak-orange-deep: #003AAD;
  --vicharak-amber-bright: #0057FF;
  --vicharak-success: #16A34A;
  --vicharak-warning: #D97706;
  --vicharak-danger: #DC2626;
  --vicharak-on-amber: #FFFFFF;
  --vicharak-card-shadow: 0 2px 10px rgba(26,26,46,0.07);
  --vicharak-hero-shadow: 0 12px 26px rgba(0,71,214,0.22);
  --vicharak-glass: rgba(255,255,255,0.92);
  --vicharak-overlay: rgba(26,26,46,0.45);
}
@keyframes vicharakRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vicharakFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes vicharakPop { 0% { transform: scale(1); } 45% { transform: scale(1.26); } 100% { transform: scale(1); } }
@keyframes vicharakToastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vicharakToastOut { to { opacity: 0; transform: translateY(6px); } }
@keyframes vicharakSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes vicharakPopupIn { from { opacity: 0; transform: translateY(28px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes vicharakHerePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.5); } 50% { box-shadow: 0 0 0 9px rgba(0,212,255,0); } }
@keyframes vicharakStrike { from { width: 0; } to { width: 100%; } }
@keyframes vicharakCompleteFade { from { opacity: 1; } to { opacity: 0.4; } }
.vicharak-rise { animation: vicharakRise 0.36s ease-out both; }
.vicharak-fade { animation: vicharakFadeIn 0.5s ease-out both; }
.vicharak-pop { animation: vicharakPop 0.32s ease-out; }
.vicharak-toast { animation: vicharakToastIn 0.28s ease-out both, vicharakToastOut 0.4s ease-in 2.1s both; }
.vicharak-sheet { animation: vicharakSheetUp 0.28s ease-out both; }
.vicharak-popup { animation: vicharakPopupIn 0.34s cubic-bezier(0.22, 1, 0.36, 1) both; }
.vicharak-here { animation: vicharakHerePulse 2.2s ease-out infinite; }
.vicharak-strike { position: relative; }
.vicharak-strike::after { content: ''; position: absolute; left: 0; top: 50%; height: 2px; width: 100%; border-radius: 2px; background: currentColor; transform: translateY(-50%); animation: vicharakStrike 0.6s ease-in-out both; }
.vicharak-completing { animation: vicharakCompleteFade 0.3s ease-out 0.62s both; }
.vicharak-scroll-x { scrollbar-width: none; -ms-overflow-style: none; }
.vicharak-scroll-x::-webkit-scrollbar { display: none; }
.vicharak-app input::placeholder, .vicharak-app textarea::placeholder { color: var(--vicharak-text-muted); }
@media (prefers-reduced-motion: reduce) {
  .vicharak-rise, .vicharak-fade, .vicharak-pop, .vicharak-toast, .vicharak-sheet, .vicharak-popup, .vicharak-here, .vicharak-strike::after, .vicharak-completing { animation: none !important; }
}
`;
