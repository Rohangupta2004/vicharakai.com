/**
 * Coach feature — the Vicharree chat: the deterministic quick answers,
 * the STUDENT DATA system context, the action tools the model can call
 * (the SAME functions the app's own buttons use — the AI never bypasses the
 * deterministic engine), and the chat loop itself.
 * Extracted verbatim from App.tsx; the model name now comes from config/models.
 *
 * PYQ honesty: when the student asks for previous-year questions, the hook
 * retrieves VERIFIED questions from the official bank (pyq/retrieval.ts) and
 * hands them to the UI as data cards — the model is told about them as a data
 * block and is NEVER allowed to invent a question or call generated content a
 * PYQ. Zero verified matches produce an honest "I don't have verified PYQs
 * for that topic yet" reply instead.
 */
import { useEffect, useRef, useState } from 'react';
import {
  addDaysISO,
  formatDuration,
  parseOneLiner,
  topicKey,
  type StudyItem,
} from '../../engine';
import {
  buildDailyPlan,
  buildStudentState,
  describeBacklog,
  formatDailyPlan,
  readinessLine,
  recurringDoubtLine,
  type PrioritizedItem,
} from '../../studyEngine';
import { trackQuote } from '../../quotes';
import { buildExamChatContext } from '../../ExamChatSupport';
import { examSyllabusSourceLine, formatExamMetadataForPrompt } from '../../data/examMetadata';
import { AI_MODELS, OPENAI_PROXY_URL } from '../../config/models';
import { aiProxyHeaders, waitForWorkspaceDbToken } from '../../shared/platformAuth';
import { fetchAllRows, runExclusive, useAllRows, verifiedDbFrom } from '../../services/database/dbClient';
import { isSessionVerificationError } from '../../sessionGuard';
import { useAccountSessionIds } from '../../services/database/accountScope';
import { TABLES } from '../../services/database/tables';
import { getPYQs, pyqExamCodeForProfileExam } from '../../pyq/retrieval';
import type { PYQResult } from '../../pyq/types';
import {
  COACH_DETERMINISTIC_ASKS,
  COACH_FINISHED_TOPIC_ASK,
  COACH_TOOLS,
  type CoachMessage,
  type CoachPlanTask,
  type CoachSuggestion,
} from './coachConfig';
import { fileToCleanJpeg } from '../../doubtOcr';
import { MAX_ACTIVE_DOUBTS } from '../../config/revision';
import { readTodayMood, type VichareeMood } from '../today/moodCheck';
import {
  MOOD_FLOW_DONE_EVENT,
  VICHAREE_ANALYSIS_SIGNAL_EVENT,
  analysisSignalFromEvent,
  moodFromFlowEvent,
  notifyCoachMessageAppended,
  type AnalysisWeakTopicSignal,
} from './vichareeSignals';
import type { DoubtsFeature } from '../doubts/useDoubts';
import type { StudentData } from '../../app/StudentDataContext';
import type { ToastFeature } from '../../shared/useToast';
import type { AccessFeature } from '../access/useAccess';
import type { TasksFeature } from '../tasks/useTasks';
import type { PlanEngineFeature } from '../plan/usePlanEngine';

interface CoachMessageRow {
  id: number;
  role: string;
  content: string;
  created_at: string;
  session_id?: string | null;
}

const COACH_VISIBLE_MESSAGE_LIMIT = 30;
const COACH_SESSION_MESSAGE_LIMIT = 100;
const COACH_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const COACH_DB_READY_TIMEOUT_MS = 20_000;

/** Chat may mount before the platform injects window.__workspaceDb on a fresh
 * OAuth return. Wait for BOTH the authenticated token and the SDK client;
 * persistence must never fire against a null/anonymous client. */
async function waitForCoachDbReady(timeoutMs: number = COACH_DB_READY_TIMEOUT_MS): Promise<boolean> {
  const token = await waitForWorkspaceDbToken(timeoutMs);
  if (!token) return false;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const client = (window as unknown as {
      __workspaceDb?: { token?: unknown; from?: unknown };
    }).__workspaceDb;
    if (client && typeof client.from === 'function' && typeof client.token === 'string' && client.token.length > 0) {
      return true;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
  }
  return false;
}

/** Once per browser session: the auto greeting Vicharree opens the chat with. */
const VICHARREE_GREETED_KEY = 'vicharree_greeted';

/** [V2] Once per session: the daily-plan opening message. The value records
 * the mood it was sent with ('none' = no mood yet), so a mood picked AFTER a
 * mood-less opener upgrades it with one short reshaped-plan follow-up. */
const VICHARREE_PLAN_MESSAGE_KEY = 'vicharree_plan_message';

/** [V2] Mood-flavoured opening lines for the daily-plan message. */
const MOOD_OPENERS: Record<VichareeMood, string> = {
  energetic: "Full power today \u{1F525} — here's a bigger slice, hardest ground first.",
  regular: 'Steady day — one thing at a time.',
  down: "We're keeping it light today \u{1F499} — revision first, one easy win. Showing up still counts.",
};

/** Messages matching this ask for previous-year questions. */
const PYQ_REQUEST_REGEX = /pyq|previous year|past question|past paper/i;
/** The staged reasoning display must be readable before the answer lands. */
const MIN_AI_THINKING_MS = 2300;

/** A state pulse the chat header character reacts to (happy / error). */
export interface CoachSignal {
  kind: 'response' | 'error';
  at: number;
}

/** The assembled result of one streamed completion. */
interface StreamedMessage {
  content: string;
  tool_calls: Array<{ function: { name: string; arguments: string } }>;
}

/**
 * Read one Server-Sent-Events chat completion from the platform AI proxy.
 *
 * `onText` fires with the reply SO FAR on every content delta, so Vicharree
 * can be seen mid-sentence instead of the student staring at typing dots for
 * the whole generation. Tool-call deltas arrive as fragments keyed by index
 * and are reassembled here into whole calls, so the caller sees exactly the
 * `{ content, tool_calls }` shape the non-streaming response used to give it.
 *
 * The proxy always forces `stream_options.include_usage`, which means the
 * final data chunk carries an EMPTY `choices` array — every read below is
 * defensive about that.
 */
async function consumeCoachStream(
  response: Response,
  onText: (textSoFar: string) => void,
): Promise<StreamedMessage> {
  if (!response.body) throw new Error('the AI stream arrived with no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const toolParts = new Map<number, { name: string; args: string }>();
  let text = '';
  let buffer = '';
  let finished = false;

  const consumeLine = (line: string) => {
    if (!line.startsWith('data:')) return;
    const payload = (line.slice(5) ?? '').trim();
    if (!payload) return;
    if (payload === '[DONE]') {
      finished = true;
      return;
    }
    let event: {
      error?: { message?: string };
      choices?: Array<{
        delta?: {
          content?: string;
          tool_calls?: Array<{ index?: number; function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };
    try {
      event = JSON.parse(payload);
    } catch {
      return; /* a frame split across reads — the next chunk completes it */
    }
    if (event?.error) throw new Error(String(event.error.message ?? 'the AI stream failed'));
    const delta = event?.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === 'string' && delta.content) {
      text += delta.content;
      onText(text);
    }
    for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const index = Number(call?.index ?? 0);
      const part = toolParts.get(index) ?? { name: '', args: '' };
      if (call?.function?.name) part.name = call.function.name;
      if (typeof call?.function?.arguments === 'string') part.args += call.function.arguments;
      toolParts.set(index, part);
    }
  };

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      consumeLine(line);
      if (finished) break;
    }
  }
  if (!finished) {
    buffer += decoder.decode();
    for (const line of buffer.split('\n')) {
      consumeLine(line);
      if (finished) break;
    }
  }

  return {
    content: text,
    tool_calls: [...toolParts.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, part]) => part.name.length > 0)
      .map(([, part]) => ({ function: { name: part.name, arguments: part.args } })),
  };
}

export interface CoachFeature {
  coachMessages: CoachMessage[];
  coachInput: string;
  setCoachInput: (text: string) => void;
  coachThinking: boolean;
  coachEndRef: React.MutableRefObject<HTMLDivElement | null>;
  askCoach: (text: string, deterministic: boolean, options?: { echoUser?: boolean }) => Promise<void>;
  /** Pulses on reply arrival / failure so the header character can react. */
  coachSignal: CoachSignal | null;
  /** True while the cross-session history restore is still loading. */
  historyLoading: boolean;
  /** Sends the once-per-session Vicharree greeting; true when it was sent. */
  sendSessionGreeting: () => boolean;
  /** The reply text received SO FAR while it streams in — null when no
   * stream is open. The chat renders this as a live bubble and puts the
   * character in its 'talking' state. */
  coachStreaming: string | null;
  /** The last question that failed, so the chat can offer a one-tap retry. */
  retryableAsk: string | null;
  /** Re-send the last failed question. */
  retryLastAsk: () => void;
  /** Wipe this student's transcript (screen + database). */
  clearCoachHistory: () => Promise<void>;
  /** True while the transcript is being cleared. */
  clearingHistory: boolean;
  /** [V2] Run a tapped quick-reply pill (the one-shot pills under messages). */
  handleSuggestion: (messageIndex: number, suggestion: CoachSuggestion) => void;
  /** [V2] Complete a plan-task card's zuno_items row straight from chat. */
  completePlanTask: (itemId: number) => Promise<void>;
  /** [V2] Send a doubt photo from the chat composer into the Mistake Book. */
  sendDoubtPhoto: (file: File) => Promise<void>;
  /** True while a chat doubt photo is being prepared/saved. */
  doubtUploadBusy: boolean;
}

export function useCoach(
  data: StudentData,
  toast: ToastFeature,
  access: AccessFeature,
  tasks: TasksFeature,
  plan: PlanEngineFeature,
  doubts: DoubtsFeature,
): CoachFeature {
  const {
    profile,
    examDef,
    examMetadata,
    examSyllabusSynced,
    savedExamLabel,
    examDate,
    daysToExam,
    day,
    streak,
    today,
    pace,
    missionQueue,
    doneToday,
    dueRevisions,
    dueRevisionsAll,
    queuedRevisionCount,
    overdueRevisions,
    carryOver,
    todayMinutes,
    scoreEntries,
    weakAreas,
    leastCoveredSubject,
    formula,
    studentItems,
    items,
    goals,
    dailyGoal,
    itemsQ,
    recommendationLogQ,
    activeSyllabusExam,
    readiness,
    weakTopicInsights,
    upsertMeta,
    studentName,
    flaggedRows,
  } = data;
  const { studentState, dailyPlan, onTrack, nowSuggestion, logRecommendation } = plan;
  const { addTask, handleToggle } = tasks;
  const { openPaywall, chargeAi } = access;

  const accountSessionIds = useAccountSessionIds(data.spaceId);
  const accountScopeSignature = accountSessionIds.join(',');
  const coachMessagesQ = useAllRows<CoachMessageRow>(
    TABLES.coachMessages,
    { orderBy: { column: 'created_at', direction: 'asc' } },
    accountSessionIds,
  );
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachDbReady, setCoachDbReady] = useState(() => {
    const client = (window as unknown as {
      __workspaceDb?: { token?: unknown; from?: unknown };
    }).__workspaceDb;
    return Boolean(client && typeof client.from === 'function' && typeof client.token === 'string' && client.token.length > 0);
  });
  const [coachInput, setCoachInput] = useState('');
  const [coachThinking, setCoachThinking] = useState(false);
  const [coachSignal, setCoachSignal] = useState<CoachSignal | null>(null);
  const [coachStreaming, setCoachStreaming] = useState<string | null>(null);
  const [retryableAsk, setRetryableAsk] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [doubtUploadBusy, setDoubtUploadBusy] = useState(false);
  /* [V2] Proactive signals stashed until the history restore finishes, so a
   * proactive append can never freeze hydration mid-load. */
  const pendingSignalsRef = useRef<{ plan: { mood: VichareeMood | null } | null; analysis: AnalysisWeakTopicSignal[] }>({
    plan: null,
    analysis: [],
  });
  const [proactiveTick, setProactiveTick] = useState(0);
  const coachEndRef = useRef<HTMLDivElement | null>(null);
  const coachInteractionStartedRef = useRef(false);
  const coachHydrationSignatureRef = useRef<string | null>(null);

  /* A fresh Google return can render before WorkspaceDB injection completes.
   * Keep the chat in its connecting state and retry quietly until the SDK has
   * an authenticated token; message hydration and writes start only then. */
  useEffect(() => {
    if (coachDbReady) return undefined;
    let cancelled = false;
    let retryTimer = 0;
    const connect = async () => {
      const ready = await waitForCoachDbReady();
      if (cancelled) return;
      if (ready) setCoachDbReady(true);
      else retryTimer = window.setTimeout(() => void connect(), 1_000);
    };
    void connect();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [coachDbReady]);

  /* Restore only recent messages from every verified session belonging to the
   * signed-in account. If the student starts typing before the cross-session
   * read finishes, never overwrite that live conversation with hydration. */
  useEffect(() => {
    if (!coachDbReady || coachInteractionStartedRef.current || !accountScopeSignature || coachMessagesQ.loading) return;
    const cutoff = Date.now() - COACH_RETENTION_MS;
    const recentRows = coachMessagesQ.data
      .filter((row) => {
        const createdAt = Date.parse(row.created_at);
        return (row.role === 'user' || row.role === 'assistant')
          && Boolean(row.content)
          && (Number.isNaN(createdAt) || createdAt >= cutoff);
      })
      .slice(-COACH_VISIBLE_MESSAGE_LIMIT);
    const hydrationSignature = recentRows.map((row) => `${row.id}:${row.created_at}`).join('|');
    if (coachHydrationSignatureRef.current === hydrationSignature) return;
    coachHydrationSignatureRef.current = hydrationSignature;
    setCoachMessages(recentRows.map<CoachMessage>((row) => {
      const createdAt = Date.parse(row.created_at);
      return {
        role: row.role === 'assistant' ? 'coach' : 'user',
        text: row.content,
        ...(Number.isNaN(createdAt) ? {} : { at: createdAt }),
      };
    }));
  }, [coachDbReady, accountScopeSignature, coachMessagesQ.data, coachMessagesQ.loading]);

  const appendCoachMessages = (...messages: CoachMessage[]) => {
    if (messages.length === 0) return;
    coachInteractionStartedRef.current = true;
    const timestamp = Date.now();
    const stamped = messages.map<CoachMessage>((message, index) => ({
      ...message,
      at: message.at ?? timestamp + index,
    }));
    setCoachMessages((previous) => [...previous, ...stamped].slice(-COACH_VISIBLE_MESSAGE_LIMIT));

    /* Optimistically render, then persist through the same verified write
     * guard as every other student-data action. A fresh OAuth return may not
     * have its injected client yet, so this queue waits for the authenticated
     * WorkspaceDB token/client before the first write. Pruning is
     * session-scoped: keep at most 100 rows and 90 days for the active login. */
    void runExclusive('coach-message-persistence', async () => {
      if (!coachDbReady) {
        const ready = await waitForCoachDbReady();
        if (!ready) throw new Error('WorkspaceDB did not become ready');
        setCoachDbReady(true);
      }
      const db = verifiedDbFrom(TABLES.coachMessages);
      for (const message of stamped) {
        await db.insert({
          role: message.role === 'coach' ? 'assistant' : 'user',
          content: message.text,
          created_at: new Date(message.at ?? Date.now()).toISOString(),
        });
      }
      const ownRows = await fetchAllRows<CoachMessageRow>(TABLES.coachMessages, {
        orderBy: { column: 'created_at', direction: 'desc' },
      });
      const cutoff = Date.now() - COACH_RETENTION_MS;
      const staleRows = ownRows.filter((row, index) => {
        const createdAt = Date.parse(row.created_at);
        return index >= COACH_SESSION_MESSAGE_LIMIT || (!Number.isNaN(createdAt) && createdAt < cutoff);
      });
      await Promise.all(staleRows.map((row) => db.delete(row.id)));
      coachMessagesQ.refresh();
    }).catch((error) => {
      console.warn('[vicharakai-coach] message persistence failed', error);
      /* Session refusals already open the app's re-auth gate. For a genuine
       * post-readiness database failure, report the failed sync directly — no
       * speculative "may not save" warning. */
      if (!isSessionVerificationError(error)) {
        toast.showToast('Chat history sync failed. Your conversation is still on screen — reconnect and send again.');
      }
    });
  };

  /* ---------- [V2 Task 3] Vicharree's proactive daily-plan message ---------- */

  /** Spec-worded WHY label for one plan entry ("Due for revision" / "Weak
   * area" / "Exam in X days"), derived from the engine's stored reasons. */
  const planReasonLabel = (entry: PrioritizedItem): string => {
    const first = entry.reasons[0] ?? '';
    if (entry.item.kind === 'revision') {
      return first.includes('overdue') ? 'Overdue revision' : 'Due for revision';
    }
    if (entry.reasons.some((reason) => reason.startsWith('flagged weak') || reason.startsWith('recent test accuracy'))) {
      return 'Weak area';
    }
    if (first.startsWith('carried over')) return 'Carried over';
    if (daysToExam > 0 && daysToExam <= 120) return `Exam in ${daysToExam} day${daysToExam === 1 ? '' : 's'}`;
    return "On today's plan";
  };

  /** Today's plan as chat task cards — the SAME engine-ranked items the Today
   * tab shows, sliced to the mood (down = 2 light items, energetic = up to 5).
   * `capOverride` is used by the "I finished a topic" reply, which wants the
   * whole short list rather than the mood's slice. */
  const buildPlanTasks = (mood: VichareeMood | null, capOverride?: number): CoachPlanTask[] => {
    const cap = capOverride ?? (mood === 'down' ? 2 : mood === 'energetic' ? 5 : 3);
    return [...dailyPlan.mustDo, ...dailyPlan.shouldDo].slice(0, cap).map<CoachPlanTask>((entry) => ({
      itemId: entry.item.id,
      subject: entry.item.subject,
      topic: entry.item.topic,
      kind: entry.item.kind === 'revision' ? 'revision' : 'new',
      reason: planReasonLabel(entry),
      estMinutes: entry.estMinutes,
    }));
  };

  /** "Start with Current Electricity — you got 42% there in your recent
   * tests." Built ONLY from the engine's stored reasons — never invented. */
  const planHighlightLine = (entries: PrioritizedItem[]): string | null => {
    for (const entry of entries) {
      for (const reason of entry.reasons) {
        const match = /recent test accuracy (\d+)%/.exec(reason);
        if (match) return `Start with ${entry.item.topic} — you got ${match[1]}% there in your recent tests.`;
      }
    }
    const weak = entries.find((entry) => entry.reasons.some((reason) => reason.startsWith('flagged weak')));
    if (weak) return `Start with ${weak.item.topic} — your own test data flags it as a weak area.`;
    const first = entries[0];
    if (!first) return null;
    return `Start with ${first.item.topic}${first.reasons[0] ? ` — ${first.reasons[0]}` : ''}.`;
  };

  /**
   * [V2] Vicharree's opening message: the daily plan as actionable chat task
   * cards, personalized by mood, the spaced-revision schedule, weak topics
   * and test scores — sent ONCE per browser session. The sessionStorage value
   * records the mood it went out with, so a mood picked AFTER a mood-less
   * opener upgrades it with one short reshaped plan instead of a duplicate.
   */
  const sendDailyPlanChatMessage = (mood: VichareeMood | null): boolean => {
    let prior: string | null = null;
    try {
      prior = window.sessionStorage.getItem(VICHARREE_PLAN_MESSAGE_KEY);
    } catch {
      return false;
    }
    const reshape = prior === 'none' && mood !== null;
    if (prior !== null && !reshape) return false;
    try {
      window.sessionStorage.setItem(VICHARREE_PLAN_MESSAGE_KEY, mood ?? 'none');
      // The plan message IS the session greeting now — never both.
      window.sessionStorage.setItem(VICHARREE_GREETED_KEY, '1');
    } catch {
      /* storage unavailable — still send this one; worst case is a repeat */
    }

    const planTasks = buildPlanTasks(mood);
    if (planTasks.length === 0) {
      const isBrandNew = studentItems.length === 0 && scoreEntries.length === 0;
      const emptyText = isBrandNew
        ? "Hi! I'm Vicharree, your AI study companion. Tell me what you're studying today and I'll build your plan — say something like \"add plane motion\" and it lands on Today instantly. \u{1F3AF}"
        : doneToday.length > 0
          ? `${doneToday.length === 1 ? 'One thing' : `${doneToday.length} things`} already done and nothing left queued — strong. Want me to line up something smart for the time you have left?`
          : "Nothing is queued for today yet — tell me what you're studying, or tap a pill below and I'll build today's plan from your revision schedule and weak spots.";
      appendCoachMessages({
        role: 'coach',
        text: emptyText,
        suggestions: [
          { kind: 'ask', label: 'Pick for me', ask: 'Pick something smart for me to study now' },
          { kind: 'ask', label: 'Show my weak topics', ask: 'What are my weak areas?' },
        ],
      });
      notifyCoachMessageAppended();
      return true;
    }

    const lines: string[] = [];
    if (reshape && mood) {
      lines.push(`Got it — ${MOOD_OPENERS[mood]} Here's the reshaped plan:`);
    } else if (mood) {
      lines.push(
        `${studentName ? `Hey ${studentName}! ` : ''}${MOOD_OPENERS[mood]}`,
        "Based on how you're feeling today, here's your plan:",
      );
    } else {
      lines.push(
        `${studentName ? `Hey ${studentName}! ` : ''}Here's today's plan — built from your revision schedule, weak topics and recent scores:`,
      );
    }
    const highlight = planHighlightLine([...dailyPlan.mustDo, ...dailyPlan.shouldDo]);
    if (highlight) lines.push(highlight);
    if (dailyPlan.backlogNote && !reshape) lines.push(dailyPlan.backlogNote);

    appendCoachMessages({
      role: 'coach',
      text: lines.join('\n\n'),
      planTasks,
      suggestions: [
        { kind: 'ask', label: 'Show my weak topics', ask: 'What are my weak areas?' },
        { kind: 'ask', label: 'What should I revise?', ask: 'What should I revise today?' },
        { kind: 'skip-today', label: 'Skip today' },
      ],
    });
    notifyCoachMessageAppended();
    return true;
  };

  /**
   * The once-per-session opening message. [V2] This is now the daily-plan
   * message (mood read from today's stored answer) — the old two-line hello
   * survives only inside the plan message's brand-new-student variant.
   */
  const sendSessionGreeting = (): boolean => sendDailyPlanChatMessage(readTodayMood(data.spaceId, today));

  /* ---------- [V2 Task 3] proactive nudges + quick-reply pill actions ---------- */

  /** After test analysis tags wrong questions onto a chapter: offer to
   * schedule a revision. Once per chapter per day — never chat spam. */
  const sendAnalysisNudge = (signal: AnalysisWeakTopicSignal): void => {
    try {
      const key = `vicharree_nudge_${today}_${(signal.chapter ?? '').trim().toLowerCase()}`;
      if (window.sessionStorage.getItem(key) === '1') return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* storage unavailable — send anyway */
    }
    appendCoachMessages({
      role: 'coach',
      text: `I noticed you got ${
        signal.wrongCount === 1 ? 'a question' : `${signal.wrongCount} questions`
      } wrong in ${signal.chapter} during your test analysis. Want me to schedule a revision for tomorrow?`,
      suggestions: [
        { kind: 'schedule-revision', label: 'Yes, schedule it', subject: signal.subject, topic: signal.chapter },
        { kind: 'decline-revision', label: 'No thanks' },
      ],
    });
    notifyCoachMessageAppended();
  };

  /** "Yes, schedule it" — the same addTask path every surface uses, scheduled
   * on tomorrow; the engine skips duplicates on its own. */
  const scheduleRevisionForTomorrow = async (subject: string, topic: string): Promise<void> => {
    const cleanTopic = (topic ?? '').trim();
    if (!cleanTopic) return;
    const tomorrow = addDaysISO(today, 1);
    try {
      const created = await addTask((subject ?? '').trim() || 'General', cleanTopic, 'Revision', true, tomorrow);
      if (created) {
        logRecommendation('coach-action', `Scheduled revision: ${cleanTopic}`, 'student accepted the post-analysis nudge in chat', 'wrong questions tagged in test analysis', 'revision scheduled for tomorrow');
      }
      appendCoachMessages({
        role: 'coach',
        text: created
          ? `Done — ${cleanTopic} is on tomorrow's revision plan. It'll be waiting on Today when the day starts. \u{1F4AA}`
          : `${cleanTopic} is already on your plan — no duplicate added. You're covered.`,
      });
    } catch {
      appendCoachMessages({
        role: 'coach',
        text: `That didn't save — say "add task: revise ${cleanTopic}" and I'll try again.`,
      });
    }
  };

  /** A tapped quick-reply pill. The pills clear immediately (one-shot), then
   * the action runs — 'ask' pills go to the AI exactly like a typed message;
   * everything else is a deterministic in-app action. */
  const handleSuggestion = (messageIndex: number, suggestion: CoachSuggestion): void => {
    setCoachMessages((previous) =>
      previous.map((message, index) => (index === messageIndex ? { ...message, suggestions: undefined } : message)),
    );
    if (suggestion.kind === 'ask') {
      void askCoach(suggestion.ask ?? suggestion.label, false);
    } else if (suggestion.kind === 'schedule-revision') {
      void scheduleRevisionForTomorrow(suggestion.subject ?? '', suggestion.topic ?? '');
    } else if (suggestion.kind === 'decline-revision') {
      appendCoachMessages({
        role: 'coach',
        text: "No problem — I'll keep an eye on it. If it keeps costing marks, I'll bring it up again.",
      });
    } else if (suggestion.kind === 'doubt-add-revision') {
      appendCoachMessages({
        role: 'coach',
        text: "Done — it's tagged into your revision list. It first comes up tomorrow, and the spaced schedule carries it from there. Add your own answer from Today's Resolve list once you've solved it.",
      });
    } else if (suggestion.kind === 'doubt-create-test') {
      appendCoachMessages({
        role: 'coach',
        text: "Test created! You'll find it in the Practice section.",
      });
    } else {
      // skip-today — nothing is deleted; the plan simply waits.
      appendCoachMessages({
        role: 'coach',
        text: "No stress — today's plan stays saved and will be right here when you're ready. Rest counts too. \u{1F499}",
      });
    }
  };

  /** [V2] The checkmark on a chat plan-task card — completes the SAME
   * zuno_items row Today shows, through the same handleToggle path. */
  const completePlanTask = async (itemId: number): Promise<void> => {
    const item = items.find((row) => row.id === itemId);
    if (!item || item.status !== 'pending') {
      toast.showToast('That one is already off your list.');
      return;
    }
    await handleToggle(item, { skipFeedbackPrompt: true });
  };

  /**
   * [V2] A doubt photo sent from the chat composer. It lands in the SAME
   * Mistake Book pipeline as the camera tab (EXIF-strip → capture-first save
   * → background upload/OCR/auto-tag → spaced revision), and Vicharree
   * acknowledges with quick-reply pills.
   */
  const sendDoubtPhoto = async (file: File): Promise<void> => {
    if (doubtUploadBusy) return;
    const activeCount = flaggedRows.filter((row) => row.status === 'queued').length;
    if (activeCount >= MAX_ACTIVE_DOUBTS) {
      appendCoachMessages({
        role: 'coach',
        text: `Your Mistake Book rotation is full (${MAX_ACTIVE_DOUBTS} active) — clear a few from the Mistake Book and send that photo again.`,
      });
      return;
    }
    setDoubtUploadBusy(true);
    try {
      let clean: string;
      try {
        clean = await fileToCleanJpeg(file);
      } catch {
        toast.showToast("That photo couldn't be read — mind trying another one?");
        return;
      }
      appendCoachMessages({ role: 'user', text: 'Sent a doubt photo \u{1F4F7}', imageUrl: clean });
      const saved = await doubts.snapMistake(clean, { quiet: true });
      appendCoachMessages(
        saved
          ? {
              role: 'coach',
              text: "Got your doubt! I've saved it — the photo is uploading and I'm reading the question in the background. Want to add this to your revision list, or should I create a mini test around this concept?",
              suggestions: [
                { kind: 'doubt-add-revision', label: 'Add to revision' },
                { kind: 'doubt-create-test', label: 'Create practice test' },
              ],
            }
          : {
              role: 'coach',
              text: "Hmm — that one didn't save. Mind sending the photo once more?",
            },
      );
    } finally {
      setDoubtUploadBusy(false);
    }
  };

  /* [V2] Listen for the mood flow finishing and for test-analysis weak-topic
   * signals. Handlers stash into a ref and tick a re-render, so the drain
   * effect below always runs with FRESH state — and waits for the history
   * restore, so a proactive append can never freeze hydration mid-load. */
  useEffect(() => {
    const onMoodFlowDone = (event: Event) => {
      pendingSignalsRef.current.plan = { mood: moodFromFlowEvent(event) };
      setProactiveTick((tick) => tick + 1);
    };
    const onAnalysisSignal = (event: Event) => {
      const signal = analysisSignalFromEvent(event);
      if (!signal) return;
      pendingSignalsRef.current.analysis.push(signal);
      setProactiveTick((tick) => tick + 1);
    };
    window.addEventListener(MOOD_FLOW_DONE_EVENT, onMoodFlowDone);
    window.addEventListener(VICHAREE_ANALYSIS_SIGNAL_EVENT, onAnalysisSignal);
    return () => {
      window.removeEventListener(MOOD_FLOW_DONE_EVENT, onMoodFlowDone);
      window.removeEventListener(VICHAREE_ANALYSIS_SIGNAL_EVENT, onAnalysisSignal);
    };
  }, []);

  useEffect(() => {
    if (!coachDbReady || coachMessagesQ.loading) return;
    const pending = pendingSignalsRef.current;
    if (pending.plan) {
      const { mood } = pending.plan;
      pending.plan = null;
      sendDailyPlanChatMessage(mood);
    }
    if (pending.analysis.length > 0) {
      for (const signal of pending.analysis.splice(0)) sendAnalysisNudge(signal);
    }
    // Drains on every tick once history is restored — the senders self-gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proactiveTick, coachDbReady, coachMessagesQ.loading]);

  const coachContext = () => {
    const mission = missionQueue[0];
    const weakList = weakAreas.map((w) => `${w.label} (${w.detail})`).join('; ') || 'none identified yet';
    const recentTests =
      scoreEntries
        .slice(-3)
        .map((e) =>
          e.marks !== null && e.total !== null
            ? `${e.label || e.subject}: ${e.marks}/${e.total} (${e.percent}%) on ${e.taken_on}`
            : `${e.label || e.subject}: ${e.percent}% on ${e.taken_on}`,
        )
        .join('; ') || 'no tests logged yet';
    return [
      `Exam: ${examDef?.fullName ?? (savedExamLabel || profile?.exam) ?? 'not chosen'}. Exam date: ${examDate} (${daysToExam} days away). Prep day ${day}. Streak: ${streak} days.`,
      `Pace: ${pace.label}. ${pace.detail}`,
      `Today's mission: ${mission ? `${mission.topic} (${mission.subject})` : 'nothing pending'}. Pending today: ${missionQueue.length}. Done today: ${doneToday.length}.`,
      `Revisions due today: ${dueRevisionsAll.length} (${overdueRevisions.length} of them 2+ days overdue). The app surfaces the weakness-first top ${dueRevisions.length} as "Today's Priority Revisions"; the other ${queuedRevisionCount} stay queued and resurface as those complete.`,
      `Study time recorded today: ${todayMinutes > 0 ? formatDuration(todayMinutes) : 'none yet'}${
        pace.hours
          ? `; averaging ${formatDuration(pace.hours.avgMinutes)} a day against a ${formatDuration(pace.hours.targetMinutes)} daily target${
              pace.hours.targetInferred ? ' inferred from the syllabus' : ' they set themselves'
            }`
          : ''
      }.`,
      `Last 3 tests: ${recentTests}.`,
      `Weak areas: ${weakList}.`,
      `On-track verdict (engine-calculated): ${onTrack.label}. ${onTrack.reasons.slice(0, 3).join(' ')}`,
      readinessLine(studentState),
      `Today's capacity: ~${formatDuration(studentState.capacityMinutes)} (${
        studentState.capacitySource === 'override'
          ? 'the student said this is all the time they have today'
          : studentState.capacitySource === 'goal'
            ? 'their own daily goal'
            : studentState.capacitySource === 'recorded'
              ? 'their recorded average'
              : 'inferred from the syllabus and exam date'
      }).`,
      `Capacity-aware plan for today (engine-calculated — recommend from THIS, in this order):\n${formatDailyPlan(dailyPlan)}`,
      recurringDoubtLine(studentState) ?? '',
      (recommendationLogQ.data ?? []).length > 0
        ? `Recent engine recommendations with stored reasons (quote these when asked "why"):\n${(recommendationLogQ.data ?? [])
            .slice(0, 5)
            .map((row) => `- [${row.created_on}] ${row.recommendation} — because ${row.reason}${row.data_used ? ` (data: ${row.data_used})` : ''}`)
            .join('\n')}`
        : '',
      /* Official exam format + where the syllabus came from. Present for the
       * US exams (AP, SAT/ACT, LSAT, GRE/GMAT, MCAT/DAT); silently absent for
       * exams exam_metadata does not cover, so nothing changes for them. */
      formatExamMetadataForPrompt(examMetadata),
      examSyllabusSourceLine(profile?.exam ?? null, examSyllabusSynced),
      goals ? `Student's goal: ${goals}` : '',
      dailyGoal ? `Daily study-hour goal: ${dailyGoal}h.` : '',
      studentItems.length === 0 && scoreEntries.length === 0
        ? 'FIRST SESSION (Day 1): this student has ZERO tasks and ZERO history. NEVER invent, guess or suggest any topic they have not themselves mentioned in this conversation. Ask what THEY want to study today, then add exactly what they name with add_task — nothing more.'
        : '',
      'Reply in clear, natural English.',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const quickAnswer = (question: string): string => {
    /* [V2] The first of the three always-visible quick replies. The engine
     * already knows the single highest-impact thing to do next AND why, so
     * this answers instantly from the student's own data. */
    if (question === 'What should I focus on first?') {
      if (nowSuggestion) return nowSuggestion;
      const first = dailyPlan.mustDo[0] ?? dailyPlan.shouldDo[0];
      if (first) {
        return `Start with ${first.item.topic} (${first.item.subject}) — ${
          first.reasons[0] ?? "it leads today's plan"
        }. About ${formatDuration(first.estMinutes)}.`;
      }
      return "Nothing is queued yet — tell me what you're studying and I'll put it on Today, or say \"pick for me\" and I'll choose from your weak spots.";
    }
    if (question === 'What should I do today?' || question === 'What should I study today?') {
      // The engine's capacity-aware plan: MUST DO / SHOULD DO / IF TIME, with
      // an honest backlog note — never the whole backlog dumped into one day.
      if (dailyPlan.mustDo.length === 0 && doneToday.length > 0) {
        return `Your list is clear — ${doneToday.length} thing${doneToday.length === 1 ? '' : 's'} done today. If you have fuel left, say "pick something for me" and I'll queue something smart.`;
      }
      if (dailyPlan.mustDo.length === 0) {
        return "Nothing queued yet — tell me what you're studying, or say \"pick for me\" and I'll queue it myself.";
      }
      return `Here's today, fitted to your ~${formatDuration(dailyPlan.capacityMinutes)}:\n\n${formatDailyPlan(dailyPlan)}`;
    }
    if (question === 'Am I on track?') {
      const last = scoreEntries.slice(-3);
      const trend =
        last.length >= 2
          ? ` Your last ${last.length} tests: ${last
              .map((e) => (e.marks !== null && e.total !== null ? `${e.marks}/${e.total}` : `${e.percent}%`))
              .join(', ')}.`
          : '';
      // Multi-signal verdict: coverage + hours + revision backlog + test trend.
      return `${pace.emoji} ${onTrack.label} — ${onTrack.reasons.slice(0, 3).join(' ')} ${daysToExam} days to ${examDef?.target.label ?? 'exam day'}.${trend} ${trackQuote(pace.status)}`;
    }
    if (question === 'What are my weak areas?' || question === 'Show my weak topics') {
      if (weakAreas.length === 0) {
        return `I don't have test data yet, so I won't invent a weak area. Log a mock in the Test Analysis tab — even a rough one — and tag WHY each wrong question went wrong; I'll start spotting patterns immediately. For now, ${leastCoveredSubject ? `${leastCoveredSubject} has the least coverage, so that's where I'd lean` : 'keep covering fresh ground'}.`;
      }
      return `Based on your own numbers: ${weakAreas
        .slice(0, 3)
        .map((w) => `${w.label} — ${w.detail}`)
        .join('; ')}. Want me to queue practice on the top one? Just say “add task: …” with that topic and I'll put it on Today.`;
    }
    if (question === 'Analyze my last test') {
      const last = scoreEntries[scoreEntries.length - 1];
      if (!last) {
        return "You haven't logged a test yet, so I won't invent an analysis. Open Analysis, add your latest paper, and I'll connect every wrong answer to the topics that need revision.";
      }
      const score = last.marks !== null && last.total !== null
        ? `${last.marks}/${last.total} (${last.percent}%)`
        : `${last.percent}%`;
      const weak = weakAreas.slice(0, 2).map((area) => `${area.label} — ${area.detail}`).join('; ');
      return `Your latest test was ${last.label || last.subject}: ${score} on ${last.taken_on}.${weak ? ` The clearest gaps in your tracked data are ${weak}.` : " Tag the wrong questions in Analysis and I'll separate concept gaps from application and avoidable mistakes."}`;
    }
    if (question === 'Update my plan') {
      return `Your live plan currently has ${missionQueue.length} pending task${missionQueue.length === 1 ? '' : 's'} and ${dueRevisionsAll.length} revision${dueRevisionsAll.length === 1 ? '' : 's'} due. I'm opening Today so you can add, remove or reorder the plan against the same data I use here.`;
    }
    // Give me a revision plan
    if (formula.length === 0) {
      return "Nothing is in your revision cycle yet — finish one topic today and it comes back at 1, 3, 7, 14 and 28 days automatically. That's the whole plan; you don't have to schedule anything.";
    }
    const lines = formula
      .slice(0, 5)
      .map((f, idx) => `${idx + 1}. ${f.item.topic} (${f.item.subject})${f.recall ? ' — quick recall' : ` — day-${f.item.interval_days} revisit`}`)
      .join('\n');
    return `Here's today's five, in order:\n${lines}\n${overdueRevisions.length > 0 ? `${overdueRevisions.length} of these slipped 2+ days — clear those first.` : 'Do them before new learning; recall fades fastest.'}`;
  };

  /* ---------- coach actions: the AI acts, never deflects ---------- */

  /** Fuzzy-match a spoken task name onto a pending checklist row. */
  const findPendingTask = (query: string): StudyItem | undefined => {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return undefined;
    const pool = [...missionQueue, ...dueRevisions, ...carryOver];
    const exact = pool.find((i) => i.topic.toLowerCase() === q);
    if (exact) return exact;
    const contains = pool.find((i) => i.topic.toLowerCase().includes(q) || q.includes(i.topic.toLowerCase()));
    if (contains) return contains;
    const words = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
    let best: StudyItem | undefined;
    let bestScore = 0;
    for (const item of pool) {
      const topic = item.topic.toLowerCase();
      const score = words.reduce((sum, w) => sum + (topic.includes(w) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return bestScore > 0 ? best : undefined;
  };

  const coachAddTask = async (title: string, subjectHint?: string): Promise<string> => {
    const parsed = parseOneLiner(title, examDef);
    const subject = (subjectHint || '').trim() || parsed.subject || 'General';
    const created = await addTask(subject, (title ?? '').trim(), parsed.type, true);
    if (created) {
      logRecommendation('coach-action', `Added task: ${(title ?? '').trim()} (${subject})`, 'student asked for it in chat', 'chat request, validated against the pending list for duplicates', 'task created');
    }
    return created
      ? `Done — I've added ${(title ?? '').trim()} to today's list under ${subject}.`
      : `“${(title ?? '').trim()}” is already on your plan — I skipped the duplicate.`;
  };

  const coachMarkDone = async (query: string): Promise<string> => {
    const item = findPendingTask(query);
    if (!item) return `I couldn't find a pending task matching “${query}” on today's list. Ask me to "list my tasks" and I'll read them out.`;
    await handleToggle(item);
    logRecommendation('coach-action', `Marked done: ${item.topic} (${item.subject})`, 'student said they finished it in chat', `pending item #${item.id}, matched from "${query}"`, 'completed — history, mastery and revisions updated');
    return `Done — “${item.topic}” is checked off.${item.kind === 'new' ? ' Its spaced revisions are queued.' : ''}`;
  };

  const coachRemoveTask = async (query: string): Promise<string> => {
    const item = findPendingTask(query);
    if (!item) return `I couldn't find a pending task matching “${query}”. Ask me to "list my tasks" to see what's queued.`;
    const db = verifiedDbFrom(TABLES.items);
    await db.delete(item.id);
    if (item.kind === 'new') {
      const key = item.source_key || topicKey(item.subject, item.topic);
      const pendingRevs = items.filter((i) => i.kind === 'revision' && i.source_key === key && i.status === 'pending');
      await Promise.all(pendingRevs.map((r) => db.delete(r.id)));
    }
    itemsQ.refresh();
    logRecommendation('coach-action', `Removed task: ${item.topic} (${item.subject})`, 'student asked to remove it in chat', `pending item #${item.id}, matched from "${query}"`, 'task removed');
    return `Done — I've removed “${item.topic}” from your list.`;
  };

  /** Move a pending task/revision to a later day — validated against real
   * state first; the AI only ever hands over intent, never writes directly. */
  const coachPostponeTask = async (query: string, days: number): Promise<string> => {
    const item = findPendingTask(query);
    if (!item) {
      return `I couldn't find a pending task matching “${query}” on your list, so nothing was moved. Ask me to "list my tasks" and I'll read out what's queued.`;
    }
    const safeDays = Number.isFinite(days) && days >= 1 ? Math.min(30, Math.round(days)) : 1;
    const target = addDaysISO(today, safeDays);
    await verifiedDbFrom(TABLES.items).update(item.id, {
      scheduled_for: target,
      ...(item.kind === 'new' ? { day_number: Math.max(1, day + safeDays) } : {}),
    });
    itemsQ.refresh();
    logRecommendation('coach-action', `Postponed: ${item.topic} → ${target}`, 'student asked to move it in chat', `pending item #${item.id}, matched from "${query}"`, 'rescheduled');
    return `Done — “${item.topic}” is moved to ${safeDays === 1 ? 'tomorrow' : target}. ${
      item.kind === 'revision'
        ? 'Only this revision moved — the rest of its spaced ladder is untouched.'
        : 'Its spaced revisions will still queue from the day you actually finish it.'
    }`;
  };

  /** Skip ONE due revision ("I already know this") — the topic's later
   * intervals stay queued, so nothing is erased from the schedule. */
  const coachSkipRevision = async (query: string): Promise<string> => {
    const q = (query ?? '').trim().toLowerCase();
    const item = q
      ? dueRevisions.find((i) => i.topic.toLowerCase().includes(q) || q.includes(i.topic.toLowerCase()))
      : dueRevisions[0];
    if (!item) {
      return q
        ? `No revision matching “${query}” is due today, so nothing was skipped. Ask me to "list my tasks" to see what is due.`
        : 'No revisions are due today — nothing to skip.';
    }
    await verifiedDbFrom(TABLES.items).update(item.id, { status: 'skipped' });
    itemsQ.refresh();
    logRecommendation('coach-action', `Skipped revision: ${item.topic} (${item.subject})`, 'student said they already know it / asked to skip', `due revision #${item.id}`, 'revision skipped');
    return `Okay — today's ${item.topic} revision is skipped. Its later spaced revisions stay queued, so if a test ever says otherwise, the topic comes straight back.`;
  };

  /** "I only have 2 hours today" — record today's real capacity; the daily
   * plan re-fits itself, prioritising the highest-impact items. */
  const coachSetCapacity = async (minutes: number): Promise<string> => {
    const n = Math.round(Number(minutes));
    if (!Number.isFinite(n) || n < 15 || n > 1080) {
      return 'Tell me the time you actually have — like "I have 2 hours today" — and I\'ll re-plan the day around it.';
    }
    await upsertMeta(`capacity_${today}`, String(n));
    // Preview the re-fitted plan immediately (pure recompute, no extra reads).
    const preview = buildDailyPlan(
      buildStudentState({ ...studentState.args, capacityOverrideMinutes: n }),
    );
    logRecommendation('coach-action', `Capacity set: ${formatDuration(n)} today`, "student told me their available time", 'chat request', 'daily plan re-fitted');
    const top = preview.mustDo.map((entry) => `${entry.item.kind === 'revision' ? 'Revise ' : ''}${entry.item.topic} (~${formatDuration(entry.estMinutes)})`);
    return `Got it — planning today around ${formatDuration(n)}.${
      top.length > 0 ? ` The highest-impact fit: ${top.join(' · ')}.` : ''
    }${preview.backlogNote ? ` ${preview.backlogNote}` : ' Everything pending fits in that time.'}`;
  };

  /** "Show me what I'm behind on" — the honest backlog, straight from the engine. */
  const coachShowBacklog = (): string => describeBacklog(studentState);

  const coachListToday = (): string => {
    const pending = [...missionQueue, ...dueRevisions];
    if (pending.length === 0 && doneToday.length === 0) {
      return 'Today\'s list is empty — tell me what to add (e.g. "add plane motion") and it\'s in.';
    }
    if (pending.length === 0) {
      return `Everything is done — ${doneToday.length} task${doneToday.length === 1 ? '' : 's'} completed today. Want me to add something more?`;
    }
    const lines = pending.map((i, idx) => `${idx + 1}. ${i.kind === 'revision' ? `Revise: ${i.topic}` : i.topic} (${i.subject})`);
    const doneLine = doneToday.length > 0 ? `\nDone today: ${doneToday.length}.` : '';
    return `On today's list:\n${lines.join('\n')}${doneLine}`;
  };

  const coachSuggestNext = (): string =>
    nowSuggestion ?? "Nothing is queued and no weak area stands out yet — tell me what you want to study and I'll add it for you.";

  /**
   * Verified-PYQ lookup for a chat turn. Only VERIFIED official questions for
   * the student's own exam are returned; an unknown exam or an empty bank
   * yields [] — the model is then instructed to say so honestly, never to
   * fabricate a question.
   */
  const fetchVerifiedPYQs = async (): Promise<PYQResult[]> => {
    const examCode = pyqExamCodeForProfileExam(profile?.exam);
    if (!examCode) return [];
    try {
      return await getPYQs({ examCode, verificationStatus: 'verified', limit: 5 });
    } catch {
      return [];
    }
  };

  const askCoach = async (
    text: string,
    deterministic: boolean,
    options?: { echoUser?: boolean },
  ) => {
    if (!(text ?? '').trim() || coachThinking) return;
    /* A retry re-sends the question that failed — its user bubble is already
     * in the transcript, so it must not be echoed a second time. */
    const echoUser = options?.echoUser !== false;
    // "add task: …" — the coach creates the task directly, no forms.
    const addCommand = text.match(/^\s*add\s+(?:a\s+)?task\s*[:\-]?\s*(.+)$/i);
    if (addCommand && profile) {
      const name = (addCommand[1] ?? '').trim();
      appendCoachMessages({ role: 'user', text });
      try {
        const confirmation = await coachAddTask(name);
        appendCoachMessages({
          role: 'coach',
          text: `${confirmation} Tell me when it's finished — or just say "mark it done".`,
        });
      } catch {
        appendCoachMessages({ role: 'coach', text: "That task didn't save — mind sending it once more?" });
      }
      return;
    }
    /* [V2] "I finished a topic" — the honest answer is the student's own
     * pending list as tappable cards, so one tap closes the loop and the
     * spaced revisions schedule themselves. No model round-trip, no guessing
     * which topic they meant. */
    if ((text ?? '').trim() === COACH_FINISHED_TOPIC_ASK) {
      const pendingCards = buildPlanTasks(null, 5);
      appendCoachMessages(
        { role: 'user', text },
        pendingCards.length > 0
          ? {
              role: 'coach',
              text: "Nice work! \u{1F4AA} Tap the one you finished and I'll log it — its spaced revisions get scheduled straight away.",
              planTasks: pendingCards,
            }
          : {
              role: 'coach',
              text: 'Love that. Nothing is queued right now — tell me the topic name and I\'ll log it and set up its revision schedule.',
            },
      );
      notifyCoachMessageAppended();
      return;
    }
    // The quick asks are answered from the student's own data, so they stay
    // free forever. Only a real trip to the model counts against the budget.
    if (deterministic || COACH_DETERMINISTIC_ASKS.includes((text ?? '').trim())) {
      appendCoachMessages({ role: 'user', text }, { role: 'coach', text: quickAnswer((text ?? '').trim()) });
      return;
    }
    if (!access.access.canAskAi) {
      openPaywall('chat');
      return;
    }
    if (echoUser) appendCoachMessages({ role: 'user', text });
    const thinkingStartedAt = Date.now();
    setCoachThinking(true);
    setRetryableAsk(null);
    // A hung proxy request must never leave the coach "thinking" forever —
    // abort after 60s and surface a clear retry message instead.
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 60_000);
    try {
      /* PYQ request? Retrieve VERIFIED official questions first — they are
       * rendered as data cards below the reply, never generated text. */
      const wantsPYQs = PYQ_REQUEST_REGEX.test(text);
      const pyqResults = wantsPYQs ? await fetchVerifiedPYQs() : [];
      const pyqBlock = wantsPYQs
        ? pyqResults.length > 0
          ? `\n\nVERIFIED PYQ DATA (from the official question bank — these ${pyqResults.length} real previous-year questions are shown to the student as cards below your reply; refer to them briefly, do NOT restate their full text, and NEVER invent additional questions):\n${pyqResults
              .map((q, i) => `${i + 1}. [${q.examName} ${q.year}${q.subjectName ? ` · ${q.subjectName}` : ''}] ${q.questionText.slice(0, 140)}`)
              .join('\n')}`
          : `\n\nPYQ REQUEST NOTE: the student asked for previous-year questions, but the verified official question bank has NO matching questions for their exam yet. Begin your reply with exactly: "I don't have verified PYQs for that topic yet. Here's what to focus on instead:" and then give study strategy from STUDENT DATA. NEVER fabricate a question and NEVER label anything you write as a PYQ.`
        : '';

      /* Exam-aware grounding: structure, weak topics, readiness and the
       * syllabus chapters relevant to THIS question. */
      const examChatBlock = activeSyllabusExam && readiness
        ? `\n\nEXAM CONTEXT:\n${buildExamChatContext(activeSyllabusExam, weakTopicInsights, readiness, text)}`
        : '';
      const history = coachMessages.slice(-10).map((m) => ({
        role: m.role === 'coach' ? 'assistant' : 'user',
        content: m.text,
      }));
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          /* The frontier text model (config/models — gpt-5.6-terra): Vicharree
           * is the product's primary interface, so her replies get the better
           * model rather than the cheap structured-task one. */
          model: AI_MODELS.standard,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content: `You are Vicharree (spelled V-I-C-H-A-R-R-E-E), the AI study strategist for VicharakAI. You help competitive exam aspirants in India (JEE, NEET, NEET PG, UPSC, and more — always use the exam named in STUDENT DATA and never assume a different one) with their study strategy — what to study today, what to revise, what to skip, and how to stay on track for their exam. You are NOT a content teacher or tutor. You are a personal study strategist. Be warm, motivational and CONCISE — 2 to 3 sentences maximum, unless the student explicitly asks for a full plan. When asked for previous year questions (PYQs), you only use verified questions from the official question bank — you NEVER invent or fabricate questions and NEVER call a generated question a PYQ. If no verified PYQs exist for a topic, say so honestly.\n\nYou have FULL ability to modify the student's task list through your tools: add_task, mark_task_done, remove_task, postpone_task, skip_revision, set_todays_capacity, show_backlog, list_todays_tasks and suggest_next — the very same functions behind the app's quick-add bar and checklist. You interpret the student's intent into a tool call; the app's deterministic engine validates it against their actual state and executes it — you never write to storage directly, and a tool may refuse with an explanation. When the user asks you to add, remove, move, mark done, skip or suggest tasks — DO IT by calling the right tool. Never say "you can add it yourself", never say "please do this manually", and never send them to a form. Examples: "add plane motion" → add_task; "mark Optics done" → mark_task_done; "move optics to tomorrow" → postpone_task; "I already know this / skip this revision" → skip_revision; "I only have 2 hours today / I'm tired, keep it light" → set_todays_capacity; "what am I behind on" → show_backlog; "what should I do now" → suggest_next. remove_task and skip_revision are destructive — call them ONLY when the student explicitly asks; if ambiguous, ask one short clarifying question instead. When the student overrides a recommendation, accept it and adapt — never push the same recommendation again. Reply in clear, natural English — peer-to-peer, no lectures, no guilt-tripping, always pushing the student toward studying rather than more chatting.\n\nDATA RULES (strict): everything in STUDENT DATA is measured from the student's own tracked data or calculated by the engine. Ground every claim ONLY in it — NEVER invent scores, study history, syllabus content, exam dates, official weightages, revision history or test results. When you cite a test, use the real marks (e.g. "148/180 in Mock #3"), not just a percentage. When recommending what to study, follow the engine's capacity-aware plan and its stated reasons — always give the WHY from the data (e.g. "overdue by 2 days + 42% accuracy"), never a bare "revise this". If the data can't answer something, say exactly what's missing (e.g. "log one test and I can tell you") instead of guessing. Suggest at most one action at a time. Never discuss pricing, plans or message limits — the app handles that.\n\nSTUDENT DATA:\n${coachContext()}${examChatBlock}${pyqBlock}`,
            },
            ...history,
            { role: 'user', content: text },
          ],
          tools: COACH_TOOLS,
          tool_choice: 'auto',
          max_completion_tokens: 400,
          stream: true,
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      /* '' (not null) means "the stream is open" — the chat swaps its typing
       * dots for a live bubble and the character starts 'talking'. */
      setCoachStreaming('');
      const message = await consumeCoachStream(response, setCoachStreaming);
      const thinkingRemaining = MIN_AI_THINKING_MS - (Date.now() - thinkingStartedAt);
      if (thinkingRemaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, thinkingRemaining));
      }
      // Only a delivered answer is charged — a failed request is on us.
      chargeAi();

      // The model asked to ACT — run the same functions the app's own buttons
      // use, then confirm briefly. Never deflect to manual steps.
      const toolCalls: Array<{ function?: { name?: string; arguments?: string } }> = message.tool_calls;
      if (toolCalls.length > 0) {
        const confirmations: string[] = [];
        for (const call of toolCalls) {
          const name = call?.function?.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call?.function?.arguments || '{}') as Record<string, unknown>;
          } catch {
            /* malformed args — treated as empty */
          }
          try {
            if (name === 'add_task' && String(args.title ?? '').trim()) {
              confirmations.push(await coachAddTask(String(args.title), typeof args.subject === 'string' ? args.subject : undefined));
            } else if (name === 'mark_task_done') {
              confirmations.push(await coachMarkDone(String(args.task ?? '')));
            } else if (name === 'remove_task') {
              confirmations.push(await coachRemoveTask(String(args.task ?? '')));
            } else if (name === 'list_todays_tasks') {
              confirmations.push(coachListToday());
            } else if (name === 'suggest_next') {
              confirmations.push(coachSuggestNext());
            } else if (name === 'postpone_task') {
              confirmations.push(await coachPostponeTask(String(args.task ?? ''), Number(args.days ?? 1)));
            } else if (name === 'skip_revision') {
              confirmations.push(await coachSkipRevision(String(args.topic ?? '')));
            } else if (name === 'set_todays_capacity') {
              confirmations.push(await coachSetCapacity(Number(args.minutes)));
            } else if (name === 'show_backlog') {
              confirmations.push(coachShowBacklog());
            }
          } catch {
            confirmations.push("That action didn't go through — mind asking once more?");
          }
        }
        const spoken = typeof message.content === 'string' && (message.content ?? '').trim() ? `${(message.content ?? '').trim()}\n\n` : '';
        appendCoachMessages({
          role: 'coach',
          text: `${spoken}${confirmations.join('\n\n')}`.trim() || 'Done.',
          ...(pyqResults.length > 0 ? { pyqs: pyqResults } : {}),
        });
        setCoachSignal({ kind: 'response', at: Date.now() });
        return;
      }

      const reply = message.content;
      appendCoachMessages({
        role: 'coach',
        text: typeof reply === 'string' && (reply ?? '').trim() ? reply : 'Hmm, I lost my train of thought — ask me that once more?',
        ...(pyqResults.length > 0 ? { pyqs: pyqResults } : {}),
      });
      setCoachSignal({ kind: 'response', at: Date.now() });
    } catch (error) {
      const thinkingRemaining = MIN_AI_THINKING_MS - (Date.now() - thinkingStartedAt);
      if (thinkingRemaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, thinkingRemaining));
      }
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      appendCoachMessages({
        role: 'coach',
        text: timedOut
          ? 'That reply took too long, so I stopped waiting — tap Try again and I should be quicker this time.'
          : "I couldn't reach my thinking cap just now — check your connection and tap Try again. Meanwhile, the quick questions above always work.",
      });
      /* Remember the question so the chat can offer one-tap retry without
       * making the student retype it. */
      setRetryableAsk(text);
      setCoachSignal({ kind: 'error', at: Date.now() });
    } finally {
      window.clearTimeout(timer);
      setCoachThinking(false);
      setCoachStreaming(null);
    }
  };

  /** Re-send the question that failed, without echoing it again. */
  const retryLastAsk = () => {
    const pending = retryableAsk;
    if (!pending || coachThinking) return;
    setRetryableAsk(null);
    void askCoach(pending, false, { echoUser: false });
  };

  /**
   * Wipe the transcript — on screen and in the database.
   *
   * SCOPE: the data API scopes deletes to the CALLER'S session, so rows this
   * account wrote from a different login are counted and reported rather
   * than silently left behind. Hydration is frozen afterwards so a background
   * refresh cannot refill the screen with what could not be deleted.
   */
  const clearCoachHistory = async (): Promise<void> => {
    if (clearingHistory) return;
    setClearingHistory(true);
    try {
      if (!coachDbReady && !(await waitForCoachDbReady())) {
        throw new Error('WorkspaceDB did not become ready');
      }
      if (!coachDbReady) setCoachDbReady(true);
      const rows = await fetchAllRows<CoachMessageRow>(TABLES.coachMessages, {
        orderBy: { column: 'id', direction: 'asc' },
      });
      const db = verifiedDbFrom(TABLES.coachMessages);
      let undeletable = 0;
      for (const row of rows) {
        try {
          await db.delete(row.id);
        } catch {
          undeletable += 1;
        }
      }
      coachInteractionStartedRef.current = true;
      coachHydrationSignatureRef.current = null;
      setCoachMessages([]);
      setRetryableAsk(null);
      setCoachSignal(null);
      coachMessagesQ.refresh();
      toast.showToast(
        undeletable > 0
          ? `Chat cleared here. ${undeletable} older message${undeletable === 1 ? '' : 's'} from a previous login stayed put.`
          : 'Chat cleared.',
      );
    } catch (error) {
      console.warn('[vicharakai-coach] clear history failed', error);
      toast.showToast("I couldn't clear the chat just now — give it another try.");
    } finally {
      setClearingHistory(false);
    }
  };

  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    /* coachStreaming keeps the view pinned to the bottom while the reply
     * types itself out, instead of only jumping once it finishes. */
  }, [coachMessages, coachThinking, coachStreaming]);

  return {
    coachMessages,
    coachInput,
    setCoachInput,
    coachThinking,
    coachEndRef,
    askCoach,
    coachSignal,
    historyLoading: !coachDbReady || coachMessagesQ.loading,
    sendSessionGreeting,
    coachStreaming,
    retryableAsk,
    retryLastAsk,
    clearCoachHistory,
    clearingHistory,
    handleSuggestion,
    completePlanTask,
    sendDoubtPhoto,
    doubtUploadBusy,
  };
}
