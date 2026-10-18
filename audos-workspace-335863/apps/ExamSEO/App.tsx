import { applyPageSeo, breadcrumbSchema, faqSchema, softwareApplicationSchema } from '../../components/seoMeta';
import { SEONavbar } from '../../components/SeoChrome';
import { useEffect } from 'react';

/**
 * THE THIRTEEN EXAM LANDING PAGES (/jee, /neet, /upsc …).
 *
 * Each one is a distinct public URL and therefore needs a distinct <head>:
 * its own title, its own 150-160 character description, its own Open Graph
 * set, its own self-referencing canonical and its own structured data. The
 * host serves one document for every route and fills only the canonical, so
 * everything else is written here — see components/seoMeta.ts.
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
    examFullName: 'Joint Entrance Examination (JEE)',
    examLabel: 'JEE Main and Advanced',
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
  '/upsc': {
    title: 'UPSC Study Planner AI | Personalized Prep Strategy — VicharakAI',
    metaDescription: 'VicharakAI adapts your UPSC preparation daily — tracking GS, Optional, and Current Affairs revision so nothing slips through. Built for long 2-year prep cycles. Try free.',
    h1: 'Your AI Study Strategist for UPSC / IAS',
    examFullName: 'Union Public Service Commission Civil Services Examination',
    examLabel: 'UPSC Civil Services',
    subjects: ['General Studies I', 'General Studies II', 'General Studies III', 'General Studies IV', 'CSAT', 'Optional Subject'],
    keyTopics: ['Indian Polity', 'History', 'Geography', 'Economy', 'Environment', 'International Relations'],
    painPoints: [
      { pain: "UPSC prep runs for years. There's no way to track what you've read without forgetting it.", solution: 'VicharakAI builds a memory of every topic you study and schedules revision before it fades.' },
      { pain: "Current affairs keeps growing but static notes can't tell you what to prioritize", solution: 'Daily Vicharee targets factor in recency and weak areas together.' },
      { pain: "You never know if you're on track to finish the syllabus before prelims", solution: 'The pace signal tells you where you stand against your target date — every night.' },
    ],
    faqs: [
      { q: 'How do I keep two years of reading actually available in memory?', a: 'By making revision a scheduled obligation rather than a phase at the end. The standard UPSC failure is a first reading of everything and a second reading of almost nothing. Put each standard-book chapter and each note set on a spaced ladder as you finish it, and treat a short retrieval pass over old material as non-negotiable daily work alongside new reading.' },
      { q: 'Should Prelims revision and Mains revision look different?', a: 'Yes. Prelims rewards precise factual recall and elimination under time pressure, so its revision is dense, question-led and fast. Mains rewards structured articulation, so its revision is writing-led — recall the skeleton of an answer, write it, then compare with your source. Revising the same notes the same way for both is the most common wasted effort in UPSC preparation.' },
      { q: 'How do I stop current affairs from growing without limit?', a: 'Cap the intake and force the consolidation. Read from one primary source, convert what you read into themes that map onto the GS syllabus rather than date-wise entries, and revise the monthly consolidation rather than the daily clippings. Anything that cannot be attached to a syllabus heading is usually noise.' },
      { q: 'CSAT is qualifying. How much time should it get?', a: 'Enough to be certain, and no more. CSAT is a qualifying paper at 33 percent, so the goal is reliability rather than excellence: take timed papers periodically, find the one or two question types that cost you most, and fix those. Treating it as a scoring paper takes time away from GS; ignoring it entirely has ended otherwise strong attempts.' },
    ],
    cta: 'Start Your UPSC Study Plan Free',
  },
  '/cat': {
    title: 'CAT Preparation AI | Personalized MBA Study Planner — VicharakAI',
    metaDescription: 'VicharakAI plans your CAT preparation across QA, VARC and DILR with spaced revision, mock-error pattern tracking and daily AI targets tied to your exam date. 7-day free trial.',
    h1: 'AI-Powered Study Planning for CAT Aspirants',
    examFullName: 'Common Admission Test (CAT)',
    examLabel: 'CAT',
    subjects: ['Quantitative Aptitude', 'Verbal Ability & Reading Comprehension', 'Data Interpretation & Logical Reasoning'],
    keyTopics: ['Number Systems', 'Geometry', 'Reading Comprehension', 'Data Sufficiency', 'Logical Reasoning Sets'],
    painPoints: [
      { pain: 'Mock scores plateau because you keep making the same mistakes', solution: 'VicharakAI tracks wrong-question patterns and builds targeted revision cards for your recurring gaps.' },
      { pain: 'Balancing VARC, QA and DILR practice without a system leads to uneven prep', solution: 'AI-generated daily targets keep all three sections progressing based on your weak spots.' },
      { pain: "No visibility on whether you'll be mock-ready by your target date", solution: 'The nightly pace signal shows exactly where you stand relative to your exam date.' },
    ],
    faqs: [
      { q: 'My mock percentile has been flat for weeks. What should change?', a: 'Almost always the analysis, not the number of mocks. Go back through your last three papers and sort every miss into: did not know the concept, knew it but picked the wrong approach, right approach but ran out of time, or should never have attempted it. Those four buckets need four different responses, and most plateaued aspirants are treating all of them as \u201cpractise more\u201d.' },
      { q: 'How should I split time across VARC, DILR and QA?', a: 'By marginal return, not equally. CAT is sectionally timed, so a section where you are already comfortable has a low ceiling for extra hours, while the weakest section usually has the steepest early gains. Review the split every two or three mocks rather than fixing it at the start of your preparation.' },
      { q: 'How many mocks are enough?', a: 'Enough that the format stops costing you anything, and spaced so that each one is fully analysed before the next. A mock you do not break down is practice without feedback. Many strong candidates spend longer analysing a paper than sitting it.' },
      { q: 'Does VicharakAI teach CAT concepts?', a: 'No. It is the planning and memory layer: it schedules revision of what you have studied, records the error patterns your mocks reveal, and tells you what today should contain. Your coaching material and question banks remain the source of the concepts themselves.' },
    ],
    cta: 'Start Your CAT Study Plan Free',
  },
  '/clat': {
    title: 'CLAT Preparation AI | Personalized Law Entrance Planner — VicharakAI',
    metaDescription: 'VicharakAI plans CLAT revision across Legal Reasoning, English, Logical Reasoning, GK and Quantitative Techniques with spaced repetition and weak-area detection. 7-day free trial.',
    h1: 'Your AI Study Strategist for CLAT',
    examFullName: 'Common Law Admission Test (CLAT)',
    examLabel: 'CLAT',
    subjects: ['English Language', 'Current Affairs & General Knowledge', 'Legal Reasoning', 'Logical Reasoning', 'Quantitative Techniques'],
    keyTopics: ['Reading Comprehension', 'Constitutional Law', 'Contracts', 'Critical Reasoning', 'Legal General Knowledge'],
    painPoints: [
      { pain: 'Legal reasoning needs deep conceptual revision — not one careful reading', solution: 'Spaced repetition brings legal principles back at intervals that make them stick.' },
      { pain: "Current affairs for CLAT keeps moving — it's hard to know what is enough", solution: "VicharakAI logs and tracks what you've covered so you neither over-index nor miss key areas." },
      { pain: 'No system to know which sections need the most work before the exam', solution: 'The AI surfaces your weakest sections so you prioritise the ones that move your score most.' },
    ],
    faqs: [
      { q: 'CLAT is comprehension-based now. Does that change how I prepare?', a: 'Substantially. Every section is built around a passage, so reading speed with retention is a cross-sectional skill rather than an English-only one. Practise extracting the principle, the facts and the question being asked as three separate steps — most wrong answers in Legal Reasoning come from misreading the passage, not from not knowing law.' },
      { q: 'How much law do I actually need to know?', a: 'Less than most aspirants assume, and more carefully than they practise. The passage supplies the principle; your job is to apply it exactly as written, even when it differs from the real legal position you half-remember. Background reading in Constitutional Law and Contracts helps you read faster, but applying the given principle literally is the scoring skill.' },
      { q: 'How do I keep current affairs manageable?', a: 'Read one reliable source consistently and consolidate weekly into themes rather than collecting daily facts. Then revise the consolidations on a spacing schedule. GK that is read once and never retrieved is effectively not studied.' },
      { q: 'What does VicharakAI add to coaching material I already have?', a: 'It decides what comes back and when. Your material supplies the content; VicharakAI keeps a dated record of what you have covered, schedules retrieval before it fades, and traces repeated mistakes to the underlying skill — passage reading, principle application or elimination — rather than to a chapter name.' },
    ],
    cta: 'Start Your CLAT Study Plan Free',
  },
  '/ssc': {
    title: 'SSC CGL Preparation AI | Personalized Study Planner — VicharakAI',
    metaDescription: 'VicharakAI plans SSC CGL and CHSL preparation with spaced revision across Quant, Reasoning, English and General Awareness, plus AI weak-topic detection. 7-day free trial.',
    h1: 'Beat SSC With a Daily AI Study Plan',
    examFullName: 'Staff Selection Commission (SSC CGL / CHSL / MTS)',
    examLabel: 'SSC CGL and CHSL',
    subjects: ['General Intelligence & Reasoning', 'General Awareness', 'Quantitative Aptitude', 'English Comprehension'],
    keyTopics: ['Analogies', 'Series', 'Arithmetic', 'History & Polity', 'Grammar', 'Vocabulary'],
    painPoints: [
      { pain: 'The syllabus overlaps across tiers, so candidates re-study already-strong areas', solution: 'VicharakAI maps strength and weakness per topic so daily targets focus where it matters.' },
      { pain: 'Competition is tight — weak General Awareness can sink a strong Quant score', solution: 'The AI keeps daily coverage balanced across all four sections.' },
      { pain: 'Practising questions without tracking patterns means repeating the same mistakes', solution: 'Wrong-question cards with spaced repetition fix the underlying gap, not the symptom.' },
    ],
    faqs: [
      { q: 'Tier 1 is about speed. How do I build it without sacrificing accuracy?', a: 'Separate the two during practice. Do one set purely for accuracy with no clock, identify which question types you get right slowly, and only then drill those types against a timer. Trying to improve both at once usually produces fast wrong answers, which cost more than slow right ones under negative marking.' },
      { q: 'General Awareness feels bottomless. How do I bound it?', a: 'Treat it as a recall problem with a fixed intake. Pick a limited static source plus one current-affairs source, and spend most of your GA time retrieving rather than reading. Spaced review of a smaller, well-chosen set beats a larger set you have only read once.' },
      { q: 'Should I prepare for Tier 1 and Tier 2 separately?', a: 'Mostly no, because the syllabus overlaps heavily — but the depth differs. Build the concepts once, keep them on a revision ladder, and change the practice format as the tier approaches rather than restarting the content.' },
      { q: 'Does VicharakAI include SSC question banks?', a: 'It is a planner, not a content provider. You log what you study and what you get wrong; it schedules the revision and points at the recurring weakness. Your existing books, PYQ sets and test series stay exactly where they are.' },
    ],
    cta: 'Start Your SSC Study Plan Free',
  },
  '/rrb': {
    title: 'RRB Exam Preparation AI | NTPC & Group D Planner — VicharakAI',
    metaDescription: 'VicharakAI plans RRB NTPC, Group D and JE preparation with spaced revision, daily AI targets and weak-topic alerts across Maths, Reasoning and General Awareness. 7-day free trial.',
    h1: 'Your AI Study Strategist for RRB Exams',
    examFullName: 'Railway Recruitment Board (RRB NTPC, Group D, ALP, JE)',
    examLabel: 'RRB NTPC and Group D',
    subjects: ['Mathematics', 'General Intelligence & Reasoning', 'General Science', 'General Awareness'],
    keyTopics: ['Number Systems', 'Speed & Distance', 'Current Affairs', 'Physics Basics', 'Reasoning Puzzles'],
    painPoints: [
      { pain: 'RRB prep often starts late — hard to know what to cover first with limited time', solution: 'VicharakAI prioritises the highest-impact topics for your exam date and current level.' },
      { pain: "Speed and accuracy both matter — practising slowly won't help on test day", solution: 'Logged mock scores shift the plan toward the topics dragging down your speed.' },
      { pain: 'Candidates study alone without knowing whether their pace is enough', solution: "A daily pace signal shows whether you're on track for each RRB stage." },
    ],
    faqs: [
      { q: 'RRB runs in stages. Should I prepare for all of them at once?', a: 'Build the common ground first. Maths, Reasoning and General Awareness carry across the computer-based stages, so the concepts are shared even when the depth and question count change. Keep one revision ladder for the shared content and add stage-specific practice as each stage approaches.' },
      { q: 'I started late. What should I cut?', a: 'Cut depth, not breadth, and let recency decide. Covering every topic once and keeping it on a short revision cycle beats mastering half the syllabus and forgetting the first quarter. When time is short, the ordering rule that pays best is highest-frequency topics first, oldest-unreviewed first.' },
      { q: 'How do I improve arithmetic speed?', a: 'Drill a narrow set of question types against a clock rather than solving mixed sets slowly. Speed in railway maths comes from recognising a question form instantly and knowing its shortcut, which is a recall skill — which means it responds to spaced practice the same way facts do.' },
      { q: 'What does VicharakAI do that a timetable does not?', a: 'A timetable tells you what you planned to do; VicharakAI tells you what you actually did and what that implies for today. It remembers every topic you logged, brings it back before it decays, and re-orders the day when a mock reveals a weak area.' },
    ],
    cta: 'Start Your RRB Study Plan Free',
  },
  '/inicet': {
    title: 'INI-CET Preparation AI | Personalized Revision Planner — VicharakAI',
    metaDescription: 'VicharakAI plans INI-CET revision across clinical and pre-clinical subjects with spaced repetition, AI weak-subtopic detection and daily targets built for AIIMS aspirants. 7-day free trial.',
    h1: 'The AI Study Companion for INI-CET Aspirants',
    examFullName: 'Institutes of National Importance Combined Entrance Test (INI-CET)',
    examLabel: 'INI-CET',
    subjects: ['Medicine', 'Surgery', 'Obstetrics & Gynaecology', 'Paediatrics', 'Pharmacology', 'Pathology', 'Biochemistry'],
    keyTopics: ['Internal Medicine', 'Surgery Principles', 'Microbiology', 'Physiology', 'ENT', 'Ophthalmology'],
    painPoints: [
      { pain: 'A vast clinical syllabus with rapid-fire questions — precision matters', solution: "VicharakAI's weakness detection targets the clinical subtopics dragging your accuracy down." },
      { pain: 'The question style demands conceptual clarity, not rote recall', solution: 'AI-generated revision cards target the underlying gap rather than the topic label.' },
      { pain: 'Hard to track revision across fifteen-plus subjects without missing critical areas', solution: 'The spaced repetition scheduler makes sure no subject falls through the cracks.' },
    ],
    faqs: [
      { q: 'How is preparing for INI-CET different from NEET PG?', a: 'The syllabus overlaps almost completely, so the difference is in precision rather than coverage. INI-CET questions tend to reward exact recall of specific clinical detail and the reasoning behind it, which means your revision has to be retrieval-based. Recognising an answer when you see it is not the same as producing it.' },
      { q: 'How should I prioritise across so many subjects?', a: 'Weight by the marks you are actually losing, not by subject size. Tag every wrong question with its subject and subtopic, and let the ranking emerge from your own data. Most candidates discover that two or three subtopics account for a disproportionate share of their losses.' },
      { q: 'Is it worth revising pre-clinical subjects late in preparation?', a: 'Short retrieval passes, yes; full re-reading, usually not. Biochemistry, Physiology and Pharmacology underpin clinical reasoning, so keeping them on a long interval costs little time and prevents the slow decay that shows up as \u201ccareless\u201d clinical mistakes.' },
      { q: 'Does VicharakAI supply INI-CET questions?', a: 'No. It plans revision, tracks retention and analyses the mistakes you log. Your question bank and notes stay yours — the app decides when you should come back to them and what to look at first.' },
    ],
    cta: 'Start Your INI-CET Study Plan Free',
  },
  '/mpsc': {
    title: 'MPSC Preparation AI | Personalized Study Planner — VicharakAI',
    metaDescription: 'VicharakAI plans MPSC preparation across Maharashtra-specific and national General Studies with spaced revision, CSAT practice and AI weak-topic detection. 7-day free trial.',
    h1: 'Your AI Study Strategist for MPSC',
    examFullName: 'Maharashtra Public Service Commission (MPSC)',
    examLabel: 'MPSC',
    subjects: ['General Studies I', 'General Studies II', 'CSAT', 'Marathi & English Language', 'Optional Subject'],
    keyTopics: ['Maharashtra History & Geography', 'Indian Polity', 'Economy', 'Science & Technology', 'Current Affairs'],
    painPoints: [
      { pain: 'The syllabus blends Maharashtra-specific and national GS — hard to manage both', solution: 'VicharakAI tracks both tracks and balances coverage around your weak areas.' },
      { pain: 'Prelims and Mains need different depths and candidates under-prepare for Mains', solution: 'The AI plan shifts depth targets as your exam stage changes.' },
      { pain: 'Multiple papers create revision overload without a system', solution: 'A bounded daily revision budget keeps every paper in rotation without burnout.' },
    ],
    faqs: [
      { q: 'How do I handle the Maharashtra-specific content alongside national GS?', a: 'Keep them as two tracks on one schedule rather than two study phases. State history, geography and polity reward the same spaced retrieval as national GS, and the overlap — governance, economy, schemes — is large enough that studying them together reinforces both. Problems appear when the state track is left until the end.' },
      { q: 'The language papers feel like a separate exam. How much time do they need?', a: 'Regular short exposure rather than a dedicated block. Grammar accuracy and comprehension speed in Marathi and English improve with frequent small practice, and both decay quickly if left alone for weeks. Treat them like any other topic on the revision ladder.' },
      { q: 'How should Mains preparation differ from Prelims?', a: 'Prelims revision is recognition-led and fast; Mains revision is production-led. For Mains, retrieve the structure of an answer from memory and write it before checking your source. The content may be identical, but revising it the Prelims way will not build the articulation Mains tests.' },
      { q: 'Does VicharakAI have MPSC-specific material?', a: 'It is a planning layer rather than a content library. You tell it what you studied from your own sources; it keeps the dated record, schedules retrieval, and surfaces where your test performance says the gaps are.' },
    ],
    cta: 'Start Your MPSC Study Plan Free',
  },
  '/banking': {
    title: 'Banking Exam Preparation AI | IBPS & SBI PO Planner — VicharakAI',
    metaDescription: 'VicharakAI plans IBPS PO, SBI PO and RBI Grade B preparation with spaced revision, daily AI targets and weak-topic detection across Quant, Reasoning, English and GA. 7-day free trial.',
    h1: 'Your AI Study Companion for Banking Exams',
    examFullName: 'Banking Exams (IBPS PO, SBI PO, RBI Grade B)',
    examLabel: 'IBPS PO, SBI PO and RBI Grade B',
    subjects: ['Quantitative Aptitude', 'Reasoning Ability', 'English Language', 'General Awareness', 'Computer Aptitude'],
    keyTopics: ['Data Interpretation', 'Puzzles & Seating Arrangement', 'Reading Comprehension', 'Banking Awareness', 'Number Series'],
    painPoints: [
      { pain: 'Multiple exams and rolling notifications make momentum hard to keep', solution: "VicharakAI keeps your preparation live whichever banking exam you're targeting next." },
      { pain: 'Speed and accuracy only come from pattern recognition built over time', solution: 'The AI tracks wrong-question patterns to find the sub-types costing you marks.' },
      { pain: 'General Awareness moves every month and candidates fall behind', solution: 'Daily targets keep current affairs and banking awareness in the revision rotation.' },
    ],
    faqs: [
      { q: 'Prelims is severely time-limited. How do I prepare for that specifically?', a: 'Practise selection as a skill, not just solving. In a sectionally timed prelims, deciding within seconds which puzzle or DI set to skip is worth more than solving one extra hard question. Time yourself choosing before you time yourself answering.' },
      { q: 'Puzzles and seating arrangement eat all my time. What helps?', a: 'Volume on a narrow set of formats, not variety. Most puzzle sets are permutations of a handful of structures; once you recognise the structure instantly, setup time collapses. Keep a log of the formats that still slow you down and revisit them on a spacing schedule rather than drilling randomly.' },
      { q: 'How do I keep Banking Awareness current without reading everything?', a: 'Consolidate monthly and retrieve weekly. Read from one source, compress it into a themed set, and spend your review time recalling rather than re-reading. Current affairs is the section where spaced retrieval pays off most visibly, because the intake never stops.' },
      { q: 'What does VicharakAI actually track for banking aspirants?', a: 'Every topic you log, when you last revised it, what your mocks say about accuracy per question type, and which sub-types keep recurring in your mistakes. From that it produces a daily queue and a pace signal against your target exam.' },
    ],
    cta: 'Start Your Banking Exam Study Plan Free',
  },
  '/defence': {
    title: 'Defence Exam Preparation AI | NDA, CDS & AFCAT Planner — VicharakAI',
    metaDescription: 'VicharakAI plans NDA, CDS and AFCAT preparation with spaced revision, AI weak-topic detection and daily targets that adapt to the study time you actually have. 7-day free trial.',
    h1: 'Your AI Study Strategist for Defence Exams',
    examFullName: 'Defence Exams (NDA, CDS, AFCAT, MNS)',
    examLabel: 'NDA, CDS and AFCAT',
    subjects: ['Mathematics', 'General Knowledge', 'English', 'General Science', 'Current Affairs'],
    keyTopics: ['Trigonometry', 'Algebra', 'History', 'Geography', 'General Science', 'Current Affairs'],
    painPoints: [
      { pain: 'Academic preparation and physical training compete for the same hours', solution: 'Vicharee adapts daily targets to the time you have — heavy days, light days, rest days.' },
      { pain: 'NDA and CDS maths needs conceptual clarity, not just shortcuts', solution: 'Weakness cards target the concept causing several wrong answers, not the symptom.' },
      { pain: 'Defence GK spans history, science, current affairs and defence awareness', solution: "VicharakAI builds a coverage map so you know what's solid and what's at risk." },
    ],
    faqs: [
      { q: 'How do I fit written preparation around physical training?', a: 'Plan in variable-length sessions rather than fixed blocks. On a heavy training day a twenty-minute retrieval pass over decaying topics keeps the schedule intact; on a light day you add new material. The thing that breaks defence preparation is not short days — it is skipped days that quietly become skipped weeks.' },
      { q: 'NDA Mathematics is a large paper. Where should I start?', a: 'With the topics that feed the most questions and the most other topics — algebra, trigonometry and basic calculus tend to appear both directly and inside other problems. Build those to reliability first, keep them on a revision ladder, and widen from there.' },
      { q: 'How should I prepare General Knowledge across so many areas?', a: 'Pick bounded sources and make review retrieval-based. GK is a memory problem: a smaller set you genuinely recall outperforms a larger set you have read once. Keep current affairs on a weekly consolidation and revisit the consolidations, not the daily feed.' },
      { q: 'Does VicharakAI help with the SSB interview stage?', a: 'No — it is built for the written preparation: planning, revision scheduling and weak-topic detection. SSB preparation is a different skill set and needs different resources.' },
    ],
    cta: 'Start Your Defence Exam Study Plan Free',
  },
  '/teaching': {
    title: 'CTET & TET Preparation AI | Personalized Study Planner — VicharakAI',
    metaDescription: 'VicharakAI plans CTET and state TET preparation with spaced revision across Child Development, Pedagogy, Language, Maths and EVS, plus AI weak-topic detection. 7-day free trial.',
    h1: 'Your AI Study Strategist for Teaching Exams',
    examFullName: 'Teaching Eligibility Exams (CTET, State TET, DSSSB)',
    examLabel: 'CTET and state TET',
    subjects: ['Child Development & Pedagogy', 'Language I', 'Language II', 'Mathematics', 'Environmental Studies'],
    keyTopics: ['Child Psychology', 'Learning Theories', 'Pedagogy of Mathematics', 'Language Pedagogy', 'EVS Concepts'],
    painPoints: [
      { pain: "Pedagogy questions need conceptual depth that rote reading can't build", solution: 'Spaced revision of pedagogy concepts makes them genuinely available in the exam.' },
      { pain: 'Paper 1 and Paper 2 overlap and candidates duplicate effort', solution: "The AI maps what's shared across papers and avoids redundant revision." },
      { pain: 'Most candidates re-appear, and staying consistent across months is hard', solution: "Vicharee's daily check-in and mood-aware plan keep the habit alive." },
    ],
    faqs: [
      { q: 'Child Development and Pedagogy carries a lot of weight. How should I study it?', a: 'As applied reasoning, not as a list of theorists. Most questions describe a classroom situation and ask what a teacher should do, so the useful unit of revision is the principle plus a worked example. Recall the principle from memory, then explain how it would change what you do in a real lesson — that is what the paper is testing.' },
      { q: 'I am preparing for both Paper 1 and Paper 2. How do I avoid duplicate work?', a: 'The pedagogy and language sections overlap heavily; the subject content is where they diverge. Build and revise the shared portion once on a single ladder, and keep separate, shorter cycles for the paper-specific subject matter.' },
      { q: 'How do I stay consistent when I am already teaching or working?', a: 'Make the daily minimum genuinely small and let the schedule absorb the variation. A plan that assumes three uninterrupted hours fails on the first busy week. A plan that asks for twenty minutes of retrieval on the topics closest to being forgotten survives, and survives for months.' },
      { q: 'Does VicharakAI provide CTET study material?', a: 'No. It plans your revision, tracks what you have covered and shows where your practice tests say the gaps are. Your books, previous-year papers and notes remain the content source.' },
    ],
    cta: 'Start Your Teaching Exam Study Plan Free',
  },
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

  useEffect(() => {
    if (!data) {
      // An unrecognised path under this app renders a not-found view. It
      // points its canonical at the homepage and asks not to be indexed, so a
      // stale link can never become a thin page of its own.
      applyPageSeo({
        title: 'Page not found | VicharakAI',
        description: 'That exam page link is out of date. Browse VicharakAI preparation planners for JEE, NEET, UPSC, CAT, CLAT, SSC, RRB, banking, defence and teaching exams.',
        canonicalPath: '/',
        robots: 'noindex, follow',
      });
      return;
    }
    applyPageSeo({
      title: data.title,
      description: data.metaDescription,
      canonicalPath: path,
      jsonLd: [
        softwareApplicationSchema(data.examLabel, path),
        breadcrumbSchema([{ name: 'Home', path: '/' }, { name: data.examLabel, path }]),
        faqSchema(data.faqs),
      ],
    });
  }, [data, path]);

  if (!data) return <main className="exam-seo missing"><style>{CSS}</style><h1>Page not found</h1><a href="/">Return to VicharakAI</a></main>;

  return <div className="exam-seo">
    <style>{CSS}</style>
    <SEONavbar brandName="VicharakAI" />
    <main>
      <section className="hero">
        <p className="eyebrow">{data.examFullName}</p>
        <h1>{data.h1}</h1>
        <p className="lede">A preparation system that connects your daily study, mock-test mistakes, weak topics and spaced revision into one plan built around your exam date.</p>
        <button className="primary" onClick={openApp}>{data.cta}</button>
      </section>
      <section>
        <p className="eyebrow">Built for your syllabus</p>
        <h2>Every major subject, one connected plan</h2>
        <div className="chips">{data.subjects.map((subject) => <span key={subject}>{subject}</span>)}</div>
        <div className="topics">{data.keyTopics.map((topic) => <article key={topic}><i aria-hidden="true" />{topic}</article>)}</div>
      </section>
      <section className="soft">
        <p className="eyebrow">The strategy gap</p>
        <h2>Study problems VicharakAI helps you solve</h2>
        <div className="pain-grid">{data.painPoints.map((item, index) => <article key={item.pain}><b>0{index + 1}</b><h3>{item.pain}</h3><p>{item.solution}</p></article>)}</div>
      </section>
      <section className="value">
        <div><p className="eyebrow">Your preparation, remembered</p><h2>Know what to study today — and what is quietly slipping.</h2></div>
        <ul><li>Daily targets based on your actual progress</li><li>Mock-test mistakes traced to weak concepts</li><li>Revision scheduled on the 1-3-7-14-28 day ladder</li><li>A pace signal tied to your target date</li></ul>
      </section>
      <section className="faqs">
        <p className="eyebrow">Questions students ask</p>
        <h2>Preparing for {data.examLabel}</h2>
        <div className="faq-list">{data.faqs.map((item) => <article key={item.q}><h3>{item.q}</h3><p>{item.a}</p></article>)}</div>
      </section>
      <section className="cta"><h2>Make your {data.examFullName} preparation a system.</h2><p>Start with your exam, study hours and target date. Vicharee builds the next useful step.</p><button onClick={openApp}>{data.cta}</button></section>
    </main>
    <footer><a href="/">← VicharakAI home</a><a href="/exam">Exam guides</a><a href="/prep">Study guides</a><a href="/learn">Learn</a><span>© 2026 VicharakAI</span></footer>
  </div>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.exam-seo{height:100dvh;overflow-y:auto;background:#FAFAF8;color:#141A24;font-family:Inter,system-ui,sans-serif;-webkit-overflow-scrolling:touch}.exam-seo *{box-sizing:border-box}.exam-seo header{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:.8rem max(1rem,calc((100vw - 1120px)/2));border-bottom:1px solid rgba(20,26,36,.11);background:rgba(250,250,248,.94);backdrop-filter:blur(12px)}.brand{color:#141A24;text-decoration:none;font-weight:800;font-size:1.05rem}.brand span,.eyebrow{color:#0057FF}.exam-seo button{border:0;border-radius:999px;background:#0057FF;color:white;font:inherit;font-weight:800;padding:.75rem 1rem;cursor:pointer}.exam-seo main{max-width:1120px;margin:auto;padding:0 1rem}.exam-seo section{padding:4rem 0;border-bottom:1px solid rgba(20,26,36,.1)}.exam-seo h1,.exam-seo h2,.exam-seo h3{margin:0;letter-spacing:-.035em;line-height:1.08}.hero{position:relative;padding:5rem 0!important}.hero:before{content:"";position:absolute;inset:0 -50vw;z-index:-1;background:radial-gradient(circle at 20% 10%,rgba(108,155,255,.28),transparent 35%),linear-gradient(145deg,#FAFAF8 35%,#EDF3FF)}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.hero h1{max-width:820px;font-size:clamp(2.45rem,8vw,5rem);margin-top:.8rem}.lede{max-width:720px;color:#4D596B;line-height:1.7;font-size:1.08rem}.primary{margin-top:1rem;padding:.9rem 1.25rem!important;box-shadow:0 14px 34px rgba(0,87,255,.22)}.exam-seo h2{font-size:clamp(1.85rem,5vw,3rem);max-width:760px;margin-top:.55rem}.chips{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.5rem}.chips span{padding:.58rem .78rem;border-radius:999px;background:#EAF1FF;color:#003AB0;font-weight:700;font-size:.88rem}.topics{display:grid;gap:.7rem;margin-top:1.25rem}.topics article{display:flex;align-items:center;gap:.6rem;background:white;border:1px solid rgba(20,26,36,.1);border-radius:12px;padding:1rem;font-weight:700}.topics i{width:9px;height:9px;border-radius:50%;background:#0057FF;box-shadow:0 0 0 5px rgba(0,87,255,.1)}.soft{position:relative}.pain-grid{display:grid;gap:1rem;margin-top:1.6rem}.pain-grid article{background:white;border:1px solid rgba(20,26,36,.1);border-radius:16px;padding:1.25rem;box-shadow:0 12px 34px rgba(20,26,36,.05)}.pain-grid b{color:#0057FF;font-size:.8rem}.pain-grid h3{font-size:1.12rem;margin-top:.7rem}.pain-grid p,.value li,.cta p,.faq-list p{color:#4D596B;line-height:1.65}.value{display:grid;gap:1.5rem}.value ul{margin:0;padding-left:1.2rem}.value li{margin:.65rem 0}.faq-list{display:grid;gap:1rem;margin-top:1.7rem}.faq-list article{background:white;border:1px solid rgba(20,26,36,.1);border-radius:16px;padding:1.3rem}.faq-list h3{font-size:1.1rem;margin-bottom:.6rem;line-height:1.25}.cta{margin:3rem 0;border:0!important;border-radius:22px;padding:2.4rem 1.25rem!important;text-align:center;background:linear-gradient(135deg,#0057FF,#003AB0);color:white}.cta h2{margin:auto}.cta p{color:#DCE8FF;max-width:650px;margin:1rem auto}.cta button{background:white;color:#003AB0}.exam-seo footer{display:flex;flex-wrap:wrap;justify-content:center;gap:.7rem 1.2rem;padding:2rem 1rem 3rem;color:#5B6574;font-size:.82rem}.exam-seo footer a{color:#003AB0;text-decoration:none}.missing{display:grid;place-items:center;padding:2rem;text-align:center}.missing a{color:#0057FF}@media(min-width:640px){.topics{grid-template-columns:repeat(2,1fr)}.pain-grid{grid-template-columns:repeat(3,1fr)}.value{grid-template-columns:1.15fr .85fr;align-items:start}.faq-list{grid-template-columns:repeat(2,1fr)}}@media(min-width:900px){.topics{grid-template-columns:repeat(3,1fr)}}
`;
