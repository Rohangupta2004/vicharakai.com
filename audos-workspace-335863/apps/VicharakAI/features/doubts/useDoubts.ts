/**
 * Mistake Book feature (internally still "doubts" — the display label changed,
 * the storage keys and identifiers deliberately did not) — the saved-question
 * bank: capture, spaced question revision (the Again/Hard/Good/Easy chips on
 * a review card), AI-explain/resolve updates and the silent auto-queue of
 * wrongly answered practice questions.
 *
 * Scheduling goes through the ONE revision engine (revisionEngine.ts): the
 * real FSRS state machine (fsrsReview) schedules every graded review from
 * the card's stored memory state (zuno_question_queue.fsrs_json), and the
 * classic 1/3/7/14 'question' ladder remains only as the fallback that sets
 * a fresh card's first due date on save — no interval arithmetic lives here.
 * Extracted from App.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { addDaysISO } from '../../engine';
import { uploadImage } from '../../Attachments';
import { extractJsonObject } from '../../customExam';
import { OPENAI_PROXY_URL } from '../../config/models';
import { aiProxyHeaders } from '../../shared/platformAuth';
import {
  OCR_MIN_CONFIDENCE,
  aiOcrText,
  cleanOcrQuestionText,
  dataUrlToJpegFile,
  recognizeText,
  tidyOcrText,
} from '../../doubtOcr';
import {
  calculateNextRevision,
  estimateRetention,
  estimateTimeSaved,
  fsrsReview,
  nextOpenRevisionDay,
  timeSavedLine,
} from '../../revisionEngine';
import { AGAIN_REQUEUE_MINUTES, DOUBTS_DAILY_CAP, MAX_ACTIVE_DOUBTS } from '../../config/revision';
import {
  DOUBT_GRADE_TO_FSRS,
  doubtGradeFromSeconds,
  isSuccessfulRecall,
  queuePyqConcept,
  tagConcept,
  type DoubtGrade,
} from '../../config/sharedConfig';
import { autoTagQuestion, buildTagCatalog, logTagCorrection } from './autoTag';
import { flushPhotoUploads, queuePhotoUpload } from './photoUploadQueue';
import { parseFsrsState, serializeFsrsState } from '../../fsrsTypes';
import { flaggedReviseCount, type FlaggedRow } from '../../mcq';
import type { FlaggedDraft } from '../../FlaggedQuestions';
import type { PlayableQuestion } from '../../QuizSheets';
import { fetchRowsWhere, runExclusive, verifiedDbFrom } from '../../services/database/dbClient';
import { isSessionVerificationError } from '../../sessionGuard';
import { TABLES } from '../../services/database/tables';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';
import type { AccessFeature } from '../access/useAccess';

/** The photo-capture sheet opened from a test's score screen. */
export interface MistakeUploadTarget {
  /** Shown on the entry as "From: …", e.g. "NEET Full Mock #3". */
  sourceLabel: string;
  /** Subject the captured entries file under by default. */
  subject: string;
}

export interface DoubtsFeature {
  flagOpen: boolean;
  setFlagOpen: (open: boolean) => void;
  savingFlag: boolean;
  flaggedDetail: FlaggedRow | null;
  setFlaggedDetail: (row: FlaggedRow | null) => void;
  savingFlaggedDetail: boolean;
  saveFlagged: (draft: FlaggedDraft) => Promise<void>;
  removeFlagged: (row: FlaggedRow) => Promise<void>;
  advanceFlagged: (row: FlaggedRow) => Promise<void>;
  repeatFlagged: (row: FlaggedRow) => Promise<void>;
  /** EXPLICIT FSRS grade — the Again/Hard/Good/Easy chips on a review card.
   * Runs the FSRS state machine and writes the card's next due date and
   * interval back to zuno_question_queue. Resolves true when the write
   * COMMITTED, false when it failed — deck UIs use that verdict to bring a
   * card back instead of silently losing the response. */
  gradeFlagged: (row: FlaggedRow, grade: DoubtGrade) => Promise<boolean>;
  /** IMPLICIT FSRS grade from the silent timer, for a card the student left
   * without answering (and for a wrong MCQ pick). */
  gradeFlaggedByTime: (row: FlaggedRow, elapsedSeconds: number) => Promise<boolean>;
  autoQueueWrongQuestion: (question: PlayableQuestion) => Promise<void>;
  updateDoubt: (row: FlaggedRow, patch: Record<string, unknown>) => Promise<void>;
  saveQuickDoubt: (text: string, subject: string) => Promise<void>;
  /** UPLOAD-FIRST camera snap — one complete row commits, then OCR/tag follow.
   * Resolves true when the row committed, false when the save was refused
   * (rotation full, expired session, write refusal), so chat surfaces can
   * acknowledge honestly. `quiet` suppresses the success toast for callers
   * (the Vicharree chat) that speak for themselves. */
  snapMistake: (cleanDataUrl: string, options?: { quiet?: boolean }) => Promise<boolean>;
  /** ONE-TAP TAG CORRECTION — every card offers it, whatever the confidence.
   * Updates the row (confidence becomes 1) and logs the correction. */
  correctTag: (row: FlaggedRow, subject: string, topic?: string | null) => Promise<void>;
  /** Optionally replace the AI draft with the student's own answer and link.
   * The card is already in revision rotation from capture time. */
  resolveDoubt: (row: FlaggedRow, answer: string, link?: string | null) => Promise<void>;
  /** The entry currently open in the Resolve sheet (null = closed). */
  resolveTarget: FlaggedRow | null;
  setResolveTarget: (row: FlaggedRow | null) => void;
  /** Bulk-dismiss unresolved entries — instant, no warning copy, no friction. */
  bulkDismissUnresolved: (rows: FlaggedRow[]) => Promise<void>;
  /** A failed photo upload queues locally and retries when the network
   * returns — the photo is never lost and never blocks the student. */
  queueFailedPhotoUpload: (rowId: number, dataUrl: string) => void;
  /** "Upload Mistake" on a test's score screen — null while the sheet is shut. */
  mistakeUpload: MistakeUploadTarget | null;
  openMistakeUpload: (target: MistakeUploadTarget) => void;
  closeMistakeUpload: () => void;
}

/** The one line the student sees when a Mistake Book write does not land. */
const SAVE_FAILED_TOAST = "That didn't save — mind tapping it once more?";
/** How long the single automatic retry waits: long enough for the
 * account-row fallback to have adopted the row onto this session, or for a
 * momentary refusal to pass, and short enough that the student is still
 * looking at the card. */
const GRADE_RETRY_DELAY_MS = 1000;

export function useDoubts(data: StudentData, toast: ToastFeature, access?: AccessFeature): DoubtsFeature {
  const { today, flaggedQ, spaceId, topicPickerSubjects, topicPickerExamLabel } = data;
  const { showToast, clearToast } = toast;

  /**
   * Rule-based concept tag (config/sharedConfig.ts keyword map — zero AI).
   * The BEST match always wins. (An earlier build steered away from concepts
   * already used on queued doubts — that traded a right tag for a wrong-but-
   * different one and is exactly how an organic chemistry question ended up
   * labelled Physics. Never trade correctness for variety.)
   */
  const autoTagConcept = (text: string): string | null => tagConcept(text);

  const [flagOpen, setFlagOpen] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);
  const [flaggedDetail, setFlaggedDetail] = useState<FlaggedRow | null>(null);
  const [savingFlaggedDetail, setSavingFlaggedDetail] = useState(false);
  const [mistakeUpload, setMistakeUpload] = useState<MistakeUploadTarget | null>(null);
  const [resolveTarget, setResolveTarget] = useState<FlaggedRow | null>(null);

  /** How many queued doubts already come due on each FUTURE day — the map
   * pile-up protection walks so no single day drowns in doubt revisions. */
  const doubtLoadByDate = (): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of flaggedQ.data ?? []) {
      if (row.status !== 'queued') continue;
      const due = String(row.next_revision_on ?? '').slice(0, 10);
      if (!due || due <= today) continue;
      map.set(due, (map.get(due) ?? 0) + 1);
    }
    return map;
  };

  /** First due date for a freshly saved/queued question (ladder step 0),
   * chunked forward when tomorrow is already at the doubts-per-day cap. */
  const firstDueOn = (load: Map<string, number> = doubtLoadByDate()): string => {
    const base = calculateNextRevision({ entityType: 'question', baseDate: today, step: 0 }).dueOn ?? addDaysISO(today, 1);
    return nextOpenRevisionDay(base, load, DOUBTS_DAILY_CAP);
  };

  const aiDraftBusyRef = useRef(false);

  /** Draft the correct answer and underlying concept without blocking capture.
   * The row is already queued with its first due date before this starts. */
  const draftAiAnswer = async (row: FlaggedRow) => {
    try {
      await verifiedDbFrom(TABLES.questionQueue).update(row.id, { ai_draft_status: 'drafting' });
      const question = String(row.question_text ?? '').trim();
      const imageUrl = String(row.image_url ?? '').trim();
      const prompt =
        `Exam: ${topicPickerExamLabel || 'competitive exam'}. Subject: ${row.subject || 'General'}. ` +
        `Question: ${question || 'Read the attached question image.'}`;
      const userContent: unknown = imageUrl
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ]
        : prompt;
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          model: 'gpt-6.1-sol',
          reasoning_effort: 'medium',
          messages: [
            {
              role: 'system',
              content:
                'You draft a correct answer for a snapped competitive-exam question. Use the image when supplied. ' +
                'Reply with STRICT JSON only: {"answer": string, "concept": string}. The answer must be concise but ' +
                'complete enough for revision; the concept must name the underlying principle. Never invent missing ' +
                'question details — state uncertainty inside the answer when the image is unreadable.',
            },
            { role: 'user', content: userContent },
          ],
          max_completion_tokens: 6000,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`AI draft failed (${response.status})`);
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const parsed = extractJsonObject(String(payload.choices?.[0]?.message?.content || '')) as Record<string, unknown> | null;
      const answer = typeof parsed?.answer === 'string' ? parsed.answer.trim() : '';
      const concept = typeof parsed?.concept === 'string' ? parsed.concept.trim() : '';
      if (!answer) throw new Error('AI draft returned no answer');
      await verifiedDbFrom(TABLES.questionQueue).update(row.id, {
        ai_draft_answer: answer.slice(0, 6000),
        ai_draft_status: 'ready',
        ...(concept ? { concept: concept.slice(0, 300) } : {}),
      });
      access?.chargeAi();
    } catch (error) {
      console.warn('[vicharakai] non-blocking AI mistake draft failed', error);
      try {
        await verifiedDbFrom(TABLES.questionQueue).update(row.id, { ai_draft_status: 'failed' });
      } catch {
        /* The saved row and its revision date remain intact. */
      }
    } finally {
      aiDraftBusyRef.current = false;
      flaggedQ.refresh();
    }
  };

  /* Pending drafts retry once per visit. A failed attempt stays saved and due;
   * the next visit retries instead of holding capture or revision hostage. */
  const aiDraftAttemptedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (flaggedQ.loading || aiDraftBusyRef.current) return;
    const candidate = (flaggedQ.data ?? []).find(
      (row) =>
        row.status === 'queued' &&
        row.source_type === 'photo' &&
        (row.ai_draft_status === 'pending' || row.ai_draft_status === 'failed') &&
        !aiDraftAttemptedRef.current.has(row.id),
    );
    if (!candidate) return;
    aiDraftAttemptedRef.current.add(candidate.id);
    aiDraftBusyRef.current = true;
    void draftAiAnswer(candidate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedQ.loading, flaggedQ.data]);

  /** Save the question immediately; photo entries draft an answer afterwards. */
  const saveFlagged = async (draft: FlaggedDraft) => {
    if (savingFlag) return;
    // Rotation guard: at most MAX_ACTIVE_DOUBTS doubt questions cycle at once.
    const activeCount = (flaggedQ.data ?? []).filter((row) => row.status === 'queued').length;
    if (activeCount >= MAX_ACTIVE_DOUBTS) {
      showToast(`Your Mistake Book rotation is full (${MAX_ACTIVE_DOUBTS} active) — clear a few before adding more.`);
      return;
    }
    setSavingFlag(true);
    // No concept from the student/AI? Tag it rule-based from the question
    // text (OCR output and typed doubts alike) — zero AI calls.
    const concept =
      (draft.concept ?? '').trim() || autoTagConcept(`${draft.question} ${draft.topic} ${draft.subject}`) || null;
    try {
      await verifiedDbFrom(TABLES.questionQueue).insert({
        source_type: draft.sourceType,
        source_label: (draft.sourceLabel || '').trim() || null,
        subject: draft.subject,
        topic: (draft.topic ?? '').trim() || null,
        question_text: (draft.question ?? '').trim(),
        image_url: draft.imageUrl,
        status: 'queued',
        created_on: today,
        options_json: draft.options ? JSON.stringify(draft.options) : null,
        correct: draft.correct,
        concept,
        difficulty: draft.difficulty || null,
        // The student's own solution — the eligibility gate for the test pool.
        solution_text: (draft.solutionText ?? '').trim() || null,
        has_solution: draft.hasSolution === true && (draft.solutionText ?? '').trim().length > 0,
        // Auto-tag confidence (1 = the student picked the subject themselves).
        // Below the app's threshold the tag renders as an editable suggestion.
        tag_confidence: typeof draft.tagConfidence === 'number' ? Math.max(0, Math.min(1, draft.tagConfidence)) : null,
        // Spaced repetition starts NOW — confirmation never gates the queue.
        revise_count: 0,
        next_revision_on: firstDueOn(),
        ai_draft_status: draft.sourceType === 'photo' ? 'pending' : null,
      });
      // A tagged concept queues related PYQ practice for TOMORROW (local
      // storage only — surfaced as a banner on the Doubts tab).
      if (concept) queuePyqConcept(spaceId, concept, addDaysISO(today, 1));
      flaggedQ.refresh();
      setFlagOpen(false);
      showToast(
        draft.hasSolution && (draft.solutionText ?? '').trim()
          ? `Saved with your solution under ${draft.subject || 'General'} — revision is scheduled.`
          : draft.sourceType === 'photo'
            ? `Saved and scheduled under ${draft.subject || 'General'} — AI is drafting the answer now.`
            : `Saved under ${draft.subject || 'General'} — revision is scheduled.`,
      );
    } catch {
      showToast("That question didn't save — mind tapping it once more?");
    } finally {
      setSavingFlag(false);
    }
  };

  const removeFlagged = async (row: FlaggedRow) => {
    try {
      await verifiedDbFrom(TABLES.questionQueue).delete(row.id);
    } catch (error) {
      /* Deleting a card saved under a PREVIOUS login goes through the
       * account-row fallback and can still be refused. The entry stays in
       * the book, so say so rather than letting the promise reject into a
       * caller that may not be listening. */
      console.warn('[vicharakai] removing a Mistake Book entry failed', error);
      showToast(isSessionVerificationError(error) && error instanceof Error ? error.message : SAVE_FAILED_TOAST);
      return;
    }
    flaggedQ.refresh();
    showToast('Removed from your Mistake Book.');
  };

  /**
   * ONE FSRS review write for a doubt card — every rating in the product
   * funnels through here, whether it came from an Again/Hard/Good/Easy chip,
   * the silent timer or a wrong MCQ pick.
   *
   * The grade maps one-for-one onto an FSRS rating
   * (config/taxonomy.DOUBT_GRADE_TO_FSRS: 1/2/3/4), the FSRS state machine
   * (revisionEngine.fsrsReview) turns the card's stored memory state +
   * elapsed days into the next due date and interval, and pile-up protection
   * chunks that date onto the nearest open day. Three columns are written:
   * `next_revision_on` (the date), `fsrs_json` (the new memory state, whose
   * `scheduled_days` IS the interval) and `revise_count`. A first-ever review
   * starts from the FSRS 'New' state — before that the save-time ladder
   * fallback set the first due date, and the entry rungs are explicit:
   * Hard 1 day, Good 4 days, Easy 14 days.
   *
   * AGAIN IS NOT A DAY. An Again rating re-queues the card inside the CURRENT
   * session — `next_revision_on` stays today and `requeue_at` holds it back
   * for about AGAIN_REQUEUE_MINUTES minutes — so Again and Hard are genuinely
   * different answers. It still lapses the card into the FSRS 'Relearning'
   * state (stability shrunk). Once the scheduled interval outgrows
   * DOUBT_FSRS_CLEAR_DAYS the card graduates out of rotation for good.
   * Returns the toast line to show.
   */
  const reviewDoubtWithFsrs = async (row: FlaggedRow, grade: DoubtGrade): Promise<string> => {
    const prior = parseFsrsState(row.fsrs_json);
    const result = fsrsReview(prior, DOUBT_GRADE_TO_FSRS[grade], today);
    const fsrsJson = serializeFsrsState(result.state);
    /* [Time saved] The immediate payback figure — read from the SAME decay
     * model that schedules the card (a question recall costs ~2 minutes). */
    const payback = timeSavedLine(
      estimateTimeSaved(2, estimateRetention(result.state.elapsed_days, prior && prior.stability > 0 ? prior.stability : 1)),
    );
    /* revise_count keeps its stored meaning: successful recalls only, so
     * Again is the one grade that does not advance it. */
    const successCount = flaggedReviseCount(row) + (isSuccessfulRecall(grade) ? 1 : 0);
    if (result.mastered) {
      await verifiedDbFrom(TABLES.questionQueue).update(row.id, {
        status: 'cleared',
        revise_count: successCount,
        last_revised_on: today,
        fsrs_json: fsrsJson,
      });
      return 'That question is mastered — it leaves your revision loop.';
    }
    if (result.sameSessionRequeue) {
      /* Again: back later TODAY, not tomorrow. The date stays today and
       * requeue_at hides the card until its moment arrives. */
      await verifiedDbFrom(TABLES.questionQueue).update(row.id, {
        revise_count: successCount,
        last_revised_on: today,
        next_revision_on: today,
        requeue_at: new Date(Date.now() + result.intervalMinutes * 60_000).toISOString(),
        fsrs_json: fsrsJson,
      });
      return `No stress — it comes back in about ${result.intervalMinutes} minutes, in this session.`;
    }
    await verifiedDbFrom(TABLES.questionQueue).update(row.id, {
      revise_count: successCount,
      last_revised_on: today,
      next_revision_on: nextOpenRevisionDay(result.dueOn, doubtLoadByDate(), DOUBTS_DAILY_CAP),
      requeue_at: null,
      fsrs_json: fsrsJson,
    });
    const inDays = `${result.intervalDays} day${result.intervalDays === 1 ? '' : 's'}`;
    if (grade === 'hard') return `Marked hard — it comes back in ${inDays}. ${payback}`;
    if (grade === 'easy') return `Quick recall — that spaces it out to ${inDays}. ${payback}`;
    return `Nice — it comes back in ${inDays}. ${payback}`;
  };

  /**
   * ONE RESPONSE = ONE WRITE, NEVER DROPPED. Grade writes used to bail out
   * silently whenever an earlier write was still in flight
   * (`if (savingFlaggedDetail) return`) — on a real connection a write takes
   * a second or more, the deck advances after 300ms, so a quick second
   * Got it/Again was simply discarded and that response never persisted.
   * Writes are now SERIALIZED through runExclusive: every tap or swipe
   * queues its own write, in order. A per-row in-flight set still absorbs an
   * accidental double-tap on the SAME card (that would be a duplicate FSRS
   * review, not a second response). Returns true when the write committed,
   * false when it failed — callers restore the card on false.
   */
  const gradeInFlight = useRef<Set<number>>(new Set());

  const commitGrade = async (row: FlaggedRow, grade: DoubtGrade, toastLine?: string): Promise<boolean> => {
    if (gradeInFlight.current.has(row.id)) return true; // same card, already saving
    gradeInFlight.current.add(row.id);
    try {
      return await runExclusive('doubt-grade-write', async () => {
        setSavingFlaggedDetail(true);
        try {
          const line = await reviewDoubtWithFsrs(row, grade);
          showToast(toastLine ?? line);
          flaggedQ.refresh();
          setFlaggedDetail(null);
          return true;
        } catch (error) {
          /* An expired sign-in is the one failure a retry cannot fix — the
           * guard has already routed the student to re-auth. Say what
           * happened and stop. */
          if (isSessionVerificationError(error)) {
            showToast(error instanceof Error ? error.message : SAVE_FAILED_TOAST);
            return false;
          }
          /* ONE RESPONSE IS NEVER THROWN AWAY ON A SINGLE REFUSAL. The toast
           * goes up at once so the student knows, then exactly one automatic
           * retry runs a second later. A retry that lands clears the toast
           * and says nothing further; one that fails leaves the toast up and
           * the deck takes the card back.
           *
           * Re-running the FSRS review is safe: the first attempt was
           * refused outright, so the card's stored memory state — the only
           * input — is exactly what it was. */
          showToast(SAVE_FAILED_TOAST);
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, GRADE_RETRY_DELAY_MS);
          });
          try {
            await reviewDoubtWithFsrs(row, grade);
            clearToast();
            flaggedQ.refresh();
            setFlaggedDetail(null);
            return true;
          } catch (retryError) {
            console.warn('[vicharakai] grade write failed twice — the card stays due', retryError);
            showToast(SAVE_FAILED_TOAST);
            return false;
          }
        } finally {
          setSavingFlaggedDetail(false);
        }
      });
    } finally {
      gradeInFlight.current.delete(row.id);
    }
  };

  /** The Again/Hard/Good/Easy chips on a review card — an explicit grade
   * straight into the FSRS scheduler, no timing inference in between. */
  const gradeFlagged = (row: FlaggedRow, grade: DoubtGrade): Promise<boolean> => commitGrade(row, grade);

  /** "Got it" — a successful recall: FSRS (grade Good) computes the next
   * interval from the card's stability/difficulty/elapsed days; the card
   * clears for good once its memory is stable enough. */
  const advanceFlagged = async (row: FlaggedRow) => {
    await commitGrade(row, 'good');
  };

  /**
   * IMPLICIT FSRS grading — the fallback for a card the student never graded
   * themselves (the countdown ran out, or an MCQ answer came back wrong).
   * The timing buckets live in config/taxonomy:
   *  · ≤20s           = Easy → FSRS grade 4 — stability jumps furthest;
   *  · 20s–2 minutes  = Good → FSRS grade 3 — the standard advance;
   *  · over 2 minutes = Again → FSRS grade 1 — the card lapses into the FSRS
   *    relearning state and re-queues later in the same session;
   *  · never opened   = nothing is written, so the card simply stays due.
   * Every review feeds the real FSRS state machine (stability · difficulty ·
   * elapsed days); the 1/3/7/14 ladder only ever set the pre-review due date.
   * Pile-up protection caps how many doubts can land on any single day.
   */
  const gradeFlaggedByTime = (row: FlaggedRow, elapsedSeconds: number): Promise<boolean> =>
    commitGrade(row, doubtGradeFromSeconds(elapsedSeconds));

  /** "Revise again" — an explicit Again: the FSRS lapse path runs (state →
   * Relearning, stability shrinks) and the card re-queues in this session. */
  const repeatFlagged = async (row: FlaggedRow) => {
    await commitGrade(row, 'again', `No stress — it comes back in about ${AGAIN_REQUEUE_MINUTES} minutes.`);
  };

  /** Any practice question answered wrong is auto-added to the revision queue —
   * silently, no confirmation prompt. A previously cleared duplicate re-queues
   * instead of piling up as a second row. */
  const autoQueueWrongQuestion = async (question: PlayableQuestion) => {
    const stem = (question.question ?? '').trim();
    if (!stem) return;
    try {
      const existing = (flaggedQ.data ?? []).find((row) => (row.question_text ?? '').trim() === stem);
      if (existing) {
        if (existing.status === 'queued') return;
        await verifiedDbFrom(TABLES.questionQueue).update(existing.id, {
          status: 'queued',
          next_revision_on: firstDueOn(),
        });
      } else {
        await verifiedDbFrom(TABLES.questionQueue).insert({
          source_type: 'quiz',
          subject: question.subject,
          topic: question.topic || null,
          question_text: stem,
          image_url: question.image_url ?? null,
          status: 'queued',
          created_on: today,
          options_json: JSON.stringify([question.option_a, question.option_b, question.option_c, question.option_d]),
          correct: question.correct,
          concept: question.concept ?? autoTagConcept(`${stem} ${question.topic ?? ''} ${question.subject}`),
          difficulty: question.difficulty ?? null,
          revise_count: 0,
          next_revision_on: firstDueOn(),
        });
      }
      flaggedQ.refresh();
    } catch (error) {
      console.warn('[vicharakai] wrong-answer Mistake Book queue failed', error);
      showToast("That wrong answer couldn't join your Mistake Book — your quiz can continue, then tap Save on the question to retry.");
    }
  };

  /** AI explanation / resolve writes land on the same doubt row. */
  const updateDoubt = async (row: FlaggedRow, patch: Record<string, unknown>) => {
    await verifiedDbFrom(TABLES.questionQueue).update(row.id, patch);
    flaggedQ.refresh();
  };

  /**
   * Photo capture is upload-first: only a durable hosted image is inserted,
   * and the row carries a unique capture_token. OCR/tagging can therefore
   * patch the exact row instead of guessing the newest blank photo — two fast
   * snaps can never cross-attach.
   */
  const snapMistake = async (cleanDataUrl: string, options?: { quiet?: boolean }): Promise<boolean> => {
    const activeCount = (flaggedQ.data ?? []).filter((row) => row.status === 'queued').length;
    if (activeCount >= MAX_ACTIVE_DOUBTS) {
      showToast(`Your Mistake Book rotation is full (${MAX_ACTIVE_DOUBTS} active) — clear a few before adding more.`);
      return false;
    }
    const captureToken =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    let hosted = '';
    try {
      hosted = await uploadImage(await dataUrlToJpegFile(cleanDataUrl, 'mistake-photo.jpg'), spaceId);
    } catch (error) {
      console.warn('[vicharakai] snap upload failed', error);
      showToast("That photo couldn't upload — the snap is still on screen. Check your connection and tap Save once more.");
      return false;
    }
    try {
      await verifiedDbFrom(TABLES.questionQueue).insert({
        source_type: 'photo',
        subject: 'General',
        topic: null,
        question_text: '',
        image_url: hosted,
        status: 'queued',
        created_on: today,
        options_json: null,
        correct: null,
        concept: null,
        difficulty: null,
        solution_text: null,
        has_solution: false,
        revise_count: 0,
        next_revision_on: firstDueOn(),
        tag_confidence: 0,
        capture_token: captureToken,
        ai_draft_status: 'pending',
      });
    } catch (error) {
      // A timed-out insert may have landed after the client stopped waiting.
      // The unique token gives us a definitive read before claiming failure.
      let landed = false;
      try {
        const rows = await fetchRowsWhere<FlaggedRow>(TABLES.questionQueue, [
          { column: 'capture_token', operator: 'eq', value: captureToken },
        ]);
        landed = rows.length > 0;
      } catch {
        landed = false;
      }
      if (!landed) {
        console.warn('[vicharakai] snap insert failed', error);
        showToast(
          isSessionVerificationError(error) && error instanceof Error
            ? error.message
            : "That snap didn't save — the photo is still here. Mind tapping Save once more?",
        );
        return false;
      }
    }
    flaggedQ.refresh();
    if (!options?.quiet) {
      showToast("Snapped — saved and scheduled. AI is drafting the answer now.");
    }
    void finishSnapInBackground(captureToken, cleanDataUrl);
    return true;
  };

  /** The background half of a snap: exact token lookup → OCR → constrained tag. */
  const finishSnapInBackground = async (captureToken: string, cleanDataUrl: string) => {
    let rowId: number | null = null;
    try {
      const rows = await fetchRowsWhere<FlaggedRow>(TABLES.questionQueue, [
        { column: 'capture_token', operator: 'eq', value: captureToken },
      ]);
      rowId = rows[0]?.id ?? null;
    } catch {
      rowId = null;
    }
    if (rowId === null) return;
    /* 1 · On-device OCR (Web Worker), with the same quiet AI-vision and
     * cleanup fallbacks the gallery path uses. */
    let text = '';
    try {
      const local = await recognizeText(cleanDataUrl);
      text = tidyOcrText(local.text);
      if (!(text ?? '').trim() || local.confidence < OCR_MIN_CONFIDENCE) {
        const aiText = tidyOcrText(await aiOcrText(cleanDataUrl));
        if (aiText) text = aiText;
      } else {
        const cleaned = await cleanOcrQuestionText(text);
        if (cleaned) text = cleaned;
      }
    } catch {
      /* no text — the photo alone is still a complete entry */
    }
    if (!(text ?? '').trim()) return;
    /* 2 · CONSTRAINED tag — the exam's own chapter list only, never a
     * free-invented subject, always with a confidence score. */
    const catalog = buildTagCatalog(topicPickerSubjects);
    const tag = await autoTagQuestion(text, catalog, topicPickerExamLabel, access?.access.canAskAi ?? false);
    if (tag.source === 'ai') access?.chargeAi();
    try {
      await verifiedDbFrom(TABLES.questionQueue).update(rowId, {
        question_text: text.slice(0, 4000),
        subject: tag.subject,
        topic: tag.chapter || null,
        concept: tag.concept || null,
        tag_confidence: tag.confidence,
      });
      flaggedQ.refresh();
    } catch {
      /* tags are a bonus — the entry is already saved */
    }
  };

  /** One-tap tag correction from any card. Confidence becomes 1 (student-
   * confirmed) and the correction is logged for tagger auditing. */
  const correctTag = async (row: FlaggedRow, subject: string, topic?: string | null) => {
    const nextSubject = (subject ?? '').trim() || 'General';
    const nextTopic = topic === undefined ? (row.topic ?? null) : (topic ?? '').trim() || null;
    if (nextSubject === row.subject && nextTopic === (row.topic ?? null)) {
      // Same tag re-picked = the student CONFIRMED it — record the certainty.
      try {
        await verifiedDbFrom(TABLES.questionQueue).update(row.id, { tag_confidence: 1 });
        flaggedQ.refresh();
      } catch {
        /* non-fatal */
      }
      return;
    }
    try {
      await verifiedDbFrom(TABLES.questionQueue).update(row.id, {
        subject: nextSubject,
        topic: nextTopic,
        tag_confidence: 1,
      });
      logTagCorrection(
        row.id,
        { subject: row.subject, topic: row.topic ?? null },
        { subject: nextSubject, topic: nextTopic },
        today,
      );
      flaggedQ.refresh();
      showToast(`Filed under ${nextSubject}.`);
    } catch {
      showToast(SAVE_FAILED_TOAST);
    }
  };

  /** Optional student answer: it replaces the draft, but scheduling already
   * began when the snap was saved. */
  const resolveDoubt = async (row: FlaggedRow, answer: string, link?: string | null) => {
    const text = (answer ?? '').trim();
    if (!text) return;
    try {
      await verifiedDbFrom(TABLES.questionQueue).update(row.id, {
        solution_text: text,
        has_solution: true,
        resolution_link: (link ?? '').trim() || null,
        resolved_at: new Date().toISOString(),
        ai_draft_status: 'edited',
        ai_draft_answer: text,
        // A legacy row without a due date gets one; new snaps already have it.
        next_revision_on: row.next_revision_on ?? firstDueOn(),
      });
      flaggedQ.refresh();
      setResolveTarget(null);
      showToast('Answer saved — its existing revision schedule stays intact.');
    } catch {
      showToast(SAVE_FAILED_TOAST);
    }
  };

  /** Bulk-dismiss the resolve queue — one tap, no confirmation, no guilt. */
  const bulkDismissUnresolved = async (rows: FlaggedRow[]) => {
    if (rows.length === 0) return;
    try {
      await Promise.all(
        rows.map((row) => verifiedDbFrom(TABLES.questionQueue).update(row.id, { status: 'dismissed' })),
      );
      flaggedQ.refresh();
      showToast('Cleared.');
    } catch {
      showToast(SAVE_FAILED_TOAST);
    }
  };

  /* Offline-safe photos: retry queued uploads on load and when the network
   * returns. A patched row refreshes the list so the thumbnail appears. */
  useEffect(() => {
    const flush = () => void flushPhotoUploads(spaceId, () => flaggedQ.refresh(), showToast);
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  /** Quick typed doubt from the Tools panel → the same queue as the Doubts tab. */
  const saveQuickDoubt = async (text: string, subject: string) => {
    await saveFlagged({
      question: text,
      subject,
      topic: '',
      concept: '',
      difficulty: '',
      options: null,
      correct: null,
      imageUrl: null,
      sourceType: 'manual',
    });
  };

  return {
    flagOpen,
    setFlagOpen,
    savingFlag,
    flaggedDetail,
    setFlaggedDetail,
    savingFlaggedDetail,
    saveFlagged,
    removeFlagged,
    advanceFlagged,
    repeatFlagged,
    gradeFlagged,
    gradeFlaggedByTime,
    autoQueueWrongQuestion,
    updateDoubt,
    saveQuickDoubt,
    snapMistake,
    correctTag,
    resolveDoubt,
    resolveTarget,
    setResolveTarget,
    bulkDismissUnresolved,
    queueFailedPhotoUpload: (rowId: number, dataUrl: string) => {
      const result = queuePhotoUpload(spaceId, rowId, dataUrl);
      if (result.warning) showToast(result.warning);
    },
    mistakeUpload,
    openMistakeUpload: (target: MistakeUploadTarget) => setMistakeUpload(target),
    closeMistakeUpload: () => setMistakeUpload(null),
  };
}
