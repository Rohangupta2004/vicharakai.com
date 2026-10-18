/**
 * Topic-level tag prediction for mock question entries.
 *
 * THE RULE (same contract as features/doubts/autoTag): predictions are
 * CONSTRAINED to the student's enrolled syllabus — the model only ever picks
 * from the exam's own subject → chapter → topic catalog, and every reply is
 * validated against it (an out-of-catalog answer is dropped, never stored).
 *
 * The final tag must resolve to TOPIC level — chapter is navigation only.
 * Two stages implement that:
 *   1. subject + chapter via the existing constrained tagger
 *      (features/doubts/autoTag.autoTagQuestion);
 *   2. a topic pick WITHIN that chapter's own topic list (one cheap call with
 *      a closed set). If the AI can only identify the chapter, the caller
 *      shows that chapter's topic list for the student to pick — a
 *      chapter-only tag is never stored as final.
 *
 * NO SILENT FALLBACK TOPIC. When matching is not confident the prediction
 * says WHAT the student must pick (`needs`) and the UI shows exactly that
 * list — the chapter's topics, or the whole subject's topics, or the subject
 * choice itself. 'General' (and every other placeholder) is refused outright:
 * it used to be written as the topic whenever OCR/tagging fell through, which
 * collapsed a whole mock onto one imaginary topic. The system now WAITS for
 * the student instead of guessing.
 *
 * predicted_topic_id vs the student-confirmed topic_id is the training
 * signal, logged on every entry.
 */

import { AI_MODELS, OPENAI_PROXY_URL } from '../../config/models';
import { waitForWorkspaceDbToken } from '../../shared/platformAuth';
import { extractJsonObject } from '../../customExam';
import { autoTagQuestion, buildTagCatalog, type CatalogSubject } from '../doubts/autoTag';
import { sanitizeSubjectName, sanitizeTopicName } from './taTypes';
import type { TopicPickerSubject } from '../../TopicPicker';

const TOPIC_PICK_TIMEOUT_MS = 20_000;

/** What the student still has to choose before the entry carries a topic. */
export type TopicPickNeed =
  /** Nothing — a topic-level match came back. */
  | 'none'
  /** The chapter is known: show THAT chapter's topic list. */
  | 'topic_in_chapter'
  /** Only the subject is known: show the subject's whole topic list. */
  | 'topic_in_subject'
  /** Nothing matched: the student picks subject, then chapter, then topic. */
  | 'subject';

export interface TopicPrediction {
  subject: string;
  chapter: string;
  /** Topic-level prediction — '' when only the chapter could be identified. */
  topic: string;
  confidence: number;
  source: 'ai' | 'rule' | 'none';
  /** The pick the UI must offer. Never resolve this by guessing a topic. */
  needs: TopicPickNeed;
}

/** The topics of one chapter in the enrolled syllabus ('' when unknown). */
export function topicsOfChapter(
  subjects: TopicPickerSubject[],
  subjectName: string,
  chapterName: string,
): string[] {
  const subject = subjects.find((s) => s.name === subjectName);
  if (!subject) return [];
  const chapter = subject.chapters.find((c) => c.name === chapterName);
  return chapter ? chapter.topics.filter(Boolean) : [];
}

/** Every topic of one subject, for the manual picker when no chapter fits. */
export function topicsOfSubject(
  subjects: TopicPickerSubject[],
  subjectName: string,
): Array<{ chapter: string; topic: string }> {
  const subject = subjects.find((s) => s.name === subjectName);
  if (!subject) return [];
  const rows: Array<{ chapter: string; topic: string }> = [];
  for (const chapter of subject.chapters) {
    for (const topic of chapter.topics) {
      if (topic) rows.push({ chapter: chapter.name, topic });
    }
  }
  return rows;
}

function snapToList(value: string, list: string[]): string | null {
  const wanted = (value ?? '').trim().toLowerCase();
  if (!wanted) return null;
  return list.find((entry) => (entry ?? '').trim().toLowerCase() === wanted) ?? null;
}

/**
 * One cheap-model call to pick a topic from a CLOSED list (a single
 * chapter's topics). The reply is validated against the list — anything
 * else resolves to ''. Never throws.
 */
async function aiPickTopic(text: string, examLabel: string, chapter: string, topics: string[]): Promise<string> {
  const source = String(text || '').trim();
  if (!source || topics.length === 0) return '';
  try {
    const token = await waitForWorkspaceDbToken();
    if (!token) return '';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TOPIC_PICK_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-DB-Token': token },
        body: JSON.stringify({
          model: AI_MODELS.fast,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content: [
                `You classify one ${examLabel} exam question to a syllabus TOPIC.`,
                `The question belongs to the chapter "${chapter}". You are given that chapter's ONLY allowed topics.`,
                'Reply with STRICT JSON only — no prose, no markdown fences: {"topic": string}.',
                '"topic" MUST be copied verbatim from the allowed list. If none fits, use "".',
              ].join('\n'),
            },
            {
              role: 'user',
              content: `ALLOWED TOPICS:\n${topics.join('\n')}\n\nQUESTION:\n${source.slice(0, 2000)}`,
            },
          ],
          max_completion_tokens: 120,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
    if (!response.ok) return '';
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const parsed = extractJsonObject(String(data.choices?.[0]?.message?.content || ''));
    const record = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    const raw = typeof record.topic === 'string' ? record.topic : '';
    return snapToList(raw, topics) ?? '';
  } catch {
    return '';
  }
}

/**
 * THE prediction entry point: constrained subject + chapter first, then a
 * topic pick within that chapter's own list. Charges the AI wallet at most
 * twice (both calls are the cheap tier); with AI unavailable the rule-based
 * chapter tagger still narrows the manual pick.
 */
export async function predictTopic(args: {
  text: string;
  subjects: TopicPickerSubject[];
  examLabel: string;
  canAskAi: boolean;
  onAiCharged: () => void;
}): Promise<TopicPrediction> {
  const catalog: CatalogSubject[] = buildTagCatalog(args.subjects);
  const tag = await autoTagQuestion(args.text, catalog, args.examLabel, args.canAskAi);
  if (tag.source === 'ai') args.onAiCharged();

  /* The tagger's own placeholder subject ('General') is NOT a subject — it
   * means "could not place this". Treat it as no match and ask the student. */
  const subject = sanitizeSubjectName(tag.subject);
  const inSyllabus = subject !== null && args.subjects.some((entry) => entry.name === subject);
  if (!inSyllabus || subject === null) {
    return { subject: '', chapter: '', topic: '', confidence: tag.confidence, source: tag.source, needs: 'subject' };
  }

  const chapter = String(tag.chapter ?? '').trim();
  if (!chapter) {
    /* Subject only: the student picks from that subject's whole topic list. */
    return { subject, chapter: '', topic: '', confidence: tag.confidence, source: tag.source, needs: 'topic_in_subject' };
  }

  const topics = topicsOfChapter(args.subjects, subject, chapter);
  if (topics.length === 0) {
    return { subject, chapter, topic: '', confidence: tag.confidence, source: tag.source, needs: 'topic_in_subject' };
  }

  let topic: string | null = null;
  if (args.canAskAi) {
    const picked = await aiPickTopic(args.text, args.examLabel, chapter, topics);
    if (picked) args.onAiCharged();
    topic = sanitizeTopicName(picked);
  }
  return {
    subject,
    chapter,
    topic: topic ?? '',
    confidence: tag.confidence,
    source: tag.source,
    /* No confident topic → the chapter's list is shown. The system WAITS. */
    needs: topic ? 'none' : 'topic_in_chapter',
  };
}
