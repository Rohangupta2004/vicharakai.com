import { ARTICLES, findArticle, readMinutes } from './articles';
import type { Article, ArticleBlock } from './articles';
import { ArticleCard, LearnBreadcrumb, LearnShell } from './learnChrome';
import type { LearnChromeProps } from './learnChrome';
import { LANDING_HREF, LEARN_HREF, learnArticleHref } from './learnRoute';
import { PAPER_INK_FAINT, PAPER_INK_SOFT, PAPER_RULE } from '../landingTokens';
import { articleSchema, breadcrumbSchema, usePageSeo } from '../seoMeta';

/**
 * /learn/:slug — one article.
 *
 * A long-form reading view: a full-bleed hero image with the title reading
 * out of a bottom-up shade, a single ~720px column with real typographic
 * hierarchy from the block kinds in components/Learn/articles.ts, and two
 * related articles at the foot so a reader never dead-ends.
 *
 * NOTHING SELLS INSIDE THE BODY. The only link out is one quiet line of text
 * at the very foot of the page, below the rule — deliberately a text link and
 * not a button, because a student reading about spacing at midnight is not a
 * conversion funnel.
 */

function Block({ block, index }: { block: ArticleBlock; index: number }) {
  switch (block.kind) {
    case 'heading':
      return <h2>{block.text}</h2>;
    case 'list':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'pull':
      return (
        <aside className="learn-pull" data-testid={`article-pull-${index}`}>
          <p>{block.text}</p>
        </aside>
      );
    case 'paragraph':
    default:
      return <p>{block.text}</p>;
  }
}

/** The two articles that follow this one in the canonical order, wrapping
 *  around the end — every article gets exactly two, none gets itself. */
function relatedTo(article: Article): Article[] {
  const index = ARTICLES.findIndex((a) => a.slug === article.slug);
  return [1, 2].map((step) => ARTICLES[(index + step) % ARTICLES.length]);
}

export default function ArticlePage({
  slug,
  brandName,
  logoUrl,
  supportEmail,
}: LearnChromeProps & { slug: string; supportEmail: string }) {
  const article = findArticle(slug);

  // Every article carries its OWN title, description, canonical, Open Graph
  // set and Article schema. A slug with no article is a soft 404: it points
  // its canonical back at the index and asks not to be indexed, so a dead
  // link can never become a thin page competing with the real ones.
  usePageSeo(
    article
      ? {
          title: `${article.title} | ${brandName}`,
          description: article.teaser,
          keywords: [article.title, `${article.kicker} for competitive exams`, `${article.title} guide`, 'Indian exam study strategy'],
          canonicalPath: learnArticleHref(article.slug),
          ogType: 'article' as const,
          image: article.heroImage,
          jsonLd: [
            articleSchema({
              headline: article.title,
              description: article.teaser,
              path: learnArticleHref(article.slug),
              image: article.heroImage,
            }),
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Learn', path: LEARN_HREF },
              { name: article.title, path: learnArticleHref(article.slug) },
            ]),
          ],
        }
      : {
          title: `Article not found | ${brandName}`,
          description:
            'That article link is out of date. Browse every VicharakAI guide to spacing, recall, mock-test analysis and study pacing in the Learn index.',
          canonicalPath: LEARN_HREF,
          robots: 'noindex, follow',
        },
  );

  if (!article) {
    return (
      <LearnShell
        brandName={brandName}
        logoUrl={logoUrl}
        supportEmail={supportEmail}
        testId="page-learn-article-missing"
        scrollKey={slug}
      >
        <div className="learn-sheet learn-sheet-narrow" style={{ paddingTop: '2.4rem', paddingBottom: '4rem' }}>
          <LearnBreadcrumb article="Not found" />
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)' }}>We couldn&rsquo;t find that article</h1>
          <p style={{ marginTop: '1.1rem', fontSize: '1.06rem', color: PAPER_INK_SOFT }}>
            The link may be out of date, or the article may have been renamed.{' '}
            <a href={LEARN_HREF} style={{ color: '#0057FF', fontWeight: 600 }}>
              See everything in Learn
            </a>
            .
          </p>
        </div>
      </LearnShell>
    );
  }

  return (
    <LearnShell
      brandName={brandName}
      logoUrl={logoUrl}
      supportEmail={supportEmail}
      testId="page-learn-article"
      scrollKey={article.slug}
      showProgress
    >
      {/* Cinematic header: the article's generated hero full-bleed, the title
          reading out of the shade at the bottom, the way back floating on
          top. The inner sheets keep the text aligned with the column below. */}
      <div className="learn-hero" data-testid="article-hero">
        <img src={article.heroImage} alt={`${article.title} — ${article.kicker} study guide`} />
        <div className="learn-hero-back">
          <div className="learn-sheet learn-sheet-narrow">
            <a href={LEARN_HREF} data-testid="link-article-back">
              ← All articles
            </a>
          </div>
        </div>
        <div className="learn-hero-text">
          <div className="learn-sheet learn-sheet-narrow">
            <p className="learn-kicker">{article.kicker}</p>
            <h1 data-testid="article-title">{article.title}</h1>
            <p className="learn-hero-meta" data-testid="article-read-time">
              {readMinutes(article)} min read
            </p>
          </div>
        </div>
      </div>

      <div
        className="learn-sheet learn-sheet-narrow"
        style={{ paddingTop: '2.4rem', paddingBottom: '3.6rem' }}
      >
        <div className="learn-article" data-testid="article-body">
          {article.body.map((block, index) => (
            <Block key={index} block={block} index={index} />
          ))}
        </div>

        <div
          style={{
            marginTop: '3rem',
            paddingTop: '1.4rem',
            borderTop: `1px solid ${PAPER_RULE}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem 1.4rem',
            fontSize: '0.92rem',
            color: PAPER_INK_FAINT,
          }}
        >
          <a href={LEARN_HREF} style={{ color: PAPER_INK_SOFT, fontWeight: 600, textDecoration: 'none' }}>
            ← All articles
          </a>
          <a
            href={LANDING_HREF}
            style={{ color: PAPER_INK_SOFT, textDecoration: 'underline', textUnderlineOffset: '3px' }}
            data-testid="link-article-home"
          >
            Start planning your study
          </a>
        </div>

        {/* Two more articles, so finishing one piece never dead-ends. */}
        <section className="learn-related" data-testid="article-related">
          <p className="learn-kicker">Keep reading</p>
          <div className="learn-grid" style={{ marginTop: '1.1rem' }}>
            {relatedTo(article).map((related) => (
              <ArticleCard key={related.slug} article={related} />
            ))}
          </div>
        </section>
      </div>
    </LearnShell>
  );
}
