import { EXAM_DATA } from './examData';
import type { ExamData } from './examData';
import { findArticle } from '../Learn/articles';
import { examSubjectHref } from './examRoute';
import { learnArticleHref } from '../Learn/learnRoute';
import { CtaBand, SeoShell, startFree } from '../SeoChrome';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '../seoMeta';

const KEYWORDS: Record<string, string[]> = {
  jee: ['JEE preparation guide', 'JEE revision planner', 'JEE mock test analysis', 'JEE weak topic tracker'],
  neet: ['NEET preparation guide', 'NEET revision planner', 'spaced repetition for NEET', 'NEET weak chapter tracker'],
  upsc: ['UPSC preparation guide', 'UPSC revision planner', 'UPSC mock analysis', 'UPSC daily study plan'],
  'neet-pg': ['NEET PG preparation guide', 'NEET PG revision planner', 'grand test analysis', 'medical weak topic tracker'],
  cat: ['CAT preparation guide', 'CAT mock analysis', 'CAT study planner', 'VARC DILR QA tracker'],
  clat: ['CLAT preparation guide', 'CLAT revision planner', 'legal reasoning mock analysis', 'CLAT weak section tracker'],
  ssc: ['SSC CGL preparation guide', 'SSC revision planner', 'SSC mock analysis', 'SSC weak topic tracker'],
  rrb: ['RRB NTPC preparation guide', 'RRB revision planner', 'RRB CBT mock analysis', 'railway exam study plan'],
  mpsc: ['MPSC preparation guide', 'MPSC revision planner', 'MPSC mock analysis', 'Maharashtra GS study plan'],
  inicet: ['INI-CET preparation guide', 'INI-CET revision planner', 'INI-CET mock analysis', 'medical weak topic tracker'],
  banking: ['banking exam preparation guide', 'IBPS PO study planner', 'SBI PO mock analysis', 'banking weak topic tracker'],
  defence: ['defence exam preparation guide', 'NDA revision planner', 'CDS mock analysis', 'AFCAT weak topic tracker'],
  teaching: ['CTET preparation guide', 'TET revision planner', 'CTET mock analysis', 'pedagogy weak topic tracker'],
};

const featuresFor = (exam: ExamData) => [
  [`${exam.shortName} spaced revision`, `${exam.subjects[0].name} and ${exam.subjects[1].name} reviews return on a 1/3/7/14/28 schedule instead of waiting for last-month panic.`],
  [`${exam.shortName} weak-topic tracking`, `Topic-level test scores surface fragile areas such as ${exam.subjects[0].keyTopics[0]} before the next paper.`],
  [`${exam.shortName} mock analysis`, `Wrong answers are traced to the concept, method, timing or selection decision that caused them.`],
  [`What to revise today`, `Vicharee uses your ${exam.shortName} study history to rank the next useful revision and practice tasks.`],
];

export default function ExamPage({ exam, brandName, logoUrl }: { exam: ExamData; brandName: string; logoUrl?: string }) {
  const articles = exam.relatedArticleSlugs.map(findArticle).filter(Boolean).slice(0,3);
  const features = featuresFor(exam);
  const relatedExams = EXAM_DATA.filter((item) => item.slug !== exam.slug).slice(0, 5);
  const path = `/exam/${exam.slug}`;
  const jsonLd = [
    softwareApplicationSchema(exam.name, path),
    breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Exam prep', path: '/exam' }, { name: exam.shortName, path }]),
    faqSchema(exam.faqs),
  ];
  return <SeoShell brandName={brandName} logoUrl={logoUrl} pageKey={exam.slug} metaTitle={`${exam.shortName} Revision Planner & Mock Analysis | ${brandName}`} metaDescription={exam.metaDescription} canonicalPath={path} keywords={KEYWORDS[exam.slug]} jsonLd={jsonLd}>
    <section className="seo-hero"><p className="seo-kicker">{exam.fullForm}</p><h1>{exam.shortName} revision planner for what to study today</h1><p className="seo-lede">{exam.tagline}</p><div className="seo-stats">{exam.heroStats.map(s=><div className="seo-stat" key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div><button className="seo-primary" onClick={startFree}>Start your {exam.shortName} study plan →</button></section>
    <section className="seo-section"><h2>How VicharakAI helps {exam.shortName} students revise</h2><div className="seo-feature-grid seo-four">{features.map(([h,p])=><div className="seo-card" key={h}><h3>{h}</h3><p>{p}</p></div>)}</div></section>
    <section className="seo-section"><h2>{exam.shortName} subject priorities and revision order</h2><div className="seo-grid" style={{marginTop:'1.5rem'}}>{exam.subjects.map(subject=><article className="seo-card" key={subject.slug}><h3>{subject.name}</h3><p>{subject.description}</p><ul className="seo-list">{subject.keyTopics.slice(0,6).map(t=><li key={t}>{t}</li>)}</ul><a className="seo-link" href={examSubjectHref(exam.slug,subject.slug)}>Study {subject.name} →</a></article>)}</div></section>
    <section className="seo-section"><h2>{exam.shortName} preparation FAQs</h2><div style={{marginTop:'1rem'}}>{exam.faqs.map(f=><div className="seo-faq" key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>)}</div></section>
    <section className="seo-section"><h2>Related {exam.shortName} study and mock-analysis articles</h2><div className="seo-grid seo-grid-3" style={{marginTop:'1.4rem'}}>{articles.map(article => article && <a className="seo-card" href={learnArticleHref(article.slug)} key={article.slug}><span className="seo-badge">{article.kicker}</span><h3 style={{marginTop:'.65rem'}}>{article.title}</h3><p>{article.teaser}</p><span className="seo-link">Read article →</span></a>)}</div></section>
    <section className="seo-section"><h2>Revision planners related to {exam.shortName}</h2><div style={{display:'flex',flexWrap:'wrap',gap:'.6rem',marginTop:'1.2rem'}}>{relatedExams.map(item=><a className="seo-badge" style={{textDecoration:'none'}} href={`/exam/${item.slug}`} key={item.slug}>{item.shortName} guide →</a>)}</div></section>
    <CtaBand>Ready to make your {exam.shortName} prep systematic?</CtaBand>
  </SeoShell>;
}
