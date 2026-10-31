import { applyPageSeo, breadcrumbSchema, faqSchema, softwareApplicationSchema } from '../../components/seoMeta';
import { SEONavbar } from '../../components/SeoChrome';
import { followSeoRedirect, seoRedirectFor } from '../../components/seoRedirects';
import { useEffect } from 'react';

/**
 * THE THREE EXAM LANDING PAGES (/jee, /neet, /neet-pg).
 *
 * VicharakAI's search presence is focused on JEE Main, NEET UG and NEET PG.
 * Each one is a distinct public URL and therefore needs a distinct <head>:
 * its own title, its own 150-160 character description, its own Open Graph
 * set, its own self-referencing canonical and its own structured data. The
 * host serves one document for every route and fills only the canonical, so
 * everything else is written here — see components/seoMeta.ts.
 *
 * Pages that used to exist for other exams are retired. Their URLs still
 * resolve: the old path redirects to the closest kept page (see
 * components/seoRedirects.ts) so no old link lands on a 404.
 *
 * The FAQ block is real content, not schema padding: the questions are the
 * ones students actually ask about revising for that exam, and the answers
 * describe method. No exam dates, no cutoffs, no score promises.
 */

type PainPoint = { pain: string; solution: string };
type Faq = { q: string; a: string };
type ExamPageData = {
  title: string;
  metaDescription: string;
  h1: string;
  examFullName: string;
  /** Short label used inside structured data and prose. */
  examLabel: string;
  subjects: string[];
  keyTopics: string[];
  painPoints: PainPoint[];
  faqs: Faq[];
  cta: string;
};

const EXAM_DATA: Record<string, ExamPageData> = {
  '/jee': {
    title: 'JEE Preparation AI | Personalized Study Planner — VicharakAI',
    metaDescription: "VicharakAI builds your personal JEE study plan using spaced repetition and AI. Know exactly what to revise today, which topics you're forgetting, and if you're on pace. 7-day free trial.",
    h1: 'Your Personal AI Study Strategist for JEE',
    examFullName: 'Joint Entrance Examination (JEE Main)',
    examLabel: 'JEE Main',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    keyTopics: ['Mechanics', 'Electromagnetism', 'Organic Chemistry', 'Calculus', 'Coordinate Geometry', 'Modern Physics'],
    painPoints: [
      { pain: "You study every chapter but never know what you've actually retained", solution: "VicharakAI tracks every topic you study and surfaces what's slipping before your mock does." },
      { pain: 'Revision piles up until it becomes impossible to manage', solution: 'Spaced repetition scheduling automatically fits revision into your daily plan without overload.' },
      { pain: 'No one tells you what to study TODAY based on where your exam actually stands', solution: "Every morning, Vicharee (your AI coach) generates today's optimized study targets based on your real progress." },
    ],
    faqs: [
      { q: 'How do I revise Physics, Chemistry and Maths at the same time without one slipping?', a: 'Stop thinking in hours per subject and start thinking in retrieval schedules per topic. Every chapter you finish enters its own 1-3-7-14-28 day ladder, so on any given day you are revisiting a handful of topics from all three subjects rather than giving one subject a whole week while the other two decay. VicharakAI keeps that ladder for you and shows the day\u2019s queue instead of a timetable you have to rebuild every Sunday.' },
      { q: 'I solve problems correctly at home but lose marks in mock tests. Why?', a: 'Those are two different failures and they need two different fixes. Tag every wrong answer as a concept gap, a method-selection error, a calculation slip or a time-pressure decision. Concept gaps go back into revision; method-selection errors need mixed-topic practice so you have to choose the approach rather than being told it; calculation slips need timed drilling, not re-reading theory.' },
      { q: 'How far back should a JEE revision cycle reach?', a: 'Far enough that no completed chapter goes more than one cycle without a retrieval attempt. The practical rule is oldest-unreviewed-first: when you have limited revision time, the chapter you have not touched in the longest time is almost always worth more than the one you revised last week, even if the recent one felt shaky.' },
      { q: 'Does VicharakAI teach the JEE syllabus?', a: 'No. It does not deliver lectures, notes or question banks as a replacement for your coaching or NCERT. It is the planning layer on top: it records what you studied, decides what should come back and when, and points at the specific concept behind your repeated mistakes so your existing material is used where it matters.' },
    ],
    cta: 'Start Your JEE Study Plan Free',
  },
  '/neet': {
    title: 'NEET Preparation AI | Smart Study Companion — VicharakAI',
    metaDescription: 'VicharakAI tracks your NEET prep daily, identifies weak Biology/Physics/Chemistry topics before your mock reveals them, and plans your revision automatically. Try free 7 days.',
    h1: 'Beat Forgetting. Score Higher in NEET.',
    examFullName: 'National Eligibility cum Entrance Test (NEET UG)',
    examLabel: 'NEET UG',
    subjects: ['Biology (Botany & Zoology)', 'Physics', 'Chemistry'],
    keyTopics: ['Human Physiology', 'Cell Biology', 'Genetics', 'Optics', 'Organic Chemistry', 'Ecology'],
    painPoints: [
      { pain: "Biology spans dozens of chapters — you can't manually track what needs revision", solution: 'VicharakAI maps every chapter you study and schedules revision on the 1-3-7-14-28 day ladder.' },
      { pain: 'You discover your weak topics only during mock tests — too late to fix', solution: 'AI detects weak areas from your daily logs and test scores, flagging them before they cost you marks.' },
      { pain: 'Keeping pace with daily lectures while revising old content feels impossible', solution: 'Vicharee balances new learning and revision automatically in your daily plan.' },
    ],
    faqs: [
      { q: 'Biology is enormous. How do I keep all of it in recall at once?', a: 'NEET Biology rewards line-level recall of NCERT, which is a memory problem rather than a comprehension problem — and memory problems are solved by spacing, not by re-reading. Put each chapter on a revision ladder the day you finish it and make every review an active one: close the book, write the headings and the exceptions from memory, then check. Re-reading feels productive and proves nothing.' },
      { q: 'Why do I keep losing marks in NEET Physics?', a: 'Physics is usually the section where students have the least practice under time pressure, not the least knowledge. Practise numericals against a clock, then classify each miss: wrong formula, wrong setup, arithmetic, or simply too slow. Only the first belongs back in concept revision — the other three improve with repeated timed exposure to the same question patterns.' },
      { q: 'When should I start taking full-syllabus mocks?', a: 'Once most of the syllabus has had at least one revision pass. Before that, sectional and chapter tests give you cleaner diagnostic information. After that, frequency matters far less than analysis: an unanalysed mock teaches you almost nothing, while one mock broken down question by question can reset a whole week of priorities.' },
      { q: 'What does VicharakAI actually do for a NEET aspirant?', a: 'It remembers what you studied and when, brings each topic back before you lose it, reads your logged mistakes for the concept underneath them, and tells you every morning what today should contain. It does not teach the syllabus — your coaching, NCERT and question banks do that.' },
    ],
    cta: 'Start Your NEET Study Plan Free',
  },
  '/neet-pg': {
    title: 'NEET PG Study Planner AI | Revision Companion — VicharakAI',
    metaDescription: 'VicharakAI helps NEET PG aspirants manage high-volume clinical subjects with AI-driven spaced repetition and weak topic detection. 7-day free trial.',
    h1: 'The AI Study Strategist for NEET PG Aspirants',
    examFullName: 'NEET Postgraduate (NEET PG)',
    examLabel: 'NEET PG',
    subjects: ['Medicine', 'Surgery', 'Obstetrics & Gynaecology', 'Paediatrics', 'Pharmacology', 'Pathology'],
    keyTopics: ['Internal Medicine', 'Pharmacology', 'Biochemistry', 'Microbiology', 'Surgery Principles'],
    painPoints: [
      { pain: "Nineteen subjects. No system to track what you've actually retained across all of them.", solution: "VicharakAI maps retention across every subject and resurfaces what's fading." },
      { pain: 'Clinical duties eat your study time and revision falls behind', solution: 'Daily targets adjust to the time you actually have — Vicharee adapts the plan to your energy and schedule.' },
      { pain: 'Previous year questions reveal patterns but tracking mistakes manually is tedious', solution: 'Log wrong questions and VicharakAI merges them into underlying weakness cards you can actually fix.' },
    ],
    faqs: [
      { q: 'How do I revise nineteen subjects without the early ones disappearing?', a: 'Accept that you cannot hold them all at the same depth and let the schedule decide instead of your mood. Each subject you finish goes onto a spaced ladder, and the high-yield clinical subjects simply get shorter intervals than the smaller ones. The failure mode in PG prep is not studying too little; it is finishing Pharmacology in month two and never opening it again until the week before.' },
      { q: 'How should I actually use previous-year questions?', a: 'Not as a score. Use them as a diagnostic: for every question you get wrong, write down the single fact or reasoning step that would have fixed it. When three questions across different subjects trace back to the same mechanism, that mechanism is your revision unit — not the three questions and not the three chapters.' },
      { q: 'I am in an internship with very little free time. Is a plan even realistic?', a: 'A plan matters more when time is scarce, not less, because the cost of spending a free evening on something already secure is higher. Tell the app how much time today actually holds and it returns a shorter queue, ordered by what is closest to being forgotten. A twenty-minute retrieval session on a decaying topic beats a lost two-hour block you never get.' },
      { q: 'Does VicharakAI provide NEET PG content or question banks?', a: 'No. It plans and tracks — what to revise, when, and which concept your mistakes keep pointing at. You keep using whatever question bank, notes and video resources you already trust.' },
    ],
    cta: 'Start Your NEET PG Study Plan Free',
  },
};

const KEYWORDS: Record<string, { primary: string; secondary: string[] }> = {
  '/jee': { primary: 'JEE revision planner', secondary: ['spaced repetition for JEE', 'what to revise today for JEE', 'JEE mock test analysis', 'JEE weak topic tracker'] },
  '/neet': { primary: 'NEET revision planner', secondary: ['spaced repetition for NEET', 'NEET Biology revision schedule', 'what to revise today for NEET', 'NEET mock test analysis app'] },
  '/neet-pg': { primary: 'NEET PG study planner', secondary: ['NEET PG revision schedule', 'grand test analysis for NEET PG', 'nineteen subject revision plan', 'NEET PG weak topic tracker'] },
};

const normalizePath = () => {
  const hash = window.location.hash.replace(/^#/, '');
  const raw = hash.startsWith('/') ? hash : window.location.pathname;
  return raw.replace(/\/$/, '').toLowerCase() || '/';
};

const openApp = () => window.location.assign('/');

export default function ExamSEOApp() {
  const path = normalizePath();
  const data = EXAM_DATA[path];
  const movedTo = data ? null : seoRedirectFor(path) ?? '/prep';

  useEffect(() => {
    if (!data) {
      // A retired exam URL sends the visitor to the closest kept page. While
      // that navigation runs, the page canonicalises to the target and asks
      // not to be indexed, so the old URL can never become a thin page.
      followSeoRedirect();
      applyPageSeo({
        title: 'This page has moved | VicharakAI',
        description: 'This exam page is no longer available. VicharakAI preparation planners now cover JEE Main, NEET UG and NEET PG, with study guides for each.',
        canonicalPath: movedTo ?? '/prep',
        robots: 'noindex, follow',
      });
      return;
    }
    const keywordSet = KEYWORDS[path];
    applyPageSeo({
      title: data.title,
      description: data.metaDescription,
      keywords: keywordSet ? [keywordSet.primary, ...keywordSet.secondary] : [data.examLabel],
      canonicalPath: path,
      jsonLd: [
        softwareApplicationSchema(data.examLabel, path),
        breadcrumbSchema([{ name: 'Home', path: '/' }, { name: data.examLabel, path }]),
        faqSchema(data.faqs),
      ],
    });
  }, [data, path, movedTo]);

  if (!data) return <main className="exam-seo missing"><style>{CSS}</style><div><h1>This page has moved</h1><p>Taking you to the closest page for JEE Main, NEET UG or NEET PG preparation.</p><a href={movedTo ?? '/prep'}>Continue</a></div></main>;

  return <div className="exam-seo">
    <style>{CSS}</style>
    <SEONavbar brandName="VicharakAI" />
    <main>
      <section className="hero">
        <p className="eyebrow">{data.examFullName}</p>
        <h1>{data.h1}</h1>
        <p className="lede">{data.metaDescription}</p>
        <button className="primary" onClick={openApp}>{data.cta}</button>
      </section>
      <section>
        <p className="eyebrow">Built for your syllabus</p>
        <h2>{data.examLabel} subjects in one revision planner</h2>
        <div className="chips">{data.subjects.map((subject) => <span key={subject}>{subject}</span>)}</div>
        <div className="topics">{data.keyTopics.map((topic) => <article key={topic}><i aria-hidden="true" />{topic}</article>)}</div>
      </section>
      <section className="soft">
        <p className="eyebrow">The strategy gap</p>
        <h2>Fix the preparation gaps that cost {data.examLabel} marks</h2>
        <div className="pain-grid">{data.painPoints.map((item, index) => <article key={item.pain}><b>0{index + 1}</b><h3>{item.pain}</h3><p>{item.solution}</p></article>)}</div>
      </section>
      <section className="value">
        <div><p className="eyebrow">Your {data.examLabel} preparation, remembered</p><h2>What to revise today for {data.examLabel}</h2></div>
        <ul><li>Prioritise {data.keyTopics[0]} and {data.keyTopics[1]} from your latest mock evidence</li><li>Track weak areas across {data.subjects[0]} and {data.subjects[1]}</li><li>Space {data.keyTopics[2]} and {data.keyTopics[3]} on a 1-3-7-14-28 day ladder</li><li>Compare today’s workload with your {data.examLabel} target date</li></ul>
      </section>
      <section className="faqs">
        <p className="eyebrow">Questions students ask</p>
        <h2>{data.examLabel} study planner questions</h2>
        <div className="faq-list">{data.faqs.map((item) => <article key={item.q}><h3>{item.q}</h3><p>{item.a}</p></article>)}</div>
      </section>
      <section>
        <p className="eyebrow">Related exam planners</p>
        <h2>More revision planners from VicharakAI</h2>
        <nav className="related-links" aria-label="Related exam preparation pages">{Object.entries(EXAM_DATA).filter(([href]) => href !== path).map(([href, item]) => <a key={href} href={href}>{item.examLabel}</a>)}<a href="/prep">Study guides</a></nav>
      </section>
      <section className="cta"><h2>Build your {data.examLabel} revision system.</h2><p>Start with your exam, study hours and target date. Vicharee builds the next useful step.</p><button onClick={openApp}>{data.cta}</button></section>
    </main>
    <footer><a href="/">← VicharakAI home</a><a href="/exam">Exam guides</a><a href="/prep">Study guides</a><a href="/learn">Learn</a><span>© 2026 VicharakAI</span></footer>
  </div>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.exam-seo{height:100dvh;overflow-y:auto;background:#FAFAF8;color:#141A24;font-family:Inter,system-ui,sans-serif;-webkit-overflow-scrolling:touch}.exam-seo *{box-sizing:border-box}.exam-seo header{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:.8rem max(1rem,calc((100vw - 1120px)/2));border-bottom:1px solid rgba(20,26,36,.11);background:rgba(250,250,248,.94);backdrop-filter:blur(12px)}.brand{color:#141A24;text-decoration:none;font-weight:800;font-size:1.05rem}.brand span,.eyebrow{color:#0057FF}.exam-seo button{border:0;border-radius:999px;background:#0057FF;color:white;font:inherit;font-weight:800;padding:.75rem 1rem;cursor:pointer}.exam-seo main{max-width:1120px;margin:auto;padding:0 1rem}.exam-seo section{padding:4rem 0;border-bottom:1px solid rgba(20,26,36,.1)}.exam-seo h1,.exam-seo h2,.exam-seo h3{margin:0;letter-spacing:-.035em;line-height:1.08}.hero{position:relative;padding:5rem 0!important}.hero:before{content:"";position:absolute;inset:0 -50vw;z-index:-1;background:radial-gradient(circle at 20% 10%,rgba(108,155,255,.28),transparent 35%),linear-gradient(145deg,#FAFAF8 35%,#EDF3FF)}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:820px;font-size:clamp(2.45rem,8vw,5rem);margin-top:.8rem}.lede{max-width:720px;color:#4D596B;line-height:1.7;font-size:1.08rem}.primary{margin-top:1rem;padding:.9rem 1.25rem!important;box-shadow:0 14px 34px rgba(0,87,255,.22)}.exam-seo h2{font-size:clamp(1.85rem,5vw,3rem);max-width:760px;margin-top:.55rem}.chips{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.5rem}.chips span{padding:.58rem .78rem;border-radius:999px;background:#EAF1FF;color:#003AB0;font-weight:700;font-size:.88rem}.topics{display:grid;gap:.7rem;margin-top:1.25rem}.topics article{display:flex;align-items:center;gap:.6rem;background:white;border:1px solid rgba(20,26,36,.1);border-radius:12px;padding:1rem;font-weight:700}.topics i{width:9px;height:9px;border-radius:50%;background:#0057FF;box-shadow:0 0 0 5px rgba(0,87,255,.1)}.soft{position:relative}.pain-grid{display:grid;gap:1rem;margin-top:1.6rem}.pain-grid article{background:white;border:1px solid rgba(20,26,36,.1);border-radius:16px;padding:1.25rem;box-shadow:0 12px 34px rgba(20,26,36,.05)}.pain-grid b{color:#0057FF;font-size:.8rem}.pain-grid h3{font-size:1.12rem;margin-top:.7rem}.pain-grid p,.value li,.cta p,.faq-list p{color:#4D596B;line-height:1.65}.value{display:grid;gap:1.5rem}.value ul{margin:0;padding-left:1.2rem}.value li{margin:.65rem 0}.related-links{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:1.4rem}.related-links a{padding:.65rem .85rem;border:1px solid rgba(0,87,255,.24);border-radius:999px;background:#EDF3FF;color:#003AB0;text-decoration:none;font-weight:700}.faq-list{display:grid;gap:1rem;margin-top:1.7rem}.faq-list article{background:white;border:1px solid rgba(20,26,36,.1);border-radius:16px;padding:1.3rem}.faq-list h3{font-size:1.1rem;margin-bottom:.6rem;line-height:1.25}.cta{margin:3rem 0;border:0!important;border-radius:22px;padding:2.4rem 1.25rem!important;text-align:center;background:linear-gradient(135deg,#0057FF,#003AB0);color:white}.cta h2{margin:auto}.cta p{color:#DCE8FF;max-width:650px;margin:1rem auto}.cta button{background:white;color:#003AB0}.exam-seo footer{display:flex;flex-wrap:wrap;justify-content:center;gap:.7rem 1.2rem;padding:2rem 1rem 3rem;color:#5B6574;font-size:.82rem}.exam-seo footer a{color:#003AB0;text-decoration:none}.missing{display:grid;place-items:center;padding:2rem;text-align:center}.missing a{color:#0057FF}@media(min-width:640px){.topics{grid-template-columns:repeat(2,1fr)}.pain-grid{grid-template-columns:repeat(3,1fr)}.value{grid-template-columns:1.15fr .85fr;align-items:start}.faq-list{grid-template-columns:repeat(2,1fr)}}@media(min-width:900px){.topics{grid-template-columns:repeat(3,1fr)}}
`;
