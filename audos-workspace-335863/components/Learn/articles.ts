import * as ADDITIONAL from './additionalArticles';
export * from './additionalArticles';

/**
 * THE LEARN HUB — article content.
 *
 * This is the single source of truth for every article on the public /learn
 * routes. It is plain data: no JSX, no components, no imports. The two
 * rendering surfaces (components/Learn/LearnIndex.tsx and
 * components/Learn/ArticlePage.tsx) read from here and decide how it looks.
 *
 * EDITORIAL RULES for anything added to this file:
 *   · Educational tone. These pages exist to be useful to a student who has
 *     never heard of VicharakAI and may never sign up. No sales pitch, no
 *     urgency, no call to action inside the body.
 *   · Grounded in how the product actually works. Every claim about
 *     scheduling, the Decision Engine or the AI layer describes real
 *     behaviour — if the product changes, the article changes.
 *   · No jargon a student would not meet in their own preparation. FSRS is
 *     named and explained because it is a real, checkable thing; academic
 *     vocabulary that only sounds impressive is not used.
 *
 * Read time is DERIVED (see readMinutes below), never hand-written, so an
 * edit to a body can never leave a stale “6 min read” behind it.
 */

/** One block of article body. The renderer maps each kind to its own type
 *  treatment, which is what gives the reading view a real hierarchy instead
 *  of an undifferentiated wall of text. */
export type ArticleBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  /** A single pulled-out line. Used sparingly — at most one or two per
   *  article, for the sentence the whole section turns on. */
  | { kind: 'pull'; text: string };

export interface Article {
  /** URL segment: /learn/<slug>. Lower-case, hyphenated, never changed once
   *  published — an old link that 404s is worse than an ugly slug. */
  slug: string;
  title: string;
  /** One sentence, shown on the index card under the title. */
  teaser: string;
  /** A two or three word category label for the card and the article header. */
  kicker: string;
  /** Permanent generated hero image URL. Rendered full-bleed behind the title
   *  on the article page and as the 16:9 thumbnail on the index cards. */
  heroImage: string;
  body: ArticleBlock[];
}

/* ===========================================================================
 * 1 · spaced-repetition
 * ======================================================================== */

const SPACED_REPETITION: Article = {
  slug: 'spaced-repetition',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191096025-qyavsn.png',
  title: 'Why Spaced Repetition Actually Works (And Why You’re Probably Not Doing It)',
  teaser:
    'Memory fades on a schedule you can predict — which means the fix is a schedule too.',
  kicker: 'Memory',
  body: [
    {
      kind: 'paragraph',
      text: 'Every student preparing for a competitive exam has had the same experience. You spend a full evening on a chapter, understand it, solve the problems at the end, and close the book genuinely believing you know it. Six weeks later a mock puts one question from that chapter in front of you and your mind is not fuzzy, it is blank. You did nothing wrong. You did what every brain does with information it is never shown again.',
    },
    { kind: 'heading', text: 'Memory leaks on a predictable schedule' },
    {
      kind: 'paragraph',
      text: 'Forgetting is not randomness and it is not a character flaw. When you learn something for the first time, your brain files it somewhere shallow and temporary, and if nothing arrives to signal that the information matters, that file decays — fast at first, then more slowly. By the end of the first week a large part of a chapter you studied once and never returned to is functionally gone, even though you would have sworn you knew it at the time.',
    },
    {
      kind: 'paragraph',
      text: 'The useful fact hiding inside that is that the decay has a shape, and a shape can be anticipated. Every time you successfully pull information back out of memory the decay slows and the file moves a little deeper. Do that a handful of times at the right moments and a fragile short-term trace becomes long-term knowledge that survives months of other chapters piling on top of it. You beat forgetting with timing rather than with volume.',
    },
    { kind: 'heading', text: 'Why you are probably not doing it' },
    {
      kind: 'paragraph',
      text: 'Ask a room of students how they revise and the two most common answers will be re-reading notes and highlighting. Both are popular for the same reason: they feel productive and they are comfortable. Re-reading a chapter you have already studied is smooth. Nothing catches. Your eyes move over familiar sentences and your brain reports back, with real confidence, that you know this. Highlighting adds its own cost: it feels like a decision has been made about what matters, so your attention relaxes on everything you marked.',
    },
    {
      kind: 'paragraph',
      text: 'That confidence is the trap. Recognising material is not the same skill as producing it. With the page in front of you, you are only testing whether the information looks familiar — and it always will, because you read it last week. In the exam nobody gives you the page. Most students discover how wide that gap is in the worst possible place: halfway through a timed paper. Neither technique asks you to retrieve anything, and retrieval is what moves material from short-term into long-term memory.',
    },
    {
      kind: 'paragraph',
      text: 'What does work is deliberately uncomfortable. The best moment to review something is just before you would have lost it — when the answer is hard to reach but still reachable. That few seconds of struggle is the mechanism, not a sign that revision is going badly: an easy review teaches your brain almost nothing, because nothing had to be rebuilt.',
    },
    {
      kind: 'pull',
      text: 'Reviewing a topic five times in one evening gives you five easy retrievals. Reviewing it five times across three weeks gives you five increasingly deep ones — for the same total minutes.',
    },
    { kind: 'heading', text: 'FSRS: a scheduler that learns you' },
    {
      kind: 'paragraph',
      text: 'The obvious way to build spacing into a plan is to fix the intervals — review everything after a day, then a week, then a month. That is far better than nothing, but it treats every topic and every student as identical. Rotational Motion and the definition of a mole are not equally hard for the same person, and your memory is not the memory of whoever sits next to you.',
    },
    {
      kind: 'paragraph',
      text: 'FSRS — the Free Spaced Repetition Scheduler — is an open, modern scheduling algorithm built to fix exactly that. Instead of one fixed ladder for everything, it models each item with three quantities: how likely you are to recall it right now, how stable that memory has become, and how hard that particular item is for you. Every review updates all three. Items you keep getting right have their intervals stretched aggressively; items you keep missing come back quickly and often.',
    },
    {
      kind: 'paragraph',
      text: 'The practical difference is where your revision hours land. A fixed schedule shows you everything the same number of times, so you spend as long on definitions you have known cold since August as on the derivation you have never once finished. FSRS spends four of those reviews on the shaky material and one on the solid. Not more studying — the same studying, aimed better.',
    },
    { kind: 'heading', text: 'The 1 – 3 – 5 – 7 – 14 ladder, and why those numbers' },
    {
      kind: 'paragraph',
      text: 'VicharakAI schedules a newly studied topic to come back on day 1, day 3, day 5, day 7 and day 14. The first gaps are deliberately short, because that is where the steepest loss happens: a topic studied on Monday is already noticeably weaker by Wednesday. Catching it on day 1 and again on day 3 costs a couple of minutes and prevents almost all of that early leak.',
    },
    {
      kind: 'paragraph',
      text: 'The gaps then widen, because every successful review buys a longer runway. By day 14 a topic that has survived four reviews is no longer fragile — the fifth is maintenance rather than rescue. After that the ladder hands over to FSRS. The five dates are a starting point, not a track you are stuck on.',
    },
    { kind: 'heading', text: 'Scheduled review is not cramming' },
    {
      kind: 'paragraph',
      text: 'Cramming is not useless — it will get information into your head for tomorrow morning, and sometimes that is what you need. What it will not do is keep it there. A cram packs its retrievals into a window so short that your brain never gets the chance to forget anything in between, which means it never gets the chance to strengthen anything either. Retention falls away almost immediately, which is why a student who crammed a chapter in October is genuinely shocked to find it gone in January.',
    },
    {
      kind: 'paragraph',
      text: 'Scheduled review is the same number of retrievals, spread out. The effort is comparable; the retention is not. Cramming’s one real advantage is that it needs no planning — you do it the night before, and nothing has to remember anything on your behalf. Spacing needs something tracking what is due and when, which is precisely why so few students keep it up by hand and precisely what a scheduler is for.',
    },
    { kind: 'heading', text: 'What is due versus what feels urgent' },
    {
      kind: 'paragraph',
      text: 'One more failure mode survives even after a student is fully convinced by everything above. Left to your own judgement, you will revise the chapter you are anxious about rather than the one that is actually decaying. Anxiety is a poor signal: the topics that feel urgent are usually either the ones you studied most recently — still fresh, and not in need of you — or the ones you already know you are weak at and revised three days ago.',
    },
    {
      kind: 'paragraph',
      text: 'A scheduler has no feelings about Thermodynamics. It tracks, per topic, when you last recalled it and what that implies about tonight. When VicharakAI says five things are due, that list is arithmetic rather than mood — and your job shrinks to the one part no system can do for you.',
    },
    {
      kind: 'paragraph',
      text: 'None of this asks you to study more hours. It asks that the hours you already study land where they do the most good. It is unglamorous, mostly bookkeeping, and it is the difference between a chapter you covered and a chapter you know.',
    },
  ],
};

/* ===========================================================================
 * 2 · ai-study-system
 * ======================================================================== */

const AI_STUDY_SYSTEM: Article = {
  slug: 'ai-study-system',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191115610-ohdwtt.png',
  title: 'How VicharakAI’s Study System Actually Works',
  teaser:
    'Two layers: a deterministic scheduler that never guesses, and an AI layer that only handles what arithmetic cannot.',
  kicker: 'Architecture',
  body: [
    {
      kind: 'paragraph',
      text: 'Most study apps are vague about what happens under the hood. Something is described as “AI-powered” and you are left to imagine either a genius tutor or an expensive autocomplete. Neither picture helps you decide whether to trust what it tells you to do tonight. So here is the actual architecture, in the order it runs.',
    },
    { kind: 'heading', text: 'Two layers, and the line between them' },
    {
      kind: 'paragraph',
      text: 'VicharakAI is built in two layers that do genuinely different jobs. The lower layer is deterministic: plain algorithms and arithmetic that produce the same answer every time they are asked. The upper layer is AI: language models handling the parts that really do require reading, judgement and pattern recognition.',
    },
    {
      kind: 'paragraph',
      text: 'The line between them is drawn by one rule, which is the closest thing this product has to a philosophy: never use AI for what a deterministic algorithm can do. Scheduling a review for day 3 is arithmetic. Working out whether five wrong answers share a single underlying cause is not. Blurring the two is how study apps end up slow, expensive and — worst of all — unpredictable, telling you something different on Tuesday from what they told you on Monday for no reason you can inspect.',
    },
    { kind: 'heading', text: 'The algorithm layer: everything that needs no AI' },
    {
      kind: 'paragraph',
      text: 'A surprising amount of a study system is simply bookkeeping done properly. All of the following run without a model being involved at any point:',
    },
    {
      kind: 'list',
      items: [
        'FSRS scheduling — each topic carries its own recall estimate, stability and difficulty, updated every time you review it.',
        'The spacing intervals — the 1, 3, 5, 7 and 14 day ladder a newly studied topic starts on before FSRS takes over its spacing.',
        'Due tracking — which topics have crossed their review date, and by how many days.',
        'Streaks — consecutive days on which you actually completed what you set out to do.',
        'Test score storage — every paper you log, its score, and which questions went wrong for which reason.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Everything in this layer is auditable. If VicharakAI says Rotational Motion is due today, there is a last-reviewed date and an interval sitting behind that claim, and it will give you the same answer if you ask again in ten minutes. That matters more than it sounds. A student who cannot trust the list stops opening the app.',
    },
    { kind: 'heading', text: 'The AI layer: what arithmetic cannot do' },
    {
      kind: 'paragraph',
      text: 'The AI layer starts where counting stops. Its main job is to look at a pile of things you got wrong and work out what is actually broken underneath them.',
    },
    {
      kind: 'paragraph',
      text: 'Consider five wrong questions in Current Electricity. A count-based system sees five errors in one chapter and concludes that you should revise Current Electricity — twenty-odd hours of material, most of which you are fine with. The AI layer reads the five questions themselves and notices that four of them required setting up a multi-loop circuit. The gap is not the chapter. The gap is Kirchhoff’s laws.',
    },
    {
      kind: 'pull',
      text: 'The difference between “revise Current Electricity” and “revise Kirchhoff’s laws” is the difference between a wasted weekend and a useful twenty minutes.',
    },
    {
      kind: 'paragraph',
      text: 'Once a weakness has been named that precisely, the AI layer writes the revision material for it: the specific formulas involved, and a small set of recall questions that hit the exact thing you have been getting wrong. Not a chapter summary — you already have a textbook, and a summary is one more thing to re-read. A targeted card you have to answer.',
    },
    { kind: 'heading', text: 'The Decision Engine: when everything is due at once' },
    {
      kind: 'paragraph',
      text: 'The hard problem in any revision system is not scheduling. It is what happens when the schedule produces more work than a human being has time for. Twelve topics come due on the same Tuesday. You have an hour. Something has to give, and the quality of the product is decided entirely by what gives.',
    },
    {
      kind: 'paragraph',
      text: 'The Decision Engine ranks those twelve before it shows you anything. The strongest signal is your own test accuracy on each topic. A topic you are scoring 42% on outranks a topic you are scoring 91% on, every time — even if the 91% topic has been due for longer. Days overdue, FSRS due status and the weakness scores coming out of the AI layer all feed the same ranking.',
    },
    {
      kind: 'paragraph',
      text: 'The ranked list is then fitted into a bounded revision budget: a time cap and an item cap you can actually finish tonight. The topics that make the cut become your list. The rest move quietly forward to another day. You are not shown a tally of what was dropped, because a tally of what was dropped is just guilt with a number attached.',
    },
    { kind: 'heading', text: 'Day 1 to Day 7' },
    {
      kind: 'paragraph',
      text: 'The AI is useful on day one. From your very first session it builds today’s plan, answers “what should I do next?”, and does basic prioritisation across your subjects. Nothing is held back behind an onboarding gate. But on day one it is working from what you told it, which is a reasonable amount of information and not a lot more.',
    },
    {
      kind: 'paragraph',
      text: 'What changes over the first week is the evidence base. By day seven the system has watched you set targets and either hit or miss them, seen which tasks you quietly skip, seen how long you actually take on a chapter versus how long you planned, and seen at least some test data. That is the point at which a milestone fires and the tone of the recommendations changes:',
    },
    {
      kind: 'pull',
      text: '“I’ve observed your study habits for a week. From today, my recommendations are based on your actual learning pattern — not generic advice.”',
    },
    {
      kind: 'paragraph',
      text: 'It is worth being precise about why that message is a milestone rather than a marketing line. Before day seven, advice about your pace is an assumption. After day seven it is a measurement.',
    },
    { kind: 'heading', text: 'What the system learns from' },
    {
      kind: 'paragraph',
      text: 'Everything in the list below is something you generate by studying normally. None of it requires filling in a form about yourself:',
    },
    {
      kind: 'list',
      items: [
        'The daily targets you set — what you thought you could get through.',
        'Task completion — what you actually finished, and what gets carried to tomorrow again and again.',
        'Test performance — scores, and the reason behind each wrong question.',
        'Revision habits — whether due items get cleared, and which ones you avoid.',
        'Study speed — how long a chapter really takes you, as opposed to how long you planned for.',
      ],
    },
    { kind: 'heading', text: 'Why the split is the point' },
    {
      kind: 'paragraph',
      text: 'Keeping the scheduler deterministic is what makes the AI trustworthy. Because the dates, the due list and the scores are produced by code you could in principle check with a calculator, the AI never has to be believed about the boring facts — it is only asked to do the one thing it is genuinely better at than arithmetic, which is reading your mistakes and telling you what they have in common.',
    },
    {
      kind: 'paragraph',
      text: 'A student does not need a system that sounds intelligent. They need one that is right about what is due tonight and honest about why. That is what the two layers are for.',
    },
  ],
};

/* ===========================================================================
 * 3 · gap-detection
 * ======================================================================== */

const GAP_DETECTION: Article = {
  slug: 'gap-detection',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191135910-rz8tp3.png',
  title: 'How to Find Your Blind Spots Before the Mock Does',
  teaser:
    'A mock test is an excellent diagnostic that arrives far too late. Here is how to run the diagnosis weeks earlier.',
  kicker: 'Weak areas',
  body: [
    {
      kind: 'paragraph',
      text: 'There is a particular kind of silence that follows a mock test result. Not the disappointment about the score — that passes. The silence is about the three questions you got wrong from chapters you were sure about. You did not know that gap was there. Nothing in the six weeks before the test told you. The mock told you, and the mock is eleven days before the real exam.',
    },
    {
      kind: 'paragraph',
      text: 'This is the central scheduling problem of exam preparation, and it is not about effort. Mocks are excellent diagnostics. They are simply the slowest possible way to run a diagnosis, because you only get one every couple of weeks and each one reports on damage that has been accumulating since August.',
    },
    { kind: 'heading', text: 'The problem is not that you have gaps' },
    {
      kind: 'paragraph',
      text: 'Everybody has gaps. A syllabus is large, you studied part of it under time pressure, and some of what you covered did not stick. That is normal and it is fixable. What is not fixable in eleven days is a gap you find out about in eleven days.',
    },
    {
      kind: 'paragraph',
      text: 'So the useful question is not “how do I avoid having weaknesses?” It is “how early can a weakness be made visible?” The earlier it surfaces, the smaller and cheaper it is to close — and the less of your revision time it has been quietly wasting in the meantime.',
    },
    { kind: 'heading', text: 'Why re-reading cannot find them' },
    {
      kind: 'paragraph',
      text: 'The default move when you are unsure about a chapter is to read it again. It is the least effective thing you could do for this particular purpose, because re-reading tests recognition and an exam tests recall.',
    },
    {
      kind: 'paragraph',
      text: 'Recognition is the feeling of “yes, that’s familiar” when the answer is already on the page in front of you. It is almost impossible to fail. Recall is producing the same thing from an empty page under time pressure, and it is a completely different ability. You can recognise every line of a derivation and be unable to start it. Which means a revision method built on reading will report back that you are fine, right up until the moment something asks you to write.',
    },
    {
      kind: 'pull',
      text: 'A gap you cannot see is not a small problem. It is a problem that is actively consuming your revision hours by convincing you they are needed elsewhere.',
    },
    { kind: 'heading', text: 'A wrong answer becomes an object' },
    {
      kind: 'paragraph',
      text: 'The starting point is treating each wrong answer as something that persists rather than something that happens. When you log a test in VicharakAI, the questions you got wrong do not simply lower a score and disappear into the history. Each one becomes a Question Card: a real item in your revision system, scheduled to come back at you.',
    },
    {
      kind: 'paragraph',
      text: 'A Question Card shows you three things. The question itself, so you have to attempt it again rather than read about it. A short line explaining why this is in front of you — “You got this type wrong in Test #7” — so the card never feels arbitrary. And three responses: Again, Got it, or Explain. Again sends it back soon. Got it lets the scheduler stretch the interval. Explain hands it to the AI layer for a worked explanation on the spot, because a card you cannot do and cannot get explained is a card you will start skipping.',
    },
    { kind: 'heading', text: 'One weakness, one card' },
    {
      kind: 'paragraph',
      text: 'Here is where most systems built on this idea collapse. If every wrong answer becomes its own card, then a bad paper hands you thirty new cards, three bad papers hand you ninety, and within a month the whole thing is an unopenable backlog. The student abandons it, correctly, because the system has become a list of accusations.',
    },
    {
      kind: 'paragraph',
      text: 'So the cards are merged. The AI layer reads the questions you got wrong and groups the ones that are really the same mistake wearing different clothes. Five wrong questions that all come apart at the same step do not become five cards. They become one card for the underlying weakness, with the five questions as its evidence. Your revision list stays a size a human being can face, and each item on it is worth more than it was before.',
    },
    { kind: 'heading', text: 'From a cluster of mistakes to a named weakness' },
    {
      kind: 'paragraph',
      text: 'The merging is the interesting part, because naming the weakness correctly is what determines whether the fix is twenty minutes or a weekend. Suppose five questions in Current Electricity went wrong. The lazy reading is “weak in Current Electricity”, which sends you back over a chapter you mostly know.',
    },
    {
      kind: 'paragraph',
      text: 'Reading the questions themselves gives a different answer. Four of the five needed a multi-loop circuit set up before any calculation could begin, and all four fell over at that step; the fifth was an arithmetic slip in a part of the chapter you handle fine. The weakness is not the chapter. It is Kirchhoff’s laws — specifically, applying the junction and loop rules to a circuit with more than one loop.',
    },
    {
      kind: 'paragraph',
      text: 'That is a precise, small, closeable gap. It is also the kind of distinction that arithmetic cannot make and a student in the middle of a syllabus rarely makes for themselves, because from the inside all five failures just feel like “I’m bad at circuits”.',
    },
    { kind: 'heading', text: 'The revision card written for that gap' },
    {
      kind: 'paragraph',
      text: 'Once the weakness is named, the AI generates revision material aimed at it and nothing else. For the example above that means the formulas the gap actually turns on and a handful of recall questions that force you to use them:',
    },
    {
      kind: 'list',
      items: [
        'Current Electricity — Kirchhoff’s Laws',
        'V = IR, the junction rule, the loop rule',
        'Three recall questions that require setting up and signing the loop equations, not just quoting the rules',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Notice what is absent. There is no chapter summary, because a summary is more reading and reading is the thing that hid the gap in the first place. There is no full re-teach of Current Electricity, because you do not need one. The card is small enough to fit into a normal evening and specific enough that finishing it changes something.',
    },
    {
      kind: 'paragraph',
      text: 'That card then enters the same spacing system as everything else. It comes back on day 1, day 3, day 5, and so on, with the interval stretching as you start getting it right and collapsing again if you do not. A weakness is not closed because you looked at it once. It is closed when it survives being asked about a week later.',
    },
    { kind: 'heading', text: 'Weeks early instead of hours early' },
    {
      kind: 'paragraph',
      text: 'The result of all of this is a shift in when you find things out. The information that used to arrive in a mock result eleven days before the exam now arrives in a card on a Tuesday in September, when there is time to do something about it and the fix costs twenty minutes instead of a panic.',
    },
    {
      kind: 'paragraph',
      text: 'Mocks still matter — they are the only honest rehearsal of the real thing, and you should keep taking them. But they stop being the moment you discover your weaknesses, and start being the moment you confirm you already closed them. That is a far better use of a Sunday morning, and a much quieter walk home afterwards.',
    },
  ],
};

/* ===========================================================================
 * 4 · revision-budget
 * ======================================================================== */

const REVISION_BUDGET: Article = {
  slug: 'revision-budget',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191153504-arqqdu.png',
  title: 'The Revision Budget: How to Stop Drowning in Overdue Topics',
  teaser:
    'A backlog you cannot finish is not a plan. A short, ranked, completable list is — even when far more is technically due.',
  kicker: 'Prioritisation',
  body: [
    {
      kind: 'paragraph',
      text: 'Three weeks of school exams, one illness and a family wedding. You come back to your revision system on a Sunday evening, open it, and it tells you that forty-one topics are overdue. You close it again. Not because you are lazy — you came back, which is the hard part — but because no human being looks at forty-one overdue items and thinks “right, let’s begin”.',
    },
    {
      kind: 'paragraph',
      text: 'This is the single most common way a revision habit dies, and it has almost nothing to do with motivation. It is a design failure. The system produced a number that was true and unusable at the same time.',
    },
    { kind: 'heading', text: 'How the pile-up forms' },
    {
      kind: 'paragraph',
      text: 'Spacing systems generate work continuously. Every chapter you study adds five scheduled returns to your calendar, and every one of those returns adds more. While you keep up, this is invisible — a few items a day, twenty minutes, done. The maths only becomes hostile when you stop for a while, because nothing stops generating.',
    },
    {
      kind: 'paragraph',
      text: 'Miss a week and the items do not politely wait; they stack, and each day’s new arrivals land on top. Miss three weeks in a busy term — which every student does at some point — and the system is holding a number that would take you nine hours to clear. The backlog is real. The question is what a system should do about it.',
    },
    { kind: 'heading', text: 'What most revision systems do, and why it fails' },
    {
      kind: 'paragraph',
      text: 'The standard behaviour is to defer. The items you missed roll forward to today, today’s items roll forward to tomorrow, and you are shown the full, honest total. Many systems go further and highlight it: a red badge, a counter, a summary of what you failed to do. The reasoning is that a student should know the truth about their own backlog.',
    },
    {
      kind: 'paragraph',
      text: 'The reasoning is wrong, because it confuses information with usefulness. You already know you missed three weeks. Being told the size of the consequence does not help you start; it helps you avoid opening the app. And an avoided app generates more backlog, which produces a larger number, which makes it more avoidable. The counter is not a report on the problem. It is part of the problem.',
    },
    {
      kind: 'pull',
      text: 'A list you cannot finish teaches you that finishing is not on offer. After a few nights of that, you stop trying.',
    },
    { kind: 'heading', text: 'A budget, not a queue' },
    {
      kind: 'paragraph',
      text: 'The alternative is to stop treating your due items as a queue to be drained and start treating your evening as a budget to be spent. A budget has two caps, both of which you set to match your real life rather than your ambitions:',
    },
    {
      kind: 'list',
      items: [
        'A time cap — how long revision gets tonight. Sixty minutes is a common, honest answer.',
        'An item cap — how many separate topics you are willing to move between. Five is usually about right; beyond that the switching itself starts costing you.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Once those two numbers exist, the question changes shape entirely. It is no longer “how do I get through forty-one topics?” — an unanswerable question. It is “which five topics are the best possible use of the next sixty minutes?” That question has an answer, and a system can compute it.',
    },
    { kind: 'heading', text: 'How the Decision Engine fills it' },
    {
      kind: 'paragraph',
      text: 'VicharakAI ranks every due item by how much value revising it tonight would actually buy, then fills the budget from the top of that ranking until one of the two caps is reached. The ordering is often not the order the items became due. A topic that fell due yesterday and that you are scoring badly on will be placed above a topic that has been due for a fortnight and that you consistently get right — so a queue that arrived as A, B, C, D, E may well be worked as A, B, D, C, E.',
    },
    {
      kind: 'paragraph',
      text: 'That reordering is the entire value of the feature. Age alone is a weak signal: an overdue item you know cold is cheap to leave, while a shaky item that came due this morning is expensive to skip. Ranking by value rather than by date is what lets a sixty-minute evening carry most of the benefit of a nine-hour one.',
    },
    { kind: 'heading', text: 'The signals behind the ranking' },
    {
      kind: 'paragraph',
      text: 'Four inputs decide the order, and all four come from things you have already done rather than from anything you have to tell the system:',
    },
    {
      kind: 'list',
      items: [
        'FSRS due status — the scheduler’s own estimate of how likely you are to still have this topic.',
        'Days overdue — real, but deliberately not the dominant term.',
        'Test accuracy — your measured score on that topic. A topic sitting at 42% outranks one sitting at 91%.',
        'Weakness scores — the topic-level gaps the AI layer has identified from the questions you have got wrong.',
      ],
    },
    { kind: 'heading', text: 'What happens to everything else' },
    {
      kind: 'paragraph',
      text: 'The items that do not fit move quietly forward. They are not lost and they are not cancelled — they stay in the schedule and they will be ranked again tomorrow, when tomorrow’s evidence may well place them higher. What does not happen is being told about it. You will never see “you had 5 due and we deferred 2”, because that sentence has no action attached to it. It only transfers anxiety.',
    },
    {
      kind: 'paragraph',
      text: 'This is a deliberate difference in framing rather than a trick. Nothing is hidden from you that you could act on. The system is simply declining to narrate its own bookkeeping at a student who is trying to start work.',
    },
    { kind: 'heading', text: 'Why a finishable list changes what you do' },
    {
      kind: 'paragraph',
      text: 'The practical effect is easy to underrate. A list of five topics has an end, and an end changes the whole character of the evening. You can see the shape of the work before you start, which removes the deciding — usually the most expensive part of sitting down. You get to finish, which is what makes tomorrow evening likely. And finishing is real rather than symbolic, because the five items you cleared were the five highest-value ones available.',
    },
    {
      kind: 'paragraph',
      text: 'Compare that with an infinite scroll of overdue material, where every session ends in the middle, no evening ever counts as complete, and the only honest summary of your effort is “still behind”. The work might even be identical. The second version will be abandoned within a fortnight.',
    },
    {
      kind: 'paragraph',
      text: 'Backlogs are not prevented by discipline. They are prevented by never letting the list exceed what a person can finish — and by spending the bounded time you do have on the items that were going to cost you the most marks.',
    },
  ],
};

/* ===========================================================================
 * 5 · am-i-on-track
 * ======================================================================== */

const AM_I_ON_TRACK: Article = {
  slug: 'am-i-on-track',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191171379-8wdor7.png',
  title: 'The One Question Every Exam Student Needs Answered Every Night',
  teaser:
    '“Am I on track?” is the question behind the anxiety — and most study apps answer a different one.',
  kicker: 'Pace',
  body: [
    {
      kind: 'paragraph',
      text: 'It is eleven at night. You have been at your desk since five. You finished most of what you planned, the day went reasonably well, and you are still lying awake with the same thought you had last night and the night before: is any of this enough? Am I actually going to finish in time?',
    },
    {
      kind: 'paragraph',
      text: 'That question — am I on track? — sits underneath almost all exam anxiety, and for most students it goes unanswered for months. Not because the answer is unknowable, but because nobody is calculating it.',
    },
    { kind: 'heading', text: 'Busy is not the same as on track' },
    {
      kind: 'paragraph',
      text: 'The cruel thing about a long preparation is that effort and progress feel identical from the inside. A twelve-hour day feels like a good day. Six twelve-hour days feel like a good week. None of that tells you whether the rate you are working at will actually get you through the syllabus before the paper.',
    },
    {
      kind: 'paragraph',
      text: 'So students substitute a proxy for the answer, and the proxies are all bad. Hours studied measures input, not output. Comparing yourself to a friend measures their plan, not yours. A mock score measures where you are today but says nothing about where the current rate is taking you. Every one of these can look fine while you are quietly four weeks behind.',
    },
    { kind: 'heading', text: 'The pace signal' },
    {
      kind: 'paragraph',
      text: 'VicharakAI answers the question directly, once a night, in a single line. There are three states it can be in:',
    },
    {
      kind: 'list',
      items: [
        '🟢 On Track — at your current rate you finish the syllabus with room before the exam.',
        '🟠 3 days behind — you are drifting. Small and recoverable, but real, and named now rather than in March.',
        '🔴 At current pace you’ll finish 12 days after your exam — the rate does not work and something has to change.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'The red state deserves a second look, because of how it is phrased. It does not say you have failed or that you are not working hard enough. It states a consequence of a rate: continue exactly like this, and the finish line lands twelve days on the wrong side of the exam. That is a fact about arithmetic, not a judgement about you — and unlike a judgement, it tells you what to do.',
    },
    { kind: 'heading', text: 'How it is calculated' },
    {
      kind: 'paragraph',
      text: 'There is nothing mysterious in the calculation, which is exactly why it can be trusted. Three quantities go in:',
    },
    {
      kind: 'list',
      items: [
        'Syllabus remaining — what is left of your exam’s chapters, based on what you have actually logged.',
        'Days to exam — your real exam date, not an estimate.',
        'Your current completion rate — how much you have genuinely been getting through, measured over your recent days rather than your best one.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Project the rate forward across the days remaining, compare that with what is left, and you have a finish date. The gap between that date and your exam date is the signal. This is one of those places where the product rule about never using AI for what arithmetic can do earns its keep: this number must be the same every time you look at it, and it must be defensible. It is a projection, not a prophecy.',
    },
    { kind: 'heading', text: 'Why most apps give you tasks but not trajectory' },
    {
      kind: 'paragraph',
      text: 'Most study tools stop at the daily list. They will tell you what to do today, tick it off when you are done and show you a streak. All of that is genuinely useful and none of it answers the question you are actually lying awake with, because a list is about today and the anxiety is about the finish.',
    },
    {
      kind: 'paragraph',
      text: 'Trajectory is harder to build, which is most of why it is rare. It needs a real exam date, a real model of the syllabus, and an honest measurement of your rate that does not flatter you. But it is what converts a pile of completed tasks into an answer. Without it a student can tick every box for four months and still have no idea whether the boxes were adding up.',
    },
    {
      kind: 'pull',
      text: 'Students do not want more tasks. They want to know whether the tasks are working.',
    },
    { kind: 'heading', text: 'What a green night is actually for' },
    {
      kind: 'paragraph',
      text: 'The most underrated function of a pace signal is permission to stop. If you are on track and you know you are on track, the evening can end. You can sleep, or see someone, or do nothing, without the low background guilt that makes rest not count as rest.',
    },
    {
      kind: 'paragraph',
      text: 'Students without a trajectory signal never get that. Any hour not spent studying might be the hour that costs them, because there is no way to tell, so the sensible response is to feel vaguely guilty all the time. That is exhausting, it degrades the studying that does happen, and it is completely unnecessary when the answer is calculable.',
    },
    { kind: 'heading', text: 'And what an amber or red night is for' },
    {
      kind: 'paragraph',
      text: 'The other side is more obvious but just as important: being three days behind in November is a small, cheap problem. Being three weeks behind in February is not. The value of the signal is almost entirely in how early it fires, because a drift caught early is fixed by a slightly heavier week and a drift caught late is fixed by abandoning chapters.',
    },
    {
      kind: 'paragraph',
      text: 'Which is why the signal runs nightly rather than monthly. You want to see the small number while it is still small.',
    },
    { kind: 'heading', text: 'The signal changes what gets recommended' },
    {
      kind: 'paragraph',
      text: 'The pace state is not a decoration sitting on top of the rest of the product — it feeds the prioritisation layer underneath it. When you are on track, the plan can afford breadth: due revision gets cleared properly, weaker topics get the extra pass they deserve, and there is room for consolidation.',
    },
    {
      kind: 'paragraph',
      text: 'When you are behind, the same engine tightens. New material moves ahead of comfortable revision, the revision that does survive is the revision covering your genuinely weak, high-value topics, and anything that is merely nice to do stops being suggested. The list you see on a red night is a different list from the one you would have seen on a green night, for the same set of due items.',
    },
    {
      kind: 'paragraph',
      text: 'That is the point of measuring pace at all. Not to grade you every evening, but to give both you and the system a shared, honest answer to the only question that matters at eleven at night — and then to act on it while acting is still cheap.',
    },
  ],
};

/* ===========================================================================
 * 6 · day-one-plan
 * ======================================================================== */

const DAY_ONE_PLAN: Article = {
  slug: 'day-one-plan',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191188668-227acp.png',
  title: 'Your First Study Plan in Under 2 Minutes',
  teaser:
    'Choose your exam, say what you are studying today, get today’s roadmap. Everything else the system needs, it learns by watching.',
  kicker: 'Getting started',
  body: [
    {
      kind: 'paragraph',
      text: 'Think about the last study app you downloaded and did not keep. There is a good chance you never actually used it. You downloaded it, hit a setup flow, answered some questions about your goals, picked a subject from a list, waited for something to generate, and at some point during all of that you put the phone down. The app never got a chance to be good or bad. It just cost you eight minutes and gave you nothing.',
    },
    { kind: 'heading', text: 'Why onboarding gets front-loaded' },
    {
      kind: 'paragraph',
      text: 'There is a reason so many products do this, and it is not stupidity. A personalised system needs information, the obvious way to get information is to ask for it, and asking up front means the very first screen can be tailored. Hence the intake forms, the learning-style quizzes, the ten-step wizards.',
    },
    {
      kind: 'paragraph',
      text: 'The problem is that it charges the student before delivering anything. You are asked to spend effort and disclose a lot about yourself on the basis of a promise, from a product that has not yet demonstrated it is worth either. Worse, the answers are usually poor: nobody knows their own learning style, and a student under pressure will pick whatever gets them to the next screen fastest. The product has bought unreliable data at a high price.',
    },
    { kind: 'heading', text: 'The whole of day one' },
    {
      kind: 'paragraph',
      text: 'VicharakAI asks for almost nothing. Day one is three steps, and it is genuinely under two minutes:',
    },
    {
      kind: 'list',
      items: [
        'Choose your exam.',
        'Enter today’s study plan — what you are actually sitting down to work on.',
        'The AI builds today’s roadmap from it.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'That is the complete setup. There is no questionnaire about your strengths, no confidence slider per chapter, no personality test. The exam tells the system which syllabus you are working against; today’s plan tells it what you are doing right now. Everything else it needs, it will acquire by watching you study, which is a far more reliable source than your own account of yourself on a Tuesday evening.',
    },
    { kind: 'heading', text: '“Where are you in studying right now?”' },
    {
      kind: 'paragraph',
      text: 'There is one optional question, and it is worth understanding why it is the only one. You can say roughly when you covered the chapters you have already finished — approximate dates, no precision required.',
    },
    {
      kind: 'paragraph',
      text: 'It earns its place because it is the one thing the system cannot observe. It can watch everything you do from today onwards, but it has no way of knowing that you finished Thermodynamics five weeks ago and have not touched it since. That single fact changes your day one plan considerably: a chapter covered five weeks ago and never revisited is already fading and should be scheduled back soon, while a chapter you finished on Sunday can safely wait. Two minutes of rough dates calibrate your entire first week.',
    },
    {
      kind: 'paragraph',
      text: 'And if you would rather not, there is a start fresh option — let the AI decide today, and build the picture from here. You lose a little calibration in the first week and nothing after that.',
    },
    { kind: 'heading', text: 'What the AI actually does on day one' },
    {
      kind: 'paragraph',
      text: 'The AI is not in a reduced mode while it gets to know you. From your first session it does real work:',
    },
    {
      kind: 'list',
      items: [
        'Builds today’s plan from your exam, your syllabus position and the time you have.',
        'Answers “what should I do next?” whenever you are unsure — which is most of what a student needs a planner for.',
        'Does basic prioritisation across subjects and chapters, so the plan is ordered rather than arbitrary.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'That is a useful product on its own. If you used VicharakAI for exactly one evening and never returned, the evening would still have been better organised than it otherwise would have been. This is the bar a first session should clear, and most do not.',
    },
    { kind: 'heading', text: 'The systems running quietly underneath' },
    {
      kind: 'paragraph',
      text: 'While you are just studying, three things start up in the background without asking you for anything:',
    },
    {
      kind: 'list',
      items: [
        'Memory — a persistent record of what you have covered and when, so nothing depends on you remembering it.',
        'Personalisation — the accumulating picture of your pace, your habits and your weak areas.',
        'The spaced revision engine — every topic you log is scheduled to return on day 1, day 3, day 5, day 7 and day 14 from the moment you log it.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'None of this is visible on day one, and it is not meant to be. The revision you scheduled tonight without noticing is what will surface in a fortnight, at which point the product starts doing something no amount of onboarding could have produced.',
    },
    { kind: 'heading', text: 'From day two onwards' },
    {
      kind: 'paragraph',
      text: 'The second day is when learning starts, and it learns from behaviour rather than from answers. How long a chapter really takes you against how long you planned. Which tasks you complete and which ones you quietly carry forward for the fourth day running. Whether due revision actually gets cleared. Which subjects you reach for first and which you avoid until late.',
    },
    {
      kind: 'paragraph',
      text: 'Behaviour is honest in a way that a form is not. A student who would have described themselves as “strong at Maths, weak at Chemistry” during setup might turn out, over three weeks of evidence, to be perfectly fine at Chemistry and slowly losing Organic. The system that asked would have been wrong for months. The system that watched is right by the end of the first fortnight.',
    },
    { kind: 'heading', text: 'Day seven' },
    {
      kind: 'paragraph',
      text: 'After a week there is enough evidence for the recommendations to change footing, and the system says so plainly rather than quietly upgrading itself:',
    },
    {
      kind: 'pull',
      text: '“I’ve observed your study habits for a week. From today, my recommendations are based on your actual learning pattern — not generic advice.”',
    },
    {
      kind: 'paragraph',
      text: 'The honesty in that message runs both ways. It is also an admission that the first six days of advice were general — useful, correctly ordered, but not yet built on you. Saying so is what makes the claim afterwards worth believing.',
    },
    { kind: 'heading', text: 'Trust is built by being useful' },
    {
      kind: 'paragraph',
      text: 'The reason any of this matters is that a study system only works if it is still open in March. The apps that ask for a great deal up front are trying to buy commitment before they have earned it, and the commitment does not survive contact with a difficult week.',
    },
    {
      kind: 'paragraph',
      text: 'Two minutes, then something useful, then a system that gets quietly better because you kept studying. No ceremony, no promises about what it will eventually become — just a product that was worth the evening on the first evening, and worth more on the thirtieth.',
    },
  ],
};

/* ===========================================================================
 * 7 · jee-study-plan
 * ======================================================================== */

const JEE_STUDY_PLAN: Article = {
  slug: 'jee-study-plan',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1790098340398-77942y.png',
  title: 'JEE Main Study Plan: Month-by-Month Preparation Strategy',
  teaser:
    'A practical month-by-month roadmap to cover the JEE Main syllabus without running out of time.',
  kicker: 'JEE Main',
  body: [
    {
      kind: 'paragraph',
      text: 'Ask a hundred JEE aspirants in March what they would change about their preparation and most give the same answer: they would start revising earlier. The JEE Main syllabus is large but finite — roughly ninety chapters across Physics, Chemistry and Mathematics — and a year is genuinely enough time to cover it. What runs out is not time to study. It is time to revise, because the default JEE Main study plan spends eleven months covering content and leaves revision to whatever calendar is left over.',
    },
    { kind: 'heading', text: 'Why revision time disappears' },
    {
      kind: 'paragraph',
      text: 'The failure pattern is almost universal. You build a study schedule that maps every chapter onto the calendar, and the map fits — barely. Then reality arrives: a school exam eats a week, Rotational Motion takes twelve days instead of the planned seven, a family function removes a weekend. Every slip pushes the map backwards, and the only flexible block — revision, sitting at the end of the plan — absorbs every delay. By January you have covered most of the syllabus exactly once and retained perhaps half of it, which the first serious mock announces bluntly.',
    },
    {
      kind: 'paragraph',
      text: 'The fix is structural rather than motivational. Revision cannot be a phase that begins when coverage ends; it has to run alongside coverage from the first month, so that a delay costs you some new content rather than your entire retention.',
    },
    { kind: 'heading', text: 'The three-phase framework' },
    {
      kind: 'paragraph',
      text: 'A twelve-month preparation divides naturally into three phases, each with a distinct job:',
    },
    {
      kind: 'list',
      items: [
        'Foundation (months 1–4): build concepts chapter by chapter at NCERT depth, solve the standard problems, and log every completed chapter into a revision cycle the day you finish it.',
        'Consolidation (months 5–8): complete the remaining syllabus while keeping Foundation chapters alive on schedule. Problem difficulty rises, and previous-year questions enter the mix chapter by chapter.',
        'Revision Sprint (months 9–12): no new content except unavoidable gaps. Full-syllabus revision cycles, weekly mock tests, and targeted repair of whatever the mocks expose.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'The proportions matter more than the labels. If new content is still eating your evenings in month ten, the plan has failed even if your tracker says the syllabus is nearly complete — because in the exam hall, an unrevised chapter behaves exactly like an uncovered one.',
    },
    { kind: 'heading', text: 'Subject-wise weekly hours' },
    {
      kind: 'paragraph',
      text: 'For a school-going aspirant, ten to twelve hours per subject per week is a realistic and sufficient target — roughly four focused sessions each for Physics, Chemistry and Mathematics. Tilt the balance towards whichever subject your practice accuracy says is weakest, not the one you dislike most; those are rarely the same subject, and feelings are a poor allocator of hours.',
    },
    {
      kind: 'paragraph',
      text: 'Within Chemistry, split deliberately. Physical Chemistry behaves like Physics and needs problem practice. Organic needs its mechanisms revisited at short intervals or the reaction chains dissolve. Inorganic rewards frequent short recall sessions far more than long re-reads. And across all three subjects, hold one rule: nothing goes untouched for more than three or four days, because a Maths-only week feels productive while it quietly costs you Physics retention that you will later pay full price to rebuild.',
    },
    { kind: 'heading', text: 'Track retention, not coverage' },
    {
      kind: 'paragraph',
      text: 'Most JEE study schedules track a single number: chapters completed. That number only ever rises, which is why it feels good and predicts nothing. The number that actually predicts your score is different — how many chapters could you face in a surprise test tonight, without warning and without the book?',
    },
    {
      kind: 'paragraph',
      text: 'The check is cheap. When you finish a chapter, note the date. Return to it after one day, three days, a week, and a fortnight — each time attempting a few problems from memory instead of re-reading solved examples. A chapter that survives four spaced returns is genuinely yours. A chapter read once in June and never touched again is, by December, a stranger wearing a tick mark.',
    },
    {
      kind: 'pull',
      text: 'Coverage tells you what you have seen. Retention decides what you can score. Build the plan around the second number.',
    },
    { kind: 'heading', text: 'Mock tests: when to start and what to do after' },
    {
      kind: 'paragraph',
      text: 'Begin full-length mocks once roughly seventy percent of the syllabus is genuinely revised — for most students, early in the Revision Sprint. Before that point a mock mostly measures what you have not yet studied, which you already knew. From then on, one mock a week is enough, rising to two in the final six weeks — always at the real exam’s time of day, always under the real exam’s timing.',
    },
    {
      kind: 'paragraph',
      text: 'The three hours of the mock are the cheap part; the value is in the two hours afterwards. Sort every wrong answer into three piles: careless errors, gaps you can close with practice, and concepts that need re-learning. The first pile needs an exam-discipline fix, the second goes into next week’s problem sets, and the third goes straight back into your revision cycle. A mock you never analyse is exam practice; a mock you analyse properly is a personalised map of the next seven days.',
    },
    { kind: 'heading', text: 'What actually separates toppers' },
    {
      kind: 'paragraph',
      text: 'It is tempting to believe the students who crack JEE simply study more hours, and a few do. But watch closely and the consistent difference is duller: they revise on schedule, every week, all year. Their preparation strategy treats a chapter as unfinished until it has been recalled several times across several weeks — so their January is spent sharpening strong material while everyone else is rediscovering forgotten material.',
    },
    {
      kind: 'paragraph',
      text: 'That is the honest answer to how to crack JEE Main. Not a secret resource, not fourteen-hour days — a plan where revision is a first-class citizen from week one, a weekly schedule that keeps all three subjects warm, and a mock habit that converts every mistake into next week’s work. Build that, and the months take care of the marks.',
    },
  ],
};

/* ===========================================================================
 * 8 · neet-study-plan
 * ======================================================================== */

const NEET_STUDY_PLAN: Article = {
  slug: 'neet-study-plan',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1790098356089-ys0gnf.png',
  title: 'NEET Study Plan: How to Cover Physics, Chemistry and Biology in Time',
  teaser:
    'Biology takes the most marks but Physics decides the rank — here’s how to plan your time across all three.',
  kicker: 'NEET',
  body: [
    {
      kind: 'paragraph',
      text: 'NEET offers 720 marks and does not distribute them evenly: Biology carries 360, Chemistry 180 and Physics 180. Most preparation problems trace back to ignoring what that split implies — students either spend the whole year on Biology because it pays the most, or the whole year on Physics because it hurts the most. A working NEET study plan does neither. It allocates time by what each subject needs from you, which is not the same as what it pays.',
    },
    { kind: 'heading', text: 'What the 360–180–180 split actually means' },
    {
      kind: 'paragraph',
      text: 'Biology is the volume subject: two full textbooks, an enormous factual load, and questions that reward precise recall of NCERT lines and diagrams. Chemistry is the efficiency subject: substantial marks for comparatively predictable effort, especially in Inorganic and Physical. Physics is the differentiator: fewer aspirants master it, so it separates ranks at the top even though it carries the same 180 marks as Chemistry. The practical conclusion is simple. Biology needs daily contact, Chemistry needs steady contact, and Physics needs honest problem-solving contact — not avoidance dressed up as prioritisation.',
    },
    { kind: 'heading', text: 'A weekly template for three subjects' },
    {
      kind: 'paragraph',
      text: 'A schedule you can actually sustain through a full year of NEET preparation looks something like this:',
    },
    {
      kind: 'list',
      items: [
        'Biology: one session every single day, even a short one. The volume is only manageable through daily contact — weekend marathons cannot carry two full textbooks.',
        'Physics: four problem-solving sessions a week, placed at the hours you are freshest, because Physics on a tired brain produces practice without progress.',
        'Chemistry: four sessions split across Physical (calculation practice), Organic (mechanism revision at short intervals) and Inorganic (frequent short recall bursts).',
        'One weekly slot reserved for revision only — material from previous weeks, with no new content allowed inside it.',
      ],
    },
    { kind: 'heading', text: 'NCERT first — and when to go beyond it' },
    {
      kind: 'paragraph',
      text: 'For Biology and Inorganic Chemistry, NCERT is not the starting point; it effectively is the syllabus. A large share of Biology questions trace to specific NCERT lines, tables and diagrams, so your first two readings should happen with a pencil in hand, marking what refuses to stick. Go beyond NCERT only where the exam itself does: Physics numericals need a proper problem book, Organic Chemistry needs mechanism practice sets, and Physical Chemistry needs worked calculations. Adding a third Biology reference before you can reproduce NCERT’s diagrams from memory is collecting, not preparing.',
    },
    { kind: 'heading', text: 'Completion is not retention' },
    {
      kind: 'paragraph',
      text: 'NEET’s sheer volume produces a specific trap: chapter completion becomes the goal. You finish Human Physiology, tick it, and move on — and eight weeks later a mock reveals that finished and retained were two different claims. Treat every completed chapter as entering a revision cycle rather than leaving your plan. Return to it after a day, three days, a week and a fortnight, each time recalling actively — closed book, from memory — rather than re-reading. One read-through is never enough, and three read-throughs on consecutive days are barely better. Three returns spread across three weeks is what makes material permanent.',
    },
    {
      kind: 'pull',
      text: 'A finished chapter is a claim. A recalled chapter is a fact. NEET only pays for the second.',
    },
    { kind: 'heading', text: 'Biology: where the paper repeats itself' },
    {
      kind: 'paragraph',
      text: 'Year after year, certain areas carry disproportionate weight: Genetics and Evolution, Human Physiology, Reproduction, Ecology, Cell Structure and Function, and Biotechnology. That is not a licence to skip the rest — NEET can and does ask from anywhere in the two books — but it tells you where revision returns are highest. When your weekly revision slot is oversubscribed, these areas win the tiebreak. Give their diagrams special treatment: reproducing a labelled diagram from memory is one of the highest-yield exercises in all of NEET Biology.',
    },
    { kind: 'heading', text: 'Physics: the rank-decider' },
    {
      kind: 'paragraph',
      text: 'Physics frightens Biology-first students, and the fear creates the gap that decides ranks. The good news is that NEET Physics rewards depth in the pillars more than breadth across everything: Mechanics, Electrodynamics, Modern Physics and Thermodynamics supply the bulk of the paper. Build genuine problem fluency there first. Work in the same pattern every session — attempt from memory, check, and log what went wrong — because in Physics the gap between watching a solution and producing one is the entire game. Accuracy under time comes from repetition of standard problem types, not from harder and harder puzzles.',
    },
    { kind: 'heading', text: 'Mocks: NEET-pattern or nothing' },
    {
      kind: 'paragraph',
      text: 'Random MCQ apps feel like practice but train the wrong skill. NEET is a specific format — one paper, 180 questions to attempt, three hours and twenty minutes, negative marking, all three subjects interleaved in a single sitting — and your practice has to rehearse exactly that. Start full NEET-pattern mocks once your first pass of the syllabus is largely done, take one a week, and analyse each one the same day: which subject drained your time, which questions you got wrong from chapters you believed were safe, and which errors were carelessness rather than ignorance. Each answer changes the following week’s plan.',
    },
    {
      kind: 'paragraph',
      text: 'How to prepare for NEET, compressed to one sentence: daily Biology, fearless Physics, systematic Chemistry, a revision cycle that every finished chapter enters automatically, and NEET-pattern mocks whose mistakes are fed back into the plan. None of it is glamorous. All of it compounds.',
    },
  ],
};

/* ===========================================================================
 * 10 · neet-pg-strategy
 * ======================================================================== */

const NEET_PG_STRATEGY: Article = {
  slug: 'neet-pg-strategy',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1790098387572-gs0pez.png',
  title: 'NEET PG Preparation Strategy: Managing 19 Subjects Without Burning Out',
  teaser:
    'NEET PG’s 19-subject syllabus is unlike anything you’ve studied before — here’s how to approach it systematically.',
  kicker: 'NEET PG',
  body: [
    {
      kind: 'paragraph',
      text: 'Nothing in MBBS quite prepares you for NEET PG preparation — which is strange, because the content is the same. The difference is shape. In MBBS you faced one or two subjects at a time, tested in depth, months apart. NEET PG puts all nineteen subjects into a single paper on a single morning, tested wide and shallow, with a clock running. Preparing for that with the study habits of professional exams is the root of most burnout in this exam.',
    },
    { kind: 'heading', text: 'Why NEET PG is harder than your MBBS exams' },
    {
      kind: 'paragraph',
      text: 'Two shifts matter. First, breadth beats depth: the paper cannot ask you to write long answers on anything, but it can ask one sharp MCQ from anywhere in nineteen subjects, so shallow-but-everywhere retention outperforms deep-but-patchy knowledge. Second, the questions have moved from recall towards applied reasoning — a clinical vignette, a lab value, an image, then a one-best-answer decision. You are no longer reproducing a page; you are recognising a pattern under time pressure. Your NEET PG study strategy has to train exactly those two skills: wide retention and fast applied recognition.',
    },
    { kind: 'heading', text: 'The high-yield split' },
    {
      kind: 'paragraph',
      text: 'Nineteen subjects do not deserve nineteen equal shares. A practical tiering: the clinical majors — Medicine, Surgery, Obstetrics and Gynaecology — repay every hour, both directly and through the short subjects they overlap. The mid-tier — Pathology, Pharmacology, Microbiology, PSM — carries heavy question load per page of reading. The short subjects — Anatomy, Physiology, Biochemistry, Forensic, ENT, Ophthalmology and the rest — are managed on maintenance doses: concise notes, frequent quick revisits, no fresh deep dives. This is not about skipping subjects. It is about matching hours to marks.',
    },
    { kind: 'heading', text: 'Anchor subjects: build everything around the big three' },
    {
      kind: 'paragraph',
      text: 'Medicine, Surgery and OBGYN are the anchors — not only because their direct question count is highest, but because they quietly re-teach everything else. A Medicine cardiology block revises Physiology and Pharmacology; a Surgery block revises Anatomy and Pathology; OBGYN revises both basic sciences and PSM through its public-health overlap. Schedule the anchors as recurring spines of your week, and slot the short subjects into the gaps between them. Students who invert this — polishing short subjects first because they feel finishable — arrive at the majors tired and behind.',
    },
    { kind: 'heading', text: 'The revision trap' },
    {
      kind: 'paragraph',
      text: 'The most expensive mistake in NEET PG prep happens late: reading new content in the final months because it feels productive. Every new video or fresh set of NEET PG study material gives the sensation of progress, while your existing notes — the ones the exam will actually draw on — decay behind you. The arithmetic is unforgiving: a topic you have revised four times is worth more marks than three topics you have read once. From your mid-preparation onward, the default answer to “should I start this new resource?” is no.',
    },
    {
      kind: 'pull',
      text: 'In the last months, revision of what you know outscores acquisition of what you don’t — every single time.',
    },
    { kind: 'heading', text: 'Grand tests: percentile, not score' },
    {
      kind: 'paragraph',
      text: 'Start full-length grand tests around the final four to five months, weekly or fortnightly, and read them correctly. The raw score matters less than the percentile, because NEET PG is a ranking exam — and percentile trend matters more than any single result. A stagnant percentile with rising effort usually means your revision cycle is broken, not your intelligence. After each test, spend as long analysing as you spent attempting: sort errors into knowledge gaps, reasoning slips and time-pressure mistakes, and let each pile change the coming fortnight differently.',
    },
    { kind: 'heading', text: 'Image-based questions: build a visual bank' },
    {
      kind: 'paragraph',
      text: 'A meaningful slice of the modern paper is images — X-rays, CT slices, pathology slides, dermatology photographs, instruments, ECGs. Visual memory obeys the same rules as any memory: it is built by repeated retrieval, not by passive scrolling. Keep a personal image bank of every picture you meet in question banks and grand tests, and review it in short sessions two or three times a week — look, name the finding and the diagnosis, then check. Twenty minutes of active image recall beats an hour of watching image compilations.',
    },
    { kind: 'heading', text: 'The last 30 days' },
    {
      kind: 'paragraph',
      text: 'The final month has one job: raise the availability of what you already know. That means:',
    },
    {
      kind: 'list',
      items: [
        'Revise your own notes and marked question banks on a fixed rotation — every subject touched at least twice in the month.',
        'Keep taking grand tests, but stop chasing their solutions into new rabbit holes.',
        'Drop entirely: new resources, new videos, unread reference books, and any topic you have never studied — a first read now cannot mature into marks in thirty days.',
        'Protect sleep and a daily reset walk. Recall speed on exam morning is a physiological fact, not a moral one.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'A word on burnout, because in this exam it rarely comes from the hours — it comes from formlessness: months of studying with no visible line between done and not done. Give each week defined edges — a fixed number of revision blocks, one test, one full rest evening — and effort recovers between weeks instead of eroding across them. A duty schedule can flex around a structured week; it destroys an unstructured one.',
    },
    {
      kind: 'paragraph',
      text: 'Nineteen subjects feel unmanageable only when treated as nineteen separate projects. Tier them, anchor the week on the majors, revise on a schedule instead of on guilt, and let tests — not anxiety — tell you where the next hour goes. That is the whole system, and it is enough.',
    },
  ],
};

/* ===========================================================================
 * 15 · mock-test-strategy
 * ======================================================================== */

const MOCK_TEST_STRATEGY: Article = {
  slug: 'mock-test-strategy',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1790098502839-vestxn.png',
  title: 'How to Actually Learn from Mock Tests (Most Students Don’t)',
  teaser:
    'Taking mocks without a review process is like practising shots without watching where they land.',
  kicker: 'Mock tests',
  body: [
    {
      kind: 'paragraph',
      text: 'Here is the standard mock test ritual. Three hours of intense effort, a nervous wait for the score, a moment of relief or disappointment, a glance at two or three questions that felt unfair — and then straight back to the syllabus. The mock is filed away as “taken”. Almost everything it had to teach is thrown away with it, because the score was never the lesson. The score is a summary; the lesson is in the wreckage underneath it, and most students never look.',
    },
    { kind: 'heading', text: 'The review gap' },
    {
      kind: 'paragraph',
      text: 'A mock test is the most information-dense object in your entire preparation. It tells you which topics fail under time pressure rather than in comfortable practice, which question formats trip you, where in the paper your concentration sags, and how your strategy performs against a clock. Checking only the score is like a cricketer practising shots without ever watching where the ball goes — lots of activity, zero calibration. The students who improve mock after mock are not taking better mocks. They are extracting more from each one.',
    },
    { kind: 'heading', text: 'The three-zone analysis' },
    {
      kind: 'paragraph',
      text: 'After every mock, sort each lost mark into one of three zones — because each zone has a different fix:',
    },
    {
      kind: 'list',
      items: [
        'Zone 1 — Should have got it: careless errors on questions you fully knew. Misread, miscalculated, mis-marked. The fix is procedural — slower reading of the question stem, a checking ritual — not more study.',
        'Zone 2 — Could have got it: fixable gaps. You knew the concept but the application wobbled, or it took too long. The fix is targeted practice on that question type.',
        'Zone 3 — Needed the concept: genuine knowledge gaps. The fix is re-learning the topic, then verifying with fresh questions — not tomorrow’s vague intention to “revise it sometime”.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'The zones matter because the default response to any bad mock is “study more”, and for two of the three zones that response is wrong. Zone 1 losses do not shrink with extra study — they shrink with exam discipline. Zone 2 losses need practice, not reading. Only Zone 3 is actually a study problem. Students who skip the sorting apply the Zone 3 remedy to everything, which is why their scores move so slowly relative to their effort.',
    },
    { kind: 'heading', text: 'Build an error log' },
    {
      kind: 'paragraph',
      text: 'Keep a single running log across all your mocks — one line per lost mark: the topic, the zone, and the specific cause in your own words. The log turns isolated frustrations into visible patterns. Three mocks in, you will see things no single review shows: the same chapter leaking marks every time, Zone 1 errors clustering in the final thirty minutes as focus fades, one question format that reliably beats you. Each of those patterns is a precise, fixable target — and none of them is visible from scores alone.',
    },
    {
      kind: 'pull',
      text: 'One mock reviewed deeply is worth three mocks skimmed. The scarce resource is not test papers — it is the attention you spend on each one.',
    },
    { kind: 'heading', text: 'The 48-hour review rule' },
    {
      kind: 'paragraph',
      text: 'Review within 48 hours of taking the mock, while you still remember why you chose each answer. A week later you can only see that a question went wrong; two days later you can still feel the reasoning that took you there, and the reasoning is what needs repair. Budget as much time for the review as the mock itself took — a three-hour paper earns a three-hour autopsy. Re-solve every wrong question without the clock before reading the solution: if you get it right untimed, that is Zone 2 evidence, and the solution alone would never have told you.',
    },
    { kind: 'heading', text: 'Let mocks steer the plan, not the mood' },
    {
      kind: 'paragraph',
      text: 'A mock score is a measurement, and measurements are for steering. The Zone 3 topics from your log should appear in next week’s revision plan — by name, in specific slots — and the Zone 2 question types in next week’s practice sets. That closed loop is the entire point of mock-taking. What a score is not for is self-assessment of worth: a bad mock in October is a gift, because it found your gaps while they were still cheap to fix. Anxiety reads a mock as a verdict. Strategy reads it as a map.',
    },
    { kind: 'heading', text: 'Frequency: how many mocks is enough' },
    {
      kind: 'paragraph',
      text: 'The right cadence follows from the review burden, not from ambition. Early in preparation, one full mock a week is plenty — each one generates hours of review and a week of follow-up work, and taking another before that work is done just re-measures the same gaps. In the final six to eight weeks, move to two a week as your reviews get faster. The ceiling is always the same rule: never take a new mock while the previous one’s Zone 3 list is untouched. A mock that changed nothing about your week was a rehearsal, not a lesson.',
    },
    { kind: 'heading', text: 'The calibration problem' },
    {
      kind: 'paragraph',
      text: 'One warning about comparing scores: mock difficulty varies wildly between platforms, and one series’ 70% is another’s 50%. Cross-platform comparisons — and comparisons with friends using different series — are mostly noise. Track your trend within one consistent test series, lean on percentiles where the platform provides them, and treat previous-year official papers as your only true difficulty benchmark. The number that matters is not where you stand on any one paper; it is the direction you are moving across ten — and whether your error log is getting shorter.',
    },
  ],
};

/* ===========================================================================
 * 16 · study-timetable
 * ======================================================================== */

const STUDY_TIMETABLE: Article = {
  slug: 'study-timetable',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1790098532051-q78aa9.png',
  title: 'How to Make a Study Timetable You Will Actually Follow',
  teaser:
    'Most timetables fail by day three — here is how to build one that adjusts instead of breaking.',
  kicker: 'Planning',
  body: [
    {
      kind: 'paragraph',
      text: 'Every serious student has made a beautiful timetable. Colour-coded, hour-by-hour, every subject in its place — abandoned by Thursday. The usual conclusion is a discipline problem, and the usual response is to make an even stricter timetable, which fails even faster. The real problem is engineering: most study timetables are built to describe a perfect week, and perfect weeks do not occur. A schedule that only works when nothing goes wrong is not a plan — it is a wish.',
    },
    { kind: 'heading', text: 'Why timetables break' },
    {
      kind: 'paragraph',
      text: 'Three design flaws kill most schedules. Rigidity: every hour assigned, so one overrun cascades through the day and the day’s failure reads as total. No buffer: zero slack for the class that ran late, the topic that took double, the afternoon you were simply tired. And energy-blindness: the plan assumes you are the same student at 6 a.m. and 11 p.m., scheduling your hardest subject wherever a gap existed rather than where your brain could meet it. Any one of these breaks a week; most timetables ship with all three.',
    },
    { kind: 'heading', text: 'Fix the structure, flex the content' },
    {
      kind: 'paragraph',
      text: 'The durable design fixes the skeleton and lets the flesh move. Fix your subject blocks — Physics every morning, Chemistry after lunch, Maths in the evening — and keep them stable for weeks, because a stable rhythm removes the daily negotiation about what to study, which is where most willpower actually leaks. Inside each block, stay flexible about the topic: if today’s planned chapter finished early, pull the next one forward; if yesterday’s overran, finish it now. The block absorbs the variance. A missed topic inside a surviving structure is a detail; a shattered structure is how whole weeks disappear.',
    },
    { kind: 'heading', text: 'Run an energy audit first' },
    {
      kind: 'paragraph',
      text: 'Before assigning subjects to blocks, spend three days noticing when you are actually sharp. Most people have one or two genuinely strong windows — often morning and early night, with a reliable trough after lunch — and the windows are personal. Then match difficulty to energy: your hardest, most problem-heavy subject goes into your best window; revision, note-organising and lighter reading go into the trough. This single change outperforms any amount of added hours, because an hour of Physics at your peak is worth two at your worst — and the timetable that ignores this is fighting your biology all year.',
    },
    { kind: 'heading', text: 'Buffers are load-bearing' },
    {
      kind: 'paragraph',
      text: 'Leave 20–30% of your day unassigned, on purpose. Buffer time is not laziness — it is the shock absorber that keeps one overrun from cascading into collapse, and on lucky days it becomes bonus capacity: a 30-minute gap comfortably holds a revision burst, a set of ten practice questions, or a flashcard pass. Keep a standing list of such small, pre-decided tasks so gaps never open a negotiation with yourself. A schedule with buffers survives a bad Tuesday. A schedule without them needs a perfect week, and you will not be given one.',
    },
    { kind: 'heading', text: 'Plan weekly, count outcomes' },
    {
      kind: 'paragraph',
      text: 'Set targets by the week, not by the day, and define them as outcomes — chapters finished, problem sets completed, topics revised — rather than hours sat. Daily hour-counting fails in both directions: a slow day reads as moral failure even when the material was just hard, and a long empty day reads as success. A weekly outcome target absorbs bad days without drama, because Tuesday’s shortfall is simply Thursday’s work. Hours measure attendance. Outcomes measure progress. Build the timetable around the second.',
    },
    {
      kind: 'paragraph',
      text: 'A practical rhythm: plan the week on Sunday in thirty minutes — choose the outcomes, place them into blocks, leave the buffers empty. Each night takes two minutes: tick what happened, slide what did not into tomorrow or the weekend buffer. That tiny nightly adjustment is the mechanism rigid timetables lack, and it is the entire difference between a plan that bends and a plan that breaks.',
    },
    { kind: 'heading', text: 'Schedule revision like it’s a subject' },
    {
      kind: 'paragraph',
      text: 'The most common hole in student timetables: every block advances new content, and revision is left for “later” — which means never, until panic. But material you studied last week is decaying right now, and a plan that only adds new material is filling a leaking tank. Give revision its own fixed, non-negotiable slots — a daily 30 minutes for recent material and one weekly deep slot for older chapters — and treat them with the same seriousness as new-content blocks. The timetable that finishes the syllabus but retains half of it did not actually finish the syllabus.',
    },
    {
      kind: 'pull',
      text: 'A timetable is not a promise to be perfect. It is a machine for making an ordinary, interrupted, tired week still add up to progress.',
    },
    { kind: 'heading', text: 'Falling behind, and the one-week trial' },
    {
      kind: 'paragraph',
      text: 'When you fall behind — you will — do not scrap the plan and rebuild from zero; that resets the habit you have been compounding. Instead, triage: move the highest-value missed work into this week’s buffers, drop or delay the least important items explicitly, and carry on. The plan bends; it does not shatter. Finally, treat every new timetable as a draft: run it for one week, note where it tore — which block always overran, which slot you always skipped — and adjust once. A schedule that survives its trial week with one revision will usually carry you for months. That is how to make a study plan you follow: not stricter, but better fitted to the person actually following it.',
    },
  ],
};

/* ===========================================================================
 * 17 · beat-forgetting
 * ======================================================================== */

const BEAT_FORGETTING: Article = {
  slug: 'beat-forgetting',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191096025-qyavsn.png',
  title: 'Why You Forget What You Study — And the Fix That Actually Works',
  teaser:
    'Forgetting isn’t a memory problem. It’s a revision timing problem — and it’s completely fixable.',
  kicker: 'Memory',
  body: [
    {
      kind: 'paragraph',
      text: 'You studied the chapter three weeks ago. You understood it — genuinely, not superficially. Today a practice question from it might as well be written in another language. Every student treats this as evidence of a bad memory, and it is nothing of the sort. Your memory is doing exactly what all human memory does with information that never gets used. Forgetting is not a defect in you. It is a schedule — and anything that runs on a schedule can be intercepted.',
    },
    { kind: 'heading', text: 'What happens after you close the book' },
    {
      kind: 'paragraph',
      text: 'Here is the honest, jargon-free version. When you learn something new, it is stored in a fragile state, and the loss begins immediately — steep in the first day, still fast across the first week, then slower. Within days, most of a once-studied chapter is unavailable: not erased, but unreachable when a question demands it, which in an exam amounts to the same thing. The steepness of that early loss is why material feels solid on Monday evening and hollow by Friday — nothing went wrong in between. The default outcome of studying something once is losing most of it.',
    },
    { kind: 'heading', text: 'Why re-reading feels like it works' },
    {
      kind: 'paragraph',
      text: 'The instinctive response to forgetting is to read the chapter again — and re-reading is quietly the least effective common technique, because of an illusion. The second time through, everything is familiar: sentences flow, nothing snags, and your brain reads that smoothness as knowledge. It is not. It is fluency — recognition of material that is physically in front of you — and it evaporates the moment the page is gone. The exam never shows you the page. This is why students who “went through everything twice” still blank in the hall: they tested recognition all year, and the paper tested recall.',
    },
    { kind: 'heading', text: 'The spacing effect' },
    {
      kind: 'paragraph',
      text: 'Now the fix, and it costs nothing but arrangement. Three hours spent on a topic in one sitting and three hours spread across three separated sittings contain the same work — but the spread version produces dramatically stronger long-term retention. The reason is what happens in the gaps: when you return to material after partially forgetting it, your brain has to actively rebuild the memory, and the rebuilding is what strengthens it. Massed study never allows any forgetting, so there is nothing to rebuild — the repetitions land on a memory that is still fresh and add almost nothing. The gap is not the enemy of learning. The gap is the ingredient.',
    },
    {
      kind: 'pull',
      text: 'Same hours, different arrangement, completely different exam. Spacing is the cheapest upgrade in all of studying.',
    },
    { kind: 'heading', text: 'Recall, don’t review' },
    {
      kind: 'paragraph',
      text: 'The second half of the fix is what you do when you return to the material. Passive review — re-reading, highlighting, watching the lecture again — pours information at your eyes. Active recall reverses the direction: close the book and force the answer out. Write what you remember of the topic. Attempt problems from memory. Explain the mechanism aloud without notes. Retrieval is harder, and the difficulty is the point — each successful retrieval strengthens the memory far more than another exposure, and each failed one shows you precisely where the gap is while it is still cheap to fix. Struggle during revision is not a warning sign. It is the work, working.',
    },
    { kind: 'heading', text: 'The five checkpoints' },
    {
      kind: 'paragraph',
      text: 'You do not need to revisit a topic constantly — only at the moments where the memory is about to slip. A simple ladder of checkpoints, counted from the day you first study a topic, catches the curve where it matters:',
    },
    {
      kind: 'list',
      items: [
        'Day 1 — a short recall the next day, catching the steepest early loss for a few minutes’ cost.',
        'Day 3 — a second retrieval while the memory is reachable but no longer easy.',
        'Day 7 — a week out: attempt problems, not just facts.',
        'Day 14 — a fortnight out: the topic should now feel effortful but solid.',
        'Day 30 — a monthly confirmation. A topic that survives this is exam-ready and needs only occasional maintenance.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Each successful checkpoint buys a longer safe gap; each failed one tells you to shorten the ladder for that topic and rebuild now, weeks before a mock would have exposed it.',
    },
    { kind: 'heading', text: 'A revision log that tells you what to study today' },
    {
      kind: 'paragraph',
      text: 'The system only needs one piece of bookkeeping: a log with a line per topic — name, date first studied, and the five checkpoint dates. Each morning, whatever has a checkpoint due is today’s revision list, before any new content. Fifteen minutes of maintaining this log replaces the nightly “what should I revise?” negotiation with a list that arithmetic produced — and arithmetic, unlike mood, never picks the comfortable chapter over the decaying one. Not every topic deserves equal treatment either: high-weightage, exam-critical material earns extra checkpoints; low-stakes material can ride a sparser ladder. Spacing is a budget, and you spend it where the marks are.',
    },
    {
      kind: 'paragraph',
      text: 'That is the whole answer to how to remember what you study. Not a better brain — a better calendar: return to material at the right moments, and make every return a retrieval instead of a re-read. Students who do this walk into exams carrying months of material that feels fresh. It never was a memory problem.',
    },
  ],
};

/* ===========================================================================
 * 18 · weak-topics-guide
 * ======================================================================== */

const WEAK_TOPICS_GUIDE: Article = {
  slug: 'weak-topics-guide',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/image-1789191135910-rz8tp3.png',
  title: 'How to Find Your Weak Topics and Fix Them Before the Exam',
  teaser:
    'Every student has blind spots. The ones who do well are the ones who find them early enough to act.',
  kicker: 'Weak areas',
  body: [
    {
      kind: 'paragraph',
      text: 'No student walks into a competitive exam without weak topics. The syllabus is too large and a year too full for uniform mastery — everyone carries blind spots. What separates outcomes is not who has gaps, but when they find out. Most students discover their weak areas in a mock test weeks before the exam, or worse, in the exam itself. By then the discovery is expensive. Found in month three, the same gap costs an evening.',
    },
    { kind: 'heading', text: 'The late-discovery problem' },
    {
      kind: 'paragraph',
      text: 'Weak topics stay hidden because ordinary studying never interrogates them. You revise the chapters you like, practice sets flatter the topics you chose them for, and re-reading makes everything feel familiar. Meanwhile the actual gap sits in a chapter you “covered” months ago and quietly avoid — avoidance that feels like preference, not like evidence. The mock finally forces every topic to testify under time pressure, which is why gaps surface there. But a mock is a slow, late instrument for gap analysis. You can run the same diagnosis months earlier, deliberately.',
    },
    { kind: 'heading', text: 'Three signals of a weak topic' },
    {
      kind: 'paragraph',
      text: 'Weak topics broadcast themselves long before any test, through three signals:',
    },
    {
      kind: 'list',
      items: [
        'Low practice accuracy — the direct signal: on this topic your correct-answer rate sits visibly below your usual level.',
        'Systematic avoidance — the behavioural signal: the topic keeps sliding to tomorrow, and its revision slots keep becoming something else.',
        'Low confidence on contact — the felt signal: when a question from it appears, you hesitate, hedge, or hope it will not come up in the exam.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Any one signal deserves attention; two or more is a confirmed gap. The avoidance signal is the most valuable and the least used — nobody avoids topics they are comfortable with, so your own procrastination pattern is a diagnostic instrument pointed exactly at your weaknesses.',
    },
    { kind: 'heading', text: 'Build a topic-level accuracy tracker' },
    {
      kind: 'paragraph',
      text: 'Feelings lie about competence in both directions, so put numbers under them. Keep one simple table — topic, questions attempted, questions correct — and update it after every practice session and every test. Within a few weeks, the table does what no amount of introspection can: it ranks your syllabus by demonstrated accuracy, in your own data. Chapter-level tracking is a start, but topic-level is where the value is — “Electrostatics: 78%” hides the fact that capacitance questions specifically are running at 40%. The finer the tracking, the cheaper the fix.',
    },
    { kind: 'heading', text: 'Concept gap or application gap?' },
    {
      kind: 'paragraph',
      text: 'Once a weak topic is identified, diagnose which kind of weak it is, because the two kinds need different medicine. A concept gap means the underlying idea never landed: you cannot explain the principle in your own words, and errors are scattered and fundamental. An application gap means you understand the idea but cannot deploy it: you follow every solution when you read it, yet cannot start the problem yourself, or you fail only the unfamiliar variants. The test is one question: can you explain the concept cleanly to an imaginary junior? If yes, the gap is application. If the explanation wobbles, it is concept — and no amount of problem grinding will fix a concept gap, just as no amount of re-reading will fix an application gap.',
    },
    { kind: 'heading', text: 'Fix the right gaps first' },
    {
      kind: 'paragraph',
      text: 'You will usually find more gaps than you have time to close, so prioritise like an economist: weigh each topic’s exam weightage against the time it needs. A weak topic that reliably supplies several questions per paper outranks a weak topic the exam touches once every three years — and a gap that needs one evening outranks a gap that needs a fortnight, when the exam is close. High-weightage, quick-to-fix topics are your first queue. Low-weightage, expensive topics may rationally stay weak; leaving a gap open on purpose, with your eyes open, is strategy rather than neglect.',
    },
    { kind: 'heading', text: 'Repairing each kind' },
    {
      kind: 'paragraph',
      text: 'For a concept gap, re-learn — but not by repeating the reading that failed. Use a different explanation than your first source, work through the derivation or mechanism by hand, and force yourself to write the idea from memory afterwards. The re-learning pass is faster than the original and sticks better, because this time you know exactly what you are looking for. For an application gap, the medicine is structured variety: solve many problems on the topic, deliberately mixed in difficulty and format, and after each one name the pattern — what signalled which method. Application strength is pattern recognition, and pattern recognition is built from varied examples, not from re-reading or from ten copies of the same problem.',
    },
    {
      kind: 'pull',
      text: 'A weak topic is not fixed when you feel better about it. It is fixed when fresh questions say so, twice, with a gap in between.',
    },
    { kind: 'heading', text: 'The reassessment test' },
    {
      kind: 'paragraph',
      text: 'Close the loop with verification. A week after the repair work, attempt a fresh set of questions on the topic — unseen ones, under light time pressure — and record the accuracy in your tracker. If it has climbed to your normal level, the gap is closed; schedule a second confirmation a few weeks later, since fixed topics can quietly re-open. If accuracy is still low, the diagnosis was wrong more often than the effort was — usually a concept gap mislabelled as application — so re-diagnose rather than re-grind. Found early, measured honestly, fixed by type, and verified: that is the whole method, and every part of it is available months before any mock would have told you.',
    },
  ],
};

/* ===========================================================================
 * 19 · revision-techniques
 * ======================================================================== */

const REVISION_TECHNIQUES: Article = {
  slug: 'revision-techniques',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1790098547293-67dbq2.png',
  title: '5 Revision Techniques That Work for Competitive Exams (Evidence-Backed)',
  teaser:
    'Not all revision is equal. These five techniques are consistently shown to improve long-term recall.',
  kicker: 'Revision',
  body: [
    {
      kind: 'paragraph',
      text: 'Ask students how they revise and two answers dominate: re-reading notes and highlighting. Ask learning researchers which common techniques perform worst on long-term retention, and the same two answers come back. That inversion — the most popular methods being the least effective — is one of the best-documented findings in the study of learning, and it explains a great deal of honest effort producing disappointing marks. Both techniques fail for the same reason: they are passive. The material moves in front of your eyes, feels increasingly familiar, and familiarity gets mistaken for knowledge. Neither ever asks your brain to produce anything — and production is what exams test. The five techniques below all share the opposite property, which is why they work.',
    },
    { kind: 'heading', text: '1 · Spaced practice' },
    {
      kind: 'paragraph',
      text: 'Spread your revisits to a topic across days and weeks instead of massing them into one long session. Three separated hours beat three consecutive hours by a wide margin, because each return arrives after partial forgetting, and rebuilding a fading memory is precisely what strengthens it — repetitions inside a single sitting land on a memory that is still fresh and add almost nothing. In practice: when you finish studying a topic, schedule its revisits — a day later, a few days later, a week, a fortnight — and let the calendar, not your anxiety, decide what gets revised tonight.',
    },
    { kind: 'heading', text: '2 · Retrieval practice' },
    {
      kind: 'paragraph',
      text: 'Close the book and pull the material out of your head: write everything you remember of a chapter on a blank page, attempt problems without notes, answer questions from memory before checking. Every act of successful retrieval strengthens the memory far more than another exposure to the page — testing yourself is not merely a way of measuring learning, it is one of the strongest ways of causing it. And failed retrievals are equally valuable: each one marks a precise gap while it is still cheap to fix. The blank page tells you the truth about a chapter. The re-read page only ever tells you it looks familiar.',
    },
    { kind: 'heading', text: '3 · Interleaving' },
    {
      kind: 'paragraph',
      text: 'Mix related topics within a study session instead of drilling one type in a long block. Twenty mixed problems spanning three chapters teach more than sixty problems of one type, because mixing forces the skill exams actually demand: identifying which method a problem needs before applying it. Blocked practice quietly removes that step — after the third problem you know the method in advance, so you are executing, not diagnosing. Interleaving feels slower and less fluent than blocking, and produces reliably better exam performance; the fluency you lose was never real.',
    },
    { kind: 'heading', text: '4 · Elaborative interrogation' },
    {
      kind: 'paragraph',
      text: 'Interrogate the material instead of accepting it: why does this hold, how does it connect to what I already know, what would change if one condition changed? Asking why this reaction proceeds this way, or why this theorem needs this assumption, forces you to connect new facts into the structure of what you already understand — and connected knowledge is both more durable and more flexible than isolated facts. It survives longer, and it bends to unfamiliar questions. This is also the fastest honesty check available: a why-question you cannot answer has found a gap that re-reading would have walked straight past.',
    },
    { kind: 'heading', text: '5 · Concrete examples' },
    {
      kind: 'paragraph',
      text: 'Anchor every abstract idea to specific instances you can recall at will. Equilibrium as a definition is forgettable; equilibrium as a specific worked scenario is retrievable, and the retrieval drags the abstraction up with it. When you learn a principle, immediately collect two or three concrete cases of it — a worked problem, a real-world instance, a diagram — and when you revise, recall the examples first and let them reconstruct the concept. Abstract ideas stored without anchors are the first things an exam hall takes from you.',
    },
    { kind: 'heading', text: 'A weekly session built from all five' },
    {
      kind: 'paragraph',
      text: 'The techniques combine naturally into one weekly revision session. Let spacing choose the content: the topics whose revisit dates have arrived, not the ones you feel like. Start with retrieval — a blank-page recall of each due topic before any book opens. Then a mixed problem set across all of tonight’s topics, which is interleaving doing its work. As you check answers, interrogate the misses — why is the correct answer correct, where exactly did my reasoning fork? — and for any concept that felt shaky, refresh its concrete examples before closing. Ninety minutes structured this way outperforms an entire evening of re-reading, and it replaces nothing in your schedule except the illusion of productivity.',
    },
    {
      kind: 'pull',
      text: 'Effective revision feels harder — and that difficulty is not the obstacle to learning. It is the mechanism.',
    },
    {
      kind: 'paragraph',
      text: 'One final warning, because it is the reason most students drift back to highlighting: every technique above feels worse than re-reading while you are doing it. Retrieval exposes ignorance, interleaving breaks flow, spacing lets material go fuzzy before you return. That discomfort is the strengthening happening — and re-reading’s smoothness is precisely the sign that nothing is being built. Students consistently misjudge this, rating the passive methods as more effective while the active ones quietly win the exams. Choose your revision methods by results, not by how pleasant the hour feels.',
    },
  ],
};

/* ===========================================================================
 * 20 · how-to-study-long-hours
 * ======================================================================== */

const HOW_TO_STUDY_LONG_HOURS: Article = {
  slug: 'how-to-study-long-hours',
  heroImage: 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1790098564119-acagh8.png',
  title: 'How to Study 8-10 Hours a Day Without Losing Focus',
  teaser:
    'Long study days only work if you manage your attention, not just your time.',
  kicker: 'Focus',
  body: [
    {
      kind: 'paragraph',
      text: 'Every aspirant eventually hears about someone who studies twelve hours a day, and quietly concludes that their own eight are not enough. Wrong lesson. Sit near the twelve-hour student and watch: a large share of that time is phone checks, drifting re-reads and being at the desk rather than in the work. Hours are the wrong unit. The right unit is the block of genuinely focused attention — and six real ones beat ten hollow ones every single day. Studying long hours is a real skill, but it is an attention-management skill, not an endurance stunt.',
    },
    { kind: 'heading', text: 'Work in 90-minute blocks' },
    {
      kind: 'paragraph',
      text: 'Your capacity for deep focus is not a steady stream — it moves in natural cycles of roughly an hour to ninety minutes, after which concentration decays no matter how disciplined you are. Fighting that rhythm produces the familiar late-block experience of reading the same paragraph four times. Work with it instead: structure the day as five or six 90-minute blocks, each with one defined objective — a chapter section, a problem set, a revision list — followed by a real break. A 90-minute block with a stated goal has a shape and an end, and work with an end is dramatically easier to start.',
    },
    { kind: 'heading', text: 'Breaks are refuelling, not leakage' },
    {
      kind: 'paragraph',
      text: 'What you do between blocks decides what the next block is worth. Fifteen to twenty minutes is right — long enough to recover, short enough not to lose the day’s thread. Spend it on movement and disengagement: walk, stretch, eat something, stand outside. What breaks a break is the phone. Scrolling floods exactly the attention circuits you are trying to rest — twenty minutes of it returns you to the desk with your focus already spent, which is why a scrolled break feels like no break at all. The test of a good break is simple: you come back mildly bored and ready. Boredom before a block is fuel.',
    },
    { kind: 'heading', text: 'Rotate subjects to delay fatigue' },
    {
      kind: 'paragraph',
      text: 'Mental fatigue is partly subject-specific: three consecutive blocks of Physics exhaust your problem-solving circuits while your memorisation capacity sits fresh. Rotation exploits this — Physics, then Biology or a language section, then Maths — so each block draws on a different kind of thinking and arrives partially rested. The rotation also imposes natural deadlines: knowing the Physics block ends at 11 concentrates the mind in a way an open-ended grind never does. One caution: rotate between blocks, never within one. Switching mid-block is distraction wearing rotation’s clothes.',
    },
    { kind: 'heading', text: 'Build a starting ritual' },
    {
      kind: 'paragraph',
      text: 'For most students the expensive minutes are the first ones — settling, negotiating with yourself, easing in through fifteen minutes of shallow warm-up. Cut that with a fixed ritual: same desk, materials laid out the night before or in the previous break, a written one-line goal for the block, phone out of the room, timer started — then begin with a two-minute recall of where you left off. The recall connects you to the work faster than any amount of settling in, and the repetition is the point: run the same sequence every time and it becomes a trigger your brain obeys in under five minutes, on motivated days and flat ones alike.',
    },
    { kind: 'heading', text: 'Surviving the afternoon slump' },
    {
      kind: 'paragraph',
      text: 'Every long study day contains a trough, usually in the early afternoon, and no ritual removes it — it is biology. The mistake is scheduling as if it were not there, assigning 2 p.m. to your hardest subject and then reading its failure as weakness. Make one adjustment: put your lightest work in the trough — revision of familiar material, note organising, flashcards, error-log review — and, if your day allows, a twenty-minute nap or a walk before it. That single act of realistic scheduling is what saves the evening: students who fight the slump with willpower arrive at 6 p.m. spent, while students who planned around it get two more real blocks after dinner.',
    },
    {
      kind: 'pull',
      text: 'The students who last eight hours are not pushing through fatigue. They are scheduling around it.',
    },
    { kind: 'heading', text: 'Design the environment, spare the willpower' },
    {
      kind: 'paragraph',
      text: 'Willpower is a small, exhaustible budget, and every visible temptation bills it — resisting the phone forty times an hour is forty withdrawals even when you win. Environment design removes the transactions entirely: phone in another room, one clear desk holding only the current block’s materials, water within reach, a fixed seat your brain associates with work and nothing else. Students consistently overrate their discipline and underrate their surroundings, yet the desk decides more of your daily output than your resolve does. Make the focused choice the default choice, and stop paying attention-tax on the alternative.',
    },
    { kind: 'heading', text: 'Sleep is part of the study day' },
    {
      kind: 'paragraph',
      text: 'The commonest way aspirants fund long days is by shaving sleep, and it is the one funding source that always defaults. Sleep is when the day’s studying is consolidated into long-term memory — cut it and yesterday’s hours literally retain less — and a sleep-deprived brain focuses worse, so tomorrow’s hours produce less too. Losses on both ends, permanently. Seven to eight hours is not a reward for finishing the plan; it is a line item in the plan, as fixed as any study block. An 8-to-10-hour study day is genuinely sustainable for months — but only as focused blocks, honest breaks, rotation, a protected trough and full nights. Attention, managed, is the whole game.',
    },
  ],
};

export const ARTICLES: Article[] = [
  SPACED_REPETITION,
  AI_STUDY_SYSTEM,
  GAP_DETECTION,
  REVISION_BUDGET,
  AM_I_ON_TRACK,
  DAY_ONE_PLAN,
  JEE_STUDY_PLAN,
  NEET_STUDY_PLAN,
  NEET_PG_STRATEGY,
  MOCK_TEST_STRATEGY,
  STUDY_TIMETABLE,
  BEAT_FORGETTING,
  WEAK_TOPICS_GUIDE,
  REVISION_TECHNIQUES,
  HOW_TO_STUDY_LONG_HOURS,
  ADDITIONAL.ACTIVE_RECALL,
  ADDITIONAL.HOW_TO_STUDY_FOR_JEE,
  ADDITIONAL.HOW_TO_STUDY_FOR_NEET,
  ADDITIONAL.TEST_ANALYSIS,
  ADDITIONAL.STUDY_SCHEDULE,
  ADDITIONAL.WEAK_TOPICS,
  ADDITIONAL.REVISION_VS_STUDYING,
  ADDITIONAL.NEET_PHYSICS_STRATEGY,
  ADDITIONAL.JEE_MATHEMATICS_STRATEGY,
  ADDITIONAL.NEET_BIOLOGY_HIGH_YIELD,
  ADDITIONAL.JEE_CHEMISTRY_STRATEGY,
  ADDITIONAL.MOCK_TEST_FREQUENCY,
  ADDITIONAL.BURNOUT_STUDY,
  ADDITIONAL.NCERT_FOR_NEET,
  ADDITIONAL.JEE_VS_NEET,
  ADDITIONAL.TIME_MANAGEMENT_EXAM,
  ADDITIONAL.NEET_PG_PREPARATION,
  ADDITIONAL.MEMORY_TECHNIQUES,
  ADDITIONAL.LAST_MONTH_STRATEGY,
  ADDITIONAL.AI_STUDY_COMPANION,
  ADDITIONAL.PATTERN_ANALYSIS,
  ADDITIONAL.POMODORO_COMPETITIVE_EXAMS,
  ADDITIONAL.STUDY_GROUP_VS_SOLO,
  ADDITIONAL.NEET_INORGANIC_CHEMISTRY,
];

/** Total words across every block of an article. The list items and the
 *  pulled lines count — they are read like anything else. */
export function wordCount(article: Article): number {
  const text = article.body
    .map((block) => (block.kind === 'list' ? block.items.join(' ') : block.text))
    .join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** Estimated reading time in whole minutes, at 200 words per minute. Never
 *  returns 0 — a very short piece still reads as “1 min read”. */
export function readMinutes(article: Article): number {
  return Math.max(1, Math.round(wordCount(article) / 200));
}

export function findArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}
