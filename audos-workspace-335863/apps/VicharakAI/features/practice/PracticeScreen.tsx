/**
 * PracticeScreen — the adaptive PYQ Question Bank tab.
 *
 * Questions come from the hand-verified static bank (data/questionBank.ts)
 * plus the shared pyq_* WorkspaceDB bank of imported open-dataset questions
 * (MedMCQA / MMLU / MedQA via the pyq-practice-pool server function) —
 * nothing is generated or invented.
 *
 * Layout (LOCKED to the student's own exam — there is no change-exam picker
 * here; the exam changes in Profile): "Recommended for you" serves ONE
 * question at a time with the plain-language reason it was picked (weakness
 * flags + real accuracy), and every shown recommendation is written to the
 * explainability log. Below it, a subject → chapter drill-down loads
 * questions from the server in small pages — never the whole bank at once.
 *
 * Every answer is recorded in vicharakai_question_attempts, and — when the
 * question's chapter maps onto the student's active syllabus — fed to the
 * adaptation engine (mastery + weakness scores), so practising here moves the
 * same weakness signals the rest of the app (and Vicharree) reads. Three
 * wrong answers in one chapter in a session make Vicharree speak up.
 */
/* eslint-disable */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Brain, BookOpen, CheckCircle2, ChevronDown, ChevronRight, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import {
  BRAND,
  GONE,
  INK,
  INK_SOFT,
  KEPT,
  PENCIL,
  RADIUS,
  RULE,
  RULE_SOFT,
  SHEET,
  tint,
} from '../../theme';
import { Card, Chip, EmptyLine, SectionLabel } from '../../ui';
import { useApp } from '../../app/AppContext';
import { useAllRows } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';
import { matchTaskToChapter } from '../../adaptationEngine';
import { examLabelFromId } from '../../customExam';
import { topicIdFor } from '../../data/syllabuses';
import { recordTestResult } from '../mastery/masteryService';
import { vicharreeSay } from '../../components/VicharreeLauncher';
import {
  QUESTION_BANK_EXAM_LABELS,
  bankExamForProfileExam,
  bankOptionText,
  type QuestionBankEntry,
  type QuestionBankExam,
  type QuestionOptionLetter,
} from '../../data/questionBank';
import {
  CHAPTER_PAGE_SIZE,
  PRACTICE_EXAM_META_KEY,
  PRACTICE_FILTER_EVENT,
  chapterAccuracyFromAttempts,
  chapterKey,
  consumePracticeFilter,
  fetchQuestionPage,
  logQuestionRecommendation,
  recordQuestionAttempt,
  selectForYouQuestions,
  usePracticePool,
  usePracticeStructure,
  type ForYouResult,
  type QuestionAttemptRow,
} from './practiceData';

const OPTION_LETTERS: QuestionOptionLetter[] = ['A', 'B', 'C', 'D'];

/* ------------------------------------------------------------------ */
/*  One question card                                                  */
/* ------------------------------------------------------------------ */

function QuestionCard({
  entry,
  position,
  total,
  onAnswered,
  onNext,
  hasNext,
  onRestart,
}: {
  entry: QuestionBankEntry;
  position: number;
  total: number;
  onAnswered: (letter: QuestionOptionLetter, timeTakenSeconds: number) => void;
  onNext: () => void;
  hasNext: boolean;
  onRestart: () => void;
}) {
  const [picked, setPicked] = useState<QuestionOptionLetter | null>(null);
  const shownAt = useRef<number>(Date.now());

  /* A new question resets the card. */
  useEffect(() => {
    setPicked(null);
    shownAt.current = Date.now();
  }, [entry.id]);

  const pick = (letter: QuestionOptionLetter) => {
    if (picked) return;
    setPicked(letter);
    onAnswered(letter, Math.round((Date.now() - shownAt.current) / 1000));
  };

  const isCorrectPick = picked === entry.correct_option;

  return (
    <Card className="p-4" testId={`practice-question-${entry.id}`}>
      <div className="flex items-center gap-2 flex-wrap mb-2.5" style={{ fontSize: '0.72rem', fontWeight: 600, color: INK_SOFT }}>
        <span
          className="px-2 py-0.5"
          style={{ borderRadius: RADIUS.chip, background: tint(BRAND, 0.1), color: BRAND }}
        >
          {QUESTION_BANK_EXAM_LABELS[entry.exam]} · {entry.year}
        </span>
        <span>{entry.chapter}</span>
        <span style={{ color: PENCIL }}>{entry.difficulty}</span>
        <span className="ml-auto tabular-nums" style={{ color: PENCIL }}>
          {position}/{total}
        </span>
      </div>

      <p className="leading-relaxed" style={{ fontSize: '0.95rem', fontWeight: 600, color: INK }} data-testid="practice-question-text">
        {entry.question_text}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {OPTION_LETTERS.map((letter) => {
          const isCorrect = letter === entry.correct_option;
          const isPicked = letter === picked;
          let border = `1px solid ${RULE}`;
          let background = SHEET;
          let color = INK;
          if (picked) {
            if (isCorrect) {
              border = `1.5px solid ${KEPT}`;
              background = tint(KEPT, 0.12);
              color = KEPT;
            } else if (isPicked) {
              border = `1.5px solid ${GONE}`;
              background = tint(GONE, 0.1);
              color = GONE;
            } else {
              color = INK_SOFT;
            }
          }
          return (
            <button
              key={letter}
              type="button"
              disabled={Boolean(picked)}
              onClick={() => pick(letter)}
              className="flex items-start gap-2.5 text-left px-3 py-2.5 touch-manipulation"
              style={{ borderRadius: RADIUS.md, border, background, color, minHeight: 44, fontSize: '0.88rem', fontWeight: 500 }}
              data-testid={`practice-option-${letter}`}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: `1.5px solid ${picked && (isCorrect || isPicked) ? 'currentColor' : RULE}`,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {letter}
              </span>
              <span className="min-w-0 flex-1 leading-snug">{bankOptionText(entry, letter)}</span>
              {picked && isCorrect && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {picked && isPicked && !isCorrect && <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {picked && (
        <div
          className="mt-3 p-3"
          style={{ borderRadius: RADIUS.md, background: tint(isCorrectPick ? KEPT : GONE, 0.07), border: `1px solid ${RULE_SOFT}` }}
          data-testid="practice-explanation"
        >
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: isCorrectPick ? KEPT : GONE }}>
            {isCorrectPick ? 'Correct!' : `Not quite — the answer is ${entry.correct_option}.`}
          </p>
          <p className="mt-1 leading-relaxed" style={{ fontSize: '0.82rem', color: INK }}>
            {entry.explanation}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: PENCIL }} data-testid="practice-source">
          {entry.official_source}
        </p>
        {picked && hasNext && (
          <button type="button" onClick={onNext} className="vicharak-btn vicharak-btn-primary flex-shrink-0" data-testid="practice-next">
            Next question
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {picked && !hasNext && (
          <button type="button" onClick={onRestart} className="vicharak-btn vicharak-btn-ghost flex-shrink-0" data-testid="practice-restart">
            <RotateCcw className="w-4 h-4" />
            Start over
          </button>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  The screen                                                         */
/* ------------------------------------------------------------------ */

export default function PracticeScreen() {
  const { data, toast, setTab } = useApp();
  const {
    profile, weakTopicInsights, attemptRows, activeSyllabusExam,
    metaMap, savedExamLabel,
  } = data;
  const { showToast } = toast;

  /* LOCKED to the student's own exam: the exam comes from their DATABASE
   * profile (same on every device) and there is deliberately NO change-exam
   * picker on this tab — changing the exam lives in Profile. A legacy
   * zuno_meta override (written by the old in-tab picker) only counts when
   * the profile exam has no question-bank mapping, so nobody's tab goes
   * blank. */
  const profileBankExam = bankExamForProfileExam(profile?.exam);
  const storedExam = useMemo(() => {
    const raw = metaMap.get(PRACTICE_EXAM_META_KEY)?.meta_value ?? '';
    return (Object.keys(QUESTION_BANK_EXAM_LABELS) as QuestionBankExam[]).find((id) => id === raw) ?? null;
  }, [metaMap]);
  const exam: QuestionBankExam | null = profileBankExam ?? storedExam;

  const [subject, setSubject] = useState<string | null>(null);
  /* Which runner is live and where it stands. */
  const [runner, setRunner] = useState<'forYou' | 'browse'>('forYou');
  const [index, setIndex] = useState(0);
  /* The open browse runner: a chapter (or a whole subject) fetched from the
   * server one small page at a time. */
  const [browseRun, setBrowseRun] = useState<{
    subject: string | null;
    chapter: string | null;
    entries: QuestionBankEntry[];
    total: number;
    loading: boolean;
    error: boolean;
  } | null>(null);
  /* A Vicharree deep link that arrived before the exam/structure was ready. */
  const [pendingChapterLink, setPendingChapterLink] = useState<{ subject: string | null; chapter: string } | null>(
    null,
  );

  /* This student's practice history (drives For You + accuracy badges). */
  const attemptsQ = useAllRows<QuestionAttemptRow>(TABLES.questionAttempts, {
    orderBy: { column: 'id', direction: 'asc' },
  });
  const bankAttempts = attemptsQ.data;

  /* Pre-filter handoff (Vicharree tap / deep link). The exam is locked, so a
   * cross-exam filter is ignored — subject/chapter apply within THIS exam. */
  const applyFilter = () => {
    const filter = consumePracticeFilter();
    if (!filter) return;
    if (filter.subject) setSubject(filter.subject);
    if (filter.chapter) setPendingChapterLink({ subject: filter.subject ?? null, chapter: filter.chapter });
  };
  useEffect(() => {
    applyFilter();
    window.addEventListener(PRACTICE_FILTER_EVENT, applyFilter);
    return () => window.removeEventListener(PRACTICE_FILTER_EVENT, applyFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The merged question pool: hand-verified static bank + DB open-dataset
   * bank (pyq_* tables). Static entries render immediately; the DB bank
   * arrives moments later. */
  const pool = usePracticePool(exam);
  const examQuestions = pool.questions;

  /* "For You" — snapshotted per exam once attempts AND the pool have loaded,
   * so the queue does not reshuffle underneath the student mid-run. */
  const forYouRef = useRef<{ exam: QuestionBankExam; poolSize: number; result: ForYouResult } | null>(null);
  if (
    exam &&
    !attemptsQ.loading &&
    !pool.loading &&
    (!forYouRef.current || forYouRef.current.exam !== exam || forYouRef.current.poolSize !== examQuestions.length)
  ) {
    forYouRef.current = {
      exam,
      poolSize: examQuestions.length,
      result: selectForYouQuestions({
        exam,
        pool: examQuestions,
        weakInsights: weakTopicInsights,
        topicAttempts: attemptRows,
        bankAttempts,
      }),
    };
  }
  const forYou: ForYouResult =
    exam && forYouRef.current?.exam === exam
      ? forYouRef.current.result
      : { questions: [], personalized: false };

  /* Server-side browse structure: subjects + top chapters with FULL-bank
   * question counts (not just the loaded pool window). */
  const structure = usePracticeStructure(exam);
  const subjects = useMemo(() => structure.subjects.map((s) => s.subject), [structure.subjects]);
  const activeSubjectInfo = useMemo(
    () => (subject ? structure.subjects.find((s) => s.subject === subject) ?? null : null),
    [structure.subjects, subject],
  );
  const chapterAccuracy = useMemo(() => chapterAccuracyFromAttempts(bankAttempts), [bankAttempts]);

  const activeList = runner === 'forYou' ? forYou.questions : browseRun?.entries ?? [];
  const activeEntry = activeList[Math.min(index, Math.max(0, activeList.length - 1))] ?? null;

  /* Every SHOWN recommendation lands in the explainability log with its
   * reason — the same log the daily planner and coach write to. */
  useEffect(() => {
    if (runner === 'forYou' && activeEntry && forYou.reasonById[activeEntry.id]) {
      logQuestionRecommendation(activeEntry, forYou.reasonById[activeEntry.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, activeEntry?.id]);

  /* Session-scoped wrong counters per chapter → Vicharree's nudge at 3. */
  const wrongByChapter = useRef(new Map<string, number>());
  const nudgedChapters = useRef(new Set<string>());

  const handleAnswered = (entry: QuestionBankEntry, letter: QuestionOptionLetter, seconds: number) => {
    const isCorrect = letter === entry.correct_option;

    /* 1 — the attempt log (this feature's own table). The card has already
     * shown the result, so the write is optimistic; a FAILED write is said
     * out loud, because a silently-lost attempt quietly corrupts the "For
     * you" ranking and every accuracy badge on this screen. */
    void recordQuestionAttempt(entry, letter, seconds)
      .then(() => attemptsQ.refresh())
      .catch((error) => {
        console.warn('[practice] attempt save failed', error);
        showToast("That answer didn't save — your accuracy stats may be missing it.");
      });

    /* 2 — the adaptation engine, when the chapter maps onto the student's
     * active syllabus (moves the SAME mastery/weakness signals the rest of
     * the app reads). Fire-and-forget; a fuzzy non-match is simply skipped. */
    if (activeSyllabusExam && profileBankExam === entry.exam) {
      const located = matchTaskToChapter(activeSyllabusExam, entry.subject, entry.chapter);
      if (located) {
        void recordTestResult(
          activeSyllabusExam.id,
          topicIdFor(located.chapterId, entry.chapter),
          isCorrect,
          null,
          { topicName: entry.chapter },
        ).catch(() => undefined);
      }
    }

    /* 3 — three wrong answers in one chapter this session → Vicharree. */
    if (!isCorrect) {
      const count = (wrongByChapter.current.get(entry.chapter) ?? 0) + 1;
      wrongByChapter.current.set(entry.chapter, count);
      if (count >= 3 && !nudgedChapters.current.has(entry.chapter)) {
        nudgedChapters.current.add(entry.chapter);
        vicharreeSay('This topic is tricky for you! I\u2019ve flagged it for extra revision \uD83D\uDCCC');
      }
    }
  };

  /* Unanswered/missed first; already-correct at the end (computed once per
   * fetched page so the order holds steady while answering). */
  const orderUnansweredFirst = (rows: QuestionBankEntry[]): QuestionBankEntry[] => {
    const correctIds = new Set(bankAttempts.filter((row) => row.is_correct).map((row) => row.question_id));
    return [...rows.filter((r) => !correctIds.has(r.id)), ...rows.filter((r) => correctIds.has(r.id))];
  };

  /* Open (or toggle closed) a browse runner for a chapter or whole subject.
   * Questions arrive from the server one page at a time — never everything. */
  const startBrowseRunner = (subj: string | null, chapter: string | null) => {
    if (!exam) return;
    if (browseRun && browseRun.subject === subj && browseRun.chapter === chapter && runner === 'browse') {
      setBrowseRun(null);
      setRunner('forYou');
      setIndex(0);
      return;
    }
    setRunner('browse');
    setIndex(0);
    setBrowseRun({ subject: subj, chapter, entries: [], total: 0, loading: true, error: false });
    void fetchQuestionPage(exam, { subject: subj, chapter, offset: 0 })
      .then(({ entries, total }) => {
        setBrowseRun((current) =>
          current && current.subject === subj && current.chapter === chapter
            ? { ...current, entries: orderUnansweredFirst(entries), total, loading: false, error: false }
            : current,
        );
      })
      .catch(() => {
        setBrowseRun((current) =>
          current && current.subject === subj && current.chapter === chapter
            ? { ...current, loading: false, error: true }
            : current,
        );
      });
  };

  /* Append the next page to the open browse runner. */
  const loadMoreBrowse = () => {
    if (!exam || !browseRun || browseRun.loading || browseRun.entries.length >= browseRun.total) return;
    const { subject: subj, chapter } = browseRun;
    setBrowseRun({ ...browseRun, loading: true, error: false });
    void fetchQuestionPage(exam, { subject: subj, chapter, offset: browseRun.entries.length })
      .then(({ entries }) => {
        setBrowseRun((current) =>
          current && current.subject === subj && current.chapter === chapter
            ? { ...current, entries: [...current.entries, ...entries], loading: false, error: false }
            : current,
        );
      })
      .catch(() => {
        setBrowseRun((current) => (current ? { ...current, loading: false, error: true } : current));
      });
  };

  const retryBrowse = () => {
    if (!exam || !browseRun) return;
    const { subject: subj, chapter } = browseRun;
    setBrowseRun({ ...browseRun, entries: [], loading: true, error: false });
    void fetchQuestionPage(exam, { subject: subj, chapter, offset: 0 })
      .then(({ entries, total }) => {
        setBrowseRun((current) =>
          current && current.subject === subj && current.chapter === chapter
            ? { ...current, entries: orderUnansweredFirst(entries), total, loading: false, error: false }
            : current,
        );
      })
      .catch(() => {
        setBrowseRun((current) => (current ? { ...current, loading: false, error: true } : current));
      });
  };

  /* A Vicharree deep link opens its chapter once the exam + structure are
   * known (the structure tells us which subject owns the chapter, so the
   * right accordion row opens). */
  useEffect(() => {
    if (!exam || !pendingChapterLink || structure.loading) return;
    const wanted = chapterKey(pendingChapterLink.chapter);
    const owner =
      pendingChapterLink.subject ??
      structure.subjects.find((s) => s.chapters.some((c) => chapterKey(c.name) === wanted))?.subject ??
      null;
    if (owner) setSubject(owner);
    startBrowseRunner(owner, pendingChapterLink.chapter);
    setPendingChapterLink(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, pendingChapterLink, structure.loading]);

  /* No bank mapping for this student's exam yet — say so honestly. The tab
   * is locked to their exam, so there is no "practise another exam" picker;
   * the exam itself changes in Profile. */
  if (!exam) {
    const chosenLabel = profile?.exam ? savedExamLabel || examLabelFromId(profile.exam) : null;
    return (
      <div className="flex-1 min-h-0 overflow-y-auto w-full lg:max-w-[1000px] lg:mx-auto">
        <div className="px-4 pt-5 vicharak-screen-pad">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('dashboard')}
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 touch-manipulation"
              style={{ borderRadius: RADIUS.md, border: `1px solid ${RULE}`, background: SHEET, color: INK_SOFT }}
              aria-label="Back to Progress"
              data-testid="practice-back-progress"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Brain className="w-5 h-5" style={{ color: BRAND }} />
            <h1 className="text-lg font-extrabold" style={{ color: INK }}>
              Practice
            </h1>
          </div>
          <Card className="mt-4 p-4" testId="practice-no-exam">
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: INK }}>
              {chosenLabel
                ? `The ${chosenLabel} question bank is on its way`
                : 'Pick your exam to unlock practice questions'}
            </p>
            <p className="mt-1 leading-relaxed" style={{ fontSize: '0.83rem', color: INK_SOFT }}>
              {chosenLabel
                ? 'Practice is locked to the exam you are preparing for, and real questions for it have not landed in the bank yet — more are added regularly. Your exam can be changed any time from Profile.'
                : 'Choose the exam you are preparing for in Profile and this tab fills with real questions for it.'}
            </p>
            <button
              type="button"
              onClick={() => setTab('profile')}
              className="vicharak-btn vicharak-btn-primary mt-3"
              data-testid="practice-change-exam-empty"
            >
              {chosenLabel ? 'Review my exam in Profile' : 'Choose my exam'}
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto w-full lg:max-w-[1000px] lg:mx-auto">
      <div className="px-4 pt-5 vicharak-screen-pad">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('dashboard')}
            className="w-11 h-11 flex items-center justify-center flex-shrink-0 touch-manipulation"
            style={{ borderRadius: RADIUS.md, border: `1px solid ${RULE}`, background: SHEET, color: INK_SOFT }}
            aria-label="Back to Progress"
            data-testid="practice-back-progress"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Brain className="w-5 h-5" style={{ color: BRAND }} />
          <h1 className="text-lg font-extrabold" style={{ color: INK }}>
            Practice
          </h1>
        </div>
        <p className="mt-0.5" style={{ fontSize: '0.8rem', color: INK_SOFT }}>
          Real questions from official past papers and open exam datasets — every card names its source.
        </p>

        {/* The exam being practised — locked to the student's own exam (it
            changes in Profile, never here). Only THIS exam's questions appear. */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className="px-2.5 py-1"
            style={{ borderRadius: RADIUS.chip, background: tint(BRAND, 0.12), color: BRAND, fontSize: '0.78rem', fontWeight: 800 }}
            data-testid="practice-active-exam"
          >
            {QUESTION_BANK_EXAM_LABELS[exam]}
          </span>
        </div>

        {/* Subject filter — only when the exam actually spans subjects */}
        {subjects.length > 1 && (
          <div className="mt-2 flex items-center gap-2 overflow-x-auto vicharak-scroll-x pb-1">
            <Chip selected={subject === null} onClick={() => setSubject(null)}>
              All subjects
            </Chip>
            {subjects.map((name) => (
              <Chip key={name} selected={subject === name} onClick={() => setSubject(name)}>
                {name}
              </Chip>
            ))}
          </div>
        )}

        {/* Recommended for you — the intelligence layer serves one question
            at a time, each carrying the reason it was picked. */}
        <div className="mt-5">
          <SectionLabel icon={<Sparkles className="w-4 h-4" style={{ color: BRAND }} />}>
            Recommended for you
          </SectionLabel>
          <p className="-mt-1.5 mb-2.5" style={{ fontSize: '0.75rem', color: PENCIL }}>
            {forYou.personalized
              ? 'One question at a time, picked from your weakest topics — clear these and the list moves on.'
              : 'A starter mix from your exam. Answer a few and these picks tune to your weak spots.'}
          </p>
          {runner === 'forYou' && activeEntry ? (
            <>
              {forYou.reasonById[activeEntry.id] && (
                <p
                  className="mb-2 flex items-center gap-1.5"
                  style={{ fontSize: '0.76rem', fontWeight: 600, color: BRAND }}
                  data-testid="practice-reason"
                >
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                  {forYou.reasonById[activeEntry.id]}
                </p>
              )}
              <QuestionCard
                entry={activeEntry}
                position={index + 1}
                total={activeList.length}
                onAnswered={(letter, seconds) => handleAnswered(activeEntry, letter, seconds)}
                onNext={() => setIndex((i) => Math.min(i + 1, activeList.length - 1))}
                hasNext={index < activeList.length - 1}
                onRestart={() => setIndex(0)}
              />
            </>
          ) : runner === 'forYou' ? (
            pool.loading ? (
              <EmptyLine testId="practice-foryou-loading">Loading the question bank…</EmptyLine>
            ) : (
              <EmptyLine testId="practice-foryou-empty">No questions for this exam yet — more questions are added regularly.</EmptyLine>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
                setRunner('forYou');
                setIndex(0);
              }}
              className="vicharak-btn vicharak-btn-ghost"
              data-testid="practice-back-foryou"
            >
              <Sparkles className="w-4 h-4" />
              Back to recommendations
            </button>
          )}
        </div>

        {/* A deep-linked chapter whose subject could not be resolved still
            gets a visible runner here (never an invisible one). */}
        {runner === 'browse' && browseRun && browseRun.subject === null && (
          <div className="mt-6">
            <SectionLabel icon={<BookOpen className="w-4 h-4" style={{ color: INK_SOFT }} />}>
              {browseRun.chapter ?? 'Practice'}
            </SectionLabel>
            {browseRun.error ? (
              <div className="px-3 py-3" style={{ borderRadius: RADIUS.md, border: `1px solid ${RULE}`, background: SHEET }} role="alert">
                <EmptyLine>Those questions couldn't load just now. Check your connection and try again.</EmptyLine>
                <button type="button" onClick={retryBrowse} className="vicharak-btn vicharak-btn-ghost mt-2">Try again</button>
              </div>
            ) : browseRun.loading && browseRun.entries.length === 0 ? (
              <EmptyLine>Loading questions…</EmptyLine>
            ) : activeEntry ? (
              <QuestionCard
                entry={activeEntry}
                position={index + 1}
                total={browseRun.total || activeList.length}
                onAnswered={(letter, seconds) => handleAnswered(activeEntry, letter, seconds)}
                onNext={() => setIndex((i) => Math.min(i + 1, activeList.length - 1))}
                hasNext={index < activeList.length - 1}
                onRestart={() => setIndex(0)}
              />
            ) : (
              <EmptyLine>No questions found for this chapter yet.</EmptyLine>
            )}
          </div>
        )}

        {/* Browse — subject first, then chapters, loaded in small pages */}
        <div className="mt-6">
          <SectionLabel icon={<BookOpen className="w-4 h-4" style={{ color: INK_SOFT }} />}>
            {subject ? `${subject} — practice by chapter` : 'Browse by subject'}
          </SectionLabel>
          <div className="vicharak-panel">
            <div className="vicharak-rows">
              {!subject &&
                structure.subjects.map((info) => (
                  <button
                    key={info.subject}
                    type="button"
                    onClick={() => setSubject(info.subject)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left touch-manipulation"
                    style={{ minHeight: 48 }}
                    data-testid={`practice-subject-${info.subject}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: '0.88rem', fontWeight: 600, color: INK }}>
                        {info.subject}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: PENCIL }}>
                        {info.questionCount} question{info.questionCount === 1 ? '' : 's'}
                        {info.totalChapters > 1 ? ` · ${info.totalChapters} chapters` : ''}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: INK_SOFT }} />
                  </button>
                ))}
              {!subject && structure.subjects.length === 0 && (
                <div className="px-3.5 py-4">
                  <EmptyLine>{structure.loading ? 'Loading subjects…' : 'No subjects for this exam yet.'}</EmptyLine>
                </div>
              )}

              {subject && activeSubjectInfo && (
                <>
                  {[
                    {
                      name: null as string | null,
                      label: `All ${activeSubjectInfo.subject} questions`,
                      count: activeSubjectInfo.questionCount,
                    },
                    ...activeSubjectInfo.chapters.map((c) => ({
                      name: c.name as string | null,
                      label: c.name,
                      count: c.questionCount,
                    })),
                  ].map((row) => {
                    const stats = row.name ? chapterAccuracy.get(chapterKey(row.name)) : undefined;
                    const isOpen =
                      runner === 'browse' &&
                      browseRun !== null &&
                      browseRun.subject === activeSubjectInfo.subject &&
                      browseRun.chapter === row.name;
                    return (
                      <div key={row.label}>
                        <button
                          type="button"
                          onClick={() => startBrowseRunner(activeSubjectInfo.subject, row.name)}
                          className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left touch-manipulation"
                          style={{ minHeight: 48 }}
                          aria-expanded={isOpen}
                          data-testid={`practice-chapter-${row.label}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate" style={{ fontSize: '0.88rem', fontWeight: 600, color: INK }}>
                              {row.label}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: PENCIL }}>
                              {row.count} question{row.count === 1 ? '' : 's'}
                              {stats && stats.total > 0 ? ` · ${stats.accuracy}% right so far` : ''}
                            </span>
                          </span>
                          {stats && stats.total > 0 && (
                            <span
                              className="flex-shrink-0 px-2 py-0.5"
                              style={{
                                borderRadius: RADIUS.chip,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: stats.accuracy < 60 ? GONE : KEPT,
                                background: tint(stats.accuracy < 60 ? GONE : KEPT, 0.1),
                              }}
                            >
                              {stats.accuracy}%
                            </span>
                          )}
                          <ChevronDown
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: INK_SOFT, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3">
                            {browseRun.error ? (
                              <div className="px-2 py-2" role="alert">
                                <EmptyLine>Those questions couldn't load just now. Check your connection and try again.</EmptyLine>
                                <button type="button" onClick={retryBrowse} className="vicharak-btn vicharak-btn-ghost mt-2">Try again</button>
                              </div>
                            ) : browseRun.loading && browseRun.entries.length === 0 ? (
                              <EmptyLine>Loading questions…</EmptyLine>
                            ) : activeEntry ? (
                              <>
                                <QuestionCard
                                  entry={activeEntry}
                                  position={index + 1}
                                  total={browseRun.total || activeList.length}
                                  onAnswered={(letter, seconds) => handleAnswered(activeEntry, letter, seconds)}
                                  onNext={() => setIndex((i) => Math.min(i + 1, activeList.length - 1))}
                                  hasNext={index < activeList.length - 1}
                                  onRestart={() => setIndex(0)}
                                />
                                {browseRun.entries.length < browseRun.total && index >= activeList.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={loadMoreBrowse}
                                    className="vicharak-btn vicharak-btn-ghost mt-2"
                                    disabled={browseRun.loading}
                                    data-testid="practice-load-more"
                                  >
                                    {browseRun.loading
                                      ? 'Loading…'
                                      : `Load ${Math.min(CHAPTER_PAGE_SIZE, browseRun.total - browseRun.entries.length)} more`}
                                  </button>
                                )}
                              </>
                            ) : (
                              <EmptyLine>No questions in this chapter yet.</EmptyLine>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {activeSubjectInfo.totalChapters > activeSubjectInfo.chapters.length && (
                    <p className="px-3.5 py-2.5" style={{ fontSize: '0.72rem', color: PENCIL }}>
                      Showing the {activeSubjectInfo.chapters.length} biggest chapters — “All {activeSubjectInfo.subject} questions” covers every one of the {activeSubjectInfo.totalChapters}.
                    </p>
                  )}
                </>
              )}
              {subject && !activeSubjectInfo && (
                <div className="px-3.5 py-4">
                  <EmptyLine>{structure.loading ? 'Loading chapters…' : 'No chapters for this subject yet.'}</EmptyLine>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2.5" style={{ fontSize: '0.72rem', color: PENCIL }}>
            Sources: officially released papers (NTA, UPSC) plus open question datasets (MedMCQA, MMLU, MedQA). Each
            card names the exact paper or dataset it came from.
          </p>
        </div>
      </div>
    </div>
  );
}
