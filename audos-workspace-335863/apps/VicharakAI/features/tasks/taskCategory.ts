/**
 * Task categories — the student-facing organisational tag on every task.
 *
 * A category is a light, additive label the student picks in the add-task
 * flow (📖 Lecture, ✏️ Self-Study, 🎯 Practice, 🔄 Revision,
 * 📌 Other). It is stored on the task row itself (zuno_items.category)
 * and shown as a small icon on the task card — always in the SAME neutral
 * muted style as the rest of the card (no per-category colours, no badges).
 *
 * TASK_CATEGORIES is the closed set the pickers offer. LEGACY_TASK_CATEGORIES
 * holds two labels earlier builds wrote to the database ('Notes',
 * 'Mock Test'); they are still recognised and still render with their own
 * icon so existing rows keep reading correctly, they are simply no longer
 * offered when adding something new.
 *
 * This is deliberately a SEPARATE concept from engine.ts's TaskType /
 * StudyTaskType (which drive the spaced-revision ladder). A category maps
 * onto a revision-ladder bucket via `categoryToStudyType` so completing a
 * task of a given category still schedules sensible FSRS revisions, and a
 * legacy task with no stored category falls back to one derived from its
 * task-type annotation.
 */
import { isTaskType, type StudyTaskType, type TaskType } from '../../engine';

/** The complete, closed set of categories the pickers offer, in cycle order. */
export const TASK_CATEGORIES = [
  'Lecture',
  'Self-Study',
  'Practice',
  'Revision',
  'Other',
] as const;

/** Labels older builds stored — recognised on read, never offered on write. */
export const LEGACY_TASK_CATEGORIES = ['Notes', 'Mock Test'] as const;

export type PickableTaskCategory = (typeof TASK_CATEGORIES)[number];
export type LegacyTaskCategory = (typeof LEGACY_TASK_CATEGORIES)[number];
export type TaskCategory = PickableTaskCategory | LegacyTaskCategory;

/** The neutral default used before the student has ever picked a category. */
export const DEFAULT_TASK_CATEGORY: PickableTaskCategory = 'Self-Study';

/** The small icon shown beside each category on a task card. */
export const CATEGORY_EMOJI: Record<TaskCategory, string> = {
  Lecture: '\uD83D\uDCD6',
  'Self-Study': '\u270F\uFE0F',
  Practice: '\uD83C\uDFAF',
  Revision: '\uD83D\uDD04',
  Other: '\uD83D\uDCCC',
  Notes: '\uD83D\uDCC4',
  'Mock Test': '\uD83E\uDDEA',
};

const CATEGORY_SET: ReadonlySet<string> = new Set<string>([
  ...TASK_CATEGORIES,
  ...LEGACY_TASK_CATEGORIES,
]);

export function isTaskCategory(value: unknown): value is TaskCategory {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

/** Coerce anything stored or received into a supported category. */
export function normalizeTaskCategory(value: unknown): TaskCategory {
  return isTaskCategory(value) ? value : DEFAULT_TASK_CATEGORY;
}

/**
 * The next category in the picker cycle — the whole interaction behind the
 * single-tap icon picker in the add-task row. A legacy label folds into the
 * cycle at its nearest offered neighbour, so tapping always moves forward.
 */
export function cycleTaskCategory(current: TaskCategory): PickableTaskCategory {
  const from: PickableTaskCategory =
    current === 'Notes' || current === 'Mock Test'
      ? 'Other'
      : (current as PickableTaskCategory);
  const index = TASK_CATEGORIES.indexOf(from);
  return TASK_CATEGORIES[(index + 1) % TASK_CATEGORIES.length];
}

/** Display TaskType (engine) → the closest category, used for legacy rows
 * that were created before the category field existed. */
export function categoryFromTaskType(type: TaskType | undefined): TaskCategory {
  switch (type) {
    case 'Lecture':
      return 'Lecture';
    case 'Question Practice':
      return 'Practice';
    case 'Revision':
      return 'Revision';
    case 'Custom':
      return 'Other';
    case 'Self Study':
    default:
      return 'Self-Study';
  }
}

/** Category → the revision-ladder bucket, so a task's spaced revisions still
 * follow sensible FSRS spacing for how it was actually studied. */
export function categoryToStudyType(category: TaskCategory): StudyTaskType {
  if (category === 'Lecture') return 'lecture';
  if (category === 'Practice' || category === 'Mock Test') return 'practice';
  return 'self_study';
}

/**
 * The category to DISPLAY for a task row: the stored column wins; otherwise
 * fall back to one derived from the task-type annotation, and finally to a
 * kind-aware default. Never throws — always returns a valid category.
 */
export function resolveTaskCategory(
  item: { category?: string | null; kind?: 'new' | 'revision' },
  annotationType?: unknown,
): TaskCategory {
  if (isTaskCategory(item.category)) return item.category;
  if (isTaskType(annotationType)) return categoryFromTaskType(annotationType);
  if (item.kind === 'revision') return 'Revision';
  return DEFAULT_TASK_CATEGORY;
}

/* ---------- last-used category (add-task default) ---------- */

const LAST_CATEGORY_KEY = 'vicharakai:lastTaskCategory';

/** The category the add-task sheet should default to — the last one used. */
export function readLastCategory(): TaskCategory {
  try {
    return normalizeTaskCategory(window.localStorage.getItem(LAST_CATEGORY_KEY));
  } catch {
    return DEFAULT_TASK_CATEGORY;
  }
}

/** Remember the category the student just used, so it becomes next default. */
export function writeLastCategory(category: TaskCategory): void {
  try {
    window.localStorage.setItem(LAST_CATEGORY_KEY, category);
  } catch {
    /* private mode / storage disabled — the default simply stays constant */
  }
}
