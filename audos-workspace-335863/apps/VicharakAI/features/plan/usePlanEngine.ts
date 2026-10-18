/**
 * Plan feature — assembles the ONE StudentState snapshot and derives the
 * daily plan, the "do this now" pick and the on-track verdict from the
 * deterministic engines (studyEngine.ts). Also owns the explainability log.
 * Extracted verbatim from App.tsx.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  assessOnTrack,
  buildDailyPlan,
  buildStudentState,
  whatShouldIDoNow,
  type DailyPlan,
  type NowRecommendation,
  type OnTrackVerdict,
  type StudentState,
} from '../../studyEngine';
import { addDaysISO, buildTopicSequence, chapterCoveredTopicKeys, topicKey } from '../../engine';
import { groupDoubtSignals } from '../../analytics';
import { verifiedDbFrom } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';
import type { StudentData } from '../../app/StudentDataContext';

export interface PlanEngineFeature {
  studentState: StudentState;
  dailyPlan: DailyPlan;
  nowPick: NowRecommendation | null;
  onTrack: OnTrackVerdict;
  nowSuggestion: string | null;
  tomorrowPicks: Array<{ subject: string; topic: string; reason: string }>;
  /** Explainability: store what was recommended, why, and from which data. */
  logRecommendation: (
    kind: string,
    recommendation: string,
    reason: string,
    dataUsed: string,
    actionTaken: string,
  ) => void;
}

export function usePlanEngine(data: StudentData): PlanEngineFeature {
  const {
    studentItems,
    annotations,
    sessions,
    scoreEntries,
    testResults,
    flaggedRows,
    feelingByKey,
    weakTopicInsights,
    readiness,
    examDef,
    profile,
    examDate,
    today,
    dailyGoal,
    capacityOverrideMinutes,
    pace,
    weakAreas,
    overdueRevisions,
    leastCoveredSubject,
    focusChapters,
    dbSessionReady,
    itemsQ,
    recommendationLogQ,
  } = data;

  /* ONE snapshot assembled from the same rows every screen already reads —
   * Today, the coach's quick answers and the AI context all consume it, so
   * no feature can ever show a number that disagrees with another. */
  const studentState = useMemo(
    () =>
      buildStudentState({
        items: studentItems,
        annotations,
        sessions,
        scoreEntries,
        testResults,
        doubts: flaggedRows,
        feelings: feelingByKey,
        weakInsights: weakTopicInsights,
        readiness,
        examDef,
        examId: profile?.exam ?? 'general',
        examDate,
        today,
        dailyGoalMinutes: (() => {
          const hours = Number(dailyGoal);
          return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;
        })(),
        capacityOverrideMinutes,
      }),
    [studentItems, annotations, sessions, scoreEntries, testResults, flaggedRows, feelingByKey, weakTopicInsights, readiness, examDef, profile?.exam, examDate, today, dailyGoal, capacityOverrideMinutes],
  );
  /* Capacity-aware MUST DO / SHOULD DO / IF TIME plan — never an impossible day. */
  const dailyPlan = useMemo(() => buildDailyPlan(studentState), [studentState]);
  /* The "what should I do now?" pick, computed from actual current state. */
  const nowPick = useMemo(() => whatShouldIDoNow(studentState), [studentState]);
  /* The multi-signal "Am I on track?" verdict (never just the streak). */
  const onTrack = useMemo(() => assessOnTrack(studentState, pace), [studentState, pace]);

  /** Explainability: store what was recommended, why, and from which data. */
  const logRecommendation = (
    kind: string,
    recommendation: string,
    reason: string,
    dataUsed: string,
    actionTaken: string,
  ) => {
    void verifiedDbFrom(TABLES.recommendationLog)
      .insert({ kind, recommendation, reason, data_used: dataUsed, action_taken: actionTaken, created_on: today })
      .then(() => recommendationLogQ.refresh())
      .catch(() => undefined);
  };

  /* The day's plan is logged once per day — so "why this plan?" always has a
   * stored, data-grounded answer, even after the plan itself has moved on. */
  const planLogRef = useRef('');
  useEffect(() => {
    if (!dbSessionReady || !profile || itemsQ.loading || recommendationLogQ.loading) return;
    if (dailyPlan.mustDo.length === 0) return;
    const stamp = `${today}:${dailyPlan.mustDo.map((entry) => entry.item.id).join(',')}`;
    if (planLogRef.current === stamp) return;
    planLogRef.current = stamp;
    const already = (recommendationLogQ.data ?? []).some((row) => row.kind === 'daily-plan' && row.created_on === today);
    if (already) return;
    logRecommendation(
      'daily-plan',
      dailyPlan.mustDo.map((entry) => entry.item.topic).join(' · '),
      dailyPlan.mustDo.map((entry) => entry.reasons[0] ?? '').filter(Boolean).join(' · '),
      `capacity ~${dailyPlan.capacityMinutes}m (${dailyPlan.capacitySource}) · ${studentState.dueRevisions.length} revisions due · ${studentState.overdueTasks.length} carried tasks`,
      'planned',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, profile?.id, itemsQ.loading, recommendationLogQ.loading, dailyPlan, today]);

  /* VicharakAI's proactive "what to do now" pick — deterministic, built from
   * the student's own data, shown while nothing is in session. */
  const nowSuggestion = useMemo(() => {
    if (nowPick) return `${nowPick.headline} ${nowPick.reason}`;
    if (flaggedRows.length > 0) {
      return flaggedRows.length === 1
        ? 'Nothing queued — revise the question you saved below.'
        : `Nothing queued — revise one of your ${flaggedRows.length} saved questions below.`;
    }
    if (weakAreas.length > 0) {
      return `Nothing queued — ${weakAreas[0].label} is your weakest area right now; ask the coach and it lands on your plan.`;
    }
    return null;
  }, [nowPick, flaggedRows, weakAreas]);

  const tomorrowPicks = useMemo(() => {
    if (!examDef) return [] as Array<{ subject: string; topic: string; reason: string }>;
    const picks: Array<{ subject: string; topic: string; reason: string }> = [];
    const seen = new Set<string>();
    const add = (subject: string, topic: string, reason: string) => {
      const key = topicKey(subject, topic);
      if (!seen.has(key)) {
        seen.add(key);
        picks.push({ subject, topic, reason });
      }
    };
    const tomorrow = addDaysISO(today, 1);
    studentItems
      .filter((item) => item.status === 'pending' && item.scheduled_for === tomorrow)
      .forEach((item) => add(item.subject, item.topic, 'already queued for tomorrow'));
    // Chapters the student's Mistake Book flags come right after what's
    // already queued — a Kirchhoff's Laws entry pushes Current Electricity up.
    groupDoubtSignals(flaggedRows)
      .slice(0, 2)
      .forEach((g) =>
        add(
          g.subject,
          g.chapter,
          g.count === 1
            ? 'your Mistake Book flags this — clear the weak spot'
            : `${g.count} Mistake Book entries flag this — clear the weak spot`,
        ),
      );
    overdueRevisions.slice(0, 1).forEach((item) => add(item.subject, item.topic, 'a revision is due'));
    const assigned = new Set(studentItems.map((item) => item.source_key || topicKey(item.subject, item.topic)));
    // A chapter completed as one task covers all of its topics — completed
    // ground (e.g. marked during onboarding) is never suggested again.
    for (const key of chapterCoveredTopicKeys(examDef, studentItems)) assigned.add(key);
    const fresh = buildTopicSequence(examDef).filter((entry) => !assigned.has(topicKey(entry.subject, entry.topic)));
    // The student's own weekly plan outranks generic coverage — topics from
    // this week's focus chapters surface first, so the AI and the plan the
    // student wrote for themselves always agree.
    const weeklyFocusSet = new Set(focusChapters.map((c) => `${c.subject}|${c.chapter}`));
    const inWeeklyFocus = (entry: { subject: string; chapter: string }) => weeklyFocusSet.has(`${entry.subject}|${entry.chapter}`);
    fresh
      .sort(
        (a, b) =>
          Number(inWeeklyFocus(b)) - Number(inWeeklyFocus(a)) ||
          Number(b.subject === leastCoveredSubject) - Number(a.subject === leastCoveredSubject),
      )
      .slice(0, 4)
      .forEach((entry) =>
        add(
          entry.subject,
          entry.topic,
          inWeeklyFocus(entry)
            ? 'in your weekly plan'
            : entry.subject === leastCoveredSubject
              ? 'closes your biggest coverage gap'
              : 'keeps your syllabus moving',
        ),
      );
    return picks.slice(0, 3);
  }, [examDef, studentItems, overdueRevisions, leastCoveredSubject, flaggedRows, focusChapters, today]);

  return { studentState, dailyPlan, nowPick, onTrack, nowSuggestion, tomorrowPicks, logRecommendation };
}
