/**
 * Central WorkspaceDB table registry — the ONE place table names live.
 *
 * NAMING NOTE (zuno → VicharakAI rename): the PHYSICAL table names keep the
 * legacy `zuno_` prefix because they hold live student data (hundreds of
 * rows) and because the platform's registered server functions (zuno-today,
 * zuno-mark-done, zuno-log-topic, zuno-log-time, zuno-history,
 * zuno-save-profile) read and write the same tables by these names.
 * WorkspaceDB offers no table rename from the app side — a physical rename
 * would need a founder-approved Otto migration of both the data AND all six
 * study hooks in one step. Until then, code refers to tables ONLY through
 * this registry, so a future rename is a one-file change here (plus the
 * hooks).
 */

export const TABLES = {
  /** One row per student: chosen exam + plan start date + profiling answers. */
  profile: 'zuno_profile',
  /** Tasks + spaced revisions — the study plan itself. */
  items: 'zuno_items',
  /** Per-student key-value store (task annotations, exam date, goals…). */
  meta: 'zuno_meta',
  /** Legacy percentage-only test scores (kept for old rows). */
  legacyScores: 'zuno_scores',
  /** Marks-based test results logged by the student. */
  testScores: 'zuno_test_scores',
  /** Mistakes logged against a test row. */
  mistakes: 'zuno_mistakes',
  /** Recorded study time. */
  sessions: 'zuno_sessions',
  /** Post-task Hard/Medium/Easy signals. */
  taskFeedback: 'zuno_task_feedback',
  /** Per-student AI questions plus served shared-bank question history. */
  mcqQuestions: 'zuno_mcq_questions',
  /** Test Mode submissions (per-topic breakdown JSON). */
  testResults: 'zuno_test_results',
  /** Weekly targets. */
  weeklyTargets: 'zuno_weekly_targets',
  /** Images attached to tasks/questions. */
  attachments: 'zuno_attachments',
  /** Saved doubt questions (the question revision queue). */
  questionQueue: 'zuno_question_queue',
  /** Per-chapter mastery for the adaptation engine. */
  examProgress: 'zuno_exam_progress',
  /** Topic attempt event log (studied / correct / wrong). */
  topicAttempts: 'zuno_topic_attempts',
  /** Weakness scores per topic. */
  weakTopics: 'zuno_weak_topics',
  /** Latest readiness snapshot per exam. */
  readiness: 'zuno_readiness',
  /** Explainability log for recommendations. */
  recommendationLog: 'zuno_recommendation_log',
  /** Per-student AI Coach transcript, restored across logins and devices. */
  coachMessages: 'vicharakai_coach_messages',
  /** Shared official syllabus rows synchronized by the Apify server function. */
  examSyllabi: 'exam_syllabi',
  /** Shared per-exam structure/timing/scoring facts. Server-write only. */
  examMetadata: 'exam_metadata',
  /** Shared US-exam practice question bank. Server-write only. */
  examQuestionsBank: 'exam_questions_bank',
  /** Shared exam registry — identity, format, marking, scale. Server-write only. */
  examRegistry: 'vicharakai_exams',
  /** Shared sections/papers per exam. Server-write only; the Vision Board
   * reads it to name the paper each subject cluster sits in. */
  examSections: 'vicharakai_exam_sections',
  /** Shared notoriously-hard topics per exam. Server-write only. */
  examHardTopics: 'vicharakai_exam_hard_topics',
  /** Legacy daily-practice check-offs (pre-rebuild builds wrote these). */
  habits: 'zuno_habits',
  /** Paid-plan entitlements — written by payment hooks. NEVER reset. */
  subscriptions: 'vicharakai_subscriptions',
  /** 3-day free-trial records — insert-only by design. NEVER reset. */
  trials: 'vicharakai_trials',
  /** Mock sessions logged in the Test Analysis tab (step 1 of analysis). */
  mockSessions: 'vicharakai_mock_sessions',
  /** Full paper pages uploaded for a mock session (unprocessed tray lives here). */
  mockSourceImages: 'vicharakai_source_images',
  /** Cropped/whole-page question entries with reason + topic tags. */
  mockQuestionEntries: 'vicharakai_question_entries',
  /** Per-topic rollup derived from tagged mock entries. */
  mockTopicMastery: 'vicharakai_topic_mastery',
  /** Test Analysis preferences (timing opt-in, tag-suggestion switch). */
  analysisPrefs: 'vicharakai_analysis_prefs',
  /** Read-only analysis share links (student-initiated, revocable). */
  analysisShares: 'vicharakai_analysis_shares',
  /** Editable per-exam marking schemes (ExamConfig rows) for mock analysis. */
  examConfigs: 'vicharakai_exam_configs',
  /** Practice-tab PYQ attempts: seeded-bank question id, the option picked,
   * correctness and time taken — drives the adaptive "For You" queue. */
  questionAttempts: 'vicharakai_question_attempts',

  /* ---------- PYQ (Previous Year Questions) infrastructure ----------
   * SHARED REFERENCE DATA, not student state: real questions imported from
   * official sources with full provenance (see apps/VicharakAI/pyq/).
   * Deliberately NOT in STUDENT_DATA_TABLES — a student data reset must
   * never touch the shared question bank. */
  /** Exams the PYQ bank covers (NEET UG, JEE Main, UPSC CSE, …). */
  pyqExams: 'pyq_exams',
  /** One row per (exam, year) with import/verification progress. */
  pyqExamYears: 'pyq_exam_years',
  /** Subjects per exam (PYQ taxonomy). */
  pyqSubjects: 'pyq_subjects',
  /** Chapters per subject (PYQ taxonomy). */
  pyqChapters: 'pyq_chapters',
  /** Topics (PYQ taxonomy; chapter optional). */
  pyqTopics: 'pyq_topics',
  /** Concepts (finest PYQ taxonomy level). */
  pyqConcepts: 'pyq_concepts',
  /** The real previous-year questions themselves (origin_type 'official_pyq'). */
  pyqQuestions: 'pyq_questions',
  /** Verbatim MCQ options per question. */
  pyqOptions: 'pyq_options',
  /** The verified correct answer per question, with its source. */
  pyqAnswers: 'pyq_answers',
  /** Provenance rows (official website/PDF/answer key). */
  pyqSources: 'pyq_sources',
  /** Ingestion batches (idempotency + resume). */
  pyqImportBatches: 'pyq_import_batches',
  /** Likely-duplicate question pairs awaiting review. */
  pyqDuplicateCandidates: 'pyq_duplicate_candidates',
} as const;

export type TableKey = keyof typeof TABLES;

/**
 * Every table "Reset All Data" must clear, in deletion order. Maintained
 * CENTRALLY so a future study table cannot be forgotten by the reset:
 * add the table to TABLES above AND to this list in the same change.
 *
 * Deliberately excluded (auth/entitlement data and shared reference data,
 * NOT this student's study state):
 *  - vicharakai_subscriptions — paid entitlements survive a data reset.
 *  - vicharakai_trials — insert-only by policy; the trial clock never resets.
 *  - exam_syllabi, exam_metadata, exam_questions_bank — shared, server-written
 *    reference data belonging to every student, not to this one.
 *  - vicharakai_exams, vicharakai_exam_sections, vicharakai_exam_hard_topics —
 *    the shared exam registry, same reason.
 *  - pyq_* (all twelve PYQ tables) — the shared official question bank and
 *    its taxonomy/provenance; belongs to every student, never reset.
 *
 * The profile row goes LAST — while it exists the app still renders
 * normally, so a half-finished reset never strands the student on a
 * broken screen.
 */
export const STUDENT_DATA_TABLES: string[] = [
  TABLES.items,
  TABLES.sessions,
  TABLES.legacyScores,
  TABLES.testScores,
  TABLES.mistakes,
  TABLES.taskFeedback,
  TABLES.mcqQuestions,
  TABLES.testResults,
  TABLES.weeklyTargets,
  TABLES.attachments,
  TABLES.questionQueue,
  TABLES.examProgress,
  TABLES.topicAttempts,
  TABLES.weakTopics,
  TABLES.readiness,
  TABLES.recommendationLog,
  TABLES.coachMessages,
  TABLES.habits,
  TABLES.mockQuestionEntries,
  TABLES.mockSourceImages,
  TABLES.mockSessions,
  TABLES.mockTopicMastery,
  TABLES.analysisPrefs,
  TABLES.analysisShares,
  TABLES.examConfigs,
  TABLES.questionAttempts,
  TABLES.meta,
  TABLES.profile,
];
