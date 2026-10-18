/**
 * My Doubts — the dedicated doubt bank, reached from the bottom nav.
 *
 * The flow is deliberately effortless: the student snaps or uploads a photo of
 * the question they're stuck on (optionally with a short note), taps Save, and
 * VicharakAI does the rest — it quietly reads the photo to tag the subject,
 * chapter and concept (falling back to a simple text match when AI is
 * unavailable), stores the doubt in the existing question queue, and the app's
 * planner surfaces a "Clear doubt: …" revision task on Today automatically.
 * No forms, no required typing, no extra dialogs.
 *
 * Doubts live in the same zuno_question_queue rows as Question Revision, so
 * the spaced-revision loop and doubt practice keep working unchanged.
 */

import { useState } from 'react';
import { Camera, HelpCircle, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  DANGER,
  NAVY_ALT,
  ON_AMBER,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  tint,
} from './theme';
import { Card, SubjectDot } from './ui';
import { uploadImage } from './Attachments';
import { extractJsonObject } from './customExam';
import { flaggedConceptLabel, type FlaggedRow } from './mcq';
import type { FlaggedDraft } from './FlaggedQuestions';

/** What the vision pass is asked to return — tagging only, never a solution. */
const DOUBT_DETECTION_PROMPT = [
  "This is a photo of an exam question a student is stuck on (from a textbook, past paper or notes).",
  'Reply with STRICT JSON only — no prose, no markdown fences:',
  '{',
  '  "question": "the full question text, transcribed and cleaned up",',
  '  "subject": "the school subject this belongs to, e.g. Physics",',
  '  "topic": "the chapter it maps to, e.g. Current Electricity",',
  '  "concept": "the specific concept being tested, e.g. Kirchhoff\'s Laws — loop rule",',
  '  "difficulty": "easy"|"medium"|"hard" (your estimate)',
  '}',
  'Do not solve the question. Transcribe faithfully; include essential diagram labels in the question text.',
].join('\n');

interface DetectedTags {
  question: string;
  subject: string;
  topic: string;
  concept: string;
  difficulty: FlaggedDraft['difficulty'];
}

function cleanField(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function normalizeDifficulty(value: unknown): FlaggedDraft['difficulty'] {
  const d = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return d === 'easy' || d === 'medium' || d === 'hard' ? d : '';
}

function formatDoubtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

export default function DoubtsTab({
  rows,
  spaceId,
  subjects,
  canAskAi,
  onAiCharged,
  saving,
  onSave,
  onRemove,
}: {
  /** Queued doubt questions, newest first. */
  rows: FlaggedRow[];
  spaceId: string;
  subjects: string[];
  canAskAi: boolean;
  onAiCharged: () => void;
  saving: boolean;
  onSave: (draft: FlaggedDraft) => Promise<void>;
  onRemove: (row: FlaggedRow) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = uploading || analyzing || saving;

  const attachPhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      setImageUrl(await uploadImage(file, spaceId));
    } catch {
      setError("That photo didn't upload — mind trying once more?");
    } finally {
      setUploading(false);
    }
  };

  /** Quiet vision pass: tag the doubt's subject/topic/concept. Never blocks a
   * save — any failure just means the doubt saves untagged. */
  const detectTags = async (url: string): Promise<Partial<DetectedTags>> => {
    if (!canAskAi) return {};
    try {
      const response = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Id': ((window as unknown as { __APP_ID__?: string }).__APP_ID__) || spaceId,
        },
        body: JSON.stringify({ documentUrl: url, documentType: 'image', analysisPrompt: DOUBT_DETECTION_PROMPT }),
      });
      const data = (await response.json()) as { analysis?: unknown };
      if (!response.ok || !data.analysis) return {};
      const parsed = extractJsonObject(String(data.analysis));
      if (!parsed || typeof parsed !== 'object') return {};
      const record = parsed as Record<string, unknown>;
      onAiCharged();
      return {
        question: cleanField(record.question, 600),
        subject: cleanField(record.subject, 60),
        topic: cleanField(record.topic, 90),
        concept: cleanField(record.concept, 90),
        difficulty: normalizeDifficulty(record.difficulty),
      };
    } catch {
      return {};
    }
  };

  /** No-AI fallback: match the note against the student's subject names. */
  const inferSubjectFromText = (text: string): string => {
    const lower = text.toLowerCase();
    return subjects.find((name) => name && lower.includes(name.toLowerCase())) || '';
  };

  const canSave = (!!imageUrl || note.trim().length > 0) && !busy;

  const saveDoubt = async () => {
    if (!canSave) return;
    setError(null);
    let detected: Partial<DetectedTags> = {};
    if (imageUrl) {
      setAnalyzing(true);
      detected = await detectTags(imageUrl);
      setAnalyzing(false);
    }
    const detectedSubject = (detected.subject || '').trim();
    const matchedSubject =
      subjects.find((name) => name.toLowerCase() === detectedSubject.toLowerCase()) || detectedSubject;
    const subject = matchedSubject || inferSubjectFromText(note) || subjects[0] || 'General';
    await onSave({
      question: note.trim() || detected.question || '',
      subject,
      topic: detected.topic || '',
      concept: detected.concept || '',
      difficulty: detected.difficulty || '',
      options: null,
      correct: null,
      imageUrl,
      sourceType: imageUrl ? 'photo' : 'manual',
    });
    setImageUrl(null);
    setNote('');
  };

  return (
    <div className="flex-1 w-full max-w-[600px] mx-auto px-5 sm:px-8 pb-28">
      <header className="pt-6 vicharak-rise">
        <h1 className="text-[22px] sm:text-[26px] font-extrabold leading-[1.12] tracking-tight" style={{ color: TEXT }} data-testid="text-doubts-title">
          My Doubts
        </h1>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
          Stuck on a question? Snap it. VicharakAI remembers it and plans revision on that topic for you.
        </p>
      </header>

      {/* Capture card — photo first (camera OR gallery), note optional, one Save. */}
      <Card radius={RADIUS.lg} className="mt-4 p-4 vicharak-rise" style={{ animationDelay: '40ms' }} testId="card-doubt-capture">
        <p className="text-xs font-extrabold text-center" style={{ color: TEXT_SECONDARY }}>
          {uploading
            ? 'Uploading your photo…'
            : imageUrl
              ? 'Photo attached — tap below to replace'
              : "Snap or upload the question you're stuck on"}
        </p>
        <div className="mt-2.5 flex gap-2">
          <label
            className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-3 py-4 text-center cursor-pointer touch-manipulation"
            style={{ borderColor: BORDER_STRONG, background: NAVY_ALT, color: TEXT_SECONDARY, opacity: uploading ? 0.7 : 1 }}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            <span className="text-xs font-extrabold">Camera</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading || analyzing || saving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void attachPhoto(file);
              }}
              data-testid="input-doubt-photo"
            />
          </label>
          <label
            className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-3 py-4 text-center cursor-pointer touch-manipulation"
            style={{ borderColor: BORDER_STRONG, background: NAVY_ALT, color: TEXT_SECONDARY, opacity: uploading ? 0.7 : 1 }}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            <span className="text-xs font-extrabold">Gallery</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading || analyzing || saving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void attachPhoto(file);
              }}
              data-testid="input-doubt-photo-gallery"
            />
          </label>
        </div>

        {imageUrl && !uploading && (
          <div className="mt-2 relative">
            <img
              src={imageUrl}
              alt="Your doubt question"
              className="max-h-36 mx-auto object-contain"
              style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}` }}
            />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              aria-label="Remove attached photo"
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center touch-manipulation"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#FFFFFF' }}
              data-testid="button-doubt-remove-photo"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Add a note (optional) — e.g. which step confused you"
          className="mt-3 w-full px-3 py-2.5 text-sm resize-none"
          style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
          data-testid="input-doubt-note"
        />

        {error && (
          <p
            className="mt-3 text-[12px] leading-relaxed px-3 py-2.5"
            style={{ borderRadius: RADIUS.md, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.35)}`, color: DANGER }}
            data-testid="text-doubt-error"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canSave}
          onClick={() => void saveDoubt()}
          className="mt-3 w-full py-3.5 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-save-doubt"
        >
          {analyzing || saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {analyzing ? 'Reading your doubt…' : 'Saving…'}
            </>
          ) : (
            <>
              <HelpCircle className="w-4 h-4" />
              Save doubt
            </>
          )}
        </button>
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
          <Sparkles className="w-3 h-3 flex-shrink-0 mt-px" style={{ color: AMBER }} />
          VicharakAI tags the subject and topic automatically, and a revision task on that topic appears on your Today plan.
        </p>
      </Card>

      {/* The doubt bank — every saved doubt with its date. */}
      <section className="mt-5 vicharak-rise" style={{ animationDelay: '70ms' }} data-testid="section-doubt-list">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] mb-2.5" style={{ color: TEXT_MUTED }}>
          Your doubts{rows.length > 0 ? ` · ${rows.length}` : ''}
        </h2>
        {rows.length === 0 ? (
          <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            No doubts saved yet. The next time a question stumps you, snap it above — VicharakAI will remember it and
            bring that topic back for revision until you own it.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-start gap-2.5 px-3.5 py-3 vicharak-fade"
                style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
                data-testid={`doubt-row-${row.id}`}
              >
                {row.image_url && (
                  <img
                    src={row.image_url}
                    alt="Doubt question photo"
                    className="w-14 h-14 object-cover flex-shrink-0"
                    style={{ borderRadius: 8, border: `1px solid ${BORDER}` }}
                  />
                )}
                <span className="min-w-0 flex-1">
                  {row.question_text.trim() !== '' && (
                    <span
                      className="block text-[12px] font-semibold leading-snug"
                      style={{ color: TEXT_SECONDARY, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {row.question_text}
                    </span>
                  )}
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold"
                    style={{ color: subjectColor(row.subject || 'General') }}
                  >
                    <SubjectDot subject={row.subject || 'General'} size={5} />
                    {row.subject || 'General'}
                    {flaggedConceptLabel(row) !== (row.subject || 'General') ? ` · ${flaggedConceptLabel(row)}` : ''}
                  </span>
                  <span className="block text-[10px] mt-0.5" style={{ color: TEXT_MUTED }}>
                    Added {formatDoubtDate(row.created_on)}
                    {row.next_revision_on ? ` · revises ${formatDoubtDate(row.next_revision_on)}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(row)}
                  aria-label="Remove this doubt"
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                  style={{ color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.1) }}
                  data-testid={`doubt-remove-${row.id}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
