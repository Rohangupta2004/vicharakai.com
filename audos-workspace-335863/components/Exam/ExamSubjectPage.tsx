import type { ExamData, ExamSubject } from './examData';
import { examHref, examSubjectHref } from './examRoute';
import { CtaBand, SeoShell } from '../SeoChrome';
import { breadcrumbSchema, softwareApplicationSchema } from '../seoMeta';

const workflowFor = (exam: ExamData, subject: ExamSubject) => [
  [`Log every ${subject.name} topic`, `A dated ${exam.shortName} study record turns ${subject.keyTopics[0]} and nearby coverage into revision tasks you can measure.`],
  [`Detect fragile ${subject.name} areas`, `Recall history and question accuracy reveal whether ${subject.keyTopics[1]} is becoming unreliable before the next ${exam.shortName} paper.`],
  [`Schedule ${exam.shortName} revision automatically`, `Weak or overdue ${subject.name} material returns sooner; secure topics earn a longer interval.`],
];
const reason = (topic: string, exam: ExamData, subject: ExamSubject, index: number) => {
  const approaches = [
    `Start ${topic} with a closed-book explanation, then verify it using a fresh ${exam.shortName} question.`,
    `For ${topic}, separate factual recall from the ${subject.name} method the question expects under time pressure.`,
    `Treat ${topic} as a weak-topic tracker entry until two spaced ${exam.shortName} attempts are accurate.`,
    `Revise ${topic} by comparing one familiar example with one mixed ${subject.name} application.`,
  ];
  return `${approaches[index % approaches.length]} Record the error cause and choose the next review date so this exact priority can return in today’s plan.`;
};

export default function ExamSubjectPage({ exam, subject, brandName, logoUrl }: { exam: ExamData; subject: ExamSubject; brandName: string; logoUrl?: string }) {
  const path = `/exam/${exam.slug}/${subject.slug}`;
  const workflow = workflowFor(exam, subject);
  const keywords = [
    `${exam.shortName} ${subject.name} revision plan`,
    `${subject.name} topics for ${exam.shortName}`,
    `${exam.shortName} ${subject.name} weak topic tracker`,
    `${subject.keyTopics[0]} revision`,
    `${subject.keyTopics[1]} practice plan`,
  ];
  const jsonLd = [
    softwareApplicationSchema(`${exam.shortName} ${subject.name}`, path),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Exam prep', path: '/exam' },
      { name: exam.shortName, path: `/exam/${exam.slug}` },
      { name: subject.name, path },
    ]),
  ];
  return <SeoShell brandName={brandName} logoUrl={logoUrl} pageKey={`${exam.slug}/${subject.slug}`} metaTitle={`${subject.name} Revision Plan for ${exam.shortName} | ${brandName}`} metaDescription={`${exam.shortName} ${subject.name} revision plan covering ${subject.keyTopics[0]}, ${subject.keyTopics[1]}, weak-topic tracking, spaced practice and what to revise next.`} keywords={keywords} canonicalPath={path} jsonLd={jsonLd}>
    <section className="seo-hero"><nav className="seo-breadcrumb"><a href="/">Home</a><span>→</span><a href={examHref(exam.slug)}>{exam.shortName}</a><span>→</span><span>{subject.name}</span></nav><p className="seo-kicker">{exam.name} subject guide</p><h1>{exam.shortName} {subject.name} revision plan and topic priorities</h1><p className="seo-lede">{subject.description}</p></section>
    <section className="seo-section"><h2>High-priority {subject.name} topics for {exam.shortName}</h2><div className="seo-topic-grid">{subject.keyTopics.map((topic,index)=><article className="seo-card seo-topic" key={topic}><h3>{topic}</h3><p>{reason(topic,exam,subject,index)}</p></article>)}</div></section>
    <section className="seo-section"><h2>How the {exam.shortName} planner handles {subject.name}</h2><div className="seo-grid seo-grid-3" style={{marginTop:'1.4rem'}}>{workflow.map(([h,p])=><div className="seo-card" key={h}><h3>{h}</h3><p>{p}</p></div>)}</div></section>
    <section className="seo-section"><h2>Continue your {exam.shortName} plan beyond {subject.name}</h2><p><a className="seo-link" href={examHref(exam.slug)}>← Back to the {exam.shortName} guide</a></p><div style={{display:'flex',flexWrap:'wrap',gap:'.6rem'}}>{exam.subjects.filter(s=>s.slug!==subject.slug).map(s=><a className="seo-badge" style={{textDecoration:'none'}} key={s.slug} href={examSubjectHref(exam.slug,s.slug)}>{s.name} →</a>)}</div></section>
    <CtaBand>Build today’s {exam.shortName} {subject.name} revision queue</CtaBand>
  </SeoShell>;
}
