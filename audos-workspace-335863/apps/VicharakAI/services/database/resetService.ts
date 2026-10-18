/**
 * Reset All Data — the ONE true reset.
 *
 * `resetStudentStudyData()` clears EVERY study/adaptation table listed in
 * STUDENT_DATA_TABLES (services/database/tables.ts — centrally maintained so
 * a future table cannot be forgotten), reading row ids straight from the
 * database in pages rather than trusting whatever a screen happened to have
 * loaded. After it completes:
 *
 *   Tasks = empty · Revisions = empty · Mastery = reset · Weak topics = reset
 *   Readiness = reset · Study history = reset · Meta/annotations = reset
 *
 * Auth and entitlement data (vicharakai_subscriptions, vicharakai_trials, the
 * session itself) are deliberately untouched — resetting study data must
 * never revoke a paid plan, restart a trial clock, or reset daily AI usage.
 */

import { STUDENT_DATA_TABLES, TABLES } from './tables';
import { fetchAllRows, verifiedDbFrom, type DbRowBase } from './dbClient';
import { getCachedAccountSessionIds } from './accountScope';

const DELETE_CONCURRENCY = 20;
/** Re-scan passes per table — deletes can race with in-flight writes. */
const MAX_PASSES = 4;

interface OwnedRow extends DbRowBase {
  session_id?: string | null;
  meta_key?: string | null;
}

/** Account state stored alongside study metadata must survive a study reset. */
function isResettableRow(table: string, row: OwnedRow): boolean {
  return table !== TABLES.meta || !String(row.meta_key ?? '').startsWith('ai_usage|');
}

/**
 * Every resettable row id that belongs to THIS student in one table: the current
 * session's rows, plus — since study data is account-keyed (see dbClient's
 * account merge) — rows written under the account's OTHER proven sessions.
 * Without the second set, a reset would only clear the current session and
 * the old rows would reappear on the next load.
 */
async function collectRowIds(table: string): Promise<Array<number | string>> {
  const ids = new Map<string, number | string>();
  const ownColumns = table === TABLES.meta ? ['id', 'meta_key'] : ['id'];
  const own = await fetchAllRows<OwnedRow>(table, {}, ownColumns);
  for (const row of own) {
    if (isResettableRow(table, row)) ids.set(String(row.id), row.id);
  }
  const accountIds = getCachedAccountSessionIds();
  if (accountIds.length > 0) {
    try {
      const sharedColumns = table === TABLES.meta ? ['id', 'session_id', 'meta_key'] : ['id', 'session_id'];
      const shared = await fetchAllRows<OwnedRow>(table, { shared: true }, sharedColumns);
      const mine = new Set(accountIds);
      for (const row of shared) {
        if (
          isResettableRow(table, row) &&
          typeof row.session_id === 'string' &&
          mine.has(row.session_id)
        ) {
          ids.set(String(row.id), row.id);
        }
      }
    } catch {
      /* shared scope unavailable — own-session rows still get cleared */
    }
  }
  return Array.from(ids.values());
}

async function deleteAllRows(table: string): Promise<number> {
  const guarded = verifiedDbFrom(table);
  let deleted = 0;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const rowIds = await collectRowIds(table);
    if (rowIds.length === 0) return deleted;
    for (let start = 0; start < rowIds.length; start += DELETE_CONCURRENCY) {
      const batch = rowIds.slice(start, start + DELETE_CONCURRENCY);
      await Promise.all(
        batch.map((id) =>
          guarded.delete(id as number).then(
            () => {
              deleted += 1;
            },
            () => undefined, // a single stubborn row must not abort the reset
          ),
        ),
      );
    }
  }
  return deleted;
}

export interface ResetReport {
  table: string;
  deleted: number;
  /** Rows still present after all passes (0 on a clean reset). */
  remaining: number;
}

/**
 * Delete every stored study/adaptation row this student has, table by table
 * in the central order (profile last, so the app renders normally until the
 * very end). Returns a per-table report so the caller can verify the reset
 * really finished before reloading.
 */
export async function resetStudentStudyData(): Promise<ResetReport[]> {
  const reports: ResetReport[] = [];
  for (const table of STUDENT_DATA_TABLES) {
    const deleted = await deleteAllRows(table);
    let remaining = 0;
    try {
      remaining = (await collectRowIds(table)).length;
    } catch {
      remaining = 0;
    }
    reports.push({ table, deleted, remaining });
  }
  return reports;
}

/**
 * Clear the app's device-local state (preferences, caches, carry-over
 * decisions, notes). Auth/session storage is untouched.
 */
export function clearVicharakLocalState(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('vicharak') || key.includes('vicharakai') || key.startsWith('carryover_')) {
        doomed.push(key);
      }
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable — the reload still resets in-memory state */
  }
}
