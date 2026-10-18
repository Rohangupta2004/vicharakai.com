import type { ExamData, ExamSubject } from './examData';
import { examHref, examSubjectHref } from './examRoute';
import { CtaBand, SeoShell } from '../SeoChrome';
import { breadcrumbSchema, softwareApplicationSchema } from '../seoMeta';

const WHY = [
  ['Logs every topic you study','A dated study record turns coverage into something you can revisit and measure.'],
  ['Detects which topics are decaying','Recall history and question accuracy reveal where a topic is becoming unreliable.'],
  ['Schedules revision automatically','Weak or overdue material returns sooner; secure material earns a longer interval.'],
];
const reason = (topic: string, exam: string) => `${topic} appears through direct questions, applications or links to nearby concepts in ${exam}. Treat it as a retrieval target: learn the core idea, practise its common question forms, then revisit it after a gap.`;

export default function ExamSubjectPage({ exam, subject, brandName, logoUrl }: { exam: ExamData; subject: ExamSubject; brandName: string; logoUrl?: string }) {
  const path = `/exam/${exam.slug}/${subject.slug}`;
  const jsonLd = [
    softwareApplicationSchema(`${exam.shortName} ${subject.name}`, path),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Exam prep', path: '/exam' },
      { name: exam.shortName, path: `/exam/${exam.slug}` },
      { name: subject.name, path },
    ]),
  ];
  return <SeoShell brandName={brandName} logoUrl={logoUrl} pageKey={`${exam.slug}/${subject.slug}`} metaTitle={`${subject.name} for ${exam.shortName} — Topic Priorities & Revision Plan | ${brandName}`} metaDescription={`${subject.name} preparation for ${exam.name}: which topics carry the marks, why each one is tested, how to space revision across them, and where to go next.`} canonicalPath={path} jsonLd={jsonLd}>
    <section className="seo-hero"><nav className="seo-breadcrumb"><a href="#/">Home</a><span>→</span><a href={examHref(exam.slug)}>{exam.shortName}</a><span>→</span><span>{subject.name}</span></nav><p className="seo-kicker">{exam.name} subject guide</p><h1>{subject.name} for {exam.shortName} — your personalised revision plan</h1><p className="seo-lede">{subject.description}</p></section>
    <section className="seo-section"><h2>Key {subject.name} topics</h2><div className="seo-topic-grid">{subject.keyTopics.map(topic=><article className="seo-card seo-topic" key={topic}><h3>{topic}</h3><p>{reason(topic,exam.shortName)}</p></article>)}</div></section>
    <section className="seo-section"><h2>How VicharakAI handles {subject.name}</h2><div className="seo-grid seo-grid-3" style={{marginTop:'1.4rem'}}>{WHY.map(([h,p])=><div className="seo-card" key={h}><h3>{h}</h3><p>{p}</p></div>)}</div></section>
    <section className="seo-section"><h2>Keep exploring {exam.shortName}</h2><p><a className="seo-link" href={examHref(exam.slug)}>← Back to the {exam.shortName} guide</a></p><div style={{display:'flex',flexWrap:'wrap',gap:'.6rem'}}>{exam.subjects.filter(s=>s.slug!==subject.slug).map(s=><a className="seo-badge" style={{textDecoration:'none'}} key={s.slug} href={examSubjectHref(exam.slug,s.slug)}>{s.name} →</a>)}</div></section>
    <CtaBand>Ready to make your {exam.shortName} prep systematic?</CtaBand>
  </SeoShell>;
}
