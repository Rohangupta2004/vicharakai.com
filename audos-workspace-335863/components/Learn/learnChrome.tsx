import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  PAPER_BG,
  PAPER_FONTS_IMPORT,
  PAPER_FONT_BODY,
  PAPER_FONT_DISPLAY,
  PAPER_G_BRAND,
  PAPER_G_CARD,
  PAPER_G_RULE,
  PAPER_G_TEXT,
  PAPER_G_WASH,
  PAPER_INK,
  PAPER_INK_FAINT,
  PAPER_INK_SOFT,
  PAPER_RULE,
  withAlpha,
} from '../landingTokens';
import { LANDING_HREF, LEARN_HREF, learnArticleHref } from './learnRoute';
import { readMinutes } from './articles';
import type { Article } from './articles';

/**
 * THE LEARN HUB — shared page chrome.
 *
 * The /learn pages are part of the SIGNED-OUT LANDING EXPERIENCE, not part of
 * the app, so they are painted from the same PAPER_* tokens as
 * components/LandingPage.tsx — as of 2026-09-30 a warm-white canvas in dark
 * ink behind ink hairline rules, Bricolage Grotesque over IBM Plex Sans, and
 * one accent: electric blue #0057FF (no cyan). Nothing here declares a colour
 * of its own — re-tinting the landing page re-tints these pages with it, and
 * the accent appears as TEXT in its deepened tint (BRAND_TEXT below).
 *
 * SCROLLING: like components/StaticPages.tsx, each page is its own
 * `100dvh` scroll container. The OS shell (Desktop.tsx) pins html/body, so a
 * page that relied on the window scrolling would be stuck at one viewport on
 * a phone.
 *
 * TINTS are computed with withAlpha rather than written as Tailwind `/NN`
 * opacity modifiers, which emit no CSS at all on a var() or arbitrary colour.
 */

const BRAND_TINT_8 = withAlpha('#0057FF', 0.08);
const BRAND_TINT_22 = withAlpha('#0057FF', 0.3);
/** The accent as text on the light sheet — a deepened blue that clears AA at
 *  label size, exactly as on the landing page. */
const BRAND_TEXT = '#0047D6';

export const LEARN_CSS = `${PAPER_FONTS_IMPORT}
  .learn {
    min-height: 100%;
    background: ${PAPER_BG};
    color: ${PAPER_INK};
    font-family: ${PAPER_FONT_BODY};
    font-size: 17px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .learn h1, .learn h2, .learn h3 {
    font-family: ${PAPER_FONT_DISPLAY};
    font-weight: 800;
    letter-spacing: -0.022em;
    line-height: 1.06;
    margin: 0;
  }
  .learn p { margin: 0 0 1.05em; }
  .learn p:last-child { margin-bottom: 0; }
  .learn a { color: inherit; }

  /* ---- the sheet ---- */
  .learn-sheet { max-width: 64rem; margin: 0 auto; padding: 0 1.4rem; }
  .learn-sheet-narrow { max-width: 45rem; }
  .learn-rule { height: 1px; background: ${PAPER_G_RULE}; }

  /* ---- top bar: the landing page's own, minus the section nav ---- */
  .learn-top {
    position: sticky;
    top: 0;
    z-index: 40;
    background-color: rgba(252, 251, 248, 0.94);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid ${PAPER_RULE};
  }
  .learn-top-in {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.95rem 0;
  }
  .learn-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    color: ${PAPER_INK};
  }
  .learn-word {
    font-family: ${PAPER_FONT_DISPLAY};
    font-weight: 800;
    font-size: 1.16rem;
    letter-spacing: -0.02em;
  }
  .learn-word i {
    font-style: normal;
    background-image: ${PAPER_G_TEXT};
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
  .learn-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background-image: ${PAPER_G_BRAND};
    color: #FFFFFF;
    font-family: ${PAPER_FONT_DISPLAY};
    font-weight: 800;
    font-size: 0.95rem;
    flex: none;
  }
  .learn-mark img { width: 100%; height: 100%; border-radius: 8px; object-fit: cover; }
  .learn-home {
    flex: none;
    font-size: 0.88rem;
    font-weight: 600;
    color: ${PAPER_INK_SOFT};
    text-decoration: none;
    padding: 0.5rem 0.85rem;
    border: 1px solid ${PAPER_RULE};
    border-radius: 999px;
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .learn-home:hover { color: ${PAPER_INK}; border-color: ${BRAND_TINT_22}; }
  .learn-top-left { display: flex; align-items: center; gap: 1.15rem; min-width: 0; }
  .learn-top-link {
    position: relative;
    flex: none;
    font-size: 0.92rem;
    font-weight: 600;
    color: ${PAPER_INK};
    text-decoration: none;
    padding-bottom: 3px;
  }
  .learn-top-link::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    border-radius: 2px;
    background-image: ${PAPER_G_BRAND};
  }

  /* ---- reading progress: a 3px brand bar pinned to the very top of the
     sticky bar, driven imperatively from the scroll container ---- */
  .learn-progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background-image: ${PAPER_G_BRAND};
    transform: scaleX(0);
    transform-origin: left center;
    pointer-events: none;
    z-index: 60;
  }

  /* ---- breadcrumb ---- */
  .learn-crumb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: ${PAPER_INK_FAINT};
    margin: 0 0 1.6rem;
  }
  .learn-crumb a { color: ${PAPER_INK_SOFT}; text-decoration: none; font-weight: 600; }
  .learn-crumb a:hover { color: ${BRAND_TEXT}; }
  .learn-crumb span[aria-current] {
    color: ${PAPER_INK_FAINT};
    max-width: 24rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- the small caps label the landing page uses in its gutter ---- */
  .learn-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: ${BRAND_TEXT};
    margin: 0;
  }
  .learn-kicker::after {
    content: '';
    width: 14px;
    height: 2px;
    border-radius: 2px;
    background-image: ${PAPER_G_BRAND};
  }

  /* ---- footer ---- */
  .learn-footer {
    padding: 1.7rem 0 2.8rem;
    font-size: 0.87rem;
    color: ${PAPER_INK_SOFT};
  }
  .learn-footer nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
  }
  .learn-footer a { color: ${PAPER_INK_SOFT}; font-weight: 600; text-decoration: none; }
  .learn-footer a:hover { color: ${PAPER_INK}; }

  /* ---- index: the card grid ---- */
  .learn-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  @media (min-width: 40rem) { .learn-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.1rem; } }
  .learn-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid ${PAPER_RULE};
    border-radius: 12px;
    background-image: ${PAPER_G_CARD};
    text-decoration: none;
    color: ${PAPER_INK};
    box-shadow: 0 1px 2px rgba(22, 31, 43, 0.08);
    transition: transform 0.18s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  }
  .learn-card-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-bottom: 1px solid ${PAPER_RULE};
    background-color: #E9E6DE;
  }
  .learn-card-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.55rem;
    padding: 1.15rem 1.35rem 1.3rem;
  }
  .learn-card h2 {
    font-size: 1.24rem;
    line-height: 1.24;
    letter-spacing: -0.018em;
  }
  .learn-card p { font-size: 0.97rem; color: ${PAPER_INK_SOFT}; margin: 0; }
  .learn-card-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: auto;
    padding-top: 0.85rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: ${PAPER_INK_FAINT};
  }
  .learn-card-meta em { font-style: normal; color: ${PAPER_INK_FAINT}; }
  @media (hover: hover) and (min-width: 48rem) {
    .learn-card:hover {
      transform: translateY(-3px);
      border-color: ${BRAND_TINT_22};
      box-shadow: 0 10px 26px -14px rgba(0, 87, 255, 0.3);
    }
  }

  /* ---- article: the reading column ---- */
  .learn-article { color: ${PAPER_INK_SOFT}; }
  .learn-article h2 {
    font-size: clamp(1.32rem, 3.2vw, 1.7rem);
    line-height: 1.16;
    color: ${PAPER_INK};
    margin: 2.5rem 0 0.85rem;
  }
  .learn-article > *:first-child { margin-top: 0; }
  .learn-article p { font-size: 1.06rem; line-height: 1.75; }
  .learn-article ul {
    margin: 0 0 1.05em;
    padding: 0;
    list-style: none;
  }
  .learn-article li {
    position: relative;
    padding-left: 1.4rem;
    margin-bottom: 0.6rem;
    font-size: 1.04rem;
    line-height: 1.65;
  }
  .learn-article li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.68em;
    width: 8px;
    height: 2px;
    border-radius: 2px;
    background-image: ${PAPER_G_BRAND};
  }
  .learn-pull {
    margin: 2rem 0;
    padding: 1.1rem 1.25rem;
    border-left: 3px solid #0057FF;
    /* The tint is computed, never a /NN modifier — see withAlpha. */
    border-radius: 0 10px 10px 0;
    background-color: ${BRAND_TINT_8};
    font-family: ${PAPER_FONT_DISPLAY};
    font-weight: 600;
    font-size: 1.1rem;
    line-height: 1.4;
    letter-spacing: -0.012em;
    color: ${PAPER_INK};
  }
  .learn-pull p { margin: 0; font: inherit; color: inherit; }

  /* ---- article hero: the full-bleed image with the title sitting on a
     bottom-up shade, so white text always reads whatever the picture ---- */
  .learn-hero {
    position: relative;
    height: clamp(240px, 46vw, 420px);
    background-color: #101828;
    overflow: hidden;
  }
  .learn-hero > img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .learn-hero::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(9, 14, 22, 0.82) 0%,
      rgba(9, 14, 22, 0.46) 42%,
      rgba(9, 14, 22, 0.16) 70%,
      rgba(9, 14, 22, 0.28) 100%
    );
  }
  .learn-hero-back {
    position: absolute;
    top: 1.05rem;
    left: 0;
    right: 0;
    z-index: 1;
  }
  .learn-hero-back a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #FFFFFF;
    text-decoration: none;
    padding: 0.42rem 0.9rem;
    border-radius: 999px;
    background-color: rgba(9, 14, 22, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  .learn-hero-back a:hover { background-color: rgba(9, 14, 22, 0.68); border-color: rgba(255, 255, 255, 0.4); }
  .learn-hero-text {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    padding-bottom: clamp(1.2rem, 3.4vw, 2rem);
  }
  .learn-hero-text .learn-kicker { color: #9FC0FF; }
  .learn-hero-text .learn-kicker::after { background-image: linear-gradient(90deg, #9FC0FF, #FFFFFF); }
  .learn-hero-text h1 {
    margin-top: 0.7rem;
    color: #FFFFFF;
    font-size: clamp(1.45rem, 4.8vw, 2.7rem);
    max-width: 44rem;
    text-wrap: balance;
    text-shadow: 0 2px 18px rgba(9, 14, 22, 0.55);
  }
  .learn-hero-meta {
    margin: 0.8rem 0 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }
  @media (max-width: 40rem) { .learn-hero { height: 240px; } }

  /* ---- related articles at the foot of every article ---- */
  .learn-related {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid ${PAPER_RULE};
  }

  @media (prefers-reduced-motion: reduce) {
    .learn-card, .learn-home, .learn-hero-back a { transition: none; }
    .learn-card:hover { transform: none; }
  }
`;

export interface LearnChromeProps {
  brandName: string;
  logoUrl?: string;
}

function BrandWord({ brandName, logoUrl }: LearnChromeProps) {
  // “VicharakAI” is set exactly as the landing page sets it — the AI carries
  // the gradient text fill. Any other brand name renders plainly.
  const isVicharak = brandName.toLowerCase() === 'vicharakai';
  return (
    <a className="learn-brand" href={LANDING_HREF} data-testid="link-learn-brand">
      <span className="learn-mark">
        {logoUrl ? <img src={logoUrl} alt="" /> : brandName.charAt(0)}
      </span>
      <span className="learn-word">
        {isVicharak ? (
          <>
            Vicharak<i>AI</i>
          </>
        ) : (
          brandName
        )}
      </span>
    </a>
  );
}

/** Home → Learn → [Article]. The last crumb is plain text, never a link. */
export function LearnBreadcrumb({ article }: { article?: string }) {
  return (
    <nav className="learn-crumb" aria-label="Breadcrumb" data-testid="learn-breadcrumb">
      <a href={LANDING_HREF} data-testid="crumb-home">
        Home
      </a>
      <span aria-hidden="true">→</span>
      {article ? (
        <>
          <a href={LEARN_HREF} data-testid="crumb-learn">
            Learn
          </a>
          <span aria-hidden="true">→</span>
          <span aria-current="page" title={article}>
            {article}
          </span>
        </>
      ) : (
        <span aria-current="page">Learn</span>
      )}
    </nav>
  );
}

/**
 * One article card — the index grid and the “Keep reading” rail at the foot
 * of every article render exactly this, so the two surfaces can never drift.
 * The 16:9 thumbnail is the article's own hero image.
 */
export function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      className="learn-card"
      href={learnArticleHref(article.slug)}
      data-testid={`card-article-${article.slug}`}
    >
      <img className="learn-card-thumb" src={article.heroImage} alt={`${article.title} — ${article.kicker} article`} loading="lazy" />
      <div className="learn-card-body">
        <p className="learn-kicker">{article.kicker}</p>
        <h2>{article.title}</h2>
        <p>{article.teaser}</p>
        <p className="learn-card-meta">
          <em>{readMinutes(article)} min read</em>
        </p>
      </div>
    </a>
  );
}

/**
 * The full-page shell both /learn views render inside: its own scroll
 * container, the landing page's top bar, and the same compliance footer the
 * landing page and the legal pages carry.
 */
export function LearnShell({
  brandName,
  logoUrl,
  supportEmail,
  testId,
  scrollKey,
  showProgress = false,
  children,
}: LearnChromeProps & {
  supportEmail: string;
  testId: string;
  /** Renders the thin reading-progress bar across the top of the sticky bar
   *  and fills it as the visitor scrolls. On for articles, off for the index. */
  showProgress?: boolean;
  /** Changes whenever the visitor moves to a different page inside the hub.
   *  Moving between two articles keeps this component mounted, so the scroll
   *  container has to be sent back to the top by hand — otherwise the next
   *  article opens halfway down. */
  scrollKey: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (progressRef.current) progressRef.current.style.transform = 'scaleX(0)';
  }, [scrollKey]);

  // The progress bar is driven imperatively — a state update per scroll frame
  // would re-render the whole article for a 3px indicator.
  const handleScroll = () => {
    const el = scrollRef.current;
    const bar = progressRef.current;
    if (!el || !bar) return;
    const max = el.scrollHeight - el.clientHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, el.scrollTop / max) : 0})`;
  };

  return (
    <div
      ref={scrollRef}
      onScroll={showProgress ? handleScroll : undefined}
      className="learn h-screen overflow-y-auto"
      style={{ height: '100dvh', WebkitOverflowScrolling: 'touch' }}
      data-testid={testId}
    >
      <style>{LEARN_CSS}</style>

      <div className="learn-top">
        <div className="learn-sheet">
          <div className="learn-top-in">
            <div className="learn-top-left">
              <BrandWord brandName={brandName} logoUrl={logoUrl} />
              {/* The location marker: every /learn page is inside Learn, so the
                  link always wears the active underline. */}
              <a className="learn-top-link" href={LEARN_HREF} aria-current="true" data-testid="link-learn-nav">
                Learn
              </a>
            </div>
            <a className="learn-home" href={LANDING_HREF} data-testid="link-learn-home">
              Back to home
            </a>
          </div>
        </div>
        {showProgress ? <div className="learn-progress" ref={progressRef} aria-hidden="true" /> : null}
      </div>

      <main style={{ background: PAPER_G_WASH }}>{children}</main>

      <div className="learn-sheet">
        <div className="learn-rule" aria-hidden="true" />
        <footer className="learn-footer">
          <nav aria-label="Footer">
            <span>© 2026 {brandName}</span>
            <span aria-hidden="true">·</span>
            <a href="/about">About</a>
            <span aria-hidden="true">·</span>
            <a href="/terms">Terms</a>
            <span aria-hidden="true">·</span>
            <a href="/privacy">Privacy</a>
            <span aria-hidden="true">·</span>
            <a href="/refund">Refund Policy</a>
            <span aria-hidden="true">·</span>
            <a href="/contact">Contact</a>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
