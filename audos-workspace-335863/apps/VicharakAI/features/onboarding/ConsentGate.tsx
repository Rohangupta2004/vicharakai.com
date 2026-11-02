import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

const POLICY_VERSION = '2026-10-22';

function runtimeSpaceId(): string {
  const runtime = window as any;
  return String(runtime.__SPACE_CONFIG__?.id || runtime.__workspaceDb?._spaceId || runtime.__SPACE_ID__ || runtime.__APP_ID__ || '');
}

function currentSessionId(spaceId: string): string {
  const accepted = String((window as any).__audosAcceptedSessionId || '');
  if (accepted.startsWith('wses_')) return accepted;
  try {
    const raw = localStorage.getItem(`space_session_${spaceId}`);
    const stored = raw ? JSON.parse(raw) : null;
    const id = String(stored?.workspaceSessionId || stored?.sessionId || stored?.id || '');
    return id.startsWith('wses_') ? id : '';
  } catch {
    return '';
  }
}

export default function ConsentGate({
  children,
  onComplete,
}: {
  children?: ReactNode;
  onComplete?: () => void;
}) {
  const spaceId = runtimeSpaceId();
  const sessionId = currentSessionId(spaceId);
  const currentYear = new Date().getUTCFullYear();
  const years = useMemo(() => Array.from({ length: currentYear - 1900 + 1 }, (_, index) => currentYear - index), [currentYear]);
  const [status, setStatus] = useState<'loading' | 'form' | 'saving' | 'error' | 'complete'>('loading');
  const [birthYear, setBirthYear] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianCode, setGuardianCode] = useState('');
  const [guardianCodeSent, setGuardianCodeSent] = useState(false);
  const [guardianCodeBusy, setGuardianCodeBusy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [message, setMessage] = useState('');
  const completionNotifiedRef = useRef(false);
  /* Year-only age is intentionally conservative: without a birthday, the
   * whole boundary year stays on the guardian path so no under-18 student is
   * accidentally treated as an adult. */
  const isMinor = birthYear ? currentYear - Number(birthYear) < 19 : false;

  const request = async (body: Record<string, unknown>) => {
    if (!spaceId || !sessionId) throw new Error('Your verified sign-in is still loading.');
    const response = await fetch(`/api/hooks/execute/${spaceId}/vicharakai-consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    const result = payload && typeof payload.data === 'object' ? payload.data : payload;
    if (!response.ok || result?.success !== true) throw new Error(String(result?.error || `consent_${response.status}`));
    return result;
  };

  useEffect(() => {
    if (status !== 'complete' || completionNotifiedRef.current) return;
    completionNotifiedRef.current = true;
    onComplete?.();
  }, [status, onComplete]);

  useEffect(() => {
    let cancelled = false;
    if (!spaceId || !sessionId) {
      setStatus('error');
      setMessage('We could not verify your sign-in. Please sign in again.');
      return undefined;
    }
    void request({ action: 'status' })
      .then((result) => {
        if (!cancelled) setStatus(result.complete === true ? 'complete' : 'form');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setMessage('We could not check your consent status. Check your connection and retry.');
        }
      });
    return () => { cancelled = true; };
  }, [spaceId, sessionId]);

  const sendGuardianCode = async () => {
    if (!birthYear || !guardianEmail.includes('@')) {
      setMessage('Enter a valid parent or guardian email first.');
      return;
    }
    setGuardianCodeBusy(true);
    setMessage('');
    try {
      await request({ action: 'send_guardian_code', birthYear: Number(birthYear), guardianEmail: guardianEmail.trim() });
      setGuardianCodeSent(true);
      setMessage('Consent code sent. Ask your parent or guardian for the 6-digit code.');
    } catch {
      setMessage('The consent code could not be sent. Check the email and try again.');
    } finally {
      setGuardianCodeBusy(false);
    }
  };

  const submit = async () => {
    if (!birthYear) {
      setMessage('Choose your birth year to continue.');
      return;
    }
    if (isMinor && (!guardianCodeSent || !/^\d{6}$/.test(guardianCode))) {
      setMessage('Enter the 6-digit code sent to your parent or guardian.');
      return;
    }
    setStatus('saving');
    setMessage('');
    try {
      await request({
        action: 'accept',
        birthYear: Number(birthYear),
        guardianEmail: isMinor ? guardianEmail.trim() : null,
        guardianCode: isMinor ? guardianCode : null,
        marketingConsent,
        policyVersion: POLICY_VERSION,
      });
      setStatus('complete');
    } catch (error) {
      setStatus('form');
      const code = error instanceof Error ? error.message : '';
      setMessage(code === 'guardian_code_invalid'
        ? 'That guardian code is invalid or expired. Send a new code and try again.'
        : 'That consent did not save. Please try again.');
    }
  };

  if (status === 'complete') return children ? <>{children}</> : null;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5 py-8" style={{ background: 'linear-gradient(160deg,#0A0A0F 0%,#111118 60%,#0D1A2E 100%)', color: '#F9FAFB' }}>
      <div className="w-full max-w-md rounded-3xl p-6" style={{ background: 'rgba(17,24,39,0.92)', border: '1px solid rgba(108,155,255,0.35)', boxShadow: '0 24px 70px rgba(0,87,255,0.2)' }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg,#0057FF,#003AB0)' }}>
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">
          {status === 'loading' ? 'Getting your account ready…' : 'One last thing — confirm your age'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#C9D6F2' }}>
          {status === 'loading'
            ? 'Checking what’s already set up for this account.'
            : 'This helps us set up your account correctly. We ask for your birth year only — never your full date of birth.'}
        </p>

        {status === 'loading' ? (
          <div className="mt-6 flex items-center gap-2 text-sm" style={{ color: '#C9D6F2' }}><Loader2 className="h-4 w-4 animate-spin" /> Checking your consent…</div>
        ) : status === 'error' ? (
          <div className="mt-6">
            <p role="alert" className="text-sm" style={{ color: '#FCA5A5' }}>{message}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 w-full rounded-2xl py-3.5 font-bold" style={{ background: '#0057FF', color: '#fff' }}>Retry</button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="consent-birth-year" className="mb-1.5 block text-sm font-bold">Birth year</label>
              <select id="consent-birth-year" required value={birthYear} onChange={(event) => { setBirthYear(event.target.value); setMessage(''); }} className="w-full rounded-2xl px-4 py-3.5 text-base" style={{ background: '#111827', border: '1px solid rgba(108,155,255,0.45)', color: '#fff' }}>
                <option value="">Select YYYY</option>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>

            {isMinor && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(0,87,255,0.12)', border: '1px solid rgba(108,155,255,0.4)' }}>
                <h2 className="font-extrabold">Ask a parent or guardian to help</h2>
                <p className="text-xs leading-relaxed" style={{ color: '#C9D6F2' }}>Based on your birth year, they need to approve the account before your study activity can be saved.</p>
                <input type="email" value={guardianEmail} onChange={(event) => { setGuardianEmail(event.target.value); setGuardianCodeSent(false); setGuardianCode(''); }} placeholder="Parent or guardian email" autoComplete="email" className="w-full rounded-xl px-3.5 py-3 text-base" style={{ background: '#111827', border: '1px solid rgba(108,155,255,0.45)', color: '#fff' }} />
                <button type="button" disabled={guardianCodeBusy} onClick={() => void sendGuardianCode()} className="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-60" style={{ background: '#0057FF', color: '#fff' }}>
                  {guardianCodeBusy ? 'Sending…' : guardianCodeSent ? 'Send a new code' : 'Send consent code'}
                </button>
                {guardianCodeSent && <input type="text" inputMode="numeric" maxLength={6} value={guardianCode} onChange={(event) => setGuardianCode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit guardian code" autoComplete="one-time-code" className="w-full rounded-xl px-3.5 py-3 text-center text-lg tracking-[0.3em]" style={{ background: '#111827', border: '1px solid rgba(108,155,255,0.45)', color: '#fff' }} />}
              </div>
            )}

            {!isMinor && (
              <label className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: '#C9D6F2' }}>
                <input type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} className="mt-0.5" style={{ accentColor: '#0057FF' }} />
                <span>Send occasional VicharakAI product updates and study tips (optional). You can unsubscribe at any time.</span>
              </label>
            )}
            <p className="text-xs leading-relaxed" style={{ color: '#9FB1D2' }}>Continuing means you agree to the <a href="/privacy" className="font-bold underline">Privacy Policy</a> and <a href="/terms" className="font-bold underline">Terms</a>.</p>
            {message && <p role="alert" className="text-xs" style={{ color: '#FCA5A5' }}>{message}</p>}
            <button type="button" disabled={status === 'saving'} onClick={() => void submit()} className="w-full rounded-2xl py-3.5 font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#0057FF,#003AB0)', color: '#fff' }}>
              {status === 'saving' ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>Confirm and continue <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
