/**
 * TestOverlays — photo→tasks, quiz sheets, Test Mode, Generate Test, Weekly Targets and the image lightbox.
 * JSX extracted verbatim from App.tsx.
 */
/* eslint-disable */
import {
  AMBER, BORDER, BORDER_STRONG, BRAND_GRADIENT, CARD, DANGER, NAVY_ALT, ON_AMBER, OVERLAY_BG,
  RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, tint,
} from '../../theme';
import { PhotoTasksSheet } from '../../PhotoTasks';
import { GenerateQuizSheet, QuizPlayer } from '../../QuizSheets';
import { TestResultsView, TestRunner, TestSetupSheet } from '../../TestMode';
import { GeneratedTestRunner, GenerateTestSheet } from '../../GenerateTest';
import { FlaggedTestSetupSheet } from '../../FlaggedQuestions';
import { MCQ_LETTERS, flaggedOptions } from '../../mcq';
import { ENABLE_AUTO_QUESTION_GEN } from '../../config/sharedConfig';
import { mockPracticePlan } from '../testAnalysis/taSelectors';
import { WeeklyTargetsScreen } from '../../WeeklyTargetsScreen';
import { ImageLightbox } from '../../Attachments';
import { examLabelFromId } from '../../customExam';
import { inferSubjectForTopic } from '../../syllabus';
import { useApp } from '../../app/AppContext';

export default function TestOverlays() {
  const { data, toast, access: accessCtl, doubts, tests, analysis, tab, setTab } = useApp();
  /* [Back → Today] Leaving a study flow must land on Today — never back on
   * the AI chat screen it may have been opened over. */
  const backToToday = () => {
    if (tab === 'coach') setTab('today');
  };
  const access = accessCtl.access;
  const {
    spaceId, today, profile, examDef, savedExamLabel, testResults, testTopicOptions, chapterStats,
    focusChapters, focusReason, weeklyRow, weeklyTopicsDone, weeklyTestsDone, activeSyllabusExam,
    quickAddSubjects, flaggedRows, daysToExam, monthlyChapters, doneTopicKeys, topicPickerSubjects,
  } = data;
  const subjectNames = examDef?.subjects.map((s) => s.name) ?? [];
  const { showToast } = toast;
  const { chargeAi, openPaywall } = accessCtl;
  const { autoQueueWrongQuestion, openMistakeUpload } = doubts;
  const {
    photoTasksOpen, setPhotoTasksOpen, addingPhotoTasks, handlePhotoTasks, quizTarget,
    setQuizTarget, quizAdaptive, prepareQuizQuestions, handleQuizGenerated, activeQuiz, setActiveQuiz,
    attachmentsForQuestion, attachImageToQuestion, attachBusy, setLightboxUrl, lightboxUrl,
    testSetupOpen, setTestSetupOpen, testPreparing, testPrepareNote, testError, startTest,
    activeTest, setActiveTest, handleTestSubmit, testReview, setTestReview, generateTestOpen,
    setGenerateTestOpen, generateTestPreparing, generateTestError, startGenerateTest,
    activeGeneratedTest, setActiveGeneratedTest, resolveGeneratedQuestion, weeklyScreenOpen,
    setWeeklyScreenOpen, targetsScope, savingWeekly, saveWeeklyTargets, savingMonthly,
    saveMonthlyTargets, lastWeekLine, flaggedTestOpen,
    setFlaggedTestOpen, flaggedPreparing, flaggedPrepareNote, flaggedTestError, startFlaggedTest,
    activeFlaggedTest, handleFlaggedTestSubmit,
  } = tests;
  const examName = examDef?.name ?? (savedExamLabel || (profile ? examLabelFromId(profile.exam) : 'Your exam'));
  const generatedPracticePlan = mockPracticePlan({
    entries: analysis.entries,
    config: analysis.examConfig,
    doubtsByTopic: analysis.doubtsByTopic,
    syllabus: topicPickerSubjects,
  });

  if (!profile) return null;

  return (
    <>
      {/* PART 5: the recurring daily/weekly motivation popup was removed. */}

      {/* Photo → tasks — snap notes, review the extracted checklist, add all */}
      {photoTasksOpen && (
        <PhotoTasksSheet
          subjects={quickAddSubjects.length > 0 ? quickAddSubjects : subjectNames}
          inferSubject={(title) => inferSubjectForTopic(examDef, title)}
          spaceId={spaceId}
          canAskAi={access.premiumUnlocked}
          onAiBlocked={() => openPaywall('scan')}
          onAiCharged={chargeAi}
          adding={addingPhotoTasks}
          onAdd={(tasks, imageUrl) => handlePhotoTasks(tasks, imageUrl)}
          onClose={() => setPhotoTasksOpen(false)}
        />
      )}

      {/* Generate Quiz — from the mission, a task row or the task editor */}
      {quizTarget && (
        <GenerateQuizSheet
          target={quizTarget}
          adaptive={quizAdaptive}
          onGenerate={(count, difficulty) => prepareQuizQuestions(quizTarget, count, difficulty)}
          onGenerated={(drafts) => void handleQuizGenerated(drafts)}
          onClose={() => setQuizTarget(null)}
        />
      )}

      {/* Practice quiz — one question at a time, instant feedback */}
      {activeQuiz && (
        <QuizPlayer
          questions={activeQuiz.questions}
          title={activeQuiz.title}
          attachmentsFor={attachmentsForQuestion}
          attachBusy={attachBusy}
          onAttachImage={(question, file) => void attachImageToQuestion(question, file)}
          onExpandImage={setLightboxUrl}
          onWrong={(question) => void autoQueueWrongQuestion(question)}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      {/* Test Mode — setup, timed runner, results */}
      {testSetupOpen && (
        <TestSetupSheet
          topics={testTopicOptions}
          preparing={testPreparing}
          prepareNote={testPrepareNote}
          error={testError}
          completedTopicKeys={doneTopicKeys}
          onStart={(config) => void startTest(config)}
          onClose={() => setTestSetupOpen(false)}
        />
      )}
      {activeTest && (
        <TestRunner
          questions={activeTest.questions}
          timeLimitMinutes={activeTest.timeLimitMinutes}
          examName={examName}
          onSubmit={(answers, durationSeconds) => void handleTestSubmit(answers, durationSeconds)}
          onCancel={() => {
            setActiveTest(null);
            backToToday();
          }}
        />
      )}
      {testReview && (
        <TestResultsView
          review={testReview}
          onUploadMistake={(sourceLabel, subject) => openMistakeUpload({ sourceLabel, subject })}
          onLogWrongReason={async (question, picked, reason) => {
            // [Feature 3] Files the wrong answer + reason into the mistake
            // book with its concept tag; 'No Revision' additionally queues
            // the question back into the spaced revision loop (1/3/7/14).
            await tests.logWrongAnswerReason(question, picked, reason);
            if (reason === 'No Revision') void autoQueueWrongQuestion(question);
          }}
          onClose={() => {
            setTestReview(null);
            backToToday();
          }}
        />
      )}

      {/* Phase 3 Generate Test — mock logs choose the targets by marks lost.
          The plan refuses thin evidence and excludes behavioural error mixes;
          question assembly still uses the shared bank + MCQ generator. */}
      {generateTestOpen && (
        <GenerateTestSheet
          plan={generatedPracticePlan}
          examConfig={analysis.examConfig}
          loading={analysis.entriesQ.loading || analysis.configsQ.loading}
          preparing={generateTestPreparing}
          error={generateTestError}
          onStart={() => void startGenerateTest(generatedPracticePlan)}
          onClose={() => setGenerateTestOpen(false)}
        />
      )}
      {activeGeneratedTest && (
        <GeneratedTestRunner
          questions={activeGeneratedTest}
          onResolve={resolveGeneratedQuestion}
          onClose={() => {
            setActiveGeneratedTest(null);
            backToToday();
          }}
        />
      )}

      {/* [Feature 4] Practice saved questions — the timed Mistake Book test.
          With AI question generation off, only entries that already carry four
          options AND a known answer are offered (open-ended ones would need
          the disabled question→MCQ conversion). */}
      {flaggedTestOpen && (
        <FlaggedTestSetupSheet
          rows={ENABLE_AUTO_QUESTION_GEN
            ? flaggedRows
            : flaggedRows.filter((row) => {
                const letter = String(row.correct ?? '').trim().toUpperCase().charAt(0);
                return !!flaggedOptions(row) && (MCQ_LETTERS as string[]).includes(letter);
              })}
          preparing={flaggedPreparing}
          prepareNote={flaggedPrepareNote}
          error={flaggedTestError}
          onStart={(pool, count, timeLimitMinutes) => void startFlaggedTest(pool, count, timeLimitMinutes)}
          onClose={() => setFlaggedTestOpen(false)}
        />
      )}
      {activeFlaggedTest && (
        <TestRunner
          questions={activeFlaggedTest.questions}
          timeLimitMinutes={activeFlaggedTest.timeLimitMinutes}
          examName={examName}
          onSubmit={(answers, durationSeconds) => void handleFlaggedTestSubmit(answers, durationSeconds)}
          onCancel={() => {
            tests.setActiveFlaggedTest(null);
            backToToday();
          }}
        />
      )}

      {/* Weekly Targets — a dedicated FULL SCREEN: syllabus chapter chips,
          "Let AI choose for me", topic + test goals. Never a popup. */}
      {weeklyScreenOpen && (
        <WeeklyTargetsScreen
          examLabel={examDef?.target.label || savedExamLabel || examName}
          daysToExam={daysToExam}
          subjects={(examDef?.subjects ?? []).map((subject) => ({
            name: subject.name,
            chapters: subject.chapters.map((chapter) => chapter.name),
          }))}
          stats={chapterStats}
          initialSelected={focusChapters}
          initialReason={focusReason}
          initialTopicTarget={weeklyRow ? Math.max(1, Number(weeklyRow.topic_target)) : 5}
          initialTestTarget={weeklyRow ? Math.max(1, Number(weeklyRow.test_target)) : 1}
          topicsDone={weeklyTopicsDone}
          testsDone={weeklyTestsDone}
          lastWeekLine={weeklyRow ? null : lastWeekLine}
          saving={savingWeekly}
          canAskAi={access.canAskAi}
          onAiBlocked={() => openPaywall('chat')}
          onAiCharged={chargeAi}
          onSave={(topicTarget, testTarget, chapters, reason) =>
            void saveWeeklyTargets(topicTarget, testTarget, chapters, reason)}
          onClose={() => setWeeklyScreenOpen(false)}
          initialScope={targetsScope}
          monthLabel={new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { month: 'long' })}
          monthlyChapters={monthlyChapters}
          savingMonthly={savingMonthly}
          onSaveMonthly={(chapters) => void saveMonthlyTargets(chapters)}
        />
      )}

      {/* Expanded view of any attached image */}
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

    </>
  );
}
