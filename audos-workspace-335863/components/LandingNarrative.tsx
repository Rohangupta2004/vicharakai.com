import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  RotateCcw,
  ScanLine,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import type { LandingTokens } from './landingTokens';
import type { RegionConfig } from './landingRegions';
import type { CtaLocation, LandingEventContext } from './landingAnalytics';
import { trackCtaClick } from './landingAnalytics';

const LANDING_FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,650;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

const EXAMS = [
  {
    id: 'jee',
    label: 'JEE',
    subjects: 'Physics, Chemistry, Mathematics',
    concept: 'Parallel axis theorem',
    question: 'A ring has mass M and radius R. Find its moment of inertia about a tangent perpendicular to its plane.',
    mistake: 'Used the in-plane tangent formula again',
    related: 14,
    tasks: ['Revise parallel axis theorem', 'Practise 3 similar questions', 'Recall limiting reagent'],
  },
  {
    id: 'neet',
    label: 'NEET',
    subjects: 'Physics, Chemistry, Biology',
    concept: 'LH surge and ovulation',
    question: 'Ovulation in the human menstrual cycle is triggered by a surge of which hormone?',
    mistake: 'Mixed up FSH and LH',
    related: 22,
    tasks: ['Recall LH surge and ovulation', 'Practise 5 NCERT questions', 'Revise chemical bonding'],
  },
  {
    id: 'neet-pg',
    label: 'NEET PG',
    subjects: 'All 19 MBBS subjects',
    concept: 'Drugs for absence seizures',
    question: 'A seven-year-old has absence seizures only. What is the drug of choice?',
    mistake: 'Applied a broad-spectrum rule without checking seizure type',
    related: 9,
    tasks: ['Revise absence-seizure drugs', 'Practise 4 pharmacology MCQs', 'Recall types of shock'],
  },
  {
    id: 'upsc',
    label: 'UPSC',
    subjects: 'Prelims GS, CSAT, Mains GS',
    concept: 'Finance Commission — Article 280',
    question: 'The Finance Commission of India is constituted under which Article of the Constitution?',
    mistake: 'Confused it with the CAG article',
    related: 17,
    tasks: ['Recall Article 280', 'Practise constitutional bodies', 'Revise Revolt of 1857'],
  },
  {
    id: 'cat',
    label: 'CAT',
    subjects: 'VARC, DILR, Quant',
    concept: 'Successive percentage change',
    question: 'A price rises by 20% and then falls by 20%. What is the net change?',
    mistake: 'Assumed the two percentages cancel',
    related: 11,
    tasks: ['Revise successive change', 'Practise 5 mixed Quant questions', 'Solve one DILR set'],
  },
  {
    id: 'gate',
    label: 'GATE',
    subjects: 'Your branch + General Aptitude',
    concept: 'Building a heap in O(n)',
    question: 'What is the time complexity of building a binary heap using bottom-up heapify?',
    mistake: 'Treated heap construction as n separate inserts',
    related: 0,
    tasks: ['Recall bottom-up heapify', 'Re-solve the saved question', 'Revise 3NF vs BCNF'],
  },
  {
    id: 'ssc',
    label: 'SSC',
    subjects: 'Quant, Reasoning, English, General Awareness',
    concept: 'Compound interest minus simple interest',
    question: 'On ₹10,000 at 10% per year for two years, what is CI minus SI?',
    mistake: 'Forgot the two-year shortcut',
    related: 8,
    tasks: ['Recall the CI–SI shortcut', 'Practise 5 arithmetic questions', 'Revise coding-decoding'],
  },
] as const;

const PAINS = [
  {
    front: 'You analyse a mock — then the mistakes disappear into a notebook.',
    back: 'Every wrong answer is saved with its concept and scheduled to return.',
  },
  {
    front: 'Making and maintaining flashcards takes longer than revising them.',
    back: 'Log or scan the question. Your exam syllabus is already mapped.',
  },
  {
    front: 'The backlog grows until opening the study plan feels exhausting.',
    back: 'Missed work carries forward into a short, ranked list — never one impossible day.',
  },
  {
    front: 'The same type of question causes the same mistake in the next mock.',
    back: 'Similar questions target the concept, not the answer you just memorised.',
  },
];

const STEPS = [
  ['Day 0', 'You get it wrong', 'Log the question from any mock. Type it or scan it.'],
  ['Day 0', 'The concept gets saved', 'Tag the reason, see the concept, and find related practice.'],
  ['Day 1+', 'It returns on your plan', 'Revision timing responds to how well you remember it.'],
  ['Next mock', 'You meet it again', 'Same concept, fresh question — now you have evidence it is improving.'],
] as const;

const FEATURES = [
  { Icon: Brain, title: 'AI coach', copy: 'Ask what to study next using your own plan, mocks and weak-topic history.' },
  { Icon: ScanLine, title: 'Scan a mistake', copy: 'Capture a question from paper or gallery without breaking your study flow.' },
  { Icon: BookOpen, title: 'Blank recall', copy: 'Write what you remember first, then compare and repair the gaps.' },
  { Icon: CalendarDays, title: 'Revision calendar', copy: 'See what is due, what moved forward and what can safely wait.' },
  { Icon: TrendingUp, title: 'Test analysis', copy: 'Trace marks lost to concept, method, timing or selection errors.' },
  { Icon: Target, title: 'Exam-aware priorities', copy: 'Your syllabus, exam date and real performance shape the daily order.' },
];

const FAQS = [
  ['Which exams does it work for?', 'JEE, NEET, NEET PG, UPSC, CAT, GATE, SSC and more. You can also add another exam and its syllabus.'],
  ['Do I have to make flashcards?', 'No. Log the question you got wrong, choose why, and VicharakAI turns it into practice and revision.'],
  ['What if there are no similar questions?', 'The original question still joins your daily practice queue, so the concept returns on time.'],
  ['What if I miss a day?', 'Pending work carries forward and the plan re-ranks it against what matters today. Nothing is silently deleted.'],
  ['How much does it cost?', 'VicharakAI Premium is ₹149 per month in India, with the full planning and revision system included.'],
];

interface LandingNarrativeProps {
  t: LandingTokens;
  spaceId: string;
  region: RegionConfig;
  logoUrl: string;
  scrolled: boolean;
  openLogin: () => void;
  supportEmail: string;
}

function Logo({ logoUrl, alt, size = 38, priority = false }: { logoUrl: string; alt: string; size?: number; priority?: boolean }) {
  return logoUrl ? (
    <img
      className="lp-logo-image"
      src={logoUrl}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  ) : (
    <span className="lp-logo-fallback" style={{ width: size, height: size }} aria-hidden="true">V</span>
  );
}

type ExamData = (typeof EXAMS)[number];

function PhoneShell({ children, label }: { children: ReactNode; label: string }) {
  return <div className="hm-phone" role="img" aria-label={label}><div className="hm-screen"><div className="hm-island" />{children}</div></div>;
}

function PhoneStatus() {
  return <div className="hm-status"><span>9:41</span><span className="hm-signal"><i /><i /><i /><i /><b /></span></div>;
}

function TodayPhone({ exam, logoUrl }: { exam: ExamData; logoUrl: string }) {
  return <PhoneShell label={`VicharakAI Today plan for ${exam.label}`}><PhoneStatus /><div className="hm-head"><span><small>Sunday</small><b>Today</b></span><Logo logoUrl={logoUrl} alt={`${exam.label} Today plan app icon`} size={30} /></div><div className="hm-progress"><span>0 of 4 done</span><i><b /></i></div><div className="hm-tasks">{exam.tasks.map((task, index) => <div className="hm-task" key={task}><span className="hm-check" /><p><small>{index === 0 ? exam.subjects.split(',')[0] : index === 1 ? 'Practice' : 'Revision'}</small><b>{task}</b><em>{index === 0 ? 'From your latest mock' : index === 1 ? `${exam.related || 1} related questions` : 'Due today'}</em></p></div>)}<div className="hm-task hm-task-muted"><span className="hm-check" /><p><small>Carried over</small><b>One unfinished task</b><em>Moved forward automatically</em></p></div></div><div className="hm-tabs"><span className="on">Today</span><span>Calendar</span><span>Mistakes</span><span>Tests</span></div></PhoneShell>;
}

function MistakePhone({ exam, logoUrl }: { exam: ExamData; logoUrl: string }) {
  return <PhoneShell label={`VicharakAI Mistake Book for ${exam.label}`}><PhoneStatus /><div className="hm-topbar"><Logo logoUrl={logoUrl} alt={`${exam.label} Mistake Book app icon`} size={25} /><b>Mistake Book</b><span>Saved</span></div><div className="hm-mistake-body"><div className="hm-card"><small>{exam.label} · {exam.subjects.split(',')[0]}</small><b>{exam.concept}</b></div><div className="hm-card"><small>Why did you get it wrong?</small><div className="hm-reasons"><span className="on">Didn’t know it</span><span>Knew it, couldn’t apply</span><span>Silly mistake</span><span>Ran out of time</span></div></div><div className="hm-card hm-related"><span>{exam.related > 0 ? `${exam.related} related questions found` : 'Original question saved for practice'}</span><b>Practise</b></div><div className="hm-card hm-explain"><small>Explained again</small><p>{exam.mistake}. VicharakAI keeps the concept attached to the question so the next review fixes the cause, not only the answer.</p></div></div></PhoneShell>;
}

function MemoryCurve({ concept }: { concept: string }) {
  const [withPlan, setWithPlan] = useState(false);
  return <div className="hm-curve-card"><div className="hm-curve-top"><p>Your memory of <b>{concept}</b></p><div><button type="button" aria-pressed={!withPlan} onClick={() => setWithPlan(false)}>Without revision</button><button type="button" aria-pressed={withPlan} onClick={() => setWithPlan(true)}>With VicharakAI</button></div></div><svg viewBox="0 0 420 170" role="img" aria-label={withPlan ? 'Memory reinforced by scheduled revision' : 'Memory fading without revision'}><g className="hm-grid"><line x1="34" y1="20" x2="405" y2="20"/><line x1="34" y1="82" x2="405" y2="82"/><line x1="34" y1="144" x2="405" y2="144"/></g><line className="hm-axis" x1="34" y1="12" x2="34" y2="145"/><line className="hm-axis" x1="34" y1="145" x2="408" y2="145"/><path className={withPlan ? 'hm-decay dim' : 'hm-decay'} d="M34 22 C75 74 126 112 205 131 C274 144 338 145 405 145"/><path className={withPlan ? 'hm-held' : 'hm-held dim'} d="M34 22 C56 48 72 62 92 70 L92 24 C120 43 140 54 164 58 L164 23 C206 40 233 47 260 49 L260 22 C316 34 359 39 405 42"/>{[92,164,260].map((x) => <circle key={x} className="hm-revision-dot" cx={x} cy={x === 92 ? 24 : x === 164 ? 23 : 22} r="5"/>)}<text x="39" y="163">Study</text><text x="365" y="163">Exam day</text></svg><p className="hm-curve-read"><b>{withPlan ? 'Reinforced' : 'Fading'}</b><span>{withPlan ? 'Scheduled recall rebuilds the concept before the next test.' : 'Without retrieval, familiarity quietly turns into uncertainty.'}</span></p></div>;
}

function HeroMockup({ exam, logoUrl }: { exam: ExamData; logoUrl: string }) {
  return <div className="hm-stage" aria-label="Interactive VicharakAI product mockup"><div className="hm-orbit" aria-hidden="true" /><div className="hm-back"><MistakePhone exam={exam} logoUrl={logoUrl} /></div><div className="hm-main"><TodayPhone exam={exam} logoUrl={logoUrl} /></div><span className="hm-tag hm-tag-one"><X size={14} /> Mock question: wrong</span><span className="hm-tag hm-tag-two"><RotateCcw size={14} /> Revision due today</span><span className="hm-tag hm-tag-three"><Check size={14} /> Fresh question: correct</span><MemoryCurve concept={exam.concept} /></div>;
}

export default function LandingNarrative({
  t,
  spaceId,
  region,
  logoUrl,
  openLogin,
  supportEmail,
}: LandingNarrativeProps) {
  const [activeExam, setActiveExam] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [openPain, setOpenPain] = useState<number | null>(null);
  const [daysToExam, setDaysToExam] = useState(120);
  const exam = EXAMS[activeExam];
  const analytics: LandingEventContext = { spaceId, region: region.key, exam: exam.id };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setActiveStep((step) => (step + 1) % STEPS.length), 5200);
    return () => window.clearInterval(id);
  }, []);

  const start = (location: CtaLocation) => {
    trackCtaClick(analytics, location);
    openLogin();
  };

  const reviewCount = [1, 3, 7, 14, 28, 56, 112, 224].filter((day) => day <= daysToExam).length;

  return (
    <div className="lp-dark">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="preload" as="style" href={LANDING_FONT_STYLESHEET} />
      <link rel="stylesheet" href={LANDING_FONT_STYLESHEET} />
      {logoUrl ? <link rel="preload" as="image" href={logoUrl} /> : null}
      <style>{CSS}</style>

      <header className="lp-top">
        <div className="lp-wrap lp-top-inner">
          <a className="lp-brand" href="/" aria-label="VicharakAI home">
            <Logo logoUrl={logoUrl} alt="VicharakAI home" priority />
            <span className="lp-brand-copy"><b>VicharakAI</b><small>Mistakes into marks</small></span>
          </a>
          <nav className="lp-nav" aria-label="Main navigation">
            <a href="#how">How it works</a>
            <a href="#exams">Your exam</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <button type="button" onClick={() => start('nav')}>Start 7-day free trial <ArrowRight size={15} /></button>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-hook"><span aria-hidden="true" />Do you remember the mistake from your last mock?</p>
              <h1>
                Every mistake comes back.
                <strong>
                  Right before you <span className="lp-sr">forget</span><span className="lp-forget" aria-hidden="true">{'forget'.split('').map((letter, index) => <i key={`${letter}-${index}`} style={{ '--letter-index': index } as CSSProperties}>{letter}</i>)}</span> it.
                </strong>
              </h1>
              <p className="lp-sub">Log the question you got wrong. VicharakAI saves the concept, finds related practice and brings it back on your revision schedule. Next mock, it becomes a mark you can keep.</p>
              <div className="lp-actions">
                <button type="button" className="lp-btn" onClick={() => start('hero')}>Start 7-day free trial <ArrowRight size={18} /></button>
                <a className="lp-btn lp-btn-ghost" href="#how">See how it works</a>
              </div>
              <p className="lp-trust"><Logo logoUrl={logoUrl} alt="VicharakAI founder-built study companion" size={28} />Built by an aspirant, for aspirants.</p>
              <div className="lp-exam-picker" role="group" aria-label="Choose your exam">
                <span>I’m preparing for</span>
                <div>{EXAMS.map((item, index) => <button key={item.id} type="button" aria-pressed={index === activeExam} onClick={() => setActiveExam(index)}>{item.label}</button>)}</div>
              </div>
            </div>

            <div className="lp-hero-art">
              <HeroMockup exam={exam} logoUrl={logoUrl} />
            </div>
          </div>
        </section>

        <section className="lp-ticker" aria-label="Supported exam topics">
          <div>
            {['JEE · Rotational motion','NEET · Human physiology','NEET PG · Pharmacology','UPSC · Article 280','CAT · Percentages','GATE · Heapify','SSC · Compound interest','JEE · Organic chemistry','NEET · Genetics'].map((item) => <span key={item}>{item}</span>)}
            {['JEE · Rotational motion','NEET · Human physiology','NEET PG · Pharmacology','UPSC · Article 280','CAT · Percentages','GATE · Heapify','SSC · Compound interest','JEE · Organic chemistry','NEET · Genetics'].map((item) => <span key={`${item}-copy`} aria-hidden="true">{item}</span>)}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="pain-heading">
          <div className="lp-wrap">
            <p className="lp-eyebrow">For aspirants</p>
            <h2 id="pain-heading">Sound familiar?</h2>
            <p className="lp-section-lede">Tap a card to see how the loop changes it.</p>
            <div className="lp-pain-grid">
              {PAINS.map((pain, index) => (
                <button key={pain.front} type="button" className="lp-flip" aria-pressed={openPain === index} onClick={() => setOpenPain(openPain === index ? null : index)}>
                  <span className="lp-flip-inner"><span className="lp-flip-front"><b>{pain.front}</b><small>The problem · tap to flip</small></span><span className="lp-flip-back"><small>The fix</small><b>{pain.back}</b></span></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section" id="how" aria-labelledby="how-heading">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <p className="lp-eyebrow">How it works</p>
              <h2 id="how-heading">Follow one mistake to the next mock.</h2>
              <p className="lp-section-lede">The screen changes with your exam and the evidence you log.</p>
            </div>
            <div className="lp-story">
              <div className="lp-step-list" role="tablist" aria-label="How VicharakAI works">
                {STEPS.map((step, index) => (
                  <button key={step[1]} type="button" role="tab" aria-selected={activeStep === index} onClick={() => setActiveStep(index)}>
                    <span>{step[0]}</span><b>{step[1]}</b><small>{step[2]}</small>
                  </button>
                ))}
              </div>
              <div className="lp-story-card" aria-live="polite">
                <Logo logoUrl={logoUrl} alt="VicharakAI mistake-analysis step" size={48} />
                <p>{STEPS[activeStep][0]}</p>
                <h3>{STEPS[activeStep][1]}</h3>
                <div className="lp-mistake-card"><small>{exam.label} · {exam.subjects}</small><b>{exam.concept}</b><p>{exam.question}</p></div>
                {activeStep >= 1 && <div className="lp-reason"><X size={16} /> {exam.mistake}</div>}
                {activeStep >= 2 && <div className="lp-revision"><CalendarDays size={16} /> Due on your revision schedule</div>}
                {activeStep >= 3 && <div className="lp-correct"><Check size={16} /> Fresh question answered correctly</div>}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section" id="exams" aria-labelledby="exam-heading">
          <div className="lp-wrap">
            <p className="lp-eyebrow">Your exam</p>
            <h2 id="exam-heading">Built for your syllabus. Timed to your exam date.</h2>
            <div className="lp-exam-grid">
              <div className="lp-exam-cards">{EXAMS.map((item, index) => <button key={item.id} type="button" aria-pressed={index === activeExam} onClick={() => setActiveExam(index)}><b>{item.label}</b><span>{item.subjects}</span></button>)}</div>
              <div className="lp-exam-info">
                <Logo logoUrl={logoUrl} alt={`${exam.label} study planner`} size={42} />
                <p>VicharakAI for</p><h3>{exam.label}</h3>
                <dl><div><dt>Syllabus</dt><dd><Check size={15} /> {exam.subjects}</dd></div><div><dt>Example concept</dt><dd>{exam.concept}</dd></div></dl>
                <label htmlFor="days-to-exam">Days to your exam: <b>{daysToExam}</b></label>
                <input id="days-to-exam" type="range" min="7" max="365" value={daysToExam} onChange={(event) => setDaysToExam(Number(event.target.value))} />
                <p className="lp-count"><b>{exam.concept}</b> can return {reviewCount} time{reviewCount === 1 ? '' : 's'} before exam day.</p>
                <small>Each successful recall widens the gap; a difficult recall brings the concept back sooner.</small>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="features-heading">
          <div className="lp-wrap">
            <p className="lp-eyebrow">Inside the app</p>
            <h2 id="features-heading">Everything an aspirant needs. Nothing extra.</h2>
            <div className="lp-feature-grid">{FEATURES.map(({ Icon, title, copy }, index) => <article key={title} className={index < 2 ? 'lp-wide' : ''}><Icon size={22} /><h3>{title}</h3><p>{copy}</p></article>)}</div>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="compare-heading">
          <div className="lp-wrap">
            <p className="lp-eyebrow">Compare</p>
            <h2 id="compare-heading">Notebook? Flashcards? Here’s the difference.</h2>
            <div className="lp-table-wrap"><table><thead><tr><th>Feature</th><th>Notebook</th><th>Flashcards</th><th>VicharakAI</th></tr></thead><tbody>
              <tr><th>Saves mock mistakes</th><td>Manual</td><td>Manual</td><td><Check size={16} /> Log or scan</td></tr>
              <tr><th>Knows why you missed it</th><td>—</td><td>—</td><td><Check size={16} /> Four error reasons</td></tr>
              <tr><th>Schedules revision</th><td>—</td><td><Check size={16} /> Cards only</td><td><Check size={16} /> Whole study plan</td></tr>
              <tr><th>Finds related practice</th><td>—</td><td>—</td><td><Check size={16} /> From your weak topic</td></tr>
            </tbody></table></div>
          </div>
        </section>

        <section className="lp-section" id="pricing" aria-labelledby="pricing-heading">
          <div className="lp-wrap">
            <p className="lp-eyebrow">Pricing</p>
            <h2 id="pricing-heading">7 days free. Then ₹149 a month.</h2>
            <div className="lp-pricing-grid">
              <article className="lp-founder">
                <Logo logoUrl={logoUrl} alt="VicharakAI founder story" size={58} />
                <blockquote>“I built VicharakAI while preparing for my own exam. My mock mistakes kept getting lost in notebooks.”</blockquote>
                <p>I scored 420 in NEET 2026 and learned the hard way that studying more does not help when the same gaps keep returning. This is the system I wish I had.</p>
                <b>Rohan · Founder and aspirant</b>
              </article>
              <article className="lp-price-card">
                <div><Logo logoUrl={logoUrl} alt="VicharakAI Premium plan" size={34} /><span>All exams</span></div>
                <p className="lp-amount">₹149<small>/month after trial</small></p>
                <p>Full access free for 7 days · no card needed</p>
                <ul>{['Every mistake from every mock','Concepts saved, tagged and explained','Revision scheduled automatically','Related-question practice','Daily plan, calendar and test analysis','All supported exams included'].map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
                <button type="button" className="lp-btn" onClick={() => start('pricing-monthly')}>Start 7-day free trial</button>
                <small>The trial ends without a charge. Then choose ₹149 for one month via Razorpay · UPI, cards or wallets.</small>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-section" id="faq" aria-labelledby="faq-heading">
          <div className="lp-wrap">
            <p className="lp-eyebrow">FAQ</p><h2 id="faq-heading">Questions</h2>
            <div className="lp-faq">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<ChevronRight size={18} /></summary><p>{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="lp-wrap lp-final">
          <Logo logoUrl={logoUrl} alt="VicharakAI revision reminder" size={62} />
          <p className="lp-hook"><span aria-hidden="true" />Your next mock is coming.</p>
          <h2>Don’t take the same mistakes into it.</h2>
          <button type="button" className="lp-btn" onClick={() => start('close')}>Start 7-day free trial <ArrowRight size={18} /></button>
          <p>7 days free with no card. The trial ends without a charge; Premium is ₹149 for one month through Razorpay.</p>
        </section>
      </main>

      <footer className="lp-footer lp-wrap">
        <a className="lp-brand" href="/"><Logo logoUrl={logoUrl} alt="VicharakAI footer home" size={30} /><span>{t.brandName}</span></a>
        <nav aria-label="Footer"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a><a href={`mailto:${supportEmail}`}>Support</a></nav>
      </footer>

      <div className="lp-mobile-bar"><button type="button" className="lp-btn" onClick={() => start('mobile-sticky')}>Start 7-day free trial</button></div>
    </div>
  );
}

const CSS = `
.lp-dark{--bg:#040817;--bg2:#070d24;--card:#0b1330;--card2:#0e1838;--line:rgba(140,165,255,.15);--line2:rgba(140,165,255,.28);--text:#f2f5ff;--text2:#a9b3d4;--text3:#7280aa;--blue:#0057ff;--blue2:#2f82f5;--blue3:#6c9bff;min-height:100%;overflow-x:clip;background:var(--bg);color:var(--text);font:400 17px/1.62 "IBM Plex Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}.lp-dark *{box-sizing:border-box}.lp-dark h1,.lp-dark h2,.lp-dark h3{margin:0;font-family:"Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.035em;line-height:1.04}.lp-dark p{margin:0}.lp-dark a{color:inherit}.lp-wrap{width:min(1200px,100%);margin:0 auto;padding-inline:28px}.lp-top{position:sticky;top:0;z-index:50;background:linear-gradient(180deg,rgba(4,8,23,.96),rgba(4,8,23,.82));border-bottom:1px solid rgba(108,155,255,.2);backdrop-filter:blur(20px);box-shadow:0 14px 34px -30px rgba(0,87,255,.85)}.lp-top-inner{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:20px}.lp-brand{display:inline-flex;align-items:center;gap:11px;color:var(--text)!important;text-decoration:none}.lp-brand-copy{display:grid;gap:3px}.lp-brand-copy b{font:800 21px/1 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.025em}.lp-brand-copy small{font:600 10px/1 "IBM Plex Sans",system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:var(--blue3)}.lp-logo-image{display:block;object-fit:contain;border-radius:10px;filter:drop-shadow(0 8px 16px rgba(0,87,255,.25))}.lp-logo-fallback{display:grid;place-items:center;border-radius:9px;background:linear-gradient(135deg,var(--blue),#003ab0);color:#fff;font-weight:800}.lp-nav{display:flex;align-items:center;gap:24px}.lp-nav a{position:relative;color:var(--text2);text-decoration:none;font-size:14px;font-weight:600;padding-block:10px}.lp-nav a::after{content:"";position:absolute;left:0;right:100%;bottom:4px;height:2px;background:var(--blue2);border-radius:2px;transition:right .2s}.lp-nav a:hover{color:#fff}.lp-nav a:hover::after{right:0}.lp-nav button,.lp-btn{border:0;border-radius:13px;background:linear-gradient(135deg,var(--blue2),var(--blue),#003ab0);color:#fff;font:700 15px/1 "IBM Plex Sans",system-ui,sans-serif;padding:14px 20px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 16px 36px -16px rgba(0,87,255,.9);transition:transform .18s,filter .18s}.lp-nav button:hover,.lp-btn:hover{transform:translateY(-2px);filter:brightness(1.08)}.lp-btn-ghost{background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px var(--line2);color:var(--text)}.lp-hero{position:relative;overflow:hidden;background:radial-gradient(45rem 38rem at 80% 20%,rgba(0,87,255,.33),transparent 66%),radial-gradient(34rem 28rem at 10% 8%,rgba(108,155,255,.1),transparent 65%),linear-gradient(180deg,var(--bg2),var(--bg));border-bottom:1px solid var(--line)}.lp-hero::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(rgba(108,155,255,.035) 1px,transparent 1px) 0 0/64px 64px,linear-gradient(90deg,rgba(108,155,255,.035) 1px,transparent 1px) 0 0/64px 64px;mask-image:radial-gradient(ellipse 75% 70% at 65% 25%,#000 25%,transparent 75%)}.lp-hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);align-items:center;gap:50px;min-height:760px;padding-block:56px}.lp-hook{display:inline-flex;align-items:center;gap:9px;border:1px solid var(--line2);border-radius:999px;padding:7px 12px;color:var(--text2);font-size:14px;background:rgba(255,255,255,.035)}.lp-hook span{width:8px;height:8px;border-radius:50%;background:var(--blue2);box-shadow:0 0 0 5px rgba(0,87,255,.16)}.lp-hero h1{margin-top:22px;font-size:clamp(46px,5.2vw,76px);line-height:.98}.lp-hero h1 strong{display:block;color:#fff}.lp-hero h1 strong::first-line{color:#fff}.lp-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}.lp-forget{display:inline-flex;white-space:nowrap;color:var(--blue3);filter:drop-shadow(0 0 24px rgba(0,87,255,.35))}.lp-forget i{display:inline-block;font-style:normal;animation:lpForget 6s cubic-bezier(.5,0,.3,1) infinite;animation-delay:calc(var(--letter-index) * 70ms + 1.25s)}@keyframes lpForget{0%,8%{opacity:1;filter:blur(0);transform:none;color:var(--blue3)}28%{opacity:.04;filter:blur(10px);transform:translateY(-10px) rotate(-6deg);color:var(--text3)}40%{opacity:.04;filter:blur(10px);transform:translateY(-10px) rotate(-6deg)}52%{opacity:1;filter:blur(0);transform:none;color:#fff;text-shadow:0 0 28px rgba(47,130,245,.95)}64%,100%{opacity:1;filter:blur(0);transform:none;color:var(--blue3);text-shadow:none}}.lp-sub{margin-top:24px;max-width:31em;color:var(--text2);font-size:19px}.lp-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.lp-trust{display:flex;align-items:center;gap:10px;margin-top:20px;color:var(--text3);font-size:14px}.lp-exam-picker{margin-top:28px}.lp-exam-picker>span{font-size:13px;color:var(--text3)}.lp-exam-picker>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.lp-exam-picker button{border:1px solid var(--line2);border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.035);color:var(--text2);font:600 13px/1 "IBM Plex Sans";cursor:pointer}.lp-exam-picker button[aria-pressed=true]{background:var(--blue);border-color:var(--blue);color:#fff}.lp-hero-art{position:relative;min-height:690px;perspective:1500px}.hm-stage{position:relative;width:100%;height:690px;transform-style:preserve-3d}.hm-orbit{position:absolute;left:50%;top:45%;width:560px;height:560px;margin:-280px 0 0 -260px;border-radius:50%;border:1px solid rgba(108,155,255,.16);box-shadow:inset 0 0 120px rgba(0,87,255,.16)}.hm-orbit::before{content:"";position:absolute;inset:58px;border-radius:50%;border:1px dashed rgba(108,155,255,.2);animation:hmSpin 60s linear infinite}.hm-orbit::after{content:"";position:absolute;left:50%;top:-5px;width:10px;height:10px;border-radius:50%;background:var(--blue3);box-shadow:0 0 18px 4px rgba(0,87,255,.75);transform-origin:5px 285px;animation:hmSpin 14s linear infinite}@keyframes hmSpin{to{transform:rotate(360deg)}}.hm-phone{position:relative;width:286px;padding:9px;border-radius:48px;background:#0b0f19;box-shadow:inset 0 0 0 1.5px #2b3245,0 38px 78px -26px rgba(0,0,0,.9),0 0 65px -18px rgba(0,87,255,.58)}.hm-screen{position:relative;height:600px;border-radius:39px;overflow:hidden;background:#f5f7fc;color:#0e1a3a;font:400 12.5px/1.42 "IBM Plex Sans",system-ui,sans-serif;display:flex;flex-direction:column}.hm-island{position:absolute;top:9px;left:50%;width:82px;height:23px;margin-left:-41px;border-radius:12px;background:#0b0f19;z-index:5}.hm-status{height:42px;padding:12px 25px 0;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600}.hm-signal{display:flex;align-items:flex-end;gap:2px}.hm-signal i{display:block;width:3px;border-radius:1px;background:#0e1a3a}.hm-signal i:nth-child(1){height:4px}.hm-signal i:nth-child(2){height:6px}.hm-signal i:nth-child(3){height:8px}.hm-signal i:nth-child(4){height:10px}.hm-signal b{width:20px;height:10px;margin-left:4px;border:1.5px solid #0e1a3a;border-radius:3px}.hm-head{display:flex;align-items:flex-end;justify-content:space-between;padding:8px 16px 12px}.hm-head span{display:grid}.hm-head small{color:#68758d}.hm-head b{font:700 25px/1.05 "Bricolage Grotesque"}.hm-progress{padding:0 15px 11px;color:#68758d;font-size:11px}.hm-progress i{display:block;height:4px;margin-top:5px;border-radius:2px;background:#e2e7f1;overflow:hidden}.hm-progress i b{display:block;width:28%;height:100%;background:#0057ff}.hm-tasks{display:grid;gap:7px;padding:0 13px}.hm-task{display:grid;grid-template-columns:20px 1fr;gap:8px;padding:9px 10px;border:1px solid #e2e7f1;border-radius:6px;background:#fff}.hm-check{width:18px;height:18px;margin-top:2px;border:1.5px solid #8b95ae;border-radius:50%}.hm-task p{display:grid}.hm-task small{font-size:10px;color:#5a6684}.hm-task b{font-size:12px}.hm-task em{font-style:normal;font-size:10px;color:#8b95ae}.hm-task-muted{opacity:.64}.hm-tabs{margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);padding:10px 5px 22px;border-top:1px solid #e2e7f1;background:#fff}.hm-tabs span{text-align:center;font-size:9px;color:#8b95ae}.hm-tabs .on{color:#0057ff;font-weight:700}.hm-topbar{display:flex;align-items:center;gap:8px;padding:8px 15px 11px}.hm-topbar b{font-size:15px}.hm-topbar span{margin-left:auto;padding:3px 7px;border-radius:999px;background:#e7eefe;color:#0b2b73;font-size:10px}.hm-mistake-body{display:grid;gap:8px;padding:0 13px 14px}.hm-card{padding:11px;border:1px solid #e2e7f1;border-radius:7px;background:#fff}.hm-card>small{display:block;color:#68758d;margin-bottom:5px}.hm-card>b{display:block;font-size:14px}.hm-reasons{display:grid;grid-template-columns:1fr 1fr;gap:5px}.hm-reasons span{padding:7px;border:1px solid #e2e7f1;border-radius:5px;color:#68758d;font-size:10px}.hm-reasons .on{border-color:#0057ff;background:#e7eefe;color:#0b2b73}.hm-related{display:flex;align-items:center;justify-content:space-between}.hm-related b{padding:5px 8px;border-radius:5px;background:#0057ff;color:#fff;font-size:10px}.hm-explain{background:#e7eefe}.hm-explain p{font-size:10.5px;color:#44516d}.hm-back{position:absolute;left:10px;top:70px;transform:translateZ(-70px) rotate(-8deg) scale(.86);opacity:.58;filter:saturate(.72)}.hm-main{position:absolute;right:24px;top:12px;transform:translateZ(45px) rotate(3deg)}.hm-curve-card{position:absolute;z-index:4;left:-18px;right:150px;bottom:8px;padding:15px 17px;border:1px solid rgba(108,155,255,.28);border-radius:18px;background:linear-gradient(180deg,rgba(14,24,56,.96),rgba(7,13,36,.96));box-shadow:0 26px 60px -28px #000;backdrop-filter:blur(16px)}.hm-curve-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.hm-curve-top p{font-size:12px;color:var(--text2)}.hm-curve-top>div{display:flex;padding:3px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.03)}.hm-curve-top button{border:0;border-radius:6px;padding:6px 8px;background:transparent;color:var(--text3);font:600 10px/1 "IBM Plex Sans";cursor:pointer}.hm-curve-top button[aria-pressed=true]{background:rgba(0,87,255,.26);color:#fff}.hm-curve-card svg{display:block;width:100%;height:150px;margin-top:5px}.hm-grid line{stroke:rgba(108,155,255,.11)}.hm-axis{stroke:rgba(108,155,255,.45);stroke-width:1.5}.hm-decay{fill:none;stroke:#7280aa;stroke-width:2.5;stroke-linecap:round;transition:opacity .25s}.hm-held{fill:none;stroke:#2f82f5;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;transition:opacity .25s}.hm-decay.dim,.hm-held.dim{opacity:.14}.hm-revision-dot{fill:#0e1838;stroke:#6c9bff;stroke-width:2}.hm-curve-card text{fill:var(--text3);font:600 10px "IBM Plex Sans"}.hm-curve-read{display:flex;align-items:baseline;gap:9px}.hm-curve-read b{font:800 28px/1 "Bricolage Grotesque"}.hm-curve-read span{color:var(--text2);font-size:11px}.hm-tag{position:absolute;z-index:6;display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid var(--line2);border-radius:12px;background:rgba(11,19,48,.94);box-shadow:0 16px 34px -16px #000;color:var(--text);font-size:12px;animation:hmBob 5s ease-in-out infinite}.hm-tag-one{left:52px;top:25px}.hm-tag-two{right:-3px;top:278px;animation-delay:.7s}.hm-tag-three{right:20px;bottom:52px;animation-delay:1.4s}@keyframes hmBob{50%{transform:translateY(-8px)}}.lp-ticker{overflow:hidden;border-bottom:1px solid var(--line);padding:18px 0;background:rgba(255,255,255,.015);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}.lp-ticker>div{display:flex;gap:10px;width:max-content;animation:lpMarquee 48s linear infinite}.lp-ticker span{border:1px solid var(--line);border-radius:999px;padding:8px 13px;color:var(--text2);white-space:nowrap;font-size:13px;background:rgba(255,255,255,.025)}@keyframes lpMarquee{to{transform:translateX(-50%)}}.lp-section{padding:100px 0;content-visibility:auto;contain-intrinsic-size:1px 780px}.lp-section+.lp-section{border-top:1px solid var(--line)}.lp-eyebrow{display:flex;align-items:center;gap:8px;color:var(--blue3);font-size:13px;font-weight:700;margin-bottom:13px;text-transform:uppercase;letter-spacing:.12em}.lp-eyebrow::before{content:"";width:18px;height:2px;background:var(--blue2)}.lp-section h2,.lp-final h2{max-width:850px;font-size:clamp(36px,4.5vw,58px)}.lp-section-lede{margin-top:14px;color:var(--text2);font-size:18px}.lp-pain-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:42px}.lp-flip{height:250px;border:0;padding:0;background:none;color:inherit;text-align:left;perspective:1000px;cursor:pointer}.lp-flip-inner{position:relative;display:block;width:100%;height:100%;transform-style:preserve-3d;transition:transform .65s}.lp-flip[aria-pressed=true] .lp-flip-inner{transform:rotateY(180deg)}.lp-flip-front,.lp-flip-back{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:23px;border-radius:20px;backface-visibility:hidden}.lp-flip-front{border:1px solid rgba(108,155,255,.23);background:linear-gradient(180deg,rgba(108,155,255,.08),rgba(255,255,255,.02))}.lp-flip-back{transform:rotateY(180deg);border:1px solid rgba(108,155,255,.55);background:linear-gradient(145deg,#17457f,#003ab0)}.lp-flip b{font:700 21px/1.25 "Bricolage Grotesque"}.lp-flip small{color:var(--text3)}.lp-flip-back small{color:#c6d8ff}.lp-story{display:grid;grid-template-columns:.9fr 1.1fr;gap:30px;align-items:stretch;margin-top:44px;padding:34px;border:1px solid var(--line);border-radius:27px;background:radial-gradient(40rem 30rem at 80% 40%,rgba(0,87,255,.17),transparent 70%),rgba(255,255,255,.015)}.lp-step-list{display:grid;gap:7px}.lp-step-list button{display:grid;grid-template-columns:70px 1fr;gap:4px 12px;padding:14px;border:1px solid transparent;border-radius:15px;background:transparent;color:inherit;text-align:left;cursor:pointer}.lp-step-list button[aria-selected=true]{background:rgba(255,255,255,.04);border-color:var(--line2)}.lp-step-list span{grid-row:span 2;color:var(--text3);font-size:12px}.lp-step-list b{font-size:17px}.lp-step-list small{grid-column:2;color:var(--text2)}.lp-story-card{min-height:440px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:34px;border:1px solid var(--line2);border-radius:22px;background:linear-gradient(160deg,rgba(14,24,56,.96),rgba(7,13,36,.96));box-shadow:0 30px 60px -35px #000}.lp-story-card>p{margin-top:16px;color:var(--blue3);font-weight:600}.lp-story-card>h3{font-size:34px;margin-top:4px}.lp-mistake-card{width:100%;margin-top:22px;padding:16px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.035)}.lp-mistake-card small{color:var(--text3)}.lp-mistake-card b{display:block;margin-top:4px}.lp-mistake-card p{margin-top:7px;color:var(--text2);font-size:14px}.lp-reason,.lp-revision,.lp-correct{display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 11px;border-radius:9px;background:rgba(0,87,255,.12);color:#dce8ff;font-size:13px}.lp-exam-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:42px}.lp-exam-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.lp-exam-cards button{display:flex;flex-direction:column;gap:5px;padding:17px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer}.lp-exam-cards button[aria-pressed=true]{border-color:var(--blue3);background:rgba(0,87,255,.18);box-shadow:0 0 35px -14px rgba(0,87,255,.8)}.lp-exam-cards b{font:750 22px/1 "Bricolage Grotesque"}.lp-exam-cards span{color:var(--text3);font-size:13px}.lp-exam-cards button:last-child:nth-child(odd){grid-column:span 2}.lp-exam-info{padding:28px;border:1px solid var(--line2);border-radius:22px;background:linear-gradient(180deg,var(--card2),var(--card))}.lp-exam-info>p{margin-top:14px;color:var(--text3)}.lp-exam-info h3{font-size:36px}.lp-exam-info dl{margin:20px 0}.lp-exam-info dl>div{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:11px 0;border-top:1px solid var(--line)}.lp-exam-info dt{color:var(--text3)}.lp-exam-info dd{margin:0;display:flex;align-items:flex-start;gap:6px}.lp-exam-info label{display:block;color:var(--text2)}.lp-exam-info input{width:100%;accent-color:var(--blue);margin-top:13px}.lp-count{margin-top:14px!important;padding:13px 14px;border:1px solid rgba(108,155,255,.25);border-radius:12px;background:rgba(0,87,255,.09);color:var(--text2)!important}.lp-count b{display:block;color:#fff;font-size:19px;line-height:1.25}.lp-exam-info>small{display:block;margin-top:9px;color:var(--text3);line-height:1.5}.lp-feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:42px}.lp-feature-grid article{min-height:210px;padding:24px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.012))}.lp-feature-grid article.lp-wide{grid-column:span 3;min-height:170px}.lp-feature-grid svg{color:var(--blue3)}.lp-feature-grid h3{font-size:22px;margin-top:20px}.lp-feature-grid p{margin-top:8px;color:var(--text2)}.lp-table-wrap{margin-top:38px;overflow:auto;border:1px solid var(--line);border-radius:20px}.lp-table-wrap table{width:100%;min-width:650px;border-collapse:collapse}.lp-table-wrap th,.lp-table-wrap td{padding:16px 18px;text-align:left;border-bottom:1px solid var(--line)}.lp-table-wrap tr:last-child>*{border-bottom:0}.lp-table-wrap th:last-child,.lp-table-wrap td:last-child{background:rgba(0,87,255,.13)}.lp-table-wrap td svg{vertical-align:-3px;color:var(--blue3)}.lp-pricing-grid{display:grid;grid-template-columns:1fr 430px;gap:20px;margin-top:42px}.lp-founder,.lp-price-card{padding:34px;border:1px solid var(--line2);border-radius:23px;background:linear-gradient(180deg,rgba(14,24,56,.92),rgba(7,13,36,.92))}.lp-founder blockquote{margin:25px 0 0;font:650 28px/1.35 "Bricolage Grotesque"}.lp-founder p{margin-top:16px;color:var(--text2)}.lp-founder>b{display:block;margin-top:28px}.lp-price-card{position:relative;box-shadow:0 0 0 1px rgba(0,87,255,.35),0 0 60px -24px rgba(0,87,255,.8)}.lp-price-card>div{display:flex;align-items:center;justify-content:space-between}.lp-price-card>div span{border:1px solid var(--line2);border-radius:999px;padding:5px 9px;color:var(--blue3);font-size:12px}.lp-amount{margin-top:18px!important;font:800 66px/1 "Bricolage Grotesque"}.lp-amount small{font:400 16px "IBM Plex Sans";color:var(--text2)}.lp-price-card>p:not(.lp-amount){color:var(--text3)}.lp-price-card ul{list-style:none;margin:23px 0;padding:0;display:grid;gap:10px}.lp-price-card li{display:flex;gap:9px}.lp-price-card li svg{color:var(--blue3);flex:none;margin-top:4px}.lp-price-card .lp-btn{width:100%}.lp-price-card>small{display:block;margin-top:11px;text-align:center;color:var(--text3)}.lp-faq{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:38px}.lp-faq details{padding:0 20px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}.lp-faq details[open]{border-color:var(--line2);background:rgba(0,87,255,.08)}.lp-faq summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:19px 0;font:650 17px/1.3 "Bricolage Grotesque";cursor:pointer}.lp-faq summary::-webkit-details-marker{display:none}.lp-faq details[open] summary svg{transform:rotate(90deg)}.lp-faq p{padding-bottom:19px;color:var(--text2)}.lp-final{margin-block:70px 45px;padding-block:75px;border:1px solid var(--line2);border-radius:30px;text-align:center;background:radial-gradient(38rem 24rem at 50% 0,rgba(0,87,255,.48),transparent 72%),var(--card)}.lp-final>.lp-logo-image,.lp-final>.lp-logo-fallback{margin-inline:auto}.lp-final .lp-hook{margin-top:20px}.lp-final h2{margin:20px auto 26px}.lp-final>p:last-child{margin-top:13px;color:var(--text3)}.lp-footer{display:flex;justify-content:space-between;align-items:center;gap:20px;padding-block:28px 90px;border-top:1px solid var(--line);color:var(--text3)}.lp-footer nav{display:flex;gap:18px}.lp-footer nav a{text-decoration:none;color:var(--text3)}.lp-mobile-bar{display:none}
@media(max-width:960px){.lp-hero-grid,.lp-story,.lp-exam-grid,.lp-pricing-grid{grid-template-columns:1fr}.lp-hero-grid{min-height:0}.lp-hero-art{min-height:690px;max-width:620px;width:100%;margin-inline:auto}.lp-pain-grid{grid-template-columns:repeat(2,1fr)}.lp-pricing-grid{grid-template-columns:1fr}.lp-founder,.lp-price-card{width:100%}.lp-feature-grid{grid-template-columns:repeat(2,1fr)}.lp-feature-grid article.lp-wide{grid-column:span 2}}
@media(max-width:680px){.lp-wrap{padding-inline:16px}.lp-top-inner{min-height:66px}.lp-brand-copy small{display:none}.lp-brand-copy b{font-size:18px}.lp-nav a{display:none}.lp-nav{gap:8px}.lp-nav button{padding:11px 13px;font-size:13px}.lp-nav button svg{display:none}.lp-hero-grid{padding-block:38px}.lp-hero h1{font-size:44px}.lp-sub{font-size:17px}.lp-actions{display:grid}.lp-btn{width:100%}.lp-hero-art{min-height:610px}.hm-stage{height:610px}.hm-orbit{width:360px;height:360px;margin:-180px 0 0 -180px;top:37%}.hm-orbit::after{transform-origin:5px 185px}.hm-back{display:none}.hm-main{right:auto;left:50%;top:5px;transform:translateX(-46%) rotate(2deg) scale(.83)}.hm-curve-card{left:0;right:0;bottom:0}.hm-curve-card svg{height:120px}.hm-tag-one{left:0;top:40px}.hm-tag-two{right:0;top:245px}.hm-tag-three{display:none}.lp-section{padding:76px 0}.lp-pain-grid{grid-template-columns:1fr 1fr;gap:9px}.lp-flip{height:210px}.lp-flip-front,.lp-flip-back{padding:16px}.lp-flip b{font-size:17px}.lp-story{padding:18px}.lp-step-list{grid-auto-flow:column;grid-auto-columns:78%;overflow:auto;scroll-snap-type:x mandatory}.lp-step-list button{grid-template-columns:1fr;scroll-snap-align:start}.lp-step-list span,.lp-step-list small{grid-column:1;grid-row:auto}.lp-story-card{min-height:390px;padding:22px}.lp-exam-cards{grid-template-columns:1fr 1fr}.lp-exam-info{padding:22px}.lp-feature-grid{grid-template-columns:1fr}.lp-feature-grid article.lp-wide{grid-column:span 1}.lp-faq{grid-template-columns:1fr}.lp-founder,.lp-price-card{padding:24px}.lp-founder blockquote{font-size:23px}.lp-amount{font-size:56px}.lp-final{margin:55px 16px 30px;padding:55px 20px}.lp-footer{padding-bottom:110px}.lp-footer nav{flex-wrap:wrap;justify-content:flex-end}.lp-mobile-bar{display:block;position:fixed;left:0;right:0;bottom:0;z-index:55;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:rgba(4,8,23,.94);border-top:1px solid var(--line);backdrop-filter:blur(14px)}.lp-mobile-bar .lp-btn{width:100%}}
@media(hover:hover){.lp-flip:hover .lp-flip-inner{transform:rotateY(180deg)}}
@media(prefers-reduced-motion:reduce){.lp-dark *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}.lp-forget i{opacity:1!important;filter:none!important;transform:none!important;color:var(--blue3)!important}.lp-ticker>div{animation:none;flex-wrap:wrap;width:auto;justify-content:center}.lp-ticker [aria-hidden=true]{display:none}}
`;
