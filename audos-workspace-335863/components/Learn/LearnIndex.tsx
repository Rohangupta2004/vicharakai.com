import { ARTICLES } from './articles';
import { ArticleCard, LearnBreadcrumb, LearnShell } from './learnChrome';
import type { LearnChromeProps } from './learnChrome';
import { learnArticleHref, LEARN_HREF } from './learnRoute';
import { PAPER_INK_SOFT } from '../landingTokens';
import { breadcrumbSchema, itemListSchema, usePageSeo } from '../seoMeta';

/**
 * /learn — the article index.
 *
 * Public, signed-out, and deliberately free of anything that asks the reader
 * for something: no sign-up prompt, no trial banner, no pricing. A student who
 * arrives here from a search result should be able to read everything and
 * leave, and the page should still have been worth writing.
 */
export default function LearnIndex({
  brandName,
  logoUrl,
  supportEmail,
}: LearnChromeProps & { supportEmail: string }) {
  usePageSeo({
    title: `Study Techniques and Exam Strategy | ${brandName}`,
    description:
      'Plain-English guides to active recall, spaced revision, mock-test analysis, weak-topic detection and study pacing — written for students preparing for a competitive exam.',
    canonicalPath: LEARN_HREF,
    jsonLd: [
      itemListSchema(
        'VicharakAI study technique articles',
        ARTICLES.map((article) => ({ name: article.title, path: learnArticleHref(article.slug) })),
      ),
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Learn', path: LEARN_HREF }]),
    ],
  });
  return (
    <LearnShell
      brandName={brandName}
      logoUrl={logoUrl}
      supportEmail={supportEmail}
      testId="page-learn-index"
      scrollKey="index"
    >
      <div className="learn-sheet" style={{ paddingTop: '2.4rem', paddingBottom: '3.4rem' }}>
        <LearnBreadcrumb />

        <p className="learn-kicker">Study techniques</p>
        <h1 style={{ marginTop: '0.9rem', fontSize: 'clamp(2.1rem, 5.6vw, 3.1rem)' }}>
          How to actually remember what you study
        </h1>
        <p
          style={{
            marginTop: '1.1rem',
            marginBottom: '2.6rem',
            maxWidth: '38rem',
            fontSize: '1.1rem',
            color: PAPER_INK_SOFT,
          }}
        >
          Plain explanations of the ideas VicharakAI is built on — spacing, recall, gap detection and
          pacing — and of how the system itself works. Written for students preparing for an exam,
          whether or not they ever use the product.
        </p>

        {/* Each card leads with the article's own hero as a 16:9 thumbnail —
            the shared ArticleCard in learnChrome.tsx, same as the “Keep
            reading” rail on every article. */}
        <div className="learn-grid" data-testid="grid-articles">
          {ARTICLES.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </LearnShell>
  );
}
