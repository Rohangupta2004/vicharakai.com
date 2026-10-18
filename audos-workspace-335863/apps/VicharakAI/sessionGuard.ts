/**
 * sessionGuard — verified-session gating for WorkspaceDB WRITES.
 *
 * Why this exists: WorkspaceDB refuses a private write unless the caller's
 * session id resolves to a VERIFIED workspace session server-side — the
 * refusal surfaces as the platform's red banner ("A verified session ID is
 * required for private writes"). Two client-side windows used to let writes
 * slip out too early:
 *   1. PRE-OTP: the /register call mints a real `wses_…` session id BEFORE the
 *      student enters their code. The stored session says verified:false, but
 *      the id prefix alone used to look write-safe.
 *   2. POST-OTP: EmailGate marks the stored session verified:true the moment
 *      the code is accepted, but the platform upgrades the DB write token
 *      asynchronously — a write fired in those first moments was still refused.
 *
 * Every write in this app goes through verifiedDbFrom(), which:
 *  1. requires the LOCAL session state to look verified — an explicit
 *     verified:false (a pending OTP) is never write-safe, whatever the id
 *     prefix, and guest/preview sessions never are;
 *  2. WAITS for verification only when the local state is pending or missing.
 *     It used to wait on every write, confirming the session against
 *     /api/auth/otp/space/check-session first. That endpoint answers
 *     verified:false for real logins it does not track, so the wait ran to
 *     its full eight-second deadline and THEN wrote anyway — eight seconds
 *     of dead time on every save in the app. A locally verified session now
 *     goes straight to the network and the platform arbitrates;
 *  3. performs the write — retrying once after waiting for verification if
 *     the platform refuses it for session reasons (the post-OTP token
 *     upgrade window), then throwing a clear, friendly error rather than
 *     firing writes that would trip the platform's red banner;
 *  4. falls back to the account-row-update server function for a row this
 *     same account wrote under a PREVIOUS login, which a browser write
 *     cannot reach (see the cross-session section further down).
 *
 * Reads (useWorkspaceDB) are unaffected and never come through here.
 */

import { getWorkspaceId } from './shared/platformAuth';
import { readSessionEmail } from './shared/sessionUtils';
import { TABLES } from './services/database/tables';

export interface GuardedDbTable {
  insert: (row: Record<string, unknown>) => Promise<void>;
  update: (id: number, row: Record<string, unknown>) => Promise<void>;
  delete: (id: number) => Promise<void>;
}

interface WorkspaceDbClient {
  from: (table: string) => GuardedDbTable;
  /** The workspace data token the SDK signs every request with. */
  token?: string;
  /** Possible verified flags — the platform may expose any of these. */
  sessionVerified?: boolean;
  verified?: boolean;
  isVerified?: boolean;
  sessionReady?: boolean;
}

const SESSION_EVENTS = ['workspace-session-verified', 'audos:session-established'] as const;
/** How long one write may wait for verification before failing friendly. */
const WAIT_DEADLINE_MS = 8000;
const POLL_INTERVAL_MS = 300;
/** A negative server verdict is re-checked this often while a write waits —
 * the post-OTP token upgrade usually lands within a second or two. */
const SERVER_RECHECK_MS = 1500;
/** When the check endpoint itself failed, retry it no more often than this. */
const SERVER_RETRY_UNAVAILABLE_MS = 5000;

const NEEDS_OTP_MESSAGE =
  "Your email isn't verified yet — sign in again and enter the code we email you, then everything picks up right where you left off.";
const SESSION_EXPIRED_MESSAGE =
  'Your sign-in has expired — sign in again and everything picks up right where you left off.';
const CLIENT_LOADING_MESSAGE =
  'The app is still connecting — this will retry automatically in a moment.';
/** No data token on the page: the SDK cannot sign a write at all, so every
 * save would be rejected. Only a fresh sign-in restores it. */
const SIGN_IN_AGAIN_MESSAGE = 'Please sign in again — this device lost its connection to your account.';
/** Transient failures get 1 + RETRY_DELAYS_MS.length total attempts. */
const RETRY_DELAYS_MS = [1200, 3500];
/** Hard ceiling on ONE write attempt. The injected SDK has no timeout of its
 * own, so a hung request used to hold the caller's saving flag forever —
 * on the Mistake Book deck that froze Got it / Again for the whole visit.
 * A timeout reads as transient, so `run` below retries it automatically. */
const WRITE_ATTEMPT_TIMEOUT_MS = 20_000;

/**
 * Fired on `window` when a database operation was refused because the session
 * genuinely needs the OTP sign-in flow (it is pending verification or missing
 * entirely — waiting will never fix it). App.tsx listens for this and routes
 * the student to the email-OTP screen instead of showing a raw error.
 */
export const SESSION_UNVERIFIED_EVENT = 'vicharak:session-unverified';

function announceSessionUnverified(): void {
  try {
    window.dispatchEvent(new CustomEvent(SESSION_UNVERIFIED_EVENT));
  } catch {
    /* CustomEvent unavailable — the caller still gets the thrown error */
  }
}

function getClient(): WorkspaceDbClient | null {
  if (typeof window === 'undefined') return null;
  const client = (window as unknown as { __workspaceDb?: WorkspaceDbClient }).__workspaceDb;
  return client && typeof client.from === 'function' ? client : null;
}

/** Does the injected client hold the token it signs every write with? */
function hasDbToken(): boolean {
  const client = getClient();
  return Boolean(client && typeof client.token === 'string' && client.token.length > 0);
}

/** The tab-scoped session id the platform runtime accepted after its own
 * server check. The WorkspaceDB SDK attaches exactly this id to every
 * request, so it is the ground truth for what a write will actually carry. */
function acceptedSessionId(): string | null {
  try {
    const sid = (window as unknown as { __audosAcceptedSessionId?: unknown }).__audosAcceptedSessionId;
    return typeof sid === 'string' && sid ? sid : null;
  } catch {
    return null;
  }
}

/** This space's id (e.g. "workspace-335863"), read off the injected SDK. */
function currentSpaceId(): string | null {
  try {
    const client = (window as unknown as { __workspaceDb?: { _spaceId?: unknown } }).__workspaceDb;
    return client && typeof client._spaceId === 'string' && client._spaceId ? client._spaceId : null;
  } catch {
    return null;
  }
}

/** Parse one localStorage session entry; a malformed value is just skipped. */
function readSessionKey(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The stored space session for THIS space, when EmailGate (or the platform)
 * has saved one.
 *
 * FIX (task not adding): audos.com serves many spaces from one origin, so
 * localStorage holds a `space_session_<spaceId>` entry for EVERY space this
 * browser ever opened. The old "first space_session_* key wins" scan could
 * pick ANOTHER space's session — this workspace's check-session then
 * (correctly) answered verified:false for that foreign id, and every write
 * here was refused with "still being verified" even though the real session
 * was fine, while reads (which use the runtime's accepted id) kept working.
 * The lookup is now keyed to this space's own entry, with the accepted-id
 * match as the fallback.
 */
function readStoredSession(): Record<string, unknown> | null {
  const spaceId = currentSpaceId();
  if (spaceId) {
    const exact = readSessionKey(`space_session_${spaceId}`);
    if (exact) return exact;
  }
  const accepted = acceptedSessionId();
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('space_session_')) continue;
      const parsed = readSessionKey(key);
      if (!parsed) continue;
      const id = String(parsed.workspaceSessionId || parsed.sessionId || parsed.id || '');
      // Only an entry matching the runtime-accepted id is trustworthy here;
      // any other space_session_* key may belong to a different space.
      if (accepted && id === accepted) return parsed;
      if (!spaceId && !accepted) return parsed;
    }
  } catch {
    /* storage unavailable — fall through to "not verified" */
  }
  return null;
}

interface LocalSessionState {
  sessionId: string;
  locallyVerified: boolean;
}

/**
 * What the browser knows about the current session. `locallyVerified` is the
 * old heuristic with one critical fix: an explicit `verified: false` (the
 * pending pre-OTP session /register creates) is NEVER write-safe, even though
 * its id already carries the server-minted `wses_` prefix.
 */
function readLocalSession(): LocalSessionState | null {
  // The runtime-accepted id is what the SDK will actually send with every
  // write. It is set only after the platform's own workspace-scoped server
  // check (fresh OTP, guest entry, or a vetted returning session), so a
  // canonical wses_ id here IS the session to vet — not whatever other
  // space's entry localStorage happens to hold. The server check below still
  // confirms it against this workspace before the first write fires.
  const accepted = acceptedSessionId();
  if (accepted) {
    if (accepted.startsWith('guest_')) return null;
    if (accepted.startsWith('wses_')) return { sessionId: accepted, locallyVerified: true };
  }
  const session = readStoredSession();
  if (!session) return null;
  const sessionId = String(session.workspaceSessionId || session.sessionId || session.id || '');
  if (!sessionId || session.isGuest === true || sessionId.startsWith('guest_')) return null;
  if (session.verified === false) return { sessionId, locallyVerified: false };
  if (session.verified === true || typeof session.verifiedAt === 'string') {
    return { sessionId, locallyVerified: true };
  }
  // Legacy sessions carry no verified flag at all — a server-minted wses_ id
  // is the only local signal left; the server check below vets it for real.
  return { sessionId, locallyVerified: sessionId.startsWith('wses_') };
}

export type SessionAuthState = 'verified-locally' | 'pending' | 'missing';

/**
 * What the OTP flow still owes this browser:
 *  - 'pending'          — a session exists but its email was never OTP-verified
 *                         (the pre-OTP session /register mints, verified:false);
 *  - 'missing'          — no usable session at all (signed out, guest/preview,
 *                         or an expired session that was cleared);
 *  - 'verified-locally' — the stored session looks verified; the server check
 *                         in isDbSessionVerified vets it for real.
 * 'pending' and 'missing' can only be fixed by going through the email-OTP
 * sign-in — no amount of waiting or retrying will verify them.
 */
export function localSessionAuthState(): SessionAuthState {
  const local = readLocalSession();
  if (!local) return 'missing';
  return local.locallyVerified ? 'verified-locally' : 'pending';
}

/* ---------- server confirmation (the authoritative verdict) ---------- */

type ServerVerdict = 'verified' | 'unverified' | 'unavailable';

let verdictSessionId: string | null = null;
let verdict: ServerVerdict | null = null;
let verdictAt = 0;
let checkInFlight = false;

function workspaceIdForCheck(): string | null {
  // getWorkspaceId falls back to the stored space session when the platform
  // global is absent (custom domain, late boot) — see shared/platformAuth.
  const id = getWorkspaceId();
  return id || null;
}

function verdictIsFresh(): boolean {
  if (verdict === 'verified') return true; // a confirmed session stays confirmed
  const age = Date.now() - verdictAt;
  return age < (verdict === 'unavailable' ? SERVER_RETRY_UNAVAILABLE_MS : SERVER_RECHECK_MS);
}

/** Kick off (at most one) background check-session call for this session. */
function ensureServerCheck(sessionId: string): void {
  if (checkInFlight) return;
  if (verdictSessionId === sessionId && verdict !== null && verdictIsFresh()) return;
  const workspaceId = workspaceIdForCheck();
  if (!workspaceId) {
    // No workspace id on this page — the check cannot run; fall back to the
    // local verdict rather than blocking every write forever.
    verdictSessionId = sessionId;
    verdict = 'unavailable';
    verdictAt = Date.now();
    return;
  }
  checkInFlight = true;
  void (async () => {
    let next: ServerVerdict = 'unavailable';
    try {
      const res = await fetch(
        `/api/auth/otp/space/check-session?workspaceId=${encodeURIComponent(workspaceId)}&sessionUuid=${encodeURIComponent(sessionId)}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = (await res.json()) as { verified?: unknown };
        next = data && data.verified === true ? 'verified' : 'unverified';
      }
    } catch {
      /* network hiccup — 'unavailable' falls back to the local verdict */
    }
    verdictSessionId = sessionId;
    verdict = next;
    verdictAt = Date.now();
    checkInFlight = false;
  })();
}

/** A write the platform refused for session reasons — remember the refusal so
 * no further write fires until a fresh server check says otherwise. */
function rememberServerRefusal(): void {
  const local = readLocalSession();
  verdictSessionId = local ? local.sessionId : verdictSessionId;
  verdict = 'unverified';
  verdictAt = Date.now();
}

/**
 * Does this error come from the platform refusing the caller's session?
 * Matches the red-banner refusals ("A verified session (ID) is required…"),
 * the `session_not_verified` error code, and expired/invalid-session variants
 * — for both reads (useWorkspaceDB `.error`) and writes.
 */
export function isSessionVerificationError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    // The friendly messages verifiedDbFrom itself throws on a genuine session
    // refusal. Without these, a refused write surfaced through a caller's catch
    // reads as a NON-session error (e.g. the mock-save catch showed "check your
    // connection" and the student tapped Save forever) instead of routing them
    // to re-auth, which is the only thing that actually fixes an expired session.
    message === NEEDS_OTP_MESSAGE ||
    message === SESSION_EXPIRED_MESSAGE ||
    message === SIGN_IN_AGAIN_MESSAGE ||
    /verified session/i.test(message) ||
    /session[_\s-]*not[_\s-]*verified/i.test(message) ||
    /session[_\s-]*(required|expired|invalid)/i.test(message) ||
    /session\s+(id\s+)?is\s+(required|expired|invalid)/i.test(message)
  );
}

function isVerifiedSessionRefusal(error: unknown): boolean {
  return isSessionVerificationError(error);
}

/**
 * A failure worth retrying WITHOUT bothering the student: the injected client
 * still loading, a dropped/failed request, a timeout, or a 5xx/rate-limit
 * platform blip. Session refusals are never transient — they need re-auth.
 */
export function isTransientWriteError(error: unknown): boolean {
  if (isSessionVerificationError(error)) return false;
  if (error instanceof TypeError) return true; // fetch's network-failure class
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|network|load failed|timeout|timed out|temporar|connection|50[234]|too many requests|rate limit|still connecting|still loading/i.test(
    message,
  );
}

/**
 * The platform's answer when an update or delete targets a row the caller's
 * OWN session does not own: the data API scopes the write by session_id,
 * matches nothing and replies `404 Row not found`.
 *
 * The row is real and the student can SEE it — reads merge every session id
 * of the signed-in account (services/database/accountScope) — it simply
 * belongs to a PREVIOUS login, so only the account-verified server function
 * can write it. This is deliberately NOT a session error: the session is
 * fine, and sending the student to re-authenticate would fix nothing.
 */
export function isRowOwnershipError(error: unknown): boolean {
  if (isSessionVerificationError(error)) return false;
  const status = (error as { status?: unknown } | null | undefined)?.status;
  if (status === 404) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /row not found|no rows? (were )?(updated|matched|affected)/i.test(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/* ---------- the public verdict ---------- */

/**
 * Is the current session safe to write with?
 *
 * Preference order: an explicit verified flag on the injected client (when the
 * platform exposes one — it flips only after the token upgrade, which is
 * exactly the moment writes become safe), then the stored space session
 * CONFIRMED against the server. While the server confirmation is still in
 * flight this returns false — callers poll or wait, and flip the moment the
 * verdict lands. Guest/preview sessions and pending pre-OTP sessions
 * (verified:false) are never write-safe.
 */
export function isDbSessionVerified(): boolean {
  const client = getClient();
  if (!client) return false;
  for (const flag of [client.sessionVerified, client.verified, client.isVerified, client.sessionReady]) {
    if (typeof flag === 'boolean') return flag;
  }
  const local = readLocalSession();
  if (!local || !local.locallyVerified) return false;
  ensureServerCheck(local.sessionId);
  if (verdictSessionId !== local.sessionId || verdict === null) return false; // confirmation pending
  if (verdict === 'unverified') return false;
  return true; // 'verified' — or 'unavailable', where the local verdict stands
}

/**
 * Is a write worth attempting RIGHT NOW?
 *
 * isDbSessionVerified() answers the stricter question "has the server
 * confirmed this session", and it answers no for real logins the OTP auth
 * record does not vouch for. Gating app BEHAVIOUR on that stricter answer
 * left those students permanently "still connecting": the onboarding sync
 * effect and the plan self-heal passes never ran, so a brand-new student's
 * exam, study hours and Day-1 plan stayed in localStorage and never reached
 * the database at all.
 *
 * A locally verified session is write-ready — verifiedDbFrom attempts its
 * writes and the platform arbitrates. Guest, preview and pending-OTP
 * sessions are still excluded, so the gate keeps doing its real job.
 */
export function isDbWriteReady(): boolean {
  return isDbSessionVerified() || localSessionAuthState() === 'verified-locally';
}

/** Subscribe to the platform's session-established/verified events. Returns the unsubscribe. */
export function onSessionVerified(callback: () => void): () => void {
  const handler = () => callback();
  for (const name of SESSION_EVENTS) window.addEventListener(name, handler);
  return () => {
    for (const name of SESSION_EVENTS) window.removeEventListener(name, handler);
  };
}

/**
 * Resolve true as soon as the session is verified — immediately, on a session
 * event, or on one of the polls (each poll re-triggers the throttled server
 * check, so the post-OTP token upgrade is caught the moment it lands).
 * Resolves false when the session stays unverified for the whole deadline
 * (a provisional / signed-out / guest session): callers must NOT write then.
 */
export function waitForVerifiedSession(): Promise<boolean> {
  if (isDbSessionVerified()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let intervalId = 0;
    let unsubscribe: () => void = () => undefined;
    const settle = (ok: boolean) => {
      unsubscribe();
      window.clearInterval(intervalId);
      resolve(ok);
    };
    unsubscribe = onSessionVerified(() => {
      if (isDbSessionVerified()) settle(true);
    });
    intervalId = window.setInterval(() => {
      if (isDbSessionVerified()) settle(true);
      else if (Date.now() - startedAt >= WAIT_DEADLINE_MS) settle(false);
    }, POLL_INTERVAL_MS);
  });
}

/* ---------- same-account cross-session writes ----------
 * Reads merge study rows across EVERY session id of the signed-in account
 * (services/database/accountScope), but the platform scopes a browser
 * update/delete to rows owned by the CALLER'S OWN session. A row carried
 * over from a previous login (another device, a re-auth that minted a new
 * id) is therefore VISIBLE but not directly WRITABLE — grading a Mistake
 * Book card from an earlier login failed with "That didn't save" every
 * time, though cards saved this login graded fine. When a direct write is
 * refused, the account-row-update server function performs it server-side
 * after verifying — against the platform's own session records — that both
 * sessions belong to the same signed-in email, and re-stamps the row onto
 * the current session so the NEXT direct write succeeds without the hook. */
/* One emergency proof-stamp attempt per page load — see stampLastOpenEmailProof. */
let lastOpenProofAttempted = false;

/**
 * EMERGENCY IDENTITY PROOF for the account-row-update hook.
 *
 * The hook verifies the CALLER session by resolving it to an email:
 * check-session → zuno_profile → vicharakai_trials → zuno_meta last_open
 * (JSON {email}). A brand-new device session usually has none of the first
 * three, and the app's load-time last_open stamp (StudentDataContext) may
 * not have landed yet when the student grades their very first card. When
 * the hook answers 401 caller_session_unverified, this writes a fresh
 * last_open row — owned by THIS session, carrying the signed-in email from
 * the stored space session — so one immediate hook retry can pass. The raw
 * client is used on purpose: verifiedDbFrom would recurse into the very
 * fallback that called this. A duplicate last_open row is harmless —
 * metaRepository's next upsert heals it (newest row wins, extras deleted).
 */
async function stampLastOpenEmailProof(): Promise<boolean> {
  if (lastOpenProofAttempted) return false;
  try {
    const spaceRef = currentSpaceId();
    const client = getClient();
    if (!spaceRef || !client) return false;
    const email = readSessionEmail(spaceRef);
    if (!email) return false;
    lastOpenProofAttempted = true;
    await client.from(TABLES.meta).insert({
      meta_key: 'last_open',
      meta_value: JSON.stringify({ on: new Date().toISOString().slice(0, 10), email, ts: Date.now() }),
    });
    console.info(
      '[vicharakai-db] stamped the last_open email proof for this session — retrying the account-row hook',
    );
    return true;
  } catch (error) {
    console.warn('[vicharakai-db] could not stamp the last_open email proof', error);
    return false;
  }
}

async function accountRowFallback(
  table: string,
  op: 'update' | 'delete',
  id: number,
  patch?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const spaceRef = currentSpaceId();
    const local = readLocalSession();
    const sessionId = acceptedSessionId() || (local ? local.sessionId : '');
    if (!spaceRef || !sessionId) return false;
    const callHook = async (): Promise<{ ok: boolean; status: number; error: string }> => {
      const res = await fetch(`/api/hooks/execute/${spaceRef}/account-row-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({
          table,
          op,
          rowId: id,
          patch: op === 'update' ? patch ?? {} : undefined,
          sessionId,
        }),
      });
      const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const result =
        payload && typeof payload.data === 'object' && payload.data !== null
          ? (payload.data as Record<string, unknown>)
          : payload;
      return {
        ok: res.ok && !!result && result.success === true,
        status: res.status,
        error: result && typeof result.error === 'string' ? result.error : '',
      };
    };
    let attempt = await callHook();
    /* 401 caller_session_unverified = the hook could not tie THIS session to
     * an email (fresh device, load-time stamp not landed yet). Stamp the
     * last_open proof — the hook's fourth identity check — then retry once. */
    if (!attempt.ok && (attempt.status === 401 || attempt.error === 'caller_session_unverified')) {
      if (await stampLastOpenEmailProof()) attempt = await callHook();
    }
    if (!attempt.ok) {
      /* Left visible on purpose: when this path stops working, EVERY write
       * to a row carried over from a previous login fails, and the only
       * symptom the student sees is "That didn't save". The hook's own
       * reason code is the fastest way to tell those cases apart. */
      console.warn(
        `[vicharakai-db] account-row fallback refused ${op} on ${table}#${id}`,
        attempt.status,
        attempt.error,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[vicharakai-db] account-row fallback failed for ${table}#${id}`, error);
    return false;
  }
}

/**
 * Internal marker: the platform refused ONE attempt for session reasons, and
 * that attempt had not waited for the session to (re)verify first. Exactly
 * one wait-then-retry follows before the student is sent to the sign-in gate
 * — that window is the post-OTP token upgrade, which lands a second or two
 * after the code is accepted.
 */
class SessionRetrySignal extends Error {}

/**
 * Drop-in replacement for `window.__workspaceDb.from(table)` for WRITES.
 *
 * A session that is pending OTP or missing waits for verification and, when
 * it never arrives, throws a friendly message the existing catch/toast paths
 * surface — no write is fired that the platform would refuse with its red
 * banner. A session that already looks verified goes straight to the
 * network: the platform is the arbiter, and one wait-then-retry covers the
 * post-OTP token upgrade. If the platform still refuses for session reasons,
 * the refusal is remembered so no further write fires until a fresh server
 * check confirms the session.
 */
export function verifiedDbFrom(table: string): GuardedDbTable {
  // Note: no generic arrow here — the space compiler parses .ts as TSX, where
  // `async <T>(…)` is misread as a JSX tag. All operations resolve to void.
  const attemptOnce = async (
    operation: (t: GuardedDbTable) => Promise<void>,
    waitForSession: boolean,
  ): Promise<void> => {
    /* WAITING IS THE EXCEPTION, NOT THE RULE.
     *
     * A session pending OTP (or absent altogether) is worth waiting for. A
     * session that already looks verified locally is NOT: the server
     * re-check answers "unverified" for plenty of perfectly good logins — a
     * sign-in the OTP auth record never tracked, or one it has stopped
     * vouching for — and the old unconditional wait then burned its FULL
     * eight-second deadline before attempting the write anyway. Eight
     * seconds of dead time on every tap, every tick, every grade, is most of
     * what "nothing saves properly" actually felt like. The platform is the
     * real arbiter, so attempt the write now and let the catch below handle
     * a genuine refusal. */
    if (waitForSession || localSessionAuthState() !== 'verified-locally') {
      const verified = await waitForVerifiedSession();
      if (!verified && localSessionAuthState() !== 'verified-locally') {
        // Pending OTP or signed out — waiting longer can never fix either.
        announceSessionUnverified();
        throw new Error(NEEDS_OTP_MESSAGE);
      }
    }
    const client = getClient();
    // A slow first load can reach a write before the platform injected the
    // client — a transient state (retried by run below), never a dead end.
    if (!client) throw new Error(CLIENT_LOADING_MESSAGE);
    // Without the data token the SDK cannot sign the request, so every write
    // on this page is already lost. Say so once and route to sign-in instead
    // of letting each save fail separately with a vaguer message.
    if (!hasDbToken()) {
      announceSessionUnverified();
      throw new Error(SIGN_IN_AGAIN_MESSAGE);
    }
    /* The timeout timer is CLEARED once the race settles. Without that, every
     * successful save left a 20-second timer behind it; a long study session
     * ticking through a plan queues hundreds of them, each holding its own
     * closure alive on a phone that is already short of memory. */
    let timeoutId = 0;
    try {
      return await Promise.race([
        operation(client.from(table)),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error('The save timed out — retrying automatically.')),
            WRITE_ATTEMPT_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      if (isVerifiedSessionRefusal(error)) {
        rememberServerRefusal();
        // An attempt that never waited earns one wait-then-retry: this is
        // exactly the post-OTP window where the platform is still upgrading
        // the write token, and a refusal there means "not yet", not "signed
        // out".
        if (!waitForSession) throw new SessionRetrySignal('session refused — retrying once');
        // A write that DID wait and was still refused: that verdict is
        // authoritative, whatever the stale local verified flag claims (e.g.
        // a months-old localStorage session the server has since expired).
        // Route straight to the re-auth gate; "try again" can never fix an
        // expired session.
        announceSessionUnverified();
        throw new Error(
          localSessionAuthState() !== 'verified-locally' ? NEEDS_OTP_MESSAGE : SESSION_EXPIRED_MESSAGE,
        );
      }
      throw error;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };
  /* Transient failures (network blips, the client still loading, a 5xx) are
   * retried automatically with short backoff before anything is surfaced. */
  const run = async (operation: (t: GuardedDbTable) => Promise<void>): Promise<void> => {
    let waitForSession = false;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await attemptOnce(operation, waitForSession);
      } catch (error) {
        if (error instanceof SessionRetrySignal) {
          // The next pass waits for verification, so this can fire only once.
          waitForSession = true;
          continue;
        }
        if (attempt >= RETRY_DELAYS_MS.length || !isTransientWriteError(error)) throw error;
        console.warn(`[vicharakai-db] transient write failure on ${table} — retrying`, error);
        await delay(RETRY_DELAYS_MS[attempt]);
      }
    }
  };
  /* Updates/deletes target an EXISTING row — which may belong to another
   * login of this same account. A refused direct write falls back to the
   * account-verified server function; anything it cannot vouch for keeps
   * the original error. */
  const runOwnedWrite = async (
    op: 'update' | 'delete',
    id: number,
    patch?: Record<string, unknown>,
  ): Promise<void> => {
    try {
      return await run((t) => (op === 'update' ? t.update(id, patch ?? {}) : t.delete(id)));
    } catch (error) {
      /* A session the platform refuses needs the re-auth flow — no
         fallback write can fix that. */
      if (isSessionVerificationError(error)) throw error;
      if (await accountRowFallback(table, op, id, patch)) return;
      /* A row this account owns under a PREVIOUS login, which the fallback
         could not adopt either. "Row not found" is true but unreadable, so
         the student gets a sentence that describes what actually happened. */
      if (isRowOwnershipError(error)) {
        throw new Error(
          "That one was saved on an earlier sign-in and wouldn't update just now \u2014 try once more in a moment.",
        );
      }
      throw error;
    }
  };
  return {
    insert: (row) => run((t) => t.insert(row)),
    update: (id, row) => runOwnedWrite('update', id, row),
    delete: (id) => runOwnedWrite('delete', id),
  };
}
