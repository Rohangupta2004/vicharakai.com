/**
 * Onboarding feature — the TWO-step flow (exam picker → dream goal), the
 * optimistic pre-verification path, and the WorkspaceDB writes that create
 * the student's profile.
 *
 * 2026-09-29 (V2 Task 5): exam date, daily study hours, "where are you right
 * now?" and the Day-1 plan preview are gone. Onboarding collects exactly two
 * things — the exam and the dream goal — and Vicharee asks for everything
 * else conversationally once the student is inside. The AI welcome overlay
 * went with them: the moment after onboarding now belongs to Vicharee's mood
 * check (features/today/MoodCheckOverlay.tsx).
 *
 * Picking an exam also loads that exam's paper structure from the shared
 * `vicharakai_exam_sections` registry onto the profile, so the app knows how
 * the exam is built without asking an AI for it.
 */
import { useEffect, useRef, useState } from 'react';
import {
  buildRevisionDrafts,
  diffDays,
  parseOneLiner,
  taskTypeKey,
  todayISO,
  topicKey,
} from '../../engine';
import { defaultExamDate, type ExamDef } from '../../syllabus';
import { EXAM_LABEL_META_KEY, customExamMetaRows, isCustomExamId, serializeCustomExam } from '../../customExam';
import { isDbWriteReady } from '../../sessionGuard';
import { localNoonTimestamp } from '../../systemDate';
import { findChapter, getSyllabus, syllabusForProfileExam } from '../../data/syllabuses';
import { recordStudySession } from '../mastery/masteryService';
import { EXAM_REGISTRY_META_KEY, EXAM_SECTIONS_META_KEY } from '../../data/examRegistry';
import { fetchAllRows, verifiedDbFrom } from '../../services/database/dbClient';
import { upsertMetaKey } from '../../services/database/metaRepository';
import { TABLES } from '../../services/database/tables';
import { readSessionEmail } from '../../shared/sessionUtils';
import { trackEvent, trackedExamLabel } from '../../shared/track';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';
import { clearOnboardingResetMarker } from './profileRecovery';
import {
  cacheOnboardingComplete,
  clearPendingOnboarding,
  pendingExamDef,
  savePendingOnboarding,
  type ObCompletedEntry,
  type ObScreen,
  type PendingOnboarding,
} from './onboardingStorage';

export interface OnboardingFeature {
  obStep: ObScreen;
  setObStep: (step: ObScreen) => void;
  obExam: string | null;
  setObExam: (id: string | null) => void;
  /** The exam's own default sitting date. Set when an exam is picked — never
   * asked for; Vicharee confirms the real date in conversation later. */
  obDate: string;
  setObDate: (date: string) => void;
  /** Step 2 — the dream goal, in the student's own words. */
  obGoal: string;
  setObGoal: (goal: string) => void;
  obCustomExam: ExamDef | null;
  setObCustomExam: (exam: ExamDef | null) => void;
  obCustomOpen: boolean;
  setObCustomOpen: (open: boolean) => void;
  obSearch: string;
  setObSearch: (q: string) => void;
  /** `vicharakai_exams.id` of the picked exam — null for a typed-in exam. */
  obRegistryExamId: string | null;
  /** That exam's section/paper structure, serialized for the profile. */
  obSectionsJson: string | null;
  creating: boolean;
  /** Report an exam pick to the funnel. `acceptExam` already calls it. */
  trackExamSelected: (exam: ExamDef) => void;
  /** Take the exam the student picked (catalogue, registry-built or typed in)
   * and move on to step 2. `registry` carries the shared-registry identity
   * and papers when the pick came from the registry picker. */
  acceptExam: (exam: ExamDef, registry?: ExamRegistryPick) => void;
  finishOnboarding: (input: FinishOnboardingInput) => Promise<void>;
}

/** The shared-registry facts an exam pick carries into the profile. */
export interface ExamRegistryPick {
  /** `vicharakai_exams.id`. */
  examId: string | null;
  /** `vicharakai_exam_sections` for that exam, already serialized. */
  sectionsJson: string | null;
}

/** Everything onboarding hands over when the student finishes step 2. */
export interface FinishOnboardingInput {
  exam: ExamDef | null;
  date?: string | null;
  /** Stored as the `goals` meta row — the Vision Board's central anchor. */
  goal?: string | null;
  registryExamId?: string | null;
  sectionsJson?: string | null;
  /** Day-1 topics. Always empty in the two-step flow; still honoured so a
   * pending record written by an older build finishes syncing correctly. */
  topics?: string[];
  hours?: string | null;
  completed?: ObCompletedEntry[];
}

export function useOnboarding(data: StudentData, toast: ToastFeature): OnboardingFeature {
  const {
    spaceId,
    today,
    dbSessionReady,
    profileQ,
    metaQ,
    itemsQ,
    examProgressQ,
    topicAttemptsQ,
    pendingOnboarding,
    setPendingOnboarding,
    setOnboardingExamDraft,
  } = data;
  const { showToast } = toast;

  /* Two screens, in this order: the exam picker, then the dream goal. */
  const [obStep, setObStep] = useState<ObScreen>('exam');
  const [obExam, setObExam] = useState<string | null>(null);
  const [obDate, setObDate] = useState('');
  const [obGoal, setObGoal] = useState('');
  const [obCustomExamState, setObCustomExamState] = useState<ExamDef | null>(null);
  const [obCustomOpen, setObCustomOpen] = useState(false);
  /* Instant client-side search over the registry catalogue. */
  const [obSearch, setObSearch] = useState('');
  /* The shared-registry identity of the pick, and that exam's papers. */
  const [obRegistryExamId, setObRegistryExamId] = useState<string | null>(null);
  const [obSectionsJson, setObSectionsJson] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  /* The typed-exam draft also feeds the data provider's examDef fallback, so
   * the very first render after saving already has a syllabus. */
  const setObCustomExam = (exam: ExamDef | null) => {
    setObCustomExamState(exam);
    setOnboardingExamDraft(exam);
  };

  /** The exam pick, reported once however it was made — `acceptExam` below
   * is the single door every picker path goes through. */
  const trackExamSelected = (exam: ExamDef) => {
    trackEvent('exam_selected', { exam: trackedExamLabel(exam) });
  };

  /**
   * THE exam pick — one path for all three sources: a planner-catalogue exam,
   * an exam built from its registry sections, and an exam the student typed
   * in. Only a `custom:` exam carries its syllabus on the profile, so the
   * draft is set for those and cleared for catalogue exams.
   */
  const acceptExam = (exam: ExamDef, registry?: ExamRegistryPick) => {
    trackExamSelected(exam);
    setObCustomExam(isCustomExamId(exam.id) ? exam : null);
    setObExam(exam.id);
    setObDate(defaultExamDate(exam, today));
    setObRegistryExamId(registry?.examId ?? null);
    setObSectionsJson(registry?.sectionsJson ?? null);
    setObCustomOpen(false);
    setObStep('goal');
  };

  /** The meta rows onboarding owns — exam date first, because Profile and
   * “At a glance” read `exam_date` and fall back to the exam's default sitting
   * whenever the row is missing. The date is no longer asked for: it is the
   * chosen exam's own next sitting until Vicharee confirms the real one. */
  const onboardingMetaRows = (input: FinishOnboardingInput, start: string): Array<[string, string]> => {
    const { exam, date, goal, hours, registryExamId, sectionsJson } = input;
    const rows: Array<[string, string]> = [];
    if (date) rows.push(['exam_date', date]);
    else if (exam) rows.push(['exam_date', defaultExamDate(exam, start)]);
    // Step 2's dream goal: the anchor the Vision Board pins its whole map to,
    // and the line the coach reads back as "Student's goal".
    const dreamGoal = (goal ?? '').trim();
    if (dreamGoal) rows.push(['goals', dreamGoal]);
    // The shared-registry identity of the pick, plus that exam's real paper
    // structure, read from vicharakai_exam_sections when it was chosen.
    if (registryExamId) rows.push([EXAM_REGISTRY_META_KEY, registryExamId]);
    if (sectionsJson) rows.push([EXAM_SECTIONS_META_KEY, sectionsJson]);
    // Only older pending records still carry an hours pick — the scheduler
    // reads goal_daily_hours as dailyGoalMinutes (hours × 60).
    if (hours) rows.push(['goal_daily_hours', hours]);
    if (!exam) rows.push([EXAM_LABEL_META_KEY, 'Your exam']);
    else if (isCustomExamId(exam.id)) rows.push(...customExamMetaRows(exam));
    return rows;
  };

  /** One Day-1 checklist row, exactly as the student worded it. */
  const dayOneItemRow = (exam: ExamDef | null, line: string, start: string) => {
    const parsed = parseOneLiner(line, exam ?? undefined);
    const subject = parsed.subject || 'General';
    const key = topicKey(subject, line);
    return {
      row: {
        exam: exam?.id ?? 'general',
        subject,
        topic: line,
        kind: 'new',
        day_number: 1,
        scheduled_for: start,
        status: 'pending',
        source_key: key,
      },
      annotation: {
        meta_key: taskTypeKey(key),
        meta_value: JSON.stringify({ type: parsed.type, ai: false }),
      },
    };
  };

  /** The actual WorkspaceDB writes onboarding produces — the profile row and
   * its meta rows. Called directly when the session is already verified, and
   * by the pending-onboarding sync effect once a deferred session verifies.
   *
   * The task-writing branches below only fire for a pending record written by
   * an older build; the two-step flow never supplies topics or pre-completed
   * chapters, so nothing is scheduled on the student's behalf.
   *
   * Resolves to `true` only when EVERY meta row (and any legacy task) landed.
   * A single refused write no longer aborts the rest: the profile row is
   * inserted first, and a session-verification hiccup on the very next write
   * used to throw out of the whole function, leaving a student with a profile
   * but no exam date and no goal. The caller keeps the local copy whenever
   * this returns false, and the sync effect backfills what is missing. */
  const writeOnboardingToDb = async (input: FinishOnboardingInput, start: string): Promise<boolean> => {
    const { exam } = input;
    const dayOneTopics = input.topics ?? [];
    const completed = input.completed ?? [];
    // user_email is the durable cross-session identity: a later login (which
    // mints a NEW session id) recovers this profile by email instead of
    // re-running onboarding — see features/onboarding/profileRecovery.ts.
    //
    // UPSERT BY EMAIL (2026-09-29 duplicate-profile fix): the account keeps
    // exactly ONE profile row. Before inserting, look for an existing row
    // stamped with this email (a re-run of onboarding, another device that
    // finished it first) and UPDATE that row instead — the newest choice
    // wins everywhere because profile reads are account-scoped. A cross-
    // session update falls back to the account-row-update hook, which also
    // adopts the row onto this session. An unconditional insert here used to
    // create one duplicate row per re-run and let devices disagree.
    const signedInEmail = (readSessionEmail(spaceId) || '').trim().toLowerCase() || null;
    let existingProfileId: number | null = null;
    if (signedInEmail) {
      try {
        const accountRows = await fetchAllRows<{ id: number | string; user_email?: string | null }>(
          TABLES.profile,
          { shared: true, orderBy: { column: 'id', direction: 'desc' } },
        );
        const owned = accountRows.find(
          (row) =>
            typeof row.user_email === 'string' &&
            (row.user_email ?? '').trim().toLowerCase() === signedInEmail &&
            typeof row.id === 'number' &&
            row.id > 0,
        );
        if (owned) existingProfileId = owned.id as number;
      } catch {
        /* lookup unavailable — insert below; the dedupe self-heal merges */
      }
    }
    if (existingProfileId !== null) {
      await verifiedDbFrom(TABLES.profile).update(existingProfileId, {
        exam: exam?.id ?? 'general',
        start_date: start,
        onboarding_complete: true,
      });
    } else {
      await verifiedDbFrom(TABLES.profile).insert({
        exam: exam?.id ?? 'general',
        start_date: start,
        user_email: signedInEmail,
        onboarding_complete: true,
      });
    }
    let complete = true;
    for (const [meta_key, meta_value] of onboardingMetaRows(input, start)) {
      try {
        // Upsert, not insert: re-running onboarding (after "Reset All Data",
        // or on a second device) must REPLACE the exam date and the dream
        // goal, never leave two rows under one key for metaMap to choose
        // between. upsertMetaKey also merges away historical duplicates.
        await upsertMetaKey(meta_key, meta_value);
      } catch {
        complete = false;
      }
    }
    // Legacy path only: a pending record from a build whose onboarding still
    // previewed a Day-1 plan. One line is one task, exactly as written.
    for (const line of dayOneTopics) {
      const { row, annotation } = dayOneItemRow(exam, line, start);
      try {
        await verifiedDbFrom(TABLES.items).insert(row);
      } catch {
        complete = false;
        continue;
      }
      try {
        await verifiedDbFrom(TABLES.meta).insert(annotation);
      } catch {
        /* the annotation self-heal pass retries this later */
      }
    }
    // Chapters the student already finished before joining — written through
    // the SAME data flow a normally completed task uses: a done zuno_items
    // row (with its approximate completion date), the standard task
    // annotation (carrying the structured chapter id when the chapter came
    // from the syllabus database), the spaced-revision rows, and a
    // recordStudySession feed into the adaptation engine (zuno_exam_progress
    // + zuno_topic_attempts) — so coverage, mastery, readiness and the AI
    // planner all see this ground as genuinely studied and never re-assign
    // it. Spaced revisions queue from the real study date: still-future
    // intervals stay pending; already-passed intervals are recorded as
    // skipped so the revision self-heal pass never floods Today with stale
    // overdues.
    const syllabusExam = exam ? getSyllabus(exam.id) ?? syllabusForProfileExam(exam.id) : undefined;
    for (const done of completed.slice(0, 60)) {
      const subject = done.subject || 'General';
      const key = topicKey(subject, done.chapter);
      const studiedOn = done.approxDate;
      const chapterId =
        done.chapterId && syllabusExam && findChapter(syllabusExam, done.chapterId) ? done.chapterId : null;
      await verifiedDbFrom(TABLES.items).insert({
        exam: exam?.id ?? 'general',
        subject,
        topic: done.chapter,
        kind: 'new',
        day_number: 1,
        scheduled_for: studiedOn,
        status: 'done',
        completed_at: localNoonTimestamp(studiedOn),
        studied_on: studiedOn,
        source_key: key,
      });
      try {
        await verifiedDbFrom(TABLES.meta).insert({
          meta_key: taskTypeKey(key),
          meta_value: JSON.stringify({
            type: 'Self Study',
            ai: false,
            ...(chapterId ? { syl: { cid: chapterId } } : {}),
          }),
        });
      } catch {
        /* the annotation self-heal pass retries this later */
      }
      await Promise.all(
        buildRevisionDrafts({ exam: exam?.id ?? 'general', subject, topic: done.chapter }, studiedOn).map((draft) =>
          verifiedDbFrom(TABLES.items).insert(
            (draft.scheduled_for >= start ? draft : { ...draft, status: 'skipped' }) as unknown as Record<
              string,
              unknown
            >,
          ),
        ),
      );
      if (chapterId && syllabusExam) {
        try {
          await recordStudySession(syllabusExam.id, chapterId, [done.chapter], 'medium', {
            now: new Date(`${studiedOn}T12:00:00`),
          });
        } catch {
          /* best-effort — the done item itself is already saved */
        }
      }
    }
    profileQ.refresh();
    metaQ.refresh();
    itemsQ.refresh();
    if (completed.length > 0) {
      examProgressQ.refresh();
      topicAttemptsQ.refresh();
    }
    return complete;
  };

  /**
   * Fill in whatever onboarding did NOT manage to save, for a student whose
   * profile row already exists. Idempotent by design — it reads the current
   * rows first and only writes what is absent — so it is safe to run on every
   * pass until the pending copy clears.
   *
   * This exists because the profile row is the app's “onboarding finished”
   * marker: once it lands, the student is let into an app that may still be
   * missing its exam date (Profile then shows the exam's default sitting),
   * its dream goal (the Vision Board then has nothing to anchor on) and, for
   * an older pending record, its Day-1 tasks. The old sync effect deleted the
   * local copy the moment it saw a profile row, so those were lost for good.
   *
   * Pre-completed chapters are deliberately NOT retried here — they fan out
   * into revision rows and mastery writes that are not safe to repeat, and a
   * missing one only costs some starting coverage, not the plan itself.
   */
  const backfillOnboardingToDb = async (input: FinishOnboardingInput, start: string): Promise<void> => {
    const { exam } = input;
    const dayOneTopics = input.topics ?? [];
    const wanted = onboardingMetaRows(input, start);
    const existingMeta = await fetchAllRows<{ id: number; meta_key: string; meta_value: string }>(
      TABLES.meta,
    );
    for (const [meta_key, meta_value] of wanted) {
      const current = existingMeta.find((row) => row.meta_key === meta_key);
      if (!current) {
        await verifiedDbFrom(TABLES.meta).insert({ meta_key, meta_value });
        continue;
      }
      // What the student actually chose in onboarding is an explicit answer
      // and outranks anything already stored (a default written by an
      // earlier, half-finished pass).
      const explicit =
        (meta_key === 'exam_date' && Boolean(input.date)) ||
        (meta_key === 'goals' && Boolean((input.goal ?? '').trim()));
      if (explicit && current.meta_value !== meta_value) {
        await verifiedDbFrom(TABLES.meta).update(current.id, { meta_value });
      }
    }

    if (dayOneTopics.length === 0) return;
    const existingItems = await fetchAllRows<{ id: number; topic: string; scheduled_for: string }>(
      TABLES.items,
    );
    const alreadyOnDayOne = new Set(
      existingItems
        .filter((row) => row.scheduled_for === start)
        .map((row) => (row.topic || '').trim().toLowerCase()),
    );
    for (const line of dayOneTopics) {
      if (alreadyOnDayOne.has((line ?? '').trim().toLowerCase())) continue;
      const { row, annotation } = dayOneItemRow(exam, line, start);
      await verifiedDbFrom(TABLES.items).insert(row);
      alreadyOnDayOne.add((line ?? '').trim().toLowerCase());
      try {
        await verifiedDbFrom(TABLES.meta).insert(annotation);
      } catch {
        /* the annotation self-heal pass retries this later */
      }
    }
    metaQ.refresh();
    itemsQ.refresh();
  };

  /**
   * Create the profile from the two things onboarding collected — the exam
   * and the dream goal. Both are optional at this level: a student who never
   * picked an exam still gets a working profile, and Vicharee fills the gap.
   *
   * No tasks are written here any more. The Day-1 plan preview is gone with
   * the rest of the front-loaded intake, so a brand-new student lands on an
   * honestly empty Today and Vicharee builds the first day with them in chat.
   *
   * NEVER gated on authentication: a brand-new student whose workspace session
   * is still being verified proceeds immediately on optimistic local state
   * (mirrored to localStorage), and the sync effect below writes everything to
   * WorkspaceDB the moment the verified session lands.
   */
  const finishOnboarding = async (input: FinishOnboardingInput) => {
    if (creating) return;
    setCreating(true);
    // The student is completing onboarding NOW — a pending "deliberate reset"
    // marker has served its purpose, so profile recovery may run again later.
    clearOnboardingResetMarker(spaceId);
    /* Fast path for this browser. The profile row written below remains the
     * cross-device source of truth; this cache only prevents a same-device
     * returning login from ever flashing onboarding while recovery starts. */
    cacheOnboardingComplete(spaceId, readSessionEmail(spaceId));
    const start = todayISO();
    const { exam } = input;
    const date = input.date ?? null;
    const goal = (input.goal ?? '').trim() || null;
    const dayOneTopics = (input.topics ?? []).map((line) => (line ?? '').trim()).filter(Boolean).slice(0, 20);
    const resolved: FinishOnboardingInput = { ...input, date, goal, topics: dayOneTopics };
    // Setup is done and the student is being let into the app — whether the
    // writes below land now or get synced later, this is the moment.
    trackEvent('onboarding_completed', {
      exam: trackedExamLabel(exam),
      days_to_exam: date ? Math.max(0, diffDays(start, date)) : null,
      has_goal: Boolean(goal),
    });
    /** Optimistic path: remember the choices locally, proceed now, sync later. */
    const proceedLocally = () => {
      const pending: PendingOnboarding = {
        examId: exam?.id ?? null,
        customExamJson: exam && isCustomExamId(exam.id) ? serializeCustomExam(exam) : null,
        date,
        topics: dayOneTopics,
        hours: input.hours ?? null,
        completed: input.completed ?? [],
        goal,
        registryExamId: input.registryExamId ?? null,
        sectionsJson: input.sectionsJson ?? null,
        start,
      };
      savePendingOnboarding(spaceId, pending);
      setPendingOnboarding(pending);
    };
    try {
      if (!dbSessionReady && !isDbWriteReady()) {
        // Session still connecting (brand-new user, pre-verification): never
        // block the button on it — save locally and move them straight in.
        //
        // This asks whether a write is worth ATTEMPTING, not whether the OTP
        // auth record vouches for the session. Asking the stricter question
        // sent every student whose login it does not track down the local
        // path on every pass, and the sync effect below is gated on the same
        // flag — so their exam and goal sat in localStorage and never reached
        // the database on any device.
        proceedLocally();
        return;
      }
      const complete = await writeOnboardingToDb(resolved, start);
      if (!complete) {
        // The profile landed but a meta row did not. Keeping the local copy
        // lets the sync effect backfill it instead of leaving the student on
        // a default exam date with no goal on their Vision Board.
        proceedLocally();
      }
    } catch (error) {
      // Whatever went wrong, what the student just chose is kept locally so
      // the sync effect can finish the job — the write may have got as far as
      // the profile row, and that row alone lets them into the app.
      proceedLocally();
      const message = error instanceof Error ? error.message : '';
      if (!/session/i.test(message)) {
        showToast("Saving your setup hit a snag — I'll finish it in the background.");
      }
    } finally {
      setCreating(false);
    }
  };

  /* Sync a pending (pre-verification) onboarding into WorkspaceDB as soon as
   * the verified session lands. Runs at most one write pass at a time, and
   * clears the local copy only once the write actually completed — when a
   * profile row already exists it backfills the missing pieces instead. */
  const pendingSyncRef = useRef(false);
  /* Each unfinished pass ends in a profileQ.refresh(), which re-triggers this
   * effect — fine for the two or three passes it takes a session to settle,
   * but it must not become an endless retry against a write the server keeps
   * refusing. The local copy survives either way, so a later visit starts the
   * count again. */
  const syncAttemptsRef = useRef(0);
  useEffect(() => {
    if (!pendingOnboarding || pendingSyncRef.current || !dbSessionReady || profileQ.loading) return;
    if (syncAttemptsRef.current >= 5) return;
    syncAttemptsRef.current += 1;
    pendingSyncRef.current = true;
    const exam = pendingExamDef(pendingOnboarding, today);
    const profileExists = (profileQ.data ?? []).length > 0;
    const pendingInput: FinishOnboardingInput = {
      exam,
      date: pendingOnboarding.date,
      goal: pendingOnboarding.goal,
      registryExamId: pendingOnboarding.registryExamId,
      sectionsJson: pendingOnboarding.sectionsJson,
      topics: pendingOnboarding.topics,
      hours: pendingOnboarding.hours,
      completed: pendingOnboarding.completed,
    };
    // A profile row already in the database does NOT mean the rest of
    // onboarding landed — it is written first, so a refused write straight
    // after it leaves the exam date and the dream goal missing. Backfill them
    // rather than discarding the only copy that still has them.
    const sync = profileExists
      ? backfillOnboardingToDb(pendingInput, pendingOnboarding.start).then(() => true)
      : writeOnboardingToDb(pendingInput, pendingOnboarding.start);
    void sync
      .then((complete) => {
        // An incomplete pass keeps the local copy so the next one finishes it.
        if (!complete) {
          profileQ.refresh();
          return;
        }
        clearPendingOnboarding(spaceId);
        setPendingOnboarding(null);
      })
      .catch(() => {
        // A partial write may have landed the profile row — refresh so the
        // next pass takes the backfill branch above.
        profileQ.refresh();
      })
      .finally(() => {
        pendingSyncRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOnboarding, dbSessionReady, profileQ.loading, profileQ.data, spaceId, today]);

  return {
    obStep,
    setObStep,
    obExam,
    setObExam,
    obDate,
    setObDate,
    obGoal,
    setObGoal,
    obCustomExam: obCustomExamState,
    setObCustomExam,
    obCustomOpen,
    setObCustomOpen,
    obSearch,
    setObSearch,
    obRegistryExamId,
    obSectionsJson,
    creating,
    trackExamSelected,
    acceptExam,
    finishOnboarding,
  };
}
