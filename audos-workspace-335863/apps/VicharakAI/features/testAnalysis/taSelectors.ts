/**
 * Test Analysis — pure derivations. Deterministic arithmetic only (zero AI).
 *
 * TWO SOURCES OF TRUTH, deliberately separated:
 *
 *  1. THE MOCK SESSION TOTALS (Step 1: total / attempted / correct / marks)
 *     are the ONLY source of accuracy and score. Students crop just the
 *     questions they got wrong, so anything derived from logged entries reads
 *     0% forever — that was the "accuracy always 0%" bug. No function here
 *     computes an accuracy from entries.
 *
 *  2. THE LOGGED ENTRIES drive the error-type breakdown and the weak-topic
 *     ranking, and nothing else. Weak topics rank by MARKS LOST (or questions
 *     missed, per the exam's unit_label — wording only), never by how many
 *     entries a topic happens to have, and a topic needs
 *     WEAK_TOPIC_MIN_ATTEMPTS logged attempts before it can be called weak.
 *
 * All marks arithmetic comes from the exam's ExamConfig row (examConfig.ts);
 * marks_delta is always derived here, never stored.
 */

import {
  COVERAGE_GATE_THRESHOLD,
  ERROR_TAGS,
  ERROR_TAG_LABELS,
  SUGGESTION_MAX_OVERRIDE_RATE,
  SUGGESTION_MIN_TAGGED,
  asCount,
  entryFullyTagged,
  isErrorTag,
  sanitizeSubjectName,
  sanitizeTopicName,
  type ErrorTag,
  type MockSessionRow,
  type QuestionEntryRow,
  type TimeBucket,
} from './taTypes';
import {
  WEAK_TOPIC_MIN_ATTEMPTS,
  entryMarksLost,
  formatUnits,
  lostVerb,
  marksLostPerWrong,
  roundMarks,
  scaledScoreEstimate,
  type ExamConfig,
  type MarksOutcome,
} from './examConfig';

/* ---------- session totals — THE accuracy and score ---------- */

export interface SessionTotals {
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  maxScore: number;
  /** 0–100, correct ÷ attempted. From Step 1 totals — never from entries. */
  accuracy: number;
  /** 0–100, score ÷ max score. From Step 1 totals — never from entries. */
  scorePercent: number;
  /** Marks lost against a perfect paper, from the totals. */
  marksLost: number;
  /** Display-only scaled estimate (LSAT/MCAT), always labelled 'estimated'. */
  scaled: { value: number; label: string } | null;
}

/** The mock's headline numbers, read ONLY from what the student entered at
 * Step 1. This is the single answer to "what did I score / how accurate was
 * I?" anywhere in the feature. */
export function sessionTotals(session: MockSessionRow, config: ExamConfig): SessionTotals {
  const totalQuestions = asCount(session.total_questions);
  const attempted = asCount(session.attempted);
  const correct = asCount(session.correct);
  const incorrect = asCount(session.incorrect);
  const score = asCount(session.score);
  const maxScore = asCount(session.max_score);
  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return {
    totalQuestions,
    attempted,
    correct,
    incorrect,
    skipped: Math.max(0, totalQuestions - attempted),
    score,
    maxScore,
    accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    scorePercent,
    marksLost: roundMarks(Math.max(0, maxScore - score)),
    scaled: scaledScoreEstimate(config, maxScore > 0 ? score / maxScore : 0),
  };
}

/* ---------- coverage gate ---------- */

export interface CoverageState {
  wrongTotal: number;
  wrongTagged: number;
  /** 0–1; 1 when there is nothing to tag. */
  ratio: number;
  /** True when analysis should prompt "finish tagging first?". */
  belowGate: boolean;
}

/** How much of a mock's wrong questions carry a full tag (topic + reason). */
export function coverageOf(entries: QuestionEntryRow[]): CoverageState {
  const wrong = entries.filter((entry) => entry.outcome === 'incorrect');
  const tagged = wrong.filter((entry) => entryFullyTagged(entry));
  const ratio = wrong.length === 0 ? 1 : tagged.length / wrong.length;
  return {
    wrongTotal: wrong.length,
    wrongTagged: tagged.length,
    ratio,
    belowGate: wrong.length > 0 && ratio < COVERAGE_GATE_THRESHOLD,
  };
}

/* ---------- per-entry marks (always derived) ---------- */

function lostOn(entry: QuestionEntryRow, config: ExamConfig): number {
  return entryMarksLost(
    config,
    (entry.outcome ?? null) as MarksOutcome | null,
    entry.marks_awarded ?? null,
    entry.marks_possible ?? null,
  );
}

/** Marks (or questions) a set of entries cost, per the exam's scheme. */
export function marksLostOf(entries: QuestionEntryRow[], config: ExamConfig): number {
  return roundMarks(entries.reduce((sum, entry) => sum + lostOn(entry, config), 0));
}

/* ---------- per-mock analysis ---------- */

export interface TopicCost {
  topic: string;
  subject: string;
  /** Logged entries touching this topic. */
  logged: number;
  /** Logged entries that went wrong or were skipped. */
  missed: number;
  /** Marks (or questions) this topic cost — the ranking key. */
  marksLost: number;
  /** Doubts/deck cards this topic has produced (volume signal). */
  doubts: number;
  /** The topic's dominant error tag, when one stands out. */
  dominantTag: ErrorTag | null;
  /** True once the topic clears WEAK_TOPIC_MIN_ATTEMPTS logged attempts. */
  rankable: boolean;
}

export interface SubjectSlice {
  subject: string;
  /** Logged entries in this subject (NOT the paper's question count). */
  logged: number;
  missed: number;
  marksLost: number;
  topics: TopicCost[];
}

export interface ErrorSlice {
  tag: ErrorTag;
  label: string;
  count: number;
  /** Marks (or questions) lost to this tag, from the exam's scheme. */
  marksLost: number;
}

export interface PerMockAnalysis {
  session: MockSessionRow;
  config: ExamConfig;
  /** The headline numbers — from Step 1 totals only. */
  totals: SessionTotals;
  entriesTotal: number;
  taggedTotal: number;
  subjects: SubjectSlice[];
  errors: ErrorSlice[];
  /** Weak topics, ranked by marks lost, minimum-attempts filter applied. */
  weakTopics: TopicCost[];
  /** Topics seen but still below the minimum attempts to be called weak. */
  watchTopics: TopicCost[];
  /** Entries over the pacing benchmark — empty unless timing is tracked. */
  timeSinks: QuestionEntryRow[];
  /** Marks (or questions) accounted for by the logged entries. */
  loggedMarksLost: number;
  /** Careless behavioural nudge lines for THIS mock (empty when quiet). */
  nudges: string[];
  partial: boolean;
}

/** Which coarse buckets exceed the exam's per-question benchmark. */
export function sinkBuckets(benchmarkSeconds: number): TimeBucket[] {
  // Benchmark ≤ 2 min: anything past 2 minutes is a sink. Longer-form exams
  // (JEE ≈ 3 min): only the over-4-minute bucket counts.
  return benchmarkSeconds <= 120 ? ['2_4', 'over_4'] : ['over_4'];
}

function dominantTagOf(rows: QuestionEntryRow[]): ErrorTag | null {
  const counts = new Map<ErrorTag, number>();
  for (const row of rows) {
    if (isErrorTag(row.error_tag)) counts.set(row.error_tag, (counts.get(row.error_tag) ?? 0) + 1);
  }
  let best: ErrorTag | null = null;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  return best;
}

/**
 * What a topic's error mix means for the plan (§6):
 *  - mostly concept gaps / couldn't-apply → a revision task earns its place;
 *  - mostly careless or out-of-time → a behavioural nudge, NO study task.
 */
export type TopicAction = 'revision' | 'behavioural';

export function topicAction(rows: QuestionEntryRow[]): TopicAction {
  let study = 0;
  let behaviour = 0;
  for (const row of rows) {
    if (row.error_tag === 'concept_gap' || row.error_tag === 'couldnt_apply') study += 1;
    if (row.error_tag === 'careless' || row.error_tag === 'out_of_time') behaviour += 1;
  }
  return study >= behaviour && study > 0 ? 'revision' : 'behavioural';
}

/**
 * Rank topics by what they COST. `doubtsByTopic` adds the doubt-volume
 * signal: repeated doubts on a topic are a stronger weakness signal than a
 * single wrong answer, so they break ties above raw marks.
 */
export function rankTopicCosts(
  entries: QuestionEntryRow[],
  config: ExamConfig,
  doubtsByTopic: Map<string, number> = new Map(),
): TopicCost[] {
  const byTopic = new Map<string, QuestionEntryRow[]>();
  for (const entry of entries) {
    const topic = sanitizeTopicName(entry.topic_id);
    if (!topic || !entry.outcome) continue;
    const list = byTopic.get(topic) ?? [];
    list.push(entry);
    byTopic.set(topic, list);
  }
  const costs: TopicCost[] = [];
  for (const [topic, rows] of byTopic) {
    const missed = rows.filter((row) => row.outcome === 'incorrect' || row.outcome === 'skipped');
    costs.push({
      topic,
      subject: sanitizeSubjectName(rows[0].subject) ?? '',
      logged: rows.length,
      missed: missed.length,
      marksLost: marksLostOf(rows, config),
      doubts: doubtsByTopic.get(topic.toLowerCase()) ?? 0,
      dominantTag: dominantTagOf(rows),
      rankable: rows.length >= WEAK_TOPIC_MIN_ATTEMPTS,
    });
  }
  return costs.sort(
    (a, b) => b.marksLost - a.marksLost || b.doubts - a.doubts || b.missed - a.missed || a.topic.localeCompare(b.topic),
  );
}

/* ---------- mock-targeted generated practice ---------- */

/** Five fully tagged mock questions is the smallest useful targeting sample.
 * The per-topic minimum still applies independently, so five unrelated misses
 * never manufacture a weak topic. */
export const MOCK_PRACTICE_MIN_LOGGED_ENTRIES = 5;
export const MOCK_PRACTICE_QUESTION_COUNT = 10;

export interface MockPracticeTarget {
  subject: string;
  topic: string;
  marksLost: number;
  attempts: number;
  dominantTag: ErrorTag | null;
  questionCount: number;
}

export interface MockPracticePlan {
  ready: boolean;
  meaningfulEntries: number;
  minimumEntries: number;
  remainingEntries: number;
  questionCount: number;
  targets: MockPracticeTarget[];
  /** Costly repeated topics whose mix is mostly careless/out-of-time. They
   * earn a nudge in the setup sheet, never questions in the practice set. */
  behaviouralTopics: TopicCost[];
}

export interface MockPracticeSyllabusSubject {
  name: string;
  chapters: Array<{ name: string; topics: string[] }>;
}

function normalizedSyllabusLabel(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Snap a logged topic back to the student's current syllabus spelling. */
function syllabusTarget(
  cost: TopicCost,
  syllabus: MockPracticeSyllabusSubject[],
): { subject: string; topic: string } | null {
  const wantedTopic = normalizedSyllabusLabel(cost.topic);
  const wantedSubject = normalizedSyllabusLabel(cost.subject);
  const matches: Array<{ subject: string; topic: string }> = [];
  for (const subject of syllabus) {
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        if (normalizedSyllabusLabel(topic) !== wantedTopic) continue;
        matches.push({ subject: subject.name, topic });
      }
    }
  }
  if (matches.length === 0) return null;
  return matches.find((match) => normalizedSyllabusLabel(match.subject) === wantedSubject) ??
    (matches.length === 1 ? matches[0] : null);
}

/**
 * Build the generated-test brief from the student's own mock log. The ranking
 * is exactly rankTopicCosts (marks lost first), then three hard gates apply:
 * enough fully tagged evidence, the shared per-topic minimum, and membership
 * in the student's current syllabus. Behavioural error mixes are returned as
 * nudges instead of being turned into extra study.
 */
export function mockPracticePlan(args: {
  entries: QuestionEntryRow[];
  config: ExamConfig;
  doubtsByTopic?: Map<string, number>;
  syllabus: MockPracticeSyllabusSubject[];
  questionCount?: number;
}): MockPracticePlan {
  const meaningful = args.entries.filter(
    (entry) => Boolean(entry.outcome) && Boolean(sanitizeTopicName(entry.topic_id)) && isErrorTag(entry.error_tag),
  );
  const minimumEntries = MOCK_PRACTICE_MIN_LOGGED_ENTRIES;
  const questionCount = Math.max(1, Math.floor(args.questionCount ?? MOCK_PRACTICE_QUESTION_COUNT));
  const ranked = rankTopicCosts(meaningful, args.config, args.doubtsByTopic ?? new Map());
  const revisionCosts: Array<{ cost: TopicCost; subject: string; topic: string }> = [];
  const behaviouralTopics: TopicCost[] = [];

  for (const cost of ranked) {
    if (!cost.rankable || cost.marksLost <= 0) continue;
    const ownTopic = syllabusTarget(cost, args.syllabus);
    if (!ownTopic) continue;
    const rows = meaningful.filter(
      (entry) =>
        sanitizeTopicName(entry.topic_id) === cost.topic &&
        (!cost.subject || sanitizeSubjectName(entry.subject) === cost.subject),
    );
    if (topicAction(rows) === 'revision') revisionCosts.push({ cost, ...ownTopic });
    else behaviouralTopics.push(cost);
  }

  const selected = revisionCosts.slice(0, Math.min(4, questionCount));
  const allocations = selected.map(() => 1);
  const totalCost = selected.reduce((sum, target) => sum + target.cost.marksLost, 0) || 1;
  for (let slot = selected.length; slot < questionCount; slot += 1) {
    let bestIndex = 0;
    let bestDeficit = -Infinity;
    selected.forEach((target, index) => {
      const ideal = (target.cost.marksLost / totalCost) * questionCount;
      const deficit = ideal - allocations[index];
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestIndex = index;
      }
    });
    if (selected.length > 0) allocations[bestIndex] += 1;
  }

  const targets = selected.map<MockPracticeTarget>((target, index) => ({
    subject: target.subject,
    topic: target.topic,
    marksLost: target.cost.marksLost,
    attempts: target.cost.logged,
    dominantTag: target.cost.dominantTag,
    questionCount: allocations[index],
  }));
  const remainingEntries = Math.max(0, minimumEntries - meaningful.length);
  return {
    ready: remainingEntries === 0 && targets.length > 0,
    meaningfulEntries: meaningful.length,
    minimumEntries,
    remainingEntries,
    questionCount,
    targets,
    behaviouralTopics: behaviouralTopics.slice(0, 3),
  };
}

/** Careless nudges for one mock, framed with the student's own numbers. */
export function carelessNudges(
  sessionEntries: QuestionEntryRow[],
  config: ExamConfig,
  risingAcrossMocks: boolean,
): string[] {
  const careless = sessionEntries.filter((entry) => entry.error_tag === 'careless');
  const nudges: string[] = [];
  if (careless.length >= 3) {
    const cost = formatUnits(config, marksLostOf(careless, config));
    const verb = lostVerb(config);
    const misread = careless.filter((entry) =>
      /misread|misunderstood|read wrong|question asked/i.test(String(entry.reason_note ?? '')),
    ).length;
    if (misread * 2 >= careless.length && misread > 0) {
      nudges.push(
        `You ${verb} about ${cost} to careless errors this mock — most look like misreads. Underline what the question asks before you start solving.`,
      );
    } else {
      nudges.push(
        `You ${verb} about ${cost} to careless errors this mock. Slow down on the first pass and re-read the final line before you commit an answer.`,
      );
    }
  }
  if (risingAcrossMocks) {
    nudges.push(
      'Careless errors have risen across your last three mocks. Try a short presence-of-mind drill before your next paper — 10 minutes of slow, deliberate questions.',
    );
  }
  return nudges;
}

/** The full per-mock analysis. `timeSinks` stays empty when timing is off. */
export function perMockAnalysis(args: {
  session: MockSessionRow;
  entries: QuestionEntryRow[];
  config: ExamConfig;
  benchmarkSeconds: number;
  tracksTiming: boolean;
  risingCareless: boolean;
  doubtsByTopic?: Map<string, number>;
}): PerMockAnalysis {
  const { session, entries, config, benchmarkSeconds, tracksTiming, risingCareless } = args;
  const doubtsByTopic = args.doubtsByTopic ?? new Map<string, number>();

  const topicCosts = rankTopicCosts(entries, config, doubtsByTopic);
  const topicsBySubject = new Map<string, TopicCost[]>();
  for (const cost of topicCosts) {
    const list = topicsBySubject.get(cost.subject) ?? [];
    list.push(cost);
    topicsBySubject.set(cost.subject, list);
  }

  const subjectMap = new Map<string, SubjectSlice>();
  for (const entry of entries) {
    if (!entry.outcome) continue;
    const subject = sanitizeSubjectName(entry.subject) ?? 'Not tagged yet';
    const slice = subjectMap.get(subject) ?? { subject, logged: 0, missed: 0, marksLost: 0, topics: [] };
    slice.logged += 1;
    if (entry.outcome === 'incorrect' || entry.outcome === 'skipped') slice.missed += 1;
    slice.marksLost = roundMarks(slice.marksLost + lostOn(entry, config));
    subjectMap.set(subject, slice);
  }
  const subjects = Array.from(subjectMap.values())
    .map((slice) => ({ ...slice, topics: topicsBySubject.get(slice.subject) ?? [] }))
    .sort((a, b) => b.marksLost - a.marksLost || b.missed - a.missed);

  const perWrong = marksLostPerWrong(config);
  const errors: ErrorSlice[] = ERROR_TAGS.map((tag) => {
    const rows = entries.filter((entry) => entry.error_tag === tag);
    const marksLost = rows.length > 0 ? marksLostOf(rows, config) : 0;
    return {
      tag,
      label: ERROR_TAG_LABELS[tag],
      count: rows.length,
      marksLost: marksLost > 0 ? marksLost : roundMarks(rows.length * perWrong),
    };
  }).filter((slice) => slice.count > 0);

  const buckets = sinkBuckets(benchmarkSeconds) as string[];
  const timeSinks = tracksTiming
    ? entries.filter((entry) => entry.time_bucket && buckets.includes(String(entry.time_bucket)))
    : [];

  const coverage = coverageOf(entries);
  return {
    session,
    config,
    totals: sessionTotals(session, config),
    entriesTotal: entries.length,
    taggedTotal: entries.filter((entry) => entryFullyTagged(entry)).length,
    subjects,
    errors,
    weakTopics: topicCosts.filter((cost) => cost.rankable && cost.marksLost > 0),
    watchTopics: topicCosts.filter((cost) => !cost.rankable),
    timeSinks,
    loggedMarksLost: marksLostOf(entries, config),
    nudges: carelessNudges(entries, config, risingCareless),
    partial: coverage.ratio < 1,
  };
}

/* ---------- cross-mock analysis ---------- */

export interface TopicTrend {
  topic: string;
  subject: string;
  /** Logged attempts on the topic across every mock. */
  attempts: number;
  /** Total marks (or questions) the topic has cost. */
  marksLost: number;
  doubts: number;
  /** Improving = costing FEWER marks in the newer half of its history. */
  direction: 'improving' | 'flat' | 'declining';
}

export interface RepeatOffender {
  topic: string;
  subject: string;
  consecutiveMocks: number;
  lastMockName: string;
  marksLost: number;
}

export interface ErrorTrendPoint {
  mockName: string;
  date: string;
  counts: Record<ErrorTag, number>;
}

export interface ScoreTrendPoint {
  mockName: string;
  date: string;
  /** Score percent from the mock's OWN Step 1 totals. */
  scorePercent: number;
  /** Accuracy percent from the mock's OWN Step 1 totals. */
  accuracy: number;
}

export interface CrossMockAnalysis {
  mockCount: number;
  config: ExamConfig;
  topicTrends: TopicTrend[];
  repeatOffenders: RepeatOffender[];
  errorTrend: ErrorTrendPoint[];
  /** Score/accuracy per mock, from session totals — never from entries. */
  scoreTrend: ScoreTrendPoint[];
  /** True when any covered mock still has untagged wrong questions. */
  partial: boolean;
  /** Careless count rising across the three newest mocks? */
  risingCareless: boolean;
}

function sessionsOldestFirst(sessions: MockSessionRow[]): MockSessionRow[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

/** Cross-mock trends over a set of sessions and their entries. */
export function crossMockAnalysis(
  sessions: MockSessionRow[],
  entriesBySession: Map<number, QuestionEntryRow[]>,
  config: ExamConfig,
  doubtsByTopic: Map<string, number> = new Map(),
): CrossMockAnalysis {
  const ordered = sessionsOldestFirst(sessions);
  const errorTrend: ErrorTrendPoint[] = ordered.map((session) => {
    const entries = entriesBySession.get(session.id) ?? [];
    const counts = { careless: 0, concept_gap: 0, couldnt_apply: 0, out_of_time: 0 } as Record<ErrorTag, number>;
    for (const entry of entries) {
      if (isErrorTag(entry.error_tag)) counts[entry.error_tag] += 1;
    }
    return { mockName: session.name, date: session.date, counts };
  });

  const scoreTrend: ScoreTrendPoint[] = ordered.map((session) => {
    const totals = sessionTotals(session, config);
    return {
      mockName: session.name,
      date: session.date,
      scorePercent: totals.scorePercent,
      accuracy: totals.accuracy,
    };
  });

  /* Topic trend: split each topic's logged attempts into an older and a newer
   * half (by session order) and compare what each half COST. Fewer marks lost
   * in the newer half is improvement — accuracy is deliberately not used,
   * because only wrong questions are ever logged. */
  interface TopicAccumulator {
    subject: string;
    attempts: Array<{ order: number; lost: number }>;
  }
  const byTopic = new Map<string, TopicAccumulator>();
  ordered.forEach((session, order) => {
    for (const entry of entriesBySession.get(session.id) ?? []) {
      const topic = sanitizeTopicName(entry.topic_id);
      if (!topic || !entry.outcome) continue;
      const acc = byTopic.get(topic) ?? { subject: sanitizeSubjectName(entry.subject) ?? '', attempts: [] };
      acc.attempts.push({ order, lost: lostOn(entry, config) });
      byTopic.set(topic, acc);
    }
  });
  const topicTrends: TopicTrend[] = [];
  for (const [topic, acc] of byTopic) {
    if (acc.attempts.length < WEAK_TOPIC_MIN_ATTEMPTS) continue;
    const sorted = [...acc.attempts].sort((a, b) => a.order - b.order);
    const half = Math.floor(sorted.length / 2);
    const older = sorted.slice(0, half);
    const newer = sorted.slice(half);
    const perAttempt = (slice: Array<{ lost: number }>) =>
      slice.length === 0 ? 0 : slice.reduce((sum, a) => sum + a.lost, 0) / slice.length;
    const delta = perAttempt(newer) - perAttempt(older);
    const scale = Math.max(0.5, marksLostPerWrong(config) * 0.25);
    topicTrends.push({
      topic,
      subject: acc.subject,
      attempts: sorted.length,
      marksLost: roundMarks(sorted.reduce((sum, a) => sum + a.lost, 0)),
      doubts: doubtsByTopic.get(topic.toLowerCase()) ?? 0,
      direction: delta < -scale ? 'improving' : delta > scale ? 'declining' : 'flat',
    });
  }
  topicTrends.sort((a, b) => b.marksLost - a.marksLost || b.doubts - a.doubts || b.attempts - a.attempts);

  /* Repeat offenders: topics with an incorrect entry in 2+ CONSECUTIVE mocks. */
  const repeatOffenders: RepeatOffender[] = [];
  const missedInMock = ordered.map((session) => {
    const missed = new Set<string>();
    for (const entry of entriesBySession.get(session.id) ?? []) {
      const topic = sanitizeTopicName(entry.topic_id);
      if (topic && entry.outcome === 'incorrect') missed.add(topic);
    }
    return missed;
  });
  const offenderSeen = new Set<string>();
  for (let index = ordered.length - 1; index >= 1; index -= 1) {
    for (const topic of missedInMock[index]) {
      if (offenderSeen.has(topic) || !missedInMock[index - 1].has(topic)) continue;
      let run = 2;
      let back = index - 2;
      while (back >= 0 && missedInMock[back].has(topic)) {
        run += 1;
        back -= 1;
      }
      offenderSeen.add(topic);
      const trend = topicTrends.find((entry) => entry.topic === topic);
      const subject =
        (entriesBySession.get(ordered[index].id) ?? []).find(
          (entry) => sanitizeTopicName(entry.topic_id) === topic,
        )?.subject ?? '';
      repeatOffenders.push({
        topic,
        subject: sanitizeSubjectName(subject) ?? '',
        consecutiveMocks: run,
        lastMockName: ordered[index].name,
        marksLost: trend?.marksLost ?? 0,
      });
    }
  }
  repeatOffenders.sort((a, b) => b.consecutiveMocks - a.consecutiveMocks || b.marksLost - a.marksLost);

  const partial = ordered.some((session) => coverageOf(entriesBySession.get(session.id) ?? []).belowGate);

  /* Rising carelessness across the three newest mocks: strictly increasing. */
  const lastThree = errorTrend.slice(-3);
  const risingCareless =
    lastThree.length === 3 &&
    lastThree[0].counts.careless < lastThree[1].counts.careless &&
    lastThree[1].counts.careless < lastThree[2].counts.careless;

  return {
    mockCount: ordered.length,
    config,
    topicTrends,
    repeatOffenders,
    errorTrend,
    scoreTrend,
    partial,
    risingCareless,
  };
}

/* ---------- doubt volume (§6 — the second weakness signal) ---------- */

/**
 * How many deck cards each topic has produced, keyed by LOWER-CASE topic.
 * Repeated doubts on one topic outrank a single wrong answer when ranking
 * weakness, so this feeds straight into rankTopicCosts / crossMockAnalysis.
 */
export function doubtVolumeByTopic(entries: QuestionEntryRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.is_doubt) continue;
    const topic = sanitizeTopicName(entry.topic_id);
    if (!topic) continue;
    const key = topic.toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/* ---------- error-tag pre-selection ---------- */

export interface TagSuggestionState {
  /** The tag to pre-select for this topic, or null (not enough history). */
  suggestion: ErrorTag | null;
  /** Override rate across ALL past suggestions (0–1). */
  overrideRate: number;
  /** True when the rate crossed the disable threshold. */
  shouldDisable: boolean;
}

/**
 * After SUGGESTION_MIN_TAGGED fully tagged entries, pre-select the most
 * likely tag for a topic from the student's own history. Falls back to the
 * student's overall dominant tag when the topic has no history yet.
 */
export function suggestErrorTag(
  allEntries: QuestionEntryRow[],
  topic: string | null,
  disabled: boolean,
): TagSuggestionState {
  const withSuggestion = allEntries.filter((entry) => isErrorTag(entry.suggested_tag));
  const overridden = withSuggestion.filter((entry) => entry.tag_overridden === true);
  const overrideRate = withSuggestion.length === 0 ? 0 : overridden.length / withSuggestion.length;
  const shouldDisable = withSuggestion.length >= 10 && overrideRate > SUGGESTION_MAX_OVERRIDE_RATE;

  if (disabled || shouldDisable) return { suggestion: null, overrideRate, shouldDisable };
  const tagged = allEntries.filter((entry) => entryFullyTagged(entry) && isErrorTag(entry.error_tag));
  if (tagged.length < SUGGESTION_MIN_TAGGED) return { suggestion: null, overrideRate, shouldDisable };

  const topicName = sanitizeTopicName(topic);
  const topicRows = topicName
    ? tagged.filter((entry) => sanitizeTopicName(entry.topic_id) === topicName)
    : [];
  const suggestion = (topicRows.length >= 2 ? dominantTagOf(topicRows) : null) ?? dominantTagOf(tagged);
  return { suggestion, overrideRate, shouldDisable };
}

/* ---------- topic-note prompt ---------- */

/** Ask for an optional free-text note only once a topic has 2+ misses. */
export function shouldPromptNote(allEntries: QuestionEntryRow[], topic: string | null): boolean {
  const topicName = sanitizeTopicName(topic);
  if (!topicName) return false;
  const misses = allEntries.filter(
    (entry) => sanitizeTopicName(entry.topic_id) === topicName && entry.outcome === 'incorrect',
  );
  return misses.length >= WEAK_TOPIC_MIN_ATTEMPTS;
}

/* ---------- mastery rollup ---------- */

export interface MasteryComputation {
  /** Logged entries on the topic (NOT paper attempts). */
  attempts: number;
  /** Marks (or questions) the topic has cost — the ranking key. */
  marksLost: number;
  /** Deck cards this topic produced. */
  doubtCount: number;
  consecutiveMisses: number;
  dominantErrorTag: ErrorTag | null;
  lastSeenAt: string | null;
}

/**
 * Recompute one topic's rollup from every entry that touched it. No accuracy
 * is derived here on purpose — see the file header.
 */
export function computeTopicMastery(
  sessions: MockSessionRow[],
  allEntries: QuestionEntryRow[],
  topic: string,
  config: ExamConfig,
): MasteryComputation {
  const topicName = sanitizeTopicName(topic);
  const rows = topicName
    ? allEntries.filter((entry) => sanitizeTopicName(entry.topic_id) === topicName && Boolean(entry.outcome))
    : [];
  const ordered = sessionsOldestFirst(sessions);
  let consecutiveMisses = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const sessionRows = rows.filter((entry) => entry.mock_session_id === ordered[index].id);
    if (sessionRows.length === 0) continue;
    if (sessionRows.some((entry) => entry.outcome === 'incorrect')) consecutiveMisses += 1;
    else break;
  }
  const dates = rows.map((entry) => String(entry.created_at ?? '').slice(0, 10)).filter(Boolean).sort();
  return {
    attempts: rows.length,
    marksLost: marksLostOf(rows, config),
    doubtCount: rows.filter((entry) => entry.is_doubt === true).length,
    consecutiveMisses,
    dominantErrorTag: dominantTagOf(rows),
    lastSeenAt: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}
