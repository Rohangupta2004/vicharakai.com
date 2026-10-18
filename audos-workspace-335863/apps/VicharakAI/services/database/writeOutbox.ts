/**
 * writeOutbox — a durable retry queue for study-task saves.
 *
 * WHY: a task insert used to get exactly ONE network attempt; any hiccup
 * (slow connection, dropped request, platform blip) rolled the card off the
 * screen and told the student to "check your connection and add it once
 * more" — silently losing their work if they didn't. Now a failed insert is
 * queued HERE (localStorage — the queue itself is transient transport state,
 * the database stays the single source of truth) and retried automatically:
 * on a timer, when the browser comes back online, when the session verifies,
 * and on the next app load. The student never has to re-type anything.
 *
 * Duplicate safety: before re-sending a queued study item, the current rows
 * are re-read — if a matching row already landed (the original request
 * succeeded but its response was lost), the entry is simply dropped.
 */

import { fetchRowsWhere, verifiedDbFrom, type DbRowBase } from './dbClient';
import { upsertMetaKey } from './metaRepository';
import { TABLES } from './tables';
import { isSessionVerificationError, onSessionVerified } from '../../sessionGuard';

/** Fired on `window` whenever at least one queued write finally landed, so
 * the data layer can refresh its queries and replace drafts with real rows. */
export const OUTBOX_FLUSHED_EVENT = 'vicharak:outbox-flushed';

const STORAGE_KEY = 'vicharakai:outbox_v1';
/** Entries older than this are abandoned — a week-old draft is stale data. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Hard cap so a pathological loop can never fill localStorage. */
const MAX_ENTRIES = 100;
/** Background retry cadence while anything is queued. */
const FLUSH_INTERVAL_MS = 45_000;
/** First retry after a fresh failure — sessionGuard's own retries just ran. */
const FIRST_RETRY_DELAY_MS = 5_000;

export interface OutboxEntry {
  id: string;
  table: string;
  row: Record<string, unknown>;
  /** Optional zuno_meta companion write (the task-type annotation). */
  meta: { key: string; value: string } | null;
  queuedAt: number;
  attempts: number;
}

/** Live queue for this page session. Hydrated from localStorage on first
 * read, then kept in sync so a later persist failure during flush does not
 * drop retries that were already accepted. */
let liveQueue: OutboxEntry[] | null = null;

function parseStoredEntries(raw: string | null): OutboxEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is OutboxEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as { table?: unknown }).table === 'string' &&
        typeof (entry as { queuedAt?: unknown }).queuedAt === 'number' &&
        !!(entry as { row?: unknown }).row &&
        typeof (entry as { row?: unknown }).row === 'object',
    );
  } catch {
    return [];
  }
}

function readFromStorage(): OutboxEntry[] {
  try {
    return parseStoredEntries(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Persist the queue. Returns true only when localStorage actually holds
 * the bytes we wrote — QuotaExceeded / private-mode / SecurityError all
 * return false. There is NO silent in-memory success path. */
function writeToStorage(entries: OutboxEntry[]): boolean {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return localStorage.getItem(STORAGE_KEY) == null;
    }
    const payload = JSON.stringify(entries.slice(-MAX_ENTRIES));
    localStorage.setItem(STORAGE_KEY, payload);
    return localStorage.getItem(STORAGE_KEY) === payload;
  } catch (error) {
    console.error('[vicharakai] outbox localStorage write failed', error);
    return false;
  }
}

function readEntries(): OutboxEntry[] {
  if (liveQueue) return liveQueue;
  liveQueue = readFromStorage();
  return liveQueue;
}

function writeEntries(entries: OutboxEntry[]): boolean {
  liveQueue = entries;
  return writeToStorage(entries);
}

/** How many writes are still waiting. Entries past MAX_AGE_MS are excluded:
 * the flush pass drops them, so counting them kept the background timer
 * firing forever over a queue it was never going to deliver. */
export function pendingOutboxCount(): number {
  const now = Date.now();
  return readEntries().filter((entry) => now - entry.queuedAt <= MAX_AGE_MS).length;
}

/** Queue one failed insert for automatic background retry.
 * Returns true only when the entry is durably stored in localStorage.
 * Callers MUST treat false as a real save failure (do not close the form,
 * do not toast "kept safe"). */
export function queueInsert(
  table: string,
  row: Record<string, unknown>,
  meta?: { key: string; value: string } | null,
): boolean {
  const previous = readEntries();
  const entries = previous.slice();
  entries.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    table,
    row,
    meta: meta ?? null,
    queuedAt: Date.now(),
    attempts: 0,
  });
  const persisted = writeToStorage(entries);
  if (!persisted) {
    liveQueue = previous;
    console.error('[vicharakai] outbox queueInsert failed — entry was not stored');
    return false;
  }
  liveQueue = entries;
  /* If a pass happens to be running when this fires, the new entry was not
   * in its batch — try again shortly rather than leaving it to the 45s
   * timer, which is a long time to stare at "it will sync automatically". */
  window.setTimeout(function retryQueued() {
    if (flushing) {
      window.setTimeout(retryQueued, FIRST_RETRY_DELAY_MS);
      return;
    }
    void flushOutbox();
  }, FIRST_RETRY_DELAY_MS);
  return true;
}

interface LandedProbeRow extends DbRowBase {
  source_key?: string | null;
  scheduled_for?: string | null;
}

/** Did the original request actually land despite its lost response?
 * Only answerable for study items (they carry a stable source_key). */
async function alreadyLanded(entry: OutboxEntry): Promise<boolean> {
  if (entry.table !== TABLES.items) return false;
  const sourceKey = entry.row.source_key;
  const scheduledFor = entry.row.scheduled_for;
  const kind = entry.row.kind;
  if (typeof sourceKey !== 'string' || typeof scheduledFor !== 'string') return false;
  try {
    const rows = await fetchRowsWhere<LandedProbeRow>(TABLES.items, [
      { column: 'source_key', operator: 'eq', value: sourceKey },
      { column: 'kind', operator: 'eq', value: typeof kind === 'string' ? kind : 'new' },
      { column: 'scheduled_for', operator: 'eq', value: scheduledFor },
    ]);
    return rows.length > 0;
  } catch {
    return false; // unknowable right now — the insert attempt decides
  }
}

let flushing = false;

/**
 * Try to deliver every queued write, in order. Session refusals stop the
 * pass (retrying is pointless until the student re-authenticates); transient
 * failures keep the entry for the next pass. Never throws.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  const now = Date.now();
  const entries = readEntries().filter((entry) => now - entry.queuedAt <= MAX_AGE_MS);
  if (entries.length === 0) {
    writeEntries(entries);
    return;
  }
  flushing = true;
  let landed = 0;
  try {
    const remaining: OutboxEntry[] = [];
    let halted = false;
    for (const entry of entries) {
      if (halted) {
        remaining.push(entry);
        continue;
      }
      try {
        if (!(await alreadyLanded(entry))) {
          await verifiedDbFrom(entry.table).insert(entry.row);
        }
        if (entry.meta) {
          await upsertMetaKey(entry.meta.key, entry.meta.value).catch(() => undefined);
        }
        landed += 1;
      } catch (error) {
        console.warn('[vicharakai] outbox retry failed — keeping the entry queued', error);
        entry.attempts += 1;
        remaining.push(entry);
        // A session the platform refuses blocks EVERY queued write the same
        // way — stop here and let the re-auth flow unblock the next pass.
        if (isSessionVerificationError(error)) halted = true;
      }
    }
    /* DO NOT OVERWRITE THE QUEUE WITH `remaining` ALONE.
     *
     * A pass can take many seconds (each entry is a network round trip with
     * its own retries), and a save that fails DURING it calls queueInsert,
     * which appends straight to localStorage. Writing `remaining` back on
     * its own erased that entry — so a task added while a flush was in
     * flight was lost silently, moments after the student was told it was
     * "kept safe and will sync automatically". Re-read at write-back time
     * and keep anything whose id this pass never saw. */
    const processed = new Set(entries.map((entry) => entry.id));
    const queuedDuringFlush = readEntries().filter((entry) => !processed.has(entry.id));
    const next = [...remaining, ...queuedDuringFlush];
    if (!writeEntries(next)) {
      /* Storage refused the write-back, but these retries are still in
       * liveQueue for this session. The next persist (or a later insert)
       * will try again. */
      console.error('[vicharakai] outbox flush could not persist remaining entries');
    }
  } finally {
    flushing = false;
  }
  if (landed > 0) {
    try {
      window.dispatchEvent(new CustomEvent(OUTBOX_FLUSHED_EVENT));
    } catch {
      /* CustomEvent unavailable — queries refresh on their own soon enough */
    }
  }
}

let autoFlushInstalled = false;

/** Idempotent: wire the background triggers (online, session verified, timer). */
export function installOutboxAutoFlush(): void {
  if (autoFlushInstalled || typeof window === 'undefined') return;
  autoFlushInstalled = true;
  window.addEventListener('online', () => {
    void flushOutbox();
  });
  onSessionVerified(() => {
    void flushOutbox();
  });
  window.setInterval(() => {
    if (pendingOutboxCount() > 0) void flushOutbox();
  }, FLUSH_INTERVAL_MS);
}
