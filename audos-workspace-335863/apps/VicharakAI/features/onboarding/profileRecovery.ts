/**
 * Profile recovery — the fix for the "onboarding on every login" loop.
 *
 * THE BUG: zuno_profile rows are scoped to the workspace session id, and a
 * fresh sign-in (new device, cleared storage, expired session → new OTP)
 * mints a NEW `wses_…` session id. The session-scoped profile read then finds
 * nothing, AppShell's `!profile` gate fires, and a student who finished
 * onboarding weeks ago — including paying subscribers — is marched through
 * the whole flow again on every login.
 *
 * THE FIX: before onboarding is ever shown to a SIGNED-IN student, this hook
 * checks the durable, email-keyed evidence that they already onboarded:
 *
 *  1. A shared read of zuno_profile. The platform's shared scope includes
 *     rows written by OTHER verified sessions of the same email/account, so
 *     the profile created on a previous login is visible here. Rows are
 *     matched strictly by `user_email` (stamped on every profile write since
 *     this fix) or by a session id recorded in the student's own trial row
 *     (covers legacy rows written before user_email existed). The newest
 *     match is ADOPTED IN PLACE (2026-09-29 duplicate-profile fix): a
 *     no-op-shaped update on the row is refused for another session's row,
 *     so sessionGuard falls back to the account-row-update hook, which
 *     verifies both sessions resolve to the same email and re-stamps
 *     session_id onto THIS session. The old behavior — inserting a COPY per
 *     login — left one duplicate zuno_profile row per device and let
 *     exam/start_date drift between them. The account still keeps exactly
 *     one profile row; reads are account-scoped so every device sees it.
 *  2. Belt-and-suspenders: an active paid subscription or ANY trial record
 *     for this email proves onboarding completed before (the trial row is
 *     written the moment onboarding first finishes and can never be reset).
 *     If the old profile row itself is unrecoverable, a minimal profile is
 *     created anyway — a paying student is NEVER sent back to onboarding.
 *
 * A brand-new student has none of that evidence and reaches onboarding
 * immediately. A deliberate "Reset All Data" sets a one-shot local marker
 * (markOnboardingReset) that pauses recovery until onboarding completes
 * again, so the reset flow still re-onboards on purpose.
 *
 * Every decision here re-reads from the DATABASE (not in-memory state), so
 * it holds across cold starts, hot resumes and page reloads.
 */
import { useEffect, useRef, useState } from 'react';
import { todayISO } from '../../engine';
import { fetchAllRows, verifiedDbFrom } from '../../services/database/dbClient';
import { TABLES } from '../../services/database/tables';
import { readSessionEmail } from '../../shared/sessionUtils';
import type { StudentData, StudentProfile } from '../../app/StudentDataContext';
import type { AccessFeature } from '../access/useAccess';
import { cacheOnboardingComplete, hasCachedOnboardingComplete } from './onboardingStorage';

/** zuno_profile row as the shared read returns it (system columns included). */
interface RecoverableProfileRow extends StudentProfile {
  session_id?: string | null;
  created_at?: string | null;
}

export type ProfileRecoveryStatus =
  | 'idle' // not decided yet — hold the loader for signed-in students
  | 'checking' // reading the durable evidence
  | 'restoring' // match found — writing the profile copy for this session
  | 'restored' // profile written; waiting for profileQ.refresh to surface it
  | 'new-user'; // no evidence of a finished onboarding — show the flow

export interface ProfileRecovery {
  status: ProfileRecoveryStatus;
  /** True while AppShell must hold a loader INSTEAD of showing onboarding. */
  blocking: boolean;
}

/* ---------- deliberate-reset marker ----------
 * "Reset All Data" deletes the profile ON PURPOSE so the student re-onboards.
 * Without a marker, recovery would immediately restore the old profile from a
 * previous session and the reset could never reach the exam picker. The
 * marker is set by the reset flow and cleared when onboarding completes. */

const resetMarkerKey = (spaceId: string) => `vicharak_onboarding_reset_${spaceId}`;

export function markOnboardingReset(spaceId: string): void {
  try {
    localStorage.setItem(resetMarkerKey(spaceId), '1');
  } catch {
    /* storage unavailable — worst case the old profile is restored */
  }
}

export function clearOnboardingResetMarker(spaceId: string): void {
  try {
    localStorage.removeItem(resetMarkerKey(spaceId));
  } catch {
    /* nothing to clear */
  }
}

function hasOnboardingResetMarker(spaceId: string): boolean {
  try {
    return localStorage.getItem(resetMarkerKey(spaceId)) === '1';
  } catch {
    return false;
  }
}

/** Recovery must never strand a student on a spinner — cap the lookup. */
const RECOVERY_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('profile recovery timed out')), RECOVERY_TIMEOUT_MS);
    }),
  ]);
}

export function useProfileRecovery(data: StudentData, access: AccessFeature): ProfileRecovery {
  const { spaceId, dbProfile, profileQ, dbSessionReady, pendingOnboarding } = data;
  const { paidSessionEmail, paidPlan, subscriptionsQ, trialsQ } = access;
  const [status, setStatus] = useState<ProfileRecoveryStatus>('idle');
  const attemptedRef = useRef(false);

  /* Keep the same-device fast path warm from the durable DB row. A missing
   * cache never means incomplete — recovery still verifies WorkspaceDB. */
  useEffect(() => {
    if (dbProfile?.onboarding_complete === true && paidSessionEmail) {
      cacheOnboardingComplete(spaceId, paidSessionEmail);
    }
  }, [dbProfile?.onboarding_complete, paidSessionEmail, spaceId]);

  /* Stamp user_email onto this session's existing profile row when it is
   * missing (rows written before the column existed), so every FUTURE login
   * can recover it by email directly. Quiet, once per visit, best-effort. */
  const stampRef = useRef(false);
  useEffect(() => {
    if (stampRef.current || !dbProfile || dbProfile.id < 0 || !dbSessionReady) return;
    if (typeof dbProfile.user_email === 'string' && dbProfile.user_email.includes('@')) return;
    const email = readSessionEmail(spaceId);
    if (!email) return;
    stampRef.current = true;
    void verifiedDbFrom(TABLES.profile)
      .update(dbProfile.id, { user_email: email })
      .catch(() => undefined);
  }, [dbProfile, dbSessionReady, spaceId]);

  useEffect(() => {
    if (attemptedRef.current) return;
    // A profile (or an optimistic pending onboarding) exists — nothing to do.
    if (dbProfile || pendingOnboarding) return;
    // Wait for the real session-scoped read before concluding anything.
    if (profileQ.loading || !dbSessionReady) return;
    const email = paidSessionEmail;
    if (!email) {
      // No signed-in email — no durable identity to recover by.
      attemptedRef.current = true;
      setStatus('new-user');
      return;
    }
    // The durable evidence (trial + subscription rows) must be loaded first.
    if (subscriptionsQ.loading || trialsQ.loading) return;
    // A deliberate reset re-onboards on purpose — skip recovery until the
    // student finishes onboarding again (the marker is cleared there).
    if (hasOnboardingResetMarker(spaceId)) {
      attemptedRef.current = true;
      setStatus('new-user');
      return;
    }
    attemptedRef.current = true;
    setStatus('checking');

    const trialRows = trialsQ.data ?? [];
    const cachedComplete = hasCachedOnboardingComplete(spaceId, email);
    const onboardedBefore = cachedComplete || Boolean(paidPlan) || trialRows.length > 0;
    // Legacy profiles carry no user_email — but the trial row (written moments
    // after the very first onboarding completed) records that session's id.
    const ownSessionIds = new Set(
      trialRows
        .map((row) => String((row as { session_id?: unknown }).session_id ?? '').trim())
        .filter(Boolean),
    );

    void (async () => {
      try {
        // Shared scope = unowned rows + this account's OTHER verified sessions
        // (+ founder-authored rows, which the strict matching below ignores).
        const rows = await withTimeout(
          fetchAllRows<RecoverableProfileRow>(TABLES.profile, {
            shared: true,
            orderBy: { column: 'id', direction: 'desc' },
          }),
        );
        const match = rows.find(
          (row) =>
            row.onboarding_complete === true &&
            ((typeof row.user_email === 'string' &&
              (row.user_email ?? '').trim().toLowerCase() === email) ||
              (typeof row.session_id === 'string' && ownSessionIds.has((row.session_id ?? '').trim()))),
        );
        if (match) {
          setStatus('restoring');
          // ADOPT the account's existing row instead of inserting a copy.
          // The patch deliberately re-sends the row's own exam/start_date
          // (no data change) — its purpose is the ownership re-stamp the
          // account-row-update hook performs. user_email is NOT in the patch:
          // the hook forbids it, and the stamp effect above fills it in when
          // missing once the row belongs to this session.
          if (typeof match.id === 'number' && match.id > 0) {
            try {
              await withTimeout(
                verifiedDbFrom(TABLES.profile).update(match.id, {
                  exam: match.exam,
                  start_date: match.start_date,
                  onboarding_complete: true,
                }),
              );
              profileQ.refresh();
              setStatus('restored');
              return;
            } catch {
              /* Adoption failed (hook unreachable, ownership unprovable) —
               * fall through to the legacy copy-insert so a returning
               * student is never locked out; the account-wide dedupe
               * self-heal merges the copy away later. */
            }
          }
          await withTimeout(
            verifiedDbFrom(TABLES.profile).insert({
              exam: match.exam,
              start_date: match.start_date,
              sleep_schedule: match.sleep_schedule ?? null,
              study_hours: match.study_hours ?? null,
              subject_confidence: match.subject_confidence ?? null,
              coach_notes: match.coach_notes ?? null,
              user_email: email,
              onboarding_complete: true,
            }),
          );
          profileQ.refresh();
          setStatus('restored');
          return;
        }
        if (onboardedBefore) {
          // Paying/trialed student whose old profile row is unrecoverable:
          // never re-onboard them — give them a minimal profile and let the
          // app work; they can adjust their exam from inside the app.
          setStatus('restoring');
          await withTimeout(
            verifiedDbFrom(TABLES.profile).insert({
              exam: 'general',
              start_date: todayISO(),
              user_email: email,
              onboarding_complete: true,
            }),
          );
          profileQ.refresh();
          setStatus('restored');
          return;
        }
        setStatus('new-user');
      } catch {
        // Fail OPEN to onboarding — a broken lookup must never lock the app.
        setStatus('new-user');
      }
    })();
  }, [
    dbProfile,
    pendingOnboarding,
    profileQ.loading,
    dbSessionReady,
    paidSessionEmail,
    subscriptionsQ.loading,
    trialsQ.loading,
    trialsQ.data,
    paidPlan,
    spaceId,
    profileQ,
  ]);

  /* Hold the loader for a signed-in, session-verified student until recovery
   * reaches a decision. Unverified/guest sessions are never blocked — they
   * keep today's behavior (straight to onboarding). */
  const blocking =
    Boolean(paidSessionEmail) && dbSessionReady && status !== 'new-user';

  return { status, blocking };
}
