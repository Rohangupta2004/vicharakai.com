/**
 * TestAnalysisScreen — the Test Analysis tab: the complete Mock Test Analysis
 * system, self-contained (deliberately NOT merged into Today/Doubts).
 *
 * Flow: create a mock session (step 1 — the ONLY place a score is logged, and
 * THE source of accuracy and score everywhere in this feature) → upload paper
 * pages → auto-segmentation proposes crops, the student confirms → the OCR
 * cascade fills question text behind the save (internal only) → tag every
 * wrong question from ONE list with a single tap per row (LoggingList) → the
 * analysis views (per-mock and cross-mock) open behind a coverage gate →
 * concept-gap and couldn't-apply misses get a due date and join the EXISTING
 * FSRS deck only when the scheduler brings them due (cap 5/mock).
 *
 * Every marks figure on this screen comes from the exam's ExamConfig row
 * (examConfig.ts / vicharakai_exam_configs) — never a hardcoded constant.
 *
 * Premium: the whole tab sits behind the same subscription paywall as the
 * rest of the app (openPaywall('analysis') when a lapsed plan taps in).
 */
/* eslint-disable */
import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileDown,
  Image as ImageIcon,
  Layers,
  LineChart,
  Link2,
  Loader2,
  Lock,
  NotebookPen,
  Plus,
  Scissors,
  Share2,
  Sparkles,
  Calculator,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  DOUBT_ACCENT,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  subjectColor,
  subjectTint,
  tint,
} from '../../theme';
import { Card, SectionLabel, SubjectDot } from '../../ui';
import { examPace } from '../../config/examTiming';
import { examLabelFromId } from '../../customExam';
import type { FlaggedRow } from '../../mcq';
import { useApp } from '../../app/AppContext';
import CropScreen from './CropScreen';
import LoggingList from './LoggingList';
import { useTestAnalysis, type DeckFilterKind, type MockSessionDraft } from './useTestAnalysis';
import { coverageOf, crossMockAnalysis, perMockAnalysis, sessionTotals } from './taSelectors';
import { exportCrossMockPdf, exportMockPdf } from './pdfExport';
import {
  MARKS_UNITS,
  formatUnits,
  lostVerb,
  regionalTemplateMatchesExam,
  unitNoun,
  type ExamConfigRow,
  type MarksUnit,
} from './examConfig';
import {
  asCount,
  type AnalysisShareRow,
  type MockSessionRow,
  type SourceImageRow,
} from './taTypes';

type View =
  | { kind: 'list' }
  | { kind: 'session'; sessionId: number }
  | { kind: 'analysis'; sessionId: number }
  | { kind: 'trends' };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return String(iso).slice(0, 10);
  }
}

const inputStyle = {
  background: NAVY_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS.sm,
  color: TEXT,
} as const;

export default function TestAnalysisScreen() {
  const { data, access, tests, doubts, analysis: ta } = useApp();
  const { profile, examDef, savedExamLabel, today } = data;

  const [view, setView] = useState<View>({ kind: 'list' });
  const [cropTarget, setCropTarget] = useState<SourceImageRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [timingPromptOpen, setTimingPromptOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<MockSessionDraft | null>(null);
  const [coveragePromptFor, setCoveragePromptFor] = useState<number | null>(null);
  const [shareSheetFor, setShareSheetFor] = useState<{ sessionId: number | null } | null>(null);

  const examName = examDef?.name ?? (savedExamLabel || (profile ? examLabelFromId(profile.exam) : 'Your exam'));
  const examPacing = examPace(profile?.exam ?? null, examName);
  /* The exam's OWN marking scheme sets the pacing target once one resolves. */
  const benchmarkSeconds = ta.schemeUnresolved
    ? examPacing.secondsPerQuestion
    : ta.examConfig.target_seconds_per_q;
  const tracksTiming = ta.tracksTiming === true;

  /* All hooks live ABOVE the paywall early-return (rules of hooks). */
  const cross = useMemo(
    () => crossMockAnalysis(ta.sessions, ta.entriesBySession, ta.examConfig, ta.doubtsByTopic),
    [ta.sessions, ta.entriesBySession, ta.examConfig, ta.doubtsByTopic],
  );

  /* ---------- paywall gate (same subscription as the rest of the app) ---------- */
  if (!access.access.premiumUnlocked) {
    return (
      <div className="flex-1 w-full max-w-[600px] mx-auto px-5 sm:px-8 pt-6 vicharak-screen-pad">
        <h1 className="text-[22px] font-extrabold" style={{ color: TEXT }}>Test Analysis</h1>
        <Card radius={RADIUS.lg} className="mt-4 p-5 text-center" testId="card-analysis-locked">
          <span className="mx-auto w-12 h-12 rounded-full flex items-center justify-center" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Lock className="w-6 h-6" />
          </span>
          <p className="mt-3 text-sm font-extrabold" style={{ color: TEXT }}>Mock Test Analysis is a Premium feature</p>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
            Crop your paper, tag every mistake with a reason, and see exactly which topics cost you marks — mock after mock.
          </p>
          <button
            type="button"
            onClick={() => access.openPaywall('analysis')}
            className="mt-4 w-full py-3 text-sm font-extrabold touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-analysis-unlock"
          >
            Unlock Test Analysis
          </button>
        </Card>
      </div>
    );
  }

  const activeSession =
    view.kind === 'session' || view.kind === 'analysis'
      ? ta.sessions.find((session) => session.id === view.sessionId) ?? null
      : null;

  const openAnalysisGated = (sessionId: number) => {
    const entries = ta.entriesBySession.get(sessionId) ?? [];
    const coverage = coverageOf(entries);
    if (coverage.belowGate) setCoveragePromptFor(sessionId);
    else setView({ kind: 'analysis', sessionId });
  };

  const submitDraft = async (draft: MockSessionDraft) => {
    const result = await ta.createSession(draft);
    if (result.saved) {
      /* The mock IS saved — close the form even when the follow-up re-read
       * couldn't hand back the fresh row (the list refreshes to show it).
       * Leaving the form open here is what invited duplicate saves. */
      setFormOpen(false);
      if (result.row) setView({ kind: 'session', sessionId: result.row.id });
    }
  };

  const handleCreate = (draft: MockSessionDraft) => {
    /* Time-capture onboarding: asked ONCE, at the first mock session. */
    if (ta.tracksTiming === null && ta.sessions.length === 0) {
      setPendingDraft(draft);
      setTimingPromptOpen(true);
      return;
    }
    void submitDraft(draft);
  };

  return (
    <div className="flex-1 w-full max-w-[600px] lg:max-w-[860px] mx-auto px-5 sm:px-8 vicharak-screen-pad">
      {view.kind !== 'list' && !activeSession && view.kind !== 'trends' && (
        <Card radius={RADIUS.lg} className="mt-6 p-5 text-center" testId="analysis-missing-session">
          <AlertTriangle className="w-6 h-6 mx-auto" style={{ color: WARNING }} />
          <h1 className="mt-3 text-base font-extrabold" style={{ color: TEXT }}>That mock is no longer available</h1>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            Return to your mock list and choose another session.
          </p>
          <button type="button" onClick={() => setView({ kind: 'list' })} className="vicharak-btn vicharak-btn-primary mt-4 w-full">
            Back to my mocks
          </button>
        </Card>
      )}

      {view.kind === 'list' && (
        <ListView
          examName={examName}
          ta={ta}
          cross={cross}
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          onCreate={handleCreate}
          today={today}
          onOpenSession={(sessionId) => setView({ kind: 'session', sessionId })}
          onOpenTrends={() => setView({ kind: 'trends' })}
          onOpenCrop={setCropTarget}
          onOpenDeckCard={(row) => doubts.setFlaggedDetail(row)}
        />
      )}

      {view.kind === 'session' && activeSession && (
        <SessionView
          session={activeSession}
          ta={ta}
          tracksTiming={tracksTiming}
          onBack={() => setView({ kind: 'list' })}
          onOpenCrop={setCropTarget}
          onOpenAnalysis={() => openAnalysisGated(activeSession.id)}
          onOpenShare={() => setShareSheetFor({ sessionId: activeSession.id })}
        />
      )}

      {view.kind === 'analysis' && activeSession && (
        <AnalysisView
          session={activeSession}
          ta={ta}
          examName={examName}
          benchmarkSeconds={benchmarkSeconds}
          tracksTiming={tracksTiming}
          risingCareless={cross.risingCareless}
          onBack={() => setView({ kind: 'session', sessionId: activeSession.id })}
          onOpenShare={() => setShareSheetFor({ sessionId: activeSession.id })}
          onTimedDrill={tests.openTestSetup}
        />
      )}

      {view.kind === 'trends' && (
        <TrendsView
          ta={ta}
          cross={cross}
          examName={examName}
          onBack={() => setView({ kind: 'list' })}
          onOpenShare={() => setShareSheetFor({ sessionId: null })}
        />
      )}

      {/* ---------- overlays ---------- */}

      {cropTarget && (
        <CropScreen
          image={cropTarget}
          onSave={async (crops) => {
            const session = ta.sessions.find((row) => row.id === cropTarget.mock_session_id);
            if (!session) throw new Error('mock session missing');
            await ta.saveCrops(session, cropTarget, crops);
          }}
          onWholePage={async () => {
            const session = ta.sessions.find((row) => row.id === cropTarget.mock_session_id);
            if (!session) throw new Error('mock session missing');
            await ta.markWholePageQuestion(session, cropTarget);
          }}
          onSegmentationAttempted={() => void ta.markSegmentationAttempted(cropTarget)}
          onClose={() => setCropTarget(null)}
        />
      )}

      {timingPromptOpen && (
        <Sheet ariaLabel="Do you track time per question?" onClose={() => setTimingPromptOpen(false)}>
          <span className="mx-auto w-11 h-11 rounded-full flex items-center justify-center" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
            <Timer className="w-5 h-5" />
          </span>
          <h2 className="mt-3 text-base font-extrabold text-center" style={{ color: TEXT }}>Do you track time per question?</h2>
          <p className="mt-1 text-[12px] text-center leading-relaxed" style={{ color: TEXT_MUTED }}>
            If yes, each question gets a coarse time bucket (under 2 · 2–4 · over 4 minutes) and you unlock pacing analytics.
            If not, the timing fields stay hidden entirely — you can change this later in this tab's settings.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {([
              { label: 'Yes', value: true },
              { label: 'No', value: false },
              { label: 'Skip', value: false },
            ] as const).map((option, index) => (
              <button
                key={`${option.label}-${index}`}
                type="button"
                onClick={() => {
                  setTimingPromptOpen(false);
                  const draft = pendingDraft;
                  setPendingDraft(null);
                  /* Saving the mock is the primary action, so run it first and
                     let it report its own outcome. The timing preference is
                     secondary: persist it best-effort and keep it silent on
                     failure so a preference hiccup can never surface as "that
                     didn't save" and make the student think the mock was lost. */
                  if (draft) void submitDraft(draft);
                  void ta.setTracksTiming(option.value, { silent: true });
                }}
                className="py-3 text-sm font-extrabold touch-manipulation"
                style={
                  option.value
                    ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                    : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
                }
                data-testid={`button-timing-${option.label.toLowerCase()}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {coveragePromptFor !== null && (() => {
        const coverage = coverageOf(ta.entriesBySession.get(coveragePromptFor) ?? []);
        return (
          <Sheet ariaLabel="Finish tagging first?" onClose={() => setCoveragePromptFor(null)}>
            <span className="mx-auto w-11 h-11 rounded-full flex items-center justify-center" style={{ background: tint(WARNING, 0.14), color: WARNING }}>
              <AlertTriangle className="w-5 h-5" />
            </span>
            <h2 className="mt-3 text-base font-extrabold text-center" style={{ color: TEXT }}>
              You've tagged {coverage.wrongTagged} of {coverage.wrongTotal} wrong questions
            </h2>
            <p className="mt-1 text-[12px] text-center leading-relaxed" style={{ color: TEXT_MUTED }}>
              Do you want to finish tagging before viewing the analysis? Partial data is labelled as partial — topic
              trends can mislead until the wrong questions carry their reasons.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const sessionId = coveragePromptFor;
                  setCoveragePromptFor(null);
                  setView({ kind: 'session', sessionId });
                }}
                className="py-3 text-sm font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-coverage-keep-tagging"
              >
                Keep tagging
              </button>
              <button
                type="button"
                onClick={() => {
                  const sessionId = coveragePromptFor;
                  setCoveragePromptFor(null);
                  setView({ kind: 'analysis', sessionId });
                }}
                className="py-3 text-sm font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-coverage-proceed"
              >
                View anyway
              </button>
            </div>
          </Sheet>
        );
      })()}

      {shareSheetFor && (
        <ShareSheet
          scopeSessionId={shareSheetFor.sessionId}
          sessions={ta.sessions}
          ta={ta}
          today={today}
          onClose={() => setShareSheetFor(null)}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Shared sheet wrapper                                               */
/* ================================================================== */

function Sheet({ children, onClose, ariaLabel }: { children: ReactNode; onClose: () => void; ariaLabel: string }) {
  return (
    <div className="fixed inset-0 z-[72] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Close" />
      <div
        className="relative max-h-[88vh] overflow-y-auto px-5 pt-5 pb-8 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet }}
      >
        {children}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  List view — sessions, new-session form, deck, settings             */
/* ================================================================== */

function ListView({
  examName,
  ta,
  cross,
  formOpen,
  setFormOpen,
  onCreate,
  today,
  onOpenSession,
  onOpenTrends,
  onOpenCrop,
  onOpenDeckCard,
}: {
  examName: string;
  ta: ReturnType<typeof useTestAnalysis>;
  cross: ReturnType<typeof crossMockAnalysis>;
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  onCreate: (draft: MockSessionDraft) => void;
  today: string;
  onOpenSession: (id: number) => void;
  onOpenTrends: () => void;
  onOpenCrop: (image: SourceImageRow) => void;
  onOpenDeckCard: (row: FlaggedRow) => void;
}) {
  return (
    <>
      <header className="pt-6 vicharak-rise">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[22px] sm:text-[26px] font-extrabold leading-[1.12] tracking-tight" style={{ color: TEXT }} data-testid="text-analysis-title">
            Test Analysis
          </h1>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
          Bring in a mock, let Vicharee read the paper, mark each question Correct / Wrong / Skipped, tag WHY — and
          watch the pattern, not just the score.
        </p>
      </header>

      {/* Unprocessed tray badge */}
      {ta.unprocessedImages.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenCrop(ta.unprocessedImages[0])}
          className="mt-3 w-full flex items-center gap-2.5 px-4 py-3 text-left vicharak-rise touch-manipulation"
          style={{ borderRadius: RADIUS.md, background: tint(WARNING, 0.09), border: `1px solid ${tint(WARNING, 0.3)}` }}
          data-testid="banner-unprocessed-tray"
        >
          <Layers className="w-4 h-4 flex-shrink-0" style={{ color: WARNING }} />
          <span className="min-w-0 flex-1 text-[12px] font-bold" style={{ color: TEXT_SECONDARY }}>
            {ta.unprocessedImages.length} page{ta.unprocessedImages.length === 1 ? '' : 's'} couldn't be auto-read — tap to split into questions manually
          </span>
          <Scissors className="w-4 h-4 flex-shrink-0" style={{ color: WARNING }} />
        </button>
      )}

      {/* Cross-mock — the payoff, so it leads once there is history. */}
      {ta.sessions.length >= 2 && (
        <button
          type="button"
          onClick={onOpenTrends}
          className="mt-4 w-full p-4 flex items-center gap-3 text-left vicharak-rise touch-manipulation"
          style={{ background: BRAND_GRADIENT, borderRadius: RADIUS.lg, color: ON_AMBER, boxShadow: '0 10px 26px rgba(0,151,184,0.24)' }}
          data-testid="button-open-trends"
        >
          <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <LineChart className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Across your mocks</span>
            <span className="block text-[11px] mt-0.5 opacity-85">
              Topic trends, repeat offenders, and whether carelessness is going down · {ta.sessions.length} mocks
            </span>
          </span>
          <ChevronRight className="w-5 h-5 flex-shrink-0" />
        </button>
      )}

      {/* New mock session — STEP 1 (the only score-log entry point). */}
      <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" testId="card-new-mock">
        <button
          type="button"
          onClick={() => setFormOpen(!formOpen)}
          aria-expanded={formOpen}
          className="w-full flex items-center gap-2.5 text-left touch-manipulation"
          data-testid="button-toggle-new-mock"
        >
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND_GRADIENT, color: ON_AMBER }}>
            <Plus className="w-[18px] h-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-extrabold" style={{ color: TEXT }}>New mock session</span>
            <span className="block text-[11px]" style={{ color: TEXT_MUTED }}>Step 1 — log the score, then add the paper pages</span>
          </span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: TEXT_MUTED, transform: formOpen ? 'rotate(180deg)' : undefined }} />
        </button>
        {formOpen && (
          <SessionForm
            examName={ta.schemeUnresolved ? examName : ta.examConfig.exam_type}
            today={today}
            saving={ta.savingSession}
            existingCount={ta.sessions.length}
            onSubmit={onCreate}
          />
        )}
      </Card>

      {/* Sessions */}
      <section className="mt-5 vicharak-rise" data-testid="section-mock-sessions">
        <SectionLabel>Your mocks{ta.sessions.length > 0 ? ` · ${ta.sessions.length}` : ''}</SectionLabel>
        {ta.sessions.length === 0 ? (
          <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            No mocks yet. Take one outside, then log it here — the analysis turns your wrong questions into a plan.
          </p>
        ) : (
          <ul className="space-y-2">
            {ta.sessions.map((session) => {
              const entries = ta.entriesBySession.get(session.id) ?? [];
              const coverage = coverageOf(entries);
              const pages = ta.imagesBySession.get(session.id) ?? [];
              /* Score AND accuracy come from the totals entered at Step 1. */
              const totals = sessionTotals(session, ta.examConfig);
              const percent = totals.scorePercent;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => onOpenSession(session.id)}
                    className="w-full px-3.5 py-3 flex items-center gap-3 text-left touch-manipulation vicharak-fade"
                    style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                    data-testid={`mock-session-${session.id}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold leading-snug break-words" style={{ color: TEXT }}>{session.name}</span>
                      <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>
                        {formatDate(session.date)} · {totals.accuracy}% accuracy · {pages.length} page{pages.length === 1 ? '' : 's'} · {entries.length} logged
                        {coverage.wrongTotal > 0 ? ` · ${coverage.wrongTagged}/${coverage.wrongTotal} tagged` : ''}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-right">
                      <span className="block text-[14px] font-extrabold tabular-nums" style={{ color: percent >= 75 ? SUCCESS : percent >= 50 ? WARNING : DANGER }}>
                        {asCount(session.score)}/{asCount(session.max_score)}
                      </span>
                      <span className="block text-[10px] font-bold tabular-nums" style={{ color: TEXT_MUTED }}>{percent}%</span>
                    </span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ONE deck, filtered — doubts and mock revisions in a single due queue. */}
      <DeckSection ta={ta} onOpenDeckCard={onOpenDeckCard} />

      {/* The marking scheme — the source of every marks figure. */}
      <SchemeCard ta={ta} examName={examName} />

      {/* Tab settings — timing + suggestions, changeable any time. */}
      <section className="mt-6 vicharak-rise" data-testid="section-analysis-settings">
        <SectionLabel icon={<Clock className="w-3 h-3" />}>Analysis settings</SectionLabel>
        <Card radius={RADIUS.md} className="p-3.5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-extrabold" style={{ color: TEXT }}>Track time per question</span>
              <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>
                {ta.tracksTiming === null ? "You'll be asked at your first mock" : ta.tracksTiming ? 'Coarse buckets shown while tagging' : 'Timing fields hidden entirely'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void ta.setTracksTiming(!(ta.tracksTiming === true))}
              aria-pressed={ta.tracksTiming === true}
              className="px-3 py-1.5 text-[11px] font-extrabold flex-shrink-0 touch-manipulation"
              style={
                ta.tracksTiming === true
                  ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                  : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
              }
              data-testid="toggle-tracks-timing"
            >
              {ta.tracksTiming === true ? 'On' : 'Off'}
            </button>
          </div>
          {ta.suggestionsDisabled && (
            <div className="flex items-center gap-3" style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 12 }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold" style={{ color: TEXT }}>Error-tag suggestions</span>
                <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>Turned off — your overrides said the guesses weren't helping</span>
              </span>
              <button
                type="button"
                onClick={() => void ta.setSuggestionsDisabled(false)}
                className="px-3 py-1.5 text-[11px] font-extrabold flex-shrink-0 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-reenable-suggestions"
              >
                Re-enable
              </button>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

/* ================================================================== */
/*  ONE deck, filtered                                                 */
/* ================================================================== */

/**
 * The deck is NOT a view of logged mistakes — tagging a question does not put
 * it here. Concept-gap and couldn't-apply misses arrive when the scheduler
 * brings them due; careless and out-of-time never arrive at all.
 *
 * Doubts and mock revisions share ONE due queue. The filter is a small
 * control at the top, never a navigation destination: it narrows the same
 * list, keeps the same cards, chips and scheduling, holds for the session and
 * resets itself to 'All due' the next day.
 */
function DeckSection({
  ta,
  onOpenDeckCard,
}: {
  ta: ReturnType<typeof useTestAnalysis>;
  onOpenDeckCard: (row: FlaggedRow) => void;
}) {
  const filters: Array<{ id: DeckFilterKind; label: string }> = [
    { id: 'all', label: 'All due' },
    { id: 'doubts', label: 'Doubts only' },
    { id: 'mock', label: 'By mock' },
    { id: 'topic', label: 'By topic' },
  ];
  const rows = ta.filteredDeckRows;
  const subFilters =
    ta.deckFilter.kind === 'mock' ? ta.deckMockLabels : ta.deckFilter.kind === 'topic' ? ta.deckTopicLabels : [];
  const activeSub = ta.deckFilter.kind === 'mock' ? ta.deckFilter.mock : ta.deckFilter.topic;

  return (
    <section className="mt-6 vicharak-rise" data-testid="section-analysis-deck">
      <SectionLabel icon={<NotebookPen className="w-3 h-3" />}>
        Revision deck{ta.dueDeckRows.length > 0 ? ` · ${ta.dueDeckRows.length} due` : ''}
      </SectionLabel>
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => ta.setDeckFilter({ kind: filter.id, mock: null, topic: null })}
            aria-pressed={ta.deckFilter.kind === filter.id}
            className="px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
            style={
              ta.deckFilter.kind === filter.id
                ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
            }
            data-testid={`deck-filter-${filter.id}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {subFilters.length > 0 && (
        <div className="flex gap-1.5 mb-2.5 flex-wrap" data-testid="deck-subfilters">
          {subFilters.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                ta.setDeckFilter({
                  kind: ta.deckFilter.kind,
                  mock: ta.deckFilter.kind === 'mock' ? (activeSub === label ? null : label) : null,
                  topic: ta.deckFilter.kind === 'topic' ? (activeSub === label ? null : label) : null,
                })
              }
              aria-pressed={activeSub === label}
              className="px-2.5 py-1 text-[10px] font-extrabold touch-manipulation"
              style={
                activeSub === label
                  ? { borderRadius: RADIUS.chip, background: tint(AMBER, 0.16), border: `1px solid ${tint(AMBER, 0.5)}`, color: AMBER }
                  : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER}`, color: TEXT_MUTED, background: 'transparent' }
              }
              data-testid={`deck-subfilter-${label.slice(0, 18)}`}
            >
              <span className="whitespace-normal break-words">{label}</span>
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-deck-empty">
          Nothing due for this filter. Cards arrive when their revision date comes round — tagging a question doesn't
          put it here, and careless or out-of-time misses never do.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 12).map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOpenDeckCard(row)}
                className="w-full px-3.5 py-3 flex items-center gap-2.5 text-left touch-manipulation vicharak-fade"
                style={{
                  background: CARD,
                  border: `1px solid ${tint(DOUBT_ACCENT, 0.4)}`,
                  borderRadius: RADIUS.md,
                  boxShadow: `0 3px 0 -1px ${tint(DOUBT_ACCENT, 0.3)}`,
                }}
                data-testid={`deck-card-${row.id}`}
              >
                {row.image_url && (
                  <img src={row.image_url} alt="Question" className="w-14 h-14 object-cover flex-shrink-0" style={{ borderRadius: 8, border: `1px solid ${BORDER}` }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold leading-snug truncate" style={{ color: TEXT_SECONDARY }}>
                    {(row.concept || row.topic || row.question_text || 'Photo question').toString().slice(0, 70)}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold" style={{ borderRadius: RADIUS.chip, background: subjectTint(row.subject, 0.14), color: subjectColor(row.subject) }}>
                      <SubjectDot subject={row.subject} size={5} />
                      {row.subject}
                    </span>
                    {row.source_label && (
                      <span className="text-[9px] font-extrabold" style={{ color: AMBER }}>From: {row.source_label}</span>
                    )}
                    {row.next_revision_on && (
                      <span className="text-[9px]" style={{ color: TEXT_MUTED }}>due {formatDate(row.next_revision_on)}</span>
                    )}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ================================================================== */
/*  Marking scheme (ExamConfig)                                        */
/* ================================================================== */

const INDIA_STATES_AND_UTS = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const GAOKAO_PROVINCES = [
  'Anhui', 'Beijing', 'Chongqing', 'Fujian', 'Gansu', 'Guangdong', 'Guangxi', 'Guizhou',
  'Hainan', 'Hebei', 'Heilongjiang', 'Henan', 'Hubei', 'Hunan', 'Inner Mongolia', 'Jiangsu',
  'Jiangxi', 'Jilin', 'Liaoning', 'Ningxia', 'Qinghai', 'Shaanxi', 'Shandong', 'Shanghai',
  'Shanxi', 'Sichuan', 'Tianjin', 'Tibet', 'Xinjiang', 'Yunnan', 'Zhejiang',
];

function regionOptionsFor(entry: ExamConfigRow): string[] {
  return /gaokao/i.test(entry.exam_type) ? GAOKAO_PROVINCES : INDIA_STATES_AND_UTS;
}

/**
 * The exam's marking scheme, editable. These are DB rows, not constants: the
 * shipped presets are seeded once and can be corrected here at any time, and
 * every marks figure in the feature reads whatever is stored.
 * `unit_label` changes WORDING only — 'lost 9 marks' vs 'missed 9 questions'
 * is the same number with a different noun.
 */
function SchemeCard({ ta, examName }: { ta: ReturnType<typeof useTestAnalysis>; examName: string }) {
  const [open, setOpen] = useState(false);
  const [regionByRow, setRegionByRow] = useState<Record<number, string>>({});
  const row = ta.examConfigRow;
  const config = ta.examConfig;
  const regionalTemplates = ta.examConfigRows.filter(
    (entry) =>
      String(entry.status ?? 'active') === 'active' &&
      regionalTemplateMatchesExam(entry, examName),
  );
  const todo = ta.examConfigRows.filter((entry) => String(entry.status ?? 'active') === 'todo');

  const numberField = (
    label: string,
    value: number,
    onSave: (next: number) => void,
    testId: string,
  ) => (
    <label className="block text-[10px] font-bold" style={{ color: TEXT_SECONDARY }}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        step="0.001"
        defaultValue={String(value)}
        onBlur={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next !== value) onSave(next);
        }}
        className="mt-1 w-full px-2.5 py-2 text-[13px]"
        style={inputStyle}
        data-testid={testId}
      />
    </label>
  );

  return (
    <section className="mt-6 vicharak-rise" data-testid="section-marking-scheme">
      <SectionLabel icon={<Calculator className="w-3 h-3" />}>Marking scheme</SectionLabel>
      <Card radius={RADIUS.md} className="p-3.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 text-left touch-manipulation"
          data-testid="button-toggle-scheme"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold" style={{ color: TEXT }}>
              {config.exam_type}
            </span>
            <span className="block text-[10px]" style={{ color: TEXT_MUTED }} data-testid="text-scheme-summary">
              Correct {config.marks_correct > 0 ? '+' : ''}{config.marks_correct} · wrong{' '}
              {config.marks_incorrect > 0 ? '+' : ''}{config.marks_incorrect} · skipped {config.marks_skipped} · shown as{' '}
              {unitNoun(config)}
              {config.allows_partial_credit ? ' · partial credit' : ''}
            </span>
          </span>
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 transition-transform"
            style={{ color: TEXT_MUTED, transform: open ? 'rotate(180deg)' : undefined }}
          />
        </button>

        {ta.schemeUnresolved && (
          <p
            className="mt-2.5 px-3 py-2 text-[11px] font-bold"
            style={{ borderRadius: RADIUS.sm, background: tint(WARNING, 0.09), border: `1px solid ${tint(WARNING, 0.3)}`, color: WARNING }}
            data-testid="text-scheme-unresolved"
          >
            No scheme matched {examName} yet, so one question counts as one question with no penalty. Set the real
            numbers below and every figure updates.
          </p>
        )}

        {open && (
          <div key={config.exam_type} className="mt-3 space-y-3 vicharak-fade">
            <div className="grid grid-cols-3 gap-2">
              {numberField('Correct', config.marks_correct, (next) => void ta.saveExamConfig(row, { exam_type: config.exam_type, marks_correct: next }), 'input-scheme-correct')}
              {numberField('Wrong', config.marks_incorrect, (next) => void ta.saveExamConfig(row, { exam_type: config.exam_type, marks_incorrect: next }), 'input-scheme-incorrect')}
              {numberField('Skipped', config.marks_skipped, (next) => void ta.saveExamConfig(row, { exam_type: config.exam_type, marks_skipped: next }), 'input-scheme-skipped')}
            </div>
            <div>
              <p className="text-[10px] font-bold" style={{ color: TEXT_SECONDARY }}>Show totals as</p>
              <div className="mt-1.5 flex gap-1.5">
                {MARKS_UNITS.map((unit: MarksUnit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => void ta.saveExamConfig(row, { exam_type: config.exam_type, unit_label: unit })}
                    aria-pressed={config.unit_label === unit}
                    className="flex-1 py-2 text-[11px] font-extrabold touch-manipulation"
                    style={
                      config.unit_label === unit
                        ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                        : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
                    }
                    data-testid={`button-scheme-unit-${unit}`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>
                Wording only. With no penalty, “{lostVerb(config)} {formatUnits(config, 9)}” is the same nine questions
                either way.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold" style={{ color: TEXT }}>Partial credit</span>
                <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>
                  The only setting that makes the logging list ask for a number per question.
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  void ta.saveExamConfig(row, {
                    exam_type: config.exam_type,
                    allows_partial_credit: !config.allows_partial_credit,
                  })
                }
                aria-pressed={config.allows_partial_credit}
                className="px-3 py-1.5 text-[11px] font-extrabold flex-shrink-0 touch-manipulation"
                style={
                  config.allows_partial_credit
                    ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                    : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
                }
                data-testid="toggle-scheme-partial"
              >
                {config.allows_partial_credit ? 'On' : 'Off'}
              </button>
            </div>
            {numberField(
              'Target seconds per question',
              config.target_seconds_per_q,
              (next) => void ta.saveExamConfig(row, { exam_type: config.exam_type, target_seconds_per_q: Math.max(1, Math.round(next)) }),
              'input-scheme-seconds',
            )}
            {config.scaled_min !== null && config.scaled_max !== null && (
              <p className="text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                This exam reports a scaled score ({config.scaled_min}–{config.scaled_max}). Any figure the app shows in
                that range is labelled <b>estimated</b> — raw points are never added up across exams with different
                schemes.
              </p>
            )}
            {regionalTemplates.length > 0 && (
              <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 12 }}>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                  Region-specific schemes
                </p>
                <p className="mt-1 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                  Choose the state or province first. The app creates an editable regional row and never assumes one.
                </p>
                <ul className="mt-2 space-y-2" data-testid="list-scheme-regional">
                  {regionalTemplates.map((entry: ExamConfigRow) => {
                    const selectedRegion = regionByRow[entry.id] ?? '';
                    const regionLabel = /gaokao/i.test(entry.exam_type) ? 'province' : 'state / UT';
                    return (
                      <li key={entry.id} className="p-2.5" style={{ borderRadius: RADIUS.sm, background: NAVY_ALT, border: `1px solid ${BORDER}` }}>
                        <p className="text-[11px] font-extrabold" style={{ color: TEXT_SECONDARY }}>{entry.exam_type}</p>
                        {entry.notes && <p className="mt-1 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>{entry.notes}</p>}
                        <div className="mt-2 flex gap-2">
                          <select
                            value={selectedRegion}
                            onChange={(event) => setRegionByRow((current) => ({ ...current, [entry.id]: event.target.value }))}
                            className="min-w-0 flex-1 px-2.5 py-2 text-[11px] font-bold"
                            style={inputStyle}
                            aria-label={`Choose ${regionLabel} for ${entry.exam_type}`}
                            data-testid={`select-scheme-region-${entry.id}`}
                          >
                            <option value="">Choose {regionLabel}…</option>
                            {regionOptionsFor(entry).map((region) => <option key={region} value={region}>{region}</option>)}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedRegion || ta.savingScheme}
                            onClick={() => void ta.selectRegionalExamConfig(entry, selectedRegion)}
                            className="px-3 py-2 text-[11px] font-extrabold disabled:opacity-50 touch-manipulation"
                            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                            data-testid={`button-scheme-region-${entry.id}`}
                          >
                            Use scheme
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {todo.length > 0 && (
              <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 12 }}>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
                  Not set up yet · {todo.length}
                </p>
                <ul className="mt-1.5 space-y-1" data-testid="list-scheme-todo">
                  {todo.map((entry: ExamConfigRow) => (
                    <li key={entry.id} className="text-[10px] leading-snug" style={{ color: TEXT_MUTED }}>
                      <b style={{ color: TEXT_SECONDARY }}>{entry.exam_type}</b>
                      {entry.requires_region ? ' · needs a state/province first' : ''}
                      {entry.notes ? ` — ${entry.notes}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

/* ================================================================== */
/*  New-session form                                                   */
/* ================================================================== */

function SessionForm({
  examName,
  today,
  saving,
  existingCount,
  onSubmit,
}: {
  examName: string;
  today: string;
  saving: boolean;
  existingCount: number;
  onSubmit: (draft: MockSessionDraft) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(today);
  const [total, setTotal] = useState('');
  const [attempted, setAttempted] = useState('');
  const [correct, setCorrect] = useState('');
  const [incorrect, setIncorrect] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);

  const autoName = `${examName} Mock #${existingCount + 1}`;
  const numbers = {
    total: Number(total),
    attempted: Number(attempted),
    correct: Number(correct),
    incorrect: Number(incorrect),
    score: Number(score),
    maxScore: Number(maxScore),
  };
  const canSave =
    !saving &&
    Number.isFinite(numbers.total) && numbers.total > 0 &&
    Number.isFinite(numbers.attempted) && numbers.attempted >= 0 && numbers.attempted <= numbers.total &&
    Number.isFinite(numbers.correct) && numbers.correct >= 0 &&
    Number.isFinite(numbers.incorrect) && numbers.incorrect >= 0 &&
    numbers.correct + numbers.incorrect <= numbers.attempted &&
    Number.isFinite(numbers.score) &&
    Number.isFinite(numbers.maxScore) && numbers.maxScore > 0 && numbers.score <= numbers.maxScore;

  const submit = () => {
    if (!canSave) {
      setError('Check the numbers: attempted ≤ total, correct + incorrect ≤ attempted, score ≤ max score.');
      return;
    }
    setError(null);
    const minutes = Number(duration);
    onSubmit({
      examType: examName,
      name: (name ?? '').trim() || autoName,
      date: date || today,
      totalQuestions: numbers.total,
      attempted: numbers.attempted,
      correct: numbers.correct,
      incorrect: numbers.incorrect,
      score: numbers.score,
      maxScore: numbers.maxScore,
      durationMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
    });
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string, testId: string) => (
    <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => set(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-2.5 py-2.5 text-[13px]"
        style={inputStyle}
        data-testid={testId}
      />
    </label>
  );

  return (
    <div className="mt-4 space-y-3 vicharak-fade" data-testid="form-new-mock">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
          Exam
          <input value={examName} readOnly className="mt-1 w-full px-2.5 py-2.5 text-[13px] opacity-70" style={inputStyle} data-testid="input-mock-exam" />
        </label>
        <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
          Date
          <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full px-2.5 py-2.5 text-[13px]" style={inputStyle} data-testid="input-mock-date" />
        </label>
      </div>
      <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
        Mock name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={autoName} className="mt-1 w-full px-3 py-2.5 text-[13px]" style={inputStyle} data-testid="input-mock-name" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {field('Total questions', total, setTotal, 'e.g. 180', 'input-mock-total')}
        {field('Attempted', attempted, setAttempted, 'e.g. 165', 'input-mock-attempted')}
        {field('Correct', correct, setCorrect, 'e.g. 120', 'input-mock-correct')}
        {field('Incorrect', incorrect, setIncorrect, 'e.g. 45', 'input-mock-incorrect')}
        {field('Score', score, setScore, 'e.g. 435', 'input-mock-score')}
        {field('Max score', maxScore, setMaxScore, 'e.g. 720', 'input-mock-max')}
      </div>
      {field('Duration (minutes, optional)', duration, setDuration, 'e.g. 180', 'input-mock-duration')}
      {error && (
        <p className="text-[12px] px-3 py-2.5" style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }} data-testid="text-mock-form-error">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!canSave}
        onClick={submit}
        className="w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
        data-testid="button-mock-save"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
        Save mock session
      </button>
    </div>
  );
}

/* ================================================================== */
/*  Session view — pages + entries + tagging                           */
/* ================================================================== */

function SessionView({
  session,
  ta,
  tracksTiming,
  onBack,
  onOpenCrop,
  onOpenAnalysis,
  onOpenShare,
}: {
  session: MockSessionRow;
  ta: ReturnType<typeof useTestAnalysis>;
  tracksTiming: boolean;
  onBack: () => void;
  onOpenCrop: (image: SourceImageRow) => void;
  onOpenAnalysis: () => void;
  onOpenShare: () => void;
}) {
  const pages = ta.imagesBySession.get(session.id) ?? [];
  const entries = ta.entriesBySession.get(session.id) ?? [];
  const coverage = coverageOf(entries);
  const unprocessedHere = pages.filter((page) => page.status === 'unprocessed');

  return (
    <>
      <div className="pt-6 flex items-center gap-2 vicharak-rise">
        <button type="button" onClick={onBack} aria-label="Back" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-session-back">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold truncate" style={{ color: TEXT }}>{session.name}</h1>
          <p className="text-[10px]" style={{ color: TEXT_MUTED }}>
            {formatDate(session.date)} · {asCount(session.score)}/{asCount(session.max_score)} · {asCount(session.attempted)}/{asCount(session.total_questions)} attempted
          </p>
        </div>
        <button type="button" onClick={onOpenShare} aria-label="Share this analysis" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-session-share">
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* pages */}
      <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" testId="card-session-pages">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" style={{ color: AMBER }} />
          <p className="text-[12px] font-extrabold flex-1" style={{ color: TEXT }}>Paper pages · {pages.length}</p>
          {unprocessedHere.length > 0 && (
            <span className="px-2 py-0.5 text-[9px] font-extrabold" style={{ borderRadius: RADIUS.chip, background: tint(WARNING, 0.14), color: WARNING }}>
              {unprocessedHere.length} waiting to be split
            </span>
          )}
        </div>
        {pages.length > 0 && (
          <div className="mt-2.5 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => onOpenCrop(page)}
                className="relative touch-manipulation"
                aria-label={`Open page ${String(page.page_number)}`}
                data-testid={`page-thumb-${page.id}`}
              >
                <img src={page.image_url} alt={`Page ${String(page.page_number)}`} className="w-full h-24 object-cover" style={{ borderRadius: RADIUS.sm, border: `1px solid ${page.status === 'unprocessed' ? tint(WARNING, 0.6) : BORDER}` }} loading="lazy" />
                <span
                  className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[8px] font-extrabold"
                  style={{
                    borderRadius: RADIUS.chip,
                    background: page.status === 'unprocessed' ? WARNING : page.status === 'whole_page_question' ? DOUBT_ACCENT : SUCCESS,
                    color: '#0A0F1E',
                  }}
                >
                  {page.status === 'unprocessed' ? 'Split manually' : page.status === 'whole_page_question' ? '1 question' : 'Done'}
                </span>
              </button>
            ))}
          </div>
        )}
        {/* Vicharee's reading state — the AI is turning page photos into a
            reviewable question list. */}
        {ta.aiReadingPages && (
          <div
            className="mt-3 flex items-center gap-2.5 px-3.5 py-3"
            style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}` }}
            data-testid="banner-ai-reading"
          >
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: AMBER }} />
            <p className="text-[12px] font-bold leading-snug" style={{ color: TEXT_SECONDARY }}>
              Vicharee is reading your paper… every question will appear below with its number and text.
            </p>
          </div>
        )}
        {/* Graceful fallback — a page the AI couldn't read keeps the manual
            split flow and offers one more AI attempt. */}
        {unprocessedHere.length > 0 && !ta.aiReadingPages && (
          <div className="mt-3 flex items-center gap-2 flex-wrap" data-testid="banner-ai-read-failed">
            <p className="min-w-0 flex-1 text-[11px] leading-snug" style={{ color: TEXT_MUTED }}>
              Vicharee couldn't read {unprocessedHere.length === 1 ? 'one page' : `${unprocessedHere.length} pages`} —
              tap a page above to split it manually, or try the AI read again.
            </p>
            <button
              type="button"
              onClick={() => void ta.retryAiExtract(session, unprocessedHere[0])}
              className="flex-shrink-0 px-3 py-2 text-[11px] font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${tint(AMBER, 0.45)}`, background: tint(AMBER, 0.08), color: AMBER }}
              data-testid="button-retry-ai-read"
            >
              Ask Vicharee again
            </button>
          </div>
        )}
        <label
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 text-[12px] font-extrabold cursor-pointer touch-manipulation"
          style={{ borderRadius: RADIUS.chip, border: `1px dashed ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: NAVY_ALT, opacity: ta.uploadingPages || ta.aiReadingPages ? 0.6 : 1 }}
        >
          {ta.uploadingPages || ta.aiReadingPages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {ta.uploadingPages
            ? 'Uploading pages…'
            : ta.aiReadingPages
              ? 'Vicharee is reading your paper…'
              : 'Add paper pages (photos)'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={ta.uploadingPages || ta.aiReadingPages}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              /* AI-first: upload AND let Vicharee extract every question.
                 Pages it cannot read stay 'unprocessed' for the manual flow. */
              if (files.length > 0) void ta.addPagesAndExtract(session, files);
            }}
            data-testid="input-session-pages"
          />
        </label>
      </Card>

      {/* tagging progress + analysis entry */}
      <div className="mt-3 flex gap-2 vicharak-rise">
        <button
          type="button"
          onClick={onOpenAnalysis}
          className="flex-1 py-3 text-[13px] font-extrabold inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, boxShadow: '0 6px 16px rgba(0,151,184,0.22)' }}
          data-testid="button-open-mock-analysis"
        >
          <BarChart3 className="w-4 h-4" />
          View analysis
          {coverage.wrongTotal > 0 && (
            <span className="text-[10px] opacity-85">· {coverage.wrongTagged}/{coverage.wrongTotal} tagged</span>
          )}
        </button>
        <button
          type="button"
          disabled={ta.remediating}
          onClick={() => void ta.scheduleRemediation(session)}
          className="px-4 py-3 text-[13px] font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, border: `1px solid ${tint(DOUBT_ACCENT, 0.5)}`, color: DOUBT_ACCENT, background: tint(DOUBT_ACCENT, 0.08) }}
          data-testid="button-generate-remediation"
        >
          {ta.remediating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Schedule revision
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed vicharak-rise" style={{ color: TEXT_MUTED }}>
        Tagging a question doesn't create a deck card. Concept gaps and couldn't-apply misses get a date on your
        existing spaced schedule (max 5 per mock) and join the deck the day they come due
        {ta.scheduledCount(session) > 0 ? ` — ${ta.scheduledCount(session)} waiting` : ''}. Careless and out-of-time
        never enter the deck at all — they feed nudges and pacing instead.
      </p>

      {/* THE logging list — one line per crop, one tap per row. */}
      <section className="mt-5 vicharak-rise" data-testid="section-session-entries">
        <SectionLabel>Review your questions · {entries.length}</SectionLabel>
        <LoggingList
          session={session}
          ta={ta}
          tracksTiming={tracksTiming}
          examConfig={ta.examConfig}
          deckCount={ta.dueDeckRows.length}
          onOpenDeck={onBack}
        />
      </section>
    </>
  );
}

/* ================================================================== */
/*  One question entry — outcome → reason → topic → time → note        */
/* ================================================================== */

/* The card-by-card entry component that used to live here is gone: at twenty
 * questions it was where students quit. LoggingList replaces it — one line
 * per crop, one tap per row, and the crop image on demand. */
/* ================================================================== */
/*  Per-mock analysis view                                             */
/* ================================================================== */

function AnalysisView({
  session,
  ta,
  examName,
  benchmarkSeconds,
  tracksTiming,
  risingCareless,
  onBack,
  onOpenShare,
  onTimedDrill,
}: {
  session: MockSessionRow;
  ta: ReturnType<typeof useTestAnalysis>;
  examName: string;
  benchmarkSeconds: number;
  tracksTiming: boolean;
  risingCareless: boolean;
  onBack: () => void;
  onOpenShare: () => void;
  onTimedDrill: () => void;
}) {
  const entries = ta.entriesBySession.get(session.id) ?? [];
  const config = ta.examConfig;
  const analysis = useMemo(
    () =>
      perMockAnalysis({
        session,
        entries,
        config,
        benchmarkSeconds,
        tracksTiming,
        risingCareless,
        doubtsByTopic: ta.doubtsByTopic,
      }),
    [session, entries, config, benchmarkSeconds, tracksTiming, risingCareless, ta.doubtsByTopic],
  );
  const totals = analysis.totals;
  const outOfTime = entries.filter((entry) => entry.error_tag === 'out_of_time');
  const maxErr = Math.max(1, ...analysis.errors.map((slice) => slice.count));

  return (
    <>
      <div className="pt-6 flex items-center gap-2 vicharak-rise">
        <button type="button" onClick={onBack} aria-label="Back" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-analysis-back">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold truncate" style={{ color: TEXT }}>{session.name} — analysis</h1>
          <p className="text-[10px]" style={{ color: TEXT_MUTED }}>
            {formatDate(session.date)} · {totals.score}/{totals.maxScore} · {totals.accuracy}% accuracy
          </p>
        </div>
        <button type="button" onClick={() => exportMockPdf(analysis, examName)} aria-label="Export as PDF" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-analysis-pdf">
          <FileDown className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onOpenShare} aria-label="Share" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-analysis-share">
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {analysis.partial && (
        <p className="mt-3 px-3.5 py-2.5 text-[11px] font-bold vicharak-rise" style={{ borderRadius: RADIUS.md, background: tint(WARNING, 0.09), border: `1px solid ${tint(WARNING, 0.3)}`, color: WARNING }} data-testid="banner-partial-data">
          Partial data — some wrong questions aren't tagged yet, so these numbers may shift as you finish tagging.
        </p>
      )}

      {/* nudges */}
      {analysis.nudges.map((nudge, index) => (
        <p key={index} className="mt-3 flex items-start gap-2 px-3.5 py-2.5 text-[12px] leading-relaxed font-semibold vicharak-rise" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.28)}`, color: TEXT_SECONDARY }} data-testid={`nudge-${index}`}>
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: AMBER }} />
          {nudge}
        </p>
      ))}

      {/* the headline numbers — from the Step 1 totals, never from entries */}
      <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" testId="card-score-summary">
        <SectionLabel>Your paper</SectionLabel>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([
            { label: 'Score', value: `${totals.score}/${totals.maxScore}`, tone: TEXT },
            { label: 'Accuracy', value: `${totals.accuracy}%`, tone: totals.accuracy >= 75 ? SUCCESS : totals.accuracy >= 50 ? WARNING : DANGER },
            { label: 'Attempted', value: `${totals.attempted}/${totals.totalQuestions}`, tone: TEXT_SECONDARY },
          ]).map((stat) => (
            <div key={stat.label} className="px-2 py-2" style={{ borderRadius: RADIUS.sm, background: NAVY_ALT }}>
              <p className="text-[15px] font-extrabold tabular-nums" style={{ color: stat.tone }}>{stat.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-score-source">
          Straight from the totals you entered for this mock — {totals.correct} correct of {totals.attempted}{' '}
          attempted. The questions you cropped below explain WHERE the {unitNoun(config)} went, not how accurate you
          were.{totals.scaled ? ` Scaled score: ${totals.scaled.label}.` : ''}
        </p>
      </Card>

      {/* error distribution */}
      <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId="card-error-distribution">
        <SectionLabel>Where the {unitNoun(config)} went</SectionLabel>
        {analysis.errors.length === 0 ? (
          <p className="text-[12px]" style={{ color: TEXT_MUTED }}>Tag your wrong questions to see the error breakdown.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.errors.map((slice) => (
              <li key={slice.tag} className="flex items-center gap-3">
                <span className="text-xs font-semibold w-24 flex-shrink-0" style={{ color: TEXT_SECONDARY }}>{slice.label}</span>
                <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: BORDER }}>
                  <span className="block h-full rounded-full" style={{ width: `${Math.round((slice.count / maxErr) * 100)}%`, background: DANGER }} />
                </span>
                <span className="text-[11px] font-bold flex-shrink-0" style={{ color: TEXT_MUTED }}>
                  {slice.count} q · {formatUnits(config, slice.marksLost)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {analysis.errors.find((slice) => slice.tag === 'careless') && (
          <p className="mt-2.5 text-[11px] font-bold" style={{ color: DANGER }} data-testid="text-careless-marks">
            You {lostVerb(config)} {formatUnits(config, analysis.errors.find((slice) => slice.tag === 'careless')!.marksLost)} to careless errors.
          </p>
        )}
      </Card>

      {/* weak topics — ranked by what they COST, not by entry count */}
      <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId="card-subject-breakdown">
        <SectionLabel>Topics that cost you the most</SectionLabel>
        {analysis.weakTopics.length === 0 ? (
          <p className="text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
            {analysis.watchTopics.length > 0
              ? `${analysis.watchTopics.length} topic${analysis.watchTopics.length === 1 ? '' : 's'} seen once so far. A topic needs a couple of logged attempts before it counts as weak — one miss is noise.`
              : 'Tag topics on your questions to unlock this view.'}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {analysis.weakTopics.slice(0, 8).map((topic) => (
              <li key={topic.topic}>
                <div className="flex items-center gap-2">
                  <SubjectDot subject={topic.subject} size={6} />
                  <span className="min-w-0 flex-1 text-[12px] font-extrabold leading-snug break-words" style={{ color: TEXT_SECONDARY }}>
                    {topic.topic}
                    {topic.subject ? <span style={{ color: TEXT_MUTED }}> · {topic.subject}</span> : null}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: DANGER }}>
                    {formatUnits(config, topic.marksLost)}
                  </span>
                </div>
                <p className="mt-0.5 ml-4 text-[10px]" style={{ color: TEXT_MUTED }}>
                  {topic.missed} of {topic.logged} logged went wrong
                  {topic.doubts > 0 ? ` · ${topic.doubts} doubt${topic.doubts === 1 ? '' : 's'} raised` : ''}
                  {topic.dominantTag === 'careless' || topic.dominantTag === 'out_of_time'
                    ? ' · mostly a habit, not a gap — no study task from this one'
                    : ' · worth a revision task'}
                </p>
              </li>
            ))}
          </ul>
        )}
        {analysis.subjects.length > 0 && (
          <div className="mt-3 pt-2.5" style={{ borderTop: `1px dashed ${BORDER}` }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
              By subject
            </p>
            {analysis.subjects.map((slice) => (
              <p key={slice.subject} className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: TEXT_SECONDARY }}>
                <SubjectDot subject={slice.subject} size={5} />
                <span className="min-w-0 flex-1 truncate font-bold">{slice.subject}</span>
                <span className="tabular-nums flex-shrink-0" style={{ color: DANGER }}>{formatUnits(config, slice.marksLost)}</span>
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* time sinks — opted-in students only; hidden entirely otherwise */}
      {tracksTiming && (
        <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId="card-time-sinks">
          <SectionLabel icon={<Timer className="w-3 h-3" />}>Time sinks · benchmark ≈{Math.round(benchmarkSeconds / 60)} min/question</SectionLabel>
          {analysis.timeSinks.length === 0 ? (
            <p className="text-[12px]" style={{ color: TEXT_MUTED }}>No questions over your exam's pace — nice discipline.</p>
          ) : (
            <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              {analysis.timeSinks.length} question{analysis.timeSinks.length === 1 ? '' : 's'} ran past the {examName} pace
              {analysis.timeSinks.filter((entry) => String(entry.topic_id ?? '').trim()).length > 0 && (
                <> — mostly in {Array.from(new Set(analysis.timeSinks.map((entry) => String(entry.topic_id ?? '').trim()).filter(Boolean))).slice(0, 3).join(', ')}</>
              )}.
            </p>
          )}
        </Card>
      )}

      {/* out-of-time → pacing + timed drill (never a study task) */}
      {outOfTime.length > 0 && (
        <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId="card-pacing-report">
          <SectionLabel icon={<Clock className="w-3 h-3" />}>Pacing</SectionLabel>
          <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            {outOfTime.length} question{outOfTime.length === 1 ? '' : 's'} were lost to time, not knowledge. A timed drill at
            {' '}{examName} pace trains the clock without adding study load.
          </p>
          <button
            type="button"
            onClick={onTimedDrill}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-extrabold touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.14), border: `1px solid ${tint(AMBER, 0.4)}`, color: AMBER }}
            data-testid="button-timed-drill"
          >
            <Timer className="w-3.5 h-3.5" />
            Take a timed drill
          </button>
        </Card>
      )}
    </>
  );
}

/* ================================================================== */
/*  Cross-mock trends view                                             */
/* ================================================================== */

function TrendsView({
  ta,
  cross,
  examName,
  onBack,
  onOpenShare,
}: {
  ta: ReturnType<typeof useTestAnalysis>;
  cross: ReturnType<typeof crossMockAnalysis>;
  examName: string;
  onBack: () => void;
  onOpenShare: () => void;
}) {
  const maxCareless = Math.max(1, ...cross.errorTrend.map((point) => point.counts.careless));
  return (
    <>
      <div className="pt-6 flex items-center gap-2 vicharak-rise">
        <button type="button" onClick={onBack} aria-label="Back" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-trends-back">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold" style={{ color: TEXT }}>Across your mocks</h1>
          <p className="text-[10px]" style={{ color: TEXT_MUTED }}>{cross.mockCount} mocks analysed</p>
        </div>
        <button type="button" onClick={() => exportCrossMockPdf(cross, examName)} aria-label="Export as PDF" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-trends-pdf">
          <FileDown className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onOpenShare} aria-label="Share" className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation" style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, background: CARD }} data-testid="button-trends-share">
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {cross.partial && (
        <p className="mt-3 px-3.5 py-2.5 text-[11px] font-bold vicharak-rise" style={{ borderRadius: RADIUS.md, background: tint(WARNING, 0.09), border: `1px solid ${tint(WARNING, 0.3)}`, color: WARNING }}>
          Partial data — at least one mock still has untagged wrong questions, so trends may shift.
        </p>
      )}

      <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" testId="card-topic-trends">
        <SectionLabel>Topics ranked by {unitNoun(cross.config)} {lostVerb(cross.config)}</SectionLabel>
        {cross.topicTrends.length === 0 ? (
          <p className="text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
            Tag topics across at least two mocks to unlock trends. A topic needs a couple of logged attempts before it
            is ranked — one miss is noise.
          </p>
        ) : (
          <ul className="space-y-2">
            {cross.topicTrends.slice(0, 10).map((trend) => (
              <li key={trend.topic} className="flex items-center gap-2.5">
                {trend.direction === 'improving' ? (
                  <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: SUCCESS }} />
                ) : trend.direction === 'declining' ? (
                  <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: DANGER }} />
                ) : (
                  <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEXT_MUTED }} />
                )}
                <span className="min-w-0 flex-1 text-[12px] font-bold truncate" style={{ color: TEXT_SECONDARY }}>
                  {trend.topic}
                  {trend.subject ? <span style={{ color: TEXT_MUTED }}> · {trend.subject}</span> : null}
                  {trend.doubts > 0 ? (
                    <span style={{ color: DOUBT_ACCENT }}> · {trend.doubts} doubt{trend.doubts === 1 ? '' : 's'}</span>
                  ) : null}
                </span>
                <span className="text-[11px] font-extrabold tabular-nums flex-shrink-0" style={{ color: trend.direction === 'improving' ? SUCCESS : trend.direction === 'declining' ? DANGER : TEXT_MUTED }}>
                  {formatUnits(cross.config, trend.marksLost)} · {trend.direction}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId="card-repeat-offenders">
        <SectionLabel>Repeat offenders</SectionLabel>
        {cross.repeatOffenders.length === 0 ? (
          <p className="text-[12px]" style={{ color: TEXT_MUTED }}>Nothing missed in 2+ consecutive mocks. Keep it that way.</p>
        ) : (
          <ul className="space-y-2">
            {cross.repeatOffenders.slice(0, 8).map((offender) => (
              <li key={offender.topic} className="flex items-center gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: DANGER }} />
                <span className="min-w-0 flex-1 text-[12px] font-bold truncate" style={{ color: TEXT_SECONDARY }}>
                  {offender.topic}
                  {offender.subject ? <span style={{ color: TEXT_MUTED }}> · {offender.subject}</span> : null}
                </span>
                <span className="text-[10px] font-extrabold flex-shrink-0 text-right" style={{ color: DANGER }}>
                  {offender.consecutiveMocks} mocks running
                  {offender.marksLost > 0 ? ` · ${formatUnits(cross.config, offender.marksLost)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card radius={RADIUS.lg} className="mt-3 p-4 vicharak-rise" testId="card-error-trend">
        <SectionLabel>Error-type trend</SectionLabel>
        <p className="text-[11px] mb-2.5" style={{ color: TEXT_MUTED }}>
          Careless errors per mock — {cross.risingCareless ? 'rising: slow down before you speed up.' : 'watch this fall as concepts firm up.'}
        </p>
        <ul className="space-y-1.5">
          {cross.errorTrend.map((point) => (
            <li key={`${point.mockName}-${point.date}`} className="flex items-center gap-3">
              <span className="text-[10px] font-bold w-24 flex-shrink-0 truncate" style={{ color: TEXT_SECONDARY }}>{point.mockName}</span>
              <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: BORDER }}>
                <span className="block h-full rounded-full" style={{ width: `${Math.round((point.counts.careless / maxCareless) * 100)}%`, background: WARNING }} />
              </span>
              <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: TEXT_MUTED }}>
                {point.counts.careless} careless · {point.counts.concept_gap} concept
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/* ================================================================== */
/*  Share sheet — read-only links, revocable, notes opt-in             */
/* ================================================================== */

function ShareSheet({
  scopeSessionId,
  sessions,
  ta,
  today,
  onClose,
}: {
  scopeSessionId: number | null;
  sessions: MockSessionRow[];
  ta: ReturnType<typeof useTestAnalysis>;
  today: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<'single_mock' | 'date_range'>(scopeSessionId !== null ? 'single_mock' : 'date_range');
  const [sessionId, setSessionId] = useState<number | null>(scopeSessionId ?? (sessions[0]?.id ?? null));
  const [rangeStart, setRangeStart] = useState(sessions.length > 0 ? sessions[sessions.length - 1].date : today);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const liveShares = ta.shares.filter((share) => !share.revoked_at);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const url = await ta.createShare({
        scope,
        mockSessionId: scope === 'single_mock' ? sessionId : null,
        rangeStart: scope === 'date_range' ? rangeStart : null,
        rangeEnd: scope === 'date_range' ? rangeEnd : null,
        includeReasonNotes: includeNotes,
      });
      if (url) setCreatedUrl(url);
    } finally {
      setCreating(false);
    }
  };

  const copy = (url: string) => {
    void navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  return (
    <Sheet ariaLabel="Share a read-only analysis link" onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Share a read-only link</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: TEXT_MUTED }}>
            Only you can create links, viewers can't edit anything, and you can revoke a link at any time.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 flex gap-1.5">
        {([
          { id: 'single_mock', label: 'One mock' },
          { id: 'date_range', label: 'Date range' },
        ] as const).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setScope(option.id)}
            aria-pressed={scope === option.id}
            className="flex-1 py-2 text-[11px] font-extrabold touch-manipulation"
            style={
              scope === option.id
                ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
            }
            data-testid={`share-scope-${option.id}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {scope === 'single_mock' ? (
        <select
          value={sessionId ?? ''}
          onChange={(event) => setSessionId(Number(event.target.value) || null)}
          className="mt-3 w-full px-2.5 py-2.5 text-[13px] font-bold"
          style={inputStyle}
          aria-label="Which mock to share"
          data-testid="share-session-select"
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>{session.name} · {formatDate(session.date)}</option>
          ))}
        </select>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
            From
            <input type="date" value={rangeStart} max={rangeEnd} onChange={(event) => setRangeStart(event.target.value)} className="mt-1 w-full px-2.5 py-2.5 text-[13px]" style={inputStyle} data-testid="share-range-start" />
          </label>
          <label className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
            To
            <input type="date" value={rangeEnd} max={today} onChange={(event) => setRangeEnd(event.target.value)} className="mt-1 w-full px-2.5 py-2.5 text-[13px]" style={inputStyle} data-testid="share-range-end" />
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIncludeNotes(!includeNotes)}
        aria-pressed={includeNotes}
        className="mt-3 w-full flex items-center gap-2.5 px-3 py-2.5 text-left touch-manipulation"
        style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${includeNotes ? tint(WARNING, 0.5) : BORDER}` }}
        data-testid="share-include-notes"
      >
        <span className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0" style={{ background: includeNotes ? WARNING : 'transparent', border: `1.5px solid ${includeNotes ? WARNING : BORDER_STRONG}` }}>
          {includeNotes && <Check className="w-3 h-3" style={{ color: '#0A0F1E' }} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-extrabold" style={{ color: TEXT }}>Include my reason notes</span>
          <span className="block text-[10px]" style={{ color: TEXT_MUTED }}>Off by default — your personal notes stay private unless you opt in.</span>
        </span>
      </button>

      {createdUrl ? (
        <div className="mt-3 px-3 py-2.5 vicharak-fade" style={{ borderRadius: RADIUS.md, background: tint(SUCCESS, 0.07), border: `1px solid ${tint(SUCCESS, 0.3)}` }} data-testid="share-created-url">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: SUCCESS }}>Link ready</p>
          <p className="mt-1 text-[11px] break-all" style={{ color: TEXT_SECONDARY }}>{createdUrl}</p>
          <button type="button" onClick={() => copy(createdUrl)} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation" style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }} data-testid="button-share-copy">
            <Copy className="w-3 h-3" /> Copy link
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={creating || (scope === 'single_mock' && sessionId === null)}
          onClick={() => void create()}
          className="mt-4 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-share-create"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Create read-only link
        </button>
      )}

      {liveShares.length > 0 && (
        <div className="mt-4" style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 12 }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>Live links · {liveShares.length}</p>
          <ul className="mt-2 space-y-2">
            {liveShares.map((share: AnalysisShareRow) => (
              <li key={share.id} className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
                    {share.scope === 'single_mock'
                      ? sessions.find((session) => session.id === share.mock_session_id)?.name ?? 'One mock'
                      : `${formatDate(share.range_start)} – ${formatDate(share.range_end)}`}
                    {share.include_reason_notes ? ' · notes included' : ''}
                  </span>
                  <span className="block text-[9px]" style={{ color: TEXT_MUTED }}>created {formatDate(share.created_at_iso)}</span>
                </span>
                <button type="button" onClick={() => copy(ta.shareUrlOf(share))} aria-label="Copy link" className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation" style={{ border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }} data-testid={`share-copy-${share.id}`}>
                  <Copy className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => void ta.revokeShare(share)} className="px-2.5 py-1.5 text-[10px] font-extrabold flex-shrink-0 touch-manipulation" style={{ borderRadius: RADIUS.chip, background: tint(DANGER, 0.12), color: DANGER }} data-testid={`share-revoke-${share.id}`}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
