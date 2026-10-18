import type { ExamData } from './examData';
import { findArticle } from '../Learn/articles';
import { examSubjectHref } from './examRoute';
import { learnArticleHref } from '../Learn/learnRoute';
import { CtaBand, SeoShell, startFree } from '../SeoChrome';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '../seoMeta';

const FEATURES = [
  ['Spaced revision','Reviews return on the 1/3/7/14/28 schedule instead of waiting for last-month panic.'],
  ['Weak topic detection','Topic-level test scores show where accuracy is slipping before the next paper.'],
  ['Test analysis','Wrong answers are traced back to the concept or decision that caused them.'],
  ['Vicharee AI coach','Ask what to study next using the preparation history you have already built.'],
];

export default function ExamPage({ exam, brandName, logoUrl }: { exam: ExamData; brandName: string; logoUrl?: string }) {
  const articles = exam.relatedArticleSlugs.map(findArticle).filter(Boolean).slice(0,3);
  const path = `/exam/${exam.slug}`;
  const jsonLd = [
    softwareApplicationSchema(exam.name, path),
    breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Exam prep', path: '/exam' }, { name: exam.shortName, path }]),
    faqSchema(exam.faqs),
  ];
  return <SeoShell brandName={brandName} logoUrl={logoUrl} pageKey={exam.slug} metaTitle={`${exam.name} Preparation Guide | ${brandName}`} metaDescription={exam.metaDescription} canonicalPath={path} jsonLd={jsonLd}>
    <section className="seo-hero"><p className="seo-kicker">{exam.fullForm}</p><h1>{exam.shortName} preparation that actually sticks</h1><p className="seo-lede">{exam.tagline}</p><div className="seo-stats">{exam.heroStats.map(s=><div className="seo-stat" key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div><button className="seo-primary" onClick={startFree}>Start your {exam.shortName} study plan →</button></section>
    <section className="seo-section"><h2>How VicharakAI helps {exam.shortName} students</h2><div className="seo-feature-grid seo-four">{FEATURES.map(([h,p])=><div className="seo-card" key={h}><h3>{h}</h3><p>{p}</p></div>)}</div></section>
    <section className="seo-section"><h2>Subjects in the {exam.shortName} plan</h2><div className="seo-grid" style={{marginTop:'1.5rem'}}>{exam.subjects.map(subject=><article className="seo-card" key={subject.slug}><h3>{subject.name}</h3><p>{subject.description}</p><ul className="seo-list">{subject.keyTopics.slice(0,6).map(t=><li key={t}>{t}</li>)}</ul><a className="seo-link" href={examSubjectHref(exam.slug,subject.slug)}>Study {subject.name} →</a></article>)}</div></section>
    <section className="seo-section"><h2>{exam.shortName} preparation FAQs</h2><div style={{marginTop:'1rem'}}>{exam.faqs.map(f=><div className="seo-faq" key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>)}</div></section>
    <section className="seo-section"><h2>Related articles</h2><div className="seo-grid seo-grid-3" style={{marginTop:'1.4rem'}}>{articles.map(article => article && <a className="seo-card" href={learnArticleHref(article.slug)} key={article.slug}><span className="seo-badge">{article.kicker}</span><h3 style={{marginTop:'.65rem'}}>{article.title}</h3><p>{article.teaser}</p><span className="seo-link">Read article →</span></a>)}</div></section>
    <CtaBand>Ready to make your {exam.shortName} prep systematic?</CtaBand>
  </SeoShell>;
}
