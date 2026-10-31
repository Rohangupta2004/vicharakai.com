import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { usePageSeo } from './seoMeta';

export const SEO = {
  page: '#FCFBF8', panel: '#FFFFFF', section: '#F2F0E9', ink: '#161F2B',
  muted: '#4A5568', faint: '#5C677A', blue: '#0057FF', blueDeep: '#003AB0',
  gradient: 'linear-gradient(135deg, #0057FF, #003AB0)', rule: 'rgba(22,31,43,.12)',
};

export const startFree = () => { window.location.assign('/'); };

function runtimeLogoUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const config = (window as Window & { __SPACE_CONFIG__?: { desktop?: { branding?: { logoUrl?: string } } } }).__SPACE_CONFIG__;
  return config?.desktop?.branding?.logoUrl;
}

/** Shared sticky navbar for the landing page and every public SEO page. */
export function SEONavbar({ brandName = 'VicharakAI', logoUrl }: { brandName?: string; logoUrl?: string }) {
  const logo = logoUrl || runtimeLogoUrl();
  return <header className="seo-shared-nav"><style>{SHARED_NAV_CSS}</style><a className="seo-shared-brand" href="/" aria-label={`${brandName} home`}>{logo ? <img src={logo} alt={`${brandName} logo`} /> : <i>{brandName.charAt(0)}</i>}<b className="seo-shared-name">{brandName}</b></a><a className="seo-shared-cta" href="/">Start Free</a></header>;
}

export function SeoNav({ brandName, logoUrl }: { brandName: string; logoUrl?: string }) {
  return <SEONavbar brandName={brandName} logoUrl={logoUrl} />;
}

const SHARED_NAV_CSS = `
.seo-shared-nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:.75rem;min-height:64px;padding:.7rem max(1rem,calc((100vw - 72rem)/2));background:rgba(250,250,248,.95);border-bottom:1px solid rgba(20,26,36,.1);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.seo-shared-brand{display:inline-flex;align-items:center;gap:.6rem;min-width:0;color:#141A24;text-decoration:none}.seo-shared-brand img,.seo-shared-brand i{width:34px;height:34px;border-radius:9px;object-fit:contain;flex:none}.seo-shared-brand i{display:grid;place-items:center;background:linear-gradient(135deg,#0057FF,#003AB0);color:#fff;font-style:normal;font-weight:800}.seo-shared-name{font-family:Inter,system-ui,sans-serif;font-size:1.05rem;font-weight:800;letter-spacing:-.02em}.seo-shared-cta{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:.7rem 1rem;border-radius:999px;background:#0057FF;color:#fff!important;text-decoration:none!important;font-family:Inter,system-ui,sans-serif;font-size:.88rem;font-weight:800;box-shadow:0 8px 20px rgba(0,87,255,.2)}
@media(max-width:30rem){.seo-shared-name{display:none}.seo-shared-nav{min-height:58px}.seo-shared-brand img,.seo-shared-brand i{width:32px;height:32px}}
`;

export function SeoFooter({ brandName }: { brandName: string }) {
  return <footer className="seo-footer"><span>© 2026 {brandName}</span><a href="/jee">JEE Main</a><a href="/neet">NEET UG</a><a href="/neet-pg">NEET PG</a><a href="/exam">Exam Prep</a><a href="/prep">Study Guides</a><a href="/learn">Learn</a><a href="/study-methods">Study Methods</a><a href="/compare">Compare</a><a href="/about">About</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refund">Refund</a><a href="/contact">Contact</a></footer>;
}

export function CtaBand({ children }: { children: ReactNode }) {
  return <section className="seo-cta"><h2>{children}</h2><button onClick={startFree}>Start Free Trial</button></section>;
}

/**
 * The shared chrome every /exam, /compare and /sitemap page renders inside.
 *
 * It also owns that page's <head>: the host serves one document for every
 * route, so unless the page writes its own title, description, Open Graph
 * tags, robots directive, canonical and structured data, it inherits the
 * homepage's and reads to a crawler as a duplicate. See components/seoMeta.ts.
 */
export function SeoShell({ brandName, logoUrl, pageKey, metaTitle, metaDescription, keywords, canonicalPath, robots, ogType, jsonLd, children }: { brandName: string; logoUrl?: string; pageKey: string; metaTitle?: string; metaDescription?: string; keywords?: string[]; canonicalPath?: string; robots?: string; ogType?: 'website' | 'article'; jsonLd?: Array<Record<string, unknown>>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [pageKey]);
  usePageSeo({
    title: metaTitle ?? `${brandName} — exam preparation that adapts to you`,
    description: metaDescription ?? `${brandName} builds a personalised revision plan from what you actually study, schedules it on a spaced-repetition ladder, and tells you which topics are slipping.`,
    keywords,
    canonicalPath: canonicalPath ?? '/',
    robots,
    ogType,
    jsonLd,
  });
  return <div ref={ref} className="seo-root"><style>{CSS}</style><SeoNav brandName={brandName} logoUrl={logoUrl} /><main>{children}</main><SeoFooter brandName={brandName} /></div>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.seo-root{height:100dvh;overflow-y:auto;background:${SEO.page};color:${SEO.ink};font-family:"IBM Plex Sans",system-ui,sans-serif;-webkit-overflow-scrolling:touch}.seo-root *{box-sizing:border-box}.seo-root h1,.seo-root h2,.seo-root h3{font-family:"Bricolage Grotesque",system-ui,sans-serif;margin:0;letter-spacing:-.025em;line-height:1.08}.seo-root p{line-height:1.7}.seo-root button{font:inherit}.seo-root main{max-width:72rem;margin:auto;padding:0 1.15rem}.seo-nav{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:.7rem;padding:.75rem max(1.15rem,calc((100vw - 72rem)/2));background:rgba(252,251,248,.95);border-bottom:1px solid ${SEO.rule};backdrop-filter:blur(10px)}.seo-brand{display:flex;align-items:center;gap:.55rem;color:${SEO.ink};text-decoration:none;min-width:0}.seo-brand img,.seo-brand i{width:30px;height:30px;border-radius:8px;object-fit:cover}.seo-brand i{display:grid;place-items:center;background:${SEO.gradient};color:white;font-style:normal}.seo-brand b{font-family:"Bricolage Grotesque"}.seo-nav-actions{display:flex;align-items:center;gap:.45rem}.seo-nav-actions a{font-size:.76rem;color:${SEO.muted};text-decoration:none}.seo-nav-actions button,.seo-primary{border:0;border-radius:999px;background:${SEO.gradient};color:white;padding:.65rem .9rem;font-weight:800;cursor:pointer}.seo-container{padding:3rem 0}.seo-hero{padding:4rem 0 3rem}.seo-kicker{color:#0047D6;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.14em}.seo-hero h1{font-size:clamp(2.2rem,7vw,4.4rem);max-width:56rem;margin-top:.7rem}.seo-lede{max-width:44rem;color:${SEO.muted};font-size:1.06rem}.seo-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin:1.7rem 0}.seo-stat,.seo-card{background:${SEO.panel};border:1px solid ${SEO.rule};border-radius:14px;padding:1.05rem}.seo-stat b{display:block;font-size:1.08rem}.seo-stat span{font-size:.76rem;color:${SEO.faint}}.seo-grid{display:grid;grid-template-columns:1fr;gap:1rem}.seo-card{text-decoration:none;color:${SEO.ink}}.seo-card p{color:${SEO.muted};margin:.55rem 0}.seo-badge{display:inline-flex;border-radius:999px;background:rgba(0,87,255,.08);color:#0047D6;padding:.25rem .55rem;font-size:.74rem;font-weight:800}.seo-section{padding:3.3rem 0;border-top:1px solid ${SEO.rule}}.seo-section>h2{font-size:clamp(1.7rem,4.8vw,2.55rem);max-width:48rem}.seo-feature-grid{display:grid;gap:1rem;margin-top:1.6rem}.seo-list{margin:.7rem 0 0;padding-left:1.15rem;color:${SEO.muted}}.seo-list li{margin:.36rem 0}.seo-link{color:#0047D6;font-weight:800;text-decoration:none}.seo-faq{border-bottom:1px solid ${SEO.rule};padding:1rem 0}.seo-faq h3{font-size:1.05rem}.seo-faq p{color:${SEO.muted};margin:.45rem 0 0}.seo-cta{margin:3rem 0;padding:2rem 1.3rem;border-radius:18px;background:${SEO.gradient};color:white;text-align:center}.seo-cta h2{font-size:clamp(1.5rem,5vw,2.35rem)}.seo-cta button{margin-top:1.15rem;border:0;border-radius:999px;background:white;color:${SEO.blueDeep};font-weight:800;padding:.8rem 1.2rem;cursor:pointer}.seo-footer{display:flex;flex-wrap:wrap;justify-content:center;gap:.45rem 1rem;padding:2rem 1.15rem 3rem;border-top:1px solid ${SEO.rule};color:${SEO.faint};font-size:.8rem}.seo-footer a{color:${SEO.muted};text-decoration:none}.seo-table{width:100%;border-collapse:collapse;margin-top:1.4rem;background:white}.seo-table th,.seo-table td{text-align:left;vertical-align:top;padding:.8rem;border:1px solid ${SEO.rule};font-size:.84rem}.seo-table th:last-child,.seo-table td:last-child{border-left:4px solid ${SEO.blue}}.seo-breadcrumb{display:flex;flex-wrap:wrap;gap:.4rem;font-size:.82rem;color:${SEO.faint};margin-bottom:1.1rem}.seo-breadcrumb a{color:#0047D6;text-decoration:none}.seo-topic-grid{display:grid;gap:.8rem;margin-top:1.4rem}.seo-topic{border-left:3px solid ${SEO.blue}}@media(min-width:42rem){.seo-grid{grid-template-columns:repeat(2,1fr)}.seo-feature-grid{grid-template-columns:repeat(2,1fr)}.seo-topic-grid{grid-template-columns:repeat(2,1fr)}}@media(min-width:68rem){.seo-grid.seo-grid-3{grid-template-columns:repeat(3,1fr)}.seo-feature-grid.seo-four{grid-template-columns:repeat(4,1fr)}}@media(max-width:25rem){.seo-nav-actions a{display:none}.seo-nav-actions button{font-size:.72rem;padding:.58rem .7rem}.seo-stats{grid-template-columns:1fr}.seo-table{display:block;overflow-x:auto;white-space:normal}}
`;
