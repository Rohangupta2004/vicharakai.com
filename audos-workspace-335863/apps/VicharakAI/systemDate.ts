/**
 * systemDate — the app's single source of "what time is it right now?", with
 * a QA-only Time Machine override behind it.
 *
 * WHY: spaced repetition (1-3-5-7-14 day ladders), the 3-day free trial, the
 * exam countdown, streaks and the daily plan all hinge on the current date.
 * Waiting real days to QA them is impossible, so the hidden Test Controls
 * panel (TimeMachinePanel.tsx) can set a date override and every date-driven
 * feature follows it.
 *
 * HOW IT WORKS:
 *  - The override is stored in localStorage as a signed OFFSET in
 *    milliseconds (simulated time − real time), so it survives refreshes and
 *    time keeps flowing naturally from the simulated moment.
 *  - `getSystemDate()` / `getSystemNow()` return the (possibly shifted)
 *    current time. With no override they are exactly `new Date()` /
 *    `Date.now()`.
 *  - EVERY "current date/time" read in the app must go through these two
 *    functions — never `new Date()` with no arguments and never a bare
 *    `Date.now()` used as "now" in app logic. Constructing a Date from an
 *    explicit value (`new Date(iso)`, `new Date(ms)`) is fine — that's not
 *    "now".
 *  - Deliberate exceptions that stay on REAL time: stopwatch-style elapsed
 *    measurement (FocusTimer, Test Mode duration), network/polling deadlines
 *    (sessionGuard) and cache TTLs (useRegion). Those measure real elapsed
 *    time, not calendar position — a QA date jump must not credit a 30-day
 *    focus session.
 *
 * The override is a TEST tool, not a user feature: nothing in the normal UI
 * writes it. Only TimeMachinePanel (opened via the hidden gesture, or the
 * Test Controls row shown to the QA account) touches it. When an override is
 * active, App.tsx shows a small persistent badge so a tester always knows
 * they are in simulated time.
 */

/** localStorage key holding the override offset (ms, simulated − real). */
export const DATE_OVERRIDE_STORAGE_KEY = 'vicharakai_qa_date_offset_ms';

const DAY_MS = 86_400_000;

/** The active override offset in ms — 0 when no override is set. */
export function getDateOverrideOffsetMs(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(DATE_OVERRIDE_STORAGE_KEY);
    if (raw === null || raw === '') return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0; // storage unavailable (privacy mode) — behave as real time
  }
}

/** True when a date override is set — drives the "test mode" badge. */
export function isDateOverrideActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DATE_OVERRIDE_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** "Now" in epoch ms — `Date.now()` shifted by the QA override when one is set. */
export function getSystemNow(): number {
  return Date.now() + getDateOverrideOffsetMs();
}

/**
 * "Now" as a Date — the app-wide replacement for `new Date()`.
 * Returns the simulated moment while a QA date override is active.
 */
export function getSystemDate(): Date {
  return new Date(getSystemNow());
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** The device's UTC offset on `date`, formatted as "+05:30" / "-07:00". */
function offsetSuffix(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/**
 * "Now" as an ISO-8601 timestamp that carries the device's own UTC OFFSET
 * (e.g. `2026-09-01T01:10:42.124+05:30`) — the app-wide replacement for
 * `getSystemDate().toISOString()` whenever the value is STORED.
 *
 * WHY the offset instead of a plain `Z` instant: every reader turns a stored
 * completion stamp into a calendar day by slicing its first ten characters
 * and comparing that against `todayISO()`, which is the LOCAL date. A UTC
 * stamp disagrees with the local calendar for every hour the two differ — in
 * IST (UTC+5:30) a task ticked at 01:10 is stamped the PREVIOUS day, so the
 * completion disappears from "Completed today", the streak and the weekly
 * counts even though the write succeeded. With the offset in the string the
 * first ten characters ARE the local day, and `new Date(...)` still resolves
 * the exact same instant.
 */
export function getSystemTimestamp(): string {
  const d = getSystemDate();
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `.${String(d.getMilliseconds()).padStart(3, '0')}${offsetSuffix(d)}`
  );
}

/**
 * Local midday on a given calendar date (YYYY-MM-DD) as a stored timestamp.
 * Used when a row is closed retroactively "on its planned day": midday keeps
 * the stamp unambiguous, and the offset keeps `.slice(0, 10)` on that day.
 */
export function localNoonTimestamp(isoDate: string): string {
  const day = String(isoDate).slice(0, 10);
  const at = new Date(`${day}T12:00:00`);
  if (Number.isNaN(at.getTime())) return getSystemTimestamp();
  return `${day}T12:00:00.000${offsetSuffix(at)}`;
}

function writeOffset(offsetMs: number): void {
  try {
    window.localStorage.setItem(DATE_OVERRIDE_STORAGE_KEY, String(Math.round(offsetMs)));
  } catch {
    /* storage unavailable — the override simply cannot persist */
  }
}

/** Shift the simulated clock by whole days (may be negative). Sets an override
 * even from a clean state, so "+1 Day" always works. */
export function advanceDateOverrideDays(days: number): void {
  writeOffset(getDateOverrideOffsetMs() + days * DAY_MS);
}

/**
 * Jump the simulated clock to a specific calendar date (YYYY-MM-DD), keeping
 * the current time-of-day so schedules and "8am summary" logic stay sane.
 * Ignores unparseable input.
 */
export function setDateOverrideToDate(isoDate: string): void {
  const target = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(target.getTime())) return;
  const now = getSystemDate();
  target.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  writeOffset(getDateOverrideOffsetMs() + (target.getTime() - now.getTime()));
}

/** Remove the override entirely — back to the real clock. */
export function clearDateOverride(): void {
  try {
    window.localStorage.removeItem(DATE_OVERRIDE_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
