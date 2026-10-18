/**
 * useTestAnalysis — state + actions for the Test Analysis tab (mock test
 * analysis). Owns every read/write of the vicharakai_mock_* tables and the
 * bridges into the EXISTING engines:
 *
 *  - Score feed: creating a mock session also logs the score through the
 *    existing tests feature (tests.handleLogTestScore), so subject averages,
 *    trends and the adaptation engine keep reacting to real results. The mock
 *    session totals entered at Step 1 remain THE source of accuracy/score.
 *  - Weakness feed: the moment a wrong question becomes fully tagged (an
 *    error tag PLUS a syllabus topic), it is fed once to recordTestResult —
 *    the same writer Test Mode and the Practice tab use — so zuno_weak_topics,
 *    Exam Insights and Today's priorities react to mock misses too.
 *  - Marking scheme: every marks figure comes from the exam's ExamConfig row
 *    (vicharakai_exam_configs, seeded here from the shipped presets and
 *    editable afterwards). marks_delta is derived, never stored.
 *  - Deck scope: tagging a question does NOT create a deck card. A concept
 *    gap or couldn't-apply miss gets a DUE DATE from the ONE scheduler
 *    (revisionEngine) and becomes a card in the EXISTING doubt deck
 *    (zuno_question_queue) only once that date arrives (`promoteDueEntries`).
 *    Careless and out-of-time NEVER enter the deck — they feed nudges and the
 *    pacing report instead. Cap: 5 promotions per mock.
 *  - OCR: crops are read by the Tesseract Web Worker FIRST
 *    (doubtOcr.recognizeText, never on the main thread) and escalate to the
 *    AI vision model only when the local read fails the cascade gate
 *    (confidence < 60, text < 15 chars, or no syllabus topic match). The
 *    escalation rate is logged as an internal cost metric — never shown.
 *    OCR text itself is INTERNAL: the cropped image is the display surface.
 *  - Concept gaps: Tesseract text is no longer the PRIMARY signal for concept
 *    detection. A garbled read keyword-matches to nothing, which used to
 *    leave predicted_topic_id null and a concept_gap tag with nothing behind
 *    it. The syllabus keyword match still runs first; when it cannot carry
 *    the entry, the CROP goes to the vision model (conceptGap.ts) and the
 *    concept + gap sentence it returns is stored on the entry.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDaysISO } from '../../engine';
import { uploadImage } from '../../Attachments';
import {
  OCR_MIN_CONFIDENCE,
  aiOcrText,
  cleanOcrQuestionText,
  dataUrlToJpegFile,
  fileToCleanJpeg,
  recognizeText,
  tidyOcrText,
} from '../../doubtOcr';
import { calculateNextRevision, nextOpenRevisionDay } from '../../revisionEngine';
import { DOUBTS_DAILY_CAP, MAX_ACTIVE_DOUBTS } from '../../config/revision';
import { fullMockSubjects } from '../../TestScoresTab';
import { flaggedDueOn, type FlaggedRow } from '../../mcq';
import { buildTagCatalog, ruleTagQuestion } from '../doubts/autoTag';
import { fetchAllRows, fetchRowsWhere, runExclusive, useAllRows, verifiedDbFrom, type AllRowsResult } from '../../services/database/dbClient';
import { useAccountSessionIds } from '../../services/database/accountScope';
import { isSessionVerificationError } from '../../sessionGuard';
import { upsertMetaKey } from '../../services/database/metaRepository';
import { TABLES } from '../../services/database/tables';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';
import type { AccessFeature } from '../access/useAccess';
import type { TestsFeature } from '../tests/useTests';
import { matchTaskToChapter } from '../../adaptationEngine';
import { topicIdFor, type ExamSyllabus } from '../../data/syllabuses';
import { recordTestResult } from '../mastery/masteryService';
import { notifyAnalysisWrongTopic } from '../coach/vichareeSignals';
import { computeTopicMastery, doubtVolumeByTopic, suggestErrorTag } from './taSelectors';
import { predictTopic, type TopicPrediction } from './topicPredict';
import { analyzeConceptGap, type ConceptGapAnalysis, type ConceptGapExamContext } from './conceptGap';
import { extractQuestionsFromImage } from './aiExtract';
import {
  EXAM_CONFIG_SEEDS,
  parseExamConfigRow,
  regionalTemplateMatchesExam,
  resolveExamConfig,
  type ExamConfig,
  type ExamConfigRow,
} from './examConfig';
import {
  CONCEPT_GAP_AUTO_CAP_PER_MOCK,
  CONCEPT_GAP_WRITE_CONFIDENCE,
  OCR_ESCALATE_BELOW_CHARS,
  OCR_ESCALATE_BELOW_CONFIDENCE,
  OCR_ESCALATION_META_KEY,
  REMEDIATION_CAP_PER_MOCK,
  SUBJECT_UNASSIGNED,
  UNPROCESSED_REMINDER_DAYS,
  conceptGapAnalyzed,
  entryFullyTagged,
  isErrorTag,
  needsConceptGapAnalysis,
  ocrEscalationRate,
  sanitizeSubjectName,
  sanitizeTopicName,
  type AnalysisPrefsRow,
  type AnalysisShareRow,
  type CropRect,
  type ErrorTag,
  type MockSessionRow,
  type OcrEscalationMetric,
  type QuestionEntryRow,
  type QuestionOutcome,
  type SourceImageRow,
  type TimeBucket,
  type TopicMasteryRow,
} from './taTypes';

export interface MockSessionDraft {
  examType: string;
  name: string;
  date: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  score: number;
  maxScore: number;
  durationMinutes: number | null;
}

/**
 * Outcome of createSession. `saved` is the truth about the INSERT — the row
 * exists whenever it is true. `row` is the freshly re-read row used for
 * navigation; it is null when that follow-up read hiccuped, and the mock is
 * STILL saved in that case (the refreshed list shows it).
 */
export interface MockSessionSaveResult {
  saved: boolean;
  row: MockSessionRow | null;
}

/** One confirmed crop handed back by the cropping screen. */
export interface ConfirmedCrop {
  rect: CropRect;
  dataUrl: string;
  questionNumber: number | null;
}

/** The deck is ONE queue with a small filter — never a navigation target. */
export type DeckFilterKind = 'all' | 'doubts' | 'mock' | 'topic';

export interface DeckFilter {
  kind: DeckFilterKind;
  /** The mock's source label, when kind === 'mock'. */
  mock: string | null;
  /** The topic/concept label, when kind === 'topic'. */
  topic: string | null;
}

export const DEFAULT_DECK_FILTER: DeckFilter = { kind: 'all', mock: null, topic: null };

/** localStorage key holding {day, filter} so the filter resets each new day. */
const DECK_FILTER_KEY = 'vicharakai:ta_deck_filter';

/** One-time bridge for mock misses saved before the live weakness feed existed.
 * The cursor is claimed BEFORE any adaptation writes, making every historical
 * entry at-most-once even if the tab closes halfway through the batch. */
const WEAK_TOPIC_BACKFILL_META_KEY = 'weak_topic_backfill|v1';
/** recordTestResult performs up to three writes; bound one mount to 50 entries. */
const WEAK_TOPIC_BACKFILL_ENTRY_CAP = 50;

interface WeakTopicBackfillMetaRow {
  id: number;
  meta_key: string;
  meta_value: string | null;
  session_id?: string | null;
}

interface WeakTopicBackfillMarker {
  version: 1;
  status: 'running' | 'pending' | 'complete';
  /** Highest question-entry id that existed when this one-time pass started. */
  cutoffEntryId: number;
  /** Highest id durably claimed (and therefore never safe to retry). */
  claimedThroughEntryId: number;
  claimedCount: number;
  updatedAt: string;
}

function parseWeakTopicBackfillMarker(raw: unknown): WeakTopicBackfillMarker | null {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') return null;
    const marker = value as Partial<WeakTopicBackfillMarker>;
    const cutoffEntryId = Number(marker.cutoffEntryId);
    const claimedThroughEntryId = Number(marker.claimedThroughEntryId);
    if (marker.version !== 1 || !Number.isFinite(cutoffEntryId) || !Number.isFinite(claimedThroughEntryId)) {
      return null;
    }
    return {
      version: 1,
      status: marker.status === 'complete' || marker.status === 'pending' ? marker.status : 'running',
      cutoffEntryId: Math.max(0, cutoffEntryId),
      claimedThroughEntryId: Math.max(0, claimedThroughEntryId),
      claimedCount: Math.max(0, Number(marker.claimedCount) || 0),
      updatedAt: String(marker.updatedAt ?? ''),
    };
  } catch {
    return null;
  }
}

export interface TestAnalysisFeature {
  sessionsQ: AllRowsResult<MockSessionRow>;
  imagesQ: AllRowsResult<SourceImageRow>;
  entriesQ: AllRowsResult<QuestionEntryRow>;
  masteryQ: AllRowsResult<TopicMasteryRow>;
  prefsQ: AllRowsResult<AnalysisPrefsRow>;
  sharesQ: AllRowsResult<AnalysisShareRow>;
  configsQ: AllRowsResult<ExamConfigRow>;
  /** Newest first. */
  sessions: MockSessionRow[];
  imagesBySession: Map<number, SourceImageRow[]>;
  entriesBySession: Map<number, QuestionEntryRow[]>;
  entries: QuestionEntryRow[];
  /** Pages still waiting to be split — the unprocessed tray, all sessions. */
  unprocessedImages: SourceImageRow[];
  prefs: AnalysisPrefsRow | null;
  shares: AnalysisShareRow[];
  savingSession: boolean;
  uploadingPages: boolean;
  /* ---------- marking scheme ---------- */
  /** The resolved ExamConfig for this student's exam — THE marks source. */
  examConfig: ExamConfig;
  /** The stored row behind it (null when no scheme matched). */
  examConfigRow: ExamConfigRow | null;
  /** True when no active scheme matched and the neutral fallback is in use. */
  schemeUnresolved: boolean;
  /** Every stored scheme, presets and TODO stubs alike. */
  examConfigRows: ExamConfigRow[];
  savingScheme: boolean;
  saveExamConfig: (row: ExamConfigRow | null, patch: Partial<ExamConfigRow>) => Promise<void>;
  selectRegionalExamConfig: (template: ExamConfigRow, region: string) => Promise<void>;
  createSession: (draft: MockSessionDraft) => Promise<MockSessionSaveResult>;
  addPages: (session: MockSessionRow, files: File[]) => Promise<void>;
  /** AI-first upload: add pages AND let the vision model extract every
   * question (number + text) so the student just reviews outcomes. */
  addPagesAndExtract: (session: MockSessionRow, files: File[]) => Promise<void>;
  /** Re-run the AI read on one still-unprocessed page. */
  retryAiExtract: (session: MockSessionRow, image: SourceImageRow) => Promise<void>;
  /** True while Vicharee is reading uploaded pages. */
  aiReadingPages: boolean;
  markSegmentationAttempted: (image: SourceImageRow) => Promise<void>;
  saveCrops: (session: MockSessionRow, image: SourceImageRow, crops: ConfirmedCrop[]) => Promise<void>;
  markWholePageQuestion: (session: MockSessionRow, image: SourceImageRow) => Promise<void>;
  removeEntry: (entry: QuestionEntryRow) => Promise<void>;
  setOutcome: (entry: QuestionEntryRow, outcome: QuestionOutcome) => Promise<void>;
  /** Resolves true when the tag write committed, false when it failed — the
   * logging list uses the verdict to clear its optimistic chip fill. */
  applyErrorTag: (entry: QuestionEntryRow, tag: ErrorTag, suggested: ErrorTag | null) => Promise<boolean>;
  /** Apply ONE chip to many rows in one tap (bulk tagging in the list). */
  applyErrorTagToMany: (entries: QuestionEntryRow[], tag: ErrorTag) => Promise<number>;
  confirmTopic: (
    entry: QuestionEntryRow,
    picked: { subject: string; chapter: string; topic: string },
    predictedTopic: string | null,
  ) => Promise<void>;
  setTimeBucket: (entry: QuestionEntryRow, bucket: TimeBucket | null) => Promise<void>;
  /** Earned and possible marks for ONE partial-credit question. */
  setMarksAwarded: (entry: QuestionEntryRow, marks: number | null, possible: number | null) => Promise<void>;
  saveReasonNote: (entry: QuestionEntryRow, note: string) => Promise<void>;
  /** Constrained AI topic prediction for one entry (on demand). */
  predictEntryTopic: (entry: QuestionEntryRow) => Promise<TopicPrediction | null>;
  /** Read the CROP with the vision model: what concept is this question
   * testing, and what did the student most likely misunderstand? */
  analyzeEntryConceptGap: (entry: QuestionEntryRow) => Promise<ConceptGapAnalysis | null>;
  /** True while that call is in flight for this entry. */
  analyzingConceptGap: (entry: QuestionEntryRow) => boolean;
  /** Error-tag pre-selection for a topic (null = no suggestion). */
  suggestionFor: (topic: string | null) => ErrorTag | null;
  /** Give this mock's eligible misses a due date (no cards are created). */
  scheduleRemediation: (session: MockSessionRow) => Promise<number>;
  remediating: boolean;
  /** How many of a mock's entries are waiting on their due date. */
  scheduledCount: (session: MockSessionRow) => number;
  /** Deck cards that came from mocks (source_type 'mock'), newest first. */
  mockDeckRows: FlaggedRow[];
  /* ---------- the ONE filtered deck ---------- */
  /** Everything due right now (doubts + mock revisions in one queue). */
  dueDeckRows: FlaggedRow[];
  /** `dueDeckRows` narrowed by the active filter. */
  filteredDeckRows: FlaggedRow[];
  deckFilter: DeckFilter;
  setDeckFilter: (filter: DeckFilter) => void;
  /** Mock labels present in the due queue, for the 'By mock' filter. */
  deckMockLabels: string[];
  /** Topic labels present in the due queue, for the 'By topic' filter. */
  deckTopicLabels: string[];
  /** Doubts per topic (lower-cased key) — the volume weakness signal. */
  doubtsByTopic: Map<string, number>;
  /** Timing preference. null = never asked. */
  tracksTiming: boolean | null;
  setTracksTiming: (value: boolean | null, options?: { silent?: boolean }) => Promise<void>;
  suggestionsDisabled: boolean;
  setSuggestionsDisabled: (disabled: boolean) => Promise<void>;
  /** Internal OCR cost metric (escalation rate). Never shown to students. */
  ocrMetric: OcrEscalationMetric;
  ocrEscalationRate: number;
  createShare: (args: {
    scope: 'single_mock' | 'date_range';
    mockSessionId: number | null;
    rangeStart: string | null;
    rangeEnd: string | null;
    includeReasonNotes: boolean;
  }) => Promise<string | null>;
  revokeShare: (share: AnalysisShareRow) => Promise<void>;
  shareUrlOf: (share: AnalysisShareRow) => string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Concept gaps and couldn't-apply misses are the ONLY deck-eligible tags. */
function deckEligibleTag(tag: unknown): boolean {
  return tag === 'concept_gap' || tag === 'couldnt_apply';
}

/** The label a deck card groups under for the 'By topic' filter. */
function deckTopicLabel(row: FlaggedRow): string {
  return (row.concept || '').trim() || (row.topic || '').trim() || row.subject;
}

function readStoredDeckFilter(today: string): DeckFilter {
  try {
    const raw = localStorage.getItem(DECK_FILTER_KEY);
    if (!raw) return { ...DEFAULT_DECK_FILTER };
    const parsed = JSON.parse(raw) as { day?: string; filter?: DeckFilter };
    /* The filter is a within-session convenience — a new day starts on
     * 'All due' again, deliberately. */
    if (!parsed || parsed.day !== today || !parsed.filter) return { ...DEFAULT_DECK_FILTER };
    return {
      kind: (['all', 'doubts', 'mock', 'topic'] as DeckFilterKind[]).includes(parsed.filter.kind)
        ? parsed.filter.kind
        : 'all',
      mock: parsed.filter.mock ?? null,
      topic: parsed.filter.topic ?? null,
    };
  } catch {
    return { ...DEFAULT_DECK_FILTER };
  }
}

export function useTestAnalysis(
  data: StudentData,
  toast: ToastFeature,
  access: AccessFeature,
  tests: TestsFeature,
): TestAnalysisFeature {
  const {
    spaceId, today, dbSessionReady, examDef, savedExamLabel, topicPickerSubjects, topicPickerExamLabel, flaggedQ,
    activeSyllabusExam, metaQ, weakTopicsQ, topicAttemptsQ, examProgressQ,
  } = data;
  const { showToast } = toast;
  const userId = access.paidSessionEmail || null;

  /* Cross-session recovery: the mock-analysis tables are keyed by session_id
   * just like every other student table, and a returning login mints a NEW
   * session id — so without this the mocks a student logged before would
   * vanish after they sign in again on a fresh tab/device. Merge in the
   * account's PROVEN session ids exactly as StudentDataContext already does
   * for tasks/meta/scores/etc. (services/database/accountScope), so a mock
   * session, its uploaded pages, its tagged question entries and its topic
   * mastery all follow the LOGIN, not the browser session. Guests (no
   * signed-in email) get an empty list, which keeps reads session-scoped
   * exactly as before. */
  const accountSessionIds = useAccountSessionIds(spaceId);

  const sessionsQ = useAllRows<MockSessionRow>(TABLES.mockSessions, {
    orderBy: { column: 'id', direction: 'desc' },
  }, accountSessionIds);
  const imagesQ = useAllRows<SourceImageRow>(TABLES.mockSourceImages, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const entriesQ = useAllRows<QuestionEntryRow>(TABLES.mockQuestionEntries, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const masteryQ = useAllRows<TopicMasteryRow>(TABLES.mockTopicMastery, {
    orderBy: { column: 'id', direction: 'asc' },
  }, accountSessionIds);
  const prefsQ = useAllRows<AnalysisPrefsRow>(TABLES.analysisPrefs, {
    orderBy: { column: 'id', direction: 'asc' },
  });
  const sharesQ = useAllRows<AnalysisShareRow>(TABLES.analysisShares, {
    orderBy: { column: 'id', direction: 'desc' },
  });
  const configsQ = useAllRows<ExamConfigRow>(TABLES.examConfigs, {
    orderBy: { column: 'id', direction: 'asc' },
  });

  const [savingSession, setSavingSession] = useState(false);
  const [uploadingPages, setUploadingPages] = useState(false);
  /* True while the vision model is reading freshly uploaded pages. */
  const [aiReadingPages, setAiReadingPages] = useState(false);
  const [remediating, setRemediating] = useState(false);
  const [savingScheme, setSavingScheme] = useState(false);
  const [ocrMetric, setOcrMetric] = useState<OcrEscalationMetric>({ reads: 0, escalations: 0 });
  const [conceptGapIds, setConceptGapIds] = useState<number[]>([]);
  /* In-flight guard: one vision call per entry, never two. */
  const conceptGapRunningRef = useRef<Set<number>>(new Set());
  /* Entries the automatic pass has already spent a call on THIS mount. A
   * transient failure writes nothing, so it retries on the next load rather
   * than looping against a crop the model cannot read. */
  const conceptGapAttemptedRef = useRef<Set<number>>(new Set());
  const [deckFilter, setDeckFilterState] = useState<DeckFilter>(() => readStoredDeckFilter(today));

  const sessions = useMemo(
    () => [...(sessionsQ.data ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [sessionsQ.data],
  );
  const entries = entriesQ.data ?? [];
  const imagesBySession = useMemo(() => {
    const map = new Map<number, SourceImageRow[]>();
    for (const image of imagesQ.data ?? []) {
      const list = map.get(image.mock_session_id) ?? [];
      list.push(image);
      map.set(image.mock_session_id, list);
    }
    return map;
  }, [imagesQ.data]);
  const entriesBySession = useMemo(() => {
    const map = new Map<number, QuestionEntryRow[]>();
    for (const entry of entries) {
      const list = map.get(entry.mock_session_id) ?? [];
      list.push(entry);
      map.set(entry.mock_session_id, list);
    }
    return map;
  }, [entries]);
  const unprocessedImages = useMemo(
    () => (imagesQ.data ?? []).filter((image) => image.status === 'unprocessed'),
    [imagesQ.data],
  );
  const prefs = (prefsQ.data ?? [])[0] ?? null;
  const shares = sharesQ.data ?? [];
  const mockDeckRows = useMemo(
    () => (flaggedQ.data ?? []).filter((row) => row.source_type === 'mock' && row.status === 'queued'),
    [flaggedQ.data],
  );
  const doubtsByTopic = useMemo(() => doubtVolumeByTopic(entries), [entries]);

  /* ---------- marking scheme (ExamConfig rows) ---------- */

  const examConfigRows = configsQ.data ?? [];
  const baseExamLabel = examDef?.name ?? savedExamLabel ?? prefs?.exam_type ?? null;
  const preferredRegionalLabel = String(prefs?.exam_type ?? '').trim();
  const regionalTemplate = EXAM_CONFIG_SEEDS.find(
    (preset) =>
      preset.requires_region &&
      preferredRegionalLabel.toLowerCase().startsWith(`${preset.exam_type.toLowerCase()} — `) &&
      regionalTemplateMatchesExam(preset, baseExamLabel),
  );
  const examLabel = regionalTemplate ? preferredRegionalLabel : baseExamLabel;
  const resolvedScheme = useMemo(
    () => resolveExamConfig(examConfigRows, examLabel),
    [examConfigRows, examLabel],
  );
  const examConfig = resolvedScheme.config;

  /* Reconcile shipped presets once per load. Active rows remain student-owned
   * data and are never overwritten; only legacy TODO stubs are promoted to
   * their now-verified values, and newly shipped presets (INI-CET) are added. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || configsQ.loading) return;
    seededRef.current = true;
    void runExclusive('ta-seed-exam-configs', async () => {
      const existing = await fetchRowsWhere<ExamConfigRow>(TABLES.examConfigs, []);
      const guarded = verifiedDbFrom(TABLES.examConfigs);
      for (const preset of EXAM_CONFIG_SEEDS) {
        const matches = existing.filter(
          (row) => String(row.exam_type).trim().toLowerCase() === preset.exam_type.toLowerCase(),
        );
        const active = matches.find((row) => String(row.status ?? 'active') !== 'todo');
        const legacyTodo = matches.find((row) => String(row.status ?? 'active') === 'todo');
        const values = {
          user_id: userId,
          exam_type: preset.exam_type,
          marks_correct: preset.marks_correct,
          marks_incorrect: preset.marks_incorrect,
          marks_skipped: preset.marks_skipped,
          unit_label: preset.unit_label,
          allows_partial_credit: preset.allows_partial_credit,
          scaled_min: preset.scaled_min,
          scaled_max: preset.scaled_max,
          target_seconds_per_q: preset.target_seconds_per_q,
          status: preset.status,
          requires_region: preset.requires_region,
          is_preset: true,
          notes: preset.notes,
          updated_at_iso: nowIso(),
        };
        if (!active && legacyTodo) await guarded.update(legacyTodo.id, values);
        else if (!active) await guarded.insert(values);
      }
      configsQ.refresh();
    }).catch(() => {
      seededRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configsQ.loading, userId]);

  const saveExamConfig = async (row: ExamConfigRow | null, patch: Partial<ExamConfigRow>) => {
    if (savingScheme) return;
    setSavingScheme(true);
    try {
      if (row) {
        await verifiedDbFrom(TABLES.examConfigs).update(row.id, { ...patch, updated_at_iso: nowIso() });
      } else {
        await verifiedDbFrom(TABLES.examConfigs).insert({
          user_id: userId,
          exam_type: String(patch.exam_type ?? examLabel ?? 'My exam').trim() || 'My exam',
          marks_correct: patch.marks_correct ?? 1,
          marks_incorrect: patch.marks_incorrect ?? 0,
          marks_skipped: patch.marks_skipped ?? 0,
          unit_label: patch.unit_label ?? 'marks',
          allows_partial_credit: patch.allows_partial_credit ?? false,
          scaled_min: patch.scaled_min ?? null,
          scaled_max: patch.scaled_max ?? null,
          target_seconds_per_q: patch.target_seconds_per_q ?? 120,
          status: patch.status ?? 'active',
          requires_region: patch.requires_region ?? false,
          is_preset: false,
          notes: patch.notes ?? null,
          updated_at_iso: nowIso(),
        });
      }
      configsQ.refresh();
      showToast('Marking scheme saved — every marks figure now uses it.');
    } catch {
      showToast("That scheme didn't save — mind tapping once more?");
    } finally {
      setSavingScheme(false);
    }
  };

  const selectRegionalExamConfig = async (template: ExamConfigRow, region: string) => {
    const cleanRegion = (region ?? '').replace(/\s+/g, ' ').trim();
    if (
      savingScheme ||
      !cleanRegion ||
      !regionalTemplateMatchesExam(template, baseExamLabel)
    ) return;
    const regionalExamType = `${String(template.exam_type).trim()} — ${cleanRegion}`;
    setSavingScheme(true);
    try {
      const latestRows = await fetchRowsWhere<ExamConfigRow>(TABLES.examConfigs, []);
      const matches = latestRows.filter(
        (entry) => String(entry.exam_type).trim().toLowerCase() === regionalExamType.toLowerCase(),
      );
      const existing = matches.find(
        (entry) => String(entry.status ?? 'active') !== 'todo' && entry.requires_region !== true,
      );
      if (!existing) {
        const values = {
          user_id: userId,
          exam_type: regionalExamType,
          marks_correct: template.marks_correct,
          marks_incorrect: template.marks_incorrect,
          marks_skipped: template.marks_skipped,
          unit_label: template.unit_label,
          allows_partial_credit: template.allows_partial_credit === true,
          scaled_min: template.scaled_min ?? null,
          scaled_max: template.scaled_max ?? null,
          target_seconds_per_q: template.target_seconds_per_q,
          status: 'active',
          requires_region: false,
          is_preset: false,
          notes: template.notes ?? null,
          updated_at_iso: nowIso(),
        };
        if (matches[0]) await verifiedDbFrom(TABLES.examConfigs).update(matches[0].id, values);
        else await verifiedDbFrom(TABLES.examConfigs).insert(values);
      }
      await upsertPrefs({ exam_type: regionalExamType });
      configsQ.refresh();
      showToast(`${cleanRegion} scheme selected — you can edit every value below.`);
    } catch {
      showToast("That region didn't save — mind tapping once more?");
    } finally {
      setSavingScheme(false);
    }
  };

  /* ---------- the ONE filtered deck ---------- */

  const setDeckFilter = useCallback(
    (filter: DeckFilter) => {
      setDeckFilterState(filter);
      try {
        localStorage.setItem(DECK_FILTER_KEY, JSON.stringify({ day: today, filter }));
      } catch {
        /* the filter is a convenience — losing it is harmless */
      }
    },
    [today],
  );

  /* A stored filter from yesterday is dropped the moment the day rolls. */
  useEffect(() => {
    const stored = readStoredDeckFilter(today);
    setDeckFilterState((current) =>
      current.kind === stored.kind && current.mock === stored.mock && current.topic === stored.topic
        ? current
        : stored,
    );
  }, [today]);

  const dueDeckRows = useMemo(
    () => (flaggedQ.data ?? []).filter((row) => flaggedDueOn(row, today)),
    [flaggedQ.data, today],
  );
  const deckMockLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const row of dueDeckRows) {
      const label = String(row.source_label ?? '').trim();
      if (row.source_type === 'mock' && label) labels.add(label);
    }
    return Array.from(labels).sort();
  }, [dueDeckRows]);
  const deckTopicLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const row of dueDeckRows) labels.add(deckTopicLabel(row));
    return Array.from(labels).sort();
  }, [dueDeckRows]);
  const filteredDeckRows = useMemo(() => {
    if (deckFilter.kind === 'doubts') return dueDeckRows.filter((row) => row.source_type !== 'mock');
    if (deckFilter.kind === 'mock') {
      const mockRows = dueDeckRows.filter((row) => row.source_type === 'mock');
      return deckFilter.mock
        ? mockRows.filter((row) => String(row.source_label ?? '').trim() === deckFilter.mock)
        : mockRows;
    }
    if (deckFilter.kind === 'topic') {
      return deckFilter.topic ? dueDeckRows.filter((row) => deckTopicLabel(row) === deckFilter.topic) : dueDeckRows;
    }
    return dueDeckRows;
  }, [dueDeckRows, deckFilter]);

  /* ---------- 7-day unprocessed reminder (once, then leave it) ---------- */
  const remindedRef = useRef(false);
  useEffect(() => {
    if (remindedRef.current || imagesQ.loading) return;
    const cutoff = addDaysISO(today, -UNPROCESSED_REMINDER_DAYS);
    const stale = unprocessedImages.filter(
      (image) => !image.reminder_sent_at && String(image.created_at ?? '').slice(0, 10) <= cutoff,
    );
    if (stale.length === 0) return;
    remindedRef.current = true;
    showToast(
      `${stale.length} mock page${stale.length === 1 ? ' is' : 's are'} still waiting to be split into questions.`,
    );
    void Promise.all(
      stale.map((image) =>
        verifiedDbFrom(TABLES.mockSourceImages).update(image.id, { reminder_sent_at: today }),
      ),
    )
      .then(() => imagesQ.refresh())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesQ.loading, unprocessedImages, today]);

  /* ---------- session creation (step 1 — the ONLY score-log entry) ---------- */

  const createSession = async (draft: MockSessionDraft): Promise<MockSessionSaveResult> => {
    if (savingSession) return { saved: false, row: null };
    setSavingSession(true);
    try {
      /* THE save. Only a failure of THIS insert may report "didn't save" —
       * everything after it is follow-up work on a mock that already exists.
       * (The old shape ran the post-insert re-read inside this same try, so a
       * read hiccup AFTER a successful insert showed the failure toast and
       * left the form open — students tapped Save again and duplicated the
       * mock they thought was lost.) */
      try {
        await verifiedDbFrom(TABLES.mockSessions).insert({
          user_id: userId,
          exam_type: draft.examType || null,
          name: draft.name,
          date: draft.date,
          total_questions: draft.totalQuestions,
          attempted: draft.attempted,
          correct: draft.correct,
          incorrect: draft.incorrect,
          score: draft.score,
          max_score: draft.maxScore,
          duration_minutes: draft.durationMinutes,
          created_at: nowIso(),
        });
      } catch (error) {
        console.error('[vicharakai] mock session save failed', error);
        /* Surface WHY (sessionGuard throws human-readable messages), so a
         * real failure is diagnosable instead of a bare generic toast. */
        const reason = (error instanceof Error ? error.message : String(error ?? '')).trim();
        const detail = reason && reason.length <= 140 ? ` (${reason.replace(/[.\s]+$/, '')})` : '';
        showToast(
          isSessionVerificationError(error)
            ? 'Sign in again to save this mock — your session expired.'
            : `That mock didn't save — check your connection and tap Save once more.${detail}`,
        );
        return { saved: false, row: null };
      }
      /* Feed the EXISTING score engine too, so averages, trends, the weekly
       * mock nudge and the adaptation engine all see this mock. Best-effort:
       * a failure here never loses the session itself. */
      try {
        const subjects = examDef?.subjects.map((subject) => subject.name) ?? [];
        const mockSubjects = subjects.length > 0 ? fullMockSubjects(draft.examType, subjects) : [];
        /* The exam's own label stands in when the syllabus has no subjects —
         * never an invented placeholder subject. */
        const fallbackSubject = String(draft.examType || examLabel || SUBJECT_UNASSIGNED).trim();
        await tests.handleLogTestScore({
          subject: mockSubjects[0] ?? fallbackSubject,
          subjects: mockSubjects.length > 0 ? mockSubjects : [fallbackSubject],
          testName: draft.name,
          testType: 'Full Mock',
          takenOn: draft.date,
          marks: draft.score,
          total: draft.maxScore,
          topics: [],
          topicPairs: [],
          notes: '',
        });
      } catch {
        /* the mock session is saved either way */
      }
      sessionsQ.refresh();
      /* Re-read the fresh row so the screen can open it. This is a READ on a
       * mock that IS already saved: a hiccup here must never claim the save
       * failed. Without the row the caller simply stays on the list, which
       * refreshes to show the new mock. */
      let row: MockSessionRow | null = null;
      try {
        const fresh = await fetchRowsWhere<MockSessionRow>(TABLES.mockSessions, [
          { column: 'name', operator: 'eq', value: draft.name },
          { column: 'date', operator: 'eq', value: draft.date },
        ]);
        row = fresh.sort((a, b) => b.id - a.id)[0] ?? null;
      } catch (error) {
        console.warn('[vicharakai] saved-mock re-read failed (the mock itself saved fine)', error);
      }
      showToast(`Saved ${draft.name} — now add the paper pages to start the analysis.`);
      return { saved: true, row };
    } finally {
      setSavingSession(false);
    }
  };

  /* ---------- source pages ---------- */

  const addPages = async (session: MockSessionRow, files: File[]) => {
    if (files.length === 0 || uploadingPages) return;
    setUploadingPages(true);
    try {
      const existing = imagesBySession.get(session.id) ?? [];
      let pageNumber = existing.reduce((max, image) => Math.max(max, Number(image.page_number) || 0), 0);
      for (const file of files) {
        const clean = await fileToCleanJpeg(file);
        const hosted = await uploadImage(await dataUrlToJpegFile(clean, 'mock-page.jpg'), spaceId);
        pageNumber += 1;
        await verifiedDbFrom(TABLES.mockSourceImages).insert({
          mock_session_id: session.id,
          user_id: userId,
          image_url: hosted,
          page_number: pageNumber,
          status: 'unprocessed',
          segmentation_attempted: false,
          created_at: nowIso(),
        });
      }
      imagesQ.refresh();
      showToast(
        files.length === 1
          ? 'Page added — open it to split it into questions.'
          : `${files.length} pages added — open each to split it into questions.`,
      );
    } catch {
      showToast("Those pages didn't upload — check your connection and try again.");
    } finally {
      setUploadingPages(false);
    }
  };

  const markSegmentationAttempted = async (image: SourceImageRow) => {
    if (image.segmentation_attempted) return;
    try {
      await verifiedDbFrom(TABLES.mockSourceImages).update(image.id, { segmentation_attempted: true });
      imagesQ.refresh();
    } catch {
      /* cosmetic flag — never blocks */
    }
  };

  /* ---------- crops → entries (the OCR cascade runs BEHIND the save) ---------- */

  const patchEntry = async (id: number, patch: Record<string, unknown>) => {
    await verifiedDbFrom(TABLES.mockQuestionEntries).update(id, patch);
  };

  /** Load the rolling OCR cost counter once per mount. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchRowsWhere<{ id: number; meta_key: string; meta_value: string | null }>(TABLES.meta, [
          { column: 'meta_key', operator: 'eq', value: OCR_ESCALATION_META_KEY },
        ]);
        const raw = rows.sort((a, b) => b.id - a.id)[0]?.meta_value;
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as Partial<OcrEscalationMetric>;
        setOcrMetric({
          reads: Math.max(0, Number(parsed.reads) || 0),
          escalations: Math.max(0, Number(parsed.escalations) || 0),
        });
      } catch {
        /* a missing counter simply starts at zero */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Escalation rate is a COST metric, not a student-facing number. A rate
   * sustained above OCR_ESCALATION_ALERT_RATE means the crops themselves are
   * poor (capture guidance), not that the model is bad.
   */
  const recordOcrRead = (escalated: boolean) => {
    setOcrMetric((current) => {
      const next = { reads: current.reads + 1, escalations: current.escalations + (escalated ? 1 : 0) };
      void upsertMetaKey(OCR_ESCALATION_META_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  /** Does this text land anywhere in the student's OWN syllabus? Deterministic
   * (the rule tagger's catalog word overlap) so gate 3 costs nothing. */
  const hasSyllabusMatch = (text: string): boolean => {
    const clean = (text ?? '').trim();
    if (!clean) return false;
    try {
      return Boolean(ruleTagQuestion(clean, buildTagCatalog(topicPickerSubjects)).chapter);
    } catch {
      return false;
    }
  };

  /**
   * THE OCR cascade (§4.1). Tesseract (Web Worker) runs on EVERY crop first.
   * The AI vision model is called only when the local read fails one of three
   * gates: mean confidence < 60, extracted text < 15 characters, or no topic
   * match against the student's own syllabus. The text never reaches the UI —
   * it feeds topic matching and test generation only.
   */
  const ocrCropInBackground = async (entryId: number, dataUrl: string) => {
    let text = '';
    let confidence = 0;
    let escalated = false;
    try {
      const local = await recognizeText(dataUrl);
      text = tidyOcrText(local.text);
      confidence = Number.isFinite(local.confidence) ? local.confidence : 0;
    } catch {
      text = '';
      confidence = 0;
    }

    const lowConfidence = confidence < OCR_ESCALATE_BELOW_CONFIDENCE;
    const tooShort = (text ?? '').trim().length < OCR_ESCALATE_BELOW_CHARS;
    const noTopicMatch = !lowConfidence && !tooShort && !hasSyllabusMatch(text);

    if (lowConfidence || tooShort || noTopicMatch) {
      if (access.access.canAskAi) {
        const aiText = tidyOcrText(await aiOcrText(dataUrl));
        if ((aiText ?? '').trim()) {
          text = aiText;
          escalated = true;
          access.chargeAi();
        }
      }
    } else if (confidence >= OCR_MIN_CONFIDENCE && (text ?? '').trim()) {
      /* A good local read still gets the cheap mechanical tidy-up. */
      const cleaned = await cleanOcrQuestionText(text);
      if (cleaned) text = cleaned;
    }

    recordOcrRead(escalated);
    try {
      await patchEntry(entryId, {
        extracted_text: (text ?? '').trim() ? text.slice(0, 4000) : null,
        ocr_confidence: Math.round(confidence),
        ocr_escalated: escalated,
      });
      entriesQ.refresh();
    } catch {
      /* the crop image alone is a complete entry */
    }
  };

  /* ---------- AI-first page flow: upload → Vicharee reads → review ---------- */

  /** Insert one review-ready entry per extracted question. `outcome` starts
   * NULL on this path — the student reviews each question and taps
   * Correct / Wrong / Skipped in the list (the old crop flow pre-set
   * 'incorrect' because students only cropped what they got wrong). */
  const insertExtractedEntries = async (
    session: MockSessionRow,
    imageId: number,
    pageUrl: string,
    questions: Array<{ questionNumber: number | null; text: string }>,
  ) => {
    for (const question of questions) {
      await verifiedDbFrom(TABLES.mockQuestionEntries).insert({
        mock_session_id: session.id,
        user_id: userId,
        source_image_id: imageId,
        crop_coords: null,
        /* The page photo backs the card; the extracted TEXT is the review
         * surface for AI-read entries. */
        crop_url: pageUrl,
        is_whole_page: false,
        question_number: question.questionNumber,
        extracted_text: (question.text ?? '').slice(0, 4000),
        outcome: null,
        created_at: nowIso(),
      });
    }
    await verifiedDbFrom(TABLES.mockSourceImages).update(imageId, {
      status: 'segmented',
      segmentation_attempted: true,
    });
  };

  /** Run the AI read on one uploaded page. Returns the number of questions
   * extracted; 0 means the page stays 'unprocessed' for the manual flow. */
  const aiReadPage = async (
    session: MockSessionRow,
    imageId: number,
    pageUrl: string,
    readUrl: string,
  ): Promise<number> => {
    try {
      const questions = await extractQuestionsFromImage(readUrl);
      await insertExtractedEntries(session, imageId, pageUrl, questions);
      /* One wallet charge per successfully read page — the same meter the
       * OCR escalation path uses. */
      access.chargeAi();
      recordOcrRead(true);
      return questions.length;
    } catch {
      return 0;
    }
  };

  /**
   * THE AI-first upload flow (2026-09-29): upload the page photos exactly as
   * addPages does, then let the vision model read each page and extract every
   * question with its number and text — the student just reviews each one and
   * taps Correct / Wrong / Skipped. A page the model cannot read stays
   * 'unprocessed', so the manual CropScreen remains the graceful fallback and
   * nothing about the stored data model changes.
   */
  const addPagesAndExtract = async (session: MockSessionRow, files: File[]) => {
    if (files.length === 0 || uploadingPages || aiReadingPages) return;
    const uploaded: Array<{ pageNumber: number; hosted: string; dataUrl: string }> = [];
    setUploadingPages(true);
    try {
      const existing = imagesBySession.get(session.id) ?? [];
      let pageNumber = existing.reduce((max, image) => Math.max(max, Number(image.page_number) || 0), 0);
      for (const file of files) {
        const clean = await fileToCleanJpeg(file);
        const hosted = await uploadImage(await dataUrlToJpegFile(clean, 'mock-page.jpg'), spaceId);
        pageNumber += 1;
        await verifiedDbFrom(TABLES.mockSourceImages).insert({
          mock_session_id: session.id,
          user_id: userId,
          image_url: hosted,
          page_number: pageNumber,
          status: 'unprocessed',
          segmentation_attempted: false,
          created_at: nowIso(),
        });
        uploaded.push({ pageNumber, hosted, dataUrl: clean });
      }
      imagesQ.refresh();
    } catch {
      showToast("Those pages didn't upload — check your connection and try again.");
    } finally {
      setUploadingPages(false);
    }
    if (uploaded.length === 0) return;

    /* Students without AI access keep the manual flow — the same gate the
     * OCR escalation path honours. */
    if (!access.access.canAskAi) {
      showToast(
        uploaded.length === 1
          ? 'Page added — open it to split it into questions.'
          : `${uploaded.length} pages added — open each to split it into questions.`,
      );
      return;
    }

    setAiReadingPages(true);
    let extracted = 0;
    let failedPages = 0;
    try {
      /* Re-read the fresh rows so entries attach to real image ids. */
      let freshImages: SourceImageRow[] = [];
      try {
        freshImages = await fetchRowsWhere<SourceImageRow>(TABLES.mockSourceImages, [
          { column: 'mock_session_id', operator: 'eq', value: session.id },
        ]);
      } catch {
        freshImages = [];
      }
      for (const page of uploaded) {
        const imageRow =
          freshImages.find((row) => row.image_url === page.hosted) ??
          freshImages.find((row) => Number(row.page_number) === page.pageNumber) ??
          null;
        if (!imageRow) {
          failedPages += 1;
          continue;
        }
        /* Read from the clean data URL (no re-download); the hosted URL is
         * what the entry cards display. */
        const count = await aiReadPage(session, imageRow.id, page.hosted, page.dataUrl);
        if (count > 0) extracted += count;
        else failedPages += 1;
      }
    } finally {
      setAiReadingPages(false);
      imagesQ.refresh();
      entriesQ.refresh();
    }
    if (extracted > 0 && failedPages === 0) {
      showToast(
        `Vicharee read ${extracted} question${extracted === 1 ? '' : 's'} — mark each one Correct, Wrong or Skipped.`,
      );
    } else if (extracted > 0) {
      showToast(
        `Vicharee read ${extracted} question${extracted === 1 ? '' : 's'}, but ${failedPages} page${
          failedPages === 1 ? '' : 's'
        } couldn't be read — open those pages to split them manually.`,
      );
    } else {
      showToast("Vicharee couldn't read those pages — open each page to split it into questions manually.");
    }
  };

  /** Give one still-unprocessed page another AI read. */
  const retryAiExtract = async (session: MockSessionRow, image: SourceImageRow) => {
    if (aiReadingPages) return;
    if (!access.access.canAskAi) {
      showToast('Open the page to split it into questions manually.');
      return;
    }
    setAiReadingPages(true);
    let count = 0;
    try {
      count = await aiReadPage(session, image.id, image.image_url, image.image_url);
    } finally {
      setAiReadingPages(false);
      imagesQ.refresh();
      entriesQ.refresh();
    }
    if (count > 0) {
      showToast(`Vicharee read ${count} question${count === 1 ? '' : 's'} — mark each one Correct, Wrong or Skipped.`);
    } else {
      showToast("Vicharee still couldn't read that page — open it to split it manually.");
    }
  };

  const saveCrops = async (session: MockSessionRow, image: SourceImageRow, crops: ConfirmedCrop[]) => {
    if (crops.length === 0) return;
    const before = await fetchRowsWhere<QuestionEntryRow>(TABLES.mockQuestionEntries, [
      { column: 'source_image_id', operator: 'eq', value: image.id },
    ]);
    const beforeIds = new Set(before.map((entry) => entry.id));
    for (const crop of crops) {
      await verifiedDbFrom(TABLES.mockQuestionEntries).insert({
        mock_session_id: session.id,
        user_id: userId,
        source_image_id: image.id,
        crop_coords: JSON.stringify(crop.rect),
        crop_url: null,
        is_whole_page: false,
        question_number: crop.questionNumber,
        extracted_text: null,
        /* Wrong questions are what students crop — the outcome is pre-set so
         * the logging list opens straight on the reason chips. */
        outcome: 'incorrect',
        created_at: nowIso(),
      });
    }
    await verifiedDbFrom(TABLES.mockSourceImages).update(image.id, {
      status: 'segmented',
      segmentation_attempted: true,
    });
    imagesQ.refresh();
    entriesQ.refresh();
    showToast(`${crops.length} question${crops.length === 1 ? '' : 's'} saved — tag each one in the list.`);

    /* Background half: match the fresh rows, upload each crop, OCR each. */
    void (async () => {
      let fresh: QuestionEntryRow[] = [];
      try {
        fresh = (
          await fetchRowsWhere<QuestionEntryRow>(TABLES.mockQuestionEntries, [
            { column: 'source_image_id', operator: 'eq', value: image.id },
          ])
        )
          .filter((entry) => !beforeIds.has(entry.id))
          .sort((a, b) => a.id - b.id);
      } catch {
        return;
      }
      for (let index = 0; index < fresh.length && index < crops.length; index += 1) {
        const entry = fresh[index];
        const crop = crops[index];
        /* Tainted-canvas fallback: no exportable crop image — keep the full
         * page as the card image so the entry still shows the question. */
        if (!crop.dataUrl) {
          try {
            await patchEntry(entry.id, { crop_url: image.image_url });
            entriesQ.refresh();
          } catch {
            /* the coords + page reference are already stored */
          }
          continue;
        }
        try {
          const hosted = await uploadImage(await dataUrlToJpegFile(crop.dataUrl, 'mock-crop.jpg'), spaceId);
          await patchEntry(entry.id, { crop_url: hosted });
          entriesQ.refresh();
        } catch {
          /* image upload retry is manual (re-crop); OCR still proceeds */
        }
        await ocrCropInBackground(entry.id, crop.dataUrl);
      }
    })();
  };

  const markWholePageQuestion = async (session: MockSessionRow, image: SourceImageRow) => {
    try {
      await verifiedDbFrom(TABLES.mockQuestionEntries).insert({
        mock_session_id: session.id,
        user_id: userId,
        source_image_id: image.id,
        crop_coords: null,
        crop_url: image.image_url,
        is_whole_page: true,
        question_number: null,
        extracted_text: null,
        outcome: 'incorrect',
        created_at: nowIso(),
      });
      await verifiedDbFrom(TABLES.mockSourceImages).update(image.id, {
        status: 'whole_page_question',
        segmentation_attempted: true,
      });
      imagesQ.refresh();
      entriesQ.refresh();
      showToast('Saved as one question card — the whole page is the content.');
      /* OCR the full page behind the save, same cascade. */
      void (async () => {
        try {
          const fresh = await fetchRowsWhere<QuestionEntryRow>(TABLES.mockQuestionEntries, [
            { column: 'source_image_id', operator: 'eq', value: image.id },
          ]);
          const row = fresh.filter((entry) => entry.is_whole_page).sort((a, b) => b.id - a.id)[0];
          if (row) await ocrCropInBackground(row.id, image.image_url);
        } catch {
          /* the page image alone is enough */
        }
      })();
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  const removeEntry = async (entry: QuestionEntryRow) => {
    try {
      await verifiedDbFrom(TABLES.mockQuestionEntries).delete(entry.id);
      entriesQ.refresh();
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  /* ---------- weak-topic feed (the adaptation-engine bridge) ----------
   * THE missing half of the analysis pipeline (bug fix): tagging a wrong mock
   * question used to update only this feature's own rollup
   * (vicharakai_topic_mastery), so zuno_weak_topics — the table Exam
   * Insights, Today's priorities and Vicharree read — never heard about mock
   * misses. Now, the moment an incorrect entry becomes fully tagged (error
   * tag + syllabus topic), it is fed ONCE into the same recordTestResult
   * writer Test Mode and the Practice tab use, which logs the topic attempt
   * and bumps the topic's weakness score. */

  /** Ready for the engine: a wrong answer carrying both halves of its tag. */
  const weakFeedEligible = (entry: QuestionEntryRow): boolean =>
    entry.outcome === 'incorrect' && isErrorTag(entry.error_tag) && Boolean(sanitizeTopicName(entry.topic_id));

  /** Entry ids fed this mount — a quick double-tap must not double-count. */
  const weakFedRef = useRef<Set<number>>(new Set());

  /** [V2 Task 3] Chapters Vicharree has already nudged about this mount —
   * the "schedule a revision?" chat prompt fires once per chapter, not once
   * per tagged question (deduped again per day inside the chat itself). */
  const analysisNudgeRef = useRef<Set<string>>(new Set());

  /** The syllabus chapter an entry maps to: exact name match first (the topic
   * picker offers the active syllabus's own names), fuzzy match as fallback. */
  const syllabusChapterIdFor = (
    exam: ExamSyllabus,
    subjectName: string,
    chapterName: string,
    topicName: string,
  ): string | null => {
    const exactChapterName = (chapterName ?? '').trim();
    if (exactChapterName) {
      /* Prefer the named subject when it is present, but do not let an old or
       * misspelled subject hide an otherwise exact active-syllabus chapter. */
      for (const subjectDef of exam.subjects) {
        if (subjectName && subjectDef.name !== subjectName) continue;
        const exact = subjectDef.chapters.find((chapter) => chapter.name === exactChapterName);
        if (exact) return exact.id;
      }
      for (const subjectDef of exam.subjects) {
        const exact = subjectDef.chapters.find((chapter) => chapter.name === exactChapterName);
        if (exact) return exact.id;
      }
    } else {
      for (const subjectDef of exam.subjects) {
        if (subjectName && subjectDef.name !== subjectName) continue;
        const exactTopic = subjectDef.chapters.find((chapter) => chapter.topics.includes(topicName));
        if (exactTopic) return exactTopic.id;
      }
    }
    return matchTaskToChapter(exam, subjectName, exactChapterName || topicName)?.chapterId ?? null;
  };

  /**
   * Feed one wrong question into the weakness engine at the moment its
   * tagging COMPLETES (it was not fully tagged before this patch, it is now).
   * Re-tagging an already-counted entry never double-counts, and a topic
   * that maps to nothing in the active syllabus is skipped — never guessed.
   */
  const feedWeakTopicEngine = (before: QuestionEntryRow, after: QuestionEntryRow) => {
    if (weakFeedEligible(before) || !weakFeedEligible(after)) return;
    if (weakFedRef.current.has(after.id)) return;
    const exam = activeSyllabusExam;
    const topic = sanitizeTopicName(after.topic_id);
    if (!exam || !topic) return;
    weakFedRef.current.add(after.id);
    const chapterId = syllabusChapterIdFor(
      exam,
      sanitizeSubjectName(after.subject) ?? '',
      String(after.chapter_id ?? '').trim(),
      topic,
    );
    if (!chapterId) return;
    /* [V2 Task 3] Vicharree proactively offers to schedule tomorrow's
     * revision the moment wrong questions land on a chapter. */
    const chapterLabel = String(after.chapter_id ?? '').trim() || topic;
    if (!analysisNudgeRef.current.has(chapterLabel)) {
      analysisNudgeRef.current.add(chapterLabel);
      const wrongCount = entries.filter(
        (row) =>
          row.outcome === 'incorrect' &&
          ((String(row.chapter_id ?? '').trim() || sanitizeTopicName(row.topic_id) || '') === chapterLabel),
      ).length;
      notifyAnalysisWrongTopic({
        subject: sanitizeSubjectName(after.subject) ?? 'General',
        chapter: chapterLabel,
        wrongCount: Math.max(1, wrongCount),
      });
    }
    void recordTestResult(exam.id, topicIdFor(chapterId, topic), false, null, { topicName: topic })
      .then(() => {
        weakTopicsQ.refresh();
        topicAttemptsQ.refresh();
        examProgressQ.refresh();
      })
      .catch(() => undefined);
  };

  /* ---------- one-time historical weak-topic backfill ----------
   * Rows that pre-date feedWeakTopicEngine need the same adaptation write,
   * but must never be replayed. The meta cursor is advanced BEFORE the batch:
   * if a write partially succeeds and the browser disappears, the claimed ids
   * are deliberately not retried (at-most-once is safer than double weakness).
   * A large history advances by at most 50 entries on each app mount. */
  const weakBackfillStartedRef = useRef(false);
  useEffect(() => {
    if (weakBackfillStartedRef.current || !dbSessionReady || entriesQ.loading || metaQ.loading) return;
    const exam = activeSyllabusExam;
    if (!exam) return;
    /* A signed-in account starts with [] while its proven historical session
     * ids load. Waiting prevents a current-session-only marker from declaring
     * the cross-device history complete too early. */
    if (userId && accountSessionIds.length === 0) return;
    weakBackfillStartedRef.current = true;

    void runExclusive(`ta-weak-topic-backfill|${exam.id}`, async () => {
      let scopedEntries = entries;
      let scopedMeta: WeakTopicBackfillMetaRow[] = metaQ.data ?? [];
      if (accountSessionIds.length > 0) {
        const ownedSessionIds = new Set(accountSessionIds);
        const [sharedEntries, sharedMeta] = await Promise.all([
          fetchAllRows<QuestionEntryRow & { session_id?: string | null }>(TABLES.mockQuestionEntries, { shared: true }),
          fetchAllRows<WeakTopicBackfillMetaRow>(TABLES.meta, { shared: true }),
        ]);
        /* Read directly from shared scope after account identity resolves. The
         * reactive account merge is intentionally asynchronous and may still
         * be one render behind when this one-time effect starts. */
        const ownedEntries = sharedEntries.filter(
          (entry) => typeof entry.session_id === 'string' && ownedSessionIds.has(entry.session_id),
        );
        const ownedMeta = sharedMeta.filter(
          (row) => typeof row.session_id === 'string' && ownedSessionIds.has(row.session_id),
        );
        const entriesById = new Map<number, QuestionEntryRow>();
        for (const entry of [...entries, ...ownedEntries]) entriesById.set(entry.id, entry);
        scopedEntries = Array.from(entriesById.values());
        const metaById = new Map<number, WeakTopicBackfillMetaRow>();
        for (const row of [...(metaQ.data ?? []), ...ownedMeta]) metaById.set(row.id, row);
        scopedMeta = Array.from(metaById.values());
      }

      const storedMarkers = scopedMeta
        .filter((row) => row.meta_key === WEAK_TOPIC_BACKFILL_META_KEY)
        .map((row) => parseWeakTopicBackfillMarker(row.meta_value))
        .filter((marker): marker is WeakTopicBackfillMarker => marker !== null);
      const stored = storedMarkers.sort(
        (a, b) => b.claimedThroughEntryId - a.claimedThroughEntryId || b.cutoffEntryId - a.cutoffEntryId,
      )[0] ?? null;
      if (stored?.status === 'complete') return;

      const cutoffEntryId = stored?.cutoffEntryId ?? scopedEntries.reduce((max, entry) => Math.max(max, entry.id), 0);
      const claimedThroughEntryId = stored?.claimedThroughEntryId ?? 0;
      const candidates = scopedEntries
        .filter(
          (entry) =>
            entry.id > claimedThroughEntryId &&
            entry.id <= cutoffEntryId &&
            weakFeedEligible(entry),
        )
        .map((entry) => {
          const topic = sanitizeTopicName(entry.topic_id);
          if (!topic) return null;
          const chapterId = syllabusChapterIdFor(
            exam,
            sanitizeSubjectName(entry.subject) ?? '',
            String(entry.chapter_id ?? '').trim(),
            topic,
          );
          return chapterId ? { entry, topic, chapterId } : null;
        })
        .filter(
          (candidate): candidate is { entry: QuestionEntryRow; topic: string; chapterId: string } => candidate !== null,
        )
        .sort((a, b) => a.entry.id - b.entry.id);
      const batch = candidates.slice(0, WEAK_TOPIC_BACKFILL_ENTRY_CAP);

      if (batch.length === 0) {
        await upsertMetaKey(WEAK_TOPIC_BACKFILL_META_KEY, JSON.stringify({
          version: 1,
          status: 'complete',
          cutoffEntryId,
          claimedThroughEntryId,
          claimedCount: stored?.claimedCount ?? 0,
          updatedAt: nowIso(),
        } satisfies WeakTopicBackfillMarker));
        metaQ.refresh();
        return;
      }

      const nextCursor = batch[batch.length - 1].entry.id;
      const claimedCount = (stored?.claimedCount ?? 0) + batch.length;
      /* Durable claim first. A failed claim means zero adaptation writes. */
      await upsertMetaKey(WEAK_TOPIC_BACKFILL_META_KEY, JSON.stringify({
        version: 1,
        status: 'running',
        cutoffEntryId,
        claimedThroughEntryId: nextCursor,
        claimedCount,
        updatedAt: nowIso(),
      } satisfies WeakTopicBackfillMarker));
      for (const { entry, topic, chapterId } of batch) {
        weakFedRef.current.add(entry.id);
        try {
          await recordTestResult(exam.id, topicIdFor(chapterId, topic), false, null, { topicName: topic });
        } catch (error) {
          /* recordTestResult spans three tables and has no transaction. Once
           * claimed, retrying could double-count a partial success. */
          console.warn(`[vicharakai] weak-topic backfill skipped claimed entry ${entry.id} after a write failure`, error);
        }
      }

      const hasMore = candidates.some((candidate) => candidate.entry.id > nextCursor);
      await upsertMetaKey(WEAK_TOPIC_BACKFILL_META_KEY, JSON.stringify({
        version: 1,
        status: hasMore ? 'pending' : 'complete',
        cutoffEntryId,
        claimedThroughEntryId: nextCursor,
        claimedCount,
        updatedAt: nowIso(),
      } satisfies WeakTopicBackfillMarker));
      metaQ.refresh();
      weakTopicsQ.refresh();
      topicAttemptsQ.refresh();
      examProgressQ.refresh();
    }).catch((error) => {
      console.warn('[vicharakai] weak-topic backfill did not start', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSessionReady, entriesQ.loading, metaQ.loading, activeSyllabusExam, accountSessionIds, userId]);

  /* ---------- tagging ---------- */

  const setOutcome = async (entry: QuestionEntryRow, outcome: QuestionOutcome) => {
    try {
      await patchEntry(entry.id, { outcome });
      entriesQ.refresh();
      feedWeakTopicEngine(entry, { ...entry, outcome });
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  const suggestionsDisabled = prefs?.suggest_tags_disabled === true;

  const suggestionFor = (topic: string | null): ErrorTag | null =>
    suggestErrorTag(entries, topic, suggestionsDisabled).suggestion;

  const upsertPrefs = async (patch: Record<string, unknown>) => {
    await runExclusive('ta-upsert-analysis-prefs', async () => {
      const rows = await fetchRowsWhere<AnalysisPrefsRow>(TABLES.analysisPrefs, []);
      const row = rows[0];
      if (row) await verifiedDbFrom(TABLES.analysisPrefs).update(row.id, { ...patch, updated_at_iso: nowIso() });
      else {
        await verifiedDbFrom(TABLES.analysisPrefs).insert({
          user_id: userId,
          tracks_timing: null,
          exam_type: null,
          suggest_tags_disabled: false,
          ...patch,
          updated_at_iso: nowIso(),
        });
      }
    });
    prefsQ.refresh();
  };

  /** How many doubts already come due on each FUTURE day — the map pile-up
   * protection walks so no single day drowns in revisions. */
  const deckLoadByDate = (): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of flaggedQ.data ?? []) {
      if (row.status !== 'queued') continue;
      const due = String(row.next_revision_on ?? '').slice(0, 10);
      if (!due || due <= today) continue;
      map.set(due, (map.get(due) ?? 0) + 1);
    }
    for (const entry of entries) {
      if (entry.is_doubt) continue;
      const due = String(entry.next_review_at ?? '').slice(0, 10);
      if (!due || due <= today) continue;
      map.set(due, (map.get(due) ?? 0) + 1);
    }
    return map;
  };

  /**
   * The due date a deck-eligible miss earns, from the ONE scheduler. Careless
   * and out-of-time return null — they never enter the deck at all.
   */
  const dueDateForTag = (tag: ErrorTag, load: Map<string, number>): string | null => {
    if (!deckEligibleTag(tag)) return null;
    const base =
      calculateNextRevision({ entityType: 'question', baseDate: today, step: 0 }).dueOn ?? addDaysISO(today, 1);
    return nextOpenRevisionDay(base, load, DOUBTS_DAILY_CAP);
  };

  /** Drop a deck card that should no longer exist (re-tagged as behavioural). */
  const detachDeckCard = async (entry: QuestionEntryRow) => {
    const deckId = Number(entry.deck_row_id);
    if (Number.isFinite(deckId) && deckId > 0) {
      await verifiedDbFrom(TABLES.questionQueue)
        .delete(deckId)
        .catch(() => undefined);
      flaggedQ.refresh();
    }
  };

  const applyErrorTag = async (entry: QuestionEntryRow, tag: ErrorTag, suggested: ErrorTag | null): Promise<boolean> => {
    try {
      const eligible = deckEligibleTag(tag);
      const dueOn = eligible ? dueDateForTag(tag, deckLoadByDate()) : null;
      /* Tagging never creates a card. A concept gap / couldn't-apply miss just
       * gets a due date; it becomes a deck card when that date arrives. */
      const patch: Record<string, unknown> = {
        error_tag: tag,
        suggested_tag: suggested,
        tag_overridden: suggested !== null && suggested !== tag,
        next_review_at: eligible ? entry.next_review_at ?? dueOn : null,
      };
      if (!eligible) {
        if (entry.is_doubt) await detachDeckCard(entry);
        patch.is_doubt = false;
        patch.doubt_status = null;
        patch.deck_row_id = null;
      }
      await patchEntry(entry.id, patch);
      entriesQ.refresh();
      feedWeakTopicEngine(entry, { ...entry, ...patch } as QuestionEntryRow);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
      return false;
    }
    /* Track suggestion quality: past ~30% overrides, stop suggesting. The
     * tag itself is already saved — a hiccup here must not read as a failed
     * tag, so this block reports nothing and never flips the return value. */
    try {
      if (suggested !== null && !suggestionsDisabled) {
        const projected = suggestErrorTag(
          [
            ...entries.filter((row) => row.id !== entry.id),
            { ...entry, error_tag: tag, suggested_tag: suggested, tag_overridden: suggested !== tag },
          ],
          null,
          false,
        );
        if (projected.shouldDisable) {
          await upsertPrefs({ suggest_tags_disabled: true });
          showToast('Tag suggestions are off — your own picks were better. You can re-enable them in settings.');
        }
      }
    } catch {
      /* non-fatal — the tag write above already landed */
    }
    return true;
  };

  /** Bulk tagging: ONE chip applied to every selected row, in one tap. */
  const applyErrorTagToMany = async (rows: QuestionEntryRow[], tag: ErrorTag): Promise<number> => {
    if (rows.length === 0) return 0;
    const eligible = deckEligibleTag(tag);
    const load = deckLoadByDate();
    let saved = 0;
    for (const entry of rows) {
      try {
        const dueOn = eligible ? dueDateForTag(tag, load) : null;
        const patch: Record<string, unknown> = {
          error_tag: tag,
          suggested_tag: null,
          tag_overridden: false,
          next_review_at: eligible ? entry.next_review_at ?? dueOn : null,
        };
        if (!eligible) {
          if (entry.is_doubt) await detachDeckCard(entry);
          patch.is_doubt = false;
          patch.doubt_status = null;
          patch.deck_row_id = null;
        }
        await patchEntry(entry.id, patch);
        feedWeakTopicEngine(entry, { ...entry, ...patch } as QuestionEntryRow);
        saved += 1;
      } catch {
        /* keep going — a partial bulk apply is better than none */
      }
    }
    entriesQ.refresh();
    if (saved > 0) showToast(`Tagged ${saved} question${saved === 1 ? '' : 's'}.`);
    else showToast("That didn't save — mind tapping it once more?");
    return saved;
  };

  /** Serialized per-topic rollup refresh (never races itself). */
  const refreshMastery = (topic: string, subject: string | null) => {
    const clean = sanitizeTopicName(topic);
    if (!clean) return;
    void runExclusive(`ta-mastery|${clean.toLowerCase()}`, async () => {
      const allSessions = await fetchRowsWhere<MockSessionRow>(TABLES.mockSessions, []);
      const allEntries = await fetchRowsWhere<QuestionEntryRow>(TABLES.mockQuestionEntries, []);
      const computed = computeTopicMastery(allSessions, allEntries, clean, examConfig);
      const existing = await fetchRowsWhere<TopicMasteryRow>(TABLES.mockTopicMastery, [
        { column: 'topic_id', operator: 'eq', value: clean },
      ]);
      /* No accuracy is written: only wrong questions are ever logged, so an
       * entry-derived accuracy is structurally 0. marks_lost is the key. */
      const payload = {
        user_id: userId,
        topic_id: clean,
        subject: sanitizeSubjectName(subject) ?? existing[0]?.subject ?? null,
        attempts: computed.attempts,
        last_seen_at: computed.lastSeenAt,
        consecutive_misses: computed.consecutiveMisses,
        marks_lost: computed.marksLost,
        doubt_count: computed.doubtCount,
        dominant_error_tag: computed.dominantErrorTag,
      };
      if (existing.length > 0) await verifiedDbFrom(TABLES.mockTopicMastery).update(existing[0].id, payload);
      else await verifiedDbFrom(TABLES.mockTopicMastery).insert(payload);
      masteryQ.refresh();
    }).catch(() => undefined);
  };

  const confirmTopic = async (
    entry: QuestionEntryRow,
    picked: { subject: string; chapter: string; topic: string },
    predictedTopic: string | null,
  ) => {
    const topic = sanitizeTopicName(picked.topic);
    if (!topic) {
      /* Chapter-only is never a valid final tag, and no placeholder topic is
       * ever written — the flow waits for a real pick from the syllabus. */
      showToast('Pick the specific topic from your syllabus — a chapter alone is not a final tag.');
      return;
    }
    try {
      await patchEntry(entry.id, {
        subject: sanitizeSubjectName(picked.subject),
        chapter_id: (picked.chapter ?? '').trim() || null,
        topic_id: topic,
        predicted_topic_id: sanitizeTopicName(predictedTopic),
        topic_confirmed_by_user: true,
      });
      entriesQ.refresh();
      feedWeakTopicEngine(entry, {
        ...entry,
        subject: sanitizeSubjectName(picked.subject),
        chapter_id: (picked.chapter ?? '').trim() || null,
        topic_id: topic,
      });
      refreshMastery(topic, picked.subject || null);
      const previous = sanitizeTopicName(entry.topic_id);
      if (previous && previous !== topic) refreshMastery(previous, null);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  const setTimeBucket = async (entry: QuestionEntryRow, bucket: TimeBucket | null) => {
    try {
      await patchEntry(entry.id, { time_bucket: bucket });
      entriesQ.refresh();
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  const setMarksAwarded = async (entry: QuestionEntryRow, marks: number | null, possible: number | null) => {
    try {
      await patchEntry(entry.id, { marks_awarded: marks, marks_possible: possible });
      entriesQ.refresh();
      const topic = sanitizeTopicName(entry.topic_id);
      if (topic) refreshMastery(topic, entry.subject ?? null);
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  const saveReasonNote = async (entry: QuestionEntryRow, note: string) => {
    try {
      await patchEntry(entry.id, { reason_note: (note ?? '').trim() || null });
      entriesQ.refresh();
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  /* ---------- concept gaps: the vision fallback (§4.1, stage 3) ---------- */

  const conceptGapContextFor = (entry: QuestionEntryRow): ConceptGapExamContext => {
    const session = sessions.find((row) => row.id === entry.mock_session_id) ?? null;
    return {
      /* The mock's own exam type is the most specific label available; the
       * student's enrolled exam stands in when the session has none. */
      examLabel:
        String(session?.exam_type ?? '').trim() ||
        String(examLabel ?? '').trim() ||
        topicPickerExamLabel,
      mockName: session?.name ?? null,
      subjects: topicPickerSubjects,
      errorTag: entry.error_tag ?? null,
    };
  };

  const analyzingConceptGap = (entry: QuestionEntryRow): boolean => conceptGapIds.includes(entry.id);

  /**
   * Ask the vision model what ONE crop is actually testing. This is the
   * signal the feature was missing: with the Tesseract text garbled there is
   * nothing to keyword-match, so the cropped IMAGE is the only honest input.
   *
   * What comes back is a SUGGESTION, not a tag. The topic reaches
   * predicted_topic_id only when the model is confident (at or above
   * CONCEPT_GAP_WRITE_CONFIDENCE) AND it resolved to a topic in the student's
   * own syllabus — below that it only pre-fills the picker, and topic_id
   * still needs the student's confirmation exactly as before. The gap
   * sentence is stored so they read it under the error-tag pill without the
   * wallet paying for the same crop twice.
   */
  const analyzeEntryConceptGap = async (entry: QuestionEntryRow): Promise<ConceptGapAnalysis | null> => {
    if (conceptGapRunningRef.current.has(entry.id) || !access.access.canAskAi) return null;
    conceptGapRunningRef.current.add(entry.id);
    setConceptGapIds((current) => (current.includes(entry.id) ? current : [...current, entry.id]));
    try {
      const analysis = await analyzeConceptGap(entry, conceptGapContextFor(entry));
      /* Nothing usable came back: charge nothing, store nothing, so a
       * transient failure can be retried on a later load. */
      if (!analysis) return null;
      access.chargeAi();
      recordOcrRead(true);

      const patch: Record<string, unknown> = {
        concept_being_tested: analysis.conceptBeingTested || null,
        concept_gap_description: analysis.description || null,
        concept_gap_confidence: analysis.confidence,
        concept_gap_analyzed_at: nowIso(),
        /* The cascade escalated this crop to the vision model. */
        ocr_escalated: true,
        /* ocr_confidence carries the confidence of the read now ON FILE, and
         * after an escalation that read is the model's — written on the
         * column's existing 0–100 scale so the cascade gate and the
         * escalation-rate metric keep comparing one consistent number. The
         * raw 0–1 value lives in concept_gap_confidence. */
        ocr_confidence: Math.round(analysis.confidence * 100),
      };
      const predicted = analysis.syllabusTopic ? sanitizeTopicName(analysis.syllabusTopic.topic) : null;
      if (predicted && analysis.confidence >= CONCEPT_GAP_WRITE_CONFIDENCE) {
        patch.predicted_topic_id = predicted;
      }
      try {
        await patchEntry(entry.id, patch);
        entriesQ.refresh();
      } catch {
        /* the caller still gets the analysis for this render */
      }
      return analysis;
    } catch {
      return null;
    } finally {
      conceptGapRunningRef.current.delete(entry.id);
      setConceptGapIds((current) => current.filter((id) => id !== entry.id));
    }
  };

  /**
   * THE fallback chain, in order:
   *   1. Tesseract text → the constrained syllabus match (topicPredict). A
   *      confident TOPIC-level hit still wins outright — clean OCR is
   *      cheaper and better than a vision call, and this path is unchanged.
   *   2. no text, or no confident topic → the crop goes to the vision model,
   *      whose topic is snapped back to the student's own syllabus before it
   *      is ever offered as a suggestion.
   * A chapter-only or unmatched result still ends where it always did: the
   * student picks from their syllabus and the entry waits until they do.
   */
  const predictEntryTopic = async (entry: QuestionEntryRow): Promise<TopicPrediction | null> => {
    const text = String(entry.extracted_text ?? '').trim();
    let prediction: TopicPrediction | null = null;
    if (text) {
      prediction = await predictTopic({
        text,
        subjects: topicPickerSubjects,
        examLabel: topicPickerExamLabel,
        canAskAi: access.access.canAskAi,
        onAiCharged: access.chargeAi,
      });
      const predicted = sanitizeTopicName(prediction.topic);
      if (predicted) {
        try {
          await patchEntry(entry.id, { predicted_topic_id: predicted });
          entriesQ.refresh();
        } catch {
          /* prediction is a suggestion — losing the log line is non-fatal */
        }
        return prediction;
      }
    }

    const analysis = await analyzeEntryConceptGap(entry);
    if (analysis?.syllabusTopic) {
      return {
        subject: analysis.syllabusTopic.subject,
        chapter: analysis.syllabusTopic.chapter,
        topic: analysis.syllabusTopic.topic,
        confidence: analysis.confidence,
        source: 'ai',
        needs: 'none',
      };
    }
    return prediction;
  };

  /**
   * Fill the concept gaps without being asked. A concept_gap tag with
   * nothing behind it is exactly the hole this feature had, so those entries
   * earn a vision call on their own — capped at
   * CONCEPT_GAP_AUTO_CAP_PER_MOCK per mock per mount so a twenty-question
   * paper can never drain the AI wallet, and run one at a time so a phone is
   * never hit by a dozen parallel image reads. Every OTHER trigger condition
   * (needsConceptGapAnalysis: no predicted topic, weak or missing OCR
   * confidence, an earlier escalation) is served on demand from the row's
   * own panel instead.
   */
  useEffect(() => {
    if (entriesQ.loading || !access.access.canAskAi) return;
    const perMock = new Map<number, number>();
    const pending: QuestionEntryRow[] = [];
    for (const entry of entries) {
      if (entry.error_tag !== 'concept_gap') continue;
      if (conceptGapAnalyzed(entry) || String(entry.concept_gap_description ?? '').trim()) continue;
      if (conceptGapAttemptedRef.current.has(entry.id) || !needsConceptGapAnalysis(entry)) continue;
      const already = perMock.get(entry.mock_session_id) ?? 0;
      if (already >= CONCEPT_GAP_AUTO_CAP_PER_MOCK) continue;
      perMock.set(entry.mock_session_id, already + 1);
      pending.push(entry);
    }
    if (pending.length === 0) return;
    for (const entry of pending) conceptGapAttemptedRef.current.add(entry.id);
    void runExclusive('ta-concept-gap', async () => {
      for (const entry of pending) await analyzeEntryConceptGap(entry);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesQ.loading, entries, access.access.canAskAi]);

  /* ---------- deck scope: schedule now, materialise when DUE ---------- */

  /** Entries of one mock holding a due date (not yet deck cards). */
  const scheduledCount = (session: MockSessionRow): number =>
    (entriesBySession.get(session.id) ?? []).filter(
      (entry) => !entry.is_doubt && deckEligibleTag(entry.error_tag) && Boolean(entry.next_review_at),
    ).length;

  /**
   * Give a mock's eligible misses a due date. NO deck cards are created here —
   * that is the whole point of the deck-scope rule: tagging a question does
   * not create a card, the scheduler brings the entry into the deck when it
   * comes due. Careless and out-of-time are skipped entirely.
   */
  const scheduleRemediation = async (session: MockSessionRow): Promise<number> => {
    if (remediating) return 0;
    setRemediating(true);
    try {
      const sessionEntries = entriesBySession.get(session.id) ?? [];
      const candidates = sessionEntries
        .filter(
          (entry) =>
            entry.outcome === 'incorrect' &&
            !entry.is_doubt &&
            !entry.next_review_at &&
            entryFullyTagged(entry) &&
            deckEligibleTag(entry.error_tag),
        )
        .sort((a, b) => {
          const rank = (entry: QuestionEntryRow) => (entry.error_tag === 'concept_gap' ? 0 : 1);
          return rank(a) - rank(b) || a.id - b.id;
        })
        .slice(0, REMEDIATION_CAP_PER_MOCK);
      if (candidates.length === 0) {
        showToast("Nothing to schedule — tag concept gaps or couldn't-apply misses first.");
        return 0;
      }
      /* Rotation WITHIN a topic: same-topic misses start on staggered days so
       * each revision serves a different question of that topic. Every date
       * comes from the ONE scheduler. */
      const load = deckLoadByDate();
      const topicIndex = new Map<string, number>();
      let scheduled = 0;
      for (const entry of candidates) {
        const topicName = (sanitizeTopicName(entry.topic_id) ?? '').toLowerCase();
        const offset = topicIndex.get(topicName) ?? 0;
        topicIndex.set(topicName, offset + 1);
        const base =
          calculateNextRevision({ entityType: 'question', baseDate: today, step: 0 }).dueOn ?? addDaysISO(today, 1);
        const dueOn = nextOpenRevisionDay(addDaysISO(base, offset), load, DOUBTS_DAILY_CAP);
        try {
          await patchEntry(entry.id, { next_review_at: dueOn });
          scheduled += 1;
        } catch {
          /* keep scheduling the rest */
        }
      }
      entriesQ.refresh();
      showToast(
        `${scheduled} question${scheduled === 1 ? '' : 's'} scheduled — they join your deck the day each one comes due.`,
      );
      return scheduled;
    } catch {
      showToast("Those didn't schedule — mind tapping once more?");
      return 0;
    } finally {
      setRemediating(false);
    }
  };

  /**
   * Materialise the deck cards whose due date has ARRIVED. This is the only
   * place a mock entry becomes a card in zuno_question_queue, so the deck is
   * never a mirror of the logged mistakes — it is what the scheduler says is
   * due. Runs once per day per mount.
   */
  const promotedForDayRef = useRef<string | null>(null);
  useEffect(() => {
    if (entriesQ.loading || flaggedQ.loading) return;
    if (promotedForDayRef.current === today) return;
    const due = entries.filter(
      (entry) =>
        !entry.is_doubt &&
        deckEligibleTag(entry.error_tag) &&
        entryFullyTagged(entry) &&
        Boolean(entry.next_review_at) &&
        String(entry.next_review_at).slice(0, 10) <= today,
    );
    if (due.length === 0) return;
    promotedForDayRef.current = today;
    void runExclusive('ta-promote-due', async () => {
      const activeCount = (flaggedQ.data ?? []).filter((row) => row.status === 'queued').length;
      let room = Math.max(0, MAX_ACTIVE_DOUBTS - activeCount);
      const perMock = new Map<number, number>();
      const promoted: QuestionEntryRow[] = [];
      for (const entry of due) {
        if (room <= 0) break;
        const already = perMock.get(entry.mock_session_id) ?? 0;
        if (already >= REMEDIATION_CAP_PER_MOCK) continue;
        const session = sessions.find((row) => row.id === entry.mock_session_id) ?? null;
        const topic = sanitizeTopicName(entry.topic_id);
        const isConceptGap = entry.error_tag === 'concept_gap';
        const note = String(entry.reason_note ?? '').trim();
        try {
          await verifiedDbFrom(TABLES.questionQueue).insert({
            source_type: 'mock',
            source_label: session?.name ?? 'Mock analysis',
            subject: sanitizeSubjectName(entry.subject) ?? SUBJECT_UNASSIGNED,
            topic: entry.chapter_id ? String(entry.chapter_id).trim() || null : null,
            question_text: String(entry.extracted_text ?? '').trim(),
            image_url: entry.crop_url ?? null,
            status: 'queued',
            created_on: today,
            options_json: null,
            correct: null,
            concept: isConceptGap ? topic : topic ? `Practice more: ${topic}` : null,
            difficulty: null,
            // The reason note doubles as the collapsed self-check answer; it
            // stays hidden on re-ask until the student attempts the question.
            solution_text: note || null,
            has_solution: note.length > 0,
            tag_confidence: 1,
            revise_count: 0,
            next_revision_on: today,
          });
          perMock.set(entry.mock_session_id, already + 1);
          room -= 1;
          promoted.push(entry);
        } catch {
          /* try the next one — the entry keeps its due date either way */
        }
      }
      if (promoted.length === 0) return;
      /* Link the new deck rows back onto the entries (insert returns no id —
       * re-read the newest mock-sourced rows). */
      let deckRows: FlaggedRow[] = [];
      try {
        deckRows = await fetchRowsWhere<FlaggedRow>(
          TABLES.questionQueue,
          [{ column: 'source_type', operator: 'eq', value: 'mock' }],
          { orderBy: { column: 'id', direction: 'desc' } },
        );
      } catch {
        deckRows = [];
      }
      for (const entry of promoted) {
        const match = deckRows.find(
          (row) =>
            (entry.crop_url && row.image_url === entry.crop_url) ||
            (!entry.crop_url && row.question_text === String(entry.extracted_text ?? '').trim()),
        );
        await patchEntry(entry.id, {
          is_doubt: true,
          doubt_status: 'open',
          deck_row_id: match?.id ?? null,
          next_review_at: match?.next_revision_on ?? today,
        }).catch(() => undefined);
      }
      flaggedQ.refresh();
      entriesQ.refresh();
      showToast(
        `${promoted.length} mock question${promoted.length === 1 ? '' : 's'} came due — ${
          promoted.length === 1 ? 'it is' : 'they are'
        } in your deck now.`,
      );
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesQ.loading, flaggedQ.loading, entries, today]);

  /* ---------- timing preference ---------- */

  const tracksTiming = prefs ? (typeof prefs.tracks_timing === 'boolean' ? prefs.tracks_timing : null) : null;

  const setTracksTiming = async (value: boolean | null, options?: { silent?: boolean }) => {
    try {
      await upsertPrefs({ tracks_timing: value });
    } catch (error) {
      console.error('[vicharakai] timing preference save failed', error);
      /* The timing preference is secondary. When it is set as part of the
       * first-mock save flow the caller passes { silent: true } so a hiccup
       * here never masquerades as the mock itself failing to save — the mock
       * save reports its own outcome. A genuine session refusal has already
       * dispatched the re-auth event, so the student is routed to sign-in. */
      if (options?.silent) return;
      showToast(
        isSessionVerificationError(error)
          ? 'Sign in again — your session expired.'
          : "That didn't save — mind tapping it once more?",
      );
    }
  };

  const setSuggestionsDisabled = async (disabled: boolean) => {
    try {
      await upsertPrefs({ suggest_tags_disabled: disabled });
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  /* ---------- share links ---------- */

  const shareUrlOf = (share: AnalysisShareRow): string =>
    `${window.location.origin}/api/hooks/execute/${spaceId}/mock-analysis-share?token=${share.token}`;

  const createShare = async (args: {
    scope: 'single_mock' | 'date_range';
    mockSessionId: number | null;
    rangeStart: string | null;
    rangeEnd: string | null;
    includeReasonNotes: boolean;
  }): Promise<string | null> => {
    try {
      const token = randomToken();
      await verifiedDbFrom(TABLES.analysisShares).insert({
        user_id: userId,
        scope: args.scope,
        mock_session_id: args.mockSessionId,
        range_start: args.rangeStart,
        range_end: args.rangeEnd,
        include_reason_notes: args.includeReasonNotes,
        token,
        created_at_iso: nowIso(),
        revoked_at: null,
      });
      sharesQ.refresh();
      return `${window.location.origin}/api/hooks/execute/${spaceId}/mock-analysis-share?token=${token}`;
    } catch {
      showToast("That link didn't create — mind tapping once more?");
      return null;
    }
  };

  const revokeShare = async (share: AnalysisShareRow) => {
    try {
      await verifiedDbFrom(TABLES.analysisShares).update(share.id, { revoked_at: nowIso() });
      sharesQ.refresh();
      showToast('Link revoked — it stops working immediately.');
    } catch {
      showToast("That didn't save — mind tapping it once more?");
    }
  };

  return {
    sessionsQ,
    imagesQ,
    entriesQ,
    masteryQ,
    prefsQ,
    sharesQ,
    configsQ,
    sessions,
    imagesBySession,
    entriesBySession,
    entries,
    unprocessedImages,
    prefs,
    shares,
    savingSession,
    uploadingPages,
    examConfig,
    examConfigRow: resolvedScheme.row,
    schemeUnresolved: resolvedScheme.unresolved,
    examConfigRows,
    savingScheme,
    saveExamConfig,
    selectRegionalExamConfig,
    createSession,
    addPages,
    addPagesAndExtract,
    retryAiExtract,
    aiReadingPages,
    markSegmentationAttempted,
    saveCrops,
    markWholePageQuestion,
    removeEntry,
    setOutcome,
    applyErrorTag,
    applyErrorTagToMany,
    confirmTopic,
    setTimeBucket,
    setMarksAwarded,
    saveReasonNote,
    predictEntryTopic,
    analyzeEntryConceptGap,
    analyzingConceptGap,
    suggestionFor,
    scheduleRemediation,
    remediating,
    scheduledCount,
    mockDeckRows,
    dueDeckRows,
    filteredDeckRows,
    deckFilter,
    setDeckFilter,
    deckMockLabels,
    deckTopicLabels,
    doubtsByTopic,
    tracksTiming,
    setTracksTiming,
    suggestionsDisabled,
    setSuggestionsDisabled,
    ocrMetric,
    ocrEscalationRate: ocrEscalationRate(ocrMetric),
    createShare,
    revokeShare,
    shareUrlOf,
  };
}

/** Re-exported so the parsed ExamConfig shape is available from the hook. */
export { parseExamConfigRow };
