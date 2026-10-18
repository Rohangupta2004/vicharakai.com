/**
 * Central spaced-revision configuration — the ONE place every revision
 * ladder in the product is defined. All scheduling math flows through
 * engine/revisionEngine.ts, which reads these values.
 *
 * Three revision entity types exist (see engine/revisionEngine.ts):
 *  - 'topic'    — planner tasks (zuno_items revision rows). Ladder counts
 *                 days from the ACTUAL study date; the post-task
 *                 Hard/Medium/Easy signal picks the variant.
 *  - 'chapter'  — chapter mastery (zuno_exam_progress.spaced_revision_due_at),
 *                 indexed by the chapter's attempt count.
 *  - 'question' — saved doubt questions (zuno_question_queue.next_revision_on),
 *                 indexed by how many times the student answered it right.
 *
 * SERVER-FUNCTION MIRROR (Phase 9 note): the platform hooks
 * `zuno-mark-done`, `zuno-today` and `zuno-log-topic` implement the SAME
 * topic ladder (+1/+3/+7/+14/+28 from the study date) in their own sandboxed
 * source — hooks cannot import app modules. If TOPIC_REVISION_INTERVALS
 * changes, those three hooks must be updated in the same change
 * (via the workspace server-functions registry, not files).
 */

/** Topic ladder — THE canonical spaced-revision steps, in days:
 * 1 → 3 → 7 → 14 → 28. These five steps are the ONLY interval values a topic
 * revision may sit on — defined once, used everywhere. Post-revision ratings
 * (Again / Hard / Good / Easy) move a topic along this ladder; they never
 * invent a different ladder (see revisionEngine.nextTopicRevisionStep). */
export const TOPIC_REVISION_INTERVALS = [1, 3, 7, 14, 28];
/**
 * Post-revision rating adjustments, applied to the STANDARD next step:
 *  - Again → reset to day 1 (the first rung);
 *  - Hard  → the standard next interval, unchanged;
 *  - Good  → the standard next interval MINUS this many days (they knew it,
 *            but bring it back slightly sooner so it never quite fades);
 *  - Easy  → the standard next interval PLUS 1–2 days (they own it — push it
 *            out a bit, but NEVER skip the step itself).
 * The step position a topic holds is always one of the five ladder rungs;
 * only the concrete due DATE shifts by these day adjustments.
 */
export const RATING_GOOD_EARLIER_DAYS = 1;
/** Easy pushes short steps (1/3) one day out and longer steps (7/14/28) two. */
export const RATING_EASY_LATER_SHORT_DAYS = 1;
export const RATING_EASY_LATER_LONG_DAYS = 2;
/** A standard step at or past this many days takes the LONG easy bonus. */
export const RATING_EASY_LONG_STEP_MIN = 7;

/** Chapter-mastery ladder (zuno_exam_progress), indexed by attempt count. */
export const CHAPTER_SPACED_INTERVALS = [1, 3, 7, 14];

/** Saved-question / doubt ladder (zuno_question_queue): save → due next day,
 * each implicit "got it" grade pushes it out along the same rhythm
 * (1 → 3 → 7 → 14); after the last interval the question clears.
 * NOTE: since the FSRS integration this ladder is the FALLBACK only — it
 * schedules a doubt's first due date on save and any card without stored
 * FSRS state. Once a card has been reviewed at least once, the real FSRS
 * state machine (revisionEngine.fsrsReview) sets every next date instead. */
export const QUESTION_REVISION_INTERVALS = [1, 3, 7, 14];
/**
 * THE recall ladder behind the Again / Hard / Good / Easy chips on a review
 * card — the intervals a FIRST rating produces, in days:
 *
 *   Again -> same-session re-queue (see AGAIN_REQUEUE_MINUTES, NOT a day)
 *   Hard  -> 1 day
 *   Good  -> 4 days
 *   Easy  -> 14 days
 *
 * Again and Hard used to both resolve to 1 day, which made the two chips
 * indistinguishable and quietly destroyed the point of rating a card. Again
 * is now a within-session repeat; only Hard is the one-day rung. From the
 * SECOND review onward the FSRS state machine
 * (revisionEngine.fsrsReview) takes over and grows these intervals from the
 * card's own stability — these values are the entry rungs, not a cap.
 */
export const RECALL_INTERVAL_DAYS = { hard: 1, good: 4, easy: 14 } as const;
/**
 * An 'Again' rating re-queues the card inside the CURRENT study session,
 * roughly this many minutes later — it does not wait for tomorrow.
 */
export const AGAIN_REQUEUE_MINUTES = 10;
/**
 * FSRS mastery bound for doubt cards: once a card sits in the FSRS 'Review'
 * state and its next scheduled interval exceeds this many days, the memory
 * is considered stable enough that the doubt clears for good — the FSRS
 * counterpart of "after the last ladder interval the question clears".
 */
export const DOUBT_FSRS_CLEAR_DAYS = 30;

/** How many due revisions surface on Today; the rest stay queued in storage.
 * The SAME cap drives pile-up protection at scheduling time: when a day
 * already holds this many pending revisions, new ones chunk forward to the
 * nearest open day (see revisionEngine.nextOpenRevisionDay). */
export const REVISION_DAILY_CAP = 5;
/**
 * The SECOND ceiling on a day's revision load, in minutes. Five short recalls
 * and five long ones are not the same day's work, so the display slice stops
 * at whichever limit bites first — REVISION_DAILY_CAP items or this many
 * estimated minutes (engine.prioritizeDueRevisions applies both). One item is
 * always shown even when it alone exceeds the budget.
 */
export const REVISION_DAILY_MINUTE_CAP = 60;
/**
 * What ONE spaced recall is assumed to cost when the student has not set a
 * duration themselves. Deliberately REVISION_DAILY_MINUTE_CAP /
 * REVISION_DAILY_CAP, so the two ceilings agree on a default day: five quick
 * recalls fill exactly the 60-minute budget. The minute cap therefore only
 * bites once the student's own durations make the day genuinely heavier.
 */
export const REVISION_ITEM_MINUTES = REVISION_DAILY_MINUTE_CAP / REVISION_DAILY_CAP;
/** Pile-up cap for saved doubts: at most this many doubts due on one day. */
export const DOUBTS_DAILY_CAP = 5;
/** At most this many doubt questions stay in active rotation at once. */
export const MAX_ACTIVE_DOUBTS = 50;
/** Exactly this many spaced-revision items make the passive daily formula. */
export const DAILY_FORMULA_COUNT = 5;
/** A revision this many days past due earns the amber banner on Today. */
export const OVERDUE_ALERT_DAYS = 2;
