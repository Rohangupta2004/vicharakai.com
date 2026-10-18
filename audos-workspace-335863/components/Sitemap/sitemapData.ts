import { EXAM_DATA } from '../Exam/examData';
import { COMPARE_DATA } from '../Compare/compareData';
import { ARTICLES } from '../Learn/articles';

/**
 * THE URL INVENTORY behind /sitemap and its XML export.
 *
 * Only routes that actually resolve belong here. Every entry below is either
 * a declared public route in config.json or a path the client router answers,
 * so nothing in this list can produce a 404 — a sitemap containing dead URLs
 * is worse than a short one.
 *
 * NOT LISTED, deliberately: the 210 /prep/<slug> study guides. Those live in
 * the shared seo_articles table and are only knowable at runtime, so the
 * platform's own generated /sitemap.xml (built from the declared routes in
 * config.json) is the authority for them. This module backs the readable
 * /sitemap page and its copy-to-clipboard XML, not the root sitemap.
 */

export interface SitemapUrl {
  loc: string;
  priority: number;
  changefreq: 'weekly' | 'monthly';
  lastmod: string;
}

/** The exam planner landing pages — one declared app route each. */
export const EXAM_PLANNER_SLUGS = [
  'jee', 'neet', 'neet-pg', 'upsc', 'cat', 'clat', 'ssc',
  'rrb', 'inicet', 'mpsc', 'banking', 'defence', 'teaching',
] as const;

const join = (base: string, path: string) => `${base.replace(/\/$/, '')}${path}`;

/** Content changes on publish, so "today" is the honest answer for a
 *  client-generated sitemap. ISO date only — the W3C date form sitemaps use. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAllSitemapUrls(baseUrl = 'https://www.vicharakai.com'): SitemapUrl[] {
  const lastmod = today();
  const add = (path: string, priority: number, changefreq: 'weekly' | 'monthly'): SitemapUrl => ({
    loc: join(baseUrl, path),
    priority,
    changefreq,
    lastmod,
  });

  const urls: SitemapUrl[] = [add('/', 1, 'weekly')];

  // Exam planner landing pages — the primary search entry points.
  EXAM_PLANNER_SLUGS.forEach((slug) => urls.push(add(`/${slug}`, 0.9, 'weekly')));

  // Exam guide hub, guides and subject pages.
  urls.push(add('/exam', 0.9, 'weekly'));
  EXAM_DATA.forEach((exam) => {
    urls.push(add(`/exam/${exam.slug}`, 0.9, 'monthly'));
    exam.subjects.forEach((subject) => urls.push(add(`/exam/${exam.slug}/${subject.slug}`, 0.7, 'monthly')));
  });

  // Study guide library. Individual guides are enumerated by the platform's
  // generated /sitemap.xml from the declared /prep/<slug> routes.
  urls.push(add('/prep', 0.8, 'weekly'));

  urls.push(add('/compare', 0.8, 'monthly'));
  COMPARE_DATA.forEach((comparison) => urls.push(add(`/compare/${comparison.slug}`, 0.7, 'monthly')));

  urls.push(add('/learn', 0.9, 'weekly'));
  ARTICLES.forEach((article) => urls.push(add(`/learn/${article.slug}`, 0.7, 'monthly')));

  ['/about', '/terms', '/privacy', '/refund', '/contact'].forEach((path) => urls.push(add(path, 0.5, 'monthly')));
  urls.push(add('/sitemap', 0.4, 'monthly'));

  return urls;
}

const esc = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function generateSitemapXml(urls: SitemapUrl[]): string {
  const body = urls
    .map(
      (url) =>
        `  <url>\n    <loc>${esc(url.loc)}</loc>\n    <lastmod>${esc(url.lastmod)}</lastmod>\n    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}
