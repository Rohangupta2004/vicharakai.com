/**
 * zuno_meta repository — the per-student key-value store (task annotations,
 * exam date, goals, custom exam JSON, carry-over decisions…).
 *
 * `upsertMetaKey` is the ONE way to write a meta key. The old App.tsx
 * implementation decided insert-vs-update from render-time rows, so two quick
 * writes to the same key could both insert — production data already holds
 * duplicated keys (exam_date, ttype|… annotations). Writes are now serialized
 * per key and work from a fresh read, merging any historical duplicates on
 * the way (newest row wins, extras deleted).
 */

import { TABLES } from './tables';
import { fetchRowsWhere, runExclusive, verifiedDbFrom } from './dbClient';

interface MetaRowShape {
  id: number;
  meta_key: string;
  meta_value: string | null;
}

/** The current row for one meta key — deduped to the newest when a past race
 * duplicated it. Null when the key was never written. */
async function freshMetaRow(key: string): Promise<MetaRowShape | null> {
  const rows = await fetchRowsWhere<MetaRowShape>(TABLES.meta, [
    { column: 'meta_key', operator: 'eq', value: key },
  ]);
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.id - a.id);
  const keeper = sorted[0];
  const guarded = verifiedDbFrom(TABLES.meta);
  for (const extra of sorted.slice(1)) {
    await guarded.delete(extra.id).catch(() => undefined);
  }
  return keeper;
}

/** Insert-or-update one meta key, safely under concurrency. */
export async function upsertMetaKey(key: string, value: string): Promise<void> {
  await runExclusive(`meta|${key}`, async () => {
    const existing = await freshMetaRow(key);
    const guarded = verifiedDbFrom(TABLES.meta);
    if (existing) {
      if (existing.meta_value !== value) await guarded.update(existing.id, { meta_value: value });
    } else {
      await guarded.insert({ meta_key: key, meta_value: value });
    }
  });
}

/** Delete one meta key (all rows carrying it). */
export async function deleteMetaKey(key: string): Promise<void> {
  await runExclusive(`meta|${key}`, async () => {
    const rows = await fetchRowsWhere<MetaRowShape>(TABLES.meta, [
      { column: 'meta_key', operator: 'eq', value: key },
    ]);
    const guarded = verifiedDbFrom(TABLES.meta);
    for (const row of rows) {
      await guarded.delete(row.id).catch(() => undefined);
    }
  });
}
