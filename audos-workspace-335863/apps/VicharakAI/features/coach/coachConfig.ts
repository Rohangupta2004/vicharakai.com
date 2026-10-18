/**
 * The coach's chat surface configuration: quick asks + the action-tool
 * definitions handed to the model. Extracted verbatim from App.tsx.
 */
import type { PYQResult } from '../../pyq/types';

export interface CoachMessage {
  role: 'user' | 'coach';
  text: string;
  /** Epoch ms the message was said — restored from the row's created_at when
   * the transcript is rehydrated, so timestamps survive a device switch. */
  at?: number;
  /**
   * Verified official PYQs retrieved for this reply (rendered as cards under
   * the message — never mixed into the AI's generated text, and never
   * persisted with the transcript).
   */
  pyqs?: PYQResult[];
  /** [V2] Tappable quick-reply pills under a Vicharree message (UI-only —
   * never persisted with the transcript). */
  suggestions?: CoachSuggestion[];
  /** [V2] Daily-plan tasks rendered as actionable cards with a checkmark
   * (UI-only — the cards resolve live against zuno_items). */
  planTasks?: CoachPlanTask[];
  /** [V2] Thumbnail of a doubt photo sent from the chat composer (a local
   * data URL — display only, never persisted). */
  imageUrl?: string;
}

/** What tapping a quick-reply pill does. 'ask' sends a normal user message
 * to the AI; every other kind runs a deterministic in-app action. */
export type CoachSuggestionKind =
  | 'ask'
  | 'schedule-revision'
  | 'decline-revision'
  | 'doubt-add-revision'
  | 'doubt-create-test'
  | 'skip-today';

/** One tappable quick-reply pill (ChatGPT-style) under a Vicharree message. */
export interface CoachSuggestion {
  kind: CoachSuggestionKind;
  /** The pill's visible label. */
  label: string;
  /** The user message an 'ask' pill sends (defaults to the label). */
  ask?: string;
  /** schedule-revision payload — where the revision task files. */
  subject?: string;
  topic?: string;
}

/** One daily-plan task shown as an actionable card inside the chat. The
 * checkmark completes the SAME zuno_items row the Today tab shows. */
export interface CoachPlanTask {
  itemId: number;
  subject: string;
  topic: string;
  kind: 'new' | 'revision';
  /** WHY it is on today's plan ("Due for revision" / "Weak area" / …). */
  reason: string;
  /** Expected minutes — the same estimate Today uses. */
  estMinutes: number;
}

export const COACH_QUICK_ASKS = [
  'What should I study today?',
  'Show my weak topics',
  'Analyze my last test',
  'Update my plan',
] as const;

/**
 * [V2] The THREE quick replies Vicharree keeps on screen at all times — in
 * the chat's empty state and above the composer once the conversation is
 * running. They are the three things a student actually wants to say to a
 * study coach mid-session, and Vicharree answers each one naturally:
 * the first two from the student's own tracked data (instant and free, see
 * COACH_DETERMINISTIC_ASKS), the third from the model so the reply can meet
 * them where they are.
 */
export const COACH_QUICK_REPLIES = [
  'What should I focus on first?',
  'I finished a topic',
  "I'm struggling with something",
] as const;

/** The pill a tap answers WITHOUT a model round-trip: "I finished a topic"
 * is handled separately because its answer is a set of tappable task cards,
 * not a sentence. */
export const COACH_FINISHED_TOPIC_ASK = 'I finished a topic';

/**
 * Questions answered straight from the student's own data — always free,
 * always instant, never a trip to the model.
 */
export const COACH_DETERMINISTIC_ASKS: readonly string[] = [
  ...COACH_QUICK_ASKS,
  'What should I focus on first?',
];

/**
 * The coach's action tools — the exact same functions that power the
 * quick-add bar and the checklist, exposed to the AI so it acts directly
 * instead of telling the student to do things manually.
 */
export const COACH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: "Add a study task to the student's list for today. Use whenever the student asks to add, queue or plan a topic (e.g. \"add plane motion\").",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The task title, exactly as the student phrased it' },
          subject: { type: 'string', description: 'Optional subject, only when clearly stated' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_task_done',
      description: 'Mark a task on the student\'s list as done (e.g. "mark Optics done", "I finished thermodynamics").',
      parameters: {
        type: 'object',
        properties: { task: { type: 'string', description: 'The task or topic name the student mentioned' } },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_task',
      description: 'Remove a task from the student\'s list (e.g. "remove thermodynamics").',
      parameters: {
        type: 'object',
        properties: { task: { type: 'string', description: 'The task or topic name the student mentioned' } },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_todays_tasks',
      description: "Read out today's task list — pending and completed.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_next',
      description: 'Suggest the single smartest thing to do right now ("what should I do now").',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'postpone_task',
      description: 'Move a pending task or revision to a later day (e.g. "move optics to tomorrow", "push this revision by 2 days"). The engine validates the task exists before anything changes.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The task or topic name the student mentioned' },
          days: { type: 'number', description: 'How many days to push it — 1 (tomorrow) when unspecified' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skip_revision',
      description: 'Skip ONE revision that is due today (e.g. "skip this revision", "I already know optics"). Destructive: only call when the student explicitly asks. Later spaced revisions of the topic stay untouched.',
      parameters: {
        type: 'object',
        properties: { topic: { type: 'string', description: 'The revision topic to skip; empty means the one due now' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_todays_capacity',
      description: 'Record how much study time the student actually has today (e.g. "I only have 2 hours today", "I am tired, keep it light"). The daily plan re-fits itself to this time.',
      parameters: {
        type: 'object',
        properties: { minutes: { type: 'number', description: 'Available study time today, in minutes' } },
        required: ['minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_backlog',
      description: 'List exactly what the student is behind on — overdue revisions and carried-over tasks, with how late each one is ("show me what I\'m behind on").',
      parameters: { type: 'object', properties: {} },
    },
  },
];
