/**
 * "Type your exam" — open exam entry for anything outside the five pre-loaded
 * exams. The student types a name, VicharakAI looks up the standard syllabus, and
 * the result is handed back as a normal ExamDef through `onReady`. When the
 * lookup comes back unsure, the student writes their own subjects instead —
 * nothing about their exam is ever invented for them.
 *
 * Used in two places: onboarding step 1, and Change exam on the Profile tab.
 * Purely a collector — saving is the caller's job.
 */
import { useState, type CSSProperties } from 'react';
import { ChevronRight, Loader2, PencilLine, Search, Sparkles } from 'lucide-react';
import { buildManualExam, countTopics, lookupExamSyllabus, type SyllabusLookupStatus } from './customExam';
import type { ExamDef } from './syllabus';
import { AMBER, BORDER, BRAND_GRADIENT, CARD, NAVY_ALT, ON_AMBER, RADIUS, SUCCESS, TEXT, TEXT_MUTED, TEXT_SECONDARY, tint } from './theme';

type Phase = 'name' | 'looking' | 'review' | 'manual';

const MANUAL_PLACEHOLDER = 'Research Methods: Sampling, Survey design\nPublic Policy: Policy cycle\nIndian Administration';

const inputStyle: CSSProperties = {
  background: NAVY_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS.sm,
  color: TEXT,
  width: '100%',
};

export default function CustomExamEntry({
  today,
  confirmLabel = 'Continue',
  onReady,
  onCancel,
}: {
  today: string;
  confirmLabel?: string;
  onReady: (exam: ExamDef) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Phase>('name');
  const [status, setStatus] = useState<SyllabusLookupStatus | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [exam, setExam] = useState<ExamDef | null>(null);
  const [manualText, setManualText] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const typed = name.trim();
  const ready = typed.length >= 2;

  const runLookup = async () => {
    if (!ready || phase === 'looking') return;
    setPhase('looking');
    setNote(null);
    const result = await lookupExamSyllabus(typed, today);
    setStatus(result.status);
    setNote(result.message ?? null);
    if (result.status === 'found' && result.exam) {
      setExam(result.exam);
      setPhase('review');
      return;
    }
    // Unknown or unreachable: never a dead end — the student can fill it in.
    setExam(null);
    setPhase(result.status === 'unknown' ? 'manual' : 'name');
  };

  const useManualSubjects = () => {
    const built = buildManualExam(typed, manualText, today);
    if (!built) {
      setManualError('Add at least one subject — one per line.');
      return;
    }
    setManualError(null);
    onReady(built);
  };

  const linkStyle: CSSProperties = { color: AMBER };

  return (
    <div
      className="p-4 vicharak-rise"
      style={{ background: CARD, border: `1px solid ${tint(AMBER, 0.4)}`, borderRadius: RADIUS.hero }}
      data-testid="panel-custom-exam"
    >
      <p className="text-sm font-extrabold flex items-center gap-2" style={{ color: TEXT }}>
        <Sparkles className="w-4 h-4" style={{ color: AMBER }} /> Type your exam
      </p>
      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: TEXT_MUTED }}>
        Any exam — GATE, a State PSC, a university entrance, a PhD paper. I’ll fetch the standard syllabus and build
        your plan from it.
      </p>

      <input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setStatus(null);
          setNote(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && phase === 'name') void runLookup();
        }}
        disabled={phase === 'looking'}
        placeholder="e.g. GATE CS, Kerala PSC, MA Economics entrance"
        className="mt-3 px-3 py-2.5 text-sm"
        style={inputStyle}
        data-testid="input-custom-exam"
      />

      {note && (
        <p
          className="text-[11px] mt-2.5 p-2.5 leading-relaxed"
          style={{
            borderRadius: RADIUS.sm,
            background: tint(status === 'found' ? SUCCESS : AMBER, 0.1),
            color: status === 'found' ? SUCCESS : TEXT_SECONDARY,
          }}
          data-testid="text-custom-exam-note"
        >
          {note}
        </p>
      )}

      {(phase === 'name' || phase === 'looking') && (
        <>
          <button
            type="button"
            disabled={!ready || phase === 'looking'}
            onClick={() => void runLookup()}
            className="mt-3 w-full py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-45"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-find-syllabus"
          >
            {phase === 'looking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {phase === 'looking' ? `Looking up ${typed}…` : 'Find my syllabus'}
          </button>
          {phase !== 'looking' && (
            <button
              type="button"
              disabled={!ready}
              onClick={() => {
                setNote(null);
                setStatus(null);
                setPhase('manual');
              }}
              className="mt-2.5 w-full text-[11px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-45"
              style={linkStyle}
              data-testid="button-custom-exam-manual"
            >
              <PencilLine className="w-3.5 h-3.5" /> I’ll add my subjects myself
            </button>
          )}
        </>
      )}

      {phase === 'review' && exam && (
        <div className="mt-3">
          <p className="text-xs font-extrabold" style={{ color: TEXT }}>
            {exam.fullName}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>
            {exam.subjects.length} subjects · {countTopics(exam.subjects)} topics
          </p>
          <div className="mt-2.5 space-y-1.5 max-h-44 overflow-y-auto">
            {exam.subjects.map((subject) => (
              <div
                key={subject.name}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                style={{ borderRadius: RADIUS.sm, background: NAVY_ALT }}
              >
                <span className="text-[11px] font-bold truncate" style={{ color: TEXT }}>
                  {subject.name}
                </span>
                <span className="text-[10px] flex-shrink-0" style={{ color: TEXT_MUTED }}>
                  {subject.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0)} topics
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onReady(exam)}
            className="mt-3 w-full py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-custom-exam-confirm"
          >
            {confirmLabel} <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNote(null);
              setStatus(null);
              setManualText(exam.subjects.map((subject) => subject.name).join('\n'));
              setPhase('manual');
            }}
            className="mt-2.5 w-full text-[11px] font-bold"
            style={linkStyle}
            data-testid="button-custom-exam-edit"
          >
            Not quite right — let me set the subjects
          </button>
        </div>
      )}

      {phase === 'manual' && (
        <div className="mt-3">
          <label className="block text-[11px] font-extrabold mb-1.5" style={{ color: TEXT }} htmlFor="custom-exam-subjects">
            Your subjects — one per line
          </label>
          <p className="text-[10px] mb-2 leading-relaxed" style={{ color: TEXT_MUTED }}>
            Add topics after a colon if you have them. You can always add more later.
          </p>
          <textarea
            id="custom-exam-subjects"
            value={manualText}
            onChange={(event) => {
              setManualText(event.target.value);
              setManualError(null);
            }}
            rows={5}
            placeholder={MANUAL_PLACEHOLDER}
            className="px-3 py-2.5 text-sm resize-none"
            style={inputStyle}
            data-testid="textarea-custom-exam-subjects"
          />
          {manualError && (
            <p className="text-[11px] mt-1.5 font-bold" style={{ color: AMBER }} data-testid="text-custom-exam-error">
              {manualError}
            </p>
          )}
          <button
            type="button"
            onClick={useManualSubjects}
            className="mt-3 w-full py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-custom-exam-use-subjects"
          >
            {confirmLabel} <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNote(null);
              setStatus(null);
              setPhase('name');
            }}
            className="mt-2.5 w-full text-[11px] font-bold"
            style={linkStyle}
            data-testid="button-custom-exam-retry"
          >
            Try the syllabus lookup again
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full text-[11px] font-semibold"
        style={{ color: TEXT_MUTED }}
        data-testid="button-custom-exam-cancel"
      >
        ← Back to the exam list
      </button>
    </div>
  );
}
