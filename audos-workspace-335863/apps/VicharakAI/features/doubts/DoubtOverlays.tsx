/**
 * DoubtOverlays — the question-capture sheet and the tapped saved-question
 * card (the FSRS review card).
 *
 * THE CARD. The review card is the one DARK surface in the app: a deep-navy
 * sheet floating over the dimmed page with two sheets peeking out behind it,
 * so the queue reads as a deck. Question, options, review answer and clock
 * all live on that single card — nothing opens on top of it. The clock and
 * its pace-mode chips sit at the FOOT of the card (a quiet strip just above
 * the pace bar), so the question — not the timer — leads the screen.
 *
 * GRADING. The card offers three responses — Again · Got it · Explain. Again
 * and Got it run the real scheduler (revisionEngine.fsrsReview, reached
 * through doubts.gradeFlagged), writing the card's next due date and its new
 * interval back to zuno_question_queue; the projected interval printed under
 * each label is a dry run of that same function, so what the button promises
 * is exactly what it stores. Explain grades nothing — it writes a short
 * explanation onto the card and leaves the answer to the student.
 *
 * TIMING. A silent countdown still runs from the moment the card opens, in
 * one of two modes computed in config/examTiming.ts:
 *
 *   A · Question pace — the question's own expected length (read off its
 *       tagged difficulty) plus a 3-minute thinking buffer.
 *   B · Exam pace — the real per-question budget of the student's exam
 *       (NEET ≈ 72s, JEE ≈ 3 min, UPSC Prelims ≈ 72s) plus a 2-minute buffer.
 *
 * The timer is now a SAFETY NET rather than the grader: it only grades a card
 * the student walked away from without answering or revealing. Once they
 * engage, the chips are what commit the review, and the elapsed time merely
 * suggests one of them.
 *
 * On a revision visit they can also practice an AI-generated PYQ on the SAME
 * concept — never the same question again.
 */
/* eslint-disable */
import { useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw, Sparkles, Timer, X } from 'lucide-react';
import {
  AMBER, BORDER, BORDER_STRONG, BRAND_GRADIENT, CARD, DANGER, FSRS_AGAIN, FSRS_EASY, FSRS_GOOD,
  FSRS_HARD, NAVY_ALT, ON_AMBER, OVERLAY_BG, RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, tint,
} from '../../theme';
import { FlagCaptureSheet } from '../../FlaggedQuestions';
import { flaggedConceptLabel, flaggedOptions, flaggedReviseCount, formatCountdown, MCQ_LETTERS, type McqLetter } from '../../mcq';
import {
  DOUBT_GRADES,
  DOUBT_GRADE_LABELS,
  DOUBT_GRADE_TO_FSRS,
  doubtGradeFromSeconds,
  type DoubtGrade,
} from '../../config/sharedConfig';
import { fsrsReview } from '../../revisionEngine';
import { AGAIN_REQUEUE_MINUTES } from '../../config/revision';
import { parseFsrsState } from '../../fsrsTypes';
import { examPace, examPaceLimit, formatPaceShort, questionPaceLimit } from '../../config/examTiming';
import { extractJsonObject } from '../../customExam';
import { AI_MODELS, OPENAI_PROXY_URL } from '../../config/models';
import { aiProxyHeaders } from '../../shared/platformAuth';
import { useApp } from '../../app/AppContext';
import { buildTagCatalog } from './autoTag';
import MistakeCaptureSheet from './MistakeCaptureSheet';

/** The FSRS response scale, in its standard order and standard colours. */
const FSRS_GRADE_COLORS: Record<DoubtGrade, string> = {
  again: FSRS_AGAIN,
  hard: FSRS_HARD,
  good: FSRS_GOOD,
  easy: FSRS_EASY,
};

/* ------------------------------------------------------------------ */
/*  The deck — the one dark surface in the app                         */
/* ------------------------------------------------------------------ */

/**
 * The Mistake Book's review card is deliberately the opposite of Today: a
 * deep-navy card floating over a dimmed page, with two sheets peeking out
 * behind it so the queue reads as a DECK. Everything the student needs while
 * solving — the question, the options, the review answer and the clock —
 * lives on that one card. Nothing opens a popup on top of it.
 */
const DECK_TEXT = '#F4F6FF';
const DECK_MUTED = '#9AA2C4';
const DECK_GREEN = '#2FB673';
const DECK_RED = '#E24A3A';

const DECK_CSS = `
.vk-deck { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.vk-deck * { font-family: inherit; }
.vk-deck-sheet { position: absolute; border-radius: 16px; height: 44px; background: #232744; border: 1px solid rgba(255,255,255,0.07); }
.vk-deck-sheet-1 { top: -9px; left: 14px; right: 14px; opacity: 0.9; }
.vk-deck-sheet-2 { top: -18px; left: 30px; right: 30px; opacity: 0.55; }
.vk-deck-card { position: relative; display: flex; flex-direction: column; max-height: 88vh; overflow: hidden; background: #1A1A2E; border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; box-shadow: 0 28px 70px rgba(6,8,24,0.55); animation: vkDeckIn 0.34s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes vkDeckIn { from { opacity: 0; transform: translateY(16px) scale(0.972); } to { opacity: 1; transform: none; } }
.vk-deck-head { flex-shrink: 0; padding: 14px 18px 0; }
.vk-deck-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: rgba(0,87,255,0.18); border: 1px solid rgba(0,87,255,0.45); color: #8FB0FF; font-size: 11px; font-weight: 700; }
.vk-deck-clock { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; color: #9AA2C4; }
.vk-deck-clock-urgent { color: #FF8E7E; }
.vk-deck-icon { width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); color: #C6CCE8; flex-shrink: 0; transition: background-color 0.18s ease; }
.vk-deck-icon:hover { background: rgba(255,255,255,0.17); }
.vk-deck-pace { padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); background: transparent; color: #7F88AC; font-size: 10px; font-weight: 600; }
.vk-deck-pace-on { border-color: rgba(0,87,255,0.5); background: rgba(0,87,255,0.14); color: #8FB0FF; }
.vk-deck-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 18px 16px; }
.vk-deck-question { color: #F4F6FF; font-size: 17px; line-height: 1.45; font-weight: 600; white-space: pre-wrap; }
.vk-deck-option { width: 100%; display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.12); color: #D6DAF0; text-align: left; font-size: 14px; font-weight: 500; line-height: 1.4; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.14s ease; }
.vk-deck-option:not(:disabled):hover { border-color: rgba(0,87,255,0.55); background: rgba(0,87,255,0.10); }
.vk-deck-option:not(:disabled):active { transform: scale(0.99); }
.vk-deck-option-on { background: #0057FF; border-color: #0057FF; color: #FFFFFF; }
.vk-deck-option-right { background: rgba(47,182,115,0.16); border-color: rgba(47,182,115,0.7); color: #E6FFF2; }
.vk-deck-option-wrong { background: rgba(226,74,58,0.18); border-color: rgba(226,74,58,0.7); color: #FFE7E3; }
.vk-deck-letter { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.10); color: #B9C0DE; }
.vk-deck-option-on .vk-deck-letter { background: rgba(255,255,255,0.24); color: #FFFFFF; }
.vk-deck-option-right .vk-deck-letter { background: #2FB673; color: #FFFFFF; }
.vk-deck-option-wrong .vk-deck-letter { background: #E24A3A; color: #FFFFFF; }
.vk-deck-panel { border-radius: 12px; padding: 12px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #D6DAF0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; }
.vk-deck-ghost { width: 100%; min-height: 44px; border-radius: 12px; border: 1px dashed rgba(255,255,255,0.24); background: rgba(255,255,255,0.04); color: #C6CCE8; font-size: 13px; font-weight: 600; transition: background-color 0.16s ease, border-color 0.16s ease; }
.vk-deck-ghost:not(:disabled):hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.4); }
.vk-deck-actions { flex-shrink: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 0 18px; }
.vk-deck-act { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 50px; border-radius: 12px; border: 1px solid transparent; font-size: 13px; font-weight: 700; transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.12s ease; }
.vk-deck-act:active { transform: scale(0.97); }
.vk-deck-act:disabled { opacity: 0.5; }
.vk-deck-act-when { font-size: 10px; font-weight: 600; opacity: 0.75; font-variant-numeric: tabular-nums; }
.vk-deck-again { background: rgba(226,74,58,0.14); border-color: rgba(226,74,58,0.5); color: #FF9182; }
.vk-deck-again:not(:disabled):hover { background: rgba(226,74,58,0.26); }
.vk-deck-got { background: #0057FF; border-color: #0057FF; color: #FFFFFF; }
.vk-deck-got:not(:disabled):hover { background: #0046CC; }
.vk-deck-explainbtn { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.16); color: #D6DAF0; }
.vk-deck-explainbtn:not(:disabled):hover { background: rgba(255,255,255,0.13); }
.vk-deck-act-suggested { box-shadow: 0 0 0 2px rgba(255,255,255,0.28); }
.vk-deck-hint { flex-shrink: 0; padding: 8px 18px 12px; text-align: center; font-size: 10px; line-height: 1.4; color: #7F88AC; }
.vk-deck-foot { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 0 18px 10px; }
.vk-deck-timer { flex-shrink: 0; height: 4px; background: rgba(255,255,255,0.08); }
.vk-deck-timer > span { display: block; height: 100%; background: #0057FF; border-radius: 0 999px 999px 0; transition: width 1s linear; }
.vk-deck-timer-urgent > span { background: #E24A3A; }
.vk-deck-body::-webkit-scrollbar { width: 6px; }
.vk-deck-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; }
`;

export default function DoubtOverlays() {
  const { data, toast, access: accessCtl, doubts, tests, tab, setTab } = useApp();
  const access = accessCtl.access;
  const { spaceId, today, profile, examDef, savedExamLabel, quickAddSubjects } = data;
  const { showToast } = toast;
  const { chargeAi } = accessCtl;
  /* The moved JSX reads `access.canAskAi` — the AiAccess verdict. */
  const accessFeature = access;
  void accessFeature;
  const {
    flagOpen, setFlagOpen, savingFlag, saveFlagged, flaggedDetail, setFlaggedDetail,
    savingFlaggedDetail, gradeFlagged, gradeFlaggedByTime, mistakeUpload, closeMistakeUpload,
    resolveTarget, setResolveTarget, resolveDoubt, updateDoubt,
  } = doubts;
  /* [Resolve flow] The resolve sheet's own draft state. */
  const [resolveAnswer, setResolveAnswer] = useState('');
  const [resolveLink, setResolveLink] = useState('');
  const [savingResolve, setSavingResolve] = useState(false);
  /* [Review] Photo cards with a written answer show the PHOTO ONLY first —
   * tapping reveals the student's own answer for self-check, then grades. */
  const [answerRevealed, setAnswerRevealed] = useState(false);
  /* [Explain] The third review button writes a short explanation straight
   * onto the card — it never grades, and it never opens anything. */
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);
  const { openPaywall } = accessCtl;
  const { setLightboxUrl } = tests;
  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];

  /* [Back → Today] Leaving the question-solving card must land on Today —
   * never back on the AI chat screen it may have been opened over. */
  const backToToday = () => {
    if (tab === 'coach') setTab('today');
  };
  const closeDetail = () => {
    setFlaggedDetail(null);
    backToToday();
  };
  /** An Again/Hard/Good/Easy chip — grade, then land the student on Today. */
  const gradeChipAndReturn = async (row: NonNullable<typeof flaggedDetail>, grade: DoubtGrade) => {
    await gradeFlagged(row, grade);
    backToToday();
  };
  /** The timer's own fallback grade for a card nobody answered. */
  const gradeAndReturn = async (row: NonNullable<typeof flaggedDetail>, seconds: number) => {
    await gradeFlaggedByTime(row, seconds);
    backToToday();
  };

  /* ---------- silent doubt timer (the grading safety net) ---------- */
  /* Per-session timer mode: 'question' = the question's own length + 3 min
     buffer; 'exam' = the exam's standard per-question budget + 2 min. */
  const [timerMode, setTimerMode] = useState<'question' | 'exam'>('exam');
  /* [Feature 4] MCQ doubts: the picked A/B/C/D letter (null = not answered).
     Picking an option reveals right/wrong; the FSRS chips below commit it. */
  const [picked, setPicked] = useState<McqLetter | null>(null);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [, setNowTick] = useState(0);
  const [expired, setExpired] = useState(false);
  /* Next-day PYQ practice on the same concept. */
  const [pyq, setPyq] = useState<{ question: string; answer: string } | null>(null);
  const [pyqLoading, setPyqLoading] = useState(false);
  const [pyqRevealed, setPyqRevealed] = useState(false);

  /* A fresh resolve sheet per entry — the draft never leaks across cards. */
  useEffect(() => {
    setResolveAnswer('');
    setResolveLink('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveTarget?.id]);

  const submitResolve = async () => {
    if (!resolveTarget || savingResolve || !(resolveAnswer ?? '').trim()) return;
    setSavingResolve(true);
    try {
      await resolveDoubt(resolveTarget, resolveAnswer, resolveLink);
    } finally {
      setSavingResolve(false);
    }
  };

  /* The countdown starts automatically the moment a doubt card opens. */
  useEffect(() => {
    if (!flaggedDetail) {
      setOpenedAt(null);
      setExpired(false);
      setPicked(null);
      setPyq(null);
      setPyqRevealed(false);
      setExplainOpen(false);
      setExplainText('');
      return;
    }
    setOpenedAt(Date.now());
    setExpired(false);
    setPicked(null);
    setPyq(null);
    setPyqRevealed(false);
    setAnswerRevealed(false);
    setExplainOpen(false);
    setExplainText('');
    const tick = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedDetail?.id]);

  /* Both budgets come from the ONE pacing config — never hardcoded here. */
  const examLabelForPace = examDef?.name ?? savedExamLabel ?? null;
  const examPacing = examPace(profile?.exam ?? null, examLabelForPace);
  const questionLimit = questionPaceLimit(flaggedDetail?.difficulty ?? null);
  const examLimit = examPaceLimit(profile?.exam ?? null, examLabelForPace);
  const limitSeconds = timerMode === 'question' ? questionLimit : examLimit;
  const elapsedSeconds = openedAt ? Math.floor((Date.now() - openedAt) / 1000) : 0;
  const remainingSeconds = Math.max(0, limitSeconds - elapsedSeconds);

  /* [Feature 4] Option-based answering for MCQ doubts (auto-queued wrong
     quiz questions and photo doubts whose options were extracted). */
  const doubtOptions = flaggedDetail ? flaggedOptions(flaggedDetail) : null;
  const doubtCorrectLetter = (() => {
    const letter = String(flaggedDetail?.correct ?? '').trim().toUpperCase().charAt(0);
    return (MCQ_LETTERS as string[]).includes(letter) ? (letter as McqLetter) : null;
  })();
  const isMcqDoubt = !!doubtOptions && !!doubtCorrectLetter;

  /* The student has engaged with the card — they answered the MCQ or revealed
     their own written answer. From here the chips do the grading, so the
     countdown must stop auto-closing the card under them. */
  const engaged = picked !== null || answerRevealed;

  const pickOption = (letter: McqLetter) => {
    if (!flaggedDetail || picked !== null || savingFlaggedDetail || expired) return;
    setPicked(letter);
  };

  /* Timer ran out on a card nobody touched → the implicit grade is Again: the
     doubt lapses into relearning and resurfaces on the FSRS schedule. Once
     the student has engaged, only their own chip writes anything. */
  useEffect(() => {
    if (!flaggedDetail || expired || savingFlaggedDetail || engaged) return;
    if (remainingSeconds > 0) return;
    setExpired(true);
    void gradeAndReturn(flaggedDetail, limitSeconds + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, flaggedDetail, expired, savingFlaggedDetail, engaged]);

  /* ---------- the four FSRS response chips ---------- */
  /* Each chip's projected interval is a DRY RUN of the very write it will
     perform: the same fsrsReview() call, against the card's stored memory
     state, that gradeFlagged persists. No interval arithmetic lives here. */
  const priorFsrs = flaggedDetail ? parseFsrsState(flaggedDetail.fsrs_json) : null;
  /* Again is a same-SESSION re-queue (~10 minutes), so its chip prints
     minutes; Hard/Good/Easy print their day rung (1 / 4 / 14 to begin with,
     then whatever FSRS grows them to). */
  const gradeChips = DOUBT_GRADES.map((grade) => {
    const preview = flaggedDetail ? fsrsReview(priorFsrs, DOUBT_GRADE_TO_FSRS[grade], today) : null;
    const sameSession = preview?.sameSessionRequeue === true;
    const minutes = preview?.intervalMinutes ?? AGAIN_REQUEUE_MINUTES;
    const days = preview?.intervalDays ?? 1;
    return {
      grade,
      label: DOUBT_GRADE_LABELS[grade],
      color: FSRS_GRADE_COLORS[grade],
      whenShort: sameSession ? `${minutes}m` : `${days}d`,
      whenLong: sameSession
        ? `about ${minutes} minutes, in this session`
        : `${days} day${days === 1 ? '' : 's'}`,
    };
  });
  /* After an MCQ answer the card knows what it would have graded itself — a
     wrong pick is a lapse, a right one follows the clock. It only RINGS the
     matching chip; the student's tap is still what writes. */
  const suggestedGrade: DoubtGrade | null =
    picked === null ? null : picked === doubtCorrectLetter ? doubtGradeFromSeconds(elapsedSeconds) : 'again';
  /* The two responses the card offers — Again (it lapsed) and Got it (it
     came back). Both still run the one FSRS scheduler. */
  const againChip = gradeChips.find((chip) => chip.grade === 'again');
  const goodChip = gradeChips.find((chip) => chip.grade === 'good');
  /* What is left of the pace budget — drawn as the slim bar at the foot. */
  const timerPercent = Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, limitSeconds)) * 100));

  /* A revision visit (not the day the doubt was saved) offers a fresh
     PYQ-style question on the SAME concept — never the saved question. */
  const isRevisionVisit = Boolean(
    flaggedDetail && (flaggedReviseCount(flaggedDetail) > 0 || flaggedDetail.last_revised_on || flaggedDetail.created_on < today),
  );

  /**
   * Explain — the third review button. A short, plain-prose explanation of
   * the concept the question tests, written onto the card itself. It grades
   * nothing: the student still answers Again or Got it afterwards.
   */
  const explainQuestion = async () => {
    if (!flaggedDetail) return;
    if (explainOpen) {
      setExplainOpen(false);
      return;
    }
    setExplainOpen(true);
    if (explainText || explainLoading) return;
    /* An explanation saved on a previous visit shows instantly — free. */
    const stored = String(flaggedDetail.ai_explanation ?? '').trim();
    if (stored) {
      setExplainText(stored);
      return;
    }
    if (!access.canAskAi) {
      openPaywall('chat');
      setExplainOpen(false);
      return;
    }
    setExplainLoading(true);
    try {
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          model: AI_MODELS.standard,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content:
                'You explain exam questions to Indian competitive-exam aspirants. Reply in PLAIN PROSE only — no ' +
                'markdown, no headings, no bullet characters, no bold. Under 110 words: state the correct answer, ' +
                'the one principle it turns on, and the trap that catches most students.',
            },
            {
              role: 'user',
              content:
                `Concept: ${flaggedConceptLabel(flaggedDetail)}. Subject: ${flaggedDetail.subject || 'this exam'}.\n` +
                `Question: ${flaggedDetail.question_text.slice(0, 900)}` +
                (doubtOptions ? `\nOptions: ${(doubtOptions as string[]).join(' | ')}` : '') +
                (doubtCorrectLetter ? `\nCorrect option: ${doubtCorrectLetter}` : ''),
            },
          ],
          max_completion_tokens: 420,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const text = String(payload.choices?.[0]?.message?.content || '').trim();
      chargeAi();
      setExplainText(text || "Nothing came back this time — check your own notes for this one.");
      /* PERSIST the explanation onto the row — the next Explain is free. */
      if (text) void updateDoubt(flaggedDetail, { ai_explanation: text }).catch(() => undefined);
    } catch {
      setExplainText("That explanation didn't come through — mind tapping Explain once more?");
    } finally {
      setExplainLoading(false);
    }
  };

  const generatePyq = async () => {
    if (!flaggedDetail || pyqLoading) return;
    if (!access.canAskAi) {
      openPaywall('chat');
      return;
    }
    setPyqLoading(true);
    setPyqRevealed(false);
    try {
      const concept = flaggedConceptLabel(flaggedDetail);
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          model: AI_MODELS.standard,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content:
                'You write previous-year-question (PYQ) style practice questions for Indian competitive-exam aspirants. ' +
                'Reply with STRICT JSON only — no prose, no markdown fences: {"question": string, "answer": string}. ' +
                'The answer states the correct result AND a 2–3 line explanation.',
            },
            {
              role: 'user',
              content:
                `Concept: ${concept}. Subject: ${flaggedDetail.subject || 'this exam'}. ` +
                'Write ONE exam-standard PYQ-style question testing this concept. It must NOT repeat the question the student saved: ' +
                `"${flaggedDetail.question_text.slice(0, 300)}" — test the same concept from a different angle.`,
            },
          ],
          max_completion_tokens: 600,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const parsed = extractJsonObject(String(data.choices?.[0]?.message?.content || ''));
      const record = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const question = typeof record.question === 'string' ? (record.question ?? '').trim() : '';
      const answer = typeof record.answer === 'string' ? (record.answer ?? '').trim() : '';
      if (!question) throw new Error('empty');
      chargeAi();
      setPyq({ question, answer: answer || '—' });
    } catch {
      showToast("That practice question didn't generate — mind tapping once more?");
    } finally {
      setPyqLoading(false);
    }
  };

  return (
    <>
      {/* CHANGE 2: no "How did it feel?" sheet — completion is one tap. */}

      {/* Add a question — typed text and/or a photo, saved exactly as entered
          (CHANGE 4: no AI processing on add). */}
      {flagOpen && (
        <FlagCaptureSheet
          subjects={subjectNames.length > 0 ? subjectNames : quickAddSubjects}
          spaceId={spaceId}
          canAskAi={access.canAskAi}
          onAiCharged={chargeAi}
          saving={savingFlag}
          onSave={(draft) => void saveFlagged(draft)}
          onClose={() => setFlagOpen(false)}
        />
      )}

      {/* “Upload Mistake” from a test's score screen — the same camera/gallery
          + on-device OCR capture the Mistake Book tab uses, filed with the
          test it came from. */}
      {mistakeUpload && (
        <MistakeCaptureSheet
          spaceId={spaceId}
          subjects={subjectNames.length > 0 ? subjectNames : quickAddSubjects}
          defaultSubject={mistakeUpload.subject}
          sourceLabel={mistakeUpload.sourceLabel}
          catalog={buildTagCatalog(data.topicPickerSubjects)}
          examLabel={data.topicPickerExamLabel}
          canAskAi={access.canAskAi}
          onAiCharged={chargeAi}
          saving={savingFlag}
          onSave={(draft) => saveFlagged(draft)}
          onClose={closeMistakeUpload}
        />
      )}

      {/* A tapped saved question opens as the deck card: the full question,
          the answer interaction, and the Again / Got it / Explain row. */}
      {/* SOLVING VIEW — deliberately bare: the question, its options and the
          answer interaction. Subject, topic, source and analysis metadata
          stay on the record; they never crowd the solving screen. */}
      {flaggedDetail && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center px-3 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Revise this question"
        >
          <style>{DECK_CSS}</style>
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(8, 10, 24, 0.62)' }}
            onClick={closeDetail}
            aria-label="Close question"
          />
          {/* THE DECK — two sheets peeking out behind the live card, so the
              queue reads as a pile the student is working through. */}
          <div className="vk-deck relative w-full" style={{ maxWidth: 540 }}>
            <span className="vk-deck-sheet vk-deck-sheet-2" aria-hidden="true" />
            <span className="vk-deck-sheet vk-deck-sheet-1" aria-hidden="true" />
            <div key={flaggedDetail.id} className="vk-deck-card" data-testid="card-doubt-deck">
            {/* CHANGE 2 — the head keeps only the badge and Close: the
                session clock and its pace modes moved to the FOOT of the
                card (less dominant, still visible). */}
            <div className="vk-deck-head">
              <div className="flex items-center gap-3">
                <span className="vk-deck-badge" data-testid="text-doubt-card-badge">Q{flaggedDetail.id}</span>
                <span className="flex-1" aria-hidden="true" />
                <button type="button" onClick={closeDetail} aria-label="Close" className="vk-deck-icon touch-manipulation">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="vk-deck-body">
            {flaggedDetail.image_url && (
              <button
                type="button"
                onClick={() => setLightboxUrl(flaggedDetail.image_url ?? null)}
                className="w-full mb-3 touch-manipulation"
                aria-label="Expand question photo"
              >
                <img
                  src={flaggedDetail.image_url}
                  alt="Question"
                  className="max-h-56 mx-auto object-contain"
                  style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: '#0F1120' }}
                  data-testid="img-doubt-card-stack"
                />
              </button>
            )}
            {/* [Resolve flow review] A photo card with a written answer keeps
                its FRONT photo-only — the transcribed text and the student's
                own answer stay hidden until they tap to self-check. */}
            {(flaggedDetail.question_text ?? '').trim() !== '' &&
              !(flaggedDetail.image_url && String(flaggedDetail.solution_text ?? '').trim() && !answerRevealed) && (
              <p className="vk-deck-question" data-testid="text-flagged-detail-question">
                {flaggedDetail.question_text}
              </p>
            )}

            {String(flaggedDetail.solution_text ?? '').trim() !== '' && (
              answerRevealed ? (
                <div className="mt-4 vk-deck-panel vicharak-fade" data-testid="text-flagged-own-answer">
                  <p className="text-[11px] font-bold" style={{ color: DECK_GREEN }}>Your answer</p>
                  <p className="mt-1" style={{ color: DECK_TEXT }}>{String(flaggedDetail.solution_text)}</p>
                  {String(flaggedDetail.resolution_link ?? '').trim() !== '' && (
                    <a
                      href={String(flaggedDetail.resolution_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-[12px] font-semibold underline underline-offset-2"
                      style={{ color: '#8FB0FF' }}
                      data-testid="link-flagged-resolution"
                    >
                      Your saved link
                    </a>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAnswerRevealed(true)}
                  className="mt-4 vk-deck-ghost touch-manipulation"
                  data-testid="button-flagged-reveal-answer"
                >
                  Solve it in your head, then tap to check your answer
                </button>
              )
            )}

            {/* [Feature 4] A/B/C/D options when the doubt is an MCQ — choice
                buttons INSIDE the card, never a popup. Tap one to answer; the
                reveal shows right/wrong and rings the review button it would
                have picked, which the student then confirms. */}
            {isMcqDoubt && (
              <div className="mt-4 space-y-2" data-testid="doubt-options">
                {MCQ_LETTERS.map((letter, letterIndex) => {
                  const isPicked = picked === letter;
                  const isCorrect = doubtCorrectLetter === letter;
                  const revealed = picked !== null;
                  /* Before the answer lands, the tapped option fills brand
                     blue. After it, right reads green and a wrong pick red. */
                  const stateClass = !revealed
                    ? isPicked
                      ? ' vk-deck-option-on'
                      : ''
                    : isCorrect
                      ? ' vk-deck-option-right'
                      : isPicked
                        ? ' vk-deck-option-wrong'
                        : '';
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={picked !== null || savingFlaggedDetail}
                      onClick={() => pickOption(letter)}
                      className={`vk-deck-option${stateClass} touch-manipulation`}
                      data-testid={`doubt-option-${letter}`}
                    >
                      <span className="vk-deck-letter">
                        {revealed && (isCorrect || isPicked)
                          ? isCorrect
                            ? <Check className="w-3.5 h-3.5" />
                            : <X className="w-3.5 h-3.5" />
                          : letter}
                      </span>
                      <span className="pt-0.5">{(doubtOptions as string[])[letterIndex]}</span>
                    </button>
                  );
                })}
                {picked !== null && (
                  <p
                    className="text-[12px] font-semibold text-center vicharak-fade pt-1"
                    style={{ color: picked === doubtCorrectLetter ? DECK_GREEN : DECK_RED }}
                    data-testid="text-doubt-answer-verdict"
                  >
                    {picked === doubtCorrectLetter
                      ? 'Correct — now say how the recall felt.'
                      : `Not quite — Again brings it back in about ${AGAIN_REQUEUE_MINUTES} minutes, this session.`}
                  </p>
                )}
              </div>
            )}

            {/* Explain — written onto the card, never into a popup. */}
            {explainOpen && (
              <div className="mt-4 vk-deck-panel vicharak-fade" data-testid="doubt-explanation">
                {explainLoading ? (
                  <span className="inline-flex items-center gap-2" style={{ color: DECK_MUTED }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Working through it…
                  </span>
                ) : (
                  explainText
                )}
              </div>
            )}

            {/* Next-day practice: a DIFFERENT question on the same concept. */}
            {isRevisionVisit && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px dashed rgba(255,255,255,0.12)' }} data-testid="doubt-pyq-section">
                {!pyq ? (
                  <button
                    type="button"
                    disabled={pyqLoading}
                    onClick={() => void generatePyq()}
                    className="vk-deck-ghost disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
                    data-testid="button-flagged-pyq"
                  >
                    {pyqLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {pyqLoading ? 'Writing a PYQ on this concept…' : 'Practice a PYQ on this concept'}
                  </button>
                ) : (
                  <div className="vicharak-fade">
                    <p className="text-[11px] font-bold" style={{ color: '#8FB0FF' }}>
                      PYQ practice · {flaggedConceptLabel(flaggedDetail)}
                    </p>
                    <p
                      className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: DECK_TEXT }}
                      data-testid="text-flagged-pyq"
                    >
                      {pyq.question}
                    </p>
                    {pyqRevealed ? (
                      <p className="mt-2 vk-deck-panel" data-testid="text-flagged-pyq-answer">
                        {pyq.answer}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPyqRevealed(true)}
                        className="mt-2 vk-deck-ghost touch-manipulation"
                        data-testid="button-flagged-pyq-reveal"
                      >
                        Reveal the answer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            {/* THE review control — Again · Got it · Explain, a prominent row
                at the foot of the card. Again and Got it each write the next
                due date through the one FSRS scheduler; the small number
                under each label is exactly what that tap will schedule.
                Explain grades nothing — it just answers the question. */}
            <div
              className="vk-deck-actions"
              role="group"
              aria-label="How well did you recall this?"
              data-testid="doubt-fsrs-chips"
            >
              <button
                type="button"
                disabled={savingFlaggedDetail}
                onClick={() => void gradeChipAndReturn(flaggedDetail, 'again')}
                aria-label={`Again — next review in ${againChip?.whenLong ?? 'a few minutes'}`}
                className={`vk-deck-act vk-deck-again${suggestedGrade === 'again' ? ' vk-deck-act-suggested' : ''} touch-manipulation`}
                data-testid="button-doubt-grade-again"
              >
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Again
                </span>
                <span className="vk-deck-act-when">{againChip?.whenShort ?? ''}</span>
              </button>
              <button
                type="button"
                disabled={savingFlaggedDetail}
                onClick={() => void gradeChipAndReturn(flaggedDetail, 'good')}
                aria-label={`Got it — next review in ${goodChip?.whenLong ?? 'a few days'}`}
                className={`vk-deck-act vk-deck-got${suggestedGrade !== null && suggestedGrade !== 'again' ? ' vk-deck-act-suggested' : ''} touch-manipulation`}
                data-testid="button-doubt-grade-good"
              >
                <span className="inline-flex items-center gap-1.5">
                  {savingFlaggedDetail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  Got it
                </span>
                <span className="vk-deck-act-when">{goodChip?.whenShort ?? ''}</span>
              </button>
              <button
                type="button"
                onClick={() => void explainQuestion()}
                aria-expanded={explainOpen}
                className="vk-deck-act vk-deck-explainbtn touch-manipulation"
                data-testid="button-doubt-explain"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Explain
                </span>
                <span className="vk-deck-act-when">no grade</span>
              </button>
            </div>
            <p className="vk-deck-hint">
              {savingFlaggedDetail
                ? 'Saving your review…'
                : isMcqDoubt && picked === null
                  ? 'Pick your answer, then say how it felt — the time under each button is when this comes back.'
                  : 'Again re-queues this in the same session. Got it schedules the next round.'}
            </p>
            {/* CHANGE 2 — the session clock and its pace modes: a quiet strip
                at the BOTTOM of the card, just above the pace bar. */}
            <div className="vk-deck-foot">
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { id: 'question' as const, label: `Q · ${formatPaceShort(questionLimit)}` },
                  { id: 'exam' as const, label: `${examPacing.label} · ${formatPaceShort(examLimit)}` },
                ]).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setTimerMode(mode.id)}
                    aria-pressed={timerMode === mode.id}
                    className={`vk-deck-pace${timerMode === mode.id ? ' vk-deck-pace-on' : ''} flex-shrink-0 touch-manipulation`}
                    data-testid={`doubt-timer-mode-${mode.id}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <span
                className={`vk-deck-clock${remainingSeconds <= 30 ? ' vk-deck-clock-urgent' : ''}`}
                data-testid="text-doubt-time-badge"
              >
                <Timer className="w-3.5 h-3.5" aria-hidden="true" />
                {formatCountdown(remainingSeconds)}
              </span>
            </div>
            {/* The pace, as a slim rule across the foot of the card. */}
            <div
              className={`vk-deck-timer${remainingSeconds <= 30 ? ' vk-deck-timer-urgent' : ''}`}
              aria-hidden="true"
              data-testid="doubt-timer-bar"
            >
              <span style={{ width: `${timerPercent}%` }} />
            </div>
            </div>
          </div>
        </div>
      )}

      {/* [Resolve flow] Resolving is a task on Today, never a blocker at
          capture: a saved link (YouTube with timestamp, or any URL) plus the
          REQUIRED written answer in the student's own words. The card enters
          review rotation the moment the answer is saved. */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[66] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Resolve this mistake">
          <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={() => setResolveTarget(null)} aria-label="Close resolve" />
          <div
            className="relative max-h-[88vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
            style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Resolve this mistake</h2>
                <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>
                  Write the answer in your own words — that's what unlocks revision on this card.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolveTarget(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resolveTarget.image_url && (
              <img
                src={resolveTarget.image_url}
                alt="Question"
                className="mt-3 max-h-56 mx-auto object-contain"
                style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}` }}
                data-testid="img-resolve-photo"
              />
            )}
            {(resolveTarget.question_text ?? '').trim() !== '' && (
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: TEXT_SECONDARY }} data-testid="text-resolve-question">
                {resolveTarget.question_text}
              </p>
            )}

            <label className="block mt-4 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
              Link that helped (optional)
              <input
                type="url"
                value={resolveLink}
                onChange={(event) => setResolveLink(event.target.value)}
                placeholder="YouTube with timestamp, article — any URL"
                className="mt-1 w-full px-3 py-2.5 text-sm"
                style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
                data-testid="input-resolve-link"
              />
            </label>

            <label className="block mt-3 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
              Your answer — in your own words (required)
              <textarea
                value={resolveAnswer}
                onChange={(event) => setResolveAnswer(event.target.value)}
                rows={4}
                placeholder="Explain it like you'd teach a friend — one line minimum"
                className="mt-1 w-full px-3 py-2.5 text-sm resize-none"
                style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
                data-testid="input-resolve-answer"
              />
            </label>

            <button
              type="button"
              disabled={savingResolve || !(resolveAnswer ?? '').trim()}
              onClick={() => void submitResolve()}
              className="mt-4 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-resolve-save"
            >
              {savingResolve ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save my answer — start revising it
            </button>
          </div>
        </div>
      )}

    </>
  );
}
