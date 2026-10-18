/**
 * Open exam entry — any exam a student types, with an AI-fetched syllabus.
 *
 * The five pre-loaded exams in syllabus.ts stay the one-tap path. Anything else
 * a student types comes through here:
 *
 *  1. the model is asked for that exam's standard syllabus (subjects → chapters
 *     → granular topics),
 *  2. the answer is sanitised into the exact same `ExamDef` shape the app already
 *     consumes, so pace, coverage, VicharakAI's picks and the coach treat a typed
 *     exam exactly like a pre-loaded one,
 *  3. it is saved on the student's profile as one `zuno_meta` row, which is what
 *     makes a typed exam survive a reload instead of vanishing,
 *  4. and when the model does not know the exam, nothing is invented — the
 *     student adds their own subjects and topics instead.
 *
 * Storage: `zuno_profile.exam` holds `custom:<slug>` and the syllabus itself
 * lives in `zuno_meta` under CUSTOM_EXAM_META_KEY. The plain exam name is
 * mirrored into EXAM_LABEL_META_KEY so the student's exam is still named
 * correctly on screen even if the syllabus JSON can't be read back.
 */
import { getExam, type ExamChapter, type ExamDef, type ExamSubject } from './syllabus';
import { getSystemDate } from './systemDate';
import { AI_MODELS, OPENAI_PROXY_URL } from './config/models';
import { aiProxyHeaders } from './shared/platformAuth';

/** zuno_meta key holding the typed exam + its syllabus, as JSON. */
export const CUSTOM_EXAM_META_KEY = 'custom_exam';
/** zuno_meta key holding just the exam's display name — a cheap safety net. */
export const EXAM_LABEL_META_KEY = 'exam_label';
/** Every typed exam id carries this prefix, so it can never collide with EXAMS. */
export const CUSTOM_EXAM_PREFIX = 'custom:';

const STORAGE_VERSION = 1;

/* Caps keep one student's syllabus small enough to store, read back and scroll. */
const MAX_SUBJECTS = 8;
const MAX_CHAPTERS_PER_SUBJECT = 12;
const MAX_TOPICS_PER_CHAPTER = 12;
const MAX_LABEL = 90;
const MAX_SHORT_NAME = 18;

/** How far out an exam date is assumed to be when the exam has no fixed month. */
const DEFAULT_HORIZON_DAYS = 180;

/** The smallest syllabus worth calling "found" — below this we ask the student. */
const MIN_TOPICS_FOR_FOUND = 4;

/** Syllabus lookup uses the fast tier — the ONE model registry (config/models.ts). */
const LOOKUP_MODEL = AI_MODELS.fast;

export function isCustomExamId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(CUSTOM_EXAM_PREFIX);
}

/** Stable id for a typed exam name: "GATE CS" becomes "custom:gate-cs". */
export function customExamId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return `${CUSTOM_EXAM_PREFIX}${slug || 'exam'}`;
}

/** Last-resort label when the stored exam name is gone: "custom:gate-cs" becomes "Gate Cs". */
export function examLabelFromId(id: string | null | undefined): string {
  if (!id) return 'Your exam';
  const slug = isCustomExamId(id) ? id.slice(CUSTOM_EXAM_PREFIX.length) : id;
  const words = slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(' ') || 'Your exam';
}

/* ------------------------------------------------------------------ */
/*  Sanitising — never trust a model (or a paste) with the data shape  */
/* ------------------------------------------------------------------ */

/** Trim a label, drop list bullets and numbering, and cap its length. */
function cleanLabel(value: unknown, max = MAX_LABEL): string {
  if (typeof value !== 'string') return '';
  return (value
    .replace(/\s+/g, ' ')
    .replace(/^[\s>*\u2022\u2013\u2014-]+/, '')
    .replace(/^\d{1,2}[.)]\s+/, '') ?? '')
    .trim()
    .slice(0, max);
}

/** A chip-sized version of a long exam name ("Public Affairs PhD entrance..."). */
function shortName(name: string): string {
  if (name.length <= MAX_SHORT_NAME) return name;
  const cut = name.slice(0, MAX_SHORT_NAME);
  const lastSpace = cut.lastIndexOf(' ');
  return `${((lastSpace >= 8 ? cut.slice(0, lastSpace) : cut) ?? '').trim()}\u2026`;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function sanitizeTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const topics = raw
    .map((topic) =>
      typeof topic === 'string' ? cleanLabel(topic) : cleanLabel((topic as { name?: unknown } | null)?.name),
    )
    .filter(Boolean);
  return dedupe(topics).slice(0, MAX_TOPICS_PER_CHAPTER);
}

function sanitizeChapters(raw: unknown): ExamChapter[] {
  if (!Array.isArray(raw)) return [];
  const chapters: ExamChapter[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as { name?: unknown; chapter?: unknown; topics?: unknown };
    const name = cleanLabel(source.name ?? source.chapter);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    chapters.push({ name, topics: sanitizeTopics(source.topics) });
    if (chapters.length >= MAX_CHAPTERS_PER_SUBJECT) break;
  }
  return chapters;
}

/**
 * Coerce anything shaped roughly like a syllabus into ExamSubject[]. Subjects
 * without a usable name are dropped; a subject with no topics is kept, because a
 * named subject the student can log tasks against is still worth having.
 */
export function sanitizeSubjects(raw: unknown): ExamSubject[] {
  if (!Array.isArray(raw)) return [];
  const subjects: ExamSubject[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as { name?: unknown; subject?: unknown; chapters?: unknown; topics?: unknown };
    const name = cleanLabel(source.name ?? source.subject, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    let chapters = sanitizeChapters(source.chapters);
    if (chapters.length === 0) {
      // Some replies flatten a subject straight to topics - keep them, under one chapter.
      chapters = [{ name, topics: sanitizeTopics(source.topics) }];
    }
    seen.add(name.toLowerCase());
    subjects.push({ name, chapters });
    if (subjects.length >= MAX_SUBJECTS) break;
  }
  return subjects;
}

export function countTopics(subjects: ExamSubject[]): number {
  return subjects.reduce(
    (total, subject) => total + subject.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0),
    0,
  );
}

/* ------------------------------------------------------------------ */
/*  Building + storing a typed exam                                    */
/* ------------------------------------------------------------------ */

function isoToday(): string {
  // System clock — follows the QA Time Machine override (systemDate.ts).
  const now = getSystemDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Month/day roughly DEFAULT_HORIZON_DAYS out - used when no real date is known. */
function horizonTarget(label: string, todayISO: string): ExamDef['target'] {
  const date = new Date(`${todayISO}T12:00:00`);
  date.setDate(date.getDate() + DEFAULT_HORIZON_DAYS);
  return { label, month: date.getMonth() + 1, day: date.getDate() };
}

function resolveTarget(raw: unknown, label: string, todayISO: string): ExamDef['target'] {
  const source = (raw ?? {}) as { label?: unknown; month?: unknown; day?: unknown };
  const month = Number(source.month);
  const day = Number(source.day);
  const usable =
    Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(day) && day >= 1 && day <= 31;
  if (!usable) return horizonTarget(label, todayISO);
  return { label: cleanLabel(source.label, 40) || label, month, day };
}

export interface CustomExamDraft {
  /** What the student typed, or the model's short name for it. */
  name: string;
  fullName?: unknown;
  blurb?: unknown;
  subjects: ExamSubject[];
  target?: unknown;
  syllabusSource: 'ai' | 'manual';
  /** Preserve an existing id when re-reading a stored exam. */
  id?: string;
}

/** Assemble a typed exam into the ExamDef every screen already understands. */
export function buildCustomExam(draft: CustomExamDraft, todayISO: string = isoToday()): ExamDef | null {
  const name = cleanLabel(draft.name, 80);
  if (!name) return null;
  const subjects = sanitizeSubjects(draft.subjects);
  const display = shortName(name);
  const subjectLine = subjects
    .slice(0, 3)
    .map((subject) => subject.name)
    .join(' · ');
  return {
    id: draft.id && isCustomExamId(draft.id) ? draft.id : customExamId(name),
    name: display,
    fullName: cleanLabel(draft.fullName, 120) || name,
    blurb:
      cleanLabel(draft.blurb, 120) ||
      (subjectLine ? `${subjectLine}${subjects.length > 3 ? ' · and more' : ''}` : 'Your exam, your syllabus'),
    target: resolveTarget(draft.target, display, todayISO),
    subjects,
    custom: true,
    syllabusSource: draft.syllabusSource === 'manual' ? 'manual' : 'ai',
  };
}

/** JSON written to zuno_meta - the whole typed exam, syllabus included. */
export function serializeCustomExam(exam: ExamDef): string {
  return JSON.stringify({
    v: STORAGE_VERSION,
    id: exam.id,
    name: exam.name,
    fullName: exam.fullName,
    blurb: exam.blurb,
    target: exam.target,
    syllabusSource: exam.syllabusSource ?? 'ai',
    subjects: exam.subjects,
  });
}

/** The zuno_meta rows a typed exam needs, so persistence has one definition. */
export function customExamMetaRows(exam: ExamDef): Array<[string, string]> {
  return [
    [CUSTOM_EXAM_META_KEY, serializeCustomExam(exam)],
    [EXAM_LABEL_META_KEY, exam.fullName || exam.name],
  ];
}

/** Read a stored typed exam back. Returns undefined rather than throwing. */
export function parseCustomExam(raw: string | null | undefined, todayISO: string = isoToday()): ExamDef | undefined {
  if (typeof raw !== 'string' || !(raw ?? '').trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const source = parsed as {
    id?: unknown;
    name?: unknown;
    fullName?: unknown;
    blurb?: unknown;
    target?: unknown;
    syllabusSource?: unknown;
    subjects?: unknown;
  };
  const name = cleanLabel(source.fullName, 120) || cleanLabel(source.name, 80);
  if (!name) return undefined;
  const exam = buildCustomExam(
    {
      id: typeof source.id === 'string' ? source.id : undefined,
      name,
      fullName: source.fullName ?? name,
      blurb: source.blurb,
      subjects: sanitizeSubjects(source.subjects),
      target: source.target,
      syllabusSource: source.syllabusSource === 'manual' ? 'manual' : 'ai',
    },
    todayISO,
  );
  if (!exam) return undefined;
  // A stored short name is already chip-sized; keep it exactly as the student saw it.
  const storedShort = cleanLabel(source.name, MAX_SHORT_NAME + 1);
  return storedShort ? { ...exam, name: storedShort } : exam;
}

/**
 * The one place that answers "which syllabus is this student on?" - a pre-loaded
 * exam when the id matches one, otherwise the typed exam stored on the profile.
 * Undefined means the app holds an exam id it cannot explain.
 */
export function resolveExamDef(
  examId: string | null | undefined,
  storedCustom: string | null | undefined,
  todayISO: string = isoToday(),
): ExamDef | undefined {
  if (!examId) return undefined;
  const preset = getExam(examId);
  if (preset) return preset;
  const custom = parseCustomExam(storedCustom, todayISO);
  if (!custom) return undefined;
  return custom.id === examId || isCustomExamId(examId) ? custom : undefined;
}

/* ------------------------------------------------------------------ */
/*  Manual fallback - the student's own subjects                       */
/* ------------------------------------------------------------------ */

/**
 * Parse the manual subject box. One subject per line; anything after a colon is
 * read as that subject's topics:
 *
 *   Research Methods: Sampling, Survey design, Ethics
 *   Public Policy
 */
export function parseManualSubjects(text: string): ExamSubject[] {
  if (typeof text !== 'string') return [];
  const drafts: ExamSubject[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!(line ?? '').trim()) continue;
    const separator = line.indexOf(':');
    const head = separator === -1 ? line : line.slice(0, separator);
    const tail = separator === -1 ? '' : line.slice(separator + 1);
    const name = cleanLabel(head, 60);
    if (!name) continue;
    const topics = tail
      .split(/[,;\u2022]/)
      .map((topic) => cleanLabel(topic))
      .filter(Boolean);
    drafts.push({ name, chapters: [{ name: topics.length > 0 ? 'My topics' : name, topics }] });
  }
  return sanitizeSubjects(drafts);
}

/** Build a typed exam entirely from what the student wrote. */
export function buildManualExam(name: string, subjectsText: string, todayISO: string = isoToday()): ExamDef | null {
  const subjects = parseManualSubjects(subjectsText);
  if (subjects.length === 0) return null;
  return buildCustomExam({ name, subjects, syllabusSource: 'manual' }, todayISO);
}

/* ------------------------------------------------------------------ */
/*  AI syllabus lookup                                                 */
/* ------------------------------------------------------------------ */

export type SyllabusLookupStatus = 'found' | 'unknown' | 'error';

export interface SyllabusLookup {
  status: SyllabusLookupStatus;
  /** Present only when status is 'found'. */
  exam?: ExamDef;
  /** A warm, student-facing line about what happened. */
  message?: string;
}

const LOOKUP_SYSTEM = [
  'You are a precise exam-syllabus librarian. You cover competitive, entrance, university and professional exams',
  'worldwide, with especially strong coverage of Indian exams (national, state and university level).',
  'You reply with STRICT JSON only - no prose, no markdown, no code fences.',
  'Accuracy matters far more than completeness: never invent a syllabus for an exam you do not actually know.',
].join(' ');

function lookupUserPrompt(name: string): string {
  return [
    `A student says they are preparing for: "${name}".`,
    '',
    'If you genuinely know this exam (or an unambiguous standard equivalent), return its real syllabus as JSON:',
    '{',
    '  "recognized": true,',
    '  "name": "short display name, max 18 characters",',
    '  "fullName": "official full name of the exam",',
    '  "blurb": "one line, max 70 characters, saying what it is for",',
    '  "target": { "label": "paper or stage name", "month": 1-12, "day": 1-31 },',
    '  "subjects": [',
    '    { "name": "subject or paper", "chapters": [ { "name": "unit or chapter", "topics": ["granular topic"] } ] }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Use the real paper/section/subject names, in the order the official syllabus lists them.',
    '- 3 to 6 subjects. Up to 8 chapters per subject. 4 to 6 granular, studiable topics per chapter.',
    '- A topic is something a student can sit down and study in one session, not a whole subject.',
    '- Omit "target" entirely if the exam has no fixed annual date.',
    '- If you do not know this exam, or you would have to guess at its syllabus, reply exactly:',
    '  { "recognized": false, "reason": "short reason in plain English" }',
    '- Output JSON and nothing else.',
  ].join('\n');
}

function stripFences(text: string): string {
  return (text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '') ?? '')
    .trim();
}

function remainingClosers(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') stack.pop();
  }
  return stack.reverse().join('');
}

/**
 * Pull the first JSON object out of a model reply. A long syllabus can be cut
 * off by the token limit, so a truncated reply is salvaged at its last complete
 * element rather than thrown away - a shorter real syllabus beats none at all.
 */
export function extractJsonObject(reply: string): unknown {
  if (typeof reply !== 'string') return null;
  const body = stripFences(reply);
  const start = body.indexOf('{');
  if (start === -1) return null;
  const text = body.slice(start);

  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastComplete = -1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      depth += 1;
    } else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(0, i + 1));
        } catch {
          return null;
        }
      }
      lastComplete = i + 1;
    }
  }

  if (lastComplete <= 0) return null;
  const head = text.slice(0, lastComplete);
  try {
    return JSON.parse(head + remainingClosers(head));
  } catch {
    return null;
  }
}

const UNKNOWN_MESSAGE =
  "I don't have a reliable syllabus for that one, and I won't invent it. Add your subjects below and we'll build the plan around them.";

/** Turn a model reply into a lookup result. Pure - the network stays outside. */
export function readSyllabusReply(reply: string, typedName: string, todayISO: string = isoToday()): SyllabusLookup {
  const payload = extractJsonObject(reply);
  if (!payload || typeof payload !== 'object') {
    return { status: 'unknown', message: UNKNOWN_MESSAGE };
  }
  const source = payload as {
    recognized?: unknown;
    reason?: unknown;
    name?: unknown;
    fullName?: unknown;
    blurb?: unknown;
    target?: unknown;
    subjects?: unknown;
  };
  if (source.recognized === false) {
    const reason = cleanLabel(source.reason, 140);
    return {
      status: 'unknown',
      message: reason ? `${reason} Add your subjects below and we'll plan around them.` : UNKNOWN_MESSAGE,
    };
  }

  const subjects = sanitizeSubjects(source.subjects);
  if (subjects.length === 0 || countTopics(subjects) < MIN_TOPICS_FOR_FOUND) {
    return { status: 'unknown', message: UNKNOWN_MESSAGE };
  }

  const exam = buildCustomExam(
    {
      name: cleanLabel(source.name, 80) || typedName,
      fullName: source.fullName ?? typedName,
      blurb: source.blurb,
      subjects,
      target: source.target,
      syllabusSource: 'ai',
      id: customExamId(typedName),
    },
    todayISO,
  );
  if (!exam) return { status: 'unknown', message: UNKNOWN_MESSAGE };
  return {
    status: 'found',
    exam,
    message: `Found it - ${exam.subjects.length} subjects and ${countTopics(exam.subjects)} topics for ${exam.fullName}.`,
  };
}

/**
 * Ask the model for an exam's syllabus. Deliberately never metered: a student
 * setting up their exam must never be told they are out of AI messages.
 */
export async function lookupExamSyllabus(typedName: string, todayISO: string = isoToday()): Promise<SyllabusLookup> {
  const name = cleanLabel(typedName, 80);
  if (!name) return { status: 'error', message: 'Type your exam name first and I will look up the syllabus.' };
  try {
    const response = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: await aiProxyHeaders(),
      body: JSON.stringify({
        model: LOOKUP_MODEL,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: LOOKUP_SYSTEM },
          { role: 'user', content: lookupUserPrompt(name) },
        ],
        max_completion_tokens: 3200,
        stream: false,
      }),
    });
    if (!response.ok) {
      return {
        status: 'error',
        message: 'My syllabus library did not answer just then. Try once more, or add your subjects yourself.',
      };
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !(reply ?? '').trim()) {
      return {
        status: 'error',
        message: 'My syllabus library came back empty. Try once more, or add your subjects yourself.',
      };
    }
    return readSyllabusReply(reply, name, todayISO);
  } catch {
    return {
      status: 'error',
      message: 'I could not reach my syllabus library just now. Try again, or add your subjects yourself.',
    };
  }
}
