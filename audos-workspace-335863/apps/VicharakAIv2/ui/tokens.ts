/**
 * Design tokens (§15). Sourced from the space theme CSS variables (with the
 * workspace's dark-navy fallbacks) so the app inherits workspace branding.
 * ONE blue accent — the cyan highlight scale is deliberately not referenced.
 * No gradients. Colour beyond blue appears only in concept-strength cells.
 */

export const ACCENT = 'var(--space-brand-primary-600, #0057ff)';
export const ACCENT_STRONG = 'var(--space-brand-primary-500, #1a6dff)';
export const ACCENT_SOFT = 'color-mix(in srgb, var(--space-brand-primary-600, #0057ff) 16%, transparent)';

export const PAGE = 'var(--space-surface-page, #0a0f1e)';
export const CARD = 'var(--space-surface-card, #0d1b3e)';
export const CARD_STRONG = 'var(--space-surface-panel-strong, #0f2050)';
export const MUTED_SURFACE = 'var(--space-surface-muted, #142347)';
export const BORDER = 'var(--space-border-default, #1e3060)';
export const BORDER_STRONG = 'var(--space-border-strong, #2b4380)';

export const TEXT = 'var(--space-text-primary, #ffffff)';
export const TEXT_SECONDARY = 'var(--space-text-secondary, #a8c8ff)';
export const TEXT_MUTED = 'var(--space-text-muted, #7d9bd4)';
export const ON_ACCENT = 'var(--space-text-on-primary, #ffffff)';

/** Colour is allowed ONLY for concept-strength indicators (§15). */
export const STRENGTH_COLORS = {
  strong: 'var(--space-semantic-success-600, #22c55e)',
  medium: 'var(--space-semantic-warning-600, #fbbf24)',
  weak: 'var(--space-semantic-danger-600, #f87171)',
  untested: 'var(--space-surface-muted, #142347)',
} as const;

/** B&W banner palette (§10, §15) — black/white only, no colour. */
export const BANNER_BG = '#000000';
export const BANNER_FG = '#ffffff';

/** Minimum touch target (§15). */
export const TOUCH = 44;

export const RADIUS = { card: 16, control: 12, chip: 999 } as const;

export const FONT =
  'var(--space-font-body, "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)';
