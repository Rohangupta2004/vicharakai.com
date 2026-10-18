/**
 * PlanParser — turns a raw block of daily-plan text into individual,
 * structured, reviewable tasks.
 *
 * The student types or pastes their whole day ("1 Physics revise
 * electrostatics, 2 Maths hw integration, 3 Chemistry lecture") and this
 * module:
 *  1. splits it into task segments (numbered markers, newlines, commas),
 *  2. asks the AI to restructure each segment — clean title, subject,
 *     syllabus chapter, task type — with a local parseOneLiner fallback so
 *     the flow works even when the AI is unreachable,
 *  3. flags ONLY the specific word/phrase that is genuinely confusing (never
 *     the whole task, never blocking) with a short friendly hint, and
 *  4. renders the drafts inline so the student can confirm, edit or delete
 *     each one before anything is saved.
 *
 * All AI traffic goes through the platform's server-side OpenAI proxy
 * (`/proxy/openai/...`) exactly like mcq.ts — no client keys.
 */

import { AlertTriangle, Check, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { normalizeTaskType, parseOneLiner, TASK_TYPES, type TaskType } from './engine';
import type { ExamDef } from './syllabus';
import { extractJsonArray } from './mcq';
import { extractJsonObject } from './customExam';
import { AI_MODELS, OPENAI_PROXY_URL } from './config/models';
import { aiProxyHeaders } from './shared/platformAuth';
import {
  AMBER,
  BORDER,
  BRAND_GRADIENT,
  CARD,
  NAVY_ALT,
  ON_AMBER,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  tint,
} from './theme';
import { SubjectDot } from './ui';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** One soft flag: the exact confusing words plus a friendly explanation. */
export interface PlanFlag {
  /** The EXACT substring of the task that looks off ('' when it's a general note). */
  text: string;
  /** One short, warm line: what looks off and how to fix it. */
  hint: string;
}

/** One reviewable task draft parsed out of the student's plan text. */
export interface PlanDraft {
  /** The raw segment the student wrote — kept for the flag highlight. */
  original: string;
  title: string;
  subject: string;
  /** The syllabus chapter the AI mapped it to, when it found one. */
  chapter: string;
  type: TaskType;
  keep: boolean;
  flag: PlanFlag | null;
}

/* ------------------------------------------------------------------ */
/*  Splitting — numbers, newlines, commas                              */
/* ------------------------------------------------------------------ */

/** A punctuated list marker: "2)", "(3)", "4.", "5:" … */
const PUNCT_MARKER = /^[-*•]\s+|^\(?\d{1,2}\)?[\).:\-]\s*/;
const BARE_MARKER = /^\d{1,2}\s+/;

/** The list number a segment starts with ("1 ", "2)", "(3) "), or null. */
function markerNumber(piece: string): number | null {
  const match = piece.match(/^\(?(\d{1,2})\)?[\).:\-]?\s+/);
  return match ? Number(match[1]) : null;
}

function stripMarker(piece: string, stripBareNumber: boolean): string {
  let text = piece.replace(PUNCT_MARKER, '');
  if (stripBareNumber && text === piece) text = text.replace(BARE_MARKER, '');
  return (text.replace(/[,;.\s]+$/, '') ?? '').trim();
}

/**
 * Split a raw plan blob into individual task segments. Newlines win first,
 * then inline numbered markers — but only a real 1, 2, 3… sequence counts as
 * numbering, so "Solve 30 Thermodynamics questions" is never torn at the 30 —
 * then commas, and only when every piece stands on its own.
 */
export function splitPlanText(raw: string): string[] {
  const cleaned = (raw.replace(/\r/g, '') ?? '').trim();
  if (!cleaned) return [];
  let parts = cleaned.split(/\n+/).map((s) => (s ?? '').trim()).filter(Boolean);
  if (parts.length === 1 && markerNumber(parts[0]) === 1) {
    const byNumber = parts[0]
      .split(/[,;]?\s+(?=\(?\d{1,2}[\).:\-]?\s+)/)
      .map((s) => (s ?? '').trim())
      .filter(Boolean);
    if (byNumber.length > 1 && byNumber.every((piece, i) => markerNumber(piece) === i + 1)) {
      parts = byNumber;
    }
  }
  if (parts.length === 1 && /[,;]/.test(parts[0])) {
    const byComma = parts[0].split(/[,;]+/).map((s) => (s ?? '').trim()).filter(Boolean);
    if (byComma.length > 1 && byComma.every((piece) => piece.split(/\s+/).length >= 2)) {
      parts = byComma;
    }
  }
  // A bare leading number ("1 Physics…") is numbering only when the whole
  // list counts 1..n — "3 hours of reading" alone keeps its 3.
  const numbered = parts.length > 1 && parts.every((piece, i) => markerNumber(piece) === i + 1);
  return parts
    .map((piece) => stripMarker(piece, numbered))
    .filter(Boolean)
    .slice(0, 12);
}

/* ------------------------------------------------------------------ */
/*  Structuring — AI first, local fallback                             */
/* ------------------------------------------------------------------ */

function matchSubject(value: unknown, subjects: string[]): string {
  const wanted = typeof value === 'string' ? (value ?? '').trim() : '';
  if (!wanted) return '';
  return subjects.find((name) => name.toLowerCase() === wanted.toLowerCase()) || wanted;
}

function sanitizeFlag(record: Record<string, unknown>, title: string, original: string): PlanFlag | null {
  const raw = record.flag;
  if (!raw || typeof raw !== 'object') return null;
  const flag = raw as Record<string, unknown>;
  const hint = typeof flag.hint === 'string' ? (flag.hint ?? '').trim().slice(0, 160) : '';
  if (!hint) return null;
  let text = typeof flag.text === 'string' ? (flag.text ?? '').trim().slice(0, 80) : '';
  const haystack = `${title}\n${original}`.toLowerCase();
  if (text && !haystack.includes(text.toLowerCase())) text = '';
  return { text, hint };
}

/**
 * One proxy round trip: the raw plan → clean, labelled task drafts. Throws on
 * any failure — callers fall back to localStructurePlan, never to an error
 * wall.
 */
export async function aiStructurePlan(args: {
  rawText: string;
  segments: string[];
  examLabel: string;
  subjects: string[];
}): Promise<PlanDraft[]> {
  const { rawText, segments, examLabel, subjects } = args;
  // A hung parse request must never pin the "Reading your plan…" state —
  // abort after 45s; the caller falls back to the local parser.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  const response = await fetch(OPENAI_PROXY_URL, {
    method: 'POST',
    signal: controller.signal,
    headers: await aiProxyHeaders(),
    body: JSON.stringify({
      model: AI_MODELS.fast,
      reasoning_effort: 'none',
      messages: [
        {
          role: 'system',
          content:
            "You organise a student's raw daily study plan into clean, individual tasks for an Indian competitive-exam prep app. " +
            'Return ONLY a valid JSON array — no prose, no markdown fences. One element per task, keeping the original order: ' +
            '{"original": string (the exact input segment, copied), ' +
            '"title": string (clean, specific task title, e.g. "Revise Electrostatics"), ' +
            '"subject": string (one of the student\'s subjects when possible), ' +
            '"chapter": string|null (the syllabus chapter/topic it maps to, when clear), ' +
            '"type": "Question Practice"|"Lecture"|"Revision"|"Self Study"|"Custom", ' +
            '"flag": null | {"text": string (the EXACT word/phrase copied from the input that is confusing), ' +
            '"hint": string (one short, friendly line saying what looks off and what to do, e.g. "This looks like a place name — did you mean a chapter or topic?")}. ' +
            'Expand shorthand (hw → homework, ch → chapter, lec → lecture). Fix casing. Never merge, drop or invent tasks. ' +
            'Flag ONLY text that genuinely cannot be read as study work — gibberish, a random name or place, something impossible to study. ' +
            'When everything makes sense, every "flag" MUST be null. Do not nitpick phrasing.',
        },
        {
          role: 'user',
          content: JSON.stringify({ exam: examLabel, subjects, plan: rawText, segments }),
        },
      ],
      max_completion_tokens: 1500,
      stream: false,
    }),
  }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`Plan parse failed (${response.status})`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const items = extractJsonArray(String(data.choices?.[0]?.message?.content || ''));
  const drafts: PlanDraft[] = [];
  items.slice(0, 12).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    const original =
      (typeof record.original === 'string' && (record.original ?? '').trim()) || segments[index] || '';
    const title = (typeof record.title === 'string' && (record.title ?? '').trim().slice(0, 140)) || original;
    if (!title) return;
    drafts.push({
      original: original || title,
      title,
      subject: matchSubject(record.subject, subjects),
      chapter: typeof record.chapter === 'string' ? (record.chapter ?? '').trim().slice(0, 90) : '',
      type: normalizeTaskType(record.type),
      keep: true,
      flag: sanitizeFlag(record, title, original),
    });
  });
  if (drafts.length === 0) throw new Error('Empty plan parse');
  return drafts;
}

/** Offline fallback: the same drafts from the local one-liner parser. */
export function localStructurePlan(segments: string[], exam: ExamDef | undefined): PlanDraft[] {
  return segments.map((segment) => {
    const parsed = parseOneLiner(segment, exam);
    return {
      original: segment,
      title: parsed.matchedSyllabus ? parsed.topic : segment.charAt(0).toUpperCase() + segment.slice(1),
      subject: parsed.subject,
      chapter: parsed.matchedSyllabus ? parsed.topic : '',
      type: parsed.type,
      keep: true,
      flag: null,
    };
  });
}

/**
 * One-tap AI polish for a single existing task (used by the task editor):
 * returns a tightened title/subject/type, or null when nothing improves.
 */
export async function aiImproveTask(args: {
  title: string;
  subject: string;
  examLabel: string;
  subjects: string[];
}): Promise<{ title: string; subject: string; type: TaskType } | null> {
  const { title, subject, examLabel, subjects } = args;
  // Same guard: the task editor's "Tidying…" state always resolves.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  const response = await fetch(OPENAI_PROXY_URL, {
    method: 'POST',
    signal: controller.signal,
    headers: await aiProxyHeaders(),
    body: JSON.stringify({
      model: AI_MODELS.fast,
      reasoning_effort: 'none',
      messages: [
        {
          role: 'system',
          content:
            'You tidy one study task for an Indian competitive-exam prep app. Return ONLY strict JSON: ' +
            '{"title": string (clean, specific, keeps the student\'s intent), "subject": string, ' +
            '"type": "Question Practice"|"Lecture"|"Revision"|"Self Study"|"Custom", "changed": boolean}. ' +
            'Expand shorthand, fix casing, name the chapter precisely when obvious. ' +
            'If the task already reads well, return it unchanged with "changed": false.',
        },
        {
          role: 'user',
          content: JSON.stringify({ exam: examLabel, subjects, task: { title, subject } }),
        },
      ],
      max_completion_tokens: 300,
      stream: false,
    }),
  }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`Improve failed (${response.status})`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const parsed = extractJsonObject(String(data.choices?.[0]?.message?.content || '')) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.changed === false) return null;
  const nextTitle = typeof parsed.title === 'string' ? (parsed.title ?? '').trim().slice(0, 140) : '';
  if (!nextTitle) return null;
  return {
    title: nextTitle,
    subject: matchSubject(parsed.subject, subjects) || subject,
    type: normalizeTaskType(parsed.type),
  };
}

/* ------------------------------------------------------------------ */
/*  Inline flag highlight                                              */
/* ------------------------------------------------------------------ */

/** Renders `text` with the flagged phrase underlined in amber — only that
 * portion, never the whole task. Falls back to plain text when the phrase
 * isn't found. */
export function FlaggedText({ text, flag }: { text: string; flag: PlanFlag }) {
  const index = flag.text ? text.toLowerCase().indexOf(flag.text.toLowerCase()) : -1;
  if (index === -1) return <span>{text}</span>;
  const end = index + flag.text.length;
  return (
    <span>
      {text.slice(0, index)}
      <mark
        style={{
          background: 'transparent',
          color: WARNING,
          fontWeight: 700,
          textDecoration: 'underline wavy',
          textDecorationColor: WARNING,
          textUnderlineOffset: 3,
        }}
      >
        {text.slice(index, end)}
      </mark>
      {text.slice(end)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Review list — confirm, edit or delete each task before saving      */
/* ------------------------------------------------------------------ */

export function PlanDraftList({
  drafts,
  onChange,
  subjects,
  saving,
  onConfirm,
  onCancel,
}: {
  drafts: PlanDraft[];
  onChange: (next: PlanDraft[]) => void;
  subjects: string[];
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const kept = drafts.filter((d) => d.keep && (d.title ?? '').trim());
  const missingSubject = kept.filter((d) => !(d.subject ?? '').trim());
  const canSave = kept.length > 0 && missingSubject.length === 0 && !saving;

  const update = (index: number, patch: Partial<PlanDraft>) =>
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const editTitle = (index: number, title: string) => {
    const draft = drafts[index];
    // Once the student rewrites the flagged words, the flag has done its job.
    const flagResolved =
      draft.flag && draft.flag.text && !title.toLowerCase().includes(draft.flag.text.toLowerCase());
    update(index, { title, flag: flagResolved ? null : draft.flag });
  };

  const cycleType = (index: number) => {
    const current = TASK_TYPES.indexOf(drafts[index].type);
    update(index, { type: TASK_TYPES[(current + 1) % TASK_TYPES.length] });
  };

  return (
    <div
      className="mb-3 p-3.5 vicharak-rise"
      style={{ borderRadius: RADIUS.md, background: CARD, border: `1px solid ${tint(AMBER, 0.4)}` }}
      data-testid="plan-draft-list"
    >
      <p className="text-[13px] font-extrabold flex items-center gap-1.5" style={{ color: TEXT }}>
        <Sparkles className="w-4 h-4" style={{ color: AMBER }} />
        I read {drafts.length} task{drafts.length === 1 ? '' : 's'} from your plan
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }}>
        Check each one — edit anything, remove what you don't want, then add.
      </p>

      <div className="mt-2.5 space-y-2">
        {drafts.map((draft, index) => (
          <div
            key={index}
            className="p-3"
            style={{
              borderRadius: RADIUS.md,
              background: NAVY_ALT,
              border: `1px solid ${draft.flag ? tint(WARNING, 0.45) : BORDER}`,
              opacity: draft.keep ? 1 : 0.55,
            }}
            data-testid={`plan-draft-${index}`}
          >
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => update(index, { keep: !draft.keep })}
                aria-pressed={draft.keep}
                aria-label={`Keep “${draft.title}”`}
                className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 touch-manipulation"
                style={{ background: draft.keep ? AMBER : BORDER, color: draft.keep ? '#FFFFFF' : TEXT_MUTED }}
              >
                {draft.keep && <Check className="w-3 h-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <input
                  value={draft.title}
                  onChange={(event) => editTitle(index, event.target.value)}
                  className="w-full bg-transparent text-[13px] font-bold outline-none"
                  style={{ color: TEXT }}
                  aria-label={`Task ${index + 1} title`}
                  data-testid={`plan-draft-title-${index}`}
                />
                {draft.flag && (
                  <p
                    className="mt-1.5 text-[11px] leading-relaxed px-2.5 py-2"
                    style={{
                      borderRadius: RADIUS.sm,
                      background: tint(WARNING, 0.09),
                      border: `1px solid ${tint(WARNING, 0.3)}`,
                      color: TEXT_SECONDARY,
                    }}
                    data-testid={`plan-draft-flag-${index}`}
                  >
                    <AlertTriangle className="w-3 h-3 inline mr-1 align-[-1px]" style={{ color: WARNING }} />
                    {draft.flag.text ? (
                      <>
                        “<FlaggedText
                          text={
                            draft.title.toLowerCase().includes(draft.flag.text.toLowerCase())
                              ? draft.title
                              : draft.original
                          }
                          flag={draft.flag}
                        />” — {draft.flag.hint}
                      </>
                    ) : (
                      draft.flag.hint
                    )}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <select
                    value={draft.subject}
                    onChange={(event) => update(index, { subject: event.target.value })}
                    className="px-2 py-1 text-[11px]"
                    style={{
                      background: CARD,
                      border: `1px solid ${draft.keep && !draft.subject ? tint(WARNING, 0.6) : BORDER}`,
                      borderRadius: RADIUS.chip,
                      color: TEXT_SECONDARY,
                    }}
                    aria-label={`Task ${index + 1} subject`}
                    data-testid={`plan-draft-subject-${index}`}
                  >
                    <option value="">Subject?</option>
                    {Array.from(new Set([draft.subject, ...subjects, 'General'])).filter(Boolean).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => cycleType(index)}
                    className="px-2 py-1 text-[10px] font-extrabold touch-manipulation"
                    style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.12), color: AMBER }}
                    aria-label={`Task ${index + 1} type — tap to change`}
                    title="Task type — tap to change"
                    data-testid={`plan-draft-type-${index}`}
                  >
                    {draft.type}
                  </button>
                  {draft.subject && <SubjectDot subject={draft.subject} size={6} />}
                  {draft.chapter && draft.chapter.toLowerCase() !== draft.title.toLowerCase() && (
                    <span className="text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                      {draft.chapter}
                    </span>
                  )}
                </div>
                {draft.keep && !draft.subject && (
                  <p className="mt-1 text-[10px] font-bold" style={{ color: WARNING }}>
                    Pick a subject for this one — I couldn't tell which it is.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(drafts.filter((_, i) => i !== index))}
                aria-label={`Delete “${draft.title}”`}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                style={{ background: tint(TEXT_MUTED, 0.1), color: TEXT_MUTED }}
                data-testid={`plan-draft-delete-${index}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!canSave}
        onClick={onConfirm}
        className="mt-3 w-full py-3 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
        style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
        data-testid="button-confirm-plan-drafts"
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Adding…</>
        ) : (
          <><Plus className="w-4 h-4" />Add {kept.length} task{kept.length === 1 ? '' : 's'}</>
        )}
      </button>
      {missingSubject.length > 0 && (
        <p className="mt-1.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
          {missingSubject.length === 1 ? 'One task still needs' : `${missingSubject.length} tasks still need`} a subject — everything else is ready.
        </p>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 w-full text-[11px] font-semibold touch-manipulation"
        style={{ color: TEXT_MUTED }}
        data-testid="button-cancel-plan-drafts"
      >
        Discard these drafts
      </button>
    </div>
  );
}
