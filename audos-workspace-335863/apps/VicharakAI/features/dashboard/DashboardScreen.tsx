/**
 * DashboardScreen — the performance dashboard tab — consumes ONLY prepared data from the provider and hands it to DashboardTab.
 * JSX extracted verbatim from App.tsx; state and actions come from the
 * feature hooks via useApp().
 */
/* eslint-disable */
import { ChevronRight, Clock, Compass, LineChart, Plus, Timer, Trophy } from 'lucide-react';
import DashboardTab from '../../DashboardTab';
import RoastMe from './RoastMe';
import { examLabelFromId } from '../../customExam';
import { formatDuration } from '../../engine';
import { AMBER, BORDER, BRAND, BRAND_GRADIENT, CARD, INK, INK_SOFT, ON_AMBER, PAPER_SUNK, RADIUS, RULE, SHEET, TEXT, TEXT_SECONDARY, tint } from '../../theme';
import { useApp } from '../../app/AppContext';

export default function DashboardScreen() {
  const { data, tasks, tests, setTab } = useApp();
  const {
    profile, examDef, savedExamLabel, todayMinutes, subjectProgress, scoreEntries, subjectScores,
    mistakes, sessions, studentItems, annotations, taskDetails, streak, pace, examDate, daysToExam,
    flaggedRows, weakTopicRows, progressRows, activeSyllabusExam, weakTopicInsights, readiness,
    recommendationLogQ, dueRevisionsAll, doneToday, weekDays, completedByDate, today, weeklyRow,
    weeklyTopicsDone, weeklyTestsDone, testResults, attemptRows, hoursSnapshot, metrics,
  } = data;
  const { promptForStudyTime, setFocusOpen } = tasks;
  const { openTestSetup, setGenerateTestOpen, setGenerateTestError, handleSaveScore, handleDeleteScore, handleAddMistake, handleDeleteMistake } = tests;
  const { studentName } = data;
  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const examName = examDef?.name ?? (savedExamLabel || (profile ? examLabelFromId(profile.exam) : 'Your exam'));

  return (
    <>
          <div className="flex-1 min-h-0 flex flex-col w-full lg:max-w-[1000px] lg:mx-auto">
            <div className="flex items-center justify-between gap-2 flex-wrap px-4 pt-5 pb-2 flex-shrink-0">
              {/* Titled "Progress" because that is the word on the tab that
                  opens it — the heading used to say "Dashboard", so tapping
                  Progress landed you on a screen that appeared to be some
                  other place. */}
              <h1 className="text-lg font-extrabold" style={{ color: TEXT }}>Progress</h1>
              {/* Horizontally scrollable on narrow screens so no action is ever clipped. */}
              <div className="flex items-center gap-2 min-w-0 max-w-full overflow-x-auto vicharak-scroll-x">
                {/* [Feature 2] 🔥 Roast Me — an AI roast driven by (and consistent with) the student's real stats. */}
                <RoastMe />
                <button
                  type="button"
                  onClick={promptForStudyTime}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation flex-shrink-0 whitespace-nowrap"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                  data-testid="button-log-study-time"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {todayMinutes > 0 ? formatDuration(todayMinutes) : 'Log time'}
                </button>
                <button
                  type="button"
                  onClick={() => setFocusOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation flex-shrink-0 whitespace-nowrap"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                  data-testid="button-focus-mode"
                >
                  <Timer className="w-3.5 h-3.5" />
                  Focus
                </button>
                <button
                  type="button"
                  onClick={openTestSetup}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation flex-shrink-0 whitespace-nowrap"
                  style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.14), border: `1px solid ${tint(AMBER, 0.35)}`, color: AMBER }}
                  data-testid="button-take-test"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Take a Test
                </button>
                {/* "Log a Score" is GONE as a standalone entry — score logging
                    is step 1 inside the Test Analysis tab, so this opens it. */}
                <button
                  type="button"
                  onClick={() => setTab('analysis')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation flex-shrink-0 whitespace-nowrap"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }}
                  data-testid="button-open-analysis"
                >
                  <LineChart className="w-3.5 h-3.5" />
                  Test Analysis
                </button>
                {/* [Fix 3] + New Test — the Generate Test flow, front and
                    centre on the Tests/Dashboard screen (never a submenu). */}
                <button
                  type="button"
                  onClick={() => {
                    setGenerateTestError(null);
                    setGenerateTestOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-extrabold touch-manipulation transition-transform active:scale-95 flex-shrink-0 whitespace-nowrap"
                  style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, boxShadow: '0 6px 16px rgba(0,151,184,0.24)' }}
                  data-testid="button-new-test"
                >
                  <Plus className="w-4 h-4" />
                  New Test
                </button>
              </div>
            </div>
            {/* Vision Board — THE mobile entry point (no bottom-nav slot). */}
            <button
              type="button"
              onClick={() => setTab('vision')}
              className="flex-shrink-0 mx-4 mb-2 px-4 py-3.5 flex items-center gap-3 text-left touch-manipulation"
              style={{
                borderRadius: RADIUS.md,
                background: SHEET,
                border: `1px solid ${RULE}`,
                boxShadow: `inset 0 0 0 1px ${PAPER_SUNK}`,
              }}
              data-testid="button-open-vision-board"
            >
              <span
                aria-hidden="true"
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 38, height: 38, borderRadius: 999, background: BRAND, color: '#fff' }}
              >
                <Compass className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-extrabold" style={{ color: INK }}>
                  Vision board
                </span>
                <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: INK_SOFT }}>
                  Your dream goal on a pinboard — topics strung around it, colour-coded by accuracy
                </span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: INK_SOFT }} />
            </button>

            {/* [Time saved] The weekly roll-up — priced by the SAME decay
                model that schedules revisions (metrics.weeklyTimeSaved), and
                only shown once real revisions happened this week. */}
            {metrics.weeklyTimeSaved.revisionsDone > 0 && (
              <p
                className="mx-4 mb-2 px-3.5 py-2.5 text-[12px] font-bold flex-shrink-0"
                style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.25)}`, color: TEXT_SECONDARY }}
                data-testid="text-week-time-saved"
              >
                This week: {formatDuration(metrics.weeklyTimeSaved.revisionMinutes)} of revision — roughly{' '}
                {formatDuration(metrics.weeklyTimeSaved.relearnAvoidedMinutes)} of relearning avoided.
              </p>
            )}
            <div className="flex-1 min-h-0">
              <DashboardTab
                items={studentItems}
                annotations={annotations}
                scoreEntries={scoreEntries}
                mistakes={mistakes}
                doubts={flaggedRows}
                sessions={sessions}
                examDef={examDef}
                examName={examName}
                studentName={studentName}
                examDate={examDate}
                pace={pace}
                today={today}
                streak={streak}
                subjectNames={subjectNames}
                onSaveScore={handleSaveScore}
                onDeleteScore={handleDeleteScore}
                onAddMistake={handleAddMistake}
                onDeleteMistake={handleDeleteMistake}
              />
            </div>
          </div>
    </>
  );
}
