/**
 * platformAuth — the ONE place the app reads its platform credentials.
 *
 * WHY THIS EXISTS: every AI-proxy call used to read `window.__workspaceDb?.token`
 * inline, at call time, with `?? ''`. Inside audos.com the platform injects the
 * WorkspaceDB SDK early, so that read always worked. On the custom domain
 * (vicharakai.com) the SDK can attach LATE relative to a user's first tap —
 * the inline read then resolved to '' and the request was sent with an empty
 * X-Workspace-DB-Token, which the platform rejects with 401 no_credentials.
 * The failure was silent: each caller's catch block showed a generic error.
 *
 * The fixes, centralised here so no call site ever duplicates them again:
 *  - getWorkspaceDbToken(): read the live SDK first; every successful read is
 *    cached in localStorage, and the cache answers when the SDK has not
 *    attached yet (the token is workspace-scoped and ships with the app
 *    bundle, so a previously-seen copy on this origin is still valid).
 *  - waitForWorkspaceDbToken(): async — give a late-injecting SDK a few
 *    seconds to appear before giving up, instead of failing instantly.
 *  - aiProxyHeaders(): the exact headers every platform AI-proxy call must
 *    send. ALL fetches to /proxy/... go through this.
 *  - getWorkspaceId()/getSessionId()/hookHeaders(): the same robust pattern
 *    for the other two identifiers (session checks, server-function calls).
 */

const TOKEN_CACHE_KEY = 'vicharakai:wdb_token_v1';
/** How long a caller may wait for a late-injecting SDK before giving up. */
const TOKEN_WAIT_MS = 6000;
const TOKEN_POLL_MS = 250;

function liveToken(): string {
  try {
    const token = (window as unknown as { __workspaceDb?: { token?: unknown } }).__workspaceDb?.token;
    return typeof token === 'string' && token.length > 0 ? token : '';
  } catch {
    return '';
  }
}

/**
 * The workspace data token, synchronously: the live SDK value when present
 * (refreshing the cache), else the last value this origin ever saw, else ''.
 */
export function getWorkspaceDbToken(): string {
  const live = liveToken();
  if (live) {
    try {
      localStorage.setItem(TOKEN_CACHE_KEY, live);
    } catch {
      /* private mode — the live value still answers this call */
    }
    return live;
  }
  try {
    return localStorage.getItem(TOKEN_CACHE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * The token, waiting up to `timeoutMs` for a late-injecting SDK. Resolves ''
 * only when neither the SDK nor the cache can answer within the window —
 * callers should treat '' as "the AI/data service is unavailable right now".
 */
export async function waitForWorkspaceDbToken(timeoutMs: number = TOKEN_WAIT_MS): Promise<string> {
  const startedAt = Date.now();
  for (;;) {
    const token = getWorkspaceDbToken();
    if (token) return token;
    if (Date.now() - startedAt >= timeoutMs) return '';
    await new Promise((resolve) => {
      window.setTimeout(resolve, TOKEN_POLL_MS);
    });
  }
}

/**
 * The headers EVERY platform AI-proxy call (/proxy/openai/..., /proxy/anthropic/...)
 * must send. Await it right before the fetch — it absorbs SDK injection lag.
 */
export async function aiProxyHeaders(): Promise<Record<string, string>> {
  return {
    'X-Workspace-DB-Token': await waitForWorkspaceDbToken(),
    'Content-Type': 'application/json',
  };
}

/** This space's id (e.g. "workspace-335863"), read off the injected SDK or globals. */
export function getSpaceId(): string {
  try {
    const w = window as unknown as {
      __workspaceDb?: { _spaceId?: unknown };
      __APP_ID__?: unknown;
      __SPACE_ID__?: unknown;
    };
    for (const candidate of [w.__workspaceDb?._spaceId, w.__APP_ID__, w.__SPACE_ID__]) {
      if (typeof candidate === 'string' && candidate) return candidate;
    }
  } catch {
    /* fall through */
  }
  return '';
}

/**
 * The workspace UUID for auth endpoints. The platform global answers on
 * audos.com; on the custom domain (or a late boot) the stored space session
 * — which records the workspaceId the OTP flow verified against — answers.
 */
export function getWorkspaceId(): string {
  try {
    const injected = (window as unknown as { __WORKSPACE_ID__?: unknown }).__WORKSPACE_ID__;
    if (typeof injected === 'string' && injected) return injected;
  } catch {
    /* fall through to the stored session */
  }
  try {
    const spaceId = getSpaceId();
    const keys = spaceId ? [`space_session_${spaceId}`] : [];
    if (keys.length === 0) {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('space_session_')) keys.push(key);
      }
    }
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { workspaceId?: unknown };
      if (typeof parsed.workspaceId === 'string' && parsed.workspaceId) return parsed.workspaceId;
    }
  } catch {
    /* storage unavailable or malformed — no workspace id to give */
  }
  return '';
}

/** The runtime-accepted (or stored) workspace session id — '' when signed out. */
export function getSessionId(): string {
  try {
    const accepted = (window as unknown as { __audosAcceptedSessionId?: unknown }).__audosAcceptedSessionId;
    if (typeof accepted === 'string' && accepted) return accepted;
  } catch {
    /* fall through to the stored session */
  }
  try {
    const spaceId = getSpaceId();
    const raw = spaceId ? localStorage.getItem(`space_session_${spaceId}`) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const id = String(parsed.workspaceSessionId || parsed.sessionId || parsed.id || '');
      if (id) return id;
    }
  } catch {
    /* storage unavailable — no session id to give */
  }
  return '';
}

/**
 * Headers for server-function (hook) calls — always JSON, plus the session id
 * when one exists so identity-aware hooks can attribute the request.
 */
export function hookHeaders(): Record<string, string> {
  const sessionId = getSessionId();
  return {
    'Content-Type': 'application/json',
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
  };
}
