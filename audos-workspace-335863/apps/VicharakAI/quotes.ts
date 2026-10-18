/**
 * VicharakAI's quote library — written for competitive-exam aspirants in India
 * (JEE / NEET / UPSC / CAT / SSC). Tone: a senior who cracked the exam talking
 * to a junior — warm, grounded, peer-to-peer. No western hustle-culture noise.
 *
 * Styling rule everywhere these appear: muted + italic, gentle fade-in. Quotes
 * are felt, not noticed — they never compete with the primary action on screen.
 */

/** Rotating daily quotes — one per day under the morning greeting. */
export const DAILY_QUOTES: string[] = [
  'Consistency beats intensity every time.',
  'Every topper you know had a day they almost quit.',
  "Your syllabus won't shrink. Your discipline can grow.",
  'The mock test that hurts today saves you on exam day.',
  'VicharakAI remembers every session. Even the hard ones count.',
  "Behind today doesn't mean behind forever. Start now.",
  "Focus on today's mission. The exam takes care of itself.",
  'One chapter done properly beats three done in panic.',
  "Ranks aren't decided in the exam hall. They're decided on quiet Tuesdays like this.",
  'Backlogs feel heavy because you lift them all at once. Pick up one.',
  'The NCERT line you revise today is a mark you keep on results day.',
  "Nobody is watching your grind. That's exactly why it works.",
  'A bad test is data, not a verdict.',
  'Revision is where average aspirants become rankers.',
  "You don't need a perfect day. You need a done day.",
  "The seniors who cracked it weren't smarter. They just didn't stop.",
  'Coaching gives you the map. Your desk is where the distance is covered.',
  'Two hours of full focus beat six hours of half scrolling.',
  "Your future self is already in that exam hall, thanking today's you.",
  "Small wins, stacked daily — that's the whole secret.",
  'Toppers study on low-mood days too. Mood follows action.',
  'Every formula you revisit today is one less blank stare in the exam.',
  "Comparison drains marks. Your only race is with yesterday's you.",
  'Sleep well, revise on time, repeat. Boring wins ranks.',
  "The question that troubles you today is the one you'll nail in the exam.",
  'One honest hour today is worth ten panicked ones in the last week.',
  "The exam doesn't test who you were. It tests who you kept becoming.",
  'Nobody feels ready. The ones who show up anyway are the ones who clear it.',
];

/** Deterministic rotation: same quote all day, a new one tomorrow. */
export function dailyQuote(dateISO: string): string {
  let hash = 0;
  for (let i = 0; i < dateISO.length; i += 1) {
    hash = (hash * 31 + dateISO.charCodeAt(i)) >>> 0;
  }
  return DAILY_QUOTES[hash % DAILY_QUOTES.length];
}

/** Short celebratory lines flashed as a toast when a task is marked done. */
export const COMPLETION_QUOTES: string[] = [
  'One step closer. Keep going.',
  "That's how toppers are made.",
  'Done and noted. Even the hard sessions count.',
  'Another brick laid. Quietly solid.',
  "That's one thing the exam can't surprise you with now.",
  'Ticked. Your future self just smiled.',
  'This is what showing up looks like.',
  'Logged for revision. Nothing you study is ever lost.',
  'One more topic in the bank.',
  'Small win now, big rank later.',
];

let completionCursor = Math.floor(Math.random() * COMPLETION_QUOTES.length);

/** Cycles through the completion quotes so back-to-back check-offs never repeat. */
export function completionQuote(): string {
  completionCursor = (completionCursor + 1) % COMPLETION_QUOTES.length;
  return COMPLETION_QUOTES[completionCursor];
}

/** Context-aware lines for the pace signal ("Am I on track?"). */
export const TRACK_QUOTES = {
  on_track: "You're doing what most only talk about.",
  behind_recoverable: "Behind today doesn't mean behind forever. Start now.",
  behind_critical: "The exam doesn't care about yesterday. Today is what matters.",
} as const;

/** Maps a pace status (green / amber / red) onto its quote. */
export function trackQuote(status: string): string {
  if (status === 'amber' || status === 'behind_recoverable') return TRACK_QUOTES.behind_recoverable;
  if (status === 'red' || status === 'behind_critical') return TRACK_QUOTES.behind_critical;
  return TRACK_QUOTES.on_track;
}

/** Streak days that earn a full-screen milestone moment. */
export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

const STREAK_QUOTES: Record<number, string> = {
  3: "Three days without breaking. That's not luck — that's you.",
  7: "7 days straight. You're building something real.",
  14: 'Two weeks of showing up. Most aspirants never get this far.',
  30: "30 days. This isn't motivation anymore — it's who you are.",
};

export function isStreakMilestone(count: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(count);
}

export function streakMilestoneQuote(count: number): string {
  return STREAK_QUOTES[count] ?? `${count} days straight. You're building something real.`;
}

/**
 * Warm, non-preachy things to say when a student taps "Feeling low?". No
 * cheerleading and no guilt — permission to do less today, once.
 */
export const FEELING_LOW_MESSAGES: string[] = [
  "Rough day? That's allowed. Let's shrink today instead of skipping it.",
  "Some days the brain just says no. Fine — we go small today, not zero.",
  "You don't owe anyone a perfect day. Fifteen honest minutes still counts.",
  "Every serious aspirant has days like this. They don't quit — they lower the bar for one day.",
  "Heavy head today? Let's protect the streak, not the workload.",
];

/** One supportive line per day, so tapping twice doesn't feel like a slot machine. */
export function feelingLowMessage(dateISO: string): string {
  let hash = 7;
  for (let i = 0; i < dateISO.length; i += 1) {
    hash = (hash * 17 + dateISO.charCodeAt(i)) >>> 0;
  }
  return FEELING_LOW_MESSAGES[hash % FEELING_LOW_MESSAGES.length];
}
