import { EXAM_DATA } from './examData';
import { examHref } from './examRoute';
import { SeoShell } from '../SeoChrome';
import { breadcrumbSchema, itemListSchema } from '../seoMeta';

export default function ExamIndex({ brandName, logoUrl }: { brandName: string; logoUrl?: string }) {
  const jsonLd = [
    itemListSchema('VicharakAI exam preparation guides', EXAM_DATA.map(exam => ({ name: exam.name, path: examHref(exam.slug) }))),
    breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Exam prep', path: '/exam' }]),
  ];
  return <SeoShell brandName={brandName} logoUrl={logoUrl} pageKey="exam-index" metaTitle={`Competitive Exam Preparation Guides | ${brandName}`} metaDescription="Compare revision planners, mock-analysis methods and weak-topic strategies for JEE, NEET, NEET PG, UPSC, CAT, SSC and other Indian competitive exams." keywords={['competitive exam study planner', 'revision planner for Indian exams', 'mock test analysis guides', 'weak topic tracker', 'what to revise today']} canonicalPath="/exam" jsonLd={jsonLd}><section className="seo-hero"><p className="seo-kicker">Exam preparation hubs</p><h1>Revision planners for Indian competitive exams</h1><p className="seo-lede">Choose your exam for a distinct study-planner strategy, subject priorities, mock-test analysis, weak-topic tracking and useful articles. No result promises—just a clearer way to plan, practise, revise and review mistakes.</p></section><section className="seo-section"><div className="seo-grid seo-grid-3">{EXAM_DATA.map(exam => <a className="seo-card" href={examHref(exam.slug)} key={exam.slug}><span className="seo-badge">{exam.difficulty}</span><h2 style={{fontSize:'1.35rem',marginTop:'.7rem'}}>{exam.name}</h2><p>{exam.tagline}</p><small style={{color:'#5C677A'}}>{exam.subjects.length} subjects</small><div className="seo-link" style={{marginTop:'.8rem'}}>View {exam.shortName} guide →</div></a>)}</div></section></SeoShell>;
}
