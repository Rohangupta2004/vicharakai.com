import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { applyPageSeo, articleSchema, breadcrumbSchema, itemListSchema } from '../../components/seoMeta';
import { SEONavbar } from '../../components/SeoChrome';

/**
 * THE /prep STUDY-GUIDE LIBRARY.
 *
 * /prep              → the index of every published guide
 * /prep/<slug>       → one guide (the canonical URL, and what the sitemap lists)
 * /prep-<slug>       → legacy alias, canonicalised to /prep/<slug>
 *
 * Articles come from the shared seo_articles table at runtime, which is the
 * one thing on this route that can fail: a blocked request, a cold database
 * or a missing runtime helper. None of those may produce a blank document —
 * a crawler reads a blank render as a broken page, and that is how a library
 * of working URLs turns into a column of server errors in Search Console.
 * Every failure mode below therefore renders real HTML with an explicit
 * robots directive instead of throwing.
 */

type SeoArticle = {
  id: number;
  slug: string;
  exam: string;
  topic: string;
  title: string;
  meta_title: string;
  meta_description: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at?: string;
};

type WorkspaceDbResult<T> = {
  data: T[];
  loading: boolean;
  error: Error | null;
  total: number;
  refresh: () => void;
};

type WorkspaceDbHook = <T = unknown>(table: string, options?: Record<string, unknown>) => WorkspaceDbResult<T>;

declare global {
  interface Window {
    useWorkspaceDB: WorkspaceDbHook;
  }
}

/** Stand-in used when the runtime helper is absent (an older shell, or a
 *  bundle that booted before the provider attached). It keeps the hook count
 *  stable and reports a readable error state rather than throwing. */
const missingRuntimeHook: WorkspaceDbHook = () => ({
  data: [],
  loading: false,
  error: new Error('workspace-db runtime unavailable'),
  total: 0,
  refresh: () => {},
});

const PREP_INDEX_PATH = '/prep';
const articlePath = (slug: string) => `/prep/${slug}`;

const INDEX_TITLE = 'Competitive Exam Study Guides | VicharakAI';
const INDEX_DESCRIPTION =
  'Practical study, revision, mock-analysis and weak-topic guides for JEE, NEET, NEET PG, UPSC, CAT, CLAT, SSC, RRB, banking, defence and teaching exam aspirants.';

/**
 * Which guide the current URL asks for.
 *   null  → the index
 *   ''    → a /prep-style URL with no readable slug (not found)
 *   slug  → that guide
 */
function currentSlug(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const raw = hash.startsWith('/prep') ? hash : window.location.pathname;
  const clean = raw.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (clean === 'prep') return null;
  const slug = clean.startsWith('prep-')
    ? clean.slice(5)
    : clean.startsWith('prep/')
      ? clean.slice(5)
      : '';
  return slug && !slug.includes('/') ? slug : '';
}

/** Strip everything that is not long-form prose. Never throws: a parser
 *  failure returns the text content rather than taking the page down. */
function sanitizeHtml(raw: string): string {
  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const allowed = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'BLOCKQUOTE']);
    const clean = (node: Element) => {
      for (const child of Array.from(node.children)) {
        if (!allowed.has(child.tagName)) {
          child.replaceWith(...Array.from(child.childNodes));
          continue;
        }
        for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
        clean(child);
      }
    };
    clean(doc.body);
    return doc.body.innerHTML;
  } catch {
    return `<p>${raw.replace(/<[^>]*>/g, '')}</p>`;
  }
}

function Chrome({ children }: { children: ReactNode }) {
  return <div className="prep-root"><style>{CSS}</style><SEONavbar brandName="VicharakAI" />{children}<footer><a href="/">Home</a><a href="/exam">Exam prep</a><a href="/learn">Learn</a><span>© 2026 VicharakAI</span></footer></div>;
}

export default function ArticlePageApp() {
  const slug = currentSlug();
  // Resolved once so the hook identity never changes between renders.
  const [useWorkspaceDb] = useState<WorkspaceDbHook>(() =>
    typeof window !== 'undefined' && typeof window.useWorkspaceDB === 'function'
      ? window.useWorkspaceDB
      : missingRuntimeHook,
  );
  // An article route needs ONE row. Reading the whole library to find it made
  // every guide wait on roughly 800KB of other guides' bodies, which is slow
  // enough to matter to a crawler's render budget. The index still needs them
  // all; nothing else does.
  const { data, loading, error } = useWorkspaceDb<SeoArticle>('seo_articles', slug
    ? {
        shared: true,
        limit: 1,
        filters: [
          { column: 'published', operator: 'eq', value: true },
          { column: 'slug', operator: 'eq', value: slug },
        ],
      }
    : {
        shared: true,
        limit: 1000,
        orderBy: { column: 'exam', direction: 'asc' },
        filters: [{ column: 'published', operator: 'eq', value: true }],
      });
  const rows = Array.isArray(data) ? data : [];
  const article = slug ? rows.find((row) => row.slug === slug) ?? null : null;
  const grouped = useMemo(() => {
    const map = new Map<string, SeoArticle[]>();
    for (const row of rows) map.set(row.exam, [...(map.get(row.exam) ?? []), row]);
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  const safeContent = useMemo(() => (article ? sanitizeHtml(article.content) : ''), [article]);

  // THE HEAD. Every guide gets its own title, description, Open Graph set,
  // self-referencing /prep/<slug> canonical and Article schema; the index gets
  // its own and an ItemList of everything in it. A slug with no row is a soft 404: it
  // canonicalises to the index and asks not to be indexed.
  useEffect(() => {
    if (article) {
      const path = articlePath(article.slug);
      applyPageSeo({
        title: article.meta_title,
        description: article.meta_description,
        canonicalPath: path,
        ogType: 'article',
        jsonLd: [
          articleSchema({
            headline: article.title,
            description: article.meta_description,
            path,
            datePublished: article.created_at,
            dateModified: article.updated_at ?? article.created_at,
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Study guides', path: PREP_INDEX_PATH },
            { name: article.exam, path: PREP_INDEX_PATH },
            { name: article.title, path },
          ]),
        ],
      });
      return;
    }
    if (slug) {
      // A /prep/<slug> URL we have no content for. Still loading counts as
      // "not yet", so only commit the soft-404 head once the read settled.
      if (loading) return;
      applyPageSeo({
        title: `Study guide not found | VicharakAI`,
        description:
          'That study guide link is out of date. Browse every VicharakAI revision, mock-analysis and weak-topic guide by exam in the study guide library.',
        canonicalPath: PREP_INDEX_PATH,
        robots: 'noindex, follow',
      });
      return;
    }
    applyPageSeo({
      title: INDEX_TITLE,
      description: INDEX_DESCRIPTION,
      canonicalPath: PREP_INDEX_PATH,
      jsonLd: rows.length
        ? [
            itemListSchema(
              'VicharakAI competitive exam study guides',
              rows.map((row) => ({ name: row.title, path: articlePath(row.slug) })),
            ),
            breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Study guides', path: PREP_INDEX_PATH }]),
          ]
        : [breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Study guides', path: PREP_INDEX_PATH }])],
    });
  }, [article, slug, loading, rows]);

  if (loading) return <Chrome><main className="state"><div className="spinner" /><p>Loading study guides…</p></main></Chrome>;

  // The data read failed. Render a real page with the library's own
  // navigation rather than an empty document, and keep it out of the index
  // so a transient outage cannot cost a ranking.
  if (error) return <Chrome><main className="state"><h1>Study guides are temporarily unavailable</h1><p>We could not load the guide library just now. Please refresh in a moment, or head back to the <a className="text-link" href="/">VicharakAI home page</a>.</p></main></Chrome>;

  if (slug === '' || (slug && !article)) return <Chrome><main className="state"><p className="eyebrow">404</p><h1>We couldn’t find that guide</h1><a className="text-link" href="/prep">Browse all study guides →</a></main></Chrome>;

  if (!article) return <Chrome><main>
    <section className="index-hero"><p className="eyebrow">VicharakAI Prep Library</p><h1>Practical study guides for competitive exams</h1><p>Actionable plans for revision, weak topics, mock analysis and exam-day readiness — organized by the exam you are preparing for.</p><div className="index-stats"><b>{rows.length} guides</b><span>{grouped.length} exam families</span></div></section>
    {grouped.map(([exam, examRows]) => <section className="exam-group" key={exam}><div className="group-head"><p className="eyebrow">{exam}</p><h2>{exam} study guides</h2><span>{examRows.length} articles</span></div><div className="article-grid">{examRows.map((row) => <a href={articlePath(row.slug)} key={row.slug}><small>{row.topic}</small><h3>{row.title}</h3><p>{row.meta_description}</p><b>Read guide →</b></a>)}</div></section>)}
    <section className="cta"><h2>Start your personalized study plan</h2><p>VicharakAI connects what you study, what you forget and what your mocks reveal.</p><a className="prep-start-link" href="/">Start Free</a></section>
  </main></Chrome>;

  return <Chrome><main className="article-wrap">
    <nav className="crumb"><a href="/">Home</a><span>›</span><a href="/prep">Prep</a><span>›</span><span>{article.exam}</span></nav>
    <article>
      <header className="article-head"><p className="eyebrow">{article.exam} · {article.topic}</p><h1>{article.title}</h1><p>{article.meta_description}</p></header>
      <div className="article-body" dangerouslySetInnerHTML={{ __html: safeContent }} />
    </article>
    <aside className="article-cta"><h2>Start your personalized study plan → Start Free</h2><p>Log what you studied and let VicharakAI schedule the right revision before it slips.</p><a className="prep-start-link" href="/">Start Free</a></aside>
    <a className="back" href="/prep">← All study guides</a>
  </main></Chrome>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.prep-root{height:100dvh;overflow-y:auto;background:#FAFAF8;color:#141A24;font-family:Inter,system-ui,sans-serif;-webkit-overflow-scrolling:touch}.prep-root *{box-sizing:border-box}.prep-root>header{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.8rem max(1rem,calc((100vw - 1120px)/2));background:rgba(250,250,248,.95);border-bottom:1px solid rgba(20,26,36,.1);backdrop-filter:blur(12px)}.brand{color:#141A24;text-decoration:none;font-weight:800}.brand span,.eyebrow,.text-link{color:#0057FF}.prep-root nav{display:flex;align-items:center;gap:.8rem}.prep-root nav a{color:#4D596B;text-decoration:none;font-size:.82rem}.prep-root button{border:0;border-radius:999px;background:#0057FF;color:white;padding:.72rem .95rem;font:inherit;font-weight:800;cursor:pointer}.prep-root main{max-width:1120px;margin:auto;padding:0 1rem}.index-hero{padding:5rem 0 4rem}.eyebrow{font-size:.72rem;line-height:1.3;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.prep-root h1,.prep-root h2,.prep-root h3{margin:0;letter-spacing:-.035em;line-height:1.08}.index-hero h1{font-size:clamp(2.5rem,8vw,5rem);max-width:850px;margin-top:.7rem}.index-hero>p:not(.eyebrow){max-width:700px;color:#4D596B;font-size:1.08rem;line-height:1.7}.index-stats{display:flex;gap:1rem;margin-top:1.3rem;color:#003AB0}.index-stats span{color:#657080}.exam-group{padding:3.5rem 0;border-top:1px solid rgba(20,26,36,.1)}.group-head{display:grid;grid-template-columns:1fr auto;align-items:end;gap:.4rem}.group-head .eyebrow{grid-column:1/-1}.group-head h2{font-size:clamp(1.7rem,5vw,2.6rem)}.group-head span{color:#657080;font-size:.82rem}.article-grid{display:grid;gap:1rem;margin-top:1.5rem}.article-grid>a{display:block;background:white;border:1px solid rgba(20,26,36,.1);border-radius:15px;padding:1.15rem;color:#141A24;text-decoration:none;transition:transform .2s,border-color .2s}.article-grid>a:hover{transform:translateY(-2px);border-color:rgba(0,87,255,.35)}.article-grid small{color:#0057FF;font-weight:800}.article-grid h3{font-size:1.08rem;margin-top:.5rem}.article-grid p{color:#596475;font-size:.88rem;line-height:1.55}.article-grid b{color:#003AB0;font-size:.82rem}.cta,.article-cta{margin:3rem 0;padding:2rem 1.2rem;text-align:center;border-radius:20px;background:linear-gradient(135deg,#0057FF,#003AB0);color:white}.cta h2,.article-cta h2{font-size:clamp(1.6rem,5vw,2.5rem)}.cta p,.article-cta p{color:#DCE8FF;line-height:1.6}.cta button,.article-cta button,.prep-start-link{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:.72rem .95rem;background:white;color:#003AB0;text-decoration:none;font-weight:800}.prep-root>footer{display:flex;flex-wrap:wrap;justify-content:center;gap:.7rem 1.2rem;padding:2rem 1rem 3rem;border-top:1px solid rgba(20,26,36,.1);font-size:.8rem;color:#657080}.prep-root>footer a{color:#003AB0;text-decoration:none}.state{min-height:70vh;display:grid;place-content:center;text-align:center;gap:1rem;max-width:40rem}.state h1{font-size:clamp(2rem,7vw,3.5rem)}.state p{color:#4D596B;line-height:1.7}.spinner{width:34px;height:34px;margin:auto;border:3px solid #DCE8FF;border-top-color:#0057FF;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.article-wrap{max-width:800px!important;padding-top:1.5rem!important;padding-bottom:4rem!important}.crumb{justify-content:flex-start!important;flex-wrap:wrap;color:#768091;font-size:.8rem}.crumb a{color:#0057FF!important}.article-head{padding:3rem 0 2rem;border-bottom:1px solid rgba(20,26,36,.1)}.article-head h1{font-size:clamp(2.25rem,7vw,4.3rem);margin-top:.7rem}.article-head>p:last-child{color:#596475;line-height:1.7;font-size:1.05rem}.article-body{padding:2rem 0;font-size:1.02rem;line-height:1.78}.article-body h2{font-size:clamp(1.55rem,4vw,2.1rem);margin:2.4rem 0 .8rem}.article-body h3{font-size:1.25rem;margin:1.8rem 0 .65rem}.article-body p{margin:0 0 1.2rem}.article-body li{margin:.55rem 0}.article-body blockquote{margin:1.5rem 0;padding:1rem 1.2rem;border-left:4px solid #0057FF;background:#EDF3FF;color:#26344B}.back{color:#003AB0;text-decoration:none;font-weight:700}@media(min-width:650px){.article-grid{grid-template-columns:repeat(2,1fr)}}@media(min-width:980px){.article-grid{grid-template-columns:repeat(3,1fr)}}
`;
