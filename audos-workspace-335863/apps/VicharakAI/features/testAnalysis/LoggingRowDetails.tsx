/**
 * LoggingRowDetails — the inline panel one row of the logging list expands
 * into: the syllabus topic pick, per-question marks (partial-credit exams
 * only), the coarse time bucket and the optional note.
 *
 * It is deliberately INLINE, not a sheet or a modal: the student stays in
 * the list. The four error chips never open this — they are one tap each.
 *
 * THE TOPIC PICK has no silent fallback. When matching is not confident the
 * panel offers the student's OWN syllabus, narrowing as far as the match
 * got: the chapter's topic list, else the whole subject's topic list, else
 * the subject → chapter → topic cascade. Until they pick, the entry simply
 * carries no topic.
 *
 * WHEN THE OCR TEXT IS USELESS the panel is no longer a dead end. Matching
 * falls through to a vision read of the CROP, which names the concept the
 * question tests, pre-fills the topic suggestion and — for a concept_gap —
 * says what the student most likely misunderstood.
 */
/* eslint-disable */
import { useState } from 'react';
import { Check, Eye, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  DANGER,
  DOUBT_ACCENT,
  NAVY_ALT,
  ON_AMBER,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  tint,
} from '../../theme';
import { useApp } from '../../app/AppContext';
import { topicsOfChapter, topicsOfSubject, type TopicPrediction } from './topicPredict';
import { shouldPromptNote } from './taSelectors';
import { formatUnits, type ExamConfig } from './examConfig';
import {
  TIME_BUCKETS,
  TIME_BUCKET_LABELS,
  conceptGapDisplay,
  needsConceptGapAnalysis,
  sanitizeTopicName,
  type QuestionEntryRow,
  type TimeBucket,
} from './taTypes';
import type { useTestAnalysis } from './useTestAnalysis';

const inputStyle = {
  background: NAVY_ALT,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS.sm,
  color: TEXT,
} as const;

export default function LoggingRowDetails({
  entry,
  ta,
  tracksTiming,
  examConfig,
  onClose,
}: {
  entry: QuestionEntryRow;
  ta: ReturnType<typeof useTestAnalysis>;
  tracksTiming: boolean;
  examConfig: ExamConfig;
  onClose: () => void;
}) {
  const { data } = useApp();
  const { topicPickerSubjects } = data;
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<TopicPrediction | null>(null);
  const [manualSubject, setManualSubject] = useState(String(entry.subject ?? ''));
  const [manualChapter, setManualChapter] = useState(String(entry.chapter_id ?? ''));
  const [note, setNote] = useState(String(entry.reason_note ?? ''));
  const [marks, setMarks] = useState(
    entry.marks_awarded === null || entry.marks_awarded === undefined ? '' : String(entry.marks_awarded),
  );
  const [marksPossible, setMarksPossible] = useState(
    entry.marks_possible === null || entry.marks_possible === undefined
      ? String(examConfig.marks_correct)
      : String(entry.marks_possible),
  );

  const saveQuestionMarks = () => {
    const awarded = (marks ?? '').trim() === '' ? null : Number(marks);
    const possible = (marksPossible ?? '').trim() === '' ? null : Number(marksPossible);
    void ta.setMarksAwarded(
      entry,
      awarded !== null && Number.isFinite(awarded) ? awarded : null,
      possible !== null && Number.isFinite(possible) && possible >= 0 ? possible : null,
    );
  };

  const confirmedTopic = sanitizeTopicName(entry.topic_id);
  const promptNote = entry.outcome === 'incorrect' && shouldPromptNote(ta.entries, confirmedTopic);

  /* What the vision model read off the crop. Stored on the entry, so it
   * survives a reload and the wallet is never charged twice for one crop. */
  const conceptTested = String(entry.concept_being_tested ?? '').replace(/\s+/g, ' ').trim();
  const gap = conceptGapDisplay(entry);
  const readingCrop = ta.analyzingConceptGap(entry);
  /* There has to be something to read: a hosted crop, or at least the OCR
   * text the model can work from when the upload never landed. */
  const hasReadableSource = Boolean(String(entry.crop_url ?? '').trim() || String(entry.extracted_text ?? '').trim());
  const showConceptPanel = Boolean(conceptTested || gap || (hasReadableSource && needsConceptGapAnalysis(entry)));

  const subjectOptions = topicPickerSubjects.map((subject) => subject.name);
  const chapterOptions = manualSubject
    ? topicPickerSubjects.find((subject) => subject.name === manualSubject)?.chapters.map((chapter) => chapter.name) ?? []
    : [];
  const manualTopics = manualSubject && manualChapter ? topicsOfChapter(topicPickerSubjects, manualSubject, manualChapter) : [];

  /* THE three-step fallback, in order. Nothing is ever written silently:
   *  1. a confident chapter → that chapter's topic list;
   *  2. only the subject → the whole subject's topic list;
   *  3. nothing → the subject/chapter/topic cascade below.
   * Until the student picks, the entry simply carries no topic. */
  const chapterTopics =
    prediction && prediction.needs === 'topic_in_chapter'
      ? topicsOfChapter(topicPickerSubjects, prediction.subject, prediction.chapter)
      : [];
  const subjectTopics =
    prediction && prediction.needs === 'topic_in_subject' ? topicsOfSubject(topicPickerSubjects, prediction.subject) : [];

  const runPrediction = async () => {
    if (predicting) return;
    setPredicting(true);
    try {
      const result = await ta.predictEntryTopic(entry);
      setPrediction(result);
      if (result && result.subject) {
        setManualSubject(result.subject);
        if (result.chapter) setManualChapter(result.chapter);
      }
    } finally {
      setPredicting(false);
    }
  };

  const pick = (subject: string, chapter: string, topic: string) => {
    void ta.confirmTopic(entry, { subject, chapter, topic }, prediction?.topic || String(entry.predicted_topic_id ?? '') || null);
    setPrediction(null);
    onClose();
  };

  return (
    <div className="mt-2 pt-2 space-y-2.5 vicharak-fade" style={{ borderTop: `1px dashed ${BORDER}` }} data-testid={`logging-details-${entry.id}`}>
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] flex-1" style={{ color: TEXT_MUTED }}>
          Topic {confirmedTopic ? '· tagged' : '· pick the specific topic from your syllabus'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {confirmedTopic && (
        <p className="text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
          {String(entry.subject ?? '')} › {String(entry.chapter_id ?? '—')} ›{' '}
          <span style={{ color: subjectColor(entry.subject) }}>{confirmedTopic}</span>
        </p>
      )}

      {/* The crop is a valid input on its own now, so this is no longer
          disabled when the OCR text came back empty or garbled. */}
      <button
        type="button"
        disabled={predicting || !hasReadableSource}
        onClick={() => void runPrediction()}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-extrabold disabled:opacity-50 touch-manipulation"
        style={{ borderRadius: RADIUS.chip, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
        data-testid={`logging-predict-${entry.id}`}
      >
        {predicting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {predicting ? 'Matching against your syllabus…' : 'Match topic from my syllabus'}
      </button>

      {/* A concept_gap tag owes the student the CONCEPT, not just the label. */}
      {showConceptPanel && (
        <div
          className="px-2.5 py-2 space-y-1.5"
          style={{ borderRadius: RADIUS.sm, background: NAVY_ALT, border: `1px solid ${BORDER}` }}
          data-testid={`logging-concept-panel-${entry.id}`}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
            Concept behind this question
          </p>

          {conceptTested && (
            <p
              className="text-[11px] font-bold leading-relaxed"
              style={{ color: TEXT_SECONDARY }}
              data-testid={`logging-concept-tested-${entry.id}`}
            >
              {conceptTested}
            </p>
          )}

          {gap && (
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: TEXT_SECONDARY }}
              data-testid={`logging-concept-gap-detail-${entry.id}`}
            >
              <b style={{ color: gap.label === 'Concept gap' ? DANGER : TEXT_MUTED }}>{gap.label}:</b> {gap.description}
            </p>
          )}

          {!conceptTested && !gap && (
            <p className="text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
              The text reader could not make sense of this crop — read the image itself to name the concept it tests.
            </p>
          )}

          {hasReadableSource && (
            <button
              type="button"
              disabled={readingCrop}
              onClick={() => void ta.analyzeEntryConceptGap(entry)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-extrabold disabled:opacity-50 touch-manipulation"
              style={{
                borderRadius: RADIUS.chip,
                border: `1px solid ${tint(DOUBT_ACCENT, 0.45)}`,
                color: DOUBT_ACCENT,
                background: tint(DOUBT_ACCENT, 0.08),
              }}
              data-testid={`logging-read-concept-${entry.id}`}
            >
              {readingCrop ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              {readingCrop
                ? 'Reading the crop…'
                : conceptTested || gap
                  ? 'Read the crop again'
                  : 'Read the crop for the concept'}
            </button>
          )}
        </div>
      )}

      {prediction && prediction.needs === 'none' && prediction.topic && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
            Matched: <span style={{ color: AMBER }}>{prediction.topic}</span> ({prediction.chapter} · {prediction.subject})
          </span>
          <button
            type="button"
            onClick={() => pick(prediction.subject, prediction.chapter, prediction.topic)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid={`logging-confirm-topic-${entry.id}`}
          >
            <Check className="w-3 h-3" /> Confirm
          </button>
          <button
            type="button"
            onClick={() => setPrediction({ ...prediction, topic: '', needs: 'topic_in_chapter' })}
            className="px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
            style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
          >
            Pick another
          </button>
        </div>
      )}

      {chapterTopics.length > 0 && (
        <div>
          <p className="text-[10px]" style={{ color: TEXT_MUTED }}>
            Narrowed to <b>{prediction?.chapter}</b> — which topic was it?
          </p>
          <div className="mt-1.5 flex gap-1.5 flex-wrap">
            {chapterTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => pick(prediction?.subject ?? manualSubject, prediction?.chapter ?? manualChapter, topic)}
                className="px-2.5 py-1.5 text-[10px] font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: NAVY_ALT }}
                data-testid={`logging-topic-pick-${entry.id}-${topic.slice(0, 14)}`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {subjectTopics.length > 0 && (
        <div>
          <p className="text-[10px]" style={{ color: TEXT_MUTED }}>
            Only the subject was clear (<b>{prediction?.subject}</b>) — here is its whole topic list.
          </p>
          <div className="mt-1.5 flex gap-1.5 flex-wrap max-h-40 overflow-y-auto">
            {subjectTopics.map((row) => (
              <button
                key={`${row.chapter}|${row.topic}`}
                type="button"
                onClick={() => pick(prediction?.subject ?? manualSubject, row.chapter, row.topic)}
                className="px-2.5 py-1.5 text-[10px] font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: NAVY_ALT }}
                data-testid={`logging-subject-topic-${entry.id}-${row.topic.slice(0, 12)}`}
              >
                {row.topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* the manual cascade is always available — the student always has a
          way to say what it was, from their own syllabus */}
      <div className="grid grid-cols-3 gap-1.5">
        <select
          value={manualSubject}
          onChange={(event) => {
            setManualSubject(event.target.value);
            setManualChapter('');
          }}
          className="px-2 py-2 text-[11px] font-bold"
          style={inputStyle}
          aria-label="Subject"
          data-testid={`logging-subject-select-${entry.id}`}
        >
          <option value="">Subject…</option>
          {subjectOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={manualChapter}
          disabled={!manualSubject}
          onChange={(event) => setManualChapter(event.target.value)}
          className="px-2 py-2 text-[11px] font-bold disabled:opacity-50"
          style={inputStyle}
          aria-label="Chapter (navigation only)"
          data-testid={`logging-chapter-select-${entry.id}`}
        >
          <option value="">Chapter…</option>
          {chapterOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value=""
          disabled={manualTopics.length === 0}
          onChange={(event) => {
            if (event.target.value) pick(manualSubject, manualChapter, event.target.value);
          }}
          className="px-2 py-2 text-[11px] font-bold disabled:opacity-50"
          style={inputStyle}
          aria-label="Topic (the final tag)"
          data-testid={`logging-topic-select-${entry.id}`}
        >
          <option value="">Topic…</option>
          {manualTopics.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* partial credit is the ONLY case where per-question marks are asked */}
      {examConfig.allows_partial_credit && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
            Marks for this question
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2 max-w-[260px]">
            <label className="text-[10px] font-bold" style={{ color: TEXT_SECONDARY }}>
              Earned
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
                onBlur={saveQuestionMarks}
                className="mt-1 w-full px-2.5 py-2 text-[12px]"
                style={inputStyle}
                data-testid={`logging-marks-${entry.id}`}
              />
            </label>
            <label className="text-[10px] font-bold" style={{ color: TEXT_SECONDARY }}>
              Possible
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={marksPossible}
                onChange={(event) => setMarksPossible(event.target.value)}
                onBlur={saveQuestionMarks}
                className="mt-1 w-full px-2.5 py-2 text-[12px]"
                style={inputStyle}
                data-testid={`logging-marks-possible-${entry.id}`}
              />
            </label>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: TEXT_MUTED }}>
            The default maximum is {formatUnits(examConfig, examConfig.marks_correct)}; change it for mixed-value papers.
          </p>
        </div>
      )}

      {tracksTiming && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
            Time spent
          </p>
          <div className="mt-1.5 flex gap-1.5">
            {TIME_BUCKETS.map((bucket) => (
              <button
                key={bucket}
                type="button"
                onClick={() => void ta.setTimeBucket(entry, entry.time_bucket === bucket ? null : bucket)}
                aria-pressed={entry.time_bucket === bucket}
                className="flex-1 py-2 text-[10px] font-extrabold touch-manipulation"
                style={
                  entry.time_bucket === bucket
                    ? { borderRadius: RADIUS.chip, background: tint(AMBER, 0.16), border: `1px solid ${tint(AMBER, 0.55)}`, color: AMBER }
                    : { borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }
                }
                data-testid={`logging-time-${entry.id}-${bucket}`}
              >
                {TIME_BUCKET_LABELS[bucket as TimeBucket]}
              </button>
            ))}
          </div>
        </div>
      )}

      {(promptNote || String(entry.reason_note ?? '').trim()) && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
            Note (optional — you've missed this topic before)
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note !== String(entry.reason_note ?? '')) void ta.saveReasonNote(entry, note);
            }}
            rows={2}
            placeholder="What exactly tripped you up this time?"
            className="mt-1.5 w-full px-3 py-2.5 text-[12px] resize-none"
            style={inputStyle}
            data-testid={`logging-note-${entry.id}`}
          />
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void ta.removeEntry(entry)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-extrabold touch-manipulation"
          style={{ borderRadius: RADIUS.chip, color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.1) }}
          data-testid={`logging-remove-${entry.id}`}
        >
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </div>
    </div>
  );
}
