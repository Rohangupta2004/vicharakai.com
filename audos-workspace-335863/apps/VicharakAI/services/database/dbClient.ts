/**
 * Data-access foundation for VicharakAI.
 *
 * Three problems this module owns, so no screen has to think about them:
 *
 * 1. COMPLETE READS (`useAllRows`, `fetchAllRows`) — the platform caps every
 *    read at 1000 rows per request, and the old fixed limits (500 items,
 *    200 meta…) silently truncated long-term users' data, breaking duplicate
 *    detection, coverage, mastery and revision maths. `useAllRows` keeps the
 *    reactive first page and transparently tops up the remaining pages, so
 *    consumers always see the WHOLE dataset.
 *
 * 2. SERIALIZED WRITES (`runExclusive`) — read-modify-write updates (mastery,
 *    weakness, meta upserts) used to race each other when the student acted
 *    quickly, losing attempts and duplicating rows. Writers that share a
 *    logical key now run strictly one-after-another.
 *
 * 3. FRESH ROWS (`fetchRowsWhere`) — writers re-read the CURRENT row from the
 *    database instead of trusting render-time state that may be seconds old.
 *
 * All writes still flow through sessionGuard's verifiedDbFrom (session
 * verification untouched). Table names come from ./tables — never inline.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { verifiedDbFrom, type GuardedDbTable } from '../../sessionGuard';

/* The platform-injected WorkspaceDB SDK (see integrations/workspace-db). */
declare global {
  interface Window {
    useWorkspaceDB: <T = unknown>(
      table: string,
      options?: {
        shared?: boolean;
        limit?: number;
        offset?: number;
        orderBy?: { column: string; direction: 'asc' | 'desc' };
        filters?: Array<{ column: string; operator: string; value: unknown }>;
      },
    ) => {
      data: T[];
      loading: boolean;
      error: Error | null;
      total: number;
      refresh: () => void;
    };
    __workspaceDb: {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<void>;
        update: (id: number, row: Record<string, unknown>) => Promise<void>;
        delete: (id: number) => Promise<void>;
      };
    };
    __signOut?: () => void;
  }
}

export { verifiedDbFrom };
export type { GuardedDbTable };

/** One page per request — the platform's hard per-request row cap. */
export const DB_PAGE_SIZE = 1000;
/** Safety valve: at most this many pages per fetch-all (25k rows). */
const MAX_PAGES = 25;

export interface DbFilter {
  column: string;
  /** 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' (or '='). */
  operator: string;
  value: unknown;
}

export interface DbReadOptions {
  filters?: DbFilter[];
  orderBy?: { column: string; direction: 'asc' | 'desc' };
  shared?: boolean;
}

export interface DbRowBase {
  /** Student tables use serial ids; shared reference tables may use UUIDs. */
  id: number | string;
}

/* ---------- imperative client (reads) ---------- */

interface ImperativeQuery {
  where: (column: string, operator: string, value: unknown) => ImperativeQuery;
  orderBy: (column: string, direction: 'asc' | 'desc') => ImperativeQuery;
  limit: (n: number) => ImperativeQuery;
  offset: (n: number) => ImperativeQuery;
  select: (...columns: string[]) => ImperativeQuery;
  get: () => Promise<{ data: unknown[]; total?: number }>;
}

interface ImperativeClient {
  from: (table: string, options?: { shared?: boolean }) => ImperativeQuery;
}

function imperativeClient(): ImperativeClient {
  const client = (window as unknown as { __workspaceDb?: ImperativeClient }).__workspaceDb;
  if (!client || typeof client.from !== 'function') {
    throw new Error('The data client is still loading — give it a second and try again.');
  }
  return client;
}

function normalizeOperator(op: string): string {
  return op === '=' ? 'eq' : op;
}

function buildQuery(table: string, options: DbReadOptions, page: number, columns?: string[]): ImperativeQuery {
  let query = imperativeClient().from(table, options.shared ? { shared: true } : undefined);
  if (columns && columns.length > 0) query = query.select(...columns);
  for (const filter of options.filters ?? []) {
    query = query.where(filter.column, normalizeOperator(filter.operator), filter.value);
  }
  const order = options.orderBy ?? { column: 'id', direction: 'asc' as const };
  return query.orderBy(order.column, order.direction).limit(DB_PAGE_SIZE).offset(page * DB_PAGE_SIZE);
}

/**
 * Read EVERY row of a table (within the caller's session scope), paging past
 * the per-request cap. Used by the reset service and by one-off audits;
 * screens use the reactive `useAllRows` instead.
 */
export async function fetchAllRows<T extends DbRowBase>(
  table: string,
  options: DbReadOptions = {},
  columns?: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data } = await buildQuery(table, options, page, columns).get();
    rows.push(...(data as T[]));
    if (data.length < DB_PAGE_SIZE) return rows;
  }
  console.warn(`[vicharakai-db] fetchAllRows(${table}) stopped at ${rows.length} rows (page cap)`);
  return rows;
}

/** Fresh, targeted read — the current rows matching the filters, right now. */
export async function fetchRowsWhere<T extends DbRowBase>(
  table: string,
  filters: DbFilter[],
  options: Omit<DbReadOptions, 'filters'> = {},
): Promise<T[]> {
  return fetchAllRows<T>(table, { ...options, filters });
}

/* ---------- reactive full-table hook ---------- */

export interface AllRowsResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  total: number;
  refresh: () => void;
}

function compareBy(column: string, direction: 'asc' | 'desc') {
  const sign = direction === 'desc' ? -1 : 1;
  return (a: Record<string, unknown>, b: Record<string, unknown>): number => {
    const av = a[column];
    const bv = b[column];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av ?? '').localeCompare(String(bv ?? '')) * sign;
  };
}

/**
 * Drop-in replacement for `window.useWorkspaceDB` that never truncates:
 * the first page stays reactive (insert/update/delete flows keep refreshing
 * it exactly as before), and whenever `total` says more rows exist, the
 * remaining pages are fetched imperatively and merged in (deduped by id,
 * re-sorted by the requested order).
 *
 * ACCOUNT-KEYED DATA: pass `accountSessionIds` (from
 * services/database/accountScope) and rows the SAME signed-in account wrote
 * under other session ids (another device, a previous login) are merged in
 * too — study data follows the account, not the browser session.
 */
export function useAllRows<T extends DbRowBase>(
  table: string,
  options: DbReadOptions = {},
  accountSessionIds?: string[],
): AllRowsResult<T> {
  const order = options.orderBy ?? { column: 'id', direction: 'asc' as const };
  const firstPage = window.useWorkspaceDB<T>(table, {
    shared: options.shared,
    limit: DB_PAGE_SIZE,
    orderBy: order,
    filters: options.filters as Array<{ column: string; operator: string; value: unknown }> | undefined,
  });

  const [extra, setExtra] = useState<T[]>([]);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const fetchedForTotalRef = useRef<number | null>(null);
  // Options captured per render; stable enough — filters change only with email/session.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const needsTopUp = !firstPage.loading && firstPage.total > firstPage.data.length;

  useEffect(() => {
    if (firstPage.loading) return;
    if (!needsTopUp) {
      fetchedForTotalRef.current = firstPage.total;
      setExtra((current) => (current.length > 0 ? [] : current));
      return;
    }
    if (fetchedForTotalRef.current === firstPage.total) return;
    fetchedForTotalRef.current = firstPage.total;
    let cancelled = false;
    setTopUpLoading(true);
    void (async () => {
      try {
        const rest: T[] = [];
        const opts = optionsRef.current;
        for (let page = 1; page < MAX_PAGES; page += 1) {
          const { data } = await buildQuery(table, opts, page).get();
          rest.push(...(data as T[]));
          if (data.length < DB_PAGE_SIZE) break;
        }
        if (!cancelled) setExtra(rest);
      } catch (error) {
        console.warn(`[vicharakai-db] top-up read failed for ${table}`, error);
      } finally {
        if (!cancelled) setTopUpLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [table, firstPage.loading, firstPage.total, needsTopUp]);

  /* ---------- same-account cross-session merge (account-keyed data) ----------
   * Rows this student wrote under PREVIOUS logins (another device, an expired
   * session that minted a new id on re-auth) are invisible to the default
   * session-scoped read. When the caller proves which session ids belong to
   * the signed-in account, the shared scope is read and filtered STRICTLY to
   * those ids — workspace-shared (session_id NULL) rows and founder-authored
   * rows never leak in as personal data. */
  const isSharedTable = Boolean(options.shared);
  const [accountRows, setAccountRows] = useState<T[]>([]);
  const scopeSig = accountSessionIds && accountSessionIds.length > 0 ? accountSessionIds.join(',') : '';
  useEffect(() => {
    if (!scopeSig || isSharedTable) {
      setAccountRows((current) => (current.length > 0 ? [] : current));
      return undefined;
    }
    if (firstPage.loading) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const mine = new Set(scopeSig.split(','));
        const rows = await fetchAllRows<T>(table, { ...optionsRef.current, shared: true });
        const owned = rows.filter((row) => {
          const sid = (row as unknown as { session_id?: unknown }).session_id;
          return typeof sid === 'string' && mine.has(sid);
        });
        if (!cancelled) setAccountRows(owned);
      } catch (error) {
        console.warn(`[vicharakai-db] account-scope read failed for ${table}`, error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-runs when this session's own row count changes (a write landed), so
    // cross-session state stays reasonably fresh without polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, scopeSig, isSharedTable, firstPage.loading, firstPage.total]);

  const data = useMemo(() => {
    if (extra.length === 0 && accountRows.length === 0) return firstPage.data;
    const seen = new Set(firstPage.data.map((row) => row.id));
    const merged = [...firstPage.data];
    for (const row of [...extra, ...accountRows]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    return merged.sort(compareBy(order.column, order.direction) as (a: T, b: T) => number);
  }, [firstPage.data, extra, accountRows, order.column, order.direction]);

  const loading = firstPage.loading || topUpLoading;
  /* PERF: a stable result object — consumers (effect deps, the StudentData
   * context assembly) only see a new identity when a field they can observe
   * actually changed, instead of on every render of the calling component. */
  return useMemo(
    () => ({
      data,
      loading,
      error: firstPage.error,
      total: firstPage.total,
      refresh: firstPage.refresh,
    }),
    [data, loading, firstPage.error, firstPage.total, firstPage.refresh],
  );
}

/* ---------- serialized writes ---------- */

const writeChains = new Map<string, Promise<unknown>>();

/**
 * Run `fn` strictly AFTER every earlier task queued under the same key.
 * Guarantees read-modify-write cycles that share a logical row (one chapter's
 * mastery, one meta key, one weak topic) never interleave, so rapid
 * successive completions cannot overwrite each other's changes.
 */
export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  const settled = next.then(
    () => undefined,
    () => undefined,
  );
  writeChains.set(key, settled);
  void settled.then(() => {
    if (writeChains.get(key) === settled) writeChains.delete(key);
  });
  return next;
}
