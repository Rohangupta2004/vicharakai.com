/**
 * accountScope — the signed-in student's OWN workspace-session ids.
 *
 * WHY: every study table is scoped to `session_id`, and the platform mints a
 * NEW `wses_…` id on every fresh login (new device, cleared storage, expired
 * session). Session-scoped reads therefore only ever saw the CURRENT login's
 * rows — tasks, scores and history written on another device (or before a
 * re-login) silently vanished from view.
 *
 * The platform's shared read scope already returns rows written by OTHER
 * verified sessions of the same email/account (see the workspace-db docs) —
 * but it also returns workspace-shared (`session_id = NULL`) rows and
 * founder-authored rows, which must never surface as this student's personal
 * data. So the merge in dbClient.useAllRows filters shared rows down to the
 * session ids this hook can PROVE belong to the signed-in email:
 *
 *  - profile rows stamped with `user_email` (every login since the recovery
 *    fix writes one), and
 *  - the trial row, which records the session id of the very first
 *    onboarding (covers legacy sessions from before user_email existed),
 *  - zuno_meta `last_open` rows, which the app stamps with the resolved
 *    email on EVERY visit (2026-09-26) — so every session the student ever
 *    opened stays provable even now that the duplicate-profile fix keeps ONE
 *    profile row per account instead of one copy per session,
 *  - plus the current runtime session id.
 *
 * A visitor with no signed-in email gets an empty list — reads then behave
 * exactly as before (current session only).
 */

import { useEffect, useState } from 'react';
import { fetchAllRows, type DbRowBase } from './dbClient';
import { TABLES } from './tables';
import { readSessionEmail, readStoredSession } from '../../shared/sessionUtils';

interface ProfileScopeRow extends DbRowBase {
  user_email?: string | null;
  session_id?: string | null;
}

interface TrialScopeRow extends DbRowBase {
  email?: string | null;
  session_id?: string | null;
}

interface MetaScopeRow extends DbRowBase {
  meta_key?: string | null;
  meta_value?: string | null;
  session_id?: string | null;
}

/** The email a last_open meta row was stamped with, or null. */
function lastOpenEmail(row: MetaScopeRow): string | null {
  try {
    const parsed = JSON.parse(String(row.meta_value ?? '{}')) as { email?: unknown };
    const email = String(parsed.email ?? '').trim().toLowerCase();
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

/** Retry cadence while the injected DB client is still loading. */
const LOOKUP_RETRY_MS = 1_500;
const LOOKUP_MAX_TRIES = 20;

/* One lookup per visit — every useAllRows consumer shares the same answer. */
let cachedEmail: string | null = null;
let cachedIds: string[] | null = null;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function currentSessionIds(spaceId: string): string[] {
  const ids: string[] = [];
  try {
    const accepted = (window as unknown as { __audosAcceptedSessionId?: unknown }).__audosAcceptedSessionId;
    if (typeof accepted === 'string' && accepted) ids.push(accepted);
  } catch {
    /* runtime id unavailable */
  }
  const stored = readStoredSession(spaceId);
  const storedId = stored ? String(stored.workspaceSessionId || stored.sessionId || stored.id || '') : '';
  if (storedId) ids.push(storedId);
  return ids;
}

/**
 * The last resolved answer for this visit — for non-React callers (e.g. the
 * reset service, which must clear the account's rows across ALL sessions).
 * `[]` until the hook has resolved once.
 */
export function getCachedAccountSessionIds(): string[] {
  return cachedIds ?? [];
}

/**
 * The proven session ids for the signed-in account — `[]` until resolved (or
 * when nobody is signed in). Stable across renders once resolved.
 */
export function useAccountSessionIds(spaceId: string): string[] {
  const [ids, setIds] = useState<string[]>(() => {
    const email = readSessionEmail(spaceId);
    return email && email === cachedEmail && cachedIds ? cachedIds : [];
  });

  useEffect(() => {
    const email = readSessionEmail(spaceId);
    if (!email) {
      setIds([]);
      return undefined;
    }
    if (email === cachedEmail && cachedIds) {
      setIds(cachedIds);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < LOOKUP_MAX_TRIES && !cancelled; attempt += 1) {
        try {
          const [profiles, trials, lastOpens] = await Promise.all([
            fetchAllRows<ProfileScopeRow>(TABLES.profile, { shared: true }),
            fetchAllRows<TrialScopeRow>(TABLES.trials, { shared: true }),
            fetchAllRows<MetaScopeRow>(TABLES.meta, {
              shared: true,
              filters: [{ column: 'meta_key', operator: 'eq', value: 'last_open' }],
            }),
          ]);
          const proven = new Set<string>(currentSessionIds(spaceId));
          for (const row of profiles) {
            const rowEmail = String(row.user_email ?? '').trim().toLowerCase();
            if (rowEmail === email && typeof row.session_id === 'string' && row.session_id) {
              proven.add(row.session_id);
            }
          }
          for (const row of trials) {
            const rowEmail = String(row.email ?? '').trim().toLowerCase();
            if (rowEmail === email && typeof row.session_id === 'string' && row.session_id) {
              proven.add(row.session_id);
            }
          }
          for (const row of lastOpens) {
            if (lastOpenEmail(row) === email && typeof row.session_id === 'string' && row.session_id) {
              proven.add(row.session_id);
            }
          }
          const list = Array.from(proven).sort();
          cachedEmail = email;
          cachedIds = list;
          if (!cancelled) setIds(list);
          return;
        } catch {
          // The injected client may still be loading, or the network blinked —
          // try again shortly; reads stay session-scoped in the meantime.
          await wait(LOOKUP_RETRY_MS);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  return ids;
}
