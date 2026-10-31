import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  applyPageSeo,
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  itemListSchema,
} from '../../components/seoMeta';
import { SEONavbar } from '../../components/SeoChrome';
import { followSeoRedirect } from '../../components/seoRedirects';
import guidesAData from './guides-a.ts';
import guidesBData from './guides-b.ts';

/**
 * THE /study-methods LIBRARY.
 *
 * /study-methods          → hub listing all ten study-method guides
 * /study-methods/<slug>   → one guide (self-referencing canonical)
 * anything else           → a real not-found page, noindex, canonical → hub
 *
 * Content is static data shipped with the bundle (guides-a.ts and
 * guides-b.ts), so unlike /prep there is no runtime read that can fail.
 * Every route still writes its own <head> through applyPageSeo, because the
 * host serves one document for every URL.
 */

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideSource {
  label: string;
  url: string;
}

export interface StudyGuide {
  slug: string;
  primaryKeyword: string;
  title: string;
  metaDescription: string;
  h1: string;
  dek: string;
  audience: string;
  readMinutes: number;
  wordCount: number;
  sections: GuideSection[];
  faqs: GuideFaq[];
  relatedSlugs: string[];
  sources: GuideSource[];
}

const BRAND = 'VicharakAI';
const CONTACT_EMAIL = 'grohan24102004@gmail.com';
const HUB_PATH = '/study-methods';
const HUB_SEGMENT = 'study-methods';
const RELATED_COUNT = 3;

const GUIDES: StudyGuide[] = [
  ...(guidesAData as unknown as StudyGuide[]),
  ...(guidesBData as unknown as StudyGuide[]),
];
const GUIDE_BY_SLUG = new Map<string, StudyGuide>(GUIDES.map((guide) => [guide.slug, guide]));

const guidePath = (slug: string): string => `${HUB_PATH}/${slug}`;

const HUB_TITLE = 'Study Methods for JEE Main, NEET UG & NEET PG: 7 Evidence-Based Guides | VicharakAI';
const HUB_DESCRIPTION =
  'Seven study method guides for JEE Main, NEET UG and NEET PG aspirants: spaced repetition, error logs, grand test analysis, PYQ practice and weekly reviews.';
const HUB_KEYWORDS = [
  'study methods for competitive exams',
  'evidence-based study techniques for Indian exams',
  'how to decide what to study today',
  'revision strategy for JEE Main, NEET UG and NEET PG',
  'spaced repetition and retrieval practice guides',
];

/** Three supporting phrases per guide, kept distinct across the set so no
 *  two pages compete for the same long-tail query. Guides not listed here
 *  fall back to their first three section headings. */
const SUPPORTING_PHRASES: Record<string, [string, string, string]> = {
  'spaced-repetition-neet-biology': ['NCERT Biology revision schedule', 'NEET Biology diagram recall', 'blank-page recall for NEET'],
  'jee-physics-error-log': ['JEE Physics mistake analysis', 'mechanics and electrostatics error types', 'JEE mock error review'],
  'neet-pg-grand-test-analysis': ['NEET PG mock test analysis by subject', 'clinical vignette error analysis', 'NEET PG image-based question review'],
  'how-many-hours-study-jee': ['JEE study hours per day', 'JEE daily study schedule by student type', 'JEE Main study time'],
  'pyq-practice-method': ['previous year question practice', 'timed PYQ pass', 'PYQ pattern mapping'],
  'prioritize-competitive-exam-syllabus': ['syllabus prioritisation framework', 'importance weakness urgency matrix', 'what to study first for competitive exams'],
  'weekly-study-review': ['Sunday study review system', 'weekly revision audit', 'weekly study plan review for exams'],
};

function keywordsFor(guide: StudyGuide): string[] {
  const supporting = SUPPORTING_PHRASES[guide.slug] ?? guide.sections.slice(0, 3).map((section) => section.heading);
  return [guide.primaryKeyword, ...supporting];
}

/** Exactly RELATED_COUNT guides: the declared relatedSlugs first, then any
 *  other guide if a declared slug is missing or duplicated. */
function relatedGuides(guide: StudyGuide): StudyGuide[] {
  const picked: StudyGuide[] = [];
  const consider = (candidate: StudyGuide | undefined) => {
    if (!candidate || candidate.slug === guide.slug || picked.includes(candidate)) return;
    if (picked.length < RELATED_COUNT) picked.push(candidate);
  };
  guide.relatedSlugs.forEach((slug) => consider(GUIDE_BY_SLUG.get(slug)));
  GUIDES.forEach((candidate) => consider(candidate));
  return picked.slice(0, RELATED_COUNT);
}

const formatCount = (value: number): string => new Intl.NumberFormat('en-IN').format(value);

/* ==========================================================================
 *  ROUTING
 * ======================================================================== */

type Route =
  | { kind: 'hub' }
  | { kind: 'guide'; guide: StudyGuide }
  | { kind: 'missing'; requested: string };

function routeFromLocation(): Route {
  if (typeof window === 'undefined') return { kind: 'hub' };
  const hash = window.location.hash.replace(/^#/, '');
  const raw = hash.startsWith(HUB_PATH) ? hash : window.location.pathname;
  const clean = raw.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
  // A retired guide URL moves to the hub; the hub renders while the redirect runs.
  if (followSeoRedirect()) return { kind: 'hub' };
  if (clean === '' || clean === HUB_SEGMENT) return { kind: 'hub' };
  if (!clean.startsWith(`${HUB_SEGMENT}/`)) return { kind: 'missing', requested: `/${clean}` };
  const slug = clean.slice(HUB_SEGMENT.length + 1);
  const guide = slug.includes('/') ? undefined : GUIDE_BY_SLUG.get(slug);
  return guide ? { kind: 'guide', guide } : { kind: 'missing', requested: `/${clean}` };
}

function usesHashRouting(): boolean {
  return typeof window !== 'undefined' && window.location.hash.startsWith(`#${HUB_PATH}`);
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(routeFromLocation);
  useEffect(() => {
    const sync = () => setRoute(routeFromLocation());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  return route;
}

/* ==========================================================================
 *  CHROME
 * ======================================================================== */

function Chrome({ routeKey, hrefFor, children }: { routeKey: string; hrefFor: (path: string) => string; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0 });
  }, [routeKey]);

  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const main = document.getElementById('sm-main');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  };

  return (
    <div ref={rootRef} className="sm-root">
      <style>{CSS}</style>
      <a className="sm-skip" href="#sm-main" onClick={skipToContent}>Skip to content</a>
      <SEONavbar brandName={BRAND} />
      {children}
      <footer className="sm-footer">
        <nav aria-label="Footer">
          <a href="/">Home</a>
          <a href="/jee">JEE Main</a>
          <a href="/neet">NEET UG</a>
          <a href="/neet-pg">NEET PG</a>
          <a href="/exam">Exam Prep</a>
          <a href="/prep">Study Guides</a>
          <a href="/learn">Learn</a>
          <a href={hrefFor(HUB_PATH)}>Study Methods</a>
          <a href="/contact">Contact</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </nav>
        <p>© 2026 {BRAND}. Study-method guides summarise published learning research; they are not medical advice and do not promise any rank or score.</p>
      </footer>
    </div>
  );
}

function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="sm-crumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? <a href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function GuideCard({ guide, href }: { guide: StudyGuide; href: string }) {
  return (
    <li className="sm-card">
      <a href={href}>
        <span className="sm-kw">{guide.primaryKeyword}</span>
        <h3>{guide.title}</h3>
        <p>{guide.metaDescription}</p>
        <span className="sm-card-meta">{guide.readMinutes} min read · {formatCount(guide.wordCount)} words</span>
      </a>
    </li>
  );
}

function CtaBand({ idSuffix }: { idSuffix: string }) {
  const headingId = `sm-cta-${idSuffix}`;
  return (
    <aside className="sm-cta" aria-labelledby={headingId}>
      <p className="sm-cta-eyebrow">Where {BRAND} fits</p>
      <h2 id={headingId}>Decide what to study today, what to revise, and what to skip</h2>
      <p>
        {BRAND} is the strategy layer on top of the books, classes and tests you already use. It is not content,
        lectures, a question bank or doubt solving. It looks at what you have covered and what is slipping, then
        tells you where today&rsquo;s hours should go.
      </p>
      <a className="sm-cta-link" href="/">Start your 7-day free trial</a>
      <p className="sm-cta-fine">Free for 7 days, then Rs 149/month. Available in India only.</p>
    </aside>
  );
}

/* ==========================================================================
 *  VIEWS
 * ======================================================================== */

function HubView({ hrefFor }: { hrefFor: (path: string) => string }) {
  const totalWords = useMemo(() => GUIDES.reduce((sum, guide) => sum + guide.wordCount, 0), []);
  return (
    <main id="sm-main" tabIndex={-1} className="sm-main">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Study methods' }]} />
      <header className="sm-hero">
        <p className="sm-eyebrow">Study methods</p>
        <h1>Study methods for competitive exams: how to decide what to study today, revise, or skip</h1>
        <p className="sm-lede">
          Seven long-form guides on the mechanics of preparation rather than the content of it: how to space NCERT
          Biology for NEET UG, how to log JEE Main Physics mistakes by type, how many hours to study for JEE, how to
          read a NEET PG grand test, and how to build a PYQ routine, a syllabus priority list and a Sunday review
          that actually hold up.
        </p>
        <p className="sm-hero-meta">
          {GUIDES.length} guides · {formatCount(totalWords)} words · each grounded in published research on spacing,
          retrieval practice and interleaving, with sources listed on every page.
        </p>
      </header>

      <section className="sm-hub-section" aria-labelledby="sm-hub-list">
        <h2 id="sm-hub-list">All study method guides</h2>
        <ul className="sm-grid">
          {GUIDES.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} href={hrefFor(guidePath(guide.slug))} />
          ))}
        </ul>
      </section>

      <section className="sm-hub-section" aria-labelledby="sm-hub-how">
        <h2 id="sm-hub-how">How to use these guides</h2>
        <p>
          Start with the guide closest to your exam and your current problem, then borrow from the cross-exam
          methods: the weekly review, the PYQ routine and the syllabus prioritisation framework apply to every
          paper. Each guide ends with a short section on where {BRAND} sits, which is always the same place: the
          decision about which of the things you could do today is worth doing first.
        </p>
      </section>

      <CtaBand idSuffix="hub" />
    </main>
  );
}

function GuideView({ guide, hrefFor }: { guide: StudyGuide; hrefFor: (path: string) => string }) {
  const related = useMemo(() => relatedGuides(guide), [guide]);
  return (
    <main id="sm-main" tabIndex={-1} className="sm-main sm-main-article">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Study methods', href: hrefFor(HUB_PATH) },
          { label: guide.title },
        ]}
      />
      <article>
        <header className="sm-article-head">
          <p className="sm-eyebrow">{guide.primaryKeyword}</p>
          <h1>{guide.h1}</h1>
          <p className="sm-dek">{guide.dek}</p>
          <p className="sm-byline">
            <span>For {guide.audience}</span>
            <span className="sm-dot" aria-hidden="true">·</span>
            <span>{guide.readMinutes} min read</span>
            <span className="sm-dot" aria-hidden="true">·</span>
            <span>{formatCount(guide.wordCount)} words</span>
          </p>
        </header>

        {guide.sections.map((section, index) => {
          const headingId = `sm-section-${index}`;
          return (
            <section key={headingId} className="sm-section" aria-labelledby={headingId}>
              <h2 id={headingId}>{section.heading}</h2>
              {section.paragraphs.map((paragraph, pIndex) => (
                <p key={`${headingId}-p${pIndex}`}>{paragraph}</p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="sm-bullets">
                  {section.bullets.map((bullet, bIndex) => (
                    <li key={`${headingId}-b${bIndex}`}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}

        <section className="sm-section sm-faq" aria-labelledby="sm-faq-heading">
          <h2 id="sm-faq-heading">Frequently asked questions</h2>
          {guide.faqs.map((faq, index) => (
            <div className="sm-faq-item" key={`faq-${index}`}>
              <h3>{faq.q}</h3>
              <p>{faq.a}</p>
            </div>
          ))}
        </section>

        <section className="sm-section sm-sources" aria-labelledby="sm-sources-heading">
          <h2 id="sm-sources-heading">Sources</h2>
          <ul>
            {guide.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.label}
                  <span className="sm-vh"> (opens in a new tab)</span>
                </a>
                <span className="sm-source-url">{source.url}</span>
              </li>
            ))}
          </ul>
        </section>
      </article>

      <CtaBand idSuffix={guide.slug} />

      <section className="sm-related" aria-labelledby="sm-related-heading">
        <h2 id="sm-related-heading">Related study methods</h2>
        <ul className="sm-grid sm-grid-3">
          {related.map((item) => (
            <GuideCard key={item.slug} guide={item} href={hrefFor(guidePath(item.slug))} />
          ))}
        </ul>
      </section>

      <nav className="sm-article-links" aria-label="More study methods">
        <a href={hrefFor(HUB_PATH)}>← All study method guides</a>
      </nav>
    </main>
  );
}

function NotFoundView({ requested, hrefFor }: { requested: string; hrefFor: (path: string) => string }) {
  return (
    <main id="sm-main" tabIndex={-1} className="sm-main sm-main-state">
      <p className="sm-eyebrow">404</p>
      <h1>That study method guide does not exist</h1>
      <p className="sm-lede">
        There is no guide at <code>{requested}</code>. The link may be out of date or mistyped. Every published
        study method guide is listed below.
      </p>
      <a className="sm-text-link" href={hrefFor(HUB_PATH)}>Browse all study method guides →</a>
      <ul className="sm-plain-list">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <a href={hrefFor(guidePath(guide.slug))}>{guide.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

/* ==========================================================================
 *  APP
 * ======================================================================== */

export default function StudyMethodsApp() {
  const route = useRoute();
  const hashMode = usesHashRouting();
  const hrefFor = (path: string): string => (hashMode ? `#${path}` : path);
  const routeKey = route.kind === 'guide' ? route.guide.slug : route.kind === 'missing' ? `missing:${route.requested}` : 'hub';

  // THE HEAD. The hub gets its own title, description, ItemList and
  // breadcrumb; each guide gets a self-referencing canonical plus Article,
  // FAQPage and BreadcrumbList; a URL with no guide is a soft 404 that
  // canonicalises to the hub and asks not to be indexed.
  useEffect(() => {
    if (route.kind === 'guide') {
      const guide = route.guide;
      const path = guidePath(guide.slug);
      applyPageSeo({
        title: `${guide.title} | ${BRAND}`,
        description: guide.metaDescription,
        keywords: keywordsFor(guide),
        canonicalPath: path,
        ogType: 'article',
        jsonLd: [
          articleSchema({ headline: guide.h1, description: guide.metaDescription, path }),
          faqSchema(guide.faqs),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Study methods', path: HUB_PATH },
            { name: guide.title, path },
          ]),
        ],
      });
      return;
    }
    if (route.kind === 'missing') {
      applyPageSeo({
        title: `Study method guide not found | ${BRAND}`,
        description:
          'That study method link is out of date. Browse all VicharakAI study method guides on spaced repetition, error logs, mock analysis, PYQ practice and weekly review.',
        canonicalPath: HUB_PATH,
        robots: 'noindex, follow',
      });
      return;
    }
    applyPageSeo({
      title: HUB_TITLE,
      description: HUB_DESCRIPTION,
      keywords: HUB_KEYWORDS,
      canonicalPath: HUB_PATH,
      jsonLd: [
        itemListSchema(
          'VicharakAI study method guides',
          GUIDES.map((guide) => ({ name: guide.title, path: guidePath(guide.slug) })),
        ),
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Study methods', path: HUB_PATH },
        ]),
      ],
    });
  }, [route]);

  return (
    <Chrome routeKey={routeKey} hrefFor={hrefFor}>
      {route.kind === 'guide' ? (
        <GuideView guide={route.guide} hrefFor={hrefFor} />
      ) : route.kind === 'missing' ? (
        <NotFoundView requested={route.requested} hrefFor={hrefFor} />
      ) : (
        <HubView hrefFor={hrefFor} />
      )}
    </Chrome>
  );
}

/* ==========================================================================
 *  STYLES — logo blue #0057FF / #003AB0, tint #6C9BFF, warm neutral surfaces
 * ======================================================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.sm-root{height:100dvh;overflow-y:auto;background:#FAFAF8;color:#161F2B;font-family:Inter,system-ui,sans-serif;-webkit-overflow-scrolling:touch}
.sm-root *{box-sizing:border-box}
.sm-root h1,.sm-root h2,.sm-root h3{margin:0;letter-spacing:-.03em;line-height:1.12}
.sm-root p{line-height:1.72}
.sm-root a{color:#003AB0}
.sm-root a:focus-visible,.sm-root button:focus-visible,.sm-main:focus-visible{outline:3px solid #6C9BFF;outline-offset:3px;border-radius:4px}
.sm-main:focus{outline:none}
.sm-skip{position:absolute;left:1rem;top:-100px;z-index:60;padding:.6rem .9rem;border-radius:8px;background:#003AB0;color:#fff;font-weight:700;text-decoration:none}
.sm-skip:focus{top:1rem}
.sm-main{max-width:72rem;margin:0 auto;padding:1.25rem 1rem 4rem}
.sm-main-article{max-width:46rem}
.sm-main-state{min-height:60vh;max-width:46rem}
.sm-eyebrow{margin:0;color:#003AB0;font-size:.74rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.sm-crumb ol{display:flex;flex-wrap:wrap;gap:.35rem;margin:0 0 1.2rem;padding:0;list-style:none;font-size:.82rem;color:#5C677A}
.sm-crumb li+li::before{content:'›';margin-right:.35rem;color:#8A94A6}
.sm-crumb a{color:#003AB0;text-decoration:none}
.sm-crumb a:hover{text-decoration:underline}
.sm-hero{padding:2.5rem 0 2rem;border-bottom:1px solid rgba(22,31,43,.12)}
.sm-hero h1{margin-top:.6rem;font-size:clamp(2rem,6vw,3.6rem);max-width:52rem}
.sm-lede{max-width:44rem;color:#4A5568;font-size:1.05rem}
.sm-hero-meta{color:#5C677A;font-size:.9rem;max-width:44rem}
.sm-hub-section{padding:2.5rem 0 0}
.sm-hub-section h2{font-size:clamp(1.5rem,4vw,2.2rem);margin-bottom:1rem}
.sm-hub-section p{color:#4A5568;max-width:44rem}
.sm-grid{display:grid;grid-template-columns:1fr;gap:1rem;margin:0;padding:0;list-style:none}
.sm-card a{display:flex;flex-direction:column;gap:.5rem;height:100%;padding:1.15rem;border:1px solid rgba(22,31,43,.12);border-radius:14px;background:#FFFFFF;color:#161F2B;text-decoration:none;transition:border-color .2s,transform .2s}
.sm-card a:hover{border-color:#6C9BFF;transform:translateY(-2px)}
.sm-kw{display:inline-flex;align-self:flex-start;padding:.22rem .55rem;border-radius:999px;background:rgba(108,155,255,.18);color:#003AB0;font-size:.72rem;font-weight:800}
.sm-card h3{font-size:1.06rem}
.sm-card p{margin:0;color:#4A5568;font-size:.9rem;line-height:1.55}
.sm-card-meta{margin-top:auto;color:#5C677A;font-size:.78rem;font-weight:600}
.sm-article-head{padding:1.5rem 0 1.5rem;border-bottom:1px solid rgba(22,31,43,.12)}
.sm-article-head h1{margin-top:.6rem;font-size:clamp(1.9rem,6vw,3.1rem)}
.sm-dek{margin:1rem 0 .8rem;color:#4A5568;font-size:1.08rem}
.sm-byline{display:flex;flex-wrap:wrap;gap:.4rem;margin:0;color:#5C677A;font-size:.86rem;font-weight:600}
.sm-dot{color:#8A94A6}
.sm-section{padding:1.6rem 0 .4rem}
.sm-section h2{font-size:clamp(1.4rem,4vw,1.9rem);margin-bottom:.8rem;scroll-margin-top:5rem}
.sm-section p{margin:0 0 1.1rem;font-size:1.02rem;color:#1F2937}
.sm-bullets{margin:0 0 1.1rem;padding-left:1.2rem;color:#1F2937}
.sm-bullets li{margin:.45rem 0;line-height:1.6}
.sm-bullets li::marker{color:#0057FF}
.sm-faq{margin-top:1rem;padding:1.4rem 1.1rem;border-radius:16px;background:#F2F0E9}
.sm-faq-item{padding:.9rem 0;border-top:1px solid rgba(22,31,43,.1)}
.sm-faq-item:first-of-type{border-top:0}
.sm-faq-item h3{font-size:1.04rem}
.sm-faq-item p{margin:.45rem 0 0;color:#4A5568;font-size:.98rem}
.sm-sources ul{margin:0;padding-left:1.2rem;color:#4A5568}
.sm-sources li{margin:.6rem 0;line-height:1.55}
.sm-sources a{color:#003AB0;font-weight:600}
.sm-source-url{display:block;color:#5C677A;font-size:.78rem;word-break:break-all}
.sm-vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.sm-cta{margin:2.5rem 0;padding:1.8rem 1.2rem;border-radius:18px;background:linear-gradient(135deg,#0057FF,#003AB0);color:#FFFFFF;text-align:center}
.sm-cta-eyebrow{margin:0 0 .4rem;color:#CFE0FF;font-size:.74rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.sm-cta h2{font-size:clamp(1.45rem,4.5vw,2.1rem)}
.sm-cta p{margin:.9rem auto 0;max-width:40rem;color:#E4ECFF}
.sm-cta-link{display:inline-flex;align-items:center;justify-content:center;min-height:46px;margin-top:1.1rem;padding:.75rem 1.2rem;border-radius:999px;background:#FFFFFF;color:#003AB0;font-weight:800;text-decoration:none}
.sm-cta-link:focus-visible{outline-color:#FFFFFF}
.sm-cta-fine{margin-top:.8rem;font-size:.86rem;color:#E4ECFF}
.sm-related h2{font-size:clamp(1.4rem,4vw,1.9rem);margin-bottom:1rem}
.sm-article-links{display:flex;flex-wrap:wrap;gap:1rem;margin-top:2rem}
.sm-article-links a,.sm-text-link{color:#003AB0;font-weight:700;text-decoration:none}
.sm-article-links a:hover,.sm-text-link:hover{text-decoration:underline}
.sm-main-state h1{margin-top:.6rem;font-size:clamp(1.9rem,6vw,3rem)}
.sm-main-state code{padding:.1rem .35rem;border-radius:4px;background:#F2F0E9;font-size:.95em}
.sm-plain-list{margin:1.5rem 0 0;padding-left:1.2rem;color:#4A5568}
.sm-plain-list li{margin:.45rem 0}
.sm-plain-list a{color:#003AB0;text-decoration:none}
.sm-plain-list a:hover{text-decoration:underline}
.sm-footer{padding:2rem 1rem 3rem;border-top:1px solid rgba(22,31,43,.12);text-align:center;color:#5C677A;font-size:.82rem}
.sm-footer nav{display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem 1.1rem}
.sm-footer a{color:#003AB0;text-decoration:none;font-weight:600}
.sm-footer a:hover{text-decoration:underline}
.sm-footer p{max-width:44rem;margin:1rem auto 0;line-height:1.6}
@media(min-width:42rem){.sm-grid{grid-template-columns:repeat(2,1fr)}.sm-main{padding-top:1.75rem}}
@media(min-width:64rem){.sm-grid{grid-template-columns:repeat(3,1fr)}.sm-grid.sm-grid-3{grid-template-columns:repeat(3,1fr)}}
@media(prefers-reduced-motion:reduce){.sm-card a{transition:none}.sm-card a:hover{transform:none}}
`;
